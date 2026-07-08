/**
 * Build guard (CLAUDE.md invariant 2): FAIL if anything under src/client or
 * src/shared imports code that resolves into src/server (stricter than the
 * minimum `server/rules` — any client/shared→server import is a layering
 * defect). dev/ and tools/ are exempt by design: dev/rules-adapter.ts is the
 * sanctioned DEV-ONLY bridge (Track B), deleted at M2.
 *
 * Regex-based, not AST: commented-out imports can false-positive (fix the
 * comment); string-built dynamic imports can false-negative (CSP blocks them
 * in production anyway; the ESLint layer covers source-level bans).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as process from "node:process";

const ROOT = process.cwd();
if (!fs.existsSync(path.join(ROOT, "package.json"))) {
  console.error("no-secret-leak: run from the repo root");
  process.exit(2);
}

const SERVER_DIR = path.resolve(ROOT, "src", "server").toLowerCase();
const SCAN_ROOTS = ["src/client", "src/shared"];
const EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".js", ".mjs"]);

const IMPORT_RES = [
  /(?:^|\n)\s*(?:import|export)\s[^;'"]*?from\s*['"]([^'"]+)['"]/g,
  /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g,
  /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

interface Violation {
  file: string;
  line: number;
  spec: string;
}

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}

function isInsideServer(resolved: string): boolean {
  const rel = path.relative(SERVER_DIR, resolved.toLowerCase());
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

const violations: Violation[] = [];
let scanned = 0;

for (const rootRel of SCAN_ROOTS) {
  const rootAbs = path.join(ROOT, rootRel);
  if (!fs.existsSync(rootAbs)) {
    console.log(`no-secret-leak: ${rootRel} absent — skipped`);
    continue;
  }
  const entries = fs.readdirSync(rootAbs, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!EXTENSIONS.has(path.extname(entry.name))) continue;
    const file = path.join(entry.parentPath, entry.name);
    const text = fs.readFileSync(file, "utf8");
    scanned++;
    for (const re of IMPORT_RES) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const spec = m[1]!;
        if (spec.startsWith(".")) {
          const resolved = path.resolve(path.dirname(file), spec);
          if (isInsideServer(resolved)) {
            violations.push({ file, line: lineOf(text, m.index), spec });
          }
        } else if (/(^|\/)server\//.test(spec)) {
          // alias/baseUrl-style specifier naming server/ — flag conservatively
          violations.push({ file, line: lineOf(text, m.index), spec });
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error("no-secret-leak: FAIL — secrets must never reach the client (invariant 2):");
  for (const v of violations) {
    console.error(`  ${path.relative(ROOT, v.file)}:${v.line} -> ${v.spec}`);
  }
  process.exit(1);
}
console.log(`no-secret-leak: PASS (${scanned} files scanned)`);
