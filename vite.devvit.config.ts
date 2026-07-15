import { defineConfig } from "vite";
import { devvit } from "@devvit/start/vite";

// Production Devvit build (08-M2-PORT-CONTRACT §1.2). The @devvit/start plugin
// reads devvit.json: client entry HTMLs resolve from src/client/ (multi-entry
// ESM -> dist/client), server -> single CJS dist/server/index.cjs. The root
// vite.config.ts (dev harness, root: "dev") is a separate config and never
// shares output dirs with this one.
export default defineConfig({
  plugins: [devvit()],
});
