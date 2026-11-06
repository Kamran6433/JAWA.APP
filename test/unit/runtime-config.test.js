import { test } from "node:test";
import assert from "node:assert/strict";
import { ConfigurationError, normalizeOrigin, resolveRuntimeConfig } from "../../src/runtime-config.js";

const productionOrigins = { menu: "https://menu.jawa.example", food: "https://food.jawa.example" };

test("a packaged app uses only its bundled kind and HTTPS origins", () => {
  const config = resolveRuntimeConfig({
    isPackaged: true,
    bundled: { kind: "food", origins: productionOrigins },
    env: { JAWA_APP: "menu", JAWA_FOOD_ORIGIN: "https://attacker.example", JAWA_USER_DATA_DIR: "/tmp/elsewhere", JAWA_SHOW_WINDOWS: "0", JAWA_REGISTER_PROTOCOL: "0" },
  });
  assert.equal(config.kind, "food");
  assert.equal(config.environment, "production");
  assert.equal(config.homeUrl, "https://food.jawa.example/");
  assert.equal(config.identityOrigin, "https://menu.jawa.example");
  assert.deepEqual(config.trustedOrigins, [ "https://food.jawa.example", "https://menu.jawa.example" ]);
  assert.equal(config.userDataDirectory, null);
  assert.equal(config.showWindows, true);
  assert.equal(config.registerProtocol, true);
  assert.ok(Object.isFrozen(config));
});

test("a packaged app refuses missing, insecure or malformed bundled settings", () => {
  const cases = [
    null,
    { kind: "menu" },
    { kind: "site", origins: productionOrigins },
    { kind: "menu", origins: { ...productionOrigins, menu: "http://menu.jawa.example" } },
    { kind: "menu", origins: { ...productionOrigins, menu: "http://localhost:3000" } },
    { kind: "menu", origins: { food: productionOrigins.food } },
    { kind: "food", origins: { ...productionOrigins, food: undefined } },
    { kind: "food", origins: { ...productionOrigins, menu: undefined } },
    { kind: "food", origins: { ...productionOrigins, food: "https://food.jawa.example/path" } },
    { kind: "food", origins: { ...productionOrigins, food: "https://food.jawa.example/?q=1" } },
    { kind: "food", origins: { ...productionOrigins, food: "https://food.jawa.example/#top" } },
    { kind: "food", origins: { ...productionOrigins, food: "https://user:pass@food.jawa.example" } },
    { kind: "food", origins: { ...productionOrigins, menu: "javascript:alert(1)" } },
    { kind: "food", origins: { ...productionOrigins, food: 42 } },
  ];
  for (const bundled of cases) {
    assert.throws(() => resolveRuntimeConfig({ isPackaged: true, bundled, env: {} }), ConfigurationError, JSON.stringify(bundled));
  }
});

test("a packaged MENU app needs and keeps only its own origin, ignoring any other", () => {
  for (const origins of [ { menu: productionOrigins.menu }, { ...productionOrigins, food: "javascript:alert(1)" } ]) {
    const config = resolveRuntimeConfig({ isPackaged: true, bundled: { kind: "menu", origins }, env: {} });
    assert.deepEqual(config.origins, { menu: "https://menu.jawa.example" });
    assert.deepEqual(config.trustedOrigins, [ "https://menu.jawa.example" ]);
    assert.equal(config.homeUrl, "https://menu.jawa.example/");
  }
});

test("development defaults to MENU on the local ecosystem ports", () => {
  const config = resolveRuntimeConfig({ isPackaged: false, env: {} });
  assert.equal(config.kind, "menu");
  assert.equal(config.environment, "development");
  assert.equal(config.homeUrl, "http://localhost:3000/");
  assert.deepEqual(config.origins, { menu: "http://localhost:3000", food: "http://localhost:3001" });
  assert.deepEqual(config.trustedOrigins, [ "http://localhost:3000" ]);
  assert.equal(config.showWindows, true);
  assert.equal(config.registerProtocol, false);
});

test("development FOOD trusts its own site and the JAWA ID sign-in service", () => {
  const config = resolveRuntimeConfig({ isPackaged: false, env: { JAWA_APP: "food" } });
  assert.equal(config.homeUrl, "http://localhost:3001/");
  assert.deepEqual(config.trustedOrigins, [ "http://localhost:3001", "http://localhost:3000" ]);
});

test("development accepts local HTTP or any HTTPS override, a test profile and hidden windows", () => {
  const config = resolveRuntimeConfig({
    isPackaged: false,
    env: { JAWA_APP: "food", JAWA_FOOD_ORIGIN: "http://127.0.0.1:4555/", JAWA_MENU_ORIGIN: "https://staging-menu.example.test", JAWA_USER_DATA_DIR: "/tmp/jawa-test", JAWA_SHOW_WINDOWS: "0", JAWA_REGISTER_PROTOCOL: "1" },
  });
  assert.equal(config.homeUrl, "http://127.0.0.1:4555/");
  assert.equal(config.identityOrigin, "https://staging-menu.example.test");
  assert.equal(config.userDataDirectory, "/tmp/jawa-test");
  assert.equal(config.showWindows, false);
  assert.equal(config.registerProtocol, true);
});

test("development refuses plain HTTP to anything but this computer", () => {
  for (const origin of [ "http://menu.jawa.example", "http://192.168.1.20:3000", "http://localhost.attacker.example" ]) {
    assert.throws(() => resolveRuntimeConfig({ isPackaged: false, env: { JAWA_MENU_ORIGIN: origin } }), ConfigurationError, origin);
  }
});

test("development refuses an unknown app or a relative profile folder", () => {
  assert.throws(() => resolveRuntimeConfig({ isPackaged: false, env: { JAWA_APP: "site" } }), ConfigurationError);
  assert.throws(() => resolveRuntimeConfig({ isPackaged: false, env: { JAWA_USER_DATA_DIR: "relative/dir" } }), ConfigurationError);
});

test("one origin may serve both apps without duplicate trust entries", () => {
  const config = resolveRuntimeConfig({ isPackaged: true, bundled: { kind: "food", origins: { ...productionOrigins, food: productionOrigins.menu } }, env: {} });
  assert.deepEqual(config.trustedOrigins, [ "https://menu.jawa.example" ]);
});

test("normalizeOrigin returns the canonical origin", () => {
  assert.equal(normalizeOrigin("HTTPS://MENU.Jawa.Example:443/", { allowLocalHttp: false }), "https://menu.jawa.example");
  assert.equal(normalizeOrigin("https://menu.jawa.example:8443", { allowLocalHttp: false }), "https://menu.jawa.example:8443");
  assert.equal(normalizeOrigin("http://[::1]:3000", { allowLocalHttp: true }), "http://[::1]:3000");
  assert.throws(() => normalizeOrigin("http://localhost:3000", { allowLocalHttp: false }), ConfigurationError);
  assert.throws(() => normalizeOrigin("ftp://menu.jawa.example", { allowLocalHttp: true }), ConfigurationError);
  assert.throws(() => normalizeOrigin("not a url", { allowLocalHttp: true }), ConfigurationError);
});
