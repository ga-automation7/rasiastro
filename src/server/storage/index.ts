import fs from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "../config/env";

/**
 * Private report storage. Files are never public: downloads go through our
 * authorised route, which either streams the file (local) or redirects to a signed
 * URL that expires after a minute (Supabase).
 */
export interface StorageProvider {
  readonly id: "local" | "supabase";
  put(key: string, data: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  signedDownloadUrl(key: string, filename: string, expiresInSeconds: number): Promise<string | null>;
  remove(keys: string[]): Promise<void>;
}

class LocalStorage implements StorageProvider {
  readonly id = "local" as const;
  private readonly root: string;
  constructor(root: string) {
    this.root = path.resolve(root);
  }
  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return full;
  }
  async put(key: string, data: Uint8Array): Promise<void> {
    const file = this.resolve(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
  }
  async get(key: string): Promise<Uint8Array | null> {
    try {
      return new Uint8Array(await fs.readFile(this.resolve(key)));
    } catch {
      return null;
    }
  }
  async signedDownloadUrl(): Promise<string | null> {
    return null; // Local files are streamed by the download route instead.
  }
  async remove(keys: string[]): Promise<void> {
    await Promise.all(keys.map((k) => fs.rm(this.resolve(k), { force: true })));
  }
}

class SupabaseStorage implements StorageProvider {
  readonly id = "supabase" as const;
  private readonly client: SupabaseClient;
  private readonly bucket: string;
  constructor(url: string, serviceKey: string, bucket: string) {
    this.client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    this.bucket = bucket;
  }
  async put(key: string, data: Uint8Array, contentType: string): Promise<void> {
    const { error } = await this.client.storage.from(this.bucket).upload(key, data, { contentType, upsert: true, cacheControl: "0" });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
  }
  async get(key: string): Promise<Uint8Array | null> {
    const { data, error } = await this.client.storage.from(this.bucket).download(key);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  }
  async signedDownloadUrl(key: string, filename: string, expiresInSeconds: number): Promise<string | null> {
    const { data, error } = await this.client.storage.from(this.bucket).createSignedUrl(key, expiresInSeconds, { download: filename });
    if (error || !data) throw new Error(`Could not sign download URL: ${error?.message ?? "unknown"}`);
    return data.signedUrl;
  }
  async remove(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    const { error } = await this.client.storage.from(this.bucket).remove(keys);
    if (error) throw new Error(`Storage delete failed: ${error.message}`);
  }
}

let override: StorageProvider | null = null;
export function setStorageForTests(storage: StorageProvider | null): void {
  override = storage;
}

export function getStorage(): StorageProvider {
  if (override) return override;
  const env = getEnv();
  if (env.STORAGE_PROVIDER === "supabase") {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase storage is not configured");
    return new SupabaseStorage(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, env.SUPABASE_REPORTS_BUCKET);
  }
  return new LocalStorage(env.LOCAL_STORAGE_DIR);
}

/** Creates the private reports bucket if missing (npm run storage:setup). */
export async function ensureSupabaseBucket(): Promise<string> {
  const env = getEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first");
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data } = await client.storage.getBucket(env.SUPABASE_REPORTS_BUCKET);
  if (data) {
    if (data.public) throw new Error(`Bucket "${env.SUPABASE_REPORTS_BUCKET}" is PUBLIC. Make it private in the Supabase dashboard.`);
    return `Bucket "${env.SUPABASE_REPORTS_BUCKET}" already exists and is private.`;
  }
  const { error } = await client.storage.createBucket(env.SUPABASE_REPORTS_BUCKET, { public: false, fileSizeLimit: "20MB", allowedMimeTypes: ["application/pdf"] });
  if (error) throw new Error(`Could not create bucket: ${error.message}`);
  return `Created private bucket "${env.SUPABASE_REPORTS_BUCKET}".`;
}
