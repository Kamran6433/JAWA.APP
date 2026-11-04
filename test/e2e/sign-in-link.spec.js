import { expect, test } from "@playwright/test";
import { spawn } from "node:child_process";
import electronPath from "electron";
import { startFakeSite } from "../support/fake-site.js";
import { APP_ROOT, freshProfile, launchApp } from "../support/launch.js";

const code = "Qm9vdHN0cmFwLWNvZGUtZm9yLXRlc3RzLW9ubHktMDE";
const completions = (site) => site.requests.filter((request) => request.path === "/desktop/sign-in/complete");

let site;
test.beforeEach(async () => { site = await startFakeSite({ title: "Fake POS" }); });
test.afterEach(async () => { await site.stop(); });

const openUrl = (app, url) => app.evaluate(({ app: electronApp }, link) => electronApp.emit("open-url", { preventDefault() {} }, link), url);

test("a sign-in link posts its code to JAWA ID from the window that holds the browser secret", async () => {
  const { app, window } = await launchApp({ kind: "pos", origins: { pos: site.origin } });
  await window.goto(`${site.origin}/set-binding`);
  await openUrl(app, `jawa-pos://sign-in?code=${code}`);
  await expect(window.locator("#where")).toHaveText("Signed in");

  const [ completion ] = completions(site);
  expect(completion.method).toBe("POST");
  expect(completion.query).toBe("");
  expect(completion.body).toBe(`code=${code}`);
  expect(completion.headers["content-type"]).toBe("application/x-www-form-urlencoded");
  expect(completion.headers.cookie).toContain("desktop_binding=window-secret");
  await app.close();
});

test("FOOD hands the code to the JAWA ID origin, not its own", async () => {
  const identity = await startFakeSite({ title: "Fake JAWA ID" });
  const { app } = await launchApp({ kind: "food", origins: { food: site.origin, pos: identity.origin } });
  await openUrl(app, `jawa-pos://sign-in?code=${code}`);
  await openUrl(app, `jawa-food://sign-in?code=${code}`);
  await expect.poll(() => completions(identity).length).toBe(1);
  expect(completions(site)).toEqual([]);
  await app.close();
  await identity.stop();
});

test("malformed links and other apps' links are ignored", async () => {
  const { app, window } = await launchApp({ kind: "pos", origins: { pos: site.origin } });
  await expect(window.locator("#where")).toHaveText("Fake POS");
  for (const link of [
    `jawa-food://sign-in?code=${code}`,
    `jawa-pos://sign-in?code=${code}&next=https://attacker.example`,
    "jawa-pos://sign-in?code=short",
    `https://attacker.example/sign-in?code=${code}`,
  ]) await openUrl(app, link);
  await window.waitForTimeout(500);
  expect(completions(site)).toEqual([]);
  await expect(window.locator("#where")).toHaveText("Fake POS");
  await app.close();
});

test("a link that starts the app is handled once it opens", async () => {
  const { app, window } = await launchApp({ kind: "pos", origins: { pos: site.origin }, args: [ `jawa-pos://sign-in?code=${code}` ] });
  await expect(window.locator("#where")).toHaveText("Signed in");
  expect(completions(site)).toHaveLength(1);
  await app.close();
});

test("opening the app again focuses the running one and passes the link on", async () => {
  const profile = freshProfile();
  const { app, window } = await launchApp({ kind: "pos", origins: { pos: site.origin }, profile });
  await expect(window.locator("#where")).toHaveText("Fake POS");

  const second = spawn(electronPath, [ APP_ROOT, `jawa-pos://sign-in?code=${code}` ], {
    env: { ...process.env, JAWA_APP: "pos", JAWA_POS_ORIGIN: site.origin, JAWA_USER_DATA_DIR: profile },
    stdio: "ignore",
  });
  const exitCode = await new Promise((resolve) => second.on("exit", resolve));
  expect(exitCode).toBe(0);
  await expect(window.locator("#where")).toHaveText("Signed in");
  expect(app.windows()).toHaveLength(1);
  await app.close();
});
