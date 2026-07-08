/**
 * The Descent — run controller + ISO world renderer + input (02 §8, 04 §4.3).
 * Fidelity pass: per-tile candlelight tints, verdigris memory-ghost for
 * remembered tiles, glide tweens, drop shadows, breathing idle animation,
 * moth wing flutter, pooled source glows, dust motes, vignette + film grain.
 * The sim never learns any of this exists; projection/depth stay in iso.ts.
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
import { entityTextureFor, groundIndexFor, propTextureFor } from "../render/tilemap.js";
import {
  computeLightMap,
  flickerHalo,
  MEMORY_TINT,
  positionHalo,
  pulseGlows,
  syncSourceGlows,
  tintForLight,
  type GlowPool,
} from "../render/lights.js";
import {
  calibrate,
  depthOf,
  gridRef,
  gridToScreen,
  HALF_H,
  HALF_W,
  Layer,
  OCCLUDED_ALPHA,
  OCCLUSION_FADE_MS,
  occludes,
  screenToGrid,
  TILE_H,
  TILE_W,
  worldBounds,
} from "../render/iso.js";
import { Hud } from "../render/hud.js";
import { closeAllSheets } from "../ui/dom.js";
import { openEpitaphSheet, openExitSheet, openWaystoneSheet } from "../ui/sheets.js";

const DIRS = { N: 0, E: 1, S: 2, W: 3 } as const;
const RULES_KEY = "uv-session-rules";
const DEV_DAY = 1;
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

const DEPTH_CURSOR = 550;
const DEPTH_DUST = 580;
const DEPTH_HALO = 600; // above world (≤ ~470), below chrome
const DEPTH_VIGNETTE = 900;
const DEPTH_GRAIN = 901; // HUD sits at 1000+
const LONG_PRESS_MS = 400;
const GLIDE_MS = 85;

interface PropView {
  sprite: Phaser.GameObjects.Image;
  tile: number;
  occluded: boolean;
}

export class DescentScene extends Phaser.Scene {
  private ports!: GamePorts;
  private rules!: SessionRules;
  private state!: SimState;
  private visibleMask!: Uint8Array;

  private map: Phaser.Tilemaps.Tilemap | null = null;
  private groundLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  private lastTiles!: Uint8Array;
  private props = new Map<number, PropView>();
  private overlays = new Map<string, Phaser.GameObjects.Image>();
  private glowPool: GlowPool = { images: new Map() };
  private cursorG!: Phaser.GameObjects.Graphics;
  private halo!: Phaser.GameObjects.Image;
  private vignette!: Phaser.GameObjects.Image;
  private grain!: Phaser.GameObjects.TileSprite;
  private dust: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private playerView!: Phaser.GameObjects.Image;
  private playerShadow!: Phaser.GameObjects.Image;
  private entityViews = new Map<number, Phaser.GameObjects.Image>();
  private entityShadows = new Map<number, Phaser.GameObjects.Image>();
  private entityKinds = new Map<number, number>();
  private entityLastX = new Map<number, number>();
  private hud!: Hud;

  private queue: number[] = [];
  private lastStep = 0;
  private facing: number = DIRS.S;
  private overlayOpen = false;
  private baselineDiscoveries = 0;

  private pressTile: { x: number; y: number } | null = null;
  private pressAt = 0;
  private pressConsumed = false;

  constructor() {
    super("Descent");
  }

  create(): void {
    this.ports = this.registry.get(PORTS_KEY) as GamePorts;
    const existing = this.registry.get(RULES_KEY) as SessionRules | undefined;
    this.rules = existing ?? new SessionRules();
    this.registry.set(RULES_KEY, this.rules);
    this.baselineDiscoveries = this.rules.learned.length;

    const host = this.game.canvas.parentElement;
    if (host !== null) closeAllSheets(host);
    this.overlayOpen = false;
    this.queue = [];
    this.entityViews.clear();
    this.entityShadows.clear();
    this.entityKinds.clear();
    this.entityLastX.clear();
    this.props.clear();
    this.overlays.clear();
    this.glowPool = { images: new Map() };
    this.map = null;
    this.groundLayer = null;
    this.dust = null;

    const f = this.ports.getFloor(1);
    this.state = initState(f.floorData, f.rngInit);
    this.visibleMask = visibleFor(this.state);

    this.halo = this.add.image(0, 0, "halo");
    this.halo.setBlendMode(Phaser.BlendModes.ADD);
    this.halo.depth = DEPTH_HALO;
    this.cursorG = this.add.graphics();
    this.cursorG.depth = DEPTH_CURSOR;

    this.playerShadow = this.add.image(0, 0, "iso-shadow");
    this.playerView = this.add.image(0, 0, "iso-player");
    this.playerView.setOrigin(0.5, 1);

    // Atmosphere chrome (screen-fixed, under the HUD)
    this.vignette = this.add.image(CANVAS.width >> 1, CANVAS.height >> 1, "uv-vignette");
    this.vignette.setScrollFactor(0);
    this.vignette.depth = DEPTH_VIGNETTE;
    this.grain = this.add.tileSprite(CANVAS.width >> 1, CANVAS.height >> 1, CANVAS.width, CANVAS.height, "uv-grain");
    this.grain.setScrollFactor(0);
    this.grain.depth = DEPTH_GRAIN;

    // Dust motes drifting through the candle's reach
    this.dust = this.add.particles(0, 0, "iso-mote", {
      lifespan: 2800,
      frequency: 340,
      quantity: 1,
      speedY: { min: -12, max: -4 },
      speedX: { min: -5, max: 5 },
      alpha: { start: 0.34, end: 0 },
      scale: { start: 0.9, end: 0.35 },
      emitZone: {
        type: "random",
        source: new Phaser.Geom.Rectangle(-84, -64, 168, 116),
        quantity: 1,
      },
      follow: this.playerView,
    });
    this.dust.setDepth(DEPTH_DUST);

    this.buildFloor();

    this.hud = new Hud(this, {
      onCup: () => this.enqueue(Action.CUP),
      onSnuffComplete: () => this.enqueueSnuff(),
      onRelight: () => this.enqueueRelight(),
      onRestart: () => this.restartRun(),
    });

    this.bindInput();
    this.redraw(true);
    this.hud.toast("The match catches. The Vault is listening.", "info");
  }

  // ── Floor construction ───────────────────────────────────────────────────
  private buildFloor(): void {
    const s = this.state;
    this.groundLayer?.destroy();
    this.map?.destroy();
    this.props.forEach((p) => p.sprite.destroy());
    this.props.clear();
    this.overlays.forEach((o) => o.destroy());
    this.overlays.clear();
    this.glowPool.images.forEach((g) => g.destroy());
    this.glowPool.images.clear();
    this.entityViews.forEach((v) => v.destroy());
    this.entityViews.clear();
    this.entityShadows.forEach((v) => v.destroy());
    this.entityShadows.clear();
    this.entityKinds.clear();
    this.entityLastX.clear();

    const mapData = new Phaser.Tilemaps.MapData({
      name: `floor-${s.floor}`,
      width: s.w,
      height: s.h,
      tileWidth: TILE_W,
      tileHeight: TILE_H,
      orientation: Phaser.Tilemaps.Orientation.ISOMETRIC,
      format: Phaser.Tilemaps.Formats.ARRAY_2D,
    });
    this.map = new Phaser.Tilemaps.Tilemap(this, mapData);
    const tileset = this.map.addTilesetImage("iso-ground", "iso-ground", TILE_W, TILE_H, 0, 0);
    if (tileset === null) throw new Error("iso-ground tileset missing");
    const layer = this.map.createBlankLayer("ground", tileset, 0, 0);
    if (layer === null) throw new Error("ground layer creation failed");
    this.groundLayer = layer;
    layer.setDepth(0);

    const p00 = layer.tileToWorldXY(0, 0);
    calibrate(p00.x + HALF_W, p00.y + HALF_H);

    this.lastTiles = new Uint8Array(s.tiles.length);
    this.lastTiles.fill(255);
    this.syncTiles();

    const b = worldBounds(s.w, s.h);
    this.cameras.main.setBounds(b.x, b.y, b.width, b.height);
    this.cameras.main.startFollow(this.playerView, true, 0.12, 0.12);
  }

  private syncTiles(): void {
    const s = this.state;
    for (let i = 0; i < s.tiles.length; i++) {
      const t = s.tiles[i]!;
      if (t === this.lastTiles[i]!) continue;
      this.lastTiles[i] = t;
      const x = i % s.w;
      const y = (i / s.w) | 0;
      this.groundLayer?.putTileAt(groundIndexFor(t, x, y), x, y);

      const want = propTextureFor(t);
      const have = this.props.get(i);
      if (have !== undefined && (want === "" || have.tile !== t)) {
        have.sprite.destroy();
        this.props.delete(i);
      }
      if (want !== "" && this.props.get(i) === undefined) {
        const c = gridToScreen(x, y);
        const sprite = this.add.image(c.sx, c.sy + HALF_H, want);
        sprite.setOrigin(0.5, 1);
        const isItem = t === Tile.WAX_DRIP || t === Tile.WAX_STUB || t === Tile.WAX_CAKE;
        sprite.depth = depthOf(x, y, isItem ? Layer.ITEM : Layer.WALL);
        this.props.set(i, { sprite, tile: t, occluded: false });
      } else if (want !== "") {
        this.props.get(i)!.tile = t;
      }
    }
  }

  // ── Input ────────────────────────────────────────────────────────────────
  private bindInput(): void {
    const kb = this.input.keyboard;
    if (kb !== null) {
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
      kb.on("keydown-X", () => this.enqueueSnuff());
    }

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.overlayOpen) return;
      if (p.y > CANVAS.height - 80 || p.y < 60) return;
      if (p.x < 64 && p.y > 90 && p.y < 470) return;
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      this.pressTile = screenToGrid(wp.x, wp.y, this.state.w, this.state.h);
      this.pressAt = this.time.now;
      this.pressConsumed = false;
    });

    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      const press = this.pressTile;
      this.pressTile = null;
      if (press === null || this.pressConsumed || this.overlayOpen) return;
      if (this.time.now - this.pressAt >= LONG_PRESS_MS) return;
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      const up = screenToGrid(wp.x, wp.y, this.state.w, this.state.h);
      if (up === null || up.x !== press.x || up.y !== press.y) return;
      this.tapTile(press.x, press.y);
    });

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (this.overlayOpen) {
        this.cursorG.clear();
        return;
      }
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      const t = screenToGrid(wp.x, wp.y, this.state.w, this.state.h);
      this.cursorG.clear();
      if (t === null) return;
      const c = gridToScreen(t.x, t.y);
      this.cursorG.lineStyle(1.2, COLOR.bone, 0.85);
      this.cursorG.beginPath();
      this.cursorG.moveTo(c.sx, c.sy - HALF_H);
      this.cursorG.lineTo(c.sx + HALF_W, c.sy);
      this.cursorG.lineTo(c.sx, c.sy + HALF_H);
      this.cursorG.lineTo(c.sx - HALF_W, c.sy);
      this.cursorG.closePath();
      this.cursorG.strokePath();
      this.cursorG.lineStyle(1, COLOR.flameHi, 0.25);
      this.cursorG.strokeCircle(c.sx, c.sy, 3);
    });
  }

  private tapTile(tx: number, ty: number): void {
    const dx = tx - this.state.px;
    const dy = ty - this.state.py;
    if (dx === 0 && dy === 0) {
      const onStairs = this.state.tiles[ty * this.state.w + tx] === Tile.STAIRS_DOWN;
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
  }

  private inspect(tx: number, ty: number): void {
    const i = ty * this.state.w + tx;
    if (this.state.seen[i]! !== 1) {
      this.hud.toast(`Fl. ${ROMAN[this.state.floor]} · ${gridRef(tx, ty)} — unseen dark`, "info");
      return;
    }
    const names: Record<number, string> = {
      [Tile.WALL]: "vault wall",
      [Tile.FLOOR]: "stone floor",
      [Tile.MOSS]: "soft moss",
      [Tile.WEBBING]: "dry webbing",
      [Tile.DOOR_CLOSED]: "a closed door",
      [Tile.DOOR_STUCK]: "a stuck door",
      [Tile.DOOR_OPEN]: "an open door",
      [Tile.ENTRY]: "the way out",
      [Tile.STAIRS_DOWN]: "stairs down",
      [Tile.WAYSTONE]: "a waystone",
      [Tile.BRAZIER_UNLIT]: "a cold brazier",
      [Tile.BRAZIER_LIT]: "a lit brazier",
      [Tile.WAX_DRIP]: "wax drippings",
      [Tile.WAX_STUB]: "a candle stub",
      [Tile.WAX_CAKE]: "a wax cake",
    };
    const what = names[this.state.tiles[i]!] ?? "…";
    this.hud.toast(`Fl. ${ROMAN[this.state.floor]} · ${gridRef(tx, ty)} — ${what}`, "info");
  }

  private enqueue(op: number): void {
    if (this.overlayOpen || this.state.status !== Status.ALIVE) return;
    if (this.queue.length < 4) this.queue.push(op);
  }

  private enqueueSnuff(): void {
    if (this.state.candle === Candle.SNUFFED) return;
    if (this.queue.length > 0) return;
    for (let i = 0; i < SNUFF_TICKS; i++) this.enqueue(Action.SNUFF);
  }

  private enqueueRelight(): void {
    if (this.state.candle !== Candle.SNUFFED) return;
    if (this.queue.length > 0) return;
    for (let i = 0; i < RELIGHT_TICKS; i++) this.enqueue(Action.RELIGHT);
  }

  // ── Frame loop (cosmetics only — the world moves per action) ────────────
  override update(time: number): void {
    this.hud.updateFrame(time);
    flickerHalo(this.halo, effectiveRadius(this.state));
    pulseGlows(this.glowPool, time);
    this.grain.setTilePosition(Math.random() * 128, Math.random() * 128);

    // idle breathing / moth flutter (flipX owns mirroring; scale stays +)
    this.entityViews.forEach((view, id) => {
      if (!view.visible) return;
      const kind = this.entityKinds.get(id)!;
      if (kind === EntityKind.MOTH) {
        const frame = ((time / 130) | 0) % 2 === 0 ? "iso-ent-3" : "iso-ent-3b";
        if (view.texture.key !== frame) view.setTexture(frame);
        view.setScale(1, 1 + 0.04 * Math.sin(time / 90 + id));
      } else {
        const speed = kind === EntityKind.BEAST ? 640 : 300;
        const amp = kind === EntityKind.BEAST ? 0.02 : 0.035;
        view.setScale(1, 1 + amp * Math.sin(time / speed + id * 1.7));
      }
    });
    this.playerView.setScale(1, 1 + 0.02 * Math.sin(time / 420));

    if (this.pressTile !== null && !this.pressConsumed && time - this.pressAt >= LONG_PRESS_MS) {
      this.pressConsumed = true;
      this.inspect(this.pressTile.x, this.pressTile.y);
    }

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
      this.hud.toast("◆ The Vault yields a truth — bank it at a Waystone", "discovery");
    }

    for (const e of result.events) this.handleEvent(e);

    if (this.state.status === Status.DESCENDING) {
      const nf = this.ports.getFloor(this.state.floor + 1);
      this.state = descendState(this.state, nf.floorData, nf.rngInit);
      this.visibleMask = visibleFor(this.state);
      this.queue = [];
      this.buildFloor();
      this.cameras.main.flash(MOTION.ceremonial, 11, 10, 16);
      this.hud.toast(`Floor ${this.state.floor}. The dark is thicker here.`, "warning");
      this.redraw(true);
    } else {
      this.redraw(false);
    }

    if (this.state.status === Status.DEAD) this.openEpitaph();
    else if (this.state.status === Status.EXITED) this.openExit();
  }

  private handleEvent(e: OutcomeEvent): void {
    switch (e.type) {
      case Ev.WAYSTONE_TOUCHED:
        this.openWaystone();
        break;
      case Ev.STAIRS_TOUCHED:
        this.hud.toast("Stairs down. Enter (or tap yourself) to descend.", "info");
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
      default:
        break;
    }
  }

  // ── Rendering ────────────────────────────────────────────────────────────
  private glide(img: Phaser.GameObjects.Image, x: number, y: number, depth: number, instant: boolean): void {
    this.tweens.killTweensOf(img);
    img.depth = depth;
    if (instant) {
      img.setPosition(x, y);
    } else {
      this.tweens.add({ targets: img, x, y, duration: GLIDE_MS, ease: "Sine.easeOut" });
    }
  }

  private redraw(instant: boolean): void {
    const s = this.state;
    this.syncTiles();

    const effR = effectiveRadius(s);
    const light = computeLightMap(s, this.visibleMask, effR);

    // ground: candlelight tints, memory ghost; unseen tiles do not exist
    const layer = this.groundLayer;
    if (layer !== null) {
      for (let y = 0; y < s.h; y++) {
        for (let x = 0; x < s.w; x++) {
          const tile = layer.getTileAt(x, y);
          if (tile === null) continue;
          const i = y * s.w + x;
          if (this.visibleMask[i]! === 1) {
            tile.tint = tintForLight(light[i]!);
            tile.setAlpha(1);
          } else if (s.seen[i]! === 1) {
            tile.tint = MEMORY_TINT;
            tile.setAlpha(1);
          } else {
            tile.setAlpha(0); // the dark is absolute — no silhouette grid
          }
        }
      }
    }

    positionHalo(this.halo, s, effR);
    this.halo.setTint(COLOR.flame);
    syncSourceGlows(this, this.glowPool, s, this.visibleMask, DEPTH_HALO - 1);

    // player + shadow
    const pc = gridToScreen(s.px, s.py);
    const pi = s.py * s.w + s.px;
    this.glide(this.playerView, pc.sx, pc.sy + HALF_H - 2, depthOf(s.px, s.py, Layer.ENTITY), instant);
    this.glide(this.playerShadow, pc.sx, pc.sy + 4, depthOf(s.px, s.py, Layer.CORPSE), instant);
    this.playerView.setFlipX(this.facing === DIRS.W);
    this.playerView.setTint(
      s.candle === Candle.SNUFFED ? MEMORY_TINT : tintForLight(Math.min(light[pi]! + 0.25, 1)),
    );
    this.playerShadow.setAlpha(this.visibleMask[pi]! === 1 ? 0.8 : 0.3);

    // flat overlays: salt / chalk / fire
    const wantOverlay = (kind: string, i: number, tint: number, alpha: number): void => {
      const key = `${kind}:${i}`;
      let img = this.overlays.get(key);
      if (img === undefined) {
        const x = i % s.w;
        const y = (i / s.w) | 0;
        const c = gridToScreen(x, y);
        img = this.add.image(c.sx, c.sy, "iso-diamond");
        img.depth = depthOf(x, y, Layer.CORPSE);
        this.overlays.set(key, img);
      }
      img.setTint(tint);
      img.setAlpha(alpha);
      img.setVisible(true);
    };
    this.overlays.forEach((img) => img.setVisible(false));
    for (let i = 0; i < s.tiles.length; i++) {
      if (this.visibleMask[i]! !== 1 && s.seen[i]! !== 1) continue;
      const dim = this.visibleMask[i]! === 1 ? 1 : 0.45;
      if (s.salt[i]! !== 0) wantOverlay("salt", i, COLOR.parchment, 0.45 * dim);
      if (s.chalk[i]! !== 0) wantOverlay("chalk", i, COLOR.parchment, 0.32 * dim);
      if (s.fire[i]! > 0) wantOverlay("fire", i, COLOR.ember, 0.75 * dim);
    }

    // props: lit tint / memory ghost / hidden — plus wall occlusion fade
    this.props.forEach((prop, i) => {
      const x = i % s.w;
      const y = (i / s.w) | 0;
      const seen = s.seen[i]! === 1;
      const vis = this.visibleMask[i]! === 1;
      prop.sprite.setVisible(seen);
      if (!seen) return;
      prop.sprite.setTint(vis ? tintForLight(Math.min(light[i]! + 0.08, 1)) : MEMORY_TINT);
      const isWallish =
        prop.tile === Tile.WALL || prop.tile === Tile.DOOR_CLOSED || prop.tile === Tile.DOOR_STUCK;
      const shouldOcclude = isWallish && occludes(s.px, s.py, x, y);
      const targetAlpha = shouldOcclude ? OCCLUDED_ALPHA : 1;
      if (shouldOcclude !== prop.occluded) {
        prop.occluded = shouldOcclude;
        this.tweens.add({ targets: prop.sprite, alpha: targetAlpha, duration: OCCLUSION_FADE_MS });
      } else if (!this.tweens.isTweening(prop.sprite)) {
        prop.sprite.setAlpha(targetAlpha);
      }
    });

    // entities: glide, flip, breathe (in update), candle-lit tint + shadow
    const alive = new Set<number>();
    for (const ent of s.entities) {
      alive.add(ent.id);
      let view = this.entityViews.get(ent.id);
      let shadowView = this.entityShadows.get(ent.id);
      if (view === undefined) {
        view = this.add.image(0, 0, entityTextureFor(ent.kind));
        view.setOrigin(0.5, 1);
        shadowView = this.add.image(0, 0, "iso-shadow");
        if (ent.kind === EntityKind.BEAST) shadowView.setScale(1.6, 1.6);
        else if (ent.kind === EntityKind.MOTH) shadowView.setScale(0.5, 0.5);
        this.entityViews.set(ent.id, view);
        this.entityShadows.set(ent.id, shadowView);
        this.entityKinds.set(ent.id, ent.kind);
        this.entityLastX.set(ent.id, ent.x);
      }
      const c = gridToScreen(ent.x, ent.y);
      const i = ent.y * s.w + ent.x;
      const isMoth = ent.kind === EntityKind.MOTH;
      this.glide(view, c.sx, c.sy + HALF_H - (isMoth ? 14 : 2), depthOf(ent.x, ent.y, Layer.ENTITY), instant);
      if (shadowView !== undefined) {
        this.glide(shadowView, c.sx, c.sy + 4, depthOf(ent.x, ent.y, Layer.CORPSE), instant);
      }
      const lastX = this.entityLastX.get(ent.id)!;
      if (ent.x !== lastX) view.setFlipX(ent.x < lastX);
      this.entityLastX.set(ent.id, ent.x);

      const tileVisible = this.visibleMask[i]! === 1;
      const burrowed = ent.kind === EntityKind.WICKWORM && ent.state === WormState.BURROWED;
      const telegraph = ent.kind === EntityKind.WICKWORM && ent.state === WormState.TELEGRAPH;
      view.setVisible(tileVisible && !burrowed);
      shadowView?.setVisible(tileVisible && !burrowed);
      view.setTint(tintForLight(Math.min(light[i]! + 0.18, 1)));
      view.setAlpha(telegraph ? 0.6 : 1);
    }
    this.entityViews.forEach((view, id) => {
      if (!alive.has(id)) {
        view.destroy();
        this.entityViews.delete(id);
        this.entityShadows.get(id)?.destroy();
        this.entityShadows.delete(id);
        this.entityKinds.delete(id);
        this.entityLastX.delete(id);
      }
    });

    this.hud.update(s, effR, DEV_DAY);
  }

  // ── Sheets ───────────────────────────────────────────────────────────────
  private host(): HTMLElement | null {
    return this.game.canvas.parentElement;
  }

  private runSummary(): { ticks: number; discoveries: number; floor: number; day: number } {
    let discoveries = 0;
    for (const r of this.rules.learned.slice(this.baselineDiscoveries)) {
      if (r.effect !== Effect.NONE) discoveries++;
    }
    return { ticks: this.state.tick, discoveries, floor: this.state.floor, day: DEV_DAY };
  }

  private openWaystone(): void {
    const host = this.host();
    if (host === null || this.overlayOpen) return;
    this.overlayOpen = true;
    openWaystoneSheet(host, this.rules.learned.slice(this.baselineDiscoveries), () => {
      this.overlayOpen = false;
    });
  }

  private openEpitaph(): void {
    const host = this.host();
    if (host === null) return;
    closeAllSheets(host);
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
