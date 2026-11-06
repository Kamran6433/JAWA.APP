import { test } from "node:test";
import assert from "node:assert/strict";
import { loadFailure, offlinePageUrl, renderOfflinePage } from "../../src/offline-page.js";
import { translator } from "../../src/strings.js";

const t = translator("en");
const trusted = [ "https://menu.jawa.example" ];

test("a dropped connection on the app's own page shows the offline page", () => {
  for (const code of [ -106, -105, -102, -118, -109, -21, -101, -7, -130, -137 ]) {
    assert.equal(loadFailure({ errorCode: code, isMainFrame: true, url: "https://menu.jawa.example/", trustedOrigins: trusted }), "offline", String(code));
  }
});

test("a certificate problem shows the insecure-connection page", () => {
  for (const code of [ -200, -201, -202, -207, -213 ]) {
    assert.equal(loadFailure({ errorCode: code, isMainFrame: true, url: "https://menu.jawa.example/", trustedOrigins: trusted }), "insecure", String(code));
  }
});

test("cancelled loads, frames, other sites and unknown errors are left alone", () => {
  const base = { errorCode: -106, isMainFrame: true, url: "https://menu.jawa.example/", trustedOrigins: trusted };
  assert.equal(loadFailure({ ...base, errorCode: -3 }), null);
  assert.equal(loadFailure({ ...base, errorCode: -27 }), null);
  assert.equal(loadFailure({ ...base, isMainFrame: false }), null);
  assert.equal(loadFailure({ ...base, url: "https://example.org/" }), null);
  assert.equal(loadFailure({ ...base, url: "data:text/html,x" }), null);
});

test("the offline page retries the page that failed, on its own and on request", () => {
  const html = renderOfflinePage({ appName: "JAWA MENU", retryUrl: "https://menu.jawa.example/MENU/demo_till", failure: "offline", theme: "light", t });
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<title>JAWA MENU<\/title>/);
  assert.match(html, /<meta http-equiv="refresh" content="15;url=https:\/\/menu.jawa.example\/MENU\/demo_till">/);
  assert.match(html, /<a class="retry" href="https:\/\/menu.jawa.example\/MENU\/demo_till">Try again<\/a>/);
  assert.ok(html.includes(t("offline.offline.title", { app: "JAWA MENU" })));
  assert.match(html, /<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">/);
  assert.ok(!html.includes("<script"));
});

test("an insecure connection is not retried automatically", () => {
  const html = renderOfflinePage({ appName: "JAWA MENU", retryUrl: "https://menu.jawa.example/", failure: "insecure", theme: "dark", t });
  assert.ok(!html.includes('http-equiv="refresh"'));
  assert.ok(html.includes(t("offline.insecure.title")));
  assert.match(html, /background:#14161a/);
});

test("names and addresses are escaped", () => {
  const html = renderOfflinePage({ appName: `<img src=x onerror="alert(1)">&'`, retryUrl: "https://menu.jawa.example/?q=\"><script>", failure: "offline", theme: "light", t });
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes('"><script>'));
  assert.ok(html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;"));
});

test("only a web address can be retried", () => {
  for (const retryUrl of [ "javascript:alert(1)", "file:///etc/passwd", "data:text/html,x", "nope" ]) {
    assert.throws(() => renderOfflinePage({ appName: "JAWA MENU", retryUrl, failure: "offline", theme: "light", t }), /retry/, retryUrl);
  }
});

test("the page is loaded as a self-contained document", () => {
  const url = offlinePageUrl("<p>Hi & bye</p>");
  assert.ok(url.startsWith("data:text/html;charset=utf-8,"));
  assert.equal(decodeURIComponent(url.slice("data:text/html;charset=utf-8,".length)), "<p>Hi & bye</p>");
});
