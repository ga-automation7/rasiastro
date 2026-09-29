import type { SqlExecutor } from "../db";
import { DEMO_PLACES } from "./demo-places";

export interface Place {
  id: string;
  source: "geonames" | "demo";
  name: string;
  admin1: string | null;
  countryCode: string;
  countryName: string;
  latitude: number;
  longitude: number;
  timezoneId: string;
}

interface PlaceRow {
  id: string;
  source: "geonames" | "demo";
  name: string;
  admin1: string | null;
  country_code: string;
  country_name: string;
  latitude: number;
  longitude: number;
  timezone_id: string;
}

const toPlace = (r: PlaceRow): Place => ({
  id: r.id,
  source: r.source,
  name: r.name,
  admin1: r.admin1,
  countryCode: r.country_code,
  countryName: r.country_name,
  latitude: Number(r.latitude),
  longitude: Number(r.longitude),
  timezoneId: r.timezone_id,
});

/** Lowercase, strip accents and punctuation; keeps Indic letters and combining vowel signs. */
export function normalizePlaceName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function searchPlaces(db: SqlExecutor, query: string, options: { countryCode?: string; limit?: number } = {}): Promise<Place[]> {
  const normalized = normalizePlaceName(query);
  if (normalized.length < 2) return [];
  const limit = Math.min(options.limit ?? 8, 20);
  const rows = await db.query<PlaceRow>(
    `select p.id, p.source, p.name, p.admin1, p.country_code, p.country_name, p.latitude, p.longitude, p.timezone_id
       from places p
       join (
         select place_id, max(case when name_norm = $1 then 1 else 0 end) as exact
           from place_names
          where name_norm like $2 escape '\\'
          group by place_id
       ) m on m.place_id = p.id
      where ($3::text is null or p.country_code = $3::text)
      order by m.exact desc, p.population desc, p.name asc
      limit $4::int`,
    [normalized, `${escapeLike(normalized)}%`, options.countryCode ?? null, limit],
  );
  return rows.map(toPlace);
}

export async function getPlaceById(db: SqlExecutor, id: string): Promise<Place | null> {
  const rows = await db.query<PlaceRow>(
    `select id, source, name, admin1, country_code, country_name, latitude, longitude, timezone_id from places where id = $1`,
    [id],
  );
  return rows[0] ? toPlace(rows[0]) : null;
}

export async function countPlaces(db: SqlExecutor, source: "geonames" | "demo"): Promise<number> {
  const rows = await db.query<{ n: number }>("select count(*)::int as n from places where source = $1", [source]);
  return rows[0]?.n ?? 0;
}

export interface PlaceRecord extends Place {
  asciiName: string;
  admin2: string | null;
  population: number;
  featureCode: string | null;
  alternateNames: string[];
}

export async function upsertPlaces(db: SqlExecutor, places: PlaceRecord[]): Promise<void> {
  if (places.length === 0) return;
  const values: string[] = [];
  const params: (string | number | null)[] = [];
  places.forEach((p, i) => {
    const o = i * 13;
    values.push(
      `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7}, $${o + 8}, $${o + 9}::float8, $${o + 10}::float8, $${o + 11}, $${o + 12}::int, $${o + 13})`,
    );
    params.push(p.id, p.source, p.name, p.asciiName, p.admin1, p.admin2, p.countryCode, p.countryName, p.latitude, p.longitude, p.timezoneId, p.population, p.featureCode);
  });
  await db.query(
    `insert into places (id, source, name, ascii_name, admin1, admin2, country_code, country_name, latitude, longitude, timezone_id, population, feature_code)
     values ${values.join(", ")}
     on conflict (id) do update set name = excluded.name, ascii_name = excluded.ascii_name, admin1 = excluded.admin1,
       admin2 = excluded.admin2, country_code = excluded.country_code, country_name = excluded.country_name,
       latitude = excluded.latitude, longitude = excluded.longitude, timezone_id = excluded.timezone_id,
       population = excluded.population, feature_code = excluded.feature_code`,
    params,
  );

  const names: [string, string][] = [];
  for (const p of places) {
    const all = new Set([p.name, p.asciiName, ...p.alternateNames].map(normalizePlaceName).filter((n) => n.length >= 2));
    for (const n of all) names.push([p.id, n]);
  }
  for (let i = 0; i < names.length; i += 500) {
    const chunk = names.slice(i, i + 500);
    await db.query(
      `insert into place_names (place_id, name_norm) values ${chunk.map((_, j) => `($${j * 2 + 1}, $${j * 2 + 2})`).join(", ")}
       on conflict do nothing`,
      chunk.flat(),
    );
  }
}

export async function seedDemoPlaces(db: SqlExecutor): Promise<void> {
  await upsertPlaces(
    db,
    DEMO_PLACES.map((p) => ({
      id: p.id,
      source: "demo",
      name: p.name,
      asciiName: p.name.normalize("NFKD").replace(/[̀-ͯ]/g, ""),
      admin1: p.admin1,
      admin2: null,
      countryCode: p.countryCode,
      countryName: p.countryName,
      latitude: p.latitude,
      longitude: p.longitude,
      timezoneId: p.timezoneId,
      population: p.population,
      featureCode: "PPL",
      alternateNames: p.alternateNames,
    })),
  );
}
