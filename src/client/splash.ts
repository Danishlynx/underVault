// splash.ts — Guildhall shell (08-M2-PORT-CONTRACT §1.11). DOM only; importing
// "phaser" here is a build failure (invariant 7 — tools/byte-report asserts the
// splash chunk graph carries no phaser module and stays <= 300 KB).
// Paints day / gate % / codex % / teaser from context.postData (zero API calls
// when present); falls back to GET /api/day. The single descend button calls
// requestExpandedMode(e, "game") — this trusted user gesture is also where the
// M3 audio unlock will live (invariant 6).
import { context, requestExpandedMode } from "@devvit/web/client";

interface SplashData {
  day: number;
  gatePct: number;
  codexPct: number;
  teaser: string;
  houseLine?: string;
}

function asNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asStr(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function parseSplash(raw: unknown): SplashData | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const day = asNum(r["day"]);
  const gatePct = asNum(r["gatePct"]);
  const codexPct = asNum(r["codexPct"]);
  const teaser = asStr(r["teaser"]);
  if (day === null || gatePct === null || codexPct === null || teaser === null) return null;
  const houseLine = asStr(r["houseLine"]);
  return houseLine === null
    ? { day, gatePct, codexPct, teaser }
    : { day, gatePct, codexPct, teaser, houseLine };
}

function el(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`splash: missing #${id}`);
  return node;
}

function paint(d: SplashData): void {
  el("uv-day").textContent = `Day ${d.day}`;
  el("uv-gate").textContent = String(d.gatePct);
  el("uv-codex").textContent = String(d.codexPct);
  el("uv-teaser").textContent = d.teaser;
  if (d.houseLine !== undefined) el("uv-house").textContent = d.houseLine;
}

async function fetchDay(): Promise<SplashData | null> {
  try {
    const res = await fetch("/api/day"); // same-origin only (invariant 4)
    if (!res.ok) return null;
    return parseSplash((await res.json()) as unknown);
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  el("uv-descend").addEventListener("click", (e: MouseEvent) => {
    requestExpandedMode(e, "game");
  });

  const data = parseSplash(context.postData) ?? (await fetchDay());
  if (data !== null) {
    paint(data);
  } else {
    el("uv-day").textContent = "The gate is not yet open.";
    el("uv-teaser").textContent = "No descent has been minted today.";
  }
}

void main();
