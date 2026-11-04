import { _electron as electron } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const APP_ROOT = fileURLToPath(new URL("../../", import.meta.url));

export function freshProfile() {
  return mkdtempSync(join(tmpdir(), "jawa-apps-test-"));
}

// Launches the real, unpackaged app. Only "open in the browser" is replaced,
// so tests record where links would go instead of opening Chrome.
export async function launchApp({ kind = "pos", origins = {}, profile = freshProfile(), args = [] }) {
  const env = { ...process.env, JAWA_APP: kind, JAWA_USER_DATA_DIR: profile, JAWA_SHOW_WINDOWS: "0" };
  delete env.JAWA_REGISTER_PROTOCOL;
  for (const [ name, origin ] of Object.entries(origins)) env[`JAWA_${name.toUpperCase()}_ORIGIN`] = origin;

  const app = await electron.launch({ args: [ APP_ROOT, ...args ], env });
  await app.evaluate(({ shell }) => {
    globalThis.openedInBrowser = [];
    shell.openExternal = async (url) => { globalThis.openedInBrowser.push(url); };
  });
  const window = await app.firstWindow();
  return { app, window, profile, openedInBrowser: () => app.evaluate(() => globalThis.openedInBrowser) };
}

// Playwright's locators can wait on a navigation the app cancelled, so after
// one, read what the page actually shows straight from the page.
export function heading(window) {
  return window.evaluate(() => document.querySelector("#where")?.textContent ?? null);
}
