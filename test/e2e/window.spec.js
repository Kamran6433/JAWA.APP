import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { startFakeSite } from "../support/fake-site.js";
import { freshProfile, launchApp } from "../support/launch.js";

// The running app reports package.json's version, so these checks follow each release.
const { version } = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const identifiesAs = (kind) => new RegExp(` JAWADesktop/${version.replaceAll(".", "\\.")} \\(${kind}\\)$`);

let site;
test.beforeEach(async () => { site = await startFakeSite({ title: "Fake MENU" }); });
test.afterEach(async () => { await site.stop(); });

test("opens the app's own home page in one window", async () => {
  const { app, window } = await launchApp({ kind: "menu", origins: { menu: site.origin } });
  await expect(window.locator("#where")).toHaveText("Fake MENU");
  expect(window.url()).toBe(`${site.origin}/`);
  expect(app.windows()).toHaveLength(1);
  expect(await app.evaluate(({ app: electronApp }) => electronApp.getName())).toBe("JAWA MENU");
  await app.close();
});

test("FOOD opens at its own home page under its own name", async () => {
  const { app, window } = await launchApp({ kind: "food", origins: { food: site.origin } });
  await expect(window).toHaveURL(`${site.origin}/`);
  expect(await app.evaluate(({ app: electronApp }) => electronApp.getName())).toBe("JAWA.FOOD");
  expect(await app.evaluate(({ BrowserWindow, session }) => BrowserWindow.getAllWindows()[0].webContents.session === session.fromPartition("persist:jawa-food"))).toBe(true);
  await app.close();
});

test("pages run sandboxed with no access to Node or Electron", async () => {
  const { app, window } = await launchApp({ kind: "menu", origins: { menu: site.origin } });
  await expect(window.locator("#where")).toHaveText("Fake MENU");
  const preferences = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
  expect(preferences).toMatchObject({
    contextIsolation: true, sandbox: true, nodeIntegration: false, nodeIntegrationInSubFrames: false,
    nodeIntegrationInWorker: false, webviewTag: false, webSecurity: true, allowRunningInsecureContent: false,
    experimentalFeatures: false,
  });
  expect(preferences.preload ?? null).toBeNull();
  expect(await app.evaluate(({ BrowserWindow, session }) => BrowserWindow.getAllWindows()[0].webContents.session === session.fromPartition("persist:jawa-menu"))).toBe(true);
  expect(await window.evaluate(() => [ typeof require, typeof process, typeof module, typeof window.electron ])).toEqual([ "undefined", "undefined", "undefined", "undefined" ]);
  await app.close();
});

test("tells the server which JAWA desktop app is asking", async () => {
  const { app, window } = await launchApp({ kind: "menu", origins: { menu: site.origin } });
  await window.goto(`${site.origin}/headers`);
  const agent = await window.locator("#agent").textContent();
  expect(agent).toMatch(/ Chrome\/[\d.]+ Electron\/[\d.]+ Safari\/537\.36 JAWADesktop\//);
  expect(agent).toMatch(identifiesAs("menu"));
  expect(agent).not.toMatch(/JAWA MENU\/|jawa-apps\//);
  await app.close();
});

test("the app still identifies itself after a form post and its redirect", async () => {
  const { app, window } = await launchApp({ kind: "menu", origins: { menu: site.origin } });
  await window.goto(`${site.origin}/post-then-redirect`);
  await window.click("#send");
  await expect(window.locator("#where")).toHaveText("Headers");
  const [ post, redirected ] = site.requests.filter((request) => [ "/echo-redirect", "/headers" ].includes(request.path));
  expect(post.method).toBe("POST");
  for (const request of [ post, redirected ]) expect(request.headers["user-agent"]).toMatch(identifiesAs("menu"));
  await app.close();
});

test("pages loaded through the site's service worker still identify the app", async () => {
  const { app, window } = await launchApp({ kind: "menu", origins: { menu: site.origin } });
  await window.goto(`${site.origin}/with-worker`);
  await expect.poll(() => window.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await window.click("#through-worker");
  await expect(window.locator("#where")).toHaveText("Headers");
  const throughWorker = site.requests.filter((request) => request.path === "/headers").at(-1);
  expect(throughWorker.headers["service-worker"] ?? null).toBeNull();
  expect(throughWorker.headers["user-agent"]).toMatch(identifiesAs("menu"));
  expect(await window.evaluate(() => navigator.userAgent)).toMatch(identifiesAs("menu"));
  await app.close();
});

test("the menu offers browser-style history and, while developing, developer tools", async () => {
  const { app } = await launchApp({ kind: "menu", origins: { menu: site.origin } });
  const menu = await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.map((item) => ({
    label: item.label, items: item.submenu?.items.map((entry) => entry.role || entry.label) ?? [],
  })));
  const history = menu.find((item) => item.label === "History");
  expect(history.items).toEqual([ "Back", "Forward", "Home" ]);
  expect(menu.find((item) => item.label === "View").items).toContain("toggledevtools");
  await app.close();
});

test("History > Home and Back move the window as a browser would", async () => {
  const { app, window } = await launchApp({ kind: "menu", origins: { menu: site.origin } });
  await window.click("#own");
  await expect(window.locator("#where")).toHaveText("Second page");
  await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById("back").click());
  await expect(window.locator("#where")).toHaveText("Fake MENU");
  await window.click("#own");
  await expect(window.locator("#where")).toHaveText("Second page");
  await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById("home").click());
  await expect(window).toHaveURL(`${site.origin}/`);
  await app.close();
});

test("the window reopens where it was left", async () => {
  const profile = freshProfile();
  const first = await launchApp({ kind: "menu", origins: { menu: site.origin }, profile });
  await expect(first.window.locator("#where")).toHaveText("Fake MENU");
  await first.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ x: 40, y: 60, width: 900, height: 640 }));
  await first.app.close();

  const second = await launchApp({ kind: "menu", origins: { menu: site.origin }, profile });
  await expect(second.window.locator("#where")).toHaveText("Fake MENU");
  const bounds = await second.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
  expect(bounds).toMatchObject({ width: 900, height: 640 });
  await second.app.close();
});

test("each app keeps its own cookies", async () => {
  const profile = freshProfile();
  const menu = await launchApp({ kind: "menu", origins: { menu: site.origin }, profile });
  await menu.window.goto(`${site.origin}/set-binding`);
  const menuCookies = await menu.app.evaluate(({ session }) => session.fromPartition("persist:jawa-menu").cookies.get({}));
  const foodCookies = await menu.app.evaluate(({ session }) => session.fromPartition("persist:jawa-food").cookies.get({}));
  expect(menuCookies.map((cookie) => cookie.name)).toContain("desktop_binding");
  expect(foodCookies).toEqual([]);
  await menu.app.close();
});
