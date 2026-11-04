# JAWA desktop apps

Downloadable desktop apps for **JAWA POS** (businesses) and **JAWA.FOOD**
(customers), for macOS and Windows. **JAWA.SITE stays a website** and has no app.

Each app is its own window onto its live site: the same pages, accounts and data
as the browser, under its own name, icon and Dock or taskbar entry. Nothing about
the sites is copied into the app, so every change to POS or FOOD reaches the apps
the moment it is deployed, with no app update needed.

## What is in the download

Only this shell: about a dozen small JavaScript files (window, menus and the rules
below), the app's icon and its two public site addresses. **No Rails code,
database, settings, keys or secrets from JAWA.POS, JAWA.FOOD or JAWA.SITE are
included**, and none must ever be added: anyone can unpack a desktop app and read
it. People see exactly what a browser shows them today. Package tests check the
file list and scan it for secret-looking values on every build.

## How it behaves

| Situation | What the app does |
| --- | --- |
| The app's own site (and, for FOOD, the JAWA ID sign-in pages on POS) | Opens in the app |
| Any other website, including JAWA.SITE and the other app's site | Opens in the person's default browser |
| Email and phone links | Open in the person's mail or phone app |
| Scripts, local files, embedded documents, other apps' links, `<webview>` | Never load or open |
| A new window for the app's own page (for example *Manage business* from the till) | Another app window, signed in |
| A page asking for camera, microphone, location or notifications | Refused without asking |
| POS's USB or Bluetooth caller-ID adapter | Allowed for POS's own pages; the app asks which adapter to use |
| The site can't be reached | A clear "can't connect" page that retries by itself. POS's own service worker still reopens the till offline |
| The certificate is wrong | Stops, explains, and doesn't retry by itself |
| Opening the app again | Focuses the open window |

The app remembers its window position and size, signs in once per computer
(cookies persist across restarts, with POS's normal 12-hour sessions), offers
browser-style menus, keyboard shortcuts and right-click actions, and follows the
system's light or dark appearance before the page loads.

### Signing in

Password sign-in works in the app as on the web. Because Google and Apple refuse
embedded app windows, and the browser holds people's saved passwords, the sign-in
page inside the app leads with **Sign in with your browser**:

1. The app opens the person's browser at a one-time JAWA ID link.
2. They sign in there as usual (password, two-step, Google or Apple) and confirm
   *Open JAWA POS on this computer?*
3. The browser opens the app through its `jawa-pos://` or `jawa-food://` link with
   a one-time code, and the app finishes signing in.

The code only works together with a secret kept by the app window that started,
so a link or code that reaches anyone else is useless. POS implements the server
side; see JAWA.POS `docs/desktop-sign-in.md`.

## Develop

Needs Node 22 and the local JAWA ecosystem (POS on port 3000, FOOD on 3001; see
JAWA.POS `docs/local-ecosystem.md`).

```sh
npm install
npm run start:pos     # JAWA POS against http://localhost:3000
npm run start:food    # JAWA.FOOD against http://localhost:3001 (JAWA ID on :3000)
```

Development-only settings, ignored by a shipped app: `JAWA_APP` (`pos` or
`food`), `JAWA_POS_ORIGIN` and `JAWA_FOOD_ORIGIN` (local HTTP, or any HTTPS),
`JAWA_USER_DATA_DIR` (an absolute path for a throwaway profile),
`JAWA_SHOW_WINDOWS=0` (tests) and `JAWA_REGISTER_PROTOCOL=1` (make this
development copy handle `jawa-*` links; off by default, because it changes this
computer's settings).

## Test

```sh
npm test               # rules: links, permissions, settings, menus, offline page, sign-in links, build config
npm run test:e2e       # the real Electron app against a fake site, windows hidden
npm run test:package   # inspects a built app (build it first; see below)
```

`npx playwright test --config playwright.live.config.js` drives the real app,
and a separate Chrome as the person's browser, against locally running POS and
FOOD with fictional accounts. See [verification](docs/verification.md) for setup.

## Build installers

```sh
JAWA_POS_ORIGIN=https://<pos host> JAWA_FOOD_ORIGIN=https://<food host> npm run dist -- pos
JAWA_POS_ORIGIN=https://<pos host> JAWA_FOOD_ORIGIN=https://<food host> npm run dist -- food --win
```

macOS builds a universal `.dmg` and `.zip`; `--win` builds one installer for
Windows x64 and ARM. `--dir` stops at the unpacked app and `--unsigned` skips
macOS signing, for local checks. Both origins must be HTTPS. They are baked into
the app and cannot be changed by flags or environment variables later.

Every build turns on Electron's security fuses: no Node mode, no `NODE_OPTIONS`,
no debugging flags, encrypted cookies, and only the signed app archive can load.

### Before the first public release

- **Production addresses** of POS and FOOD (not yet recorded in any repository).
- **Bundle identifiers** `com.jawa.pos` and `com.jawa.food`: confirm or change
  them before release, because changing them later makes a different app.
- **Signing.** macOS needs an Apple Developer ID certificate and notarisation
  (electron-builder's `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`,
  `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, set privately on the build
  machine). Windows needs a code-signing certificate, or SmartScreen will warn.
  Unsigned builds are for testing only.
- **Where people download them**, and whether to add automatic app updates.
  The sites update themselves; the shell rarely changes, but security updates
  to Electron still need shipping.
- Check sign-in, the till, printing and caller ID on real Macs and Windows PCs.

## Layout

| Path | Contents |
| --- | --- |
| `src/main.js`, `src/desktop-app.js` | Start-up and the Electron wiring |
| `src/apps.js`, `src/runtime-config.js` | The two apps and where they point |
| `src/navigation-policy.js`, `src/permissions.js` | What may load, open or be used |
| `src/sign-in-link.js` | The `jawa-*://sign-in` hand-back |
| `src/menu.js`, `src/context-menu.js`, `src/window-state.js`, `src/offline-page.js`, `src/serial-ports.js`, `src/user-agent.js`, `src/strings.js`, `src/locales/` | Window, menus and text |
| `scripts/` | Build configuration (not shipped) |
| `apps/<app>/icon.png` | Icons, from each site's `public/icon.png` |
| `test/unit`, `test/e2e`, `test/package`, `test/live` | Tests |
