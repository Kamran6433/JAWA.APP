import { appFor } from "./apps.js";

// The apps identify themselves to the servers so the pages can offer
// "Sign in with your browser". It is a presentation hint only: anyone can
// send any user agent, so servers never treat it as proof of anything.
export const DESKTOP_USER_AGENT_PATTERN = /\bJAWADesktop\/\d+\.\d+\.\d+ \((pos|food)\)/;

export function desktopUserAgent(base, { version, kind }) {
  appFor(kind);
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Refusing a malformed version: ${version}`);
  const engine = base
    .replace(/(\(KHTML, like Gecko\) ).*?(Chrome\/)/, "$1$2") // Electron's "<app name>/<version>" token
    .replace(/ JAWADesktop\/\S+ \(\w+\)$/, "");
  return `${engine} JAWADesktop/${version} (${kind})`;
}
