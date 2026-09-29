/** Minimal types for subset-font (BSD-3-Clause), used only by scripts/subset-fonts.ts. */
declare module "subset-font" {
  export default function subsetFont(
    font: Buffer | Uint8Array,
    text: string,
    options?: { targetFormat?: "woff2" | "woff" | "truetype" | "sfnt"; preserveNameIds?: number[]; variationAxes?: Record<string, number | { min: number; max: number; default?: number }> },
  ): Promise<Buffer>;
}
