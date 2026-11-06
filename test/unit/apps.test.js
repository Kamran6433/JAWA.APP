import { test } from "node:test";
import assert from "node:assert/strict";
import { APPS, APP_KINDS, appFor } from "../../src/apps.js";

test("defines the MENU and FOOD desktop apps; SITE stays a website", () => {
  assert.deepEqual(APP_KINDS, [ "menu", "food" ]);
  assert.deepEqual(Object.keys(APPS), APP_KINDS);
});

test("each app has its own name, bundle id, link scheme and storage", () => {
  const values = (field) => APP_KINDS.map((kind) => APPS[kind][field]);
  assert.deepEqual(values("name"), [ "JAWA MENU", "JAWA.FOOD" ]);
  assert.deepEqual(values("appId"), [ "com.jawa.menu", "com.jawa.food" ]);
  assert.deepEqual(values("scheme"), [ "jawa-menu", "jawa-food" ]);
  assert.deepEqual(values("partition"), [ "persist:jawa-menu", "persist:jawa-food" ]);
});

test("each app opens where its installed web app opens", () => {
  assert.equal(APPS.menu.startPath, "/");
  assert.equal(APPS.food.startPath, "/");
});

test("local development ports match the local ecosystem guide", () => {
  assert.deepEqual(APP_KINDS.map((kind) => APPS[kind].developmentPort), [ 3000, 3001 ]);
});

test("FOOD signs in through JAWA ID; MENU is JAWA ID", () => {
  assert.equal(APPS.menu.signsInThroughIdentity, false);
  assert.equal(APPS.food.signsInThroughIdentity, true);
});

test("window colours match the web apps' light and dark canvas", () => {
  for (const kind of APP_KINDS) {
    assert.deepEqual(APPS[kind].background, { light: "#f6f6f6", dark: "#14161a" });
  }
});

test("definitions cannot be changed at runtime", () => {
  assert.ok(Object.isFrozen(APPS));
  assert.ok(Object.isFrozen(APPS.menu));
  assert.ok(Object.isFrozen(APPS.menu.background));
  assert.throws(() => { APPS.menu.scheme = "https"; }, TypeError);
});

test("appFor refuses anything but a known app", () => {
  assert.equal(appFor("food").name, "JAWA.FOOD");
  for (const kind of [ "site", "admin", "", undefined, "__proto__", "constructor", "MENU" ]) {
    assert.throws(() => appFor(kind), /Unknown JAWA app/);
  }
});
