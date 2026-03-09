export async function registerForPushNotifications(_userId: string): Promise<void> {
  // Push notifications are not supported on web
}

// ── In-app event notifications ──────────────────────────────────────────────

import { supabase } from "./supabase";

export type EventNotification = {
  id: string;
  user_id: string;
  event_id: string;
  type: "event_updated" | "event_cancelled";
  changed_fields: string[];
  read: boolean;
  created_at: string;
};

export async function getUnreadNotificationCount(): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data, error } = await supabase
    .from("event_notifications")
    .select("event_id")
    .eq("user_id", user.id)
    .eq("read", false);

  if (error || !data) return 0;
  return new Set(data.map((n) => n.event_id)).size;
}

export async function getEventNotifications(
  eventId: string
): Promise<EventNotification[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("event_notifications")
    .select("*")
    .eq("user_id", user.id)
    .eq("event_id", eventId)
    .eq("read", false)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as EventNotification[];
}

export async function markEventNotificationsRead(
  eventId: string
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("event_notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("event_id", eventId)
    .eq("read", false);
}

// Called client-side by the host after saving event changes.
// RLS ensures only the event host can insert.
export async function createNotificationsForAttendees(
  eventId: string,
  hostId: string,
  type: "event_updated" | "event_cancelled",
  changedFields: string[]
): Promise<void> {
  const { data: members, error } = await supabase
    .from("event_members")
    .select("user_id")
    .eq("event_id", eventId)
    .neq("user_id", hostId);

  if (error || !members || members.length === 0) return;

  const notifications = members.map((m) => ({
    user_id: m.user_id,
    event_id: eventId,
    type,
    changed_fields: changedFields,
    read: false,
  }));

  // @ts-expect-error - Supabase type inference issue
  await supabase.from("event_notifications").insert(notifications);
}
