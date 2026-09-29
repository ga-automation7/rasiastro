/**
 * Creates the PRIVATE Supabase Storage bucket for report PDFs (safe to run again).
 *   npm run storage:setup
 */
import { fail } from "./lib/cli";
import { ensureSupabaseBucket } from "../src/server/storage";

try {
  console.log(`✓ ${await ensureSupabaseBucket()}`);
} catch (error) {
  fail((error as Error).message);
}
