import { getDb } from "@/server/db";
import { clientKey, json, withErrors } from "@/server/http";
import { findBirthplaces } from "@/server/places/service";
import { RATE_LIMITS, enforceRateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

/** Birthplace search. Returns candidates the customer must explicitly confirm. */
export const GET = withErrors("places", async (request: Request) => {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 80);
  const country = url.searchParams.get("country");
  await enforceRateLimit(await getDb(), RATE_LIMITS.placeSearch, await clientKey());
  const places = await findBirthplaces(q, country && /^[A-Z]{2}$/.test(country) ? country : undefined);
  return json({
    places: places.map((p) => ({
      id: p.id,
      name: p.name,
      region: p.admin1,
      country: p.countryName,
      countryCode: p.countryCode,
      timezoneId: p.timezoneId,
      latitude: Math.round(p.latitude * 10_000) / 10_000,
      longitude: Math.round(p.longitude * 10_000) / 10_000,
    })),
  });
});
