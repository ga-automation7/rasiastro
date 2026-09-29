/**
 * Imports the GeoNames gazetteer (CC BY 4.0) used for birthplace search, coordinates
 * and IANA time zones. Required once for live mode.
 *
 *   npm run places:import                      downloads cities1000 (~150k places, ~10 MB)
 *   npm run places:import -- --dataset cities500   more villages (~200k places)
 *   npm run places:import -- --dir C:\geonames     use files you downloaded yourself
 *
 * Files (from https://download.geonames.org/export/dump/):
 *   <dataset>.zip, admin1CodesASCII.txt, countryInfo.txt
 */
import fs from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";
import { fail, option, withDb } from "./lib/cli";
import { parseAdmin1Codes, parseCountryInfo, parseGeonamesCityLine } from "../src/server/places/geonames";
import { upsertPlaces, type PlaceRecord } from "../src/server/places/repository";

const BASE = "https://download.geonames.org/export/dump/";
const dataset = option("dataset") ?? "cities1000";
if (!/^cities(500|1000|5000|15000)$/.test(dataset)) fail("--dataset must be cities500, cities1000, cities5000 or cities15000");
const dir = option("dir");

async function load(file: string): Promise<Uint8Array> {
  if (dir) return new Uint8Array(fs.readFileSync(path.join(dir, file)));
  process.stdout.write(`Downloading ${file}... `);
  const res = await fetch(`${BASE}${file}`, { headers: { "user-agent": "RasiAstro-places-import/1.0" } });
  if (!res.ok) throw new Error(`Download failed for ${file}: HTTP ${res.status}`);
  const data = new Uint8Array(await res.arrayBuffer());
  console.log(`${Math.round(data.byteLength / 1024)} KB`);
  return data;
}

try {
  const decoder = new TextDecoder("utf-8");
  const admin1 = parseAdmin1Codes(decoder.decode(await load("admin1CodesASCII.txt")));
  const countries = parseCountryInfo(decoder.decode(await load("countryInfo.txt")));
  const zip = unzipSync(await load(`${dataset}.zip`));
  const text = decoder.decode(zip[`${dataset}.txt`] ?? fail(`${dataset}.txt not found inside the zip`));
  const lines = text.split("\n");
  console.log(`Parsing ${lines.length.toLocaleString()} lines...`);

  await withDb(async (db) => {
    let batch: PlaceRecord[] = [];
    let imported = 0;
    for (const line of lines) {
      const place = parseGeonamesCityLine(line, admin1, countries);
      if (!place) continue;
      batch.push(place);
      if (batch.length === 400) {
        await db.transaction((tx) => upsertPlaces(tx, batch));
        imported += batch.length;
        batch = [];
        if (imported % 20_000 === 0) console.log(`  ${imported.toLocaleString()} places...`);
      }
    }
    if (batch.length) {
      await db.transaction((tx) => upsertPlaces(tx, batch));
      imported += batch.length;
    }
    console.log(`\n✓ Imported ${imported.toLocaleString()} places from GeoNames (${dataset}). Attribution: GeoNames, CC BY 4.0.`);
  });
} catch (error) {
  fail((error as Error).message);
}
