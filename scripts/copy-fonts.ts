/**
 * Copies the font files used by the website AND the PDF renderer from the
 * @fontsource npm packages into src/assets/fonts (committed to the repository), so
 * both render with identical, self-hosted fonts and the PDF never depends on fonts
 * installed on the server. All fonts are licensed under the SIL Open Font License.
 *
 * Usage: npm run fonts:copy
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const target = path.join(root, "src", "assets", "fonts");
fs.mkdirSync(target, { recursive: true });

const files: [pkg: string, file: string][] = [
  ["noto-sans", "noto-sans-latin-400-normal.woff2"],
  ["noto-sans", "noto-sans-latin-600-normal.woff2"],
  ["noto-sans", "noto-sans-latin-700-normal.woff2"],
  ["noto-sans", "noto-sans-latin-ext-400-normal.woff2"],
  ["noto-sans", "noto-sans-latin-ext-700-normal.woff2"],
  ["fraunces", "fraunces-latin-500-normal.woff2"],
  ["fraunces", "fraunces-latin-600-normal.woff2"],
];
for (const script of ["tamil", "devanagari", "telugu", "kannada", "malayalam"]) {
  for (const weight of [400, 600, 700]) files.push([`noto-sans-${script}`, `noto-sans-${script}-${script}-${weight}-normal.woff2`]);
}

for (const [pkg, file] of files) {
  const source = path.join(root, "node_modules", "@fontsource", pkg, "files", file);
  fs.copyFileSync(source, path.join(target, file));
}
fs.copyFileSync(path.join(root, "node_modules", "@fontsource", "noto-sans", "LICENSE"), path.join(target, "OFL-NotoSans.txt"));
fs.copyFileSync(path.join(root, "node_modules", "@fontsource", "fraunces", "LICENSE"), path.join(target, "OFL-Fraunces.txt"));
console.log(`Copied ${files.length} font files to ${path.relative(root, target)}`);
