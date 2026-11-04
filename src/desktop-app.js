import { BrowserWindow, Menu, app, clipboard, dialog, nativeTheme, screen, session, shell } from "electron";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildContextMenuTemplate } from "./context-menu.js";
import { buildMenuTemplate } from "./menu.js";
import { externalUrl, navigationDecision, windowOpenDecision } from "./navigation-policy.js";
import { loadFailure, offlinePageUrl, renderOfflinePage } from "./offline-page.js";
import { devicePermissionDecision, permissionDecision } from "./permissions.js";
import { chosenPortId, serialPortChoices } from "./serial-ports.js";
import { SIGN_IN_COMPLETION_PATH, findSignInLink, parseSignInLink, signInCompletionRequest } from "./sign-in-link.js";
import { translator } from "./strings.js";
import { desktopUserAgent } from "./user-agent.js";
import { MINIMUM_SIZE, parseWindowState, restoreBounds, serializeWindowState } from "./window-state.js";

// Connects the tested rules in the other modules to Electron. Pages get no
// preload script and no bridge into the app: they are ordinary web pages in
// a locked-down browser window.

export function startDesktopApp(config) {
  const definition = config.app;
  const t = translator("en");
  let mainWindow = null;
  let pendingSignIn = findSignInLink(process.argv, definition.scheme);

  app.setName(definition.name);
  app.setPath("userData", config.userDataDirectory ?? join(app.getPath("appData"), definition.name));
  app.enableSandbox();
  // Service workers use the app-wide default rather than the session's agent,
  // and POS's worker fetches page loads, so set both.
  app.userAgentFallback = desktopUserAgent(app.userAgentFallback, { version: app.getVersion(), kind: config.kind });
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  const windowPreferences = Object.freeze({
    partition: definition.partition,
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false,
    nodeIntegrationInSubFrames: false,
    nodeIntegrationInWorker: false,
    webviewTag: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
    experimentalFeatures: false,
    navigateOnDragDrop: false,
    safeDialogs: true,
    spellcheck: true,
    devTools: config.environment === "development",
  });
  const windowOptions = () => ({
    minWidth: MINIMUM_SIZE.width,
    minHeight: MINIMUM_SIZE.height,
    show: false,
    title: definition.name,
    backgroundColor: nativeTheme.shouldUseDarkColors ? definition.background.dark : definition.background.light,
    autoHideMenuBar: false,
    webPreferences: windowPreferences,
  });

  // Sign-in links: on macOS they arrive as open-url (possibly before the app
  // is ready); on Windows and Linux as the arguments of a second launch.
  app.on("open-url", (event, link) => {
    event.preventDefault();
    const signIn = parseSignInLink(link, definition.scheme);
    if (signIn) completeSignIn(signIn);
  });
  app.on("second-instance", (_event, argv) => {
    const signIn = findSignInLink(argv, definition.scheme);
    if (signIn) completeSignIn(signIn);
    else if (app.isReady()) focus(mainWindow ?? createMainWindow());
  });

  app.on("web-contents-created", (_event, contents) => guard(contents));
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("activate", () => {
    if (app.isReady() && !mainWindow) createMainWindow();
  });

  app.whenReady().then(() => {
    if (!config.showWindows) app.dock?.hide();
    if (config.registerProtocol) registerLinkScheme();
    configureSession(session.fromPartition(definition.partition));
    Menu.setApplicationMenu(Menu.buildFromTemplate(buildMenuTemplate({
      platform: process.platform,
      appName: definition.name,
      isDevelopment: config.environment === "development",
      t,
      onHome: () => activeContents()?.loadURL(config.homeUrl),
      onBack: () => activeContents()?.navigationHistory.goBack(),
      onForward: () => activeContents()?.navigationHistory.goForward(),
    })));
    createMainWindow();
  });

  function createMainWindow() {
    const stateFile = join(app.getPath("userData"), "window-state.json");
    const bounds = restoreBounds(readWindowState(stateFile), screen.getAllDisplays());
    const { maximized, ...position } = bounds;
    const window = new BrowserWindow({ ...windowOptions(), ...position });
    mainWindow = window;
    window.on("close", () => saveWindowState(stateFile, window));
    window.on("closed", () => {
      if (mainWindow === window) mainWindow = null;
    });
    reveal(window, maximized);

    const signIn = pendingSignIn;
    pendingSignIn = null;
    if (signIn) loadSignInCompletion(window, signIn);
    else window.loadURL(config.homeUrl);
    return window;
  }

  function completeSignIn(signIn) {
    if (!app.isReady() || !mainWindow) {
      pendingSignIn = signIn; // the main window picks it up when it opens
      if (app.isReady()) focus(createMainWindow());
      return;
    }
    loadSignInCompletion(mainWindow, signIn);
    focus(mainWindow);
  }

  function loadSignInCompletion(window, { code }) {
    const { url, options } = signInCompletionRequest(config.identityOrigin, code);
    window.loadURL(url, options);
  }

  function configureSession(target) {
    target.setUserAgent(app.userAgentFallback);
    const decide = (permission, requestingUrl) => permissionDecision({ kind: config.kind, permission, requestingUrl, trustedOrigins: config.trustedOrigins });
    target.setPermissionRequestHandler((contents, permission, callback, details) => callback(decide(permission, details.requestingUrl ?? contents.getURL())));
    target.setPermissionCheckHandler((_contents, permission, requestingOrigin) => decide(permission, requestingOrigin));
    target.setDevicePermissionHandler((details) => devicePermissionDecision({
      kind: config.kind, deviceType: details.deviceType, origin: details.origin, trustedOrigins: config.trustedOrigins,
    }));
    target.on("select-serial-port", (event, portList, contents, callback) => {
      event.preventDefault();
      if (!decide("serial", contents.getURL())) return callback("");
      const choices = serialPortChoices(portList, t);
      const owner = BrowserWindow.fromWebContents(contents);
      const options = { type: "question", title: choices.title, message: choices.message, buttons: choices.buttons, cancelId: choices.cancelId, defaultId: 0, noLink: true };
      (owner ? dialog.showMessageBox(owner, options) : dialog.showMessageBox(options))
        .then(({ response }) => callback(chosenPortId(response, choices)), () => callback(""));
    });
  }

  // Every page, pop-up and frame goes through the same rules.
  function guard(contents) {
    const route = (event, url) => {
      const decision = navigationDecision(url, config.trustedOrigins);
      if (decision === "allow") return;
      event.preventDefault();
      if (decision === "external") openInBrowser(url);
    };
    contents.on("will-navigate", (event) => route(event, event.url));
    contents.on("will-redirect", (event) => route(event, event.url));
    contents.on("will-frame-navigate", (event) => {
      if (!event.isMainFrame && navigationDecision(event.url, config.trustedOrigins) !== "allow") event.preventDefault();
    });
    contents.on("will-attach-webview", (event) => event.preventDefault());
    contents.setWindowOpenHandler(({ url, frameName }) => {
      const decision = windowOpenDecision({ url, frameName }, config.trustedOrigins);
      if (decision === "window") return { action: "allow", overrideBrowserWindowOptions: windowOptions() };
      if (decision === "external") openInBrowser(url);
      return { action: "deny" };
    });
    contents.on("did-create-window", (window) => reveal(window, false));
    contents.on("did-fail-load", (_event, errorCode, _description, url, isMainFrame) => {
      const failure = loadFailure({ errorCode, isMainFrame, url, trustedOrigins: config.trustedOrigins });
      if (!failure) return;
      // A failed sign-in hand-over can't be repeated by address; start again from home.
      const retryUrl = new URL(url).pathname === SIGN_IN_COMPLETION_PATH ? config.homeUrl : url;
      const theme = nativeTheme.shouldUseDarkColors ? "dark" : "light";
      contents.loadURL(offlinePageUrl(renderOfflinePage({ appName: definition.name, retryUrl, failure, theme, t })));
    });
    contents.on("context-menu", (_event, params) => {
      const template = buildContextMenuTemplate(params, {
        t,
        onReplaceMisspelling: (word) => contents.replaceMisspelling(word),
        onCopyLink: (url) => clipboard.writeText(url),
        onOpenLink: (url) => openInBrowser(url),
      });
      if (template.length) Menu.buildFromTemplate(template).popup({ window: BrowserWindow.fromWebContents(contents) ?? undefined });
    });
  }

  function openInBrowser(url) {
    const target = externalUrl(url);
    if (target) shell.openExternal(target).catch(() => {});
  }

  function reveal(window, maximized) {
    if (!config.showWindows) return;
    let shown = false;
    const show = () => {
      if (shown || window.isDestroyed()) return;
      shown = true;
      if (maximized) window.maximize();
      window.show();
    };
    window.once("ready-to-show", show);
    setTimeout(show, 3000);
  }

  function focus(window) {
    if (window.isMinimized()) window.restore();
    if (config.showWindows) window.show();
    window.focus();
  }

  function activeContents() {
    return (BrowserWindow.getFocusedWindow() ?? mainWindow)?.webContents ?? null;
  }

  function registerLinkScheme() {
    if (app.isPackaged) app.setAsDefaultProtocolClient(definition.scheme);
    else app.setAsDefaultProtocolClient(definition.scheme, process.execPath, [ app.getAppPath() ]);
  }
}

function readWindowState(file) {
  try {
    return parseWindowState(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function saveWindowState(file, window) {
  try {
    writeFileSync(file, serializeWindowState({ ...window.getNormalBounds(), maximized: window.isMaximized() }));
  } catch {
    // Losing the window position is harmless.
  }
}
