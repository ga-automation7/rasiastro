import type { PlaceRecord } from "./repository";

/**
 * Parser for the GeoNames "cities" dumps (https://download.geonames.org/export/dump/,
 * licence CC BY 4.0). Each line is tab-separated with 19 columns; the timezone column
 * gives the IANA zone used for historical offsets.
 */
const INDIC_OR_LATIN = /^[A-Za-zÀ-ɏऀ-ॿ஀-௿ఀ-౿ಀ-೿ഀ-ൿ .'()-]+$/;

export function parseAdmin1Codes(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of text.split("\n")) {
    const [code, name] = line.split("\t");
    if (code && name) map.set(code, name);
  }
  return map;
}

export function parseCountryInfo(text: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const cols = line.split("\t");
    if (cols[0] && cols[4]) map.set(cols[0], cols[4]);
  }
  return map;
}

export function parseGeonamesCityLine(line: string, admin1: Map<string, string>, countries: Map<string, string>): PlaceRecord | null {
  const c = line.split("\t");
  if (c.length < 19) return null;
  const [id, name, ascii, alternates, lat, lon, featureClass, featureCode, country, , admin1Code, admin2Code] = c;
  const population = Number(c[14]) || 0;
  const timezone = c[17];
  if (!id || !name || !country || !timezone || featureClass !== "P") return null;
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const alternateNames = (alternates ?? "")
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n.length >= 2 && n.length <= 60 && INDIC_OR_LATIN.test(n))
    .slice(0, 12);
  return {
    id: `gn:${id}`,
    source: "geonames",
    name,
    asciiName: ascii || name,
    admin1: admin1.get(`${country}.${admin1Code}`) ?? null,
    admin2: admin2Code || null,
    countryCode: country,
    countryName: countries.get(country) ?? country,
    latitude,
    longitude,
    timezoneId: timezone,
    population,
    featureCode: featureCode ?? null,
    alternateNames,
  };
}
