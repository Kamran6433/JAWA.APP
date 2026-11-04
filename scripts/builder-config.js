import { resolveRuntimeConfig } from "../src/runtime-config.js";

// electron-builder settings for one app. The shipped app carries only its
// kind and the public HTTPS origins (validated exactly as the app will read
// them); signing identities and store credentials come from the build
// machine's environment, never from here.

const CATEGORIES = { pos: "public.app-category.business", food: "public.app-category.food-and-drink" };

export function builderConfig({ kind, origins, unsigned = false }) {
  const config = resolveRuntimeConfig({ isPackaged: true, bundled: { kind, origins } });
  const { app } = config;
  return {
    appId: app.appId,
    productName: app.name,
    directories: { output: `dist/${app.kind}` },
    files: [ "package.json", "src/**/*.js", "!**/*.map" ],
    asar: true,
    icon: `apps/${app.kind}/icon.png`,
    extraMetadata: {
      name: `jawa-${app.kind}`,
      productName: app.name,
      main: "src/main.js",
      jawa: { kind: app.kind, origins: { ...config.origins } },
    },
    protocols: [ { name: app.name, schemes: [ app.scheme ] } ],
    electronFuses: {
      runAsNode: false,
      enableCookieEncryption: true,
      enableNodeOptionsEnvironmentVariable: false,
      enableNodeCliInspectArguments: false,
      enableEmbeddedAsarIntegrityValidation: true,
      onlyLoadAppFromAsar: true,
      grantFileProtocolExtraPrivileges: false,
      resetAdHocDarwinSignature: true,
    },
    mac: {
      category: CATEGORIES[app.kind],
      target: [ { target: "dmg", arch: [ "universal" ] }, { target: "zip", arch: [ "universal" ] } ],
      hardenedRuntime: true,
      darkModeSupport: true,
      ...(unsigned ? { identity: null } : {}),
    },
    win: { target: [ { target: "nsis", arch: [ "x64", "arm64" ] } ] },
    nsis: { oneClick: true, perMachine: false },
    publish: null,
  };
}
