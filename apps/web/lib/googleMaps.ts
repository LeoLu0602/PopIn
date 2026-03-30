// Shared Google Maps JS API loader singleton.
// Import and call loadGoogleMaps() from any file — the loader is only
// created once with a fixed libraries list, preventing the
// "Loader must not be called again with different options" error.

let loadPromise: Promise<any> | null = null;

export function loadGoogleMaps(): Promise<any> {
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
        const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) throw new Error('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is not set');

        const { Loader } = await import('@googlemaps/js-api-loader');
        const loader = new Loader({
            apiKey,
            version: 'weekly',
            // All libraries needed across the app. Adding here avoids
            // calling Loader again with a different libraries array.
            libraries: ['marker', 'places', 'geocoding'],
        });
        return loader.load();
    })();

    return loadPromise;
}
