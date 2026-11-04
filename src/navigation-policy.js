// Decides where every address goes. The app's own sites load in the app;
// other websites, email and phone links go to the person's own browser or
// apps; anything else (scripts, local files, embedded documents, other app
// links) goes nowhere.

// A page can send even one of the app's own addresses to the browser by
// opening it in a window with this name. JAWA ID uses it for "Sign in with
// your browser".
export const SYSTEM_BROWSER_TARGET = "jawa-browser";

const WEB = new Set([ "https:", "http:" ]);
const HANDED_TO_SYSTEM = new Set([ "mailto:", "tel:" ]);

export function navigationDecision(address, trustedOrigins) {
  const url = parse(address);
  if (!url) return "deny";
  if (WEB.has(url.protocol)) {
    if (url.username || url.password) return "deny";
    return trustedOrigins.includes(url.origin) ? "allow" : "external";
  }
  return HANDED_TO_SYSTEM.has(url.protocol) ? "external" : "deny";
}

export function windowOpenDecision(request, trustedOrigins) {
  const decision = navigationDecision(request?.url, trustedOrigins);
  if (decision === "allow") return request.frameName === SYSTEM_BROWSER_TARGET ? "external" : "window";
  return decision;
}

// The canonical form of an address the browser may open, or null.
export function externalUrl(address) {
  return navigationDecision(address, []) === "external" ? parse(address).href : null;
}

function parse(address) {
  if (typeof address !== "string" || address === "") return null;
  try {
    return new URL(address);
  } catch {
    return null;
  }
}
