import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/server/db";
import { parseAdmin1Codes, parseCountryInfo, parseGeonamesCityLine } from "@/server/places/geonames";
import { searchPlaces, upsertPlaces } from "@/server/places/repository";
import { setTestEnv, setupTestDb } from "./helpers";

// Lines in the exact GeoNames cities*.txt format (19 tab-separated columns).
const MADURAI =
  "1264521\tMadurai\tMadurai\tMadura,Madurai,Maturai,मदुरै,மதுரை,Мадурай\t9.91735\t78.11962\tP\tPPLA2\tIN\t\t25\t618\t\t\t1561129\t\t139\tAsia/Kolkata\t2024-01-01";
const VILLAGE =
  "9999999\tKodaikanal\tKodaikanal\t=HACK,Kodai\t10.23925\t77.48932\tP\tPPL\tIN\t\t25\t\t\t\t36501\t\t2133\tAsia/Kolkata\t2024-01-01";
const NOT_A_PLACE = "1\tSome Mountain\tSome Mountain\t\t10\t77\tT\tMT\tIN\t\t25\t\t\t\t0\t\t\tAsia/Kolkata\t2024-01-01";

describe("GeoNames import", () => {
  const admin1 = parseAdmin1Codes("IN.25\tTamil Nadu\tTamil Nadu\t1255053\n");
  const countries = parseCountryInfo("#ISO\tISO3\tISO-Numeric\tfips\tCountry\n IN\tIND\t356\tIN\tIndia\tNew Delhi\n".replace(" IN", "IN"));

  beforeAll(async () => {
    setTestEnv();
    await setupTestDb();
  });

  it("parses places with state, country, coordinates and time zone", () => {
    const p = parseGeonamesCityLine(MADURAI, admin1, countries)!;
    expect(p).toMatchObject({ id: "gn:1264521", name: "Madurai", admin1: "Tamil Nadu", countryName: "India", timezoneId: "Asia/Kolkata", population: 1561129 });
    expect(p.alternateNames).toContain("மதுரை");
    expect(p.alternateNames).toContain("मदुरै");
    expect(p.alternateNames).not.toContain("Мадурай"); // other scripts are skipped
    expect(parseGeonamesCityLine(NOT_A_PLACE, admin1, countries)).toBeNull();
    expect(parseGeonamesCityLine("garbage", admin1, countries)).toBeNull();
    expect(parseGeonamesCityLine(VILLAGE, admin1, countries)!.alternateNames).toEqual(["Kodai"]);
  });

  it("imports into the database and is searchable by native-script names", async () => {
    const db = await getDb();
    await db.transaction((tx) => upsertPlaces(tx, [parseGeonamesCityLine(MADURAI, admin1, countries)!, parseGeonamesCityLine(VILLAGE, admin1, countries)!]));
    expect((await searchPlaces(db, "மதுரை")).map((p) => p.id)).toContain("gn:1264521");
    expect((await searchPlaces(db, "kodai"))[0]!.id).toBe("gn:9999999");
    // Re-importing is idempotent.
    await db.transaction((tx) => upsertPlaces(tx, [parseGeonamesCityLine(MADURAI, admin1, countries)!]));
    expect((await db.query<{ n: number }>("select count(*)::int as n from places where id = 'gn:1264521'"))[0]!.n).toBe(1);
  });
});
