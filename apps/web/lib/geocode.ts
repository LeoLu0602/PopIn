// BROWSER KEY — restricted to Maps JavaScript API + Places API in Google Cloud Console.
// Domain restriction: https://pop-in-osu.vercel.app/* and https://*.vercel.app/*
// For geocoding at creation time we use google.maps.Geocoder (part of Maps JS API)
// so we never need to expose a separate server-side key from the browser.

export interface LatLng {
    lat: number;
    lng: number;
}

// ---------------------------------------------------------------------------
// OSU place dictionary
// Maps common campus nicknames/abbreviations to full street addresses.
// Using addresses (not coords) keeps this easy to verify on Google Maps and
// lets Google's geocoder apply its own precision.
// ---------------------------------------------------------------------------
const OSU_PLACES: Record<string, string> = {
    // Student Life
    'ohio union': '1739 N High St, Columbus, OH 43210',
    'rpac': '337 Annie and John Glenn Ave, Columbus, OH 43210',

    // Large Venues & Landmarks
    'ohio stadium': '411 Woody Hayes Dr, Columbus, OH 43210',
    'the shoe': '411 Woody Hayes Dr, Columbus, OH 43210',
    'schottenstein center': '555 Borror Dr, Columbus, OH 43210',
    'the schott': '555 Borror Dr, Columbus, OH 43210',
    'mershon auditorium': '1871 N High St, Columbus, OH 43210',
    'wexner center': '1871 N High St, Columbus, OH 43210',

    // Academic Buildings
    'smith laboratory': '174 W 18th Ave, Columbus, OH 43210',
    'smith lab': '174 W 18th Ave, Columbus, OH 43210',
    'hagerty hall': '1775 College Rd, Columbus, OH 43210',
    'stillman hall': '1947 College Rd, Columbus, OH 43210',
    'hitchcock hall': '2070 Neil Ave, Columbus, OH 43210',
    'dreese laboratory': '2015 Neil Ave, Columbus, OH 43210',
    'dreese lab': '2015 Neil Ave, Columbus, OH 43210',
    'knowlton hall': '275 W Woodruff Ave, Columbus, OH 43210',
    'caldwell lab': '2024 Neil Ave, Columbus, OH 43210',
    'journalism building': '242 W 18th Ave, Columbus, OH 43210',
    'independence hall': '1923 Neil Ave, Columbus, OH 43210',
    'pomerene hall': '1760 Neil Ave, Columbus, OH 43210',
    'thompson library': '1858 Neil Ave Mall, Columbus, OH 43210',
    'main library': '1858 Neil Ave Mall, Columbus, OH 43210',
    '18th ave library': '175 W 18th Ave, Columbus, OH 43210',

    // Outdoor & Campus Landmarks
    'oval': 'The Oval, Ohio State University, Columbus, OH 43210',
    'the oval': 'The Oval, Ohio State University, Columbus, OH 43210',
    'mirror lake': 'Mirror Lake, Columbus, OH 43210',
    'south oval': 'South Oval, Columbus, OH 43210',
};

// ---------------------------------------------------------------------------
// Normalise free-text location to a canonical lowercase key
// ---------------------------------------------------------------------------
function normalizeLocation(text: string): string {
    return text
        .split(/[|,\-–]/)[0]       // take first segment before | , - –
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, '')
        .trim();
}

// ---------------------------------------------------------------------------
// geocodeAddress — uses Google Maps JS API Geocoder (browser-safe)
// Falls back to REST API if google.maps isn't loaded yet.
// ---------------------------------------------------------------------------
export async function geocodeAddress(address: string): Promise<LatLng | null> {
    try {
        // Prefer the JS API Geocoder when it's available (uses the browser key
        // that's already loaded for the map — no extra key exposure).
        if (typeof window !== 'undefined' && (window as any).google?.maps?.Geocoder) {
            return await geocodeWithJsApi(address);
        }

        // Fallback: REST Geocoding API using the public browser key
        const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!key) return null;
        return await geocodeWithRestApi(address, key);
    } catch (err) {
        console.error('[geocode] geocodeAddress error:', err);
        return null;
    }
}

async function geocodeWithJsApi(address: string): Promise<LatLng | null> {
    const geocoder = new (window as any).google.maps.Geocoder();
    return new Promise((resolve) => {
        geocoder.geocode(
            {
                address,
                bounds: {
                    north: 40.0220, south: 39.9880,
                    east: -83.0100, west: -83.0680,
                },
            },
            (results: any[], status: string) => {
                if (status === 'OK' && results?.[0]) {
                    const loc = results[0].geometry.location;
                    resolve({ lat: loc.lat(), lng: loc.lng() });
                } else {
                    resolve(null);
                }
            },
        );
    });
}

async function geocodeWithRestApi(address: string, key: string): Promise<LatLng | null> {
    const encoded = encodeURIComponent(address);
    const url =
        `https://maps.googleapis.com/maps/api/geocode/json` +
        `?address=${encoded}` +
        `&bounds=39.9880,-83.0680|40.0220,-83.0100` +
        `&key=${key}`;
    const res = await fetch(url);
    const data = await res.json();
    const result = data.results?.[0];
    if (!result) return null;
    return result.geometry.location as LatLng;
}

// ---------------------------------------------------------------------------
// resolveEventLocation — three-step pipeline
// Step 1: OSU dictionary (nickname → full address → geocode)
// Step 2: (AI cleaning — requires server; not available in this Expo web app)
// Step 3: Direct geocode fallback on raw location_text
// ---------------------------------------------------------------------------
export async function resolveEventLocation(locationText: string): Promise<LatLng | null> {
    const normalized = normalizeLocation(locationText);

    // Step 1 — OSU dictionary
    try {
        // Exact match first, then substring containment
        const exactKey = Object.keys(OSU_PLACES).find((k) => k === normalized);
        const partialKey = exactKey ?? Object.keys(OSU_PLACES).find((k) => normalized.includes(k));
        if (partialKey) {
            const coords = await geocodeAddress(OSU_PLACES[partialKey]);
            if (coords) return coords;
        }
    } catch (err) {
        console.error('[geocode] OSU dictionary step failed:', err);
    }

    // Step 3 — direct geocode fallback (Step 2 skipped: needs server-side AI)
    try {
        return await geocodeAddress(locationText);
    } catch (err) {
        console.error('[geocode] fallback geocode failed:', err);
        return null;
    }
}
