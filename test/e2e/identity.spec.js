import { expect, test } from "@playwright/test";
import { startFakeSite } from "../support/fake-site.js";
import { heading, launchApp } from "../support/launch.js";

test("FOOD signs in through the JAWA ID origin without leaving its window", async () => {
  const food = await startFakeSite({ title: "Fake FOOD" });
  const identity = await startFakeSite({ title: "Fake JAWA ID" });
  food.useIdentity(identity.origin);
  const { app, window, openedInBrowser } = await launchApp({ kind: "food", origins: { food: food.origin, pos: identity.origin } });

  await window.goto(`${food.origin}/sign-in`);
  await expect(window.locator("#where")).toHaveText("Signed in through JAWA ID");
  expect(window.url()).toBe(`${food.origin}/auth/callback`);
  expect(identity.requests.map((request) => request.path)).toContain("/oauth/authorize");
  expect(await openedInBrowser()).toEqual([]);
  await app.close();
  await food.stop();
  await identity.stop();
});

test("POS does not trust FOOD's site, and JAWA.SITE is just another website", async () => {
  const pos = await startFakeSite({ title: "Fake POS" });
  const food = await startFakeSite({ title: "Fake FOOD" });
  const { app, window, openedInBrowser } = await launchApp({ kind: "pos", origins: { pos: pos.origin, food: food.origin } });
  await expect(window.locator("#where")).toHaveText("Fake POS");
  await window.evaluate((target) => { location.href = target; }, `${food.origin}/`).catch(() => {});
  await expect.poll(openedInBrowser).toEqual([ `${food.origin}/` ]);
  await window.evaluate(() => { location.href = "https://site.jawa.example/businesses"; }).catch(() => {});
  await expect.poll(openedInBrowser).toEqual([ `${food.origin}/`, "https://site.jawa.example/businesses" ]);
  expect(await heading(window)).toBe("Fake POS");
  await app.close();
  await pos.stop();
  await food.stop();
});
