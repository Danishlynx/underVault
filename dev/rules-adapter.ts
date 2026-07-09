// DEV-ONLY: deleted at M2.
// The one sanctioned bridge to src/server/rules for local play, PLUS the
// in-memory stand-in for everything Redis owns in production (corpses,
// echoes, codex, day-shared braziers/signs, lineage). Persistence rules
// (invariant 3) are honored by NOT persisting: a page reload is a fresh
// season, exactly like a Devvit release wipe.

import { resolveRuleKey, omenForSeed, type OmenDay } from "../src/server/rules/resolve.js";
import { generateFloor } from "../src/shared/gen/index.js";
import { EntityKind, Tile, type FloorData } from "../src/shared/sim/types.js";
import { HP, TILE_FLAGS, F_WALK } from "../src/shared/sim/constants.js";
import { describeRuleKey } from "../src/client/ui/vocab.js";
import type {
  CodexEntryRec,
  CorpseGift,
  DeathReport,
  EchoRecord,
  FloorPayloadLike,
  GamePorts,
  GuildhallModelRec,
  LearnedRule,
} from "../src/client/net/ports.js";

export const BASE_SEED = 20260708;
const CORPSE_DAYS = 3; // ≈ the 72 h TTL (01 §13)
const INK_AT = 5; // distinct confirms → INKED (01 §10)

interface CorpseRec {
  day: number;
  floor: number;
  x: number;
  y: number;
  lastWords: string;
  gift: CorpseGift | null;
  unbanked: LearnedRule[];
  recovered: boolean;
}

interface CodexRow extends CodexEntryRec {
  conditional: boolean;
}

// ── The session (all Redis-shaped state, in memory) ────────────────────────
class Session {
  day = 1;
  omen: OmenDay = omenForSeed(BASE_SEED + 1, 1);
  corpses: CorpseRec[] = [];
  echoes: EchoRecord[] = [];
  codex: CodexRow[] = [];
  // chalk/glowmoss/echoes are DAY-scoped: the vault reseeds nightly, so raw
  // tile indices from yesterday land on unrelated tiles (walls, stairs) of
  // today's map. Corpses alone cross days (72 h TTL, 01 §13) — they carry a
  // position, not a bitmap, and get re-seated on the nearest open ground. D64
  chalkByDayFloor = new Map<string, Uint8Array>();
  signsByDayFloor = new Map<string, { tileIndex: number; template: number; noun: number }[]>();
  brazierByDayFloor = new Map<string, number[]>();
  glowmossByDayFloor = new Map<string, number[]>();
  fallenToday = 0;
  runsToday = 0;
  house: string | null = null;
  generation = 1;
  heirloom = 0;
  heirloomOffered = false;

  daySeed(): number {
    return (BASE_SEED + this.day) >>> 0;
  }
  dayFloorKey(floor: number): string {
    return `${this.day}:${floor}`;
  }
}

export function createDevPorts(): GamePorts {
  const S = new Session();

  const ports: GamePorts = {
    resolveRule(key: string): number {
      return resolveRuleKey(key, S.omen.id);
    },

    getFloor(floor: number): FloorPayloadLike {
      const g = generateFloor(S.daySeed(), floor, S.omen.gen);
      const fd: FloorData = g.floorData;
      const n = fd.w * fd.h;

      // shared day-state: braziers gifted by earlier runs today
      const lit = S.brazierByDayFloor.get(S.dayFloorKey(floor)) ?? [];
      for (const i of lit) {
        if (fd.tiles[i] === Tile.BRAZIER_UNLIT) fd.tiles[i] = Tile.BRAZIER_LIT;
      }
      // gifts planted earlier today: glowmoss (M2 re-anchors across days)
      for (const i of S.glowmossByDayFloor.get(S.dayFloorKey(floor)) ?? []) {
        if (fd.tiles[i] === Tile.FLOOR || fd.tiles[i] === Tile.MOSS) fd.tiles[i] = Tile.GLOWMOSS;
      }
      // your chalk persists across today's runs (01 §9)
      const chalk = S.chalkByDayFloor.get(S.dayFloorKey(floor));
      if (chalk !== undefined && chalk.length === n) fd.chalk = chalk.slice();
      // day-scoped signs
      const signs = new Uint8Array(n);
      for (const rec of S.signsByDayFloor.get(S.dayFloorKey(floor)) ?? []) {
        signs[rec.tileIndex] = 1;
      }
      fd.signs = signs;
      // corpses within TTL walk among the entities (kind CORPSE); a death
      // on moss/water/a doorway (or under a monster) re-seats the fallen on
      // the nearest open ground — a corpse must never silently vanish, it
      // carries the run's unbanked truths (01 §13). D64
      const seatFor = (cx: number, cy: number): { x: number; y: number } | null => {
        const SX = [0, 0, 1, 0, -1, 1, 1, -1, -1, 0, 2, 0, -2];
        const SY = [0, -1, 0, 1, 0, -1, 1, 1, -1, -2, 0, 2, 0];
        for (let k = 0; k < SX.length; k++) {
          const x = cx + SX[k]!;
          const y = cy + SY[k]!;
          if (x < 0 || y < 0 || x >= fd.w || y >= fd.h) continue;
          if ((TILE_FLAGS[fd.tiles[y * fd.w + x]!]! & F_WALK) === 0) continue;
          if (fd.entities.some((e) => e.x === x && e.y === y)) continue;
          if (x === fd.px && y === fd.py) continue;
          return { x, y };
        }
        return null;
      };
      for (let c = 0; c < S.corpses.length; c++) {
        const corpse = S.corpses[c]!;
        if (corpse.recovered || corpse.floor !== floor) continue;
        if (S.day - corpse.day >= CORPSE_DAYS) continue;
        const seat = seatFor(corpse.x, corpse.y);
        if (seat !== null) {
          fd.entities.push({
            id: fd.nextEntityId++,
            kind: EntityKind.CORPSE,
            x: seat.x,
            y: seat.y,
            hp: HP[EntityKind.CORPSE]!,
            state: 0,
            data: c, // corpseRef
          });
        }
      }
      fd.entities.sort((a, b) => a.id - b.id);

      // echoes replay only on the layout they were walked on (today's)
      const echoes = S.echoes.filter((e) => e.floor === floor && e.day === S.day);
      return { floorData: fd, rngInit: g.rngInit, echoes };
    },

    getRunSetup() {
      S.runsToday++;
      return { mods: { ...S.omen.mods }, heirloom: S.heirloom, noSalt: S.omen.noSalt };
    },

    getGuildhall(): GuildhallModelRec {
      const inked = S.codex.filter((c) => c.status === "inked").length;
      const codexPct = S.codex.length === 0 ? 0 : Math.round((inked * 100) / S.codex.length);
      const heir = S.heirloom !== 0 ? " · ⚘" : "";
      return {
        day: S.day,
        omenRumor: S.omen.tellHint,
        gatePct: Math.min(99, S.day * 9), // local stand-in for the community Gate
        codexPct,
        fallenToday: S.fallenToday,
        houseLine:
          S.house === null
            ? "No house sworn yet — die once to found one."
            : `⚑ House ${S.house} · ${S.house} ${roman(S.generation)} awaits${heir}`,
      };
    },

    getCodex(): CodexEntryRec[] {
      return S.codex.map((c) => ({ ...c }));
    },

    bankClaims(claims: LearnedRule[]): CodexEntryRec[] {
      const out: CodexEntryRec[] = [];
      for (const claim of claims.slice(0, 3)) {
        const existing = S.codex.find((c) => c.ruleKey === claim.key);
        if (existing !== undefined) {
          // re-banking a known truth confirms it (01 §10 → inks at 5)
          existing.confirms++;
          if (existing.confirms >= INK_AT && existing.status !== "inked") existing.status = "inked";
          out.push({ ...existing });
          continue;
        }
        const subject = claim.key.split("|")[0] ?? "?";
        const conditional = S.omen.conditionalSubjects.includes(subject);
        const { subject: pretty, text } = describeRuleKey(claim.key, claim.effect);
        const row: CodexRow = {
          ruleKey: claim.key,
          subject: pretty,
          text,
          status: conditional ? "conditional" : "true",
          confirms: 1,
          day: S.day,
          conditional,
        };
        S.codex.push(row);
        out.push({ ...row });
      }
      return out;
    },

    confirmObservations(keys: string[]): void {
      for (const key of keys) {
        const row = S.codex.find((c) => c.ruleKey === key);
        if (row === undefined) continue;
        row.confirms++;
        if (row.confirms >= INK_AT && row.status !== "inked") row.status = "inked";
      }
    },

    reportDeath(report: DeathReport): void {
      S.fallenToday++;
      S.generation++;
      S.corpses.push({
        day: S.day,
        floor: report.floor,
        x: report.x,
        y: report.y,
        lastWords: report.lastWords,
        gift: report.gift,
        unbanked: report.unbanked,
        recovered: false,
      });
      if (report.echoFrames.length > 0) {
        S.echoes.push({ day: S.day, floor: report.floor, frames: report.echoFrames });
      }
    },

    reportExit(): void {
      // banked stubs / streak grace live here at M5; nothing to do locally
    },

    brazierLit(floor: number, tileIndex: number): void {
      const key = S.dayFloorKey(floor);
      const arr = S.brazierByDayFloor.get(key) ?? [];
      if (!arr.includes(tileIndex)) arr.push(tileIndex);
      S.brazierByDayFloor.set(key, arr);
    },

    glowmossPlanted(floor: number, tileIndex: number): void {
      const key = S.dayFloorKey(floor);
      const arr = S.glowmossByDayFloor.get(key) ?? [];
      if (!arr.includes(tileIndex)) arr.push(tileIndex);
      S.glowmossByDayFloor.set(key, arr);
    },

    signPlaced(floor: number, tileIndex: number, template: number, noun: number): void {
      const key = S.dayFloorKey(floor);
      const arr = S.signsByDayFloor.get(key) ?? [];
      arr.push({ tileIndex, template, noun });
      S.signsByDayFloor.set(key, arr);
    },

    getSigns(floor: number) {
      return (S.signsByDayFloor.get(S.dayFloorKey(floor)) ?? []).map((r) => ({ ...r }));
    },

    chalkChanged(floor: number, chalk: Uint8Array): void {
      S.chalkByDayFloor.set(S.dayFloorKey(floor), chalk.slice());
    },

    corpseRecovered(corpseRef: number): { unbanked: LearnedRule[]; gift: CorpseGift | null } {
      const corpse = S.corpses[corpseRef];
      if (corpse === undefined || corpse.recovered) return { unbanked: [], gift: null };
      corpse.recovered = true;
      return { unbanked: corpse.unbanked, gift: corpse.gift };
    },

    nextDay(): void {
      S.day++;
      S.fallenToday = 0;
      S.runsToday = 0;
      S.omen = omenForSeed(S.daySeed(), S.day);
    },

    getHouse(): string | null {
      return S.house;
    },
    setHouse(name: string): void {
      if (S.house === null && name.trim() !== "") S.house = name.trim().slice(0, 20);
    },
    heirloomDue(): boolean {
      return (
        S.heirloom === 0 &&
        !S.heirloomOffered &&
        (S.generation >= 3) // picks at 3/6/9; slice offers the first
      );
    },
    pickHeirloom(id: number): void {
      S.heirloomOffered = true;
      S.heirloom = id;
    },
  };
  return ports;
}

function roman(n: number): string {
  const R = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return R[n] ?? String(n);
}
