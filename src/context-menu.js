// The right-click menu Electron leaves out: spelling suggestions, link
// actions and the usual editing commands, grouped like a browser's.

const EDIT_FLAGS = Object.freeze({ cut: "canCut", copy: "canCopy", paste: "canPaste", selectAll: "canSelectAll" });
const MAX_SUGGESTIONS = 5;

export function buildContextMenuTemplate(params, { t, onReplaceMisspelling, onCopyLink, onOpenLink }) {
  const flags = params.editFlags ?? {};
  const groups = [];

  if (params.isEditable && params.misspelledWord) {
    const suggestions = (params.dictionarySuggestions ?? []).slice(0, MAX_SUGGESTIONS);
    groups.push(suggestions.length
      ? suggestions.map((word) => ({ label: word, click: () => onReplaceMisspelling(word) }))
      : [ { label: t("context.no_suggestions"), enabled: false } ]);
  }

  if (params.linkURL) {
    const link = params.linkURL;
    groups.push([
      ...(isWebLink(link) ? [ { label: t("context.open_link"), click: () => onOpenLink(link) } ] : []),
      { label: t("context.copy_link"), click: () => onCopyLink(link) },
    ]);
  }

  if (params.isEditable) {
    groups.push(Object.entries(EDIT_FLAGS).map(([ role, flag ]) => ({ role, enabled: flags[flag] === true })));
  } else if (params.selectionText?.trim()) {
    groups.push([ { role: "copy", enabled: flags.canCopy === true } ]);
  }

  return groups.flatMap((group, index) => (index === 0 ? group : [ { type: "separator" }, ...group ]));
}

function isWebLink(address) {
  try {
    const url = new URL(address);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
  } catch {
    return false;
  }
}
