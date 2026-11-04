import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractFile, listPackage } from "@electron/asar";
import { FuseV1Options, FuseVersion, getCurrentFuseWire } from "@electron/fuses";
import { startFakeSite } from "../support/fake-site.js";

// Inspects a built macOS app. Build it first:
//   CSC_IDENTITY_AUTO_DISCOVERY=false JAWA_POS_ORIGIN=https://pos.jawa.invalid \
//   JAWA_FOOD_ORIGIN=https://food.jawa.invalid node scripts/build.js pos --dir --unsigned
const kind = process.env.JAWA_PACKAGE_KIND ?? "pos";
const names = { pos: "JAWA POS", food: "JAWA.FOOD" };
const bundle = join(fileURLToPath(new URL("../../", import.meta.url)), "dist", kind, `mac-${process.arch}`, `${names[kind]}.app`);
const archive = join(bundle, "Contents/Resources/app.asar");
const executable = join(bundle, "Contents/MacOS", names[kind]);
const built = process.platform === "darwin" && existsSync(archive);
const skip = built ? false : "build the macOS app first (see the comment at the top)";

test("the package holds only the app's own source and manifest", { skip }, () => {
  const files = listPackage(archive).map((file) => file.replace(/^\//, ""));
  for (const file of files) {
    assert.ok(file === "package.json" || file === "src" || /^src\/(locales\/)?[a-z-]+\.js$/.test(file) || file === "src/locales", `unexpected file ${file}`);
  }
  for (const required of [ "package.json", "src/main.js", "src/desktop-app.js", "src/navigation-policy.js" ]) assert.ok(files.includes(required), required);
  assert.ok(!files.some((file) => /test|\.env|node_modules|scripts|apps\//.test(file)));
});

test("the manifest carries the app kind and public HTTPS origins, and nothing secret", { skip }, () => {
  const manifest = JSON.parse(extractFile(archive, "package.json").toString());
  assert.equal(manifest.jawa.kind, kind);
  for (const origin of Object.values(manifest.jawa.origins)) assert.match(origin, /^https:\/\/[^/]+$/);
  assert.equal(manifest.devDependencies, undefined);
  assert.equal(manifest.scripts, undefined);
});

test("no secret-looking value is anywhere in the package", { skip }, () => {
  const text = listPackage(archive)
    .map((file) => file.replace(/^\//, ""))
    .filter((file) => /\.(js|json)$/.test(file))
    .map((file) => extractFile(archive, file).toString())
    .join("\n");
  for (const pattern of [ /BEGIN [A-Z ]*PRIVATE KEY/, /sk_(live|test)_[A-Za-z0-9]/, /CLIENT_SECRET\s*[=:]/, /ACTIVE_RECORD_ENCRYPTION/, /re_[A-Za-z0-9]{20,}/, /postgres(ql)?:\/\//, /AKIA[0-9A-Z]{16}/ ]) {
    assert.doesNotMatch(text, pattern);
  }
});

test("macOS knows the app's bundle id and its sign-in link scheme", { skip }, () => {
  const plist = JSON.parse(execFileSync("plutil", [ "-convert", "json", "-o", "-", join(bundle, "Contents/Info.plist") ]).toString());
  assert.equal(plist.CFBundleIdentifier, `com.jawa.${kind}`);
  assert.equal(plist.CFBundleName, names[kind]);
  assert.deepEqual(plist.CFBundleURLTypes.flatMap((type) => type.CFBundleURLSchemes), [ `jawa-${kind}` ]);
});

test("Electron's fuses refuse Node mode, debugging flags and loose app files", { skip }, async () => {
  const wire = await getCurrentFuseWire(executable);
  const on = (option) => wire[option] === FuseVersion.V1 ? null : String.fromCharCode(wire[option]);
  assert.equal(on(FuseV1Options.RunAsNode), "0");
  assert.equal(on(FuseV1Options.EnableNodeOptionsEnvironmentVariable), "0");
  assert.equal(on(FuseV1Options.EnableNodeCliInspectArguments), "0");
  assert.equal(on(FuseV1Options.EnableCookieEncryption), "1");
  assert.equal(on(FuseV1Options.EnableEmbeddedAsarIntegrityValidation), "1");
  assert.equal(on(FuseV1Options.OnlyLoadAppFromAsar), "1");
  assert.equal(on(FuseV1Options.GrantFileProtocolExtraPrivileges), "0");
});

// Opens the real app window briefly and uses its normal profile folder.
const launch = built && process.env.JAWA_PACKAGE_LAUNCH === "1" ? false : "set JAWA_PACKAGE_LAUNCH=1 to launch the built app";

test("a shipped app ignores attempts to redirect it, run it as Node or debug it", { skip: launch, timeout: 30_000 }, async () => {
  const site = await startFakeSite();
  const app = spawn(executable, [ "-e", "console.log('ran-as-node')", "--inspect=0" ], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_OPTIONS: "--require=/nonexistent.js", JAWA_APP: "food", [`JAWA_${kind.toUpperCase()}_ORIGIN`]: site.origin, JAWA_USER_DATA_DIR: "/tmp/elsewhere" },
  });
  let output = "";
  app.stdout.on("data", (chunk) => { output += chunk; });
  app.stderr.on("data", (chunk) => { output += chunk; });
  await new Promise((resolve) => setTimeout(resolve, 6000));
  const stillRunning = app.exitCode === null;
  app.kill();
  await site.stop();

  assert.ok(stillRunning, `the app should start as the app, not exit: ${output}`);
  assert.doesNotMatch(output, /ran-as-node|Debugger listening|nonexistent/);
  assert.deepEqual(site.requests, [], "the app must not load the overridden origin");
});
