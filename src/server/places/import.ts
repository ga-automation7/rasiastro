import fs from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";
import type { Database } from "../db";
import { parseAdmin1Codes, parseCountryInfo, parseGeonamesCityLine } from "./geonames";
import { upsertPlaces, type PlaceRecord } from "./repository";

/**
 * Imports the GeoNames gazetteer (CC BY 4.0) used for birthplace search, coordinates
 * and IANA time zones. Upserts, so running it again refreshes rather than duplicates.
 * Files come from https://download.geonames.org/export/dump/ (or a local folder).
 */
const BASE = "https://download.geonames.org/export/dump/";
export const GEONAMES_DATASETS = ["cities500", "cities1000", "cities5000", "cities15000"] as const;
export type GeonamesDataset = (typeof GEONAMES_DATASETS)[number];

export async function importGeonames(
  db: Database,
  options: { dataset: GeonamesDataset; dir?: string | null; log: (message: string) => void },
): Promise<number> {
  const { log } = options;
  const load = async (file: string): Promise<Uint8Array> => {
    if (options.dir) return new Uint8Array(fs.readFileSync(path.join(options.dir, file)));
    const res = await fetch(`${BASE}${file}`, { headers: { "user-agent": "RasiAstro-places-import/1.0" }, signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`Download failed for ${file}: HTTP ${res.status}`);
    const data = new Uint8Array(await res.arrayBuffer());
    log(`Downloaded ${file} (${Math.round(data.byteLength / 1024)} KB)`);
    return data;
  };

  const decoder = new TextDecoder("utf-8");
  const admin1 = parseAdmin1Codes(decoder.decode(await load("admin1CodesASCII.txt")));
  const countries = parseCountryInfo(decoder.decode(await load("countryInfo.txt")));
  const zip = unzipSync(await load(`${options.dataset}.zip`));
  const content = zip[`${options.dataset}.txt`];
  if (!content) throw new Error(`${options.dataset}.txt not found inside the zip`);
  const lines = decoder.decode(content).split("\n");
  log(`Parsing ${lines.length.toLocaleString()} lines...`);

  let batch: PlaceRecord[] = [];
  let imported = 0;
  for (const line of lines) {
    const place = parseGeonamesCityLine(line, admin1, countries);
    if (!place) continue;
    batch.push(place);
    if (batch.length === 400) {
      const rows = batch;
      await db.transaction((tx) => upsertPlaces(tx, rows));
      imported += batch.length;
      batch = [];
      if (imported % 20_000 === 0) log(`  ${imported.toLocaleString()} places...`);
    }
  }
  if (batch.length) {
    const rows = batch;
    await db.transaction((tx) => upsertPlaces(tx, rows));
    imported += batch.length;
  }
  return imported;
}
