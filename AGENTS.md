# Agent guidance

Desktop shells for JAWA POS and JAWA.FOOD only; JAWA.SITE has no app. Read the
README first. Server-side behaviour belongs in the JAWA.POS and JAWA.FOOD
repositories, not here.

- Test first. Rules live in small pure modules under `src/` with `node --test`
  unit tests; Electron wiring in `src/desktop-app.js` is covered by Playwright
  tests in `test/e2e` against `test/support/fake-site.js`. See each test fail for
  the intended reason before implementing, and record notable checks in
  `docs/verification.md`.
- Everything shipped is public. Never add secrets, credentials, customer or order
  data, or code from the other repositories. `test/package` checks this.
- Pages get no preload script and no bridge into the app. Keep it that way unless
  a reviewed design needs one.
- New user-facing text goes in `src/locales/en.js`; tests choose the locale.
- Keep development-only settings in `resolveRuntimeConfig`'s development branch,
  so a shipped app never reads them.
- Tests must not open visible windows (`JAWA_SHOW_WINDOWS=0` is set by the
  launcher) or register `jawa-*` link handlers on the machine.

Checks: `npm test`, `npm run test:e2e`, and after a build `npm run test:package`.
