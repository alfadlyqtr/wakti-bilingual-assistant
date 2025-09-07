// Lightweight client for fetching per-country city lists on demand.
// We only load the selected country's cities and cache them in-memory.

export type CityList = string[];

const cacheKey = "__wakti_city_code_map__";

function getCache(): Map<string, CityList> {
  let codeMap: Map<string, CityList> = (globalThis as any)[cacheKey];
  if (!codeMap) {
    codeMap = new Map<string, CityList>();
    (globalThis as any)[cacheKey] = codeMap;
  }
  return codeMap;
}

export async function fetchCitiesByCountryCode(code?: string | null): Promise<CityList> {
  if (!code) return [];
  const codeUpper = code.toUpperCase();
  const cache = getCache();
  const cached = cache.get(codeUpper);
  if (cached) return cached;

  try {
    const res = await fetch(`/cities/${codeUpper}.json`, { cache: "force-cache" });
    if (!res.ok) {
      // 404 is fine – it just means we don't have a file for this country
      cache.set(codeUpper, []);
      return [];
    }
    const data: CityList = await res.json();
    const list = Array.isArray(data) ? data : [];
    cache.set(codeUpper, list);
    return list;
  } catch (e) {
    // Network or parsing issue – fail gracefully
    cache.set(codeUpper, []);
    return [];
  }
}

export function filterCities(query: string, cities: CityList, limit = 50): CityList {
  const q = (query || "").toLowerCase().trim();
  if (q.length < 2) return [];
  const out: string[] = [];
  for (const c of cities) {
    if ((c || "").toLowerCase().startsWith(q)) {
      out.push(c);
      if (out.length >= limit) break;
    }
  }
  return out;
}
