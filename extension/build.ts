/**
 * Build the extension into extension/dist/ — load that folder as an unpacked
 * extension, or zip it for the Chrome Web Store.
 *
 *   bun extension/build.ts
 *
 * Two bundles, both IIFE because neither surface can use ES modules: MV3
 * content scripts have no module support, and the popup is a plain page loaded
 * with a classic <script src>. There is no service worker to build — the popup
 * does all the work, so the extension has nothing running in the background.
 */
import { mkdir, rm, cp, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const here = join(root, "extension");
const dist = join(here, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const result = await Bun.build({
  entrypoints: [join(here, "src/content.ts"), join(here, "src/popup.ts")],
  outdir: dist,
  target: "browser",
  format: "iife",
  minify: false,
  sourcemap: "none",
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

await cp(join(here, "manifest.json"), join(dist, "manifest.json"));
await cp(join(here, "src/popup.html"), join(dist, "popup.html"));
await cp(join(here, "src/popup.css"), join(dist, "popup.css"));
await cp(join(here, "icons"), join(dist, "icons"), { recursive: true });

const files = result.outputs.map((o) => o.path.split("/").pop()).join(", ");
await writeFile(
  join(dist, ".gitignore"),
  "# Build output — rebuild with `bun extension/build.ts`\n*\n",
);

console.log(`Built ${files} → extension/dist`);
console.log("Load it: chrome://extensions → Developer mode → Load unpacked → extension/dist");
