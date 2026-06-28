export type GeoResult = { city: string; region: string; country: string };

const SESSION_KEY = "aria:geo";
const DENIED_KEY = "aria:geo-denied";

function sanitize(s: string | undefined): string {
  if (!s) return "";
  return s.trim().replace(/,/g, "").slice(0, 60);
}

async function reverseGeocode(lat: number, lng: number): Promise<GeoResult | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      { signal: controller.signal }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const city = sanitize((data.city as string) || (data.locality as string));
    const region = sanitize(data.principalSubdivision as string);
    const country = sanitize(data.countryName as string);
    if (!country) return null;
    return { city, region, country };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Module-level cache — survives re-renders within the same page load.
let cached: GeoResult | null | undefined;

export async function getSessionLocation(): Promise<GeoResult | null> {
  if (typeof navigator === "undefined" || typeof window === "undefined") return null;

  if (cached !== undefined) return cached;

  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      cached = JSON.parse(stored) as GeoResult;
      return cached;
    }
  } catch { /* ignore */ }

  try {
    if (localStorage.getItem(DENIED_KEY)) {
      cached = null;
      return null;
    }
  } catch { /* ignore */ }

  if (!("geolocation" in navigator)) {
    cached = null;
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const result = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        cached = result;
        if (result) {
          try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(result)); } catch { /* ignore */ }
        }
        resolve(result);
      },
      () => {
        try { localStorage.setItem(DENIED_KEY, "1"); } catch { /* ignore */ }
        cached = null;
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  });
}
