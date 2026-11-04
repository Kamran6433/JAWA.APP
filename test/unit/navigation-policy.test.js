import { test } from "node:test";
import assert from "node:assert/strict";
import { SYSTEM_BROWSER_TARGET, externalUrl, navigationDecision, windowOpenDecision } from "../../src/navigation-policy.js";

const trusted = [ "https://site.jawa.example", "https://pos.jawa.example" ];

test("pages on the app's own sites stay in the app", () => {
  for (const url of [
    "https://site.jawa.example/",
    "https://site.jawa.example/businesses/12/edit?tab=menu#hours",
    "https://pos.jawa.example/oauth/authorize?client_id=jawa-site",
    "HTTPS://SITE.JAWA.EXAMPLE:443/businesses",
  ]) {
    assert.equal(navigationDecision(url, trusted), "allow", url);
  }
});

test("other websites open in the person's browser", () => {
  for (const url of [
    "https://food.jawa.example/b/12",
    "https://site.jawa.example.attacker.test/",
    "https://pos.jawa.example:8443/",
    "http://site.jawa.example/",
    "https://checkout.stripe.com/c/pay/cs_test",
    "http://example.org/",
    "mailto:hello@example.org",
    "tel:+441234567890",
  ]) {
    assert.equal(navigationDecision(url, trusted), "external", url);
  }
});

test("scripts, local files, embedded data and app links never load or open", () => {
  for (const url of [
    "javascript:alert(document.cookie)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "blob:https://site.jawa.example/7f1c",
    "about:blank",
    "chrome://settings",
    "devtools://devtools/bundled/inspector.html",
    "jawa-site://sign-in?code=abc",
    "ms-settings:privacy",
    "vbscript:msgbox",
    "https://user:password@site.jawa.example/",
    "https://user@example.org/",
    "not a url",
    "",
    null,
    undefined,
    42,
  ]) {
    assert.equal(navigationDecision(url, trusted), "deny", String(url));
  }
});

test("an empty trust list keeps nothing in the app", () => {
  assert.equal(navigationDecision("https://site.jawa.example/", []), "external");
});

test("a new window for the app's own pages opens as another app window", () => {
  assert.equal(windowOpenDecision({ url: "https://pos.jawa.example/console/settings", frameName: "" }, trusted), "window");
  assert.equal(windowOpenDecision({ url: "https://site.jawa.example/terms", frameName: "_blank" }, trusted), "window");
});

test("a new window for another site opens in the browser", () => {
  assert.equal(windowOpenDecision({ url: "https://qz.io/download/", frameName: "_blank" }, trusted), "external");
});

test("the jawa-browser target sends even the app's own pages to the browser", () => {
  assert.equal(SYSTEM_BROWSER_TARGET, "jawa-browser");
  assert.equal(windowOpenDecision({ url: "https://pos.jawa.example/desktop/sign-in/browser/abc", frameName: "jawa-browser" }, trusted), "external");
  assert.equal(windowOpenDecision({ url: "javascript:alert(1)", frameName: "jawa-browser" }, trusted), "deny");
  assert.equal(windowOpenDecision({ url: "file:///etc/hosts", frameName: "jawa-browser" }, trusted), "deny");
});

test("blank or scripted pop-ups are refused", () => {
  assert.equal(windowOpenDecision({ url: "about:blank", frameName: "" }, trusted), "deny");
  assert.equal(windowOpenDecision({ url: "", frameName: "" }, trusted), "deny");
  assert.equal(windowOpenDecision({}, trusted), "deny");
  assert.equal(windowOpenDecision(null, trusted), "deny");
});

test("externalUrl returns a canonical address only for what the browser may open", () => {
  assert.equal(externalUrl("https://Example.org/a b"), "https://example.org/a%20b");
  assert.equal(externalUrl("mailto:hello@example.org"), "mailto:hello@example.org");
  assert.equal(externalUrl("file:///etc/passwd"), null);
  assert.equal(externalUrl("https://user:pw@example.org/"), null);
  assert.equal(externalUrl("javascript:alert(1)"), null);
});
