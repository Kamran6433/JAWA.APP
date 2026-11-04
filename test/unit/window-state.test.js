import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SIZE, MINIMUM_SIZE, parseWindowState, restoreBounds, serializeWindowState } from "../../src/window-state.js";

const laptop = { workArea: { x: 0, y: 25, width: 1440, height: 875 } };
const monitor = { workArea: { x: 1440, y: 0, width: 2560, height: 1415 } };

test("a first launch opens a comfortable window centred on the main screen", () => {
  const bounds = restoreBounds(null, [ laptop, monitor ]);
  assert.deepEqual(bounds, { x: 120, y: 62, width: DEFAULT_SIZE.width, height: DEFAULT_SIZE.height, maximized: false });
});

test("the window reopens where it was, including on a second screen", () => {
  const saved = { x: 1600, y: 100, width: 1400, height: 1000, maximized: true };
  assert.deepEqual(restoreBounds(saved, [ laptop, monitor ]), saved);
});

test("a window left on a screen that has gone comes back centred", () => {
  const saved = { x: 1600, y: 100, width: 1000, height: 700, maximized: false };
  assert.deepEqual(restoreBounds(saved, [ laptop ]), { x: 220, y: 112, width: 1000, height: 700, maximized: false });
});

test("a window barely on screen is moved fully into view", () => {
  const saved = { x: 1400, y: 800, width: 1000, height: 700, maximized: false };
  assert.deepEqual(restoreBounds(saved, [ laptop ]), { x: 440, y: 200, width: 1000, height: 700, maximized: false });
});

test("a window bigger than the screen shrinks to fit it", () => {
  const saved = { x: 0, y: 25, width: 5000, height: 3000, maximized: false };
  assert.deepEqual(restoreBounds(saved, [ laptop ]), { x: 0, y: 25, width: 1440, height: 875, maximized: false });
});

test("a tiny window grows to the minimum usable size", () => {
  const saved = { x: 100, y: 100, width: 50, height: 40, maximized: false };
  const bounds = restoreBounds(saved, [ laptop ]);
  assert.equal(bounds.width, MINIMUM_SIZE.width);
  assert.equal(bounds.height, MINIMUM_SIZE.height);
});

test("damaged saved values are ignored", () => {
  for (const saved of [
    { x: "10", y: 10, width: 800, height: 600 },
    { x: 10, y: 10, width: Number.NaN, height: 600 },
    { x: 10, y: 10, width: 800, height: Infinity },
    { x: 10, y: 10, width: -800, height: 600 },
    [],
    "x",
  ]) {
    assert.deepEqual(restoreBounds(saved, [ laptop ]), restoreBounds(null, [ laptop ]), JSON.stringify(saved));
  }
});

test("without any screen information the default size is used", () => {
  assert.deepEqual(restoreBounds(null, []), { width: DEFAULT_SIZE.width, height: DEFAULT_SIZE.height, maximized: false });
});

test("saved state survives a round trip and junk text is rejected", () => {
  const state = { x: 10, y: 20, width: 900, height: 700, maximized: true };
  assert.deepEqual(parseWindowState(serializeWindowState(state)), state);
  assert.equal(parseWindowState("{not json"), null);
  assert.equal(parseWindowState(""), null);
  assert.equal(parseWindowState("null"), null);
  assert.equal(parseWindowState(JSON.stringify({ x: 1, y: 2, width: 3, height: 4, maximized: "yes", extra: "<script>" })).maximized, false);
  assert.equal("extra" in parseWindowState(JSON.stringify({ x: 1, y: 2, width: 3, height: 4, extra: 1 })), false);
});
