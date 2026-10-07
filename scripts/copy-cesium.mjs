// Copies CesiumJS runtime assets (workers, textures, widgets) into public/cesium
// so the app runs fully offline, with no Cesium ion token.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "cesium", "Build", "Cesium");
const dest = join(root, "public", "cesium");

if (!existsSync(src)) {
  console.warn("[copy-cesium] cesium not installed yet, skipping");
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
for (const dir of ["Workers", "ThirdParty", "Assets", "Widgets"]) {
  cpSync(join(src, dir), join(dest, dir), { recursive: true });
}
console.log("[copy-cesium] Cesium assets copied to public/cesium");
