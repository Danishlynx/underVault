// DEV-ONLY: deleted at M2 (replaced by src/client/game.ts bootstrapping from
// the Devvit expanded entrypoint with real network ports).

import { createUndervaultGame } from "../src/client/game.js";
import { createDevPorts } from "./rules-adapter.js";

const parent = document.getElementById("app");
if (parent === null) throw new Error("dev harness: #app missing");

createUndervaultGame(parent, createDevPorts());
