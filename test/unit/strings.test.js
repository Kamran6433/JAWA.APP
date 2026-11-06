import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { translator } from "../../src/strings.js";

const sourceDirectory = fileURLToPath(new URL("../../src/", import.meta.url));

test("English text is returned for a key, with values filled in", () => {
  const t = translator("en");
  assert.equal(t("menu.home"), "Home");
  assert.equal(t("menu.about", { app: "JAWA MENU" }), "About JAWA MENU");
});

test("a missing key, a missing value or an unknown language fails loudly", () => {
  const t = translator("en");
  assert.throws(() => t("menu.nope"), /Missing translation: en.menu.nope/);
  assert.throws(() => t("menu"), /Missing translation: en.menu/);
  assert.throws(() => t("menu.about"), /Missing value "app"/);
  assert.throws(() => translator("xx"), /Unknown locale: xx/);
});

test("values are inserted as plain text, not re-read as placeholders", () => {
  const t = translator("en");
  assert.equal(t("menu.about", { app: "%{app} <b>" }), "About %{app} <b>");
});

test("every key the source uses exists in English", () => {
  const t = translator("en");
  const files = readdirSync(sourceDirectory, { recursive: true }).filter((file) => file.endsWith(".js"));
  const keys = new Set();
  for (const file of files) {
    for (const match of readFileSync(join(sourceDirectory, file), "utf8").matchAll(/\bt\("([a-z_.]+)"/g)) keys.add(match[1]);
  }
  assert.ok(keys.size > 10, "expected the source to use translated text");
  const anyValue = new Proxy({}, { get: (_, name) => String(name) });
  for (const key of keys) assert.doesNotThrow(() => t(key, anyValue), key);
});
