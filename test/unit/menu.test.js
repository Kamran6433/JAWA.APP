import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMenuTemplate } from "../../src/menu.js";
import { translator } from "../../src/strings.js";

const t = translator("en");
const noop = () => {};
const build = (overrides = {}) => buildMenuTemplate({
  platform: "darwin", appName: "JAWA MENU", isDevelopment: false, t,
  onHome: noop, onBack: noop, onForward: noop, ...overrides,
});

const flatten = (items) => items.flatMap((item) => [ item, ...(Array.isArray(item.submenu) ? flatten(item.submenu) : []) ]);
const roles = (items) => flatten(items).map((item) => item.role).filter(Boolean);
const menu = (template, label) => template.find((item) => item.label === label);

test("on a Mac the first menu is the app's own, named after it", () => {
  const template = build();
  assert.equal(template[0].label, "JAWA MENU");
  assert.deepEqual(template[0].submenu.map((item) => item.role ?? item.type), [ "about", "separator", "services", "separator", "hide", "hideOthers", "unhide", "separator", "quit" ]);
});

test("on Windows there is no Mac app menu and File offers Exit", () => {
  const template = build({ platform: "win32" });
  assert.notEqual(template[0].label, "JAWA MENU");
  assert.deepEqual(menu(template, "File").submenu.map((item) => item.role), [ "quit" ]);
  assert.ok(!roles(template).includes("services"));
});

test("editing shortcuts behave as they do in a browser", () => {
  const edit = menu(build(), "Edit").submenu.map((item) => item.role).filter(Boolean);
  assert.deepEqual(edit, [ "undo", "redo", "cut", "copy", "paste", "pasteAndMatchStyle", "delete", "selectAll" ]);
});

test("View offers reload, zoom and full screen but no developer tools in a release", () => {
  const view = roles([ menu(build(), "View") ]);
  for (const role of [ "reload", "resetZoom", "zoomIn", "zoomOut", "togglefullscreen" ]) assert.ok(view.includes(role), role);
  assert.ok(!view.includes("toggleDevTools"));
  assert.ok(!view.includes("forceReload"));
});

test("developer tools appear only while developing", () => {
  assert.ok(roles([ menu(build({ isDevelopment: true }), "View") ]).includes("toggleDevTools"));
});

test("History moves back, forward and home with the usual shortcuts", () => {
  const calls = [];
  const template = build({ onHome: () => calls.push("home"), onBack: () => calls.push("back"), onForward: () => calls.push("forward") });
  const history = menu(template, "History").submenu;
  assert.deepEqual(history.map((item) => [ item.id, item.accelerator ]), [
    [ "back", "Cmd+[" ], [ "forward", "Cmd+]" ], [ "home", "Cmd+Shift+H" ],
  ]);
  for (const item of history) item.click();
  assert.deepEqual(calls, [ "back", "forward", "home" ]);
});

test("on Windows History uses the browser's Alt shortcuts", () => {
  const history = menu(build({ platform: "win32" }), "History").submenu;
  assert.deepEqual(history.map((item) => item.accelerator), [ "Alt+Left", "Alt+Right", "Alt+Home" ]);
});

test("every item with an action calls one the app supplies, so none can fail", () => {
  for (const platform of [ "darwin", "win32" ]) {
    for (const item of flatten(build({ platform }))) if (item.click) assert.doesNotThrow(() => item.click(), item.label);
  }
});

test("there is no Help menu until JAWA has help pages to open", () => {
  assert.equal(build().find((item) => item.role === "help"), undefined);
});

test("every visible label is translated text", () => {
  const labels = flatten(build()).map((item) => item.label).filter(Boolean);
  assert.ok(labels.includes(t("menu.history")));
  assert.ok(labels.every((label) => !label.includes("menu.")));
});
