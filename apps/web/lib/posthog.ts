import PostHog from "posthog-react-native";

type AnalyticsClient = Pick<PostHog, "capture" | "identify">;

const noopClient: AnalyticsClient = {
  capture: () => {},
  identify: () => {},
};

let missingConfigWarned = false;

// Singleton client — initialized once for the entire app lifetime
let _client: AnalyticsClient | null = null;

export function getPostHog(): AnalyticsClient {
  if (!_client) {
    // @ts-expect-error - Expo Metro resolves EXPO_PUBLIC_* at build time
    const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY as string | undefined;
    // @ts-expect-error - Expo Metro resolves EXPO_PUBLIC_* at build time
    const host = process.env.EXPO_PUBLIC_POSTHOG_HOST as string | undefined;

    if (!apiKey || !host) {
      if (!missingConfigWarned) {
        console.warn("[posthog] Missing EXPO_PUBLIC_POSTHOG_API_KEY or EXPO_PUBLIC_POSTHOG_HOST, analytics disabled");
        missingConfigWarned = true;
      }
      _client = noopClient;
      return _client;
    }

    try {
      _client = new PostHog(apiKey, {
        host,
        flushAt: 1,
        flushInterval: 0,
      }) as AnalyticsClient;
    } catch (error) {
      console.warn("[posthog] Failed to initialize client, analytics disabled", error);
      _client = noopClient;
    }
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
