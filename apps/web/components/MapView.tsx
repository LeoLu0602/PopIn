import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { EventWithDetails } from 'shared';
import { resolveEventLocation } from '../lib/geocode';
import { supabase } from '../lib/supabase';

const CONTAINER_ID = 'popin-google-map-container';
// OSU campus center
const OSU_CENTER = { lat: 40.0076, lng: -83.0458 };

interface Props {
    events: EventWithDetails[];
}

export default function MapView({ events }: Props) {
    const mapRef = useRef<any>(null);
    const googleRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const clustererRef = useRef<any>(null);
    const infoWindowRef = useRef<any>(null);
    const [mapReady, setMapReady] = useState(false);
    const [mapError, setMapError] = useState(false);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<EventWithDetails | null>(null);
    const [panelLoading, setPanelLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            setUserId(data.user?.id || null);
        });
    }, []);

    // Initialize Google Maps
    useEffect(() => {
        let destroyed = false;

        (async () => {
            const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
            if (!apiKey) {
                setMapError(true);
                return;
            }

            try {
                const { Loader } = await import('@googlemaps/js-api-loader');
                const loader = new Loader({
                    apiKey,
                    version: 'weekly',
                    libraries: ['marker', 'places', 'geocoding'],
                });

                const google = await loader.load();
                if (destroyed) return;

                googleRef.current = google;

                const container = document.getElementById(CONTAINER_ID);
                if (!container) return;

                const map = new google.maps.Map(container, {
                    center: OSU_CENTER,
                    zoom: 15,
                    // DEMO_MAP_ID enables Advanced Markers.
                    // Replace with a real Map ID from Google Cloud Console for production.
                    mapId: 'DEMO_MAP_ID',
                    disableDefaultUI: false,
                });

                mapRef.current = map;
                infoWindowRef.current = new google.maps.InfoWindow();

                setMapReady(true);

                // User location pin
                navigator.geolocation.getCurrentPosition(
                    ({ coords }) => {
                        if (destroyed) return;
                        const loc = { lat: coords.latitude, lng: coords.longitude };
                        setUserLocation(loc);
                        map.setCenter(loc);

                        google.maps.importLibrary('marker').then((markerLib: any) => {
                            if (destroyed) return;
                            const userPin = new markerLib.PinElement({
                                background: '#4287f5',
                                borderColor: '#2d6ad6',
                                glyphColor: '#fff',
                            });
                            new markerLib.AdvancedMarkerElement({
                                position: loc,
                                map,
                                content: userPin.element,
                                title: 'You are here',
                            });
                        });
                    },
                    (err) => console.error('Geolocation error:', err.code, err.message),
                );
            } catch (err) {
                console.error('[MapView] Failed to load Google Maps:', err);
                if (!destroyed) setMapError(true);
            }
        })();

        return () => {
            destroyed = true;
            markersRef.current.forEach((m) => m.setMap(null));
            markersRef.current = [];
            mapRef.current = null;
            googleRef.current = null;
            setMapReady(false);
        };
    }, []);

    // Place event pins whenever events change or map becomes ready
    useEffect(() => {
        if (!mapReady || !mapRef.current || !googleRef.current) return;

        const map = mapRef.current;
        const google = googleRef.current;
        const iw = infoWindowRef.current;

        // Clear previous clusterer (removes all managed markers from the map)
        clustererRef.current?.clearMarkers();
        clustererRef.current = null;
        markersRef.current = [];

        let cancelled = false;

        (async () => {
            const markerLib: any = await google.maps.importLibrary('marker');
            const { MarkerClusterer } = await import('@googlemaps/markerclusterer');
            const newMarkers: any[] = [];

            for (const event of events) {
                if (cancelled) break;

                // Prefer stored coordinates; fall back to geocoding for old events
                let position: { lat: number; lng: number } | null = null;
                if (event.location_lat != null && event.location_lng != null) {
                    position = { lat: event.location_lat, lng: event.location_lng };
                } else if (event.location_text) {
                    position = await resolveEventLocation(event.location_text);
                }
                if (cancelled || !position) continue;

                const pin = new markerLib.PinElement({
                    background: '#BB0000',
                    borderColor: '#A50000',
                    glyphColor: '#fff',
                });

                // No `map` here — MarkerClusterer manages map assignment
                const marker = new markerLib.AdvancedMarkerElement({
                    position,
                    content: pin.element,
                    title: event.title,
                });

                const infoContent =
                    `<div style="font-family:sans-serif;min-width:160px;padding:2px 0">` +
                    `<strong style="font-size:13px">${event.title}</strong>` +
                    `<div style="font-size:11px;color:#555;margin-top:4px">${new Date(event.start_time).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>` +
                    `<div style="font-size:11px;color:#888;margin-top:2px">${event.attendee_count ?? 0} attending · click for details</div>` +
                    `</div>`;

                // Hover — show info window
                marker.element.addEventListener('mouseenter', () => {
                    iw.setContent(infoContent);
                    iw.open({ anchor: marker, map });
                });
                marker.element.addEventListener('mouseleave', () => {
                    iw.close();
                });

                // Click — open side panel
                marker.addListener('click', () => {
                    iw.close();
                    openPanel(event);
                });

                newMarkers.push(marker);
            }

            if (!cancelled) {
                markersRef.current = newMarkers;
                // MarkerClusterer groups nearby pins into a count badge;
                // clicking a cluster zooms in to reveal individual markers.
                clustererRef.current = new MarkerClusterer({ map, markers: newMarkers });
            }
        })();

        return () => { cancelled = true; };
    }, [events, mapReady]);

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
            mapRef.current.panTo(userLocation);
            mapRef.current.setZoom(16);
        }
    };

    const isHost = selectedEvent && userId && userId === selectedEvent.host_id;
    const isFull = selectedEvent?.capacity != null && (selectedEvent.attendee_count ?? 0) >= selectedEvent.capacity;

    if (mapError) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }}>
                <Text style={{ color: '#6b7280', fontSize: 15 }}>Map unavailable — missing Google Maps API key.</Text>
            </View>
        );
    }

    return (
        <View style={{ height: 'calc(100vh - 200px)' as any, width: '100%', position: 'relative' }}>
            {/* Map container */}
            <View
                nativeID={CONTAINER_ID}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />

            {/* Loading overlay */}
            {!mapReady && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' }}>
                    <ActivityIndicator size="large" color="#BB0000" />
                </View>
            )}

            {/* Locate me button */}
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
                    position: 'absolute', top: 0, right: 0, bottom: 0, width: 320,
                    backgroundColor: '#fff', zIndex: 20,
                    shadowColor: '#000', shadowOffset: { width: -2, height: 0 },
                    shadowOpacity: 0.15, shadowRadius: 10, elevation: 8,
                }}>
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
                                                borderRadius: 12, paddingVertical: 14, alignItems: 'center',
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
