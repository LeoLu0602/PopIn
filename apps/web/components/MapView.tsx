import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import mapboxgl from 'mapbox-gl';
import type { EventWithDetails } from 'shared';
import { geocodeAddress } from '../lib/geocode';
import { supabase } from '../lib/supabase';

const CONTAINER_ID = 'popin-mapbox-container';
const OSU_OVAL: [number, number] = [-83.0058, 40.0076];

interface Props {
    events: EventWithDetails[];
}

function ensureMapboxCss() {
    if (typeof document === 'undefined' || document.getElementById('mapbox-gl-css')) return;
    const link = document.createElement('link');
    link.id = 'mapbox-gl-css';
    link.rel = 'stylesheet';
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.20.0/mapbox-gl.css';
    document.head.appendChild(link);
}

export default function MapView({ events }: Props) {
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<mapboxgl.Marker[]>([]);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<EventWithDetails | null>(null);
    const [panelLoading, setPanelLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            setUserId(data.user?.id || null);
        });
    }, []);

    // Initialize map once on mount
    useEffect(() => {
        ensureMapboxCss();

        const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
        const container = document.getElementById(CONTAINER_ID);
        if (!token || !container) return;

        mapboxgl.accessToken = token;

        const map = new mapboxgl.Map({
            container,
            style: 'mapbox://styles/mapbox/streets-v12',
            center: OSU_OVAL,
            zoom: 14,
        });

        mapRef.current = map;

        map.once('load', () => {
            navigator.geolocation.getCurrentPosition(
                ({ coords }) => {
                    const loc: [number, number] = [coords.longitude, coords.latitude];
                    setUserLocation(loc);
                    map.setCenter(loc);
                    new mapboxgl.Marker({ color: '#4287f5' })
                        .setLngLat(loc)
                        .addTo(map);
                },
                (err) => console.error('Geolocation error:', err.code, err.message),
            );
        });

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // Add event pins whenever events change
    useEffect(() => {
        if (!mapRef.current) return;

        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];

        let cancelled = false;

        (async () => {
            for (const event of events) {
                if (cancelled || !event.location_text) continue;
                const coords = await geocodeAddress(event.location_text);
                if (cancelled || !coords || !mapRef.current) continue;

                // Hover popup — shows brief info, no close button
                const hoverPopup = new mapboxgl.Popup({
                    offset: 25,
                    closeButton: false,
                    closeOnClick: false,
                }).setHTML(
                    `<div style="font-family:sans-serif;min-width:160px">
                        <strong style="font-size:13px">${event.title}</strong>
                        <div style="font-size:11px;color:#555;margin-top:4px">${new Date(event.start_time).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                        <div style="font-size:11px;color:#888;margin-top:2px">${event.attendee_count ?? 0} attending · click for details</div>
                    </div>`,
                );

                const marker = new mapboxgl.Marker({ color: '#BE0000' })
                    .setLngLat(coords)
                    .addTo(mapRef.current);

                const el = marker.getElement();
                el.style.cursor = 'pointer';

                el.addEventListener('mouseenter', () => {
                    if (mapRef.current) hoverPopup.setLngLat(coords).addTo(mapRef.current);
                });
                el.addEventListener('mouseleave', () => {
                    hoverPopup.remove();
                });
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    hoverPopup.remove();
                    openPanel(event);
                });

                markersRef.current.push(marker);
            }
        })();

        return () => { cancelled = true; };
    }, [events]);

    const openPanel = async (event: EventWithDetails) => {
        setSelectedEvent(event);
        setPanelLoading(true);

        const { data } = (await supabase
            .from('events')
            .select(`*, host:profiles!events_host_id_fkey(id, email, display_name), event_members(user_id)`)
            .eq('id', event.id)
            .single()) as any;

        if (data) {
            const uid = (await supabase.auth.getUser()).data.user?.id || null;
            setSelectedEvent({
                ...data,
                host: data.host,
                attendee_count: data.event_members?.length || 0,
                is_joined: uid ? data.event_members?.some((m: any) => m.user_id === uid) : false,
            });
        }
        setPanelLoading(false);
    };

    const handleJoin = async () => {
        if (!selectedEvent || !userId) return;
        setActionLoading(true);
        // @ts-expect-error - Supabase type inference issue
        await supabase.from('event_members').insert({ event_id: selectedEvent.id, user_id: userId });
        setActionLoading(false);
        openPanel(selectedEvent);
    };

    const handleLeave = async () => {
        if (!selectedEvent || !userId) return;
        setActionLoading(true);
        await supabase.from('event_members').delete()
            .eq('event_id', selectedEvent.id)
            .eq('user_id', userId);
        setActionLoading(false);
        openPanel(selectedEvent);
    };

    const goToMyLocation = () => {
        if (mapRef.current && userLocation) {
            mapRef.current.flyTo({ center: userLocation, zoom: 15 });
        }
    };

    const isHost = selectedEvent && userId && userId === selectedEvent.host_id;
    const isFull = selectedEvent?.capacity != null && (selectedEvent.attendee_count ?? 0) >= selectedEvent.capacity;

    return (
        <View style={{ height: 'calc(100vh - 200px)' as any, width: '100%', position: 'relative' }}>
            {/* Map */}
            <View
                nativeID={CONTAINER_ID}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />

            {/* Locate me button — only shown once geolocation is available */}
            {userLocation && (
                <TouchableOpacity
                    onPress={goToMyLocation}
                    style={{
                        position: 'absolute',
                        bottom: 24,
                        right: selectedEvent ? 336 : 16,
                        backgroundColor: '#fff',
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.2,
                        shadowRadius: 4,
                        elevation: 4,
                        zIndex: 10,
                    } as any}
                >
                    <Text style={{ fontSize: 16 }}>📍</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>Where am I?</Text>
                </TouchableOpacity>
            )}

            {/* Event detail side panel */}
            {selectedEvent && (
                <View style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    bottom: 0,
                    width: 320,
                    backgroundColor: '#fff',
                    zIndex: 20,
                    shadowColor: '#000',
                    shadowOffset: { width: -2, height: 0 },
                    shadowOpacity: 0.15,
                    shadowRadius: 10,
                    elevation: 8,
                }}>
                    {/* Close */}
                    <TouchableOpacity
                        onPress={() => setSelectedEvent(null)}
                        style={{ position: 'absolute', top: 14, right: 14, zIndex: 30, padding: 6 }}
                    >
                        <Text style={{ fontSize: 18, color: '#9ca3af' }}>✕</Text>
                    </TouchableOpacity>

                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
                        {panelLoading ? (
                            <ActivityIndicator size="large" color="#BB0000" style={{ marginTop: 80 }} />
                        ) : (
                            <>
                                <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 20, marginRight: 28, lineHeight: 28 }}>
                                    {selectedEvent.title}
                                </Text>

                                <View style={{ gap: 16, marginBottom: 24 }}>
                                    <View>
                                        <Text style={{ fontSize: 11, color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>📅 When</Text>
                                        <Text style={{ fontSize: 14, color: '#111827' }}>
                                            {new Date(selectedEvent.start_time).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                        </Text>
                                    </View>

                                    <View>
                                        <Text style={{ fontSize: 11, color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>📍 Where</Text>
                                        <Text style={{ fontSize: 14, color: '#111827' }}>{selectedEvent.location_text}</Text>
                                    </View>

                                    <View>
                                        <Text style={{ fontSize: 11, color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>👥 Attending</Text>
                                        <Text style={{ fontSize: 14, color: '#111827' }}>
                                            {selectedEvent.attendee_count ?? 0}
                                            {selectedEvent.capacity != null ? ` / ${selectedEvent.capacity}` : ''} people
                                            {isFull && <Text style={{ color: '#BB0000', fontWeight: '600' }}> · FULL</Text>}
                                        </Text>
                                    </View>

                                    {selectedEvent.host && (
                                        <View>
                                            <Text style={{ fontSize: 11, color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>🎯 Host</Text>
                                            <Text style={{ fontSize: 14, color: '#BB0000', fontWeight: '600' }}>
                                                {selectedEvent.host.display_name || selectedEvent.host.email?.split('@')[0]}
                                            </Text>
                                        </View>
                                    )}

                                    {selectedEvent.description ? (
                                        <View>
                                            <Text style={{ fontSize: 11, color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>📝 About</Text>
                                            <Text style={{ fontSize: 14, color: '#374151', lineHeight: 22 }}>{selectedEvent.description}</Text>
                                        </View>
                                    ) : null}
                                </View>

                                {/* Divider */}
                                <View style={{ height: 1, backgroundColor: '#f3f4f6', marginBottom: 20 }} />

                                {isHost ? (
                                    <Text style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center' }}>You are hosting this event</Text>
                                ) : (
                                    <>
                                        <TouchableOpacity
                                            onPress={selectedEvent.is_joined ? handleLeave : handleJoin}
                                            disabled={actionLoading || (!selectedEvent.is_joined && !!isFull)}
                                            style={{
                                                backgroundColor: selectedEvent.is_joined ? '#fff' : '#BB0000',
                                                borderRadius: 12,
                                                paddingVertical: 14,
                                                alignItems: 'center',
                                                borderWidth: 1,
                                                borderColor: selectedEvent.is_joined ? '#D1D5DB' : '#A50000',
                                                opacity: actionLoading || (!selectedEvent.is_joined && !!isFull) ? 0.5 : 1,
                                            }}
                                        >
                                            {actionLoading ? (
                                                <ActivityIndicator color={selectedEvent.is_joined ? '#6B7280' : '#fff'} />
                                            ) : (
                                                <Text style={{ color: selectedEvent.is_joined ? '#374151' : '#fff', fontWeight: '600', fontSize: 15 }}>
                                                    {selectedEvent.is_joined ? 'Leave Event' : isFull ? 'Event Full' : 'Join Event'}
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                        {selectedEvent.is_joined && (
                                            <Text style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 8 }}>You can leave anytime</Text>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </ScrollView>
                </View>
            )}
        </View>
    );
}
