#!/usr/bin/env node
// Builds one desktop app:
//
//   JAWA_POS_ORIGIN=https://… node scripts/build.js pos [--dir] [--mac|--win] [--unsigned]
//   JAWA_POS_ORIGIN=https://… JAWA_FOOD_ORIGIN=https://… node scripts/build.js food …
//
// Each app needs only the origins it uses: POS its own, FOOD its own and POS.
//
// --dir stops at the unpacked app (for checks); --unsigned skips macOS signing
// for a local build. Signing and notarisation use electron-builder's own
// environment variables on the build machine (see docs/desktop-apps.md).
import { build, Platform } from "electron-builder";
import { builderConfig } from "./builder-config.js";

const [ kind, ...flags ] = process.argv.slice(2);
const origins = { pos: process.env.JAWA_POS_ORIGIN, food: process.env.JAWA_FOOD_ORIGIN };
const config = builderConfig({ kind, origins, unsigned: flags.includes("--unsigned") });

const platform = flags.includes("--win") ? Platform.WINDOWS : Platform.MAC;
const targets = platform.createTarget(flags.includes("--dir") ? "dir" : null);

await build({ targets, config, publish: "never" });
console.log(`Built ${config.productName} for ${platform.name} into ${config.directories.output}`);
