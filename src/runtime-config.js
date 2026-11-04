import { isAbsolute } from "node:path";
import { APP_KINDS, appFor } from "./apps.js";

// Where each app points. A shipped app reads only the settings baked in at
// build time, so a command-line flag or environment variable can never send
// it to another server. Local development may point at this computer over
// HTTP, or at any HTTPS server such as staging, use a throwaway profile and
// keep test windows hidden.

export class ConfigurationError extends Error {
  name = "ConfigurationError";
}

const LOCAL_HOSTS = new Set([ "localhost", "127.0.0.1", "[::1]" ]);

export function normalizeOrigin(value, { allowLocalHttp }) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new ConfigurationError(`Not a web address: ${String(value)}`);
  }
  const local = url.protocol === "http:" && allowLocalHttp && LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== "https:" && !local) throw new ConfigurationError(`Use HTTPS for ${url.origin}`);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new ConfigurationError(`Give only the site's origin, not ${value}`);
  }
  return url.origin;
}

export function resolveRuntimeConfig({ isPackaged, env = {}, bundled = null }) {
  const settings = isPackaged ? packagedSettings(bundled) : developmentSettings(env);
  const app = appFor(settings.kind);
  const identityOrigin = settings.origins.pos;
  const trustedOrigins = [ ...new Set([ settings.origins[app.kind], ...(app.signsInThroughIdentity ? [ identityOrigin ] : []) ]) ];
  return Object.freeze({
    kind: app.kind,
    app,
    environment: isPackaged ? "production" : "development",
    origins: Object.freeze(settings.origins),
    identityOrigin,
    trustedOrigins: Object.freeze(trustedOrigins),
    homeUrl: new URL(app.startPath, settings.origins[app.kind]).href,
    userDataDirectory: settings.userDataDirectory,
    showWindows: settings.showWindows,
    registerProtocol: settings.registerProtocol,
  });
}

function packagedSettings(bundled) {
  if (!bundled || typeof bundled !== "object") throw new ConfigurationError("This build has no bundled settings");
  const kind = knownKind(bundled.kind);
  return {
    kind,
    origins: originsFrom(neededKinds(kind), (name) => bundled.origins?.[name], { allowLocalHttp: false }),
    userDataDirectory: null,
    showWindows: true,
    registerProtocol: true,
  };
}

function developmentSettings(env) {
  const kind = knownKind(env.JAWA_APP ?? "pos");
  const origins = originsFrom(
    APP_KINDS,
    (name) => env[`JAWA_${name.toUpperCase()}_ORIGIN`] ?? `http://localhost:${appFor(name).developmentPort}`,
    { allowLocalHttp: true },
  );
  const userDataDirectory = env.JAWA_USER_DATA_DIR ?? null;
  if (userDataDirectory !== null && !isAbsolute(userDataDirectory)) {
    throw new ConfigurationError("JAWA_USER_DATA_DIR must be an absolute path");
  }
  // Registering a development build as the jawa-* link handler would change
  // this computer's settings, so it happens only when asked for.
  return { kind, origins, userDataDirectory, showWindows: env.JAWA_SHOW_WINDOWS !== "0", registerProtocol: env.JAWA_REGISTER_PROTOCOL === "1" };
}

// A shipped app carries only the origins it uses: its own site and, for an app
// that signs in through JAWA ID, POS. So a POS build needs no FOOD address.
function neededKinds(kind) {
  return [ ...new Set([ kind, ...(appFor(kind).signsInThroughIdentity ? [ "pos" ] : []) ]) ];
}

function originsFrom(kinds, lookup, options) {
  return Object.fromEntries(kinds.map((kind) => {
    const value = lookup(kind);
    if (typeof value !== "string") throw new ConfigurationError(`Missing the ${kind} origin`);
    return [ kind, normalizeOrigin(value, options) ];
  }));
}

function knownKind(kind) {
  if (!APP_KINDS.includes(kind)) throw new ConfigurationError(`Unknown JAWA app: ${String(kind)}`);
  return kind;
}
