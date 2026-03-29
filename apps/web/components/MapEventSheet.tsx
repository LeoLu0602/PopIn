import { useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { EventWithDetails } from 'shared';

interface Props {
    events: EventWithDetails[];
    onClose: () => void;
    onSelectEvent: (event: EventWithDetails) => void;
}

export default function MapEventSheet({ events, onClose, onSelectEvent }: Props) {
    const slideAnim = useRef(new Animated.Value(400)).current;

    // Slide up on mount
    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
        }).start();
    }, []);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    // Derive a short location label from the first event (strip room suffix)
    const locationLabel = events[0]?.location_text?.split(/[|,\-–]/)[0].trim() ?? 'Events';

    return (
        <>
            {/* Backdrop — click outside to close */}
            <Pressable
                onPress={onClose}
                style={{ position: 'absolute', inset: 0, zIndex: 25 } as any}
            />

            {/* Sheet */}
            <Animated.View
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    maxHeight: '50%',
                    backgroundColor: '#fff',
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    zIndex: 30,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -3 },
                    shadowOpacity: 0.12,
                    shadowRadius: 10,
                    elevation: 10,
                    transform: [{ translateY: slideAnim }],
                }}
            >
                {/* Drag handle */}
                <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
                    <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#d1d5db' }} />
                </View>

                {/* Header */}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 20,
                    paddingTop: 8,
                    paddingBottom: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: '#f3f4f6',
                }}>
                    <View>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>
                            📍 {locationLabel}
                        </Text>
                        <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                            {events.length} events at this location
                        </Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
                        <Text style={{ fontSize: 18, color: '#9ca3af' }}>✕</Text>
                    </TouchableOpacity>
                </View>

                {/* Event rows */}
                <ScrollView bounces={false}>
                    {events.map((event, i) => (
                        <TouchableOpacity
                            key={event.id}
                            onPress={() => onSelectEvent(event)}
                            activeOpacity={0.7}
                            style={{
                                paddingHorizontal: 20,
                                paddingVertical: 14,
                                borderBottomWidth: i < events.length - 1 ? 1 : 0,
                                borderBottomColor: '#f3f4f6',
                            }}
                        >
                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 3 }}>
                                {event.title}
                            </Text>
                            <Text style={{ fontSize: 12, color: '#6b7280', lineHeight: 18 }}>
                                {new Date(event.start_time).toLocaleString('en-US', {
                                    weekday: 'short', month: 'short', day: 'numeric',
                                    hour: 'numeric', minute: '2-digit',
                                })}
                                {' · '}{event.location_text}
                            </Text>
                            {event.attendee_count != null && (
                                <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
                                    {event.attendee_count} attending
                                    {event.capacity != null ? ` · ${Math.max(event.capacity - event.attendee_count, 0)} spots left` : ''}
                                </Text>
                            )}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </Animated.View>
        </>
    );
}
