import { test } from "node:test";
import assert from "node:assert/strict";
import { ConfigurationError, normalizeOrigin, resolveRuntimeConfig } from "../../src/runtime-config.js";

const productionOrigins = { pos: "https://pos.jawa.example", food: "https://food.jawa.example" };

test("a packaged app uses only its bundled kind and HTTPS origins", () => {
  const config = resolveRuntimeConfig({
    isPackaged: true,
    bundled: { kind: "food", origins: productionOrigins },
    env: { JAWA_APP: "pos", JAWA_FOOD_ORIGIN: "https://attacker.example", JAWA_USER_DATA_DIR: "/tmp/elsewhere", JAWA_SHOW_WINDOWS: "0", JAWA_REGISTER_PROTOCOL: "0" },
  });
  assert.equal(config.kind, "food");
  assert.equal(config.environment, "production");
  assert.equal(config.homeUrl, "https://food.jawa.example/");
  assert.equal(config.identityOrigin, "https://pos.jawa.example");
  assert.deepEqual(config.trustedOrigins, [ "https://food.jawa.example", "https://pos.jawa.example" ]);
  assert.equal(config.userDataDirectory, null);
  assert.equal(config.showWindows, true);
  assert.equal(config.registerProtocol, true);
  assert.ok(Object.isFrozen(config));
});

test("a packaged app refuses missing, insecure or malformed bundled settings", () => {
  const cases = [
    null,
    { kind: "pos" },
    { kind: "site", origins: productionOrigins },
    { kind: "pos", origins: { ...productionOrigins, pos: "http://pos.jawa.example" } },
    { kind: "pos", origins: { ...productionOrigins, pos: "http://localhost:3000" } },
    { kind: "pos", origins: { food: productionOrigins.food } },
    { kind: "food", origins: { ...productionOrigins, food: undefined } },
    { kind: "food", origins: { ...productionOrigins, pos: undefined } },
    { kind: "food", origins: { ...productionOrigins, food: "https://food.jawa.example/path" } },
    { kind: "food", origins: { ...productionOrigins, food: "https://food.jawa.example/?q=1" } },
    { kind: "food", origins: { ...productionOrigins, food: "https://food.jawa.example/#top" } },
    { kind: "food", origins: { ...productionOrigins, food: "https://user:pass@food.jawa.example" } },
    { kind: "food", origins: { ...productionOrigins, pos: "javascript:alert(1)" } },
    { kind: "food", origins: { ...productionOrigins, food: 42 } },
  ];
  for (const bundled of cases) {
    assert.throws(() => resolveRuntimeConfig({ isPackaged: true, bundled, env: {} }), ConfigurationError, JSON.stringify(bundled));
  }
});

test("a packaged POS app needs and keeps only its own origin, ignoring any other", () => {
  for (const origins of [ { pos: productionOrigins.pos }, { ...productionOrigins, food: "javascript:alert(1)" } ]) {
    const config = resolveRuntimeConfig({ isPackaged: true, bundled: { kind: "pos", origins }, env: {} });
    assert.deepEqual(config.origins, { pos: "https://pos.jawa.example" });
    assert.deepEqual(config.trustedOrigins, [ "https://pos.jawa.example" ]);
    assert.equal(config.homeUrl, "https://pos.jawa.example/");
  }
});

test("development defaults to POS on the local ecosystem ports", () => {
  const config = resolveRuntimeConfig({ isPackaged: false, env: {} });
  assert.equal(config.kind, "pos");
  assert.equal(config.environment, "development");
  assert.equal(config.homeUrl, "http://localhost:3000/");
  assert.deepEqual(config.origins, { pos: "http://localhost:3000", food: "http://localhost:3001" });
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
    env: { JAWA_APP: "food", JAWA_FOOD_ORIGIN: "http://127.0.0.1:4555/", JAWA_POS_ORIGIN: "https://staging-pos.example.test", JAWA_USER_DATA_DIR: "/tmp/jawa-test", JAWA_SHOW_WINDOWS: "0", JAWA_REGISTER_PROTOCOL: "1" },
  });
  assert.equal(config.homeUrl, "http://127.0.0.1:4555/");
  assert.equal(config.identityOrigin, "https://staging-pos.example.test");
  assert.equal(config.userDataDirectory, "/tmp/jawa-test");
  assert.equal(config.showWindows, false);
  assert.equal(config.registerProtocol, true);
});

test("development refuses plain HTTP to anything but this computer", () => {
  for (const origin of [ "http://pos.jawa.example", "http://192.168.1.20:3000", "http://localhost.attacker.example" ]) {
    assert.throws(() => resolveRuntimeConfig({ isPackaged: false, env: { JAWA_POS_ORIGIN: origin } }), ConfigurationError, origin);
  }
});

test("development refuses an unknown app or a relative profile folder", () => {
  assert.throws(() => resolveRuntimeConfig({ isPackaged: false, env: { JAWA_APP: "site" } }), ConfigurationError);
  assert.throws(() => resolveRuntimeConfig({ isPackaged: false, env: { JAWA_USER_DATA_DIR: "relative/dir" } }), ConfigurationError);
});

test("one origin may serve both apps without duplicate trust entries", () => {
  const config = resolveRuntimeConfig({ isPackaged: true, bundled: { kind: "food", origins: { ...productionOrigins, food: productionOrigins.pos } }, env: {} });
  assert.deepEqual(config.trustedOrigins, [ "https://pos.jawa.example" ]);
});

test("normalizeOrigin returns the canonical origin", () => {
  assert.equal(normalizeOrigin("HTTPS://POS.Jawa.Example:443/", { allowLocalHttp: false }), "https://pos.jawa.example");
  assert.equal(normalizeOrigin("https://pos.jawa.example:8443", { allowLocalHttp: false }), "https://pos.jawa.example:8443");
  assert.equal(normalizeOrigin("http://[::1]:3000", { allowLocalHttp: true }), "http://[::1]:3000");
  assert.throws(() => normalizeOrigin("http://localhost:3000", { allowLocalHttp: false }), ConfigurationError);
  assert.throws(() => normalizeOrigin("ftp://pos.jawa.example", { allowLocalHttp: true }), ConfigurationError);
  assert.throws(() => normalizeOrigin("not a url", { allowLocalHttp: true }), ConfigurationError);
});
