import PostHog from "posthog-react-native";

// Singleton client — initialized once for the entire app lifetime
let _client: PostHog | null = null;

export function getPostHog(): PostHog {
  if (!_client) {
    _client = new PostHog(process.env.EXPO_PUBLIC_POSTHOG_API_KEY as string, {
      host: process.env.EXPO_PUBLIC_POSTHOG_HOST as string,
      // Flush immediately on every capture (good for mobile MVP)
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return _client;
}

// Convenience: build the standard event properties payload
export function buildEventProps(event: {
  id: string;
  title: string;
  start_time: string;
  location_text: string;
  host_id: string;
}) {
  return {
    event_id: event.id,
    event_title: event.title,
    event_start_time: event.start_time,
    event_location: event.location_text,
    creator_id: event.host_id,
  };
}
