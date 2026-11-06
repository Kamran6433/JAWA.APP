// Browser permissions are refused unless the app's own pages need them.
// Electron grants everything by default; these rules replace that.

const EVERY_APP = [ "clipboard-sanitized-write", "fullscreen" ];
const ALLOWED = Object.freeze({
  menu: new Set([ ...EVERY_APP, "serial" ]), // USB/Bluetooth caller-ID adapter (Web Serial)
  food: new Set(EVERY_APP),
});

export function permissionDecision({ kind, permission, requestingUrl, trustedOrigins }) {
  return Boolean(ALLOWED[kind]?.has(permission)) && isTrusted(requestingUrl, trustedOrigins);
}

// Remembered device access, such as a caller-ID adapter chosen earlier.
export function devicePermissionDecision({ kind, deviceType, origin, trustedOrigins }) {
  return deviceType === "serial" && ALLOWED[kind]?.has("serial") === true && isTrusted(origin, trustedOrigins);
}

function isTrusted(address, trustedOrigins) {
  try {
    return trustedOrigins.includes(new URL(address).origin);
  } catch {
    return false;
  }
}
