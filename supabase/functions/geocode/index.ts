import { createClient } from "npm:@supabase/supabase-js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HOUR_LIMIT = 20;
const DAY_LIMIT  = 100;

// ---------------------------------------------------------------------------
// Rate limit helpers
// ---------------------------------------------------------------------------

/** Returns { hourWindow, dayWindow, hourExpiresAt, dayExpiresAt } for now. */
function getRateLimitWindows(now: Date) {
  // Hour bucket: "hour:2025-01-15T14" (UTC hour)
  const hourStr = now.toISOString().slice(0, 13); // "2025-01-15T14"
  const hourWindow = `hour:${hourStr}`;
  const hourExpiresAt = new Date(now);
  hourExpiresAt.setUTCMinutes(60, 0, 0); // end of current UTC hour

  // Day bucket: "day:2025-01-15" (UTC date)
  const dayStr = now.toISOString().slice(0, 10); // "2025-01-15"
  const dayWindow = `day:${dayStr}`;
  const dayExpiresAt = new Date(dayStr + "T00:00:00Z");
  dayExpiresAt.setUTCDate(dayExpiresAt.getUTCDate() + 1); // start of next UTC day

  return { hourWindow, dayWindow, hourExpiresAt, dayExpiresAt };
}

function rateLimitResponse(reason: "hour" | "day", resetsAt: Date) {
  const resetsIn = Math.ceil((resetsAt.getTime() - Date.now()) / 1000 / 60);
  const message =
    reason === "hour"
      ? `Hourly geocoding limit (${HOUR_LIMIT} requests) reached. Resets in ${resetsIn} minute(s).`
      : `Daily geocoding limit (${DAY_LIMIT} requests) reached. Resets in ${resetsIn} minute(s).`;

  return new Response(JSON.stringify({ error: message, resets_at: resetsAt.toISOString() }), {
    status: 429,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      "Retry-After": String(resetsIn * 60),
    },
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let address: string;
  try {
    const body = await req.json();
    address = (body?.address ?? "").trim();
    if (!address) throw new Error("missing address");
  } catch {
    return new Response(JSON.stringify({ error: "Request body must be JSON with an 'address' field" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl     = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const googleApiKey    = Deno.env.get("GOOGLE_MAPS_API_KEY");

  if (!googleApiKey) {
    return new Response(JSON.stringify({ error: "Server geocoding key not configured" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // Resolve the calling user from the Authorization header (JWT).
  // Guests (no token) bypass rate limiting — they can't create events and
  // the geocoding fallback is rarely reached without the Maps JS API loaded.
  let userId: string | null = null;
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    userId = user?.id ?? null;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ---------------------------------------------------------------------------
  // Cache check — cache hits bypass rate limiting entirely (no Google API call)
  // ---------------------------------------------------------------------------
  const { data: cached } = await supabase
    .from("geocode_cache")
    .select("lat, lng")
    .eq("address", address)
    .maybeSingle();

  if (cached) {
    console.log("[geocode] cache hit:", address);
    return new Response(JSON.stringify({ lat: cached.lat, lng: cached.lng }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // ---------------------------------------------------------------------------
  // Rate limiting — only for authenticated users, only on cache misses
  // ---------------------------------------------------------------------------
  if (userId) {
    const now = new Date();
    const { hourWindow, dayWindow, hourExpiresAt, dayExpiresAt } = getRateLimitWindows(now);

    const { data: counts, error: rpcError } = await supabase.rpc("increment_geocode_rate_limit", {
      p_user_id:         userId,
      p_hour_window:     hourWindow,
      p_day_window:      dayWindow,
      p_hour_expires_at: hourExpiresAt.toISOString(),
      p_day_expires_at:  dayExpiresAt.toISOString(),
    });

    if (rpcError) {
      console.error("[geocode] rate limit RPC error:", rpcError);
      // Fail open — don't block the user if rate limiting itself errors
    } else if (counts?.[0]) {
      const { hour_count, day_count } = counts[0];
      console.log(`[geocode] user=${userId} hour=${hour_count}/${HOUR_LIMIT} day=${day_count}/${DAY_LIMIT}`);

      if (hour_count > HOUR_LIMIT) {
        return rateLimitResponse("hour", hourExpiresAt);
      }
      if (day_count > DAY_LIMIT) {
        return rateLimitResponse("day", dayExpiresAt);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Call Google Geocoding REST API server-side
  // ---------------------------------------------------------------------------
  const encoded = encodeURIComponent(address);
  const googleUrl =
    `https://maps.googleapis.com/maps/api/geocode/json` +
    `?address=${encoded}` +
    `&bounds=39.9880,-83.0680|40.0220,-83.0100` +
    `&key=${googleApiKey}`;

  let lat: number, lng: number;
  try {
    const res = await fetch(googleUrl);
    const data = await res.json();
    const result = data.results?.[0];
    if (!result) {
      console.log("[geocode] no results for:", address);
      return new Response(JSON.stringify({ lat: null, lng: null }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
    lat = result.geometry.location.lat;
    lng = result.geometry.location.lng;
  } catch (err) {
    console.error("[geocode] Google API error:", err);
    return new Response(JSON.stringify({ error: "Geocoding failed" }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // Store in cache (fire-and-forget — don't block the response)
  supabase
    .from("geocode_cache")
    .insert({ address, lat, lng })
    .then(({ error }) => {
      if (error) console.error("[geocode] cache insert error:", error);
      else console.log("[geocode] cached:", address);
    });

  return new Response(JSON.stringify({ lat, lng }), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
