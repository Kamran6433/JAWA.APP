import { APPS } from "./apps.js";
import { navigationDecision } from "./navigation-policy.js";

// A self-contained page for when the app's own site can't be reached. MENU's
// own service worker still reopens the till offline; this covers the first
// launch and the sites without offline support. It has no script, only a
// timed retry of the page that failed.

// Chromium network error codes that mean "no connection right now".
const NETWORK_ERRORS = new Set([ -7, -21, -100, -101, -102, -104, -105, -106, -109, -118, -130, -137, -324 ]);
const RETRY_SECONDS = 15;

export function loadFailure({ errorCode, isMainFrame, url, trustedOrigins }) {
  if (!isMainFrame || navigationDecision(url, trustedOrigins) !== "allow") return null;
  if (NETWORK_ERRORS.has(errorCode)) return "offline";
  if (errorCode <= -200 && errorCode > -300) return "insecure";
  return null;
}

export function renderOfflinePage({ appName, retryUrl, failure, theme, t }) {
  const retry = webAddress(retryUrl);
  const colours = theme === "dark"
    ? { background: APPS.menu.background.dark, text: "#f2f2f2", muted: "#b8bcc6", accent: "#c79ad0" }
    : { background: APPS.menu.background.light, text: "#1d1d1f", muted: "#55575d", accent: "#8c5896" };
  const title = t(`offline.${failure}.title`, { app: appName });
  const body = t(`offline.${failure}.body`, { app: appName });
  const refresh = failure === "offline" ? `\n<meta http-equiv="refresh" content="${RETRY_SECONDS};url=${escape(retry)}">` : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<meta name="viewport" content="width=device-width, initial-scale=1">${refresh}
<title>${escape(appName)}</title>
<style>
body{margin:0;background:${colours.background};color:${colours.text};font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{box-sizing:border-box;max-width:32rem;min-height:100vh;margin:0 auto;padding:2rem 1rem;display:flex;flex-direction:column;justify-content:center;gap:1rem}
h1{margin:0;font-size:1.5rem;line-height:1.25}
p{margin:0;color:${colours.muted}}
.retry{align-self:flex-start;min-height:44px;padding:0 1.25rem;display:inline-flex;align-items:center;border-radius:999px;background:${colours.accent};color:#fff;font-weight:600;text-decoration:none}
.retry:focus-visible{outline:3px solid ${colours.text};outline-offset:2px}
</style>
</head>
<body>
<main>
<h1>${escape(title)}</h1>
<p>${escape(body)}</p>
<a class="retry" href="${escape(retry)}">${escape(t("offline.retry"))}</a>
</main>
</body>
</html>
`;
}

export function offlinePageUrl(html) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function webAddress(address) {
  let url;
  try {
    url = new URL(address);
  } catch {
    url = null;
  }
  if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) throw new Error(`Refusing to retry ${String(address)}`);
  return url.href;
}

function escape(text) {
  return String(text).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]);
}
