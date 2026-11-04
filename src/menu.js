// The application menu: the same editing, zoom and history shortcuts people
// already use in their browser, with developer tools only while developing.

const separator = { type: "separator" };

export function buildMenuTemplate({ platform, appName, isDevelopment, t, onHome, onBack, onForward }) {
  const mac = platform === "darwin";
  const shortcut = mac
    ? { back: "Cmd+[", forward: "Cmd+]", home: "Cmd+Shift+H" }
    : { back: "Alt+Left", forward: "Alt+Right", home: "Alt+Home" };

  const appMenu = mac
    ? { label: appName, submenu: [ { role: "about", label: t("menu.about", { app: appName }) }, separator, { role: "services" }, separator, { role: "hide" }, { role: "hideOthers" }, { role: "unhide" }, separator, { role: "quit" } ] }
    : { label: t("menu.file"), submenu: [ { role: "quit" } ] };

  return [
    appMenu,
    { label: t("menu.edit"), submenu: [ { role: "undo" }, { role: "redo" }, separator, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "pasteAndMatchStyle" }, { role: "delete" }, { role: "selectAll" } ] },
    { label: t("menu.view"), submenu: [
      { role: "reload" },
      ...(isDevelopment ? [ { role: "forceReload" }, { role: "toggleDevTools" } ] : []),
      separator, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, separator, { role: "togglefullscreen" },
    ] },
    { label: t("menu.history"), submenu: [
      { id: "back", label: t("menu.back"), accelerator: shortcut.back, click: () => onBack() },
      { id: "forward", label: t("menu.forward"), accelerator: shortcut.forward, click: () => onForward() },
      { id: "home", label: t("menu.home"), accelerator: shortcut.home, click: () => onHome() },
    ] },
    { role: "windowMenu", label: t("menu.window") },
  ];
}
