import { expect, test } from "@playwright/test";
import { startFakeSite } from "../support/fake-site.js";
import { freshProfile, launchApp } from "../support/launch.js";

let site;
test.beforeEach(async () => { site = await startFakeSite({ title: "Fake POS" }); });
test.afterEach(async () => { await site.stop(); });

test("opens the app's own home page in one window", async () => {
  const { app, window } = await launchApp({ kind: "pos", origins: { pos: site.origin } });
  await expect(window.locator("#where")).toHaveText("Fake POS");
  expect(window.url()).toBe(`${site.origin}/`);
  expect(app.windows()).toHaveLength(1);
  expect(await app.evaluate(({ app: electronApp }) => electronApp.getName())).toBe("JAWA POS");
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
  const { app, window } = await launchApp({ kind: "pos", origins: { pos: site.origin } });
  await expect(window.locator("#where")).toHaveText("Fake POS");
  const preferences = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
  expect(preferences).toMatchObject({
    contextIsolation: true, sandbox: true, nodeIntegration: false, nodeIntegrationInSubFrames: false,
    nodeIntegrationInWorker: false, webviewTag: false, webSecurity: true, allowRunningInsecureContent: false,
    experimentalFeatures: false,
  });
  expect(preferences.preload ?? null).toBeNull();
  expect(await app.evaluate(({ BrowserWindow, session }) => BrowserWindow.getAllWindows()[0].webContents.session === session.fromPartition("persist:jawa-pos"))).toBe(true);
  expect(await window.evaluate(() => [ typeof require, typeof process, typeof module, typeof window.electron ])).toEqual([ "undefined", "undefined", "undefined", "undefined" ]);
  await app.close();
});

test("tells the server which JAWA desktop app is asking", async () => {
  const { app, window } = await launchApp({ kind: "pos", origins: { pos: site.origin } });
  await window.goto(`${site.origin}/headers`);
  const agent = await window.locator("#agent").textContent();
  expect(agent).toMatch(/ Chrome\/[\d.]+ Electron\/[\d.]+ Safari\/537\.36 JAWADesktop\/0\.1\.0 \(pos\)$/);
  expect(agent).not.toMatch(/JAWA POS\/|jawa-apps\//);
  await app.close();
});

test("the app still identifies itself after a form post and its redirect", async () => {
  const { app, window } = await launchApp({ kind: "pos", origins: { pos: site.origin } });
  await window.goto(`${site.origin}/post-then-redirect`);
  await window.click("#send");
  await expect(window.locator("#where")).toHaveText("Headers");
  const [ post, redirected ] = site.requests.filter((request) => [ "/echo-redirect", "/headers" ].includes(request.path));
  expect(post.method).toBe("POST");
  for (const request of [ post, redirected ]) expect(request.headers["user-agent"]).toMatch(/ JAWADesktop\/0\.1\.0 \(pos\)$/);
  await app.close();
});

test("pages loaded through the site's service worker still identify the app", async () => {
  const { app, window } = await launchApp({ kind: "pos", origins: { pos: site.origin } });
  await window.goto(`${site.origin}/with-worker`);
  await expect.poll(() => window.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await window.click("#through-worker");
  await expect(window.locator("#where")).toHaveText("Headers");
  const throughWorker = site.requests.filter((request) => request.path === "/headers").at(-1);
  expect(throughWorker.headers["service-worker"] ?? null).toBeNull();
  expect(throughWorker.headers["user-agent"]).toMatch(/ JAWADesktop\/0\.1\.0 \(pos\)$/);
  expect(await window.evaluate(() => navigator.userAgent)).toMatch(/ JAWADesktop\/0\.1\.0 \(pos\)$/);
  await app.close();
});

test("the menu offers browser-style history and, while developing, developer tools", async () => {
  const { app } = await launchApp({ kind: "pos", origins: { pos: site.origin } });
  const menu = await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.map((item) => ({
    label: item.label, items: item.submenu?.items.map((entry) => entry.role || entry.label) ?? [],
  })));
  const history = menu.find((item) => item.label === "History");
  expect(history.items).toEqual([ "Back", "Forward", "Home" ]);
  expect(menu.find((item) => item.label === "View").items).toContain("toggledevtools");
  await app.close();
});

test("History > Home and Back move the window as a browser would", async () => {
  const { app, window } = await launchApp({ kind: "pos", origins: { pos: site.origin } });
  await window.click("#own");
  await expect(window.locator("#where")).toHaveText("Second page");
  await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById("back").click());
  await expect(window.locator("#where")).toHaveText("Fake POS");
  await window.click("#own");
  await expect(window.locator("#where")).toHaveText("Second page");
  await app.evaluate(({ Menu }) => Menu.getApplicationMenu().getMenuItemById("home").click());
  await expect(window).toHaveURL(`${site.origin}/`);
  await app.close();
});

test("the window reopens where it was left", async () => {
  const profile = freshProfile();
  const first = await launchApp({ kind: "pos", origins: { pos: site.origin }, profile });
  await expect(first.window.locator("#where")).toHaveText("Fake POS");
  await first.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setBounds({ x: 40, y: 60, width: 900, height: 640 }));
  await first.app.close();

  const second = await launchApp({ kind: "pos", origins: { pos: site.origin }, profile });
  await expect(second.window.locator("#where")).toHaveText("Fake POS");
  const bounds = await second.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
  expect(bounds).toMatchObject({ width: 900, height: 640 });
  await second.app.close();
});

test("each app keeps its own cookies", async () => {
  const profile = freshProfile();
  const pos = await launchApp({ kind: "pos", origins: { pos: site.origin }, profile });
  await pos.window.goto(`${site.origin}/set-binding`);
  const posCookies = await pos.app.evaluate(({ session }) => session.fromPartition("persist:jawa-pos").cookies.get({}));
  const foodCookies = await pos.app.evaluate(({ session }) => session.fromPartition("persist:jawa-food").cookies.get({}));
  expect(posCookies.map((cookie) => cookie.name)).toContain("desktop_binding");
  expect(foodCookies).toEqual([]);
  await pos.app.close();
});
