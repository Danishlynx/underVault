/**
 * The Descent v2 — the whole day loop, locally: Guildhall → match-strike
 * (audio unlock) → run (full bestiary, items, doors, shrines, omens) →
 * bank ≤3 at waystones → death/exit/victory ceremonies → next day.
 * The sim is the only truth; this scene renders SimState, forwards Steps,
 * and narrates through toasts + the synthesized audio graph.
 */

import Phaser from "phaser";
import { COLOR, MOTION } from "../../../design/tokens/tokens.js";
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
  Item,
  MimicState,
  Status,
  Tile,
  WormState,
  type Entity,
  type OutcomeEvent,
  type SimState,
  type Step,
} from "../../shared/sim/types.js";
import {
  RELIGHT_TICKS,
  SNUFF_TICKS,
  SIGN_TEMPLATES,
  ECHO_KEYFRAMES,
  BIOMES,
  biomeFor,
  TILE_FLAGS,
  F_OPAQUE,
  MAX_FLOOR,
} from "../../shared/sim/constants.js";
import { PORTS_KEY } from "../game.js";
import type { EchoRecord, GamePorts, LearnedRule } from "../net/ports.js";
import { SessionRules } from "../net/ports.js";
import {
  ensureBiomeSkin,
  entityTextureFor,
  floorDecoFor,
  groundIndexFor,
  isWallishTile,
  propTextureFor,
  skinSuffix,
  TEX_SCALE,
  GROUND_SCALE,
} from "../render/tilemap.js";
import {
  computeGlowTints,
  computeLightMap,
  flickerHalo,
  lerpColor,
  MEMORY_TINT,
  positionHalo,
  pulseGlows,
  setBiomeGrade,
  syncSourceGlows,
  tintForLight,
  type GlowPool,
} from "../render/lights.js";
import {
  calibrate,
  depthOf,
  fitZoom,
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
import {
  addSnuffGrade,
  armBloomValve,
  removeSnuffGrade,
  setupWorldFilters,
  setVignetteDepth,
  vignetteBreath,
  vignetteHurt,
  type WorldFx,
} from "../render/fx.js";
import { closeAllSheets } from "../ui/dom.js";
import {
  openEpitaphSheet,
  openExitSheet,
  openHeirloomSheet,
  openVictorySheet,
  openWaystoneSheet,
} from "../ui/sheets.js";
import { openGuildhall } from "../ui/guildhall.js";
import { openStoryIntro } from "../ui/story.js";
import { openCodexSheet } from "../ui/codex.js";
import { openSignComposer } from "../ui/signs.js";
import { describeRuleKey, earnedNouns } from "../ui/vocab.js";
import { AudioGraph, type Cue } from "../audio/graph.js";

const DIRS = { N: 0, E: 1, S: 2, W: 3 } as const;
const RULES_KEY = "uv-session-rules";
const AUDIO_KEY = "uv-audio";
const AUTOSTART_KEY = "uv-autostart";
const GUIDES_KEY = "uv-guides"; // once-per-session lessons (memory only, inv. 3)
const VIEW_KEY = "uv-view"; // D67 camera experiment (memory only, inv. 3)
const STORY_KEY = "uv-story-told"; // the telling plays once per session (D79)
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX",
  "XXI", "XXII", "XXIII", "XXIV", "XXV"];

const DEPTH_CURSOR = 550;
const DEPTH_DUST = 580;
const DEPTH_HALO = 600;
const DEPTH_GHOST = 590;
const DEPTH_GRAIN = 901;
const LONG_PRESS_MS = 400;
// must complete INSIDE the 70ms queue drain — a longer glide gets truncated
// by killTweensOf every held-key step and the sprite chronically lags its
// logical tile (D73)
const GLIDE_MS = 64;

const TILE_NAMES: Record<number, string> = {
  [Tile.WALL]: "vault wall",
  [Tile.FLOOR]: "stone floor",
  [Tile.MOSS]: "soft moss",
  [Tile.WEBBING]: "dry webbing",
  [Tile.DOOR_CLOSED]: "a closed door",
  [Tile.DOOR_STUCK]: "a stuck door",
  [Tile.DOOR_OPEN]: "an open door",
  [Tile.DOOR_IRON]: "an iron door",
  [Tile.DOOR_SIGIL]: "a sigil-carved door",
  [Tile.DOOR_HUNGER]: "a door with a mouth",
  [Tile.DOOR_CHOIR]: "a door strung like a harp",
  [Tile.ENTRY]: "the way out",
  [Tile.STAIRS_DOWN]: "stairs down",
  [Tile.WAYSTONE]: "a waystone",
  [Tile.BRAZIER_UNLIT]: "a cold brazier",
  [Tile.BRAZIER_LIT]: "a lit brazier",
  [Tile.WAX_DRIP]: "wax drippings",
  [Tile.WAX_STUB]: "a candle stub",
  [Tile.WAX_CAKE]: "a wax cake",
  [Tile.WATER]: "black water",
  [Tile.GLOWMOSS]: "glowmoss",
  [Tile.INSCRIPTION]: "a carved inscription",
  [Tile.CHEST]: "a chest",
  [Tile.PLATE]: "a floor plate",
  [Tile.ALTAR]: "a tallow altar",
  [Tile.POOL]: "a mirror pool",
  [Tile.FONT]: "a nameless font",
  [Tile.SEAL]: "the Bottom Seal",
  [Tile.KEY_DROP]: "an iron key",
};

interface PropView {
  sprite: Phaser.GameObjects.Image;
  tile: number;
  occluded: boolean;
}

interface EchoPlayback {
  frames: EchoRecord["frames"];
  index: number;
  img: Phaser.GameObjects.Image;
  nextAt: number;
}

export class DescentScene extends Phaser.Scene {
  private ports!: GamePorts;
  private rules!: SessionRules;
  private audio!: AudioGraph;
  private state: SimState | null = null;
  private visibleMask: Uint8Array = new Uint8Array(0);
  private running = false;

  private worldLayer!: Phaser.GameObjects.Layer;
  private uiLayer!: Phaser.GameObjects.Layer;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private map: Phaser.Tilemaps.Tilemap | null = null;
  private groundLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  private lastTiles: Uint8Array = new Uint8Array(0);
  private props = new Map<number, PropView>();
  private decos = new Map<number, Phaser.GameObjects.Image>();
  // diorama under-skirts, keyed i (south face) / i + tiles.length (east)
  private skirts = new Map<number, Phaser.GameObjects.Image>();
  private skin = ""; // current biome texture-key suffix (D70)
  private overlays = new Map<string, Phaser.GameObjects.Image>();
  private glowPool: GlowPool = { images: new Map() };
  private cursorG!: Phaser.GameObjects.Graphics;
  private halo!: Phaser.GameObjects.Image;
  private fx!: WorldFx;
  private followBias = 0; // HUD-aware vertical bias (applyViewport)
  private camPullX = 0; // frame the LIT world, not just the player (D81)
  private camPullY = 0;
  private cavern: Phaser.GameObjects.Image[] = []; // the dark is a place (D81)
  private deepMotes: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private snuffGrade: Phaser.Filters.ColorMatrix | null = null;
  private baseZoom = 1;
  private hitStopUntil = 0;
  private dustWell: Phaser.GameObjects.Particles.GravityWell | null = null;
  private dustZone: Phaser.Geom.Ellipse | null = null;
  private grain!: Phaser.GameObjects.TileSprite;
  private dust: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private playerView!: Phaser.GameObjects.Image;
  private playerShadow!: Phaser.GameObjects.Image;
  private entityViews = new Map<number, Phaser.GameObjects.Image>();
  private entityShadows = new Map<number, Phaser.GameObjects.Image>();
  private entityKinds = new Map<number, number>();
  private entityLastX = new Map<number, number>();
  private hud!: Hud;

  private queue: Step[] = [];
  private lastStep = 0;
  private lastGrainShift = 0;
  private facing: number = DIRS.S;
  private overlayOpen = false;

  private runBaseline = 0; // rules.learned length at run start
  private bankedKeys = new Set<string>();
  private pendingBank: LearnedRule[] | null = null; // committed only on Ev.BANKED
  private feverOn = false; // Fever Ring proximity edge-trigger
  private recovered: LearnedRule[] = [];
  private echoRing: { x: number; y: number; candle: number }[] = [];
  private floorEchoes: EchoRecord[] = [];
  private echoPlayed = new Set<number>();
  private activeEcho: EchoPlayback | null = null;
  private lastTellAt = 0;
  private preTickRadius = 0; // light radius before the tick (TIER_CHANGED direction)

  private pressTile: { x: number; y: number } | null = null;
  private pressAt = 0;
  private pressConsumed = false;
  private pendingBump: { x: number; y: number } | null = null;

  private guides!: Set<string>;
  private lastGuideAt = 0;

  /** D67 camera experiment: "scout" = fit the room (default), "delve" =
   *  close follow — Hades-style in-the-action framing. Session-sticky. */
  private viewMode: "scout" | "delve" = "scout";

  constructor() {
    super("Descent");
  }

  create(): void {
    this.ports = this.registry.get(PORTS_KEY) as GamePorts;
    const existingRules = this.registry.get(RULES_KEY) as SessionRules | undefined;
    this.rules = existingRules ?? new SessionRules();
    this.registry.set(RULES_KEY, this.rules);
    const existingAudio = this.registry.get(AUDIO_KEY) as AudioGraph | undefined;
    this.audio = existingAudio ?? new AudioGraph();
    this.registry.set(AUDIO_KEY, this.audio);
    const existingGuides = this.registry.get(GUIDES_KEY) as Set<string> | undefined;
    this.guides = existingGuides ?? new Set<string>();
    this.registry.set(GUIDES_KEY, this.guides);
    this.viewMode = (this.registry.get(VIEW_KEY) as "scout" | "delve" | undefined) ?? "scout";

    const host = this.host();
    if (host !== null) closeAllSheets(host);
    this.overlayOpen = false;
    this.running = false;
    this.state = null;
    this.queue = [];
    // stale press state survives scene.restart — a phantom long-press
    // would fire on the new run's first frames (D64)
    this.pressTile = null;
    this.pressConsumed = false;
    this.pendingBump = null;
    this.pendingBank = null;
    this.feverOn = false;
    this.props.clear();
    this.overlays.clear();
    this.entityViews.clear();
    this.entityShadows.clear();
    this.entityKinds.clear();
    this.entityLastX.clear();
    this.glowPool = { images: new Map() };
    this.map = null;
    this.groundLayer = null;
    this.dust = null;
    this.activeEcho = null;

    // chrome — split world/UI across two cameras so zoom-to-fit never
    // scales the HUD (Layers keep per-object depth sorting intact)
    const sw = this.scale.width;
    const sh = this.scale.height;
    this.worldLayer = this.add.layer();
    this.uiLayer = this.add.layer();
    this.uiCam = this.cameras.add(0, 0, sw, sh);
    this.cameras.main.ignore(this.uiLayer);
    this.uiCam.ignore(this.worldLayer);

    this.halo = this.add.image(0, 0, "halo");
    this.halo.setBlendMode(Phaser.BlendModes.ADD);
    this.halo.depth = DEPTH_HALO;
    this.halo.setVisible(false);
    this.worldLayer.add(this.halo);
    this.cursorG = this.add.graphics();
    this.cursorG.depth = DEPTH_CURSOR;
    this.worldLayer.add(this.cursorG);
    this.playerShadow = this.add.image(0, 0, "iso-shadow");
    this.playerShadow.setVisible(false);
    this.worldLayer.add(this.playerShadow);
    this.playerView = this.add.image(0, 0, "iso-player");
    this.playerView.setOrigin(0.5, 1);
    this.playerView.setScale(TEX_SCALE); // 4× master rendered at ¼ (D56)
    this.playerView.setVisible(false);
    this.worldLayer.add(this.playerView);
    // world-camera filter stack (D75/D77): bloom, then a GPU vignette that
    // darkens the bloomed frame — replaces the stretched uv-vignette texture
    // and leaves the HUD camera untouched
    this.fx = setupWorldFilters(this, this.cameras.main);
    this.snuffGrade = null;
    this.grain = this.add.tileSprite(sw >> 1, sh >> 1, sw, sh, "uv-grain");
    this.grain.setScrollFactor(0);
    this.grain.setAlpha(0); // clean pass (D60): film grain off — flat, artsy
    this.grain.depth = DEPTH_GRAIN;
    this.uiLayer.add(this.grain);

    this.scale.on("resize", this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.onResize, this);
    });

    this.hud = new Hud(
      this,
      {
        onCup: () => this.enqueue(Action.CUP),
        onSnuffComplete: () => this.enqueueSnuff(),
        onRelight: () => this.enqueueRelight(),
        onRestart: () => this.finishRun(false),
        onUseSlot: (slot) => this.useSlot(slot),
        onToggleMute: () => {
          this.audio.setMuted(!this.audio.muted);
          return this.audio.muted;
        },
      },
      this.uiLayer,
    );

    this.bindInput();

    // DEV-ONLY: deleted at M2 — the Tower X-Ray's click-to-teleport
    const onDevTeleport = (floor: number): void => this.devTeleport(floor);
    this.game.events.on("uv-dev-teleport", onDevTeleport);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off("uv-dev-teleport", onDevTeleport);
    });

    if (this.registry.get(AUTOSTART_KEY) === true) {
      this.registry.set(AUTOSTART_KEY, false);
      this.matchStrike();
    } else {
      this.showGuildhall();
    }
  }

  private host(): HTMLElement | null {
    return this.game.canvas.parentElement;
  }

  // ── Day flow ─────────────────────────────────────────────────────────────
  private showGuildhall(): void {
    const host = this.host();
    if (host === null) return;
    this.overlayOpen = true;
    // "The Last Wick" (D79): the telling plays once per session, before
    // the first dawn at the hall — every mechanic gets its why
    if (this.registry.get(STORY_KEY) !== true) {
      this.registry.set(STORY_KEY, true);
      openStoryIntro(host, () => this.openHallProper(host));
      return;
    }
    this.openHallProper(host);
  }

  private openHallProper(host: HTMLElement): void {
    let closeHall: (() => void) | null = null;
    closeHall = openGuildhall(
      host,
      this.ports.getGuildhall(),
      () => {
        closeHall?.();
        this.overlayOpen = false;
        this.matchStrike();
      },
      () => {
        const h2 = this.host();
        if (h2 !== null) {
          // pre-unlock (day one's first visit) this drops silently — correct;
          // after any match-strike the codex opens with a parchment whisper
          this.audio.play("sheet");
          openCodexSheet(h2, this.ports.getCodex(), () => undefined);
        }
      },
    );
  }

  private matchStrike(): void {
    // 04 §4.2 — the audio unlock and the brand moment
    this.audio.unlock();
    this.audio.play("match-strike");
    this.cameras.main.flash(MOTION.matchStrike, 245, 169, 63); // --flame bloom
    this.time.delayedCall(500, () => this.startRun());
  }

  private startRun(): void {
    const setup = this.ports.getRunSetup();
    const f = this.ports.getFloor(1);
    this.state = initState(f.floorData, f.rngInit, {
      mods: setup.mods,
      heirloom: setup.heirloom,
      noSalt: setup.noSalt,
    });
    this.floorEchoes = f.echoes;
    this.echoPlayed.clear();
    this.visibleMask = visibleFor(this.state);
    this.runBaseline = this.rules.learned.length;
    this.bankedKeys.clear();
    this.recovered = [];
    this.echoRing = [];
    this.running = true;
    this.playerView.setVisible(true);
    this.playerShadow.setVisible(true);

    this.buildFloor();
    this.redraw(true);
    armBloomValve(this, this.cameras.main, this.fx); // sample fps IN-run (D77)
    this.hud.toast("The match catches. The Vault is listening.", "info");
    // the first lesson, once the flavor line has had its moment (D66)
    this.time.delayedCall(2800, () => {
      if (this.running) {
        this.guide(
          "charge",
          "Find the stairs and descend. The candle burns as you act — when it dies, you die.",
        );
      }
    });
  }

  // ── Guidance: once-per-session lessons + the standing order (D66) ────────
  private guide(key: string, text: string): void {
    if (this.guides.has(key)) return;
    if (this.time.now - this.lastGuideAt < 4200) return; // one lesson at a time; re-tries later
    this.guides.add(key);
    this.lastGuideAt = this.time.now;
    this.hud.toast(text, "info");
  }

  private runGuides(): void {
    const s = this.state;
    if (s === null || s.status !== Status.ALIVE) return;
    if (!this.guides.has("monster")) {
      for (const e of s.entities) {
        if (e.kind !== EntityKind.CORPSE && this.visibleMask[e.y * s.w + e.x]! === 1) {
          this.guide("monster", "Something lives down here. Its habits are hidden laws — salt, bells, light. Test them.");
          break;
        }
      }
    }
    if (!this.guides.has("waystone") || !this.guides.has("stairs")) {
      for (let i = 0; i < s.tiles.length; i++) {
        if (this.visibleMask[i]! !== 1) continue;
        if (s.tiles[i] === Tile.WAYSTONE) {
          this.guide("waystone", "A waystone. Truths banked here enter the Codex — and outlive you.");
        } else if (s.tiles[i] === Tile.STAIRS_DOWN) {
          this.guide("stairs", "The stairs down. Deeper floors keep deeper secrets.");
        }
      }
    }
    if (s.wax > 0 && s.wax < 150) {
      this.guide("lowwax", "The candle wanes. Wax drippings feed it — or make for the way out.");
    }
  }

  private objectiveLine(): string {
    const s = this.state;
    if (s === null) return "";
    if (s.graceLeft > 0) return "Flame, or the way out.";
    if (s.floor === MAX_FLOOR) {
      return s.banked >= 5 ? "Break the Seal." : `The Seal asks 5 banked truths — ${s.banked} given.`;
    }
    const n = this.unbankedThisRun().length;
    if (n > 0) return `Bank ${n} truth${n === 1 ? "" : "s"} at a waystone.`;
    return "Find the stairs. Descend.";
  }

  /** Run over (death handled separately): rest ends the day. */
  private finishRun(restAtDusk: boolean): void {
    if (this.state !== null && this.running) {
      this.confirmRun();
      this.ports.reportExit();
    }
    this.running = false;
    if (restAtDusk) this.ports.nextDay();
    this.registry.set(AUTOSTART_KEY, !restAtDusk);
    this.scene.restart();
  }

  private learnedThisRun(): LearnedRule[] {
    return this.rules.learned
      .slice(this.runBaseline)
      .filter((r) => r.effect !== Effect.NONE)
      .concat(this.recovered);
  }

  /**
   * Run-end confirmations: everything learned this run PLUS every known
   * rule the sim re-consulted (passive re-observation) — without the
   * latter, confirms cap at 2 and the Codex can never ink (D64).
   */
  private confirmRun(): void {
    const keys = new Set<string>(this.learnedThisRun().map((r) => r.key));
    for (const k of this.rules.drainTouched()) keys.add(k);
    this.ports.confirmObservations([...keys]);
  }

  private unbankedThisRun(): LearnedRule[] {
    return this.learnedThisRun().filter((r) => !this.bankedKeys.has(r.key));
  }

  // ── Floor construction ───────────────────────────────────────────────────
  private buildFloor(): void {
    const s = this.state;
    if (s === null) return;
    this.groundLayer?.destroy();
    this.map?.destroy();
    this.props.forEach((p) => p.sprite.destroy());
    this.props.clear();
    this.decos.forEach((d) => d.destroy());
    this.decos.clear();
    this.skirts.forEach((d) => d.destroy());
    this.skirts.clear();
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
    if (this.activeEcho !== null) {
      this.activeEcho.img.destroy();
      this.activeEcho = null;
    }

    // every biome wears its own stone (D70): resolve the skin before the
    // tilemap consumes it, generating it on demand for fast descents
    const biome = biomeFor(s.floor);
    const bi = BIOMES.indexOf(biome);
    ensureBiomeSkin(this.textures, bi);
    this.skin = skinSuffix(bi);

    // the ground carries GROUND_SCALE× art rendered at 1/GROUND_SCALE, so
    // effective world geometry stays 64×32 while zoomed cameras sample
    // real texels (D68)
    const mapData = new Phaser.Tilemaps.MapData({
      name: `floor-${s.floor}`,
      width: s.w,
      height: s.h,
      tileWidth: TILE_W * GROUND_SCALE,
      tileHeight: TILE_H * GROUND_SCALE,
      orientation: Phaser.Tilemaps.Orientation.ISOMETRIC,
      format: Phaser.Tilemaps.Formats.ARRAY_2D,
    });
    this.map = new Phaser.Tilemaps.Tilemap(this, mapData);
    const tileset = this.map.addTilesetImage(
      `iso-ground${this.skin}`,
      `iso-ground${this.skin}`,
      TILE_W * GROUND_SCALE,
      TILE_H * GROUND_SCALE,
      0,
      0,
    );
    if (tileset === null) throw new Error("iso-ground tileset missing");
    const layer = this.map.createBlankLayer("ground", tileset, 0, 0);
    if (layer === null) throw new Error("ground layer creation failed");
    this.groundLayer = layer;
    layer.setScale(1 / GROUND_SCALE);
    layer.setDepth(0);
    this.worldLayer.add(layer);

    const p00 = layer.tileToWorldXY(0, 0);
    calibrate(p00.x + HALF_W, p00.y + HALF_H);

    this.lastTiles = new Uint8Array(s.tiles.length);
    this.lastTiles.fill(255);
    this.syncTiles();

    // biome color story + set dressing (D63)
    const accents = [COLOR.ember, COLOR.verdigrisDim, COLOR.verdigris, COLOR.seal, COLOR.boneDim, COLOR.borderVoid, COLOR.goldInk];
    setBiomeGrade(accents[bi] ?? COLOR.ember);
    for (let i = 0; i < s.tiles.length; i++) {
      if (s.tiles[i] !== Tile.FLOOR && s.tiles[i] !== Tile.MOSS) continue;
      const x = i % s.w;
      const y = (i / s.w) | 0;
      const d = floorDecoFor(x, y, s.floor);
      if (d === null) continue;
      const c = gridToScreen(x, y);
      const img = this.add.image(c.sx + d.ox, c.sy + HALF_H - 2 + d.oy, d.key);
      img.setOrigin(0.5, 1);
      img.setScale(TEX_SCALE);
      img.depth = depthOf(x, y, Layer.CORPSE);
      this.worldLayer.add(img);
      this.decos.set(i, img);
    }

    // diorama under-skirt (D69): where ground meets the dark, a hewn rock
    // face hangs below the edge — the room reads as a block carved from
    // stone, floating in the void, like the reference dioramas
    const fullWallAt = (xx: number, yy: number): boolean =>
      s.tiles[yy * s.w + xx] === Tile.WALL && !this.wallTextureAt(xx, yy).startsWith("iso-wall-cut");
    const groundless = (xx: number, yy: number): boolean =>
      xx < 0 || yy < 0 || xx >= s.w || yy >= s.h ||
      s.tiles[yy * s.w + xx] === Tile.VOID || fullWallAt(xx, yy);
    const addSkirt = (i: number, x: number, y: number, key: string, offset: number): void => {
      const c = gridToScreen(x, y);
      const img = this.add.image(c.sx, c.sy, key);
      img.setOrigin(0.5, 0);
      img.setScale(TEX_SCALE);
      img.depth = depthOf(x, y, Layer.CORPSE) - 1;
      this.worldLayer.add(img);
      this.skirts.set(i + offset, img);
    };
    for (let i = 0; i < s.tiles.length; i++) {
      const x = i % s.w;
      const y = (i / s.w) | 0;
      if (s.tiles[i] === Tile.VOID || fullWallAt(x, y)) continue;
      if (groundless(x, y + 1)) addSkirt(i, x, y, `iso-skirt-l${this.skin}`, 0);
      if (groundless(x + 1, y)) addSkirt(i, x, y, `iso-skirt-r${this.skin}`, s.tiles.length);
    }

    const b = worldBounds(s.w, s.h);
    this.cameras.main.setBounds(b.x, b.y, b.width, b.height);
    this.cameras.main.startFollow(this.playerView, true, 0.12, 0.12);
    this.applyViewport();
    this.makeCavern(b, bi);
    this.makeAtmosphere(bi);
    this.audio.setBiome(bi); // the sound direction changes too (D72)
  }

  /**
   * The dark is a PLACE (D81): the unexplored void was flat dead pixels —
   * on big windows it read as unfinished page, not buried cavern. Distant
   * rock masses at low parallax + a floor-wide drift of deep motes give
   * every pixel of darkness air and depth without revealing anything.
   */
  private makeCavern(b: { x: number; y: number; width: number; height: number }, bi: number): void {
    for (const m of this.cavern) m.destroy();
    this.cavern = [];
    this.deepMotes?.destroy();
    const s = this.state!;
    void bi;

    // the UNEXPLORED dungeon as vague architecture (D81b): a field of
    // ghost prisms across the whole floor, under the ground layer —
    // revealed tiles (alpha 1) cover them, so they live only in the fog
    // of war and the dark reads as MORE DUNGEON, not blank page. Two fog
    // stops: nearer/sharper and farther/fainter.
    // FLAT dark-on-dark silhouettes with crisp edges: tone barely above
    // void, near-full alpha — overlaps stay invisible (same flat color),
    // edges give the eye structure. Two fog stops via two tones.
    const nearTone = COLOR.surface2;
    const farTone = lerpColor(COLOR.void, COLOR.surface2, 0.6);
    const gh = (Math.imul(s.floor + 7, 1103515245) >>> 0) % 100000;
    for (let i = 0; i < 80; i++) {
      const hx = (Math.imul(i + 1, 2654435761) ^ gh) >>> 0;
      // bias outward: most prisms belong in the dark BEYOND the rooms, not
      // under the floor's heart where revealed tiles will hide them
      let ux = ((hx % 1000) / 1000) * 2 - 1; // -1..1
      let uy = (((hx >> 10) % 1000) / 1000) * 2 - 1;
      if (i % 4 !== 0) {
        ux = Math.sign(ux || 1) * (0.35 + Math.abs(ux) * 0.65);
        uy = Math.sign(uy || 1) * (0.35 + Math.abs(uy) * 0.65);
      }
      const px2 = b.x + b.width / 2 + ux * (b.width / 2);
      const py2 = b.y + b.height / 2 + uy * (b.height / 2);
      const far = i % 3 !== 0;
      const g = this.add.image(px2, py2, "uv-ghost-block");
      // fixed SCREEN presence at any camera zoom (delve's 2.6× used to
      // shrink these to invisible specks): target 150-260 screen px,
      // texture is 150px tall. Flat same-tone fills, so overlaps never
      // compound into fog (lesson #4); true-void gaps between them keep
      // the dark dark (lesson #5)
      const targetPx = (far ? 150 : 210) + ((hx >> 20) % 10) * 5;
      const sc = targetPx / (150 * Math.max(1, this.baseZoom));
      g.setScale(sc, sc);
      g.setTint(far ? farTone : nearTone);
      g.setAlpha(0.95);
      g.depth = far ? -17 : -16; // nearer stops draw over farther
      this.worldLayer.add(g);
      this.cavern.push(g);
    }

    // distant rock masses at the world's rim — vast, barely-there, and
    // gently adrift; near-full scrollFactor so they stay AT the rim
    // instead of converging into a center fog at high zoom
    const h0 = (Math.imul(s.floor + 1, 2654435761) >>> 0) % 1000;
    for (let i = 0; i < 4; i++) {
      const a = ((i + 0.5 + h0 / 1000) / 4) * Math.PI * 2;
      const rx = b.width * (0.55 + ((h0 >> i) % 9) / 100);
      const ry = b.height * (0.58 + ((h0 >> (i + 2)) % 9) / 100);
      const m = this.add.image(
        b.x + b.width / 2 + Math.cos(a) * rx,
        b.y + b.height / 2 + Math.sin(a) * ry,
        "uv-cavern-mass",
      );
      // divide by zoom: these are SCREEN dressing — at zoom 2.4 a world-
      // scaled blob becomes a 3000px cloud whose tail fogs the whole frame
      const sc = (2.2 + ((h0 >> i) % 4) * 0.6) / Math.max(1, this.baseZoom);
      m.setScale(sc, sc * 0.8);
      m.setTint(COLOR.surface2);
      m.setAlpha(0.14);
      m.setScrollFactor(0.85);
      m.depth = -18;
      this.worldLayer.add(m);
      this.cavern.push(m);
      this.tweens.add({
        targets: m,
        x: m.x + (i % 2 === 0 ? 22 : -18),
        duration: 14000 + i * 2600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
    // deep motes drifting across the WHOLE floor, void included — screen
    // dressing only; they reveal nothing
    this.deepMotes = this.add.particles(0, 0, "iso-mote", {
      lifespan: 7000,
      frequency: 130,
      quantity: 1,
      speedY: { min: -7, max: -2 },
      speedX: { min: -4, max: 4 },
      alpha: { start: 0.1, end: 0 },
      scale: { start: 0.8, end: 0.3 },
      // cool neutral — warm motes over the void fed the amber fog (D81)
      tint: COLOR.boneDim,
      emitZone: {
        type: "random",
        source: new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height),
        quantity: 1,
      },
    });
    this.deepMotes.setDepth(-16);
    this.worldLayer.add(this.deepMotes);
    this.deepMotes.fastForward(7000);
  }

  /**
   * The AIR changes per biome (D72): motes in the halls, falling earth in
   * the cellars, rising bubbles in the drowned stacks, embers in the
   * furnaces, pale drifting dust in the choir, verdigris fireflies below.
   */
  private makeAtmosphere(bi: number): void {
    this.dust?.destroy();
    interface Air {
      tint: number;
      up: [number, number]; // speedY range (negative = rising)
      alpha: number;
      freq: number;
      life: number;
    }
    const AIRS: Air[] = [
      { tint: COLOR.bone, up: [-12, -4], alpha: 0.34, freq: 340, life: 2800 }, // Tallow motes
      { tint: COLOR.parchmentAged, up: [6, 16], alpha: 0.3, freq: 420, life: 2200 }, // Cellars: earth falls
      { tint: COLOR.verdigris, up: [-24, -12], alpha: 0.3, freq: 300, life: 2600 }, // Drowned: bubbles rise
      { tint: COLOR.ember, up: [-30, -14], alpha: 0.5, freq: 190, life: 2000 }, // Furnace: embers
      { tint: COLOR.bone, up: [4, 10], alpha: 0.26, freq: 460, life: 3200 }, // Choir: pale dust settles
      { tint: COLOR.verdigrisDim, up: [-6, 4], alpha: 0.45, freq: 520, life: 3600 }, // Deep: fireflies drift
      { tint: COLOR.goldInk, up: [-8, -2], alpha: 0.4, freq: 380, life: 3000 }, // Bottom: gold dust
    ];
    const air = AIRS[bi] ?? AIRS[0]!;
    // fire ramps for the furnace, verdigris fade for the deep fireflies —
    // color-over-life replaces the flat tint where it earns its keep (D75)
    const colors =
      bi === 3 ? [0xffd98a, 0xf5a93f, 0xc9701e, 0x2a2520] :
      bi === 5 ? [0x4fb39a, 0x2e6b5c, 0x0b0a10] : null;
    const cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {
      lifespan: air.life,
      frequency: air.freq,
      quantity: 1,
      speedY: { min: air.up[0], max: air.up[1] },
      speedX: { min: -5, max: 5 },
      alpha: { start: air.alpha, end: 0 },
      scale: { start: 0.9, end: 0.35 },
      emitZone: {
        type: "random",
        source: new Phaser.Geom.Rectangle(-84, -64, 168, 116),
        quantity: 1,
      },
      follow: this.playerView,
    };
    if (colors !== null) {
      cfg.color = colors;
      cfg.colorEase = bi === 3 ? "quad.out" : "sine.inout";
      cfg.blendMode = Phaser.BlendModes.ADD;
    } else {
      cfg.tint = air.tint;
    }
    // the light gathers the dust: motes only live inside the halo and are
    // drawn gently toward the flame (D75); the Deep's fireflies are self-
    // lit and exempt
    this.dustZone = null;
    if (bi !== 5) {
      this.dustZone = new Phaser.Geom.Ellipse(0, 0, 300, 200);
      cfg.deathZone = { type: "onLeave", source: this.dustZone };
    }
    this.dust = this.add.particles(0, 0, "iso-mote", cfg);
    this.dustWell = bi !== 5
      ? this.dust.createGravityWell({ x: 0, y: -6, power: 0.8, epsilon: 50, gravity: 40 })
      : null;
    this.dust.setDepth(DEPTH_DUST);
    this.worldLayer.add(this.dust);
    this.dust.fastForward(3000); // the air is already alive when a floor appears
  }

  /** Zoom-to-fit + HUD-aware centering (portrait must show the full light
   *  pool; landscape must not waste the vertical). "Delve" view (D67)
   *  pushes the camera in for an in-the-action read — trading tactical
   *  overview for immersion; the light pool intentionally crops. */
  private applyViewport(smooth = false): void {
    const cam = this.cameras.main;
    const base = fitZoom(this.scale.width, this.scale.height);
    const zoom = this.viewMode === "delve" ? Math.min(2.6, Math.max(1.9, base * 1.75)) : base;
    this.baseZoom = zoom; // impact()/discovery pulses return here (D75)
    if (smooth) cam.zoomTo(zoom, 320, "Sine.easeInOut");
    else cam.setZoom(zoom);
    // usable area sits above the 72px HUD bar and below top chrome (~60px):
    // bias the follow so the player rides its center, not the canvas center
    this.followBias = ((72 - 60) / 2) / zoom;
    cam.setFollowOffset(-this.camPullX, -this.camPullY - this.followBias);
  }

  private toggleView(): void {
    this.viewMode = this.viewMode === "scout" ? "delve" : "scout";
    this.registry.set(VIEW_KEY, this.viewMode);
    this.applyViewport(true);
    this.hud.toast(
      this.viewMode === "delve" ? "Delve view — the dark leans close. (V to step back)" : "Scout view — the room at a glance.",
      "info",
    );
  }

  /**
   * Diorama cutaway (D65, render-only — the sim never learns): a wall with
   * see-through ground to its screen-front (N/W/NW) would hide the room
   * behind it, so it renders as a low CUT wall you see over; a wall showing
   * the camera its lit face (open ground S/E/SEs) is a room's back wall and
   * may carry dressing. "Open" mirrors the FOV's opacity rule — chests,
   * braziers, shrines are non-walkable but the player SEES them, so a wall
   * must never stand tall in front of one (adversarial-verify fix). Doors
   * count as open explicitly so jambs classify stably in any door state;
   * this also makes the classification immune to every mid-run tile
   * mutation (chest→floor etc. never flips opacity).
   */
  private wallTextureAt(x: number, y: number): string {
    const s = this.state!;
    const open = (xx: number, yy: number): boolean => {
      if (xx < 0 || yy < 0 || xx >= s.w || yy >= s.h) return false;
      const t = s.tiles[yy * s.w + xx]!;
      return (
        (TILE_FLAGS[t]! & F_OPAQUE) === 0 ||
        t === Tile.DOOR_CLOSED || t === Tile.DOOR_STUCK || t === Tile.DOOR_IRON ||
        t === Tile.DOOR_HUNGER || t === Tile.DOOR_CHOIR || t === Tile.DOOR_SIGIL
      );
    };
    if (open(x - 1, y) || open(x, y - 1) || open(x - 1, y - 1)) return `iso-wall-cut${this.skin}`;
    const h = (Math.imul(x, 131) ^ Math.imul(y, 61) ^ Math.imul(s.floor + 1, 401)) >>> 0;
    const r = h % 100;
    if (open(x + 1, y) || open(x, y + 1) || open(x + 1, y + 1)) {
      // back walls: mostly sound masonry, some crumbled crowns, some dressed
      const k = r < 36 ? "iso-wall" : r < 58 ? "iso-wall-broken" : r < 72 ? "iso-wall-2" : r < 86 ? "iso-wall-3" : "iso-wall-4";
      return k + this.skin;
    }
    return (r < 72 ? "iso-wall" : "iso-wall-broken") + this.skin;
  }

  /**
   * A 64×96 billboard at (x,y) covers tiles at (x-i, y-j) for i+j ≤ 5 with
   * |i-j| ≤ 1 (beyond that the columns no longer overlap on screen). Ring-1
   * is already the CUT rule; this asks whether any DEEPER cone tile is
   * see-through and currently FOV-visible — if so the tall prop must ghost.
   */
  private static readonly OCCLUSION_CONE: readonly [number, number][] = [
    [1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [2, 2], [3, 2], [2, 3],
  ];
  private buriesVisibleGround(x: number, y: number): boolean {
    const s = this.state;
    if (s === null) return false;
    for (const [i, j] of DescentScene.OCCLUSION_CONE) {
      const tx = x - i;
      const ty = y - j;
      if (tx < 0 || ty < 0 || tx >= s.w || ty >= s.h) continue;
      const ti = ty * s.w + tx;
      if (this.visibleMask[ti]! === 1 && (TILE_FLAGS[s.tiles[ti]!]! & F_OPAQUE) === 0) return true;
    }
    return false;
  }

  private syncTiles(): void {
    const s = this.state;
    if (s === null) return;
    for (let i = 0; i < s.tiles.length; i++) {
      const t = s.tiles[i]!;
      if (t === this.lastTiles[i]!) continue;
      this.lastTiles[i] = t;
      const x = i % s.w;
      const y = (i / s.w) | 0;
      this.groundLayer?.putTileAt(groundIndexFor(t, x, y), x, y);

      const want = t === Tile.WALL ? this.wallTextureAt(x, y) : propTextureFor(t);
      const have = this.props.get(i);
      if (have !== undefined && (want === "" || have.tile !== t)) {
        have.sprite.destroy();
        this.props.delete(i);
      }
      if (want !== "" && this.props.get(i) === undefined) {
        const c = gridToScreen(x, y);
        const sprite = this.add.image(c.sx, c.sy + HALF_H, want);
        sprite.setOrigin(0.5, 1);
        sprite.setScale(TEX_SCALE);
        const isItem = t === Tile.WAX_DRIP || t === Tile.WAX_STUB || t === Tile.WAX_CAKE;
        sprite.depth = depthOf(x, y, isItem ? Layer.ITEM : Layer.WALL);
        this.worldLayer.add(sprite);
        this.props.set(i, { sprite, tile: t, occluded: false });
      } else if (want !== "") {
        this.props.get(i)!.tile = t;
      }
    }
  }

  private onResize(gameSize: Phaser.Structs.Size): void {
    const w = gameSize.width;
    const h = gameSize.height;
    this.grain.setPosition(w >> 1, h >> 1);
    this.grain.setSize(w, h);
    this.hud.layout(w, h);
    this.uiCam.setSize(w, h);
    if (this.running) this.applyViewport();
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
      kb.on("keydown-B", () => this.openSigns()); // plant a sign
      kb.on("keydown-V", () => this.toggleView()); // scout ↔ delve camera (D67)
      kb.on("keydown-M", () => this.devTeleport()); // DEV-ONLY: deleted at M2
    }

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.overlayOpen || !this.running || this.state === null) return;
      if (p.y > this.scale.height - 80 || p.y < 60) return;
      const mb = this.hud.meterBounds();
      if (p.x < mb.x + mb.w && p.y > mb.y && p.y < mb.y + mb.h) return;
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      this.pressTile = screenToGrid(wp.x, wp.y, this.state.w, this.state.h);
      this.pressAt = this.time.now;
      this.pressConsumed = false;
    });

    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      const press = this.pressTile;
      this.pressTile = null;
      if (press === null || this.pressConsumed || this.overlayOpen || this.state === null) return;
      if (this.time.now - this.pressAt >= LONG_PRESS_MS) return;
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      const up = screenToGrid(wp.x, wp.y, this.state.w, this.state.h);
      if (up === null || up.x !== press.x || up.y !== press.y) return;
      this.tapTile(press.x, press.y);
    });

    // interrupted touches (notification shade, browser gesture) never send
    // pointerup — clear the press so no phantom long-press fires later (D64)
    const cancelPress = (): void => {
      this.pressTile = null;
      this.pressConsumed = false;
    };
    this.input.on("gameout", cancelPress);
    this.game.canvas.addEventListener("pointercancel", cancelPress);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.canvas.removeEventListener("pointercancel", cancelPress);
    });

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      this.cursorG.clear();
      if (this.overlayOpen || !this.running || this.state === null) return;
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      const t = screenToGrid(wp.x, wp.y, this.state.w, this.state.h);
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
    });
  }

  private tapTile(tx: number, ty: number): void {
    const s = this.state;
    if (s === null) return;
    const dx = tx - s.px;
    const dy = ty - s.py;
    if (dx === 0 && dy === 0) {
      const onStairs = s.tiles[ty * s.w + tx] === Tile.STAIRS_DOWN;
      this.enqueue(onStairs ? Action.DESCEND : Action.WAIT);
      return;
    }
    if (Math.abs(dx) + Math.abs(dy) !== 1) return;
    const dir = dy === -1 ? DIRS.N : dx === 1 ? DIRS.E : dy === 1 ? DIRS.S : DIRS.W;
    this.facing = dir;
    const t = s.tiles[ty * s.w + tx]!;
    const interactable = propTextureFor(t) !== "" || t === Tile.WAYSTONE || t === Tile.STAIRS_DOWN || t === Tile.ENTRY;
    const walkableTile = t === Tile.FLOOR || t === Tile.MOSS || t === Tile.WEBBING || t === Tile.WATER ||
      t === Tile.GLOWMOSS || t === Tile.PLATE || t === Tile.DOOR_OPEN || t === Tile.KEY_DROP ||
      t === Tile.WAX_DRIP || t === Tile.WAX_STUB || t === Tile.WAX_CAKE;
    this.enqueue(walkableTile && !interactable ? Action.MOVE_N + dir : Action.INTERACT_N + dir);
  }

  private inspect(tx: number, ty: number): void {
    const s = this.state;
    if (s === null) return;
    this.audio.play("inspect"); // the long-press lands — a faint tick
    const i = ty * s.w + tx;
    const floorRoman = ROMAN[s.floor] ?? String(s.floor);
    if (s.seen[i]! !== 1) {
      this.hud.toast(`Fl. ${floorRoman} · ${gridRef(tx, ty)} — unseen dark`, "info");
      return;
    }
    // signs speak when inspected
    if (s.signs[i]! !== 0) {
      const sign = this.ports.getSigns(s.floor).find((r) => r.tileIndex === i);
      if (sign !== undefined) {
        const nouns = earnedNouns(this.rules.learned.map((r) => r.key));
        const noun = nouns[sign.noun] ?? "…";
        const template = SIGN_TEMPLATES[sign.template] ?? "___";
        this.hud.toast(`A sign: "${template.replace("___", noun)}"`, "discovery");
        return;
      }
    }
    const what = TILE_NAMES[s.tiles[i]!] ?? "…";
    this.hud.toast(`Fl. ${floorRoman} · ${gridRef(tx, ty)} — ${what}`, "info");
  }

  private useSlot(slot: number): void {
    const s = this.state;
    if (s === null || !this.running) return;
    const item = s.inv[slot]!;
    if (item === Item.NONE) return;
    if (item === Item.FLINT) {
      this.enqueueRelight();
      return;
    }
    if (item === Item.CHALK) {
      this.enqueue(Action.CHALK_MARK);
      return;
    }
    if (item === Item.KEY_IRON || item === Item.KEY_MASTER) {
      this.hud.toast("Keys turn in doors — walk into a locked one.", "info");
      return;
    }
    this.enqueue(Action.USE, ((slot & 7) << 2) | (this.facing & 3));
  }

  private openSigns(): void {
    const s = this.state;
    const host = this.host();
    if (s === null || host === null || this.overlayOpen) return;
    if (s.signsLeft === 0) {
      this.hud.toast("You have no sign-planks left this run.", "info");
      return;
    }
    const nouns = earnedNouns(this.rules.learned.map((r) => r.key));
    this.overlayOpen = true;
    this.audio.play("sheet");
    openSignComposer(
      host,
      nouns,
      (template, noun) => {
        this.overlayOpen = false;
        // drop moves queued before the composer opened: the sign must plant
        // where it was composed, and a full queue must never eat it (D64)
        this.queue = [];
        const templateIdx = SIGN_TEMPLATES.indexOf(template);
        const nounIdx = Math.max(0, nouns.indexOf(noun));
        this.enqueue(Action.SIGN, (((templateIdx < 0 ? 0 : templateIdx) & 7) << 5) | (nounIdx & 31));
      },
      () => {
        this.overlayOpen = false;
      },
    );
  }

  private enqueue(op: number, arg = 0): void {
    if (this.overlayOpen || !this.running || this.state === null) return;
    if (this.state.status !== Status.ALIVE) return;
    if (this.queue.length < 4) this.queue.push({ op, arg });
  }

  private enqueueSnuff(): void {
    const s = this.state;
    if (s === null || s.candle === Candle.SNUFFED || this.queue.length > 0) return;
    for (let i = 0; i < SNUFF_TICKS; i++) this.enqueue(Action.SNUFF);
  }

  private enqueueRelight(): void {
    const s = this.state;
    if (s === null || s.candle !== Candle.SNUFFED || this.queue.length > 0) return;
    for (let i = 0; i < RELIGHT_TICKS; i++) this.enqueue(Action.RELIGHT);
  }

  // ── Frame loop ───────────────────────────────────────────────────────────
  override update(time: number): void {
    this.hud.updateFrame(time);
    pulseGlows(this.glowPool, time);
    if (time - this.lastGrainShift > 120) {
      this.lastGrainShift = time;
      this.grain.setTilePosition(Math.random() * 128, Math.random() * 128);
    }
    if (!this.running || this.state === null) return;

    flickerHalo(this.halo, effectiveRadius(this.state));

    this.entityViews.forEach((view, id) => {
      if (!view.visible) return;
      const kind = this.entityKinds.get(id)!;
      if (kind === EntityKind.MOTH) {
        const frame = ((time / 130) | 0) % 2 === 0 ? "iso-ent-3" : "iso-ent-3b";
        if (view.texture.key !== frame) view.setTexture(frame);
        view.setScale(TEX_SCALE, TEX_SCALE * (1 + 0.04 * Math.sin(time / 90 + id)));
      } else if (kind !== EntityKind.CORPSE && kind !== EntityKind.MIMIC) {
        const speed = kind === EntityKind.BEAST || kind === EntityKind.KEEPER ? 640 : 300;
        const amp = kind === EntityKind.BEAST ? 0.02 : 0.035;
        view.setScale(TEX_SCALE, TEX_SCALE * (1 + amp * Math.sin(time / speed + id * 1.7)));
      }
    });
    this.playerView.setScale(TEX_SCALE, TEX_SCALE * (1 + 0.02 * Math.sin(time / 420)));

    // echo ghost playback
    if (this.activeEcho !== null && time >= this.activeEcho.nextAt) {
      const echo = this.activeEcho;
      const frame = echo.frames[echo.index];
      if (frame === undefined) {
        echo.img.destroy();
        this.activeEcho = null;
      } else {
        const c = gridToScreen(frame.x, frame.y);
        echo.img.setPosition(c.sx, c.sy + HALF_H - 2);
        echo.img.depth = depthOf(frame.x, frame.y, Layer.FX);
        echo.index++;
        echo.nextAt = time + 240;
      }
    }

    if (this.pressTile !== null && !this.pressConsumed && time - this.pressAt >= LONG_PRESS_MS) {
      this.pressConsumed = true;
      this.inspect(this.pressTile.x, this.pressTile.y);
    }

    // hit-stop restoration: real game time is unscaled, so this is exact
    if (this.hitStopUntil > 0 && time >= this.hitStopUntil) {
      this.hitStopUntil = 0;
      this.tweens.timeScale = 1;
      if (this.dust !== null) this.dust.timeScale = 1;
    }

    if (this.queue.length > 0 && !this.overlayOpen && time - this.lastStep > 70 && time >= this.hitStopUntil) {
      this.lastStep = time;
      const step = this.queue.shift()!;
      this.step(step);
    }
  }

  private meaningfulLearned(): number {
    let n = 0;
    for (const r of this.rules.learned) {
      if (r.effect !== Effect.NONE) n++;
    }
    return n;
  }

  // ── Turn processing ──────────────────────────────────────────────────────
  private step(stepIn: Step): void {
    const s0 = this.state;
    if (s0 === null) return;
    const before = this.meaningfulLearned();
    // Ev.TIER_CHANGED only carries the NEW radius — remember the old one so
    // handleEvent can tell a guttering-down from a brightening-up
    this.preTickRadius = effectiveRadius(s0);
    const result = tickResolving(s0, stepIn, this.rules, (key) => this.ports.resolveRule(key));
    this.state = result.state;
    this.visibleMask = result.visible;
    const s = this.state;

    if (this.meaningfulLearned() > before) {
      this.hud.toast("◆ The Vault yields a truth — bank it at a Waystone", "discovery");
      this.audio.play("discovery");
      // the discovery breath: the dark recedes for a moment and the world
      // leans in — no white flash, the inverse of one (D75)
      vignetteBreath(this, this.fx, s.floor);
      const cam = this.cameras.main;
      if (Math.abs(cam.zoom - this.baseZoom) < 0.01) {
        cam.zoomTo(this.baseZoom * 1.05, 180, "Sine.easeOut", false, (_c, p) => {
          if (p === 1) cam.zoomTo(this.baseZoom, 300, "Sine.easeIn");
        });
      }
      this.tweens.add({ targets: this.halo, alpha: 0.9, duration: 140, yoyo: true });
    }

    // echo keyframes: the run's final 24 s (01 §13)
    this.echoRing.push({ x: s.px, y: s.py, candle: s.candle });
    if (this.echoRing.length > ECHO_KEYFRAMES) this.echoRing.shift();

    for (const e of result.events) this.handleEvent(e);

    if (s.status === Status.DESCENDING) {
      this.installFloor(s.floor + 1);
    }

    this.redraw(false);
    this.playBump();
    this.playTells();
    this.maybeStartEcho();
    this.runGuides();

    // ambience follows the light
    const r = effectiveRadius(this.state);
    this.audio.setDarkness(this.state.candle === Candle.SNUFFED ? 1 : Math.max(0, (4 - r) / 4));
    this.audio.setHeartbeat(r <= 1 && this.state.status === Status.ALIVE);

    if (this.state.status === Status.DEAD) this.openEpitaph();
    else if (this.state.status === Status.EXITED) this.openExit();
    else if (this.state.status === Status.VICTORY) this.openVictory();
  }

  /** The one true floor transition — stairs and the dev skip share it. */
  private installFloor(next: number): void {
    const s = this.state;
    if (s === null) return;
    const nf = this.ports.getFloor(next);
    this.state = descendState(s, nf.floorData, nf.rngInit);
    this.floorEchoes = nf.echoes;
    this.echoPlayed.clear();
    this.visibleMask = visibleFor(this.state);
    this.queue = [];
    // the ring must not leak previous-floor coordinates into a death
    // echo recorded on this floor (D64)
    this.echoRing = [];
    this.buildFloor();
    // place everything instantly and snap the camera: no sprite-slide
    // from old-floor coordinates across the new map (D64)
    this.redraw(true);
    this.cameras.main.centerOn(this.playerView.x, this.playerView.y);
    setVignetteDepth(this.fx, this.state.floor); // the dark presses harder below
    this.puffAt(this.state.px, this.state.py, 14); // the landing (D75)
    this.impact(0.002);
    this.audio.play("descend");
    this.cameras.main.flash(MOTION.ceremonial, 11, 10, 16);
    const biome = biomeFor(this.state.floor);
    this.hud.toast(
      this.state.floor === biome.firstFloor
        ? `${biome.name}. Fl. ${ROMAN[this.state.floor]}.`
        : `Fl. ${ROMAN[this.state.floor]}. The dark is thicker here.`,
      "warning",
    );
  }

  // DEV-ONLY: deleted at M2 — operator floor-skip for judging every biome
  // without earning the stairs. Same transition as a real descend.
  private devTeleport(target?: number): void {
    const s = this.state;
    if (s === null || !this.running || this.overlayOpen || s.status !== Status.ALIVE) return;
    const next = target ?? s.floor + 1;
    if (next < 1 || next > MAX_FLOOR || next === s.floor) return;
    s.status = Status.DESCENDING; // the sim's transition guard demands it
    this.installFloor(next);
    this.hud.toast(`(dev) You fall through the stone to Fl. ${ROMAN[next]}.`, "info");
  }

  private handleEvent(e: OutcomeEvent): void {
    const s = this.state;
    if (s === null) return;
    const cue = (c: Cue, quiet = false): void => this.audio.play(c, quiet);
    switch (e.type) {
      case Ev.MOVED: {
        const t = s.tiles[e.b * s.w + e.a] ?? Tile.FLOOR;
        cue(t === Tile.MOSS || t === Tile.GLOWMOSS ? "step-moss" : t === Tile.WEBBING || t === Tile.WATER ? "step-soft" : "step-stone");
        break;
      }
      case Ev.BLOCKED:
        this.pendingBump = { x: e.a, y: e.b };
        cue("bump");
        break;
      case Ev.WAYSTONE_TOUCHED:
        cue("waystone"); // the shimmer doubles as the bank sheet's opener
        this.openBank();
        break;
      case Ev.BANKED:
        if (this.pendingBank !== null) {
          for (const p of this.pendingBank) this.bankedKeys.add(p.key);
          this.ports.bankClaims(this.pendingBank);
          this.pendingBank = null;
        }
        this.hud.toast(`${e.a} truth${e.a === 1 ? "" : "s"} committed to the Codex.`, "discovery");
        cue("bank");
        break;
      case Ev.REJECTED:
        if (e.a === Action.BANK && this.pendingBank !== null) {
          this.pendingBank = null;
          this.hud.toast("The stone is beyond reach — nothing was committed.", "warning");
          cue("reject");
        }
        break;
      case Ev.STAIRS_TOUCHED:
        this.hud.toast("Stairs down. Enter (or tap yourself) to descend.", "info");
        cue("stairs-found");
        break;
      case Ev.BRAZIER_LIT:
        this.hud.toast("The brazier holds. A gift to everyone after you.", "discovery");
        this.ports.brazierLit(s.floor, e.b * s.w + e.a);
        cue("brazier");
        break;
      case Ev.DOOR_OPENED:
      case Ev.DOOR_SIGIL_OPEN:
        this.puffAt(e.a, e.b, 8); // old hinges shed their dust (D75)
        cue("door");
        break;
      case Ev.DOOR_FORCED:
        this.puffAt(e.a, e.b, 12);
        cue("door-force");
        break;
      case Ev.DOOR_FED:
        this.hud.toast("The door swallows fifty wax, and opens.", "warning");
        cue("door");
        break;
      case Ev.DOOR_LOCKED:
        this.hud.toast(TILE_NAMES[s.tiles[e.b * s.w + e.a] ?? 0] === "an iron door" ? "Locked. It wants a key." : "It does not open for hands.", "info");
        cue("locked");
        break;
      case Ev.RITUAL_TICK:
        if (e.a > 0) {
          this.hud.toast(`The sigil drinks the dark… (${e.a}/3)`, "discovery");
          cue("ritual");
        }
        break;
      case Ev.GRACE_STARTED:
        this.hud.toast("The candle is spent. Find flame, or the way out.", "death");
        this.cameras.main.shake(MOTION.micro, 0.004);
        cue("death");
        break;
      case Ev.PLAYER_HURT:
        this.impact(0.003 + e.b * 0.0002);
        this.hitStop(80);
        this.damageFlash();
        cue("bite");
        break;
      case Ev.FIRE_HURT:
        this.impact(0.005);
        this.hitStop(80);
        this.damageFlash();
        cue("fire");
        break;
      case Ev.SHOCK:
        this.impact(0.006);
        this.hitStop(80);
        this.damageFlash();
        cue("shock");
        break;
      case Ev.GAS_RELEASED:
        this.hud.toast("It bursts into a cloud of spores.", "warning");
        cue("gas");
        break;
      case Ev.FIRE_IGNITED:
        cue("ignite");
        break;
      case Ev.GAS_BOOM:
        this.impact(0.008);
        cue("boom");
        break;
      case Ev.MONSTER_DIED:
        this.hitStop(60);
        cue("monster-die");
        break;
      case Ev.DIED:
        this.hitStop(140);
        break;
      case Ev.MONSTER_MELTED:
        this.hud.toast("It melts away into the tallow.", "discovery");
        cue("monster-die", true); // the waxy variant: same shape, softer
        break;
      case Ev.BUMP:
        // shoving a creature that neither dies nor answers — a soft thud
        cue("bump", true);
        break;
      case Ev.WORM_TELEGRAPH:
        this.cameras.main.shake(80, 0.002);
        cue("rumble");
        break;
      case Ev.WORM_LUNGE:
        cue("lunge");
        break;
      case Ev.MIMIC_GROWL:
        this.hud.toast("The chest… growls.", "warning");
        cue("growl");
        break;
      case Ev.MIMIC_REVEAL:
        this.hud.toast("Fangs. It was never a chest.", "death");
        cue("growl");
        break;
      case Ev.CHEST_LOOT:
        this.hud.toast(`Inside: ${subjectItem(e.a)}.`, "discovery");
        cue("pickup");
        break;
      case Ev.SLIME_SPLIT:
        this.hud.toast("It splits where you struck it.", "warning");
        cue("split");
        break;
      case Ev.BELL_RUNG:
        this.hud.toast("A bell tolls above the corpse — the floor knows.", "death");
        cue("bell");
        break;
      case Ev.SCREAM:
        this.hud.toast("A scream with no choir behind it. Everything heard.", "death");
        cue("scream");
        break;
      case Ev.ALERT:
        // the floor knows: distant heavy footfalls begin — the orphaned
        // "stomp" finally earns its keep, kept low (it is far away)
        cue("stomp", true);
        break;
      case Ev.STOLEN:
        this.hud.toast(`A rustling makes off with your ${subjectItem(e.a)}!`, "death");
        cue("stolen");
        break;
      case Ev.DROPPED_LOOT:
        this.hud.toast(`It drops the ${subjectItem(e.a)}.`, "discovery");
        break;
      case Ev.HANDS_FULL:
        this.hud.toast(`Your hands are full — the chest keeps its ${subjectItem(e.a)}.`, "info");
        cue("thump");
        break;
      case Ev.PICKPOCKET:
        this.hud.toast("His master key comes away in silence.", "discovery");
        cue("discovery");
        break;
      case Ev.KEY_TAKEN:
        cue("pickup");
        break;
      case Ev.WAX_GAINED:
        cue("pickup");
        break;
      case Ev.ALTAR_PULSE:
        this.hud.toast("The altar drinks 100 wax — the floor unfolds in your mind.", "discovery");
        cue("discovery");
        break;
      case Ev.POOL_ECHO:
        this.playDeepestEcho();
        break;
      case Ev.FONT_TOUCHED:
        cue("chime");
        break;
      case Ev.SIGN_PLACED:
        this.ports.signPlaced(s.floor, s.py * s.w + s.px, e.a, e.b);
        this.hud.toast("The sign is planted. −5 wax.", "info");
        cue("sign");
        break;
      case Ev.CHALK_MARKED:
        this.ports.chalkChanged(s.floor, s.chalk);
        cue("chalk");
        break;
      case Ev.SALT_PLACED:
        cue("salt");
        break;
      case Ev.PLATE_PRESSED:
        cue("plate");
        break;
      case Ev.ITEM_USED:
        if (e.a === Item.GLOWVIAL) {
          this.ports.glowmossPlanted(s.floor, s.py * s.w + s.px);
          this.hud.toast("The glowmoss takes root. It will outlive you.", "discovery");
        }
        if (e.a === Item.BELL) cue("bell");
        if (e.a === Item.DOUSE) cue("snuff");
        if (e.a === Item.MIRROR) cue("mirror");
        if (e.a === Item.GLOWVIAL) cue("vial");
        if (e.a === Item.WSHARD) cue("shard");
        break;
      case Ev.CORPSE_RECOVERED: {
        const res = this.ports.corpseRecovered(e.b);
        if (res.unbanked.length > 0) {
          this.recovered.push(...res.unbanked);
          this.hud.toast(
            `You close their eyes and take up ${res.unbanked.length} unbanked truth${res.unbanked.length === 1 ? "" : "s"}. Split credit endures.`,
            "discovery",
          );
        } else {
          this.hud.toast("A fallen delver. Someone was here before you.", "info");
        }
        if (res.gift !== null) {
          this.hud.toast(`They left a gift: ${subjectItem(res.gift.item)}.`, "discovery");
        }
        cue("discovery");
        break;
      }
      case Ev.SEAL_OPENED:
        cue("descend");
        break;
      case Ev.CANDLE_STATE:
        if (e.a === Candle.SNUFFED) {
          cue("snuff");
          // the world drains toward the memory view while dark (D77)
          if (this.snuffGrade === null) this.snuffGrade = addSnuffGrade(this.cameras.main);
        } else {
          cue(e.a === Candle.CUPPED ? "cup" : "relight");
          removeSnuffGrade(this.cameras.main, this.snuffGrade);
          this.snuffGrade = null;
        }
        break;
      case Ev.TIER_CHANGED:
        // dimming is feedback (the candle gutters down a tier); brightening
        // already sounds through relight/brazier/pickup — keep it one-sided
        if (e.a < this.preTickRadius) cue("guttering");
        break;
      case Ev.GRACE_PAUSED:
      case Ev.CANDLE_CANCEL:
        // silent by design: a brazier pausing grace and a cancelled
        // snuff/relight are non-moments — sound here would cry wolf
        break;
      default:
        break;
    }
  }

  private damageFlash(): void {
    vignetteHurt(this, this.fx, this.state?.floor ?? 1);
  }

  /** Hit-stop: the world holds its breath for a beat (D75). */
  private hitStop(ms: number): void {
    this.hitStopUntil = this.time.now + ms;
    this.tweens.timeScale = 0.12;
    if (this.dust !== null) this.dust.timeScale = 0.12;
  }

  /** Impact: shake plus a 2% zoom micro-punch that reads as weight (D75). */
  private impact(intensity: number): void {
    const cam = this.cameras.main;
    cam.shake(90, intensity);
    if (Math.abs(cam.zoom - this.baseZoom) > 0.01) return; // mid-zoomTo: skip the punch
    this.tweens.add({
      targets: cam,
      zoom: this.baseZoom * 1.02,
      duration: 50,
      yoyo: true,
      ease: "Quad.easeOut",
      onComplete: () => cam.setZoom(this.baseZoom),
    });
  }

  /** One-shot ground puff (descend landings, doors giving way). D75 */
  private puffAt(x: number, y: number, count: number): void {
    const c = gridToScreen(x, y);
    const puff = this.add.particles(c.sx, c.sy + HALF_H - 2, "iso-mote", {
      speed: { min: 25, max: 80 },
      angle: { min: 200, max: 340 },
      lifespan: 450,
      scale: { start: 1.2, end: 0.2 },
      alpha: { start: 0.5, end: 0 },
      tint: COLOR.boneDim,
      emitting: false,
    });
    puff.setDepth(depthOf(x, y, Layer.FX));
    this.worldLayer.add(puff);
    puff.explode(count);
    this.time.delayedCall(700, () => puff.destroy());
  }

  private playBump(): void {
    const b = this.pendingBump;
    this.pendingBump = null;
    if (b === null || this.state === null) return;
    const target = gridToScreen(b.x, b.y);
    const here = gridToScreen(this.state.px, this.state.py);
    this.tweens.add({
      targets: this.playerView,
      x: `+=${(target.sx - here.sx) * 0.14}`,
      y: `+=${(target.sy - here.sy) * 0.14}`,
      duration: 55,
      yoyo: true,
      ease: "Sine.easeOut",
    });
  }

  /** Every listed monster's whisper (01 §8); quiet=true marks reused cues
   *  played at reduced level so a tell never reads as the event itself. */
  private tellFor(e2: Entity): { cue: Cue; quiet?: boolean } | null {
    switch (e2.kind) {
      case EntityKind.RAT: return { cue: "squeak" };
      case EntityKind.WICKWORM: return e2.state !== WormState.SURFACED ? { cue: "rumble" } : null;
      case EntityKind.MOTH: return { cue: "flutter" };
      case EntityKind.BEAST: return { cue: "click3" };
      case EntityKind.SLIME: return { cue: "squelch-soft" };
      case EntityKind.MIMIC: return e2.state === MimicState.GROWLED ? { cue: "growl" } : null;
      case EntityKind.SPOREWIGHT: return { cue: "gas", quiet: true };
      case EntityKind.DROWNED: return { cue: "drip" };
      case EntityKind.BELLHUNG: return { cue: "bell-far" };
      case EntityKind.SHADE: return { cue: "hiss" };
      case EntityKind.GASLIGHT: return { cue: "hiss", quiet: true };
      case EntityKind.CHOIRLESS: return { cue: "moan" };
      case EntityKind.RUSTLING: return { cue: "skitter" };
      case EntityKind.KEEPER: return { cue: "creak" };
      default: return null; // corpses keep their silence
    }
  }

  /** Audio tells: the nearest threat whispers its nature (01 §8). */
  private playTells(): void {
    const s = this.state;
    if (s === null || s.tick - this.lastTellAt < 5) return;
    const range = s.heirloom === 3 ? 10 : 5; // Listening Horn doubles it
    let best: { d: number; cue: Cue; quiet?: boolean } | null = null;
    for (const e2 of s.entities) {
      const d = Math.abs(e2.x - s.px) + Math.abs(e2.y - s.py);
      if (d > range) continue;
      const tell = this.tellFor(e2);
      if (tell !== null && (best === null || d < best.d)) best = { d, ...tell };
    }
    if (best !== null) {
      this.lastTellAt = s.tick;
      this.audio.play(best.cue, best.quiet ?? false);
    }
  }

  private maybeStartEcho(): void {
    const s = this.state;
    if (s === null || this.activeEcho !== null) return;
    const radius = Math.max(1, s.mods.echoRadius); // Echofast widens it
    for (let i = 0; i < this.floorEchoes.length; i++) {
      if (this.echoPlayed.has(i)) continue;
      const first = this.floorEchoes[i]!.frames[0];
      if (first === undefined) continue;
      const d = Math.abs(first.x - s.px) + Math.abs(first.y - s.py);
      if (d <= radius) {
        this.echoPlayed.add(i);
        this.startEcho(this.floorEchoes[i]!);
        break;
      }
    }
  }

  private startEcho(echo: EchoRecord): void {
    const img = this.add.image(0, 0, "iso-player");
    img.setOrigin(0.5, 1);
    img.setScale(TEX_SCALE);
    img.setTint(COLOR.verdigris);
    img.setAlpha(0.45);
    img.depth = DEPTH_GHOST;
    this.worldLayer.add(img);
    this.activeEcho = { frames: echo.frames, index: 0, img, nextAt: 0 };
    // one watery shimmer serves both entries: pool-triggered (Ev.POOL_ECHO →
    // playDeepestEcho) and proximity-triggered (maybeStartEcho)
    this.audio.play("pool");
    this.hud.toast("A shape retraces its last steps…", "discovery");
  }

  private playDeepestEcho(): void {
    const s = this.state;
    if (s === null) return;
    let deepest: EchoRecord | null = null;
    for (const e of this.floorEchoes) {
      if (deepest === null || e.frames.length > deepest.frames.length) deepest = e;
    }
    if (deepest !== null && this.activeEcho === null) this.startEcho(deepest);
    else if (deepest === null) {
      this.hud.toast("The pool shows only your own tired face.", "info");
      this.audio.play("pool", true); // still water, nothing in it
    }
  }

  // ── Rendering ────────────────────────────────────────────────────────────
  private glide(img: Phaser.GameObjects.Image, x: number, y: number, depth: number, instant: boolean): void {
    this.tweens.killTweensOf(img);
    if (instant) {
      img.depth = depth;
      img.setPosition(x, y);
      return;
    }
    // depth rides the same tween as position (sorting works on floats), so
    // the sort crossover happens AT the visual tile boundary — setting it
    // instantly made sprites pop through walls a step early (D73)
    this.tweens.add({ targets: img, x, y, depth, duration: GLIDE_MS, ease: "Sine.easeOut" });
  }

  private redraw(instant: boolean): void {
    const s = this.state;
    if (s === null) return;
    this.syncTiles();

    const effR = effectiveRadius(s);
    const light = computeLightMap(s, this.visibleMask, effR);
    // colored pools around visible archways/shrines (D69)
    const glowTints = computeGlowTints(s, this.visibleMask);
    const stain = (i: number, base: number): number => {
      const g = glowTints.get(i);
      return g === undefined ? base : lerpColor(base, g.color, g.t);
    };

    const layer = this.groundLayer;
    if (layer !== null) {
      for (let y = 0; y < s.h; y++) {
        for (let x = 0; x < s.w; x++) {
          const tile = layer.getTileAt(x, y);
          if (tile === null) continue;
          const i = y * s.w + x;
          if (this.visibleMask[i]! === 1) {
            tile.tint = stain(i, tintForLight(light[i]!));
            tile.setAlpha(1);
          } else if (s.seen[i]! === 1) {
            tile.tint = MEMORY_TINT;
            tile.setAlpha(1);
          } else {
            tile.setAlpha(0);
          }
        }
      }
    }

    // frame the lit WORLD, not just the delver (D81): standing at a room's
    // corner used to donate half the frame to void — the camera now leans
    // toward the centroid of everything currently visible (smoothed by the
    // follow lerp), clamped so the player never leaves the middle third
    {
      let cx = 0;
      let cyy = 0;
      let n = 0;
      for (let i = 0; i < s.tiles.length; i++) {
        if (this.visibleMask[i]! === 1) {
          cx += i % s.w;
          cyy += (i / s.w) | 0;
          n++;
        }
      }
      if (n > 3) {
        const wc = gridToScreen(cx / n, cyy / n);
        const pcm = gridToScreen(s.px, s.py);
        this.camPullX = Phaser.Math.Clamp((wc.sx - pcm.sx) * 0.45, -TILE_W * 2.2, TILE_W * 2.2);
        this.camPullY = Phaser.Math.Clamp((wc.sy - pcm.sy) * 0.45, -TILE_H * 2.2, TILE_H * 2.2);
        this.cameras.main.setFollowOffset(-this.camPullX, -this.camPullY - this.followBias);
      }
    }

    positionHalo(this.halo, s, effR);
    // the dust lives only where the light reaches, and leans toward the
    // flame; a snuffed candle stops gathering it (D75)
    if (this.dustZone !== null) {
      this.dustZone.width = Math.max(64, (effR * 2 + 1) * TILE_W * 0.85);
      this.dustZone.height = Math.max(48, (effR * 2 + 1) * TILE_H * 0.85);
    }
    if (this.dustWell !== null) this.dustWell.active = effR > 0;
    if (this.dust !== null && this.dustZone !== null) {
      if (effR === 0 && this.dust.emitting) this.dust.stop();
      else if (effR > 0 && !this.dust.emitting) this.dust.start();
    }
    this.halo.setTint(COLOR.flame);
    syncSourceGlows(
      this,
      this.glowPool,
      s,
      this.visibleMask,
      DEPTH_HALO - 1,
      this.worldLayer,
      BIOMES.indexOf(biomeFor(s.floor)) === 3, // the Furnaces shimmer (D77)
    );

    const pc = gridToScreen(s.px, s.py);
    const pi = s.py * s.w + s.px;
    // +0.5: the delver wins depth ties against same-tile-row entities
    // instead of flickering on insertion order (D73)
    this.glide(this.playerView, pc.sx, pc.sy + HALF_H - 2, depthOf(s.px, s.py, Layer.ENTITY) + 0.5, instant);
    this.glide(this.playerShadow, pc.sx, pc.sy + 4, depthOf(s.px, s.py, Layer.CORPSE), instant);
    this.playerView.setFlipX(this.facing === DIRS.W);
    this.playerView.setTint(
      s.candle === Candle.SNUFFED ? MEMORY_TINT : tintForLight(Math.min(light[pi]! + 0.25, 1)),
    );
    this.playerShadow.setAlpha(this.visibleMask[pi]! === 1 ? 0.8 : 0.3);

    // flat overlays: salt / chalk / fire / gas / signs
    const wantOverlay = (kind: string, i: number, tint: number, alpha: number): void => {
      const key = `${kind}:${i}`;
      let img = this.overlays.get(key);
      if (img === undefined) {
        const x = i % s.w;
        const y = (i / s.w) | 0;
        const c = gridToScreen(x, y);
        img = this.add.image(c.sx, c.sy, "iso-diamond");
        img.depth = depthOf(x, y, Layer.CORPSE);
        this.worldLayer.add(img);
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
      if (s.gas[i]! > 0) wantOverlay("gas", i, COLOR.verdigrisDim, 0.5 * dim);
      if (s.signs[i]! !== 0) wantOverlay("sign", i, COLOR.parchmentAged, 0.6 * dim);
    }

    this.decos.forEach((img, i) => {
      const seen = s.seen[i]! === 1;
      const vis = this.visibleMask[i]! === 1;
      img.setVisible(seen);
      if (seen) img.setTint(vis ? stain(i, tintForLight(light[i]!)) : MEMORY_TINT);
    });
    this.skirts.forEach((img, key) => {
      const i = key % s.tiles.length; // east-face keys are offset (D69)
      const seen = s.seen[i]! === 1;
      const vis = this.visibleMask[i]! === 1;
      img.setVisible(seen);
      if (seen) img.setTint(vis ? stain(i, tintForLight(light[i]!)) : MEMORY_TINT);
    });

    this.props.forEach((prop, i) => {
      const x = i % s.w;
      const y = (i / s.w) | 0;
      const seen = s.seen[i]! === 1;
      const vis = this.visibleMask[i]! === 1;
      prop.sprite.setVisible(seen);
      if (!seen) return;
      prop.sprite.setTint(vis ? stain(i, tintForLight(Math.min(light[i]! + 0.08, 1))) : MEMORY_TINT);
      // cut walls are knee-high — they never hide the delver (D65).
      // Tall walls and doors ghost when their 96px body buries ANY ground
      // the FOV says you can see (a monster you can see must never render
      // invisible behind a wall — adversarial-verify fix), not only when
      // they stand over the player.
      const shouldOcclude =
        isWallishTile(prop.tile) &&
        !prop.sprite.texture.key.startsWith("iso-wall-cut") &&
        (occludes(s.px, s.py, x, y) ||
          this.buriesVisibleGround(x, y) ||
          // standing IN a doorway: the 96px arch must ghost, not swallow you
          (prop.tile === Tile.DOOR_OPEN && s.px === x && s.py === y));
      const targetAlpha = shouldOcclude ? OCCLUDED_ALPHA : 1;
      if (shouldOcclude !== prop.occluded) {
        prop.occluded = shouldOcclude;
        this.tweens.add({ targets: prop.sprite, alpha: targetAlpha, duration: OCCLUSION_FADE_MS });
      } else if (!this.tweens.isTweening(prop.sprite)) {
        prop.sprite.setAlpha(targetAlpha);
      }
    });

    const alive = new Set<number>();
    let feverNear = false;
    for (const ent of s.entities) {
      alive.add(ent.id);
      let view = this.entityViews.get(ent.id);
      let shadowView = this.entityShadows.get(ent.id);
      // a first-seen entity is PLACED, never glided — otherwise it streaks
      // in from world (0,0) at the map's corner (D64)
      const justBorn = view === undefined;
      if (view === undefined) {
        view = this.add.image(0, 0, entityTextureFor(ent.kind, ent.state));
        view.setOrigin(0.5, 1);
        view.setScale(TEX_SCALE);
        this.worldLayer.add(view);
        shadowView = this.add.image(0, 0, "iso-shadow");
        this.worldLayer.add(shadowView);
        if (ent.kind === EntityKind.BEAST || ent.kind === EntityKind.KEEPER) shadowView.setScale(1.6, 1.6);
        else if (ent.kind === EntityKind.MOTH || ent.kind === EntityKind.GASLIGHT) shadowView.setScale(0.5, 0.5);
        this.entityViews.set(ent.id, view);
        this.entityShadows.set(ent.id, shadowView);
        this.entityKinds.set(ent.id, ent.kind);
        this.entityLastX.set(ent.id, ent.x);
      }
      if (ent.kind === EntityKind.MIMIC) {
        const want = entityTextureFor(ent.kind, ent.state);
        if (view.texture.key !== want) view.setTexture(want);
      }
      const c = gridToScreen(ent.x, ent.y);
      const flies = ent.kind === EntityKind.MOTH || ent.kind === EntityKind.GASLIGHT;
      this.glide(view, c.sx, c.sy + HALF_H - (flies ? 14 : 2), depthOf(ent.x, ent.y, Layer.ENTITY), instant || justBorn);
      if (shadowView !== undefined) {
        this.glide(shadowView, c.sx, c.sy + 4, depthOf(ent.x, ent.y, Layer.CORPSE), instant || justBorn);
      }
      const lastX = this.entityLastX.get(ent.id)!;
      if (ent.x !== lastX) view.setFlipX(ent.x < lastX);
      this.entityLastX.set(ent.id, ent.x);

      const i = ent.y * s.w + ent.x;
      const tileVisible = this.visibleMask[i]! === 1;
      const burrowed = ent.kind === EntityKind.WICKWORM && ent.state === WormState.BURROWED;
      const telegraph = ent.kind === EntityKind.WICKWORM && ent.state === WormState.TELEGRAPH;
      view.setVisible(tileVisible && !burrowed);
      shadowView?.setVisible(tileVisible);
      shadowView?.setAlpha(burrowed ? 0.55 : 0.8);
      view.setTint(tintForLight(Math.min(light[i]! + 0.18, 1)));
      view.setAlpha(telegraph ? 0.6 : 1);
      // heirloom whispers
      if (s.heirloom === 2 && ent.kind === EntityKind.MIMIC && ent.state === MimicState.DISGUISED) {
        const d = Math.abs(ent.x - s.px) + Math.abs(ent.y - s.py);
        if (d === 1) feverNear = true;
      }
    }
    // edge-triggered: one whisper on approach, not a toast per redraw (D64)
    if (feverNear && !this.feverOn) this.hud.toast("Your ring warms.", "discovery");
    this.feverOn = feverNear;
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

    this.hud.update(s, effR, 0);
    this.hud.setObjective(this.objectiveLine());
  }

  // ── Sheets ───────────────────────────────────────────────────────────────
  private runSummary(): { ticks: number; discoveries: number; floor: number; day: number } {
    const s = this.state!;
    return {
      ticks: s.tick,
      discoveries: this.unbankedThisRun().length,
      floor: s.floor,
      day: this.ports.getGuildhall().day,
    };
  }

  private openBank(): void {
    const host = this.host();
    const s = this.state;
    if (host === null || s === null || this.overlayOpen) return;
    this.overlayOpen = true;
    const bankable = this.unbankedThisRun();
    openWaystoneSheet(
      host,
      bankable,
      `${this.bankedKeys.size} already banked this run.`,
      (picked) => {
        this.overlayOpen = false;
        if (picked.length > 0) {
          // nothing is committed yet: the Codex write and bankedKeys wait
          // for Ev.BANKED so the ledger can never outrun the sim (D64) —
          // and stale queued moves are dropped so BANK runs at the stone
          this.queue = [];
          this.pendingBank = picked;
          this.enqueue(Action.BANK, picked.length & 3);
        }
      },
      () => {
        this.overlayOpen = false;
      },
    );
  }

  private openEpitaph(): void {
    const host = this.host();
    const s = this.state;
    if (host === null || s === null) return;
    closeAllSheets(host);
    this.overlayOpen = true;
    this.running = false;
    this.audio.setHeartbeat(false);
    this.audio.play("death");
    const house = this.ports.getHouse();
    // LEFT UNFINISHED (D78): name the open loops — the research says the
    // interrupted business, made explicit, is what pulls a player back
    const truths = this.unbankedThisRun()
      .slice(0, 3)
      .map((r) => describeRuleKey(r.key, r.effect).text);
    const nearClaims = this.ports
      .getCodex()
      .filter((c) => c.status !== "inked" && c.status !== "disproven" && c.confirms >= 3)
      .slice(0, 2)
      .map((c) => `${c.text} — ${c.confirms}/5 confirmations.`);
    let nearMiss: string | null = null;
    for (let i = 0; i < s.tiles.length; i++) {
      if (s.tiles[i] === Tile.STAIRS_DOWN) {
        const d = Math.abs((i % s.w) - s.px) + Math.abs(((i / s.w) | 0) - s.py);
        if (d <= 8) nearMiss = `The stairs down were ${d} step${d === 1 ? "" : "s"} away.`;
        break;
      }
    }
    openEpitaphSheet(host, s, this.runSummary(), house, 0, (result, rest) => {
      if (result.houseName !== null) this.ports.setHouse(result.houseName);
      this.ports.reportDeath({
        day: this.ports.getGuildhall().day,
        floor: s.floor,
        x: s.px,
        y: s.py,
        cause: s.deathCause,
        lastWords: result.lastWords,
        gift: result.gift,
        unbanked: this.unbankedThisRun(),
        echoFrames: this.echoRing.slice(),
      });
      this.confirmRun();
      this.afterCeremony(rest);
    }, { truths, nearClaims, nearMiss });
  }

  private openExit(): void {
    const host = this.host();
    const s = this.state;
    if (host === null || s === null) return;
    closeAllSheets(host);
    this.overlayOpen = true;
    this.running = false;
    this.audio.setHeartbeat(false);
    this.audio.play("exit");
    openExitSheet(host, s, this.runSummary(), (rest) => {
      this.confirmRun();
      this.ports.reportExit();
      this.afterCeremony(rest);
    });
  }

  private openVictory(): void {
    const host = this.host();
    if (host === null || this.state === null) return;
    closeAllSheets(host);
    this.overlayOpen = true;
    this.running = false;
    this.audio.setHeartbeat(false);
    this.audio.play("victory");
    openVictorySheet(host, this.runSummary(), () => {
      this.confirmRun();
      this.afterCeremony(true);
    });
  }

  private afterCeremony(restAtDusk: boolean): void {
    const host = this.host();
    if (this.ports.heirloomDue() && host !== null) {
      openHeirloomSheet(host, (id) => {
        this.ports.pickHeirloom(id);
        if (restAtDusk) this.ports.nextDay();
        this.registry.set(AUTOSTART_KEY, !restAtDusk);
        this.scene.restart();
      });
      return;
    }
    if (restAtDusk) this.ports.nextDay();
    this.registry.set(AUTOSTART_KEY, !restAtDusk);
    this.scene.restart();
  }
}

function subjectItem(item: number): string {
  const names: Record<number, string> = {
    [Item.FLINT]: "flint & striker",
    [Item.SALT]: "a salt pouch",
    [Item.CHALK]: "chalk",
    [Item.MIRROR]: "a mirror shard",
    [Item.BELL]: "a bell",
    [Item.GLOWVIAL]: "a glowmoss vial",
    [Item.DOUSE]: "a dousing cap",
    [Item.KEY_IRON]: "an iron key",
    [Item.KEY_MASTER]: "the master key",
    [Item.WSHARD]: "a waystone shard",
  };
  return names[item] ?? "something";
}
