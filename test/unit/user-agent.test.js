import { test } from "node:test";
import assert from "node:assert/strict";
import { DESKTOP_USER_AGENT_PATTERN, desktopUserAgent } from "../../src/user-agent.js";

const engine = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.7444.59 Electron/44.10.0 Safari/537.36";
const electronDefault = engine.replace("Chrome/", "JAWA MENU/0.1.0 Chrome/");

test("names the JAWA desktop app and keeps the honest browser engine tokens", () => {
  const agent = desktopUserAgent(electronDefault, { version: "0.1.0", kind: "menu" });
  assert.equal(agent, `${engine} JAWADesktop/0.1.0 (menu)`);
  assert.match(agent, DESKTOP_USER_AGENT_PATTERN);
});

test("removes Electron's app token whatever the app was called", () => {
  for (const token of [ "JAWA.FOOD/0.1.0", "jawa-apps/0.1.0", "JAWA/0.1.0" ]) {
    assert.equal(desktopUserAgent(engine.replace("Chrome/", `${token} Chrome/`), { version: "0.1.0", kind: "food" }), `${engine} JAWADesktop/0.1.0 (food)`, token);
  }
  assert.equal(desktopUserAgent(engine, { version: "0.1.0", kind: "food" }), `${engine} JAWADesktop/0.1.0 (food)`);
});

test("applying it twice changes nothing", () => {
  const once = desktopUserAgent(electronDefault, { version: "0.1.0", kind: "menu" });
  assert.equal(desktopUserAgent(once, { version: "0.1.0", kind: "menu" }), once);
});

test("refuses an unknown app or a malformed version", () => {
  assert.throws(() => desktopUserAgent(electronDefault, { version: "0.1.0", kind: "site" }), /Unknown JAWA app/);
  assert.throws(() => desktopUserAgent(electronDefault, { version: "1.0 (evil)", kind: "menu" }), /version/);
});

test("the pattern the servers use recognises exactly the two apps", () => {
  assert.equal("x JAWADesktop/1.2.3 (food)".match(DESKTOP_USER_AGENT_PATTERN)[1], "food");
  assert.equal("x JAWADesktop/1.2.3 (menu)".match(DESKTOP_USER_AGENT_PATTERN)[1], "menu");
  assert.equal("x JAWADesktop/1.2.3 (site)".match(DESKTOP_USER_AGENT_PATTERN), null);
});
