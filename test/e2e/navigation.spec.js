import { expect, test } from "@playwright/test";
import { startFakeSite } from "../support/fake-site.js";
import { heading, launchApp } from "../support/launch.js";

let site;
let launched;
test.beforeEach(async () => {
  site = await startFakeSite({ title: "Fake POS" });
  launched = await launchApp({ kind: "pos", origins: { pos: site.origin } });
  await expect(launched.window.locator("#where")).toHaveText("Fake POS");
});
test.afterEach(async () => {
  await launched.app.close();
  await site.stop();
});

test("a link to the app's own page stays in the app", async () => {
  await launched.window.click("#own");
  await expect(launched.window.locator("#where")).toHaveText("Second page");
  expect(await launched.openedInBrowser()).toEqual([]);
});

test("a link to another website opens in the browser and the app stays put", async () => {
  await launched.window.click("#external", { noWaitAfter: true });
  await expect.poll(launched.openedInBrowser).toEqual([ "https://example.org/menu" ]);
  expect(await heading(launched.window)).toBe("Fake POS");
});

test("another JAWA app's site opens in the browser too", async () => {
  await launched.window.click("#other-app", { noWaitAfter: true });
  await expect.poll(launched.openedInBrowser).toEqual([ "https://food.example.test/" ]);
});

test("email links go to the mail app", async () => {
  await launched.window.click("#mail", { noWaitAfter: true });
  await expect.poll(launched.openedInBrowser).toEqual([ "mailto:hello@example.org" ]);
});

test("a local file link does nothing", async () => {
  await launched.window.click("#file", { noWaitAfter: true });
  await launched.window.waitForTimeout(500);
  expect(await heading(launched.window)).toBe("Fake POS");
  expect(await launched.openedInBrowser()).toEqual([]);
});

test("a server redirect to another website opens it in the browser instead", async () => {
  await launched.window.click("#redirect", { noWaitAfter: true });
  await expect.poll(launched.openedInBrowser).toEqual([ "https://example.org/after-redirect" ]);
  expect(await heading(launched.window)).toBe("Fake POS");
});

test("the app's own page in a new window opens as another app window", async () => {
  const [ popup ] = await Promise.all([ launched.app.waitForEvent("window"), launched.window.click("#popup-own") ]);
  await expect(popup.locator("#where")).toHaveText("Second page");
  expect(launched.app.windows()).toHaveLength(2);
  const windows = await launched.app.evaluate(({ BrowserWindow, session }) => BrowserWindow.getAllWindows().map((win) => ({
    preferences: win.webContents.getLastWebPreferences(),
    sharesAppStorage: win.webContents.session === session.fromPartition("persist:jawa-pos"),
  })));
  for (const { preferences, sharesAppStorage } of windows) {
    expect(preferences).toMatchObject({ sandbox: true, contextIsolation: true, nodeIntegration: false, webviewTag: false });
    expect(sharesAppStorage).toBe(true);
  }
  await popup.click("#where");
  await popup.evaluate(() => { location.href = "https://example.org/from-popup"; });
  await expect.poll(launched.openedInBrowser).toEqual([ "https://example.org/from-popup" ]);
});

test("another website in a new window opens in the browser, not the app", async () => {
  await launched.window.click("#popup-external", { noWaitAfter: true });
  await expect.poll(launched.openedInBrowser).toEqual([ "https://qz.io/download/" ]);
  expect(launched.app.windows()).toHaveLength(1);
});

test("the jawa-browser target opens even the app's own page in the browser", async () => {
  await launched.window.click("#browser", { noWaitAfter: true });
  await expect.poll(launched.openedInBrowser).toEqual([ `${site.origin}/desktop/sign-in/browser/fictional-request` ]);
  expect(launched.app.windows()).toHaveLength(1);
});

test("a script opening the jawa-browser window sends it to the browser, as POS's waiting page does", async () => {
  await launched.window.goto(`${site.origin}/script-opens-browser`);
  await expect.poll(launched.openedInBrowser).toEqual([ `${site.origin}/desktop/sign-in/browser/fictional-request` ]);
  expect(launched.app.windows()).toHaveLength(1);
});

test("a frame from another website is not loaded", async () => {
  await launched.window.goto(`${site.origin}/iframe`);
  await launched.window.waitForTimeout(500);
  const frameUrls = launched.window.frames().map((frame) => frame.url());
  expect(frameUrls).not.toContain("https://example.org/framed");
  expect(await launched.openedInBrowser()).toEqual([]);
});

test("a <webview> is never attached", async () => {
  await launched.window.goto(`${site.origin}/webview`);
  await launched.window.waitForTimeout(500);
  const contents = await launched.app.evaluate(({ webContents }) => webContents.getAllWebContents().map((entry) => entry.getType()));
  expect(contents).not.toContain("webview");
});
