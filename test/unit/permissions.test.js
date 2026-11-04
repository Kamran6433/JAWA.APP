import { test } from "node:test";
import assert from "node:assert/strict";
import { devicePermissionDecision, permissionDecision } from "../../src/permissions.js";

const trusted = [ "https://pos.jawa.example" ];
const ask = (kind, permission, requestingUrl = "https://pos.jawa.example/POS/demo_till") =>
  permissionDecision({ kind, permission, requestingUrl, trustedOrigins: trusted });

test("every app may copy to the clipboard and go full screen on its own pages", () => {
  for (const kind of [ "pos", "food" ]) {
    assert.equal(ask(kind, "clipboard-sanitized-write"), true, kind);
    assert.equal(ask(kind, "fullscreen"), true, kind);
  }
});

test("only POS may use a serial caller-ID adapter", () => {
  assert.equal(ask("pos", "serial"), true);
  assert.equal(ask("food", "serial"), false);
});

test("camera, microphone, location, notifications and the rest are refused", () => {
  for (const permission of [
    "media", "geolocation", "notifications", "midi", "midiSysex", "openExternal", "display-capture",
    "clipboard-read", "pointerLock", "keyboardLock", "idle-detection", "window-management",
    "storage-access", "top-level-storage-access", "speaker-selection", "fileSystem", "hid", "usb", "unknown",
  ]) {
    assert.equal(ask("pos", permission), false, permission);
  }
});

test("another site inside the app gets nothing, even an allowed permission", () => {
  assert.equal(ask("pos", "fullscreen", "https://attacker.example/"), false);
  assert.equal(ask("pos", "serial", "https://pos.jawa.example.attacker.example/"), false);
  assert.equal(ask("pos", "fullscreen", "not a url"), false);
  assert.equal(ask("pos", "fullscreen", ""), false);
  assert.equal(permissionDecision({ kind: "pos", permission: "fullscreen", requestingUrl: undefined, trustedOrigins: trusted }), false);
});

test("the requesting page may be given as an origin or a full address", () => {
  assert.equal(ask("pos", "fullscreen", "https://pos.jawa.example"), true);
});

test("only POS's own pages may remember a serial port", () => {
  const device = (kind, deviceType, origin) => devicePermissionDecision({ kind, deviceType, origin, trustedOrigins: trusted });
  assert.equal(device("pos", "serial", "https://pos.jawa.example"), true);
  assert.equal(device("pos", "serial", "https://attacker.example"), false);
  assert.equal(device("food", "serial", "https://pos.jawa.example"), false);
  assert.equal(device("pos", "usb", "https://pos.jawa.example"), false);
  assert.equal(device("pos", "hid", "https://pos.jawa.example"), false);
});
