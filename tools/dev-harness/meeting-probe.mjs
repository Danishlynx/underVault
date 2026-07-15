// DEV probe: drive menu → strike → force openVictory() through the dev
// handle, walk the Meeting's three plates, land on the victory sheet.
import fs from "node:fs";
import puppeteer from "puppeteer-core";

const EDGE = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => fs.existsSync(p));

const OUT = process.env.TEMP + "\\meeting-flow";
const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--window-size=520,940"],
  defaultViewport: { width: 520, height: 940 },
});
const page = await browser.newPage();
const logs = [];
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto("http://localhost:5173/", { waitUntil: "networkidle2", timeout: 30000 });
await new Promise((r) => setTimeout(r, 3000));

const begin = await page.$(".uv-menu-begin");
if (begin) { await begin.click(); await new Promise((r) => setTimeout(r, 800)); }
const skip = await page.$(".uv-story-skip");
if (skip) { await skip.click(); await new Promise((r) => setTimeout(r, 900)); }
await new Promise((r) => setTimeout(r, 2800)); // match flash + first floor

const forced = await page.evaluate(() => {
  const g = window.__uvGame;
  if (!g) return "no game handle";
  const sc = g.scene.scenes.find((s) => typeof s.openVictory === "function");
  if (!sc) return "no Descent scene";
  sc.devOpenSeal(true); // the hundredth candle — meeting + finale
  return "ok";
});
logs.push(`[probe] force hundredth candle: ${forced}`);
await new Promise((r) => setTimeout(r, 2200));
await page.screenshot({ path: `${OUT}-1.png` });
for (let i = 2; i <= 9; i++) {
  await page.mouse.click(260, 300);
  await new Promise((r) => setTimeout(r, 1300));
  await page.screenshot({ path: `${OUT}-${i}.png` });
}
await browser.close();
console.log(logs.join("\n") || "(clean)");
console.log(`shots: ${OUT}-1..4.png`);
