import { app, dialog } from "electron";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { startDesktopApp } from "./desktop-app.js";
import { resolveRuntimeConfig } from "./runtime-config.js";
import { translator } from "./strings.js";

// A shipped app carries its settings in its own package.json, written by
// scripts/build.js. Development reads JAWA_* variables instead.
function bundledSettings() {
  if (!app.isPackaged) return null;
  return JSON.parse(readFileSync(join(app.getAppPath(), "package.json"), "utf8")).jawa ?? null;
}

let config;
try {
  config = resolveRuntimeConfig({ isPackaged: app.isPackaged, env: process.env, bundled: bundledSettings() });
} catch (error) {
  if (!app.isPackaged) {
    console.error(`JAWA desktop app: ${error.message}`);
    app.exit(1);
  } else {
    const t = translator("en");
    app.whenReady().then(() => {
      dialog.showErrorBox(t("startup.title"), t("startup.body"));
      app.exit(1);
    });
  }
}

if (config) startDesktopApp(config);
