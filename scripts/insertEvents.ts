import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load .env file from the scripts directory
const envPath = path.resolve(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    process.env[key.trim()] = rest.join("=").trim();
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const POPIN_TEAM_HOST_ID = process.env.POPIN_TEAM_HOST_ID!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !POPIN_TEAM_HOST_ID) {
  console.error("Missing required environment variables:");
  if (!SUPABASE_URL) console.error("  - SUPABASE_URL");
  if (!SUPABASE_SERVICE_KEY) console.error("  - SUPABASE_SERVICE_KEY");
  if (!POPIN_TEAM_HOST_ID) console.error("  - POPIN_TEAM_HOST_ID");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Date Parsing ─────────────────────────────────────────────────────────────
// Input examples:
//   date: "Thursday, April 9, 2026"
//   time: "4 p.m. - 7 p.m." or "noon - 3 p.m." or "11:30 a.m. - 1 p.m."

function parseTime(timeStr: string): { hours: number; minutes: number } {
  const normalized = timeStr.trim().toLowerCase();

  if (normalized === "noon") return { hours: 12, minutes: 0 };
  if (normalized === "midnight") return { hours: 0, minutes: 0 };

  const match = normalized.match(/(\d+)(?::(\d+))?\s*(a\.m\.|p\.m\.)/);
  if (!match) return { hours: 12, minutes: 0 }; // fallback to noon

  let hours = parseInt(match[1]);
  const minutes = match[2] ? parseInt(match[2]) : 0;
  const period = match[3];

  if (period === "p.m." && hours !== 12) hours += 12;
  if (period === "a.m." && hours === 12) hours = 0;

  return { hours, minutes };
}

function buildTimestamp(dateStr: string, timeStr: string): string {
  // dateStr: "Thursday, April 9, 2026"
  const cleanDate = dateStr.replace(/^[A-Za-z]+,\s*/, ""); // remove day name
  const base = new Date(`${cleanDate} EST`);

  const { hours, minutes } = parseTime(timeStr);
  base.setHours(hours, minutes, 0, 0);

  return base.toISOString();
}

function parseStartEnd(
  dateStr: string,
  timeRange: string
): { start_time: string; end_time: string } {
  const parts = timeRange.split(/\s*-\s*(?=\S)/).map((s) => s.trim());
  const startStr = parts[0];
  const endStr = parts[1] ?? parts[0];

  // If end has no am/pm, inherit from start
  const inferredEnd = endStr.match(/a\.m\.|p\.m\./)
    ? endStr
    : endStr + " " + (startStr.match(/a\.m\.|p\.m\./)?.[0] ?? "p.m.");

  return {
    start_time: buildTimestamp(dateStr, startStr),
    end_time: buildTimestamp(dateStr, inferredEnd),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function insertEvents() {
  const raw = fs.readFileSync(path.resolve(__dirname, "./tagged_events.json"), "utf-8");
  const events = JSON.parse(raw);

  console.log(`Inserting ${events.length} events...\n`);

  let successCount = 0;
  let failCount = 0;

  for (const event of events) {
    try {
      const { start_time, end_time } = parseStartEnd(event.date, event.time);

      const row = {
        host_id: POPIN_TEAM_HOST_ID,
        title: event.title,
        description: event.description ?? null,
        location_text: event.location,
        start_time,
        end_time,
        tags: event.tags ?? [],
        source_url: event.url ?? null,
        status: "active",
      };

      const { error } = await supabase.from("events").insert(row);

      if (error) {
        console.error(`✗ Failed: "${event.title}"\n  ${error.message}`);
        failCount++;
      } else {
        console.log(`✓ Inserted: "${event.title}"`);
        successCount++;
      }
    } catch (err) {
      console.error(`✗ Error on "${event.title}": ${err}`);
      failCount++;
    }
  }

  console.log(`\n─────────────────────────────────`);
  console.log(`✓ Success: ${successCount}`);
  console.log(`✗ Failed:  ${failCount}`);
  console.log(`─────────────────────────────────`);
}

insertEvents();
