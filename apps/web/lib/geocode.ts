export async function geocodeAddress(
    address: string,
): Promise<[number, number] | null> {
    const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
    if (!token) return null;

    try {
        const encoded = encodeURIComponent(address);
        const res = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${token}&proximity=-82.9988,39.9612`,
        );
        const data = await res.json();
        const feature = data.features?.[0];
        if (!feature) return null;
        const [lng, lat] = feature.center as [number, number];
        return [lng, lat];
    } catch {
        return null;
    }
}
