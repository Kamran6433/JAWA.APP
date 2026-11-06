import { test } from "node:test";
import assert from "node:assert/strict";
import { devicePermissionDecision, permissionDecision } from "../../src/permissions.js";

const trusted = [ "https://menu.jawa.example" ];
const ask = (kind, permission, requestingUrl = "https://menu.jawa.example/MENU/demo_till") =>
  permissionDecision({ kind, permission, requestingUrl, trustedOrigins: trusted });

test("every app may copy to the clipboard and go full screen on its own pages", () => {
  for (const kind of [ "menu", "food" ]) {
    assert.equal(ask(kind, "clipboard-sanitized-write"), true, kind);
    assert.equal(ask(kind, "fullscreen"), true, kind);
  }
});

test("only MENU may use a serial caller-ID adapter", () => {
  assert.equal(ask("menu", "serial"), true);
  assert.equal(ask("food", "serial"), false);
});

test("camera, microphone, location, notifications and the rest are refused", () => {
  for (const permission of [
    "media", "geolocation", "notifications", "midi", "midiSysex", "openExternal", "display-capture",
    "clipboard-read", "pointerLock", "keyboardLock", "idle-detection", "window-management",
    "storage-access", "top-level-storage-access", "speaker-selection", "fileSystem", "hid", "usb", "unknown",
  ]) {
    assert.equal(ask("menu", permission), false, permission);
  }
});

test("another site inside the app gets nothing, even an allowed permission", () => {
  assert.equal(ask("menu", "fullscreen", "https://attacker.example/"), false);
  assert.equal(ask("menu", "serial", "https://menu.jawa.example.attacker.example/"), false);
  assert.equal(ask("menu", "fullscreen", "not a url"), false);
  assert.equal(ask("menu", "fullscreen", ""), false);
  assert.equal(permissionDecision({ kind: "menu", permission: "fullscreen", requestingUrl: undefined, trustedOrigins: trusted }), false);
});

test("the requesting page may be given as an origin or a full address", () => {
  assert.equal(ask("menu", "fullscreen", "https://menu.jawa.example"), true);
});

test("only MENU's own pages may remember a serial port", () => {
  const device = (kind, deviceType, origin) => devicePermissionDecision({ kind, deviceType, origin, trustedOrigins: trusted });
  assert.equal(device("menu", "serial", "https://menu.jawa.example"), true);
  assert.equal(device("menu", "serial", "https://attacker.example"), false);
  assert.equal(device("food", "serial", "https://menu.jawa.example"), false);
  assert.equal(device("menu", "usb", "https://menu.jawa.example"), false);
  assert.equal(device("menu", "hid", "https://menu.jawa.example"), false);
});
