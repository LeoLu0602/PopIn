# PopIn — OSU Student Events App

A mobile event discovery and management platform for OSU students, built with Expo and Supabase.

## Tech Stack

- **Mobile**: Expo (React Native) + TypeScript + Expo Router
- **Styling**: NativeWind (Tailwind CSS)
- **Backend**: Supabase (Auth, Postgres, RLS, Edge Functions, Storage)
- **Package Manager**: pnpm workspaces

## Features

- **Auth**: Email OTP, restricted to @osu.edu
- **Feed**: Browse active events with time filters
- **Events**: Create, edit, cancel (host); join/leave (attendee)
- **Profiles**: Avatar, stats, interest tags; view other users' profiles
- **Push Notifications**: Join alerts to host, update/cancel alerts to attendees, 15-min start reminders
- **Event Photos**: Host can upload a cover image

## Getting Started

### 1. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. In the SQL Editor, run all migrations in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/003_push_notifications.sql`
   - `supabase/migrations/004_hosted_count_trigger.sql`
   - `supabase/migrations/005_cancel_event_rpc.sql`
3. In **Authentication → Providers → Email**: enable Email, disable "Confirm Email"
4. In **Storage**: create a public bucket named `event-photos`

### 2. Install & Configure

```bash
npm install -g pnpm
pnpm install
cd apps/mobile && cp .env.example .env
```

Edit `apps/mobile/.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_EAS_PROJECT_ID=your-eas-project-id
```

### 3. Push Notifications

Deploy the edge functions:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase functions deploy send-push
supabase functions deploy event-reminders
```

Set up the 15-min reminder cron (in Supabase SQL Editor):

```sql
SELECT cron.schedule(
  'event-reminders', '* * * * *',
  $$ SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/event-reminders',
    headers := '{"Authorization":"Bearer <service-role-key>","Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  ); $$
);
```

> `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected into edge functions — no manual secret setup needed.
> Push tokens only register on **physical devices**, not simulators.

### 4. Run

```bash
pnpm mobile
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).

## Database Schema

| Table | Key Columns |
|---|---|
| `profiles` | `id`, `display_name`, `avatar_url`, `major`, `year`, `interest_tags`, `hosted_count`, `attendance_rate`, `expo_push_token` |
| `events` | `id`, `host_id`, `title`, `start_time`, `end_time`, `location_text`, `capacity`, `description`, `status`, `image_url`, `reminder_sent_at` |
| `event_members` | `event_id`, `user_id`, `joined_at` |
| `feedback` | `id`, `user_id`, `message`, `screen` |

RLS is enabled on all tables. Cancel uses a `SECURITY DEFINER` RPC (`cancel_event`) to bypass a WITH CHECK limitation in the events UPDATE policy.

## Troubleshooting

- **OTP not arriving**: check spam; verify Email provider is enabled in Supabase Auth
- **Push not received**: confirm you're on a physical device; check edge function logs in Supabase dashboard
- **RLS errors**: ensure all migrations ran; verify the user is authenticated
- **TypeScript errors**: run `pnpm install` from root, restart the TS server
