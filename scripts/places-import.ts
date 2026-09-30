/**
 * Imports the GeoNames gazetteer (CC BY 4.0) used for birthplace search, coordinates
 * and IANA time zones. Required once for sandbox and live mode. Production builds on
 * Vercel run this automatically when the database has no GeoNames places yet.
 *
 *   npm run places:import                      downloads cities1000 (~150k places, ~10 MB)
 *   npm run places:import -- --dataset cities500   more villages (~200k places)
 *   npm run places:import -- --dir C:\geonames     use files you downloaded yourself
 *
 * Files (from https://download.geonames.org/export/dump/):
 *   <dataset>.zip, admin1CodesASCII.txt, countryInfo.txt
 */
import { fail, option, withDb } from "./lib/cli";
import { GEONAMES_DATASETS, importGeonames, type GeonamesDataset } from "../src/server/places/import";

const dataset = option("dataset") ?? "cities1000";
if (!GEONAMES_DATASETS.includes(dataset as GeonamesDataset)) fail("--dataset must be cities500, cities1000, cities5000 or cities15000");

try {
  await withDb(async (db) => {
    const imported = await importGeonames(db, { dataset: dataset as GeonamesDataset, dir: option("dir") });
    console.log(`\n✓ Imported ${imported.toLocaleString()} places from GeoNames (${dataset}). Attribution: GeoNames, CC BY 4.0.`);
  });
} catch (error) {
  fail((error as Error).message);
}
