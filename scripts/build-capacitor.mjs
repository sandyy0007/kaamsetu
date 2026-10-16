import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const rootDir = process.cwd();
const apiDir = path.join(rootDir, "src", "app", "api");
const tempApiDir = path.join(rootDir, "src", "app_api_export_tmp");
const outDir = path.join(rootDir, "out");

console.log("[build-capacitor] Starting Capacitor Android web asset build...");

let movedApi = false;

try {
  // If src/app/api exists, temporarily move it out so Next.js static export succeeds
  if (fs.existsSync(apiDir)) {
    console.log("[build-capacitor] Temporarily stashing src/app/api -> src/app_api_export_tmp for static export...");
    fs.renameSync(apiDir, tempApiDir);
    movedApi = true;
  }

  // Clean existing out directory
  if (fs.existsSync(outDir)) {
    console.log("[build-capacitor] Cleaning existing out/ directory...");
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  // Run Next.js build with NEXT_EXPORT=true
  console.log("[build-capacitor] Running Next.js static export build (NEXT_EXPORT=true)...");
  execSync("npx next build", {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_EXPORT: "true",
      NODE_ENV: "production",
    },
  });

  // Verify out directory
  if (!fs.existsSync(outDir)) {
    throw new Error("Export failed: out/ directory was not generated.");
  }

  // Ensure public/app-config.js is in out/
  const srcConfig = path.join(rootDir, "public", "app-config.js");
  const dstConfig = path.join(outDir, "app-config.js");
  if (fs.existsSync(srcConfig)) {
    fs.copyFileSync(srcConfig, dstConfig);
    console.log("[build-capacitor] Copied public/app-config.js -> out/app-config.js");
  }

  // Ensure route indices and dynamic fallbacks exist for Capacitor Android asset loader
  function ensureRouteIndices(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const indexHtml = path.join(fullPath, "index.html");
        const indexTxt = path.join(fullPath, "index.txt");

        // 1. Sibling HTML: if out/foo/ is a directory and out/foo.html exists, copy to out/foo/index.html
        const siblingHtml = path.join(dir, `${entry.name}.html`);
        if (fs.existsSync(siblingHtml) && !fs.existsSync(indexHtml)) {
          fs.copyFileSync(siblingHtml, indexHtml);
          console.log(`[build-capacitor] Created ${path.relative(outDir, indexHtml)} from sibling ${entry.name}.html`);
        }

        // Sibling TXT (Next.js flight data): if out/foo.txt exists, copy to out/foo/index.txt
        const siblingTxt = path.join(dir, `${entry.name}.txt`);
        if (fs.existsSync(siblingTxt) && !fs.existsSync(indexTxt)) {
          fs.copyFileSync(siblingTxt, indexTxt);
          console.log(`[build-capacitor] Created ${path.relative(outDir, indexTxt)} from sibling ${entry.name}.txt`);
        }

        // 2. Dynamic route fallbacks: _default.html -> index.html
        const defaultHtml = path.join(fullPath, "_default.html");
        if (fs.existsSync(defaultHtml) && !fs.existsSync(indexHtml)) {
          fs.copyFileSync(defaultHtml, indexHtml);
          console.log(`[build-capacitor] Created fallback index.html for ${path.relative(outDir, fullPath)}`);
        }

        const defaultTxt = path.join(fullPath, "_default.txt");
        if (fs.existsSync(defaultTxt) && !fs.existsSync(indexTxt)) {
          fs.copyFileSync(defaultTxt, indexTxt);
          console.log(`[build-capacitor] Created fallback index.txt for ${path.relative(outDir, fullPath)}`);
        }

        ensureRouteIndices(fullPath);
      }
    }
  }
  ensureRouteIndices(outDir);

  console.log("[build-capacitor] Static bundle generated successfully in out/.");

  // Sync to Capacitor Android
  console.log("[build-capacitor] Running 'npx cap sync android'...");
  execSync("npx cap sync android", {
    stdio: "inherit",
  });

  console.log("[build-capacitor] Capacitor Android synchronization completed successfully!");
} finally {
  // Always restore src/app/api
  if (movedApi && fs.existsSync(tempApiDir)) {
    console.log("[build-capacitor] Restoring src/app_api_export_tmp -> src/app/api...");
    fs.renameSync(tempApiDir, apiDir);
    console.log("[build-capacitor] API routes restored successfully.");
  }
}

