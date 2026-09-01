import { equatorialToAltAz, lstHours, skyMotion, type SkyMotion } from "./astro";
import { FEATURED_IDS, seasonFromRa, type SeasonName } from "./copy";
import type { Constellation, SkyCatalog, SkyMode, Star } from "./types";

type Packed = {
  stars: [number, number, number, number, number][];
  names: Record<string, [string, string, string]>;
  constellations: Constellation[];
};

let cached: SkyCatalog | null = null;

export async function loadSkyCatalog(): Promise<SkyCatalog> {
  if (cached) return cached;
  const res = await fetch("/data/sky.json");
  if (!res.ok) throw new Error(`Sky catalog failed to load (${res.status})`);
  const packed = (await res.json()) as Packed;
  const stars: Star[] = packed.stars.map(([hip, ra, dec, mag, bv]) => {
    const named = packed.names[String(hip)];
    const star: Star = { hip, ra, dec, mag, bv };
    if (named) {
      const [name, con, bayer] = named;
      if (name) star.name = name;
      if (con) star.con = con;
      if (bayer) star.bayer = bayer;
    }
    return star;
  });
  cached = { stars, constellations: packed.constellations };
  return cached;
}

export function constellationStarCount(
  constellation: Constellation,
  stars: Star[],
): number {
  const byHipName = stars.filter((s) => s.con === constellation.id).length;
  if (byHipName > 0) return byHipName;
  const unique = new Set<string>();
  for (const path of constellation.paths) {
    for (const [ra, dec] of path) unique.add(`${ra.toFixed(3)}:${dec.toFixed(3)}`);
  }
  return unique.size;
}

export function namedMembers(stars: Star[], conId: string, limit = 8): Star[] {
  return stars
    .filter((s) => s.con === conId && s.name)
    .sort((a, b) => a.mag - b.mag)
    .slice(0, limit);
}

export function brightNamedStars(stars: Star[], limit = 16): Star[] {
  return stars
    .filter((s) => s.name && s.mag <= 1.65)
    .sort((a, b) => a.mag - b.mag)
    .slice(0, limit);
}

export function searchConstellations(cons: Constellation[], q: string, limit = 16): Constellation[] {
  const n = q.trim().toLowerCase();
  if (!n) return [];
  return cons
    .filter(
      (c) =>
        c.name.toLowerCase().includes(n) ||
        c.id.toLowerCase() === n ||
        c.en.toLowerCase().includes(n) ||
        c.gen.toLowerCase().includes(n),
    )
    .sort((a, b) => Number(a.rank) - Number(b.rank) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function searchStars(stars: Star[], q: string, limit = 16): Star[] {
  const n = q.trim().toLowerCase();
  if (!n) return [];
  const hip = /^\d+$/.test(n) ? Number(n) : null;
  return stars
    .filter((s) => {
      if (hip != null && (s.hip === hip || String(s.hip).startsWith(n))) return true;
      if (s.name?.toLowerCase().includes(n)) return true;
      if (s.bayer?.toLowerCase() === n) return true;
      if (s.con?.toLowerCase() === n && s.name) return true;
      return false;
    })
    .sort((a, b) => a.mag - b.mag)
    .slice(0, limit);
}

export function pickTonight(
  catalog: SkyCatalog,
  opts: { mode: SkyMode; lat: number; lon: number; timeOffsetHours: number },
): Constellation | undefined {
  if (opts.mode !== "outdoor") {
    return catalog.constellations.find((c) => c.id === "Ori") ?? catalog.constellations[0];
  }
  const date = new Date(Date.now() + opts.timeOffsetHours * 3_600_000);
  const lst = lstHours(date, opts.lon);
  return catalog.constellations
    .map((c) => ({ c, alt: equatorialToAltAz(c.ra, c.dec, opts.lat, lst).alt }))
    .filter((x) => x.alt > 14)
    .sort((a, b) => Number(a.c.rank) - Number(b.c.rank) || b.alt - a.alt)[0]?.c;
}

export function upNow(
  catalog: SkyCatalog,
  opts: { lat: number; lon: number; timeOffsetHours: number; limit?: number },
): Constellation[] {
  const date = new Date(Date.now() + opts.timeOffsetHours * 3_600_000);
  const lst = lstHours(date, opts.lon);
  return catalog.constellations
    .map((c) => ({ c, alt: equatorialToAltAz(c.ra, c.dec, opts.lat, lst).alt }))
    .filter((x) => x.alt > 12)
    .sort((a, b) => Number(a.c.rank) - Number(b.c.rank) || b.alt - a.alt)
    .slice(0, opts.limit ?? 10)
    .map((x) => x.c);
}

export type SkyRow = {
  con: Constellation;
  alt: number;
  motion: SkyMotion;
};

export function skyRows(
  catalog: SkyCatalog,
  opts: { lat: number; lon: number; timeOffsetHours: number; limit?: number },
): SkyRow[] {
  const date = new Date(Date.now() + opts.timeOffsetHours * 3_600_000);
  const lst = lstHours(date, opts.lon);
  const later = (lst + 0.75) % 24;
  return catalog.constellations
    .filter((c) => c.rank <= 2)
    .map((c) => {
      const now = equatorialToAltAz(c.ra, c.dec, opts.lat, lst);
      const next = equatorialToAltAz(c.ra, c.dec, opts.lat, later);
      return {
        con: c,
        alt: now.alt,
        motion: skyMotion(now.alt, next.alt - now.alt),
      };
    })
    .sort((a, b) => b.alt - a.alt)
    .slice(0, opts.limit ?? 8);
}

export function featuredIndoor(catalog: SkyCatalog): Constellation[] {
  return FEATURED_IDS.map((id) => catalog.constellations.find((c) => c.id === id)).filter(
    Boolean,
  ) as Constellation[];
}

export function groupBySeason(cons: Constellation[]): { season: SeasonName; items: Constellation[] }[] {
  const buckets: Record<SeasonName, Constellation[]> = {
    Winter: [],
    Spring: [],
    Summer: [],
    Autumn: [],
  };
  for (const c of cons) {
    buckets[seasonFromRa(c.ra)].push(c);
  }
  for (const key of Object.keys(buckets) as SeasonName[]) {
    buckets[key].sort((a, b) => Number(a.rank) - Number(b.rank) || a.name.localeCompare(b.name));
  }
  return (["Winter", "Spring", "Summer", "Autumn"] as SeasonName[])
    .map((season) => ({ season, items: buckets[season] }))
    .filter((g) => g.items.length > 0);
}

export function constellationAlt(
  con: Constellation,
  opts: { lat: number; lon: number; timeOffsetHours: number },
): number {
  const date = new Date(Date.now() + opts.timeOffsetHours * 3_600_000);
  const lst = lstHours(date, opts.lon);
  return equatorialToAltAz(con.ra, con.dec, opts.lat, lst).alt;
}
