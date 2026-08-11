// Copies pdfjs-dist's worker + standard_fonts + cmaps into /public as plain
// static files/folders, served at /pdf.worker.min.mjs, /pdf-standard-fonts/,
// /pdf-cmaps/. Sidesteps Turbopack asset-resolution friction with pdf.js's
// worker (a known source of bundling issues) by never asking the bundler to
// resolve any of this at all - lib/pdf-extract-client.js points
// GlobalWorkerOptions.workerSrc/standardFontDataUrl/cMapUrl straight at these
// public URLs. standard_fonts/cmaps matter for real-world documents that
// don't embed font metrics or use non-Latin encodings (relevant since this
// app supports zh/ms/ta) - confirmed via a real extraction test that
// omitting standardFontDataUrl produces a real warning, not just theoretical.
// Re-run whenever pdfjs-dist is upgraded (wired into package.json's
// postinstall so a fresh `pnpm install` always has matching versions).
import { copyFileSync, cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const pdfjsRoot = join(projectRoot, "node_modules/pdfjs-dist");
const destDir = join(projectRoot, "public");

if (!existsSync(pdfjsRoot)) {
  console.error(`copy-pdf-worker: pdfjs-dist not found at ${pdfjsRoot} - is it installed?`);
  process.exit(1);
}
if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });

copyFileSync(join(pdfjsRoot, "build/pdf.worker.min.mjs"), join(destDir, "pdf.worker.min.mjs"));
cpSync(join(pdfjsRoot, "standard_fonts"), join(destDir, "pdf-standard-fonts"), { recursive: true });
cpSync(join(pdfjsRoot, "cmaps"), join(destDir, "pdf-cmaps"), { recursive: true });

console.log("copy-pdf-worker: copied worker, standard_fonts, and cmaps into /public");
