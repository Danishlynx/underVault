/**
 * DEV-ONLY diagnostics: exercise the menu theme's score engine headlessly.
 * Can't hear anything — but a gesture-wake plus ~3 bars of the vigil plus
 * the Begin handoff surfaces any WebAudio runtime exceptions (bad ramps,
 * double disconnects, null convolver routing). Autoplay policy is relaxed
 * so ctx.resume() settles under headless.
 *
 *   npx tsx tools/dev-harness/audio-smoke.ts [--url http://localhost:5173]
 */

import * as fs from "node:fs";
import * as process from "node:process";
import puppeteer from "puppeteer-core";

const arg = (flag: string, dflt: string): string => {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1]! : dflt;
};
const URL = arg("--url", "http://localhost:5173/");

const EDGE_PATHS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const edge = EDGE_PATHS.find((p) => fs.existsSync(p));
  if (edge === undefined) throw new Error("Edge not found");
  const browser = await puppeteer.launch({
    executablePath: edge,
    headless: true,
    args: [
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--autoplay-policy=no-user-gesture-required",
      "--window-size=940,520",
    ],
    defaultViewport: { width: 940, height: 520 },
  });
  const page = await browser.newPage();
  const logs: string[] = [];
  page.on("console", (m) => logs.push(`[console.${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => logs.push(`[pageerror] ${(e as Error).message}`));

  await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });
  await sleep(3500);

  // page.evaluate runs in the browser, but this file compiles under the
  // node tsconfig (no dom lib) — same escape hatch as snap.ts
  const inPage = (sel: string): boolean => {
    const g = globalThis as unknown as { document?: { querySelector(s: string): unknown } };
    return g.document?.querySelector(sel) != null;
  };

  // wake the vigil: a gesture on empty menu ground (not a button)
  await page.mouse.click(470, 485);
  const woke = await page.evaluate(inPage, ".uv-menu");
  console.log(`menu present after wake gesture: ${String(woke)}`);

  // ~3 bars: two chord changes, melody bells, far-toll window, crackle
  await sleep(30000);

  // leave via Begin: exercises stopMenuTheme + the story handoff
  const begin = await page.$(".uv-menu-begin");
  if (begin !== null) await begin.click();
  await sleep(3000);
  const story = await page.evaluate(inPage, ".uv-story");
  console.log(`story visible after Begin: ${String(story)}`);

  const errs = logs.filter((l) => l.startsWith("[pageerror]") || l.includes("Uncaught"));
  console.log(errs.length > 0 ? `AUDIO SMOKE ERRORS:\n${errs.join("\n")}` : "audio smoke: no page errors");
  await browser.close();
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
