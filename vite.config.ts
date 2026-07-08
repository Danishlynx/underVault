import { defineConfig } from "vite";

// DEV-ONLY harness config: serves dev/index.html, which boots the real
// src/client Phaser game with local adapters (see dev/README note in
// DECISIONS.md). The production Devvit entrypoints (splash.html/game.html)
// land at M2 and do NOT use this config.
export default defineConfig({
  root: "dev",
  publicDir: false,
  server: {
    port: 5173,
    fs: { allow: [".."] },
  },
  build: {
    outDir: "../dist/dev",
    emptyOutDir: true,
  },
});
