/**
 * DEV-ONLY diagnostics: drive the locally-installed Edge (headless) at the
 * vite dev server, collect console output + page errors, and screenshot.
 * Gives the agent eyes on the running game (and produces the 04-states
 * screenshots the DoD asks for). Never part of any shipped bundle.
 *
 *   npx tsx tools/dev-harness/snap.ts [--url http://localhost:5173] [--out snap.png] [--wait 4000] [--keys WDDS]
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as process from "node:process";
import puppeteer, { type KeyInput } from "puppeteer-core";

const arg = (flag: string, dflt: string): string => {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1]! : dflt;
};

const URL = arg("--url", "http://localhost:5173/");
const OUT = arg("--out", path.join(process.cwd(), "snap.png"));
const WAIT = Number(arg("--wait", "4000"));
const KEYS = arg("--keys", "");
const LANDSCAPE = process.argv.includes("--landscape");

const EDGE_PATHS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

async function main(): Promise<void> {
  const edge = EDGE_PATHS.find((p) => fs.existsSync(p));
  if (edge === undefined) throw new Error("Edge not found");

  const vw = LANDSCAPE ? 940 : 520;
  const vh = LANDSCAPE ? 520 : 940;
  const browser = await puppeteer.launch({
    executablePath: edge,
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", `--window-size=${vw},${vh}`],
    defaultViewport: { width: vw, height: vh },
  });
  const page = await browser.newPage();

  const logs: string[] = [];
  page.on("console", (msg) => logs.push(`[console.${msg.type()}] ${msg.text()}`));
  page.on("pageerror", (err) => {
    const e = err as Error;
    logs.push(`[pageerror] ${e.message}\n${e.stack ?? ""}`);
  });
  page.on("requestfailed", (req) => logs.push(`[requestfailed] ${req.url()} ${req.failure()?.errorText ?? ""}`));

  await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise((r) => setTimeout(r, WAIT));

  for (const k of KEYS) {
    await page.keyboard.press((k === " " ? "Space" : k) as KeyInput);
    await new Promise((r) => setTimeout(r, 160));
  }
  if (KEYS !== "") await new Promise((r) => setTimeout(r, 500));

  await page.screenshot({ path: OUT as `${string}.png` });
  await browser.close();

  console.log(`screenshot: ${OUT}`);
  console.log(logs.length > 0 ? logs.join("\n") : "(no console output)");
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
