/**
 * src/client/main.ts — the game.html bootstrap (M2b, 08 §7).
 *
 * Mirrors dev/main.ts's minimal boot — tokens.css through the vite module
 * graph (a <link> above the vite root 404s silently and strips every DOM
 * sheet's theme), then createUndervaultGame(parent, ports) — with the dev
 * adapter swapped for the remote ports. No perf rig, no tower view, no plate
 * preview: those are dev-only.
 */

import "../../design/tokens/tokens.css";
import { createUndervaultGame } from "./game.js";
import { ApiError } from "./net/api.js";
import { createRemotePorts, VaultRefusal } from "./net/remote-ports.js";

/** In-fiction copy per error code (04 tone); server messages are already in-fiction. */
const REFUSAL_COPY: Partial<Record<string, string>> = {
  UNAUTHENTICATED: "The Guildhall does not know your face. Sign in, then descend.",
  NO_DAY: "The vault has not opened today. Return when the day's candle is minted.",
  CANDLE_SPENT: "The candle is spent — return with tomorrow's flame.",
  RUN_EXPIRED: "The dark took your last descent while it lingered. Tomorrow, another flame.",
  FROZEN: "The vault is sealed while the Guild works. Patience, delver.",
};

const FALLBACK_COPY = "The Vault did not answer. Pull to refresh, delver.";

/** Fade + remove the instant load state (game.html #uv-loader). Idempotent. */
function dismissLoader(): void {
  const el = document.getElementById("uv-loader");
  if (el === null) return;
  el.classList.add("uv-loader-out");
  window.setTimeout(() => el.remove(), 550);
}

function refusalCopy(err: unknown): string {
  if (err instanceof ApiError) return REFUSAL_COPY[err.code] ?? err.message;
  if (err instanceof VaultRefusal) return err.message;
  return FALLBACK_COPY;
}

function renderRefusal(parent: HTMLElement, err: unknown): void {
  const box = document.createElement("div");
  box.style.cssText = [
    "min-height: 100%",
    "display: flex",
    "flex-direction: column",
    "align-items: center",
    "justify-content: center",
    "gap: 12px",
    "padding: 24px",
    "box-sizing: border-box",
    "text-align: center",
    "background: #0b0906",
    "color: #e8dcc0",
    'font-family: Georgia, "Times New Roman", serif',
  ].join(";");

  const flame = document.createElement("div");
  flame.textContent = "🕯";
  flame.style.cssText = "font-size: 28px; opacity: 0.85";

  const line = document.createElement("p");
  line.textContent = refusalCopy(err);
  line.style.cssText = "margin: 0; max-width: 32ch; font-size: 15px; line-height: 1.5";

  box.append(flame, line);
  parent.replaceChildren(box);
  dismissLoader(); // the refusal IS the content now — never hold the loader over it
}

async function boot(): Promise<void> {
  const parent = document.getElementById("app");
  if (parent === null) throw new Error("game shell: #app missing");
  try {
    const ports = await createRemotePorts();
    const game = createUndervaultGame(parent, ports);
    // hide the load state once the first real frame is on screen (menu paints)
    game.events.once("postrender", dismissLoader);
    // safety net: never let the loader stick if postrender somehow doesn't fire
    window.setTimeout(dismissLoader, 12000);
  } catch (err) {
    renderRefusal(parent, err); // never white-screen
  }
}

void boot();
