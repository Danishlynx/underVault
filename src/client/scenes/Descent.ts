/**
 * The Descent — run controller + world renderer + input (04 §4.3, §6).
 * Turn-based: the world ticks exactly when the player acts. The sim is the
 * single source of truth; this scene renders SimState and forwards intents.
 * Unknown interactions resolve through the RulesPort (dev: instant local;
 * M2: synchronous act-batch flush masked by anticipation animation).
 */

import Phaser from "phaser";
import { COLOR, CANVAS, MOTION } from "../../../design/tokens/tokens.js";
import {
  descendState,
  effectiveRadius,
  initState,
  tickResolving,
  visibleFor,
} from "../../shared/sim/engine.js";
import {
  Action,
  Candle,
  Effect,
  Ev,
  EntityKind,
  Status,
  Tile,
  WormState,
  type OutcomeEvent,
  type SimState,
} from "../../shared/sim/types.js";
import { RELIGHT_TICKS, SNUFF_TICKS } from "../../shared/sim/constants.js";
import { PORTS_KEY } from "../game.js";
import type { GamePorts } from "../net/ports.js";
import { SessionRules } from "../net/ports.js";
import { drawTerrain, entityStyle } from "../render/tilemap.js";
import { drawFog, flickerHalo, positionHalo } from "../render/lights.js";
import { Hud } from "../render/hud.js";
import { closeAllSheets } from "../ui/dom.js";
import { openEpitaphSheet, openExitSheet, openWaystoneSheet } from "../ui/sheets.js";

const C = CANVAS.cellPx;
const DIRS = { N: 0, E: 1, S: 2, W: 3 } as const;
const RULES_KEY = "uv-session-rules";
const DEV_DAY = 1;

export class DescentScene extends Phaser.Scene {
  private ports!: GamePorts;
  private rules!: SessionRules;
  private state!: SimState;
  private visibleMask!: Uint8Array;

  private terrainG!: Phaser.GameObjects.Graphics;
  private fogG!: Phaser.GameObjects.Graphics;
  private halo!: Phaser.GameObjects.Image;
  private playerView!: Phaser.GameObjects.Container;
  private entityViews = new Map<number, Phaser.GameObjects.Container>();
  private hud!: Hud;

  private queue: number[] = [];
  private lastStep = 0;
  private facing: number = DIRS.S;
  private overlayOpen = false;
  private baselineDiscoveries = 0;

  constructor() {
    super("Descent");
  }

  create(): void {
    this.ports = this.registry.get(PORTS_KEY) as GamePorts;

    // Session-learned rules persist across dev restarts (02 §4 session cache)
    const existing = this.registry.get(RULES_KEY) as SessionRules | undefined;
    this.rules = existing ?? new SessionRules();
    this.registry.set(RULES_KEY, this.rules);
    this.baselineDiscoveries = this.rules.learned.length;

    const host = this.game.canvas.parentElement;
    if (host !== null) closeAllSheets(host);
    this.overlayOpen = false;
    this.queue = [];
    this.entityViews.clear();

    const f = this.ports.getFloor(1);
    this.state = initState(f.floorData, f.rngInit);
    this.visibleMask = visibleFor(this.state);

    this.terrainG = this.add.graphics();
    this.halo = this.add.image(0, 0, "halo");
    this.halo.setBlendMode(Phaser.BlendModes.ADD);
    this.fogG = this.add.graphics();
    this.fogG.depth = 10;

    this.playerView = this.buildPlayerView();
    this.playerView.depth = 5;

    this.hud = new Hud(this, {
      onCup: () => this.enqueue(Action.CUP),
      onSnuffComplete: () => this.enqueueSnuff(),
      onRelight: () => this.enqueueRelight(),
      onRestart: () => this.restartRun(),
    });

    this.cameras.main.setBounds(0, 0, this.state.w * C, this.state.h * C);
    this.cameras.main.startFollow(this.playerView, true, 0.15, 0.15);

    this.bindInput();
    this.redraw();
    this.hud.toast("The match catches. The Vault is listening.", "info");
  }

  // ── Input ────────────────────────────────────────────────────────────────
  private bindInput(): void {
    const kb = this.input.keyboard;
    if (kb === null) return;
    const move = (d: number, op: number): void => {
      this.facing = d;
      this.enqueue(op);
    };
    kb.on("keydown-W", () => move(DIRS.N, Action.MOVE_N));
    kb.on("keydown-UP", () => move(DIRS.N, Action.MOVE_N));
    kb.on("keydown-D", () => move(DIRS.E, Action.MOVE_E));
    kb.on("keydown-RIGHT", () => move(DIRS.E, Action.MOVE_E));
    kb.on("keydown-S", () => move(DIRS.S, Action.MOVE_S));
    kb.on("keydown-DOWN", () => move(DIRS.S, Action.MOVE_S));
    kb.on("keydown-A", () => move(DIRS.W, Action.MOVE_W));
    kb.on("keydown-LEFT", () => move(DIRS.W, Action.MOVE_W));
    kb.on("keydown-SPACE", () => this.enqueue(Action.WAIT));
    kb.on("keydown-C", () => this.enqueue(Action.CUP));
    kb.on("keydown-E", () => this.enqueue(Action.INTERACT_N + this.facing));
    kb.on("keydown-T", () => this.enqueue(Action.SALT_N + this.facing));
    kb.on("keydown-G", () => this.enqueue(Action.CHALK_MARK));
    kb.on("keydown-ENTER", () => this.enqueue(Action.DESCEND));
    kb.on("keydown-R", () => this.enqueueRelight());
    // X = hold-snuff on the HUD button; keyboard X snuffs via double-tap safety
    kb.on("keydown-X", () => this.enqueueSnuff());

    // Tap: adjacent tile = move/interact; own tile = wait (04 §4.3)
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.overlayOpen) return;
      if (p.y > CANVAS.height - 80 || p.y < 60) return; // HUD zones own their input
      if (p.x < 64 && p.y > 90 && p.y < 470) return; // CandleMeter strip owns its input
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      const tx = Math.floor(wp.x / C);
      const ty = Math.floor(wp.y / C);
      const dx = tx - this.state.px;
      const dy = ty - this.state.py;
      if (dx === 0 && dy === 0) {
        // tap self: descend when standing on stairs (matches the toast copy)
        const onStairs = this.state.tiles[this.state.py * this.state.w + this.state.px] === Tile.STAIRS_DOWN;
        this.enqueue(onStairs ? Action.DESCEND : Action.WAIT);
        return;
      }
      if (Math.abs(dx) + Math.abs(dy) !== 1) return;
      const dir = dy === -1 ? DIRS.N : dx === 1 ? DIRS.E : dy === 1 ? DIRS.S : DIRS.W;
      this.facing = dir;
      const t = this.state.tiles[ty * this.state.w + tx]!;
      const interactable =
        t === Tile.DOOR_CLOSED || t === Tile.DOOR_STUCK || t === Tile.BRAZIER_UNLIT ||
        t === Tile.WAYSTONE || t === Tile.STAIRS_DOWN || t === Tile.ENTRY;
      this.enqueue(interactable ? Action.INTERACT_N + dir : Action.MOVE_N + dir);
    });
  }

  private enqueue(op: number): void {
    if (this.overlayOpen || this.state.status !== Status.ALIVE) return;
    if (this.queue.length < 4) this.queue.push(op);
  }

  private enqueueSnuff(): void {
    if (this.state.candle === Candle.SNUFFED) return;
    if (this.queue.length > 0) return; // channels must queue whole or not at all
    for (let i = 0; i < SNUFF_TICKS; i++) this.enqueue(Action.SNUFF);
  }

  private enqueueRelight(): void {
    if (this.state.candle !== Candle.SNUFFED) return;
    if (this.queue.length > 0) return; // channels must queue whole or not at all
    for (let i = 0; i < RELIGHT_TICKS; i++) this.enqueue(Action.RELIGHT);
  }

  // ── Turn processing ──────────────────────────────────────────────────────
  override update(time: number): void {
    this.hud.updateFrame(time);
    flickerHalo(this.halo, effectiveRadius(this.state));
    if (this.queue.length > 0 && !this.overlayOpen && time - this.lastStep > 70) {
      this.lastStep = time;
      this.step(this.queue.shift()!);
    }
  }

  private meaningfulLearned(): number {
    let n = 0;
    for (const r of this.rules.learned) {
      if (r.effect !== Effect.NONE) n++;
    }
    return n;
  }

  private step(op: number): void {
    const before = this.meaningfulLearned();
    const result = tickResolving(this.state, op, this.rules, (key) => this.ports.resolveRule(key));
    this.state = result.state;
    this.visibleMask = result.visible;

    if (this.meaningfulLearned() > before) {
      // 02 §4: first-time outcome — at M2 this is where the anticipation
      // beat + synchronous flush live. Locally it resolves instantly.
      // (Effect.NONE learns stay silent — the Waystone would filter them.)
      this.hud.toast("◆ The Vault yields a truth — bank it at a Waystone", "discovery");
    }

    for (const e of result.events) this.handleEvent(e);

    if (this.state.status === Status.DESCENDING) {
      const nf = this.ports.getFloor(this.state.floor + 1);
      this.state = descendState(this.state, nf.floorData, nf.rngInit);
      this.visibleMask = visibleFor(this.state);
      this.entityViews.forEach((v) => v.destroy());
      this.entityViews.clear();
      this.queue = [];
      this.cameras.main.setBounds(0, 0, this.state.w * C, this.state.h * C);
      this.cameras.main.flash(MOTION.ceremonial, 11, 10, 16);
      this.hud.toast(`Floor ${this.state.floor}. The dark is thicker here.`, "warning");
    }

    this.redraw();

    if (this.state.status === Status.DEAD) this.openEpitaph();
    else if (this.state.status === Status.EXITED) this.openExit();
  }

  private handleEvent(e: OutcomeEvent): void {
    switch (e.type) {
      case Ev.WAYSTONE_TOUCHED:
        this.openWaystone();
        break;
      case Ev.STAIRS_TOUCHED:
        this.hud.toast("Stairs down. Press Enter (or stand and tap) to descend.", "info");
        break;
      case Ev.BRAZIER_LIT:
        this.hud.toast("The brazier holds. A gift to everyone after you.", "discovery");
        break;
      case Ev.GRACE_STARTED:
        this.hud.toast("The candle is spent. Find flame, or the way out.", "death");
        this.cameras.main.shake(MOTION.micro, 0.004);
        break;
      case Ev.PLAYER_HURT:
        this.cameras.main.shake(MOTION.micro, 0.003 + e.b * 0.0002);
        break;
      case Ev.FIRE_HURT:
        this.cameras.main.shake(MOTION.micro, 0.005);
        break;
      case Ev.MONSTER_MELTED:
        this.hud.toast("It melts away into the tallow.", "discovery");
        break;
      case Ev.WORM_TELEGRAPH:
        this.cameras.main.shake(80, 0.002);
        break;
      case Ev.REJECTED:
        break;
      default:
        break;
    }
  }

  // ── Rendering ────────────────────────────────────────────────────────────
  private buildPlayerView(): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    const body = this.add.rectangle(0, 0, 22, 22, COLOR.flame, 1);
    const core = this.add.circle(0, -4, 5, COLOR.flameHi, 1);
    c.add([body, core]);
    return c;
  }

  private buildEntityView(kind: number): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0);
    const st = entityStyle(kind);
    const body = this.add.rectangle(0, 0, st.size, st.size, st.color, 1);
    if (kind === EntityKind.MOTH) body.setAngle(45);
    const core = this.add.circle(0, 0, Math.max(3, st.size >> 3), st.core, 1);
    c.add([body, core]);
    c.depth = 4;
    return c;
  }

  private redraw(): void {
    const s = this.state;
    drawTerrain(this.terrainG, s);
    drawFog(this.fogG, s, this.visibleMask);
    positionHalo(this.halo, s, effectiveRadius(s));

    this.playerView.setPosition(s.px * C + (C >> 1), s.py * C + (C >> 1));
    const playerBody = this.playerView.getAt(0) as Phaser.GameObjects.Rectangle;
    const playerCore = this.playerView.getAt(1) as Phaser.GameObjects.Arc;
    playerBody.setFillStyle(s.candle === Candle.SNUFFED ? COLOR.boneDim : COLOR.flame, 1);
    playerCore.setVisible(s.candle !== Candle.SNUFFED && s.graceLeft === 0);
    playerCore.setFillStyle(s.candle === Candle.CUPPED ? COLOR.ember : COLOR.flameHi, 1);

    // Entities: create/update/remove views; hide outside FOV / burrowed
    const alive = new Set<number>();
    for (const ent of s.entities) {
      alive.add(ent.id);
      let view = this.entityViews.get(ent.id);
      if (view === undefined) {
        view = this.buildEntityView(ent.kind);
        this.entityViews.set(ent.id, view);
      }
      view.setPosition(ent.x * C + (C >> 1), ent.y * C + (C >> 1));
      const tileVisible = this.visibleMask[ent.y * s.w + ent.x]! === 1;
      const burrowed = ent.kind === EntityKind.WICKWORM && ent.state === WormState.BURROWED;
      const telegraph = ent.kind === EntityKind.WICKWORM && ent.state === WormState.TELEGRAPH;
      view.setVisible(tileVisible && !burrowed);
      view.setAlpha(telegraph ? 0.6 : 1);
    }
    this.entityViews.forEach((view, id) => {
      if (!alive.has(id)) {
        view.destroy();
        this.entityViews.delete(id);
      }
    });

    this.hud.update(s, effectiveRadius(s), DEV_DAY);
  }

  // ── Sheets (DOM overlays) ────────────────────────────────────────────────
  private host(): HTMLElement | null {
    return this.game.canvas.parentElement;
  }

  private runSummary(): { ticks: number; discoveries: number; floor: number; day: number } {
    let discoveries = 0;
    for (const r of this.rules.learned.slice(this.baselineDiscoveries)) {
      if (r.effect !== Effect.NONE) discoveries++;
    }
    return {
      ticks: this.state.tick,
      discoveries,
      floor: this.state.floor,
      day: DEV_DAY,
    };
  }

  private openWaystone(): void {
    const host = this.host();
    if (host === null || this.overlayOpen) return;
    this.overlayOpen = true;
    // only THIS run's discoveries are bankable (session cache persists, but
    // unbanked truths die with the delver — 01 §10)
    openWaystoneSheet(host, this.rules.learned.slice(this.baselineDiscoveries), () => {
      this.overlayOpen = false;
    });
  }

  private openEpitaph(): void {
    const host = this.host();
    if (host === null) return;
    closeAllSheets(host); // death outranks any open sheet (waystone same-tick)
    this.overlayOpen = true;
    openEpitaphSheet(host, this.state, this.runSummary(), () => this.restartRun());
  }

  private openExit(): void {
    const host = this.host();
    if (host === null) return;
    closeAllSheets(host);
    this.overlayOpen = true;
    openExitSheet(host, this.state, this.runSummary(), () => this.restartRun());
  }

  private restartRun(): void {
    const host = this.host();
    if (host !== null) closeAllSheets(host);
    this.overlayOpen = false;
    this.scene.restart();
  }
}
