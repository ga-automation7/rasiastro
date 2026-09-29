import { serve } from "inngest/next";
import { inngest } from "@/server/jobs/inngest-client";
import { inngestFunctions } from "@/server/jobs/functions";

// Report steps (AI calls, PDF rendering) can take minutes; each step is a separate
// invocation, so this bounds a single step, not the whole report.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export const { GET, POST, PUT } = serve({ client: inngest, functions: inngestFunctions });
