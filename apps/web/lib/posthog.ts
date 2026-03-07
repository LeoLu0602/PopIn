import posthog from "posthog-js";

type AnalyticsClient = {
  capture: (event: string, properties?: Record<string, unknown>) => void;
  identify: (distinctId: string, properties?: Record<string, unknown>) => void;
};

const noopClient: AnalyticsClient = {
  capture: () => {},
  identify: () => {},
};

let initialized = false;
let missingConfigWarned = false;

export function getPostHog(): AnalyticsClient {
  if (!initialized) {
    const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY as string | undefined;
    const host = process.env.EXPO_PUBLIC_POSTHOG_HOST as string | undefined;

    if (!apiKey || !host) {
      if (!missingConfigWarned) {
        console.warn("[posthog] env vars missing — analytics disabled");
        missingConfigWarned = true;
      }
      return noopClient;
    }

    try {
      posthog.init(apiKey, {
        api_host: host,
        autocapture: false,
        capture_pageview: false,
      });
      initialized = true;
    } catch (error) {
      console.error("[posthog] init failed:", error);
      return noopClient;
    }
  }

  return {
    capture: (event, properties) => posthog.capture(event, properties),
    identify: (distinctId, properties) => posthog.identify(distinctId, properties),
  };
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
