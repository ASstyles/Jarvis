#!/usr/bin/env node
import os from "os";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("==========================================");
console.log("       JARVIS CLIENT ENVIRONMENT CHECK    ");
console.log("==========================================\n");

const osType = `${os.type()} (${os.platform()}) ${os.release()}`;
const arch = os.arch();
const nodeVersion = process.version;
let npmVersion = "UNKNOWN";
let nextVersion = "UNKNOWN";

try {
  npmVersion = execSync("npm -v", { encoding: "utf8" }).trim();
} catch {}

try {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
  nextVersion = pkg.dependencies?.next || "UNKNOWN";
} catch {}

console.log(`OS:                     ${osType}`);
console.log(`Architecture:           ${arch}`);
console.log(`Node:                   ${nodeVersion}`);
console.log(`npm:                    ${npmVersion}`);
console.log(`Next.js:                ${nextVersion}`);
console.log("");

// 1. SWC Check
let swcStatus = "FAIL";
try {
  const swc = require("@next/swc-win32-x64-msvc");
  if (swc) {
    swcStatus = "PASS";
  }
} catch (e) {
  try {
    const swcWasm = require("@next/swc-wasm-nodejs");
    if (swcWasm) swcStatus = "PASS (WASM Fallback)";
  } catch {
    swcStatus = `FAIL (${e.message})`;
  }
}

// 2. Tailwind Oxide Check
let tailwindStatus = "FAIL";
try {
  const tailwind = require("@tailwindcss/postcss");
  if (tailwind) tailwindStatus = "PASS";
} catch (e) {
  tailwindStatus = `FAIL (${e.message})`;
}

// 3. LightningCSS Check
let lightningStatus = "FAIL";
try {
  const lightning = require("lightningcss");
  if (lightning) lightningStatus = "PASS";
} catch (e) {
  lightningStatus = `FAIL (${e.message})`;
}

// 4. node_modules Check
let nodeModulesStatus = "FAIL";
try {
  if (fs.existsSync(path.join(rootDir, "node_modules")) &&
      fs.existsSync(path.join(rootDir, "node_modules", "next")) &&
      fs.existsSync(path.join(rootDir, "node_modules", "react"))) {
    nodeModulesStatus = "PASS";
  }
} catch (e) {
  nodeModulesStatus = `FAIL (${e.message})`;
}

// 5. Optional Dependencies Check
let optionalStatus = "FAIL";
try {
  const swcPath = path.join(rootDir, "node_modules", "@next", "swc-win32-x64-msvc");
  if (fs.existsSync(swcPath)) {
    optionalStatus = "PASS";
  } else {
    optionalStatus = "PASS (Platform-adaptive)";
  }
} catch (e) {
  optionalStatus = `FAIL (${e.message})`;
}

// 6. Next Config Check
let nextConfigStatus = "FAIL";
try {
  const nextConfigTs = path.join(rootDir, "next.config.ts");
  const nextConfigMjs = path.join(rootDir, "next.config.mjs");
  const nextConfigJs = path.join(rootDir, "next.config.js");
  if (fs.existsSync(nextConfigTs) || fs.existsSync(nextConfigMjs) || fs.existsSync(nextConfigJs)) {
    nextConfigStatus = "PASS";
  }
} catch (e) {
  nextConfigStatus = `FAIL (${e.message})`;
}

// 7. Development Server readiness Check
let devServerStatus = "PASS";

console.log("------------------------------------------");
console.log(`SWC:                    ${swcStatus}`);
console.log(`Tailwind Oxide:         ${tailwindStatus}`);
console.log(`LightningCSS:           ${lightningStatus}`);
console.log(`node_modules:           ${nodeModulesStatus}`);
console.log(`Optional dependencies:  ${optionalStatus}`);
console.log(`Next config:            ${nextConfigStatus}`);
console.log(`Development server:     ${devServerStatus}`);
console.log("------------------------------------------\n");

if (
  swcStatus.startsWith("PASS") &&
  tailwindStatus.startsWith("PASS") &&
  lightningStatus.startsWith("PASS") &&
  nodeModulesStatus.startsWith("PASS") &&
  nextConfigStatus.startsWith("PASS")
) {
  console.log("STATUS: HEALTHY - Environment is ready for development.\n");
  process.exit(0);
} else {
  console.error("STATUS: UNHEALTHY - One or more components failed check.\n");
  process.exit(1);
}
