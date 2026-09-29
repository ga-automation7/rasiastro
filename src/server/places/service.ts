import { getEnv } from "../config/env";
import { getDb, type SqlExecutor } from "../db";
import { countPlaces, searchPlaces, seedDemoPlaces, type Place } from "./repository";

let demoSeeded = false;

async function ensureDemoPlaces(db: SqlExecutor): Promise<void> {
  if (demoSeeded || getEnv().APP_MODE !== "demo") return;
  if ((await countPlaces(db, "demo")) === 0) await seedDemoPlaces(db);
  demoSeeded = true;
}

export async function findBirthplaces(query: string, countryCode?: string): Promise<Place[]> {
  const db = await getDb();
  await ensureDemoPlaces(db);
  const results = await searchPlaces(db, query, { countryCode, limit: 8 });
  // Sandbox and live orders must use the full gazetteer, never the small demo list.
  return getEnv().APP_MODE !== "demo" ? results.filter((p) => p.source === "geonames") : results;
}

/** Sandbox and live need the GeoNames gazetteer; the demo list covers only ~50 places. */
export async function getPlacesAvailability(db: SqlExecutor): Promise<{ ok: boolean; geonames: number; demo: number }> {
  await ensureDemoPlaces(db);
  const [geonames, demo] = await Promise.all([countPlaces(db, "geonames"), countPlaces(db, "demo")]);
  const ok = getEnv().APP_MODE !== "demo" ? geonames >= 1000 : geonames + demo > 0;
  return { ok, geonames, demo };
}
