import AsyncStorage from "@react-native-async-storage/async-storage";

/* A friendly weather line for the parent's morning screen.
   Location comes from the circle's timezone (e.g. America/Toronto -> Toronto),
   so the parent is never asked for location permission. Uses Open-Meteo,
   which needs no API key. Everything here fails silently: weather is a
   delight, never a dependency. */

const GEO_KEY = "oktoday-geo:";
const WX_KEY = "oktoday-wx:";
const WX_TTL_MS = 45 * 60 * 1000;

export type Weather = { tempC: number; emoji: string; text: string };

type Cached<T> = { at: number; v: T };

function describe(code: number): { emoji: string; text: string } {
  if (code === 0) return { emoji: "☀️", text: "clear" };
  if (code <= 2) return { emoji: "🌤️", text: "mostly sunny" };
  if (code === 3) return { emoji: "☁️", text: "cloudy" };
  if (code <= 48) return { emoji: "🌫️", text: "foggy" };
  if (code <= 57) return { emoji: "🌦️", text: "drizzle" };
  if (code <= 67) return { emoji: "🌧️", text: "rain" };
  if (code <= 77) return { emoji: "🌨️", text: "snow" };
  if (code <= 82) return { emoji: "🌧️", text: "showers" };
  if (code <= 86) return { emoji: "🌨️", text: "snow showers" };
  return { emoji: "⛈️", text: "storms" };
}

/* "America/Toronto" -> "Toronto"; "Europe/Isle_of_Man" -> "Isle of Man" */
function cityFromTimezone(tz: string): string | null {
  const part = tz.split("/").pop();
  return part ? part.replace(/_/g, " ") : null;
}

async function coordsFor(tz: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const hit = await AsyncStorage.getItem(GEO_KEY + tz);
    if (hit) return JSON.parse(hit);
  } catch {
    /* fall through to a lookup */
  }
  const city = cityFromTimezone(tz);
  if (!city) return null;
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        city
      )}&count=1&language=en&format=json`
    );
    if (!res.ok) return null;
    const j = await res.json();
    const r = j?.results?.[0];
    if (!r) return null;
    const coords = { lat: r.latitude as number, lon: r.longitude as number };
    AsyncStorage.setItem(GEO_KEY + tz, JSON.stringify(coords)).catch(() => {});
    return coords;
  } catch {
    return null;
  }
}

export async function getWeather(tz: string | undefined): Promise<Weather | null> {
  if (!tz) return null;
  try {
    const raw = await AsyncStorage.getItem(WX_KEY + tz);
    if (raw) {
      const c: Cached<Weather> = JSON.parse(raw);
      if (Date.now() - c.at < WX_TTL_MS) return c.v;
    }
  } catch {
    /* stale or missing cache — fetch fresh */
  }
  const coords = await coordsFor(tz);
  if (!coords) return null;
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}` +
        `&current=temperature_2m,weather_code&timezone=${encodeURIComponent(tz)}`
    );
    if (!res.ok) return null;
    const j = await res.json();
    const t = j?.current?.temperature_2m;
    const code = j?.current?.weather_code;
    if (typeof t !== "number" || typeof code !== "number") return null;
    const d = describe(code);
    const w: Weather = { tempC: Math.round(t), ...d };
    AsyncStorage.setItem(WX_KEY + tz, JSON.stringify({ at: Date.now(), v: w })).catch(
      () => {}
    );
    return w;
  } catch {
    return null;
  }
}
