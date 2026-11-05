# Verification record

## First release, v0.1.1, and the publish step (4 November 2026)

The `v0.1.1` run built both installers (macOS waited about five minutes for a
runner, because GitHub's macOS arm64 runners were short of capacity), but its
publish step found no files: since the uploads became exact `dist/pos/...` paths,
the artifacts hold the installers without a folder, so `installers/*/JAWA-*`
matched nothing. The release was published by hand from that run's artifacts
(digests checked by `gh run download`), with the workflow's own command. The
mounted `JAWA-POS-mac.dmg` holds a universal (x86_64, arm64) `JAWA POS.app`,
version 0.1.1, ad-hoc signed, whose manifest is
`{"kind":"pos","origins":{"pos":"https://jawa.menu"}}`; the `.exe` is an NSIS
installer. The publish step now names the three files and fails clearly if one
is missing; a local run of that shell logic found all three and failed when one
was removed.

## Windows-safe test paths, version 0.1.1 (4 November 2026)

The first release run (`v0.1.0`) failed on the Windows runner before building:
`test/unit/strings.test.js` turned a file URL into a path with `.pathname`, which
on Windows gives `/D:/...` and an impossible `D:\D:\...` folder. All three such
paths now use `fileURLToPath`, and `test.yml` runs the unit tests on Windows too.
The end-to-end checks read the app version from `package.json` instead of
`0.1.0`, and the version is now 0.1.1 (the `v0.1.0` tag has no release).

| Check | Result |
| --- | --- |
| `npm test` | **96 tests**, 0 failures |
| `npm run test:e2e` | **33 tests**, 0 failures (3 failed at 0.1.1 before they read the version) |
| `npm run test:package` (existing POS build) | 5 passed, 1 skipped |
| `fileURLToPath` on the CI path, Windows rules | `D:\a\JAWA.APP\JAWA.APP\src\` |

## Release JAWA POS only (4 November 2026)

On `claude/release-pos-only`. A shipped app now needs only the origins it uses
(POS its own; FOOD its own and POS), and the release workflow builds and publishes
JAWA POS alone. The two new unit tests failed first (a POS build demanded FOOD).

| Check | Result |
| --- | --- |
| `npm test` | **96 tests**, 0 failures |
| `npm run test:e2e` | **33 tests**, 0 failures |
| `JAWA_POS_ORIGIN=https://jawa.menu node scripts/build.js pos --dir --unsigned`, no FOOD origin set | Built; manifest `{"kind":"pos","origins":{"pos":"https://jawa.menu"}}` |
| `npm run test:package` on that build | 5 passed, 1 skipped (launch check needs `JAWA_PACKAGE_LAUNCH=1`) |

The Windows installer and the release itself were not built locally; the
release workflow builds them on GitHub runners.

## First version: JAWA POS and JAWA.FOOD desktop apps (4 November 2026)

Node 22.23.3, Electron 44.10.0, electron-builder 26.17.0, Playwright 1.64.1, on
macOS (Apple silicon). All tests used fictional data. Nothing was signed,
published or deployed.

| Check | Result |
| --- | --- |
| `npm test` (rules, settings, menus, text, offline page, sign-in links, build config) | **94 tests**, 0 failures |
| `npm run test:e2e` (real Electron against a fake site, windows hidden) | **33 tests**, 0 failures; three consecutive full runs |
| `npm run test:package` on built POS and FOOD apps | POS **6/6** including the launch check; FOOD 5/5 (launch check skipped) |
| Live: real app and a separate Chrome against local POS (`test/live/pos-sign-in.spec.js`) | **2/2** |
| Live: real FOOD app against local FOOD (`test/live/food-browse.spec.js`) | **1/1** |
| Installers | `JAWA POS-0.1.0-universal.dmg` and `.zip`; `JAWA POS Setup 0.1.0.exe` (x64 and ARM) built from fictional `.invalid` origins |
| `npm audit --omit=dev` | 0 vulnerabilities (nothing is shipped from npm) |

### Test first

- **Security rules.** Stubs copying Electron's defaults (allow every navigation,
  grant every permission, trust any link carrying a code, read settings from the
  environment) failed **23 of 29** navigation, permission, sign-in-link and
  settings tests. The six that passed are cases where the defaults happen to be
  right, such as keeping the app's own pages in the app.
- **SITE removed.** After the product owner said JAWA.SITE stays website-only,
  the updated app and settings tests failed 9 of 17 before the definitions changed.
- **Service worker.** The first live run showed POS's waiting page treating the
  app as an ordinary browser. POS's service worker fetches page loads, and
  Electron gives worker requests the app-wide default user agent, not the
  session's. A new fake-site worker test reproduced it (`JAWAPOS/0.1.0 … Electron/44.10.0`
  with no `JAWADesktop` token); setting `app.userAgentFallback` fixed it.
- **Installer architectures** (universal macOS; Windows x64 and ARM): 1 build
  configuration test failed first. The rest of the build configuration was
  written together with its tests rather than strictly red-first.
- **Help menu.** A review found the Help menu calling an action the app never
  supplied. A test that clicks every menu action failed first; there are no help
  pages yet, so the item was removed.
- **Test harness, not app, failures** were fixed in the tests and are recorded
  here rather than hidden. Playwright's click waits for a navigation that the app
  deliberately cancels, so clicks that leave the app use `noWaitAfter`, and the
  page is then read directly. `getLastWebPreferences()` does not report
  `partition`, so tests compare sessions instead. One permission test passed
  `undefined`, which picked up the helper's default page.

### Packaged app

`npm run test:package` reads the built app:

- The archive holds only `package.json` and `src/**/*.js`: no tests, scripts,
  icons source, `node_modules` or environment files.
- The manifest carries only the app kind and the two HTTPS origins. A scan for
  private keys, client secrets, encryption keys, Stripe, Resend, AWS and database
  URLs found none.
- `Info.plist` registers `com.jawa.pos` and the `jawa-pos` scheme.
- Fuses: Node mode, `NODE_OPTIONS` and debugging flags off; cookie encryption,
  archive integrity and archive-only loading on. A control on plain development
  Electron reads Node mode and debugging on, so the check discriminates. The
  Windows build reads the same fuses.
- Launched with `ELECTRON_RUN_AS_NODE=1`, `NODE_OPTIONS`, `--inspect=0`, another
  `JAWA_APP` and a `JAWA_POS_ORIGIN` pointing at a fake server, the app started
  as itself, printed nothing from Node, and made **no request** to the fake
  server. The profile folder this launch created was removed afterwards.

### Live checks

POS ran on port 4100 against a throwaway database (`jawa_pos_desktop_check`)
holding one fictional business, owner and till login, created from structure
with a generated password that was never printed. FOOD ran on port 4101 against
its existing development database, read-only. Both servers were stopped after.

- **Sign in with your browser:** in the app, the button opened the browser link;
  a separate headless Chrome signed in with the password, saw *Open JAWA POS on
  this computer?* with the account's email, and returned a `jawa-pos://` link.
  Delivering it to the app opened the business list as that owner. Delivering the
  same link again returned the app to sign-in.
- **Password in the app:** signed in, then stayed signed in after restarting the
  app on the same profile.
- **FOOD:** opened FOOD's live home page under its own user agent; JAWA.SITE's
  address went to the browser and the window stayed on FOOD.

### Dependencies

Electron 44.9.0 had a high-severity advisory (GHSA-jr5w-w6x2-84p9); the app
uses **44.10.0**, the oldest fixed 44.x. `npm audit` still lists moderate
advisories in electron-builder's own build-time dependencies (`glob`,
`minimatch` and the packages that use them). They run only on the build machine
and are not shipped. Re-check before each release.

### Release files and workflows

Installers now keep fixed names so the POS and FOOD landing pages can link to
the latest release. The build configuration test failed first, then passed; a
local FOOD build produced `JAWA-FOOD-mac.dmg`, `JAWA-FOOD-mac.zip` and
`JAWA-FOOD-windows.exe`. `.github/workflows/test.yml` and `release.yml` parse as
YAML; GitHub-provided actions are pinned to commits (checkout v7.0.1,
setup-node v7.1.0, upload-artifact v7.0.2, download-artifact v8.0.2). The
workflows have not run yet: the first push runs the tests, and the release
workflow waits for a version tag and the two origin variables.

### First GitHub run

The first `test.yml` run on GitHub failed two permission tests: macOS runners
have no camera, so the camera request reported "no camera found" before any
permission was asked. The test now also reads the permission state of camera,
microphone, location and notifications, which must all be "denied", and accepts
either camera error but never a granted camera. Briefly allowing camera and
notifications in the rules made it fail, so it still checks them.

### Not checked

Real Google and Apple sign-in, signed and notarised builds, installing from the
`.dmg` and `.exe` on clean Macs and Windows PCs, Windows itself (the Windows
build was only produced and inspected from macOS), `jawa-*` link registration by
the installed app, receipt printing through QZ Tray and the caller-ID chooser
with real hardware, screen readers, and automatic updates (not built).
