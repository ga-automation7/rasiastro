import { Inngest } from "inngest";

/**
 * Inngest client. Keys come from the environment (INNGEST_EVENT_KEY,
 * INNGEST_SIGNING_KEY); INNGEST_DEV=1 points it at the local dev server.
 */
export const inngest = new Inngest({ id: "rasi-astro" });

export const EVENTS = {
  generate: "rasi/report.generate",
  deliver: "rasi/report.deliver",
} as const;
