/**
 * tools/byte-report (CLAUDE.md DoD): renders the projected Redis footprint
 * from the 02 §5 byte-math model; alarms (exit 1) at ≥300 MB (03 §4).
 * Until live counters exist (M2+), the model uses the doc's constants;
 * the report shape won't change when measurements replace them.
 * Section B (bundle budgets) reports dist/ sizes when a build exists.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as process from "node:process";

const MB = 1024 * 1024;
const CAP_MB = 500; // platform (02 §10)
const ALARM_MB = 300; // 03 §4

const dauArg = process.argv.indexOf("--dau");
const DAU = dauArg >= 0 ? Number(process.argv[dauArg + 1] ?? "50000") : 50000;

interface Aggregate {
  name: string;
  bytes: (dau: number) => number;
  note: string;
}

// 02 §5 byte math @ pessimistic 50 k DAU
const MODEL: Aggregate[] = [
  { name: "corpses", bytes: (d) => (d * 0.3) * 250 * 3, note: "15k/day×250B×3d @50k DAU" },
  { name: "echoes", bytes: () => 25 * 50 * 300 * 2, note: "25 floors × cap 50 × 300B × 2d" },
  { name: "runs", bytes: (d) => d * 300, note: "300B/run, 26h TTL" },
  { name: "users", bytes: (d) => d * 4 * 600, note: "4×DAU × 600B (only unbounded aggregate)" },
  { name: "codex+claims", bytes: () => 5 * MB, note: "doc estimate" },
  { name: "day-shared", bytes: () => 2 * MB, note: "doc estimate" },
];

console.log(`byte-report — projected Redis footprint @ DAU ${DAU}`);
console.log("aggregate      MB      note");
let total = 0;
for (const a of MODEL) {
  const b = a.bytes(DAU);
  total += b;
  console.log(`${a.name.padEnd(13)} ${(b / MB).toFixed(1).padStart(6)}  ${a.note}`);
}
const totalMB = total / MB;
console.log(`${"TOTAL".padEnd(13)} ${totalMB.toFixed(1).padStart(6)}  cap ${CAP_MB} MB · alarm ${ALARM_MB} MB`);

// Section B: bundle budgets (02 §8) — real once client builds exist
const dist = path.join(process.cwd(), "dist");
if (fs.existsSync(dist)) {
  let bundleTotal = 0;
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else bundleTotal += fs.statSync(p).size;
    }
  };
  walk(dist);
  console.log(`bundles: dist/ = ${(bundleTotal / 1024).toFixed(0)} KB (budgets: splash ≤300 KB, game core ≤1.2 MB — enforced at M2 when real entrypoints exist)`);
} else {
  console.log("bundles: no build outputs yet (budgets: splash ≤300 KB, game core ≤1.2 MB)");
}

if (totalMB >= ALARM_MB) {
  console.error(`byte-report: ALARM — projected ${totalMB.toFixed(1)} MB ≥ ${ALARM_MB} MB`);
  process.exit(1);
}
console.log("byte-report: PASS");
