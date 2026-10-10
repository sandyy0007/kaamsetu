import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const url = (process.argv[2] || process.env.CAPACITOR_SERVER_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");

if (!url) {
  console.log("Usage: node scripts/configure-app-url.mjs <https://your-app.onrender.com>");
  console.log("Or set NEXT_PUBLIC_APP_URL / CAPACITOR_SERVER_URL in environment.");
  process.exit(0);
}

const configContent = `// KaamSetu Client Runtime Configuration
// Auto-generated via scripts/configure-app-url.mjs
window.KAAMSETU_CONFIG = {
  serverUrl: ${JSON.stringify(url)},
};
`;

const publicConfig = path.resolve("public", "app-config.js");
fs.writeFileSync(publicConfig, configContent, "utf8");
console.log(`[configure-app-url] Updated ${publicConfig} with: ${url}`);

const androidAssetConfig = path.resolve("android", "app", "src", "main", "assets", "public", "app-config.js");
if (fs.existsSync(path.dirname(androidAssetConfig))) {
  fs.writeFileSync(androidAssetConfig, configContent, "utf8");
  console.log(`[configure-app-url] Synchronized ${androidAssetConfig}`);
}

try {
  execSync("npx cap copy android", { stdio: "inherit" });
  console.log("[configure-app-url] Capacitor android assets copied successfully.");
} catch {
  console.log("[configure-app-url] Note: npx cap copy skipped or failed (check android project).");
}

