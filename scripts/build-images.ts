/**
 * Builds the web versions of the homepage artwork from the originals in assets-src/.
 *
 *   npm run images:build
 *
 * - Originals stay untouched in assets-src/ (descriptive names, full quality).
 * - Derivatives go to public/art/ as high-quality WebP "masters"; Next.js image
 *   optimisation then serves each visitor a right-sized AVIF/WebP.
 * - Art-directed crops (the phone layouts) are cut here, not with CSS, so phones do
 *   not download pixels they never show.
 * - Sizes and a tiny blurred placeholder are written to src/config/art-manifest.json,
 *   which src/config/art.ts reads. Re-run after replacing an original.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SRC = "assets-src";
const OUT = path.join("public", "art");

interface Job {
  key: string;
  source: string;
  output: string;
  crop?: { left: number; top: number; width: number; height: number };
  width?: number;
  quality: number;
}

const JOBS: Job[] = [
  { key: "heroDesktop", source: "hero-elephant-original.png", output: "hero-elephant.webp", quality: 88 },
  // Phones: the elephant side of the painting, with a sliver of parchment on the left to blend into the page.
  { key: "heroMobile", source: "hero-elephant-original.png", output: "hero-elephant-mobile.webp", crop: { left: 600, top: 40, width: 1072, height: 901 }, quality: 86 },
  { key: "compatibility", source: "compatibility-sun-moon-original.png", output: "compatibility-sun-moon.webp", quality: 86 },
];

/** Social preview (Open Graph) image: 1200x630 JPEG, which every link-preview service accepts. */
async function socialPreview(): Promise<void> {
  const out = path.join(OUT, "og-rasi-astro.jpg");
  await sharp(path.join(SRC, "hero-elephant-original.png"))
    .resize({ width: 1200, height: 630, fit: "cover", position: "centre" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(out);
  console.log(`og-rasi-astro.jpg: 1200x630, ${Math.round(fs.statSync(out).size / 1024)} KB`);
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  const manifest: Record<string, { src: string; width: number; height: number; blurDataURL: string; bytes: number }> = {};
  for (const job of JOBS) {
    const input = path.join(SRC, job.source);
    if (!fs.existsSync(input)) throw new Error(`Missing original: ${input}`);
    let image = sharp(input);
    if (job.crop) image = image.extract(job.crop);
    if (job.width) image = image.resize({ width: job.width });
    const outPath = path.join(OUT, job.output);
    const info = await image.webp({ quality: job.quality, effort: 6 }).toFile(outPath);
    let tiny = sharp(input);
    if (job.crop) tiny = tiny.extract(job.crop);
    const blur = await tiny.resize({ width: 16 }).webp({ quality: 40 }).toBuffer();
    manifest[job.key] = {
      src: `/art/${job.output}`,
      width: info.width,
      height: info.height,
      blurDataURL: `data:image/webp;base64,${blur.toString("base64")}`,
      bytes: info.size,
    };
    console.log(`${job.output}: ${info.width}x${info.height}, ${Math.round(info.size / 1024)} KB`);
  }
  await socialPreview();
  fs.writeFileSync(path.join("src", "config", "art-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log("Wrote src/config/art-manifest.json");
}

await main();
