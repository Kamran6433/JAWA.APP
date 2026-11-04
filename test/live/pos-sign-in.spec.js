import { chromium, expect, test } from "@playwright/test";
import { launchApp } from "../support/launch.js";

// The real JAWA POS desktop app against a real local POS. A separate Chrome
// plays the person's own browser, so the two share no cookies, exactly as in
// use. Only fictional accounts on a throwaway database belong here.
const posOrigin = process.env.JAWA_LIVE_POS_ORIGIN;
const email = process.env.JAWA_LIVE_EMAIL;
const password = process.env.JAWA_LIVE_PASSWORD;
const businessName = process.env.JAWA_LIVE_BUSINESS ?? "Desktop Check Kitchen";

test.skip(!posOrigin || !email || !password, "Set JAWA_LIVE_POS_ORIGIN, JAWA_LIVE_EMAIL and JAWA_LIVE_PASSWORD");

async function signInThroughBrowser(link) {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(link);
    await page.getByRole("button", { name: "Reject", exact: true }).click();
    await expect(page.locator("#cookie-notice")).toHaveCount(0);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Open JAWA POS on this computer?" })).toBeVisible();
    await expect(page.locator(".desktop-account")).toHaveText(email);
    await page.getByRole("button", { name: "Open JAWA POS" }).click();
    const back = page.locator("a[data-desktop-sign-in='return']");
    await expect(back).toHaveAttribute("href", /^jawa-pos:\/\/sign-in\?code=[A-Za-z0-9_-]{43}$/);
    return await back.getAttribute("href");
  } finally {
    await browser.close();
  }
}

test("signing in with the browser opens the POS app as that person", async () => {
  const { app, window, openedInBrowser } = await launchApp({ kind: "pos", origins: { pos: posOrigin } });
  await window.goto(`${posOrigin}/session/new?kind=user`);
  await window.getByRole("button", { name: "Sign in with your browser" }).click();
  await expect(window.getByRole("heading", { name: "Finish signing in in your browser" })).toBeVisible();
  await expect.poll(openedInBrowser).toHaveLength(1);
  const [ link ] = await openedInBrowser();
  expect(link).toMatch(/\/desktop\/sign-in\/browser\/[A-Za-z0-9_-]{43}$/);

  const returnLink = await signInThroughBrowser(link);
  await app.evaluate(({ app: electronApp }, url) => electronApp.emit("open-url", { preventDefault() {} }, url), returnLink);
  await expect(window).toHaveURL(`${posOrigin}/business_selection`);
  await expect(window.getByText(businessName)).toBeVisible();

  // The same code cannot be used twice.
  await app.evaluate(({ app: electronApp }, url) => electronApp.emit("open-url", { preventDefault() {} }, url), returnLink);
  await expect(window).toHaveURL(`${posOrigin}/session/new?kind=user`);
  await app.close();
});

test("password sign-in inside the app still works and the session survives a restart", async () => {
  const first = await launchApp({ kind: "pos", origins: { pos: posOrigin } });
  await first.window.goto(`${posOrigin}/session/new?kind=user`);
  await first.window.getByLabel("Email").fill(email);
  await first.window.getByLabel("Password").fill(password);
  await first.window.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(first.window).toHaveURL(`${posOrigin}/business_selection`);
  await first.app.close();

  const second = await launchApp({ kind: "pos", origins: { pos: posOrigin }, profile: first.profile });
  await second.window.goto(`${posOrigin}/business_selection`);
  await expect(second.window.getByText(businessName)).toBeVisible();
  await second.app.close();
});
