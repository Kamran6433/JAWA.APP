import { test } from "node:test";
import assert from "node:assert/strict";
import { buildContextMenuTemplate } from "../../src/context-menu.js";
import { translator } from "../../src/strings.js";

const t = translator("en");
const allowed = { canUndo: true, canRedo: true, canCut: true, canCopy: true, canPaste: true, canDelete: true, canSelectAll: true };
const none = { canUndo: false, canRedo: false, canCut: false, canCopy: false, canPaste: false, canDelete: false, canSelectAll: false };
const params = (overrides) => ({ isEditable: false, selectionText: "", linkURL: "", misspelledWord: "", dictionarySuggestions: [], editFlags: none, ...overrides });
const build = (overrides, actions = {}) => buildContextMenuTemplate(params(overrides), {
  t, onReplaceMisspelling: () => {}, onCopyLink: () => {}, onOpenLink: () => {}, ...actions,
});
const visible = (template) => template.filter((item) => item.type !== "separator");

test("a text field offers cut, copy, paste and select all", () => {
  const template = build({ isEditable: true, editFlags: allowed });
  assert.deepEqual(visible(template).map((item) => item.role), [ "cut", "copy", "paste", "selectAll" ]);
  assert.ok(visible(template).every((item) => item.enabled));
});

test("unavailable editing actions are greyed out", () => {
  const template = build({ isEditable: true, editFlags: { ...none, canPaste: true } });
  assert.deepEqual(visible(template).map((item) => [ item.role, item.enabled ]), [ [ "cut", false ], [ "copy", false ], [ "paste", true ], [ "selectAll", false ] ]);
});

test("selected page text can be copied", () => {
  assert.deepEqual(visible(build({ selectionText: "Onion Bhaji", editFlags: { ...none, canCopy: true } })).map((item) => item.role), [ "copy" ]);
});

test("a misspelt word offers at most five suggestions first", () => {
  const replaced = [];
  const template = build(
    { isEditable: true, misspelledWord: "curyy", dictionarySuggestions: [ "curry", "cury", "curly", "curvy", "currys", "curia" ], editFlags: allowed },
    { onReplaceMisspelling: (word) => replaced.push(word) },
  );
  const suggestions = template.slice(0, 5);
  assert.deepEqual(suggestions.map((item) => item.label), [ "curry", "cury", "curly", "curvy", "currys" ]);
  suggestions[0].click();
  assert.deepEqual(replaced, [ "curry" ]);
  assert.equal(template[5].type, "separator");
});

test("a misspelt word without suggestions says so", () => {
  const template = build({ isEditable: true, misspelledWord: "zzqx", editFlags: allowed });
  assert.equal(template[0].label, t("context.no_suggestions"));
  assert.equal(template[0].enabled, false);
});

test("a web link can be copied or opened in the browser", () => {
  const actions = [];
  const template = build({ linkURL: "https://food.jawa.example/b/12" }, {
    onCopyLink: (url) => actions.push([ "copy", url ]), onOpenLink: (url) => actions.push([ "open", url ]),
  });
  assert.deepEqual(visible(template).map((item) => item.label), [ t("context.open_link"), t("context.copy_link") ]);
  for (const item of visible(template)) item.click();
  assert.deepEqual(actions, [ [ "open", "https://food.jawa.example/b/12" ], [ "copy", "https://food.jawa.example/b/12" ] ]);
});

test("script and file links can be copied but never opened", () => {
  for (const linkURL of [ "javascript:alert(1)", "file:///etc/passwd", "jawa-pos://sign-in?code=x" ]) {
    assert.deepEqual(visible(build({ linkURL })).map((item) => item.label), [ t("context.copy_link") ], linkURL);
  }
});

test("nothing to act on means no menu", () => {
  assert.deepEqual(build({}), []);
});

test("menus never start or end with a separator", () => {
  const template = build({ isEditable: true, misspelledWord: "curyy", dictionarySuggestions: [ "curry" ], linkURL: "https://example.org", editFlags: allowed });
  assert.notEqual(template[0].type, "separator");
  assert.notEqual(template.at(-1).type, "separator");
  assert.ok(template.every((item, index) => !(item.type === "separator" && template[index + 1]?.type === "separator")));
});
