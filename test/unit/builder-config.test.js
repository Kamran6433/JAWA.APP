import { test } from "node:test";
import assert from "node:assert/strict";
import { builderConfig } from "../../scripts/builder-config.js";
import { ConfigurationError } from "../../src/runtime-config.js";

const origins = { menu: "https://menu.jawa.example", food: "https://food.jawa.example" };

test("each app is built under its own name, bundle id, icon and link scheme", () => {
  const menu = builderConfig({ kind: "menu", origins });
  const food = builderConfig({ kind: "food", origins });
  assert.equal(menu.appId, "com.jawa.menu");
  assert.equal(menu.productName, "JAWA MENU");
  assert.equal(menu.icon, "apps/menu/icon.png");
  assert.deepEqual(menu.protocols, [ { name: "JAWA MENU", schemes: [ "jawa-menu" ] } ]);
  assert.equal(food.appId, "com.jawa.food");
  assert.equal(food.productName, "JAWA.FOOD");
  assert.deepEqual(food.protocols, [ { name: "JAWA.FOOD", schemes: [ "jawa-food" ] } ]);
  assert.equal(menu.directories.output, "dist/menu");
  assert.equal(food.directories.output, "dist/food");
});

test("the shipped app carries only its kind and the public HTTPS origins", () => {
  const config = builderConfig({ kind: "food", origins: { menu: "HTTPS://MENU.jawa.example/", food: "https://food.jawa.example" } });
  assert.deepEqual(config.extraMetadata.jawa, { kind: "food", origins: { menu: "https://menu.jawa.example", food: "https://food.jawa.example" } });
  assert.equal(config.extraMetadata.main, "src/main.js");
  assert.equal(config.extraMetadata.name, "jawa-food");
  assert.deepEqual(Object.keys(config.extraMetadata).sort(), [ "jawa", "main", "name", "productName" ]);
});

test("a MENU build needs and ships only MENU's origin", () => {
  for (const given of [ { menu: "https://menu.jawa.example" }, origins ]) {
    assert.deepEqual(builderConfig({ kind: "menu", origins: given }).extraMetadata.jawa, { kind: "menu", origins: { menu: "https://menu.jawa.example" } });
  }
  assert.throws(() => builderConfig({ kind: "menu", origins: { food: origins.food } }), ConfigurationError);
});

test("only the app's own source and manifest go into the package", () => {
  const config = builderConfig({ kind: "menu", origins });
  assert.deepEqual(config.files, [ "package.json", "src/**/*.js", "!**/*.map" ]);
  assert.equal(config.asar, true);
  assert.equal(config.publish, null);
});

test("Electron's security fuses are set", () => {
  assert.deepEqual(builderConfig({ kind: "menu", origins }).electronFuses, {
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
  const config = builderConfig({ kind: "menu", origins });
  assert.equal(config.mac.category, "public.app-category.business");
  assert.deepEqual(config.mac.target, [ { target: "dmg", arch: [ "universal" ] }, { target: "zip", arch: [ "universal" ] } ]);
  assert.equal(config.mac.hardenedRuntime, true);
  assert.equal(builderConfig({ kind: "food", origins }).mac.category, "public.app-category.food-and-drink");
  assert.deepEqual(config.win.target, [ { target: "nsis", arch: [ "x64", "arm64" ] } ]);
  assert.equal(config.nsis.oneClick, true);
  assert.equal(config.nsis.perMachine, false);
  assert.equal(config.mac.identity, undefined);
});

test("installers keep the same file names in every release, so download links never change", () => {
  const menu = builderConfig({ kind: "menu", origins });
  const food = builderConfig({ kind: "food", origins });
  assert.equal(menu.dmg.artifactName, "JAWA-MENU-mac.dmg");
  assert.equal(menu.mac.artifactName, "JAWA-MENU-mac.${ext}");
  assert.equal(menu.nsis.artifactName, "JAWA-MENU-windows.exe");
  assert.equal(food.dmg.artifactName, "JAWA-FOOD-mac.dmg");
  assert.equal(food.mac.artifactName, "JAWA-FOOD-mac.${ext}");
  assert.equal(food.nsis.artifactName, "JAWA-FOOD-windows.exe");
});

test("an unsigned local build can be requested explicitly", () => {
  assert.equal(builderConfig({ kind: "menu", origins, unsigned: true }).mac.identity, null);
});

test("refuses SITE, unknown apps and anything but HTTPS origins", () => {
  assert.throws(() => builderConfig({ kind: "site", origins }), ConfigurationError);
  assert.throws(() => builderConfig({ kind: "menu", origins: { ...origins, menu: "http://menu.jawa.example" } }), ConfigurationError);
  assert.throws(() => builderConfig({ kind: "food", origins: { ...origins, food: "http://localhost:3001" } }), ConfigurationError);
  assert.throws(() => builderConfig({ kind: "food", origins: { food: origins.food } }), ConfigurationError);
});
