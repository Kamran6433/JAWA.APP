// The JAWA desktop apps: POS for businesses and FOOD for customers. JAWA.SITE
// stays a website. Each app is a window onto its live site; nothing here is
// secret, because anyone can unpack a shipped app and read it.

const background = Object.freeze({ light: "#f6f6f6", dark: "#14161a" });

const define = (app) => Object.freeze({ ...app, partition: `persist:jawa-${app.kind}`, scheme: `jawa-${app.kind}`, background });

export const APPS = Object.freeze({
  pos: define({ kind: "pos", name: "JAWA POS", appId: "com.jawa.pos", startPath: "/", developmentPort: 3000, signsInThroughIdentity: false }),
  food: define({ kind: "food", name: "JAWA.FOOD", appId: "com.jawa.food", startPath: "/", developmentPort: 3001, signsInThroughIdentity: true }),
});

export const APP_KINDS = Object.freeze(Object.keys(APPS));

export function appFor(kind) {
  if (!APP_KINDS.includes(kind)) throw new Error(`Unknown JAWA app: ${String(kind)}`);
  return APPS[kind];
}
