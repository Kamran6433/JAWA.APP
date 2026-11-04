// "Sign in with your browser" ends with the browser opening
// jawa-<app>://sign-in?code=<one-time code>. The app accepts exactly that
// shape and hands the code to JAWA ID in a form POST from the window that
// started sign-in. JAWA ID also checks a secret held only by that window, so
// a code copied to another computer is useless.

export const SIGN_IN_COMPLETION_PATH = "/desktop/sign-in/complete";
const CODE = /^[A-Za-z0-9_-]{43}$/;

export function parseSignInLink(link, scheme) {
  if (typeof link !== "string") return null;
  let url;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  const exact = url.protocol === `${scheme}:` && url.hostname === "sign-in" && !url.port &&
    !url.username && !url.password && !url.hash && (url.pathname === "" || url.pathname === "/");
  if (!exact) return null;
  const names = [ ...url.searchParams.keys() ];
  const code = url.searchParams.get("code");
  return names.length === 1 && names[0] === "code" && CODE.test(code ?? "") ? { code } : null;
}

export function findSignInLink(argv, scheme) {
  for (const argument of Array.isArray(argv) ? argv : []) {
    const link = parseSignInLink(argument, scheme);
    if (link) return link;
  }
  return null;
}

export function signInCompletionRequest(identityOrigin, code) {
  if (!CODE.test(code)) throw new Error("Refusing a malformed sign-in code");
  return {
    url: new URL(SIGN_IN_COMPLETION_PATH, identityOrigin).href,
    options: {
      postData: [ { type: "rawData", bytes: Buffer.from(new URLSearchParams({ code }).toString()) } ],
      extraHeaders: "Content-Type: application/x-www-form-urlencoded",
    },
  };
}
