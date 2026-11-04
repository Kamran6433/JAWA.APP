import { test } from "node:test";
import assert from "node:assert/strict";
import { builderConfig } from "../../scripts/builder-config.js";
import { ConfigurationError } from "../../src/runtime-config.js";

const origins = { pos: "https://pos.jawa.example", food: "https://food.jawa.example" };

test("each app is built under its own name, bundle id, icon and link scheme", () => {
  const pos = builderConfig({ kind: "pos", origins });
  const food = builderConfig({ kind: "food", origins });
  assert.equal(pos.appId, "com.jawa.pos");
  assert.equal(pos.productName, "JAWA POS");
  assert.equal(pos.icon, "apps/pos/icon.png");
  assert.deepEqual(pos.protocols, [ { name: "JAWA POS", schemes: [ "jawa-pos" ] } ]);
  assert.equal(food.appId, "com.jawa.food");
  assert.equal(food.productName, "JAWA.FOOD");
  assert.deepEqual(food.protocols, [ { name: "JAWA.FOOD", schemes: [ "jawa-food" ] } ]);
  assert.equal(pos.directories.output, "dist/pos");
  assert.equal(food.directories.output, "dist/food");
});

test("the shipped app carries only its kind and the public HTTPS origins", () => {
  const config = builderConfig({ kind: "food", origins: { pos: "HTTPS://POS.jawa.example/", food: "https://food.jawa.example" } });
  assert.deepEqual(config.extraMetadata.jawa, { kind: "food", origins: { pos: "https://pos.jawa.example", food: "https://food.jawa.example" } });
  assert.equal(config.extraMetadata.main, "src/main.js");
  assert.equal(config.extraMetadata.name, "jawa-food");
  assert.deepEqual(Object.keys(config.extraMetadata).sort(), [ "jawa", "main", "name", "productName" ]);
});

test("only the app's own source and manifest go into the package", () => {
  const config = builderConfig({ kind: "pos", origins });
  assert.deepEqual(config.files, [ "package.json", "src/**/*.js", "!**/*.map" ]);
  assert.equal(config.asar, true);
  assert.equal(config.publish, null);
});

test("Electron's security fuses are set", () => {
  assert.deepEqual(builderConfig({ kind: "pos", origins }).electronFuses, {
    runAsNode: false,
    enableCookieEncryption: true,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true,
    grantFileProtocolExtraPrivileges: false,
    resetAdHocDarwinSignature: true,
  });
});

test("macOS and Windows installers are described; nothing is signed or published by default", () => {
  const config = builderConfig({ kind: "pos", origins });
  assert.equal(config.mac.category, "public.app-category.business");
  assert.deepEqual(config.mac.target, [ { target: "dmg", arch: [ "universal" ] }, { target: "zip", arch: [ "universal" ] } ]);
  assert.equal(config.mac.hardenedRuntime, true);
  assert.equal(builderConfig({ kind: "food", origins }).mac.category, "public.app-category.food-and-drink");
  assert.deepEqual(config.win.target, [ { target: "nsis", arch: [ "x64", "arm64" ] } ]);
  assert.equal(config.nsis.oneClick, true);
  assert.equal(config.nsis.perMachine, false);
  assert.equal(config.mac.identity, undefined);
});

test("an unsigned local build can be requested explicitly", () => {
  assert.equal(builderConfig({ kind: "pos", origins, unsigned: true }).mac.identity, null);
});

test("refuses SITE, unknown apps and anything but HTTPS origins", () => {
  assert.throws(() => builderConfig({ kind: "site", origins }), ConfigurationError);
  assert.throws(() => builderConfig({ kind: "pos", origins: { ...origins, pos: "http://pos.jawa.example" } }), ConfigurationError);
  assert.throws(() => builderConfig({ kind: "pos", origins: { ...origins, food: "http://localhost:3001" } }), ConfigurationError);
  assert.throws(() => builderConfig({ kind: "pos", origins: { pos: origins.pos } }), ConfigurationError);
});
