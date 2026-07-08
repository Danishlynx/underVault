// @ts-check
import tseslint from "typescript-eslint";

const DETERMINISM_MSG =
  "src/shared is deterministic & isomorphic (CLAUDE.md invariants 1, 3, 4). " +
  "Use sim RNG substreams / tick counters instead.";

const bannedSharedGlobals = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "window",
  "document",
  "navigator",
  "process",
  "Buffer",
  "crypto",
  "performance",
  "setTimeout",
  "setInterval",
  "queueMicrotask",
].map((name) => ({ name, message: DETERMINISM_MSG }));

export default tseslint.config(
  {
    ignores: ["dist/**", "webroot/**", "coverage/**", "docs/**", "node_modules/**"],
  },
  ...tseslint.configs.recommended,
  {
    // Determinism wall around the shared sim/gen code (CLAUDE.md invariant 1).
    // Float discipline is NOT lint-enforced (computed floats are uncatchable
    // syntactically) — the golden replay corpus is the float police.
    files: ["src/shared/**/*.ts"],
    rules: {
      "no-restricted-globals": ["error", ...bannedSharedGlobals],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: DETERMINISM_MSG },
        { object: "Date", property: "now", message: DETERMINISM_MSG },
      ],
      "no-restricted-syntax": [
        "error",
        { selector: 'NewExpression[callee.name="Date"]', message: DETERMINISM_MSG },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/server/**"],
              message:
                "shared/ must never import server code (CLAUDE.md invariant 2 — also enforced by tools/no-secret-leak).",
            },
            {
              group: ["**/client/**"],
              message: "shared/ is isomorphic; it cannot depend on client code.",
            },
          ],
        },
      ],
    },
  },
  {
    // Unit tests colocated in src/shared run under vitest (node) — the
    // determinism wall applies to shipped sim code, not its tests.
    files: ["src/shared/**/*.test.ts"],
    rules: {
      "no-restricted-globals": "off",
      "no-restricted-properties": "off",
      "no-restricted-syntax": "off",
    },
  },
  {
    // Client layering + persistence bans (dormant until M2; costs nothing now).
    files: ["src/client/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "localStorage", message: "Redis is the only persistence (invariant 3)." },
        { name: "sessionStorage", message: "Redis is the only persistence (invariant 3)." },
        { name: "indexedDB", message: "Redis is the only persistence (invariant 3)." },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["**/server/**"], message: "client must never import server code (invariant 2)." },
          ],
        },
      ],
    },
  },
);
