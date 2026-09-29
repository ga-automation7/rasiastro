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
// Native-script display faces for editorial accents (website only, single weight).
files.push(
  ["tiro-tamil", "tiro-tamil-tamil-400-normal.woff2"],
  ["tiro-devanagari-hindi", "tiro-devanagari-hindi-devanagari-400-normal.woff2"],
  ["tiro-telugu", "tiro-telugu-telugu-400-normal.woff2"],
  ["tiro-kannada", "tiro-kannada-kannada-400-normal.woff2"],
  ["noto-serif-malayalam", "noto-serif-malayalam-malayalam-600-normal.woff2"],
);
// Variable Fraunces (opsz, wght, SOFT, WONK axes) for expressive Latin display type.
const variableFiles: [pkg: string, file: string][] = [
  ["fraunces", "fraunces-latin-full-normal.woff2"],
  ["fraunces", "fraunces-latin-full-italic.woff2"],
];

for (const [pkg, file] of files) {
  const source = path.join(root, "node_modules", "@fontsource", pkg, "files", file);
  fs.copyFileSync(source, path.join(target, file));
}
for (const [pkg, file] of variableFiles) {
  fs.copyFileSync(path.join(root, "node_modules", "@fontsource-variable", pkg, "files", file), path.join(target, file));
}
fs.copyFileSync(path.join(root, "node_modules", "@fontsource", "noto-sans", "LICENSE"), path.join(target, "OFL-NotoSans.txt"));
fs.copyFileSync(path.join(root, "node_modules", "@fontsource", "fraunces", "LICENSE"), path.join(target, "OFL-Fraunces.txt"));
for (const pkg of ["tiro-tamil", "tiro-devanagari-hindi", "tiro-telugu", "tiro-kannada", "noto-serif-malayalam"]) {
  fs.copyFileSync(path.join(root, "node_modules", "@fontsource", pkg, "LICENSE"), path.join(target, `OFL-${pkg}.txt`));
}
console.log(`Copied ${files.length + variableFiles.length} font files to ${path.relative(root, target)}`);
