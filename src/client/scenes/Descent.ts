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
  isRuleRequest,
  tick,
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
  type TickResult,
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
import type { EchoRecord, FloorPayloadLike, GamePorts, LearnedRule } from "../net/ports.js";
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
  ensureVeilTexture,
  positionVeil,
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
import { openMainMenu } from "../ui/menu.js";
import { openMeeting, openStoryIntro } from "../ui/story.js";
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
const RESCUED_KEY = "uv-rescued"; // witnessed the finale this session (D108)
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

/** What the plaque calls the living (D97) — bestiary names, in-voice. */
const ENTITY_NAMES: Record<number, string> = {
  [EntityKind.RAT]: "a wax-rat",
  [EntityKind.WICKWORM]: "a wickworm",
  [EntityKind.MOTH]: "a candlemoth",
  [EntityKind.BEAST]: "the Beast",
  [EntityKind.SLIME]: "a gloomcap slime",
  [EntityKind.MIMIC]: "a mirrormaw",
  [EntityKind.SPOREWIGHT]: "a sporewight",
  [EntityKind.DROWNED]: "one of the drownedkin",
  [EntityKind.BELLHUNG]: "a bellhung",
  [EntityKind.SHADE]: "a cinder shade",
  [EntityKind.GASLIGHT]: "a gaslight",
  [EntityKind.CHOIRLESS]: "one of the choirless",
  [EntityKind.RUSTLING]: "a rustling",
  [EntityKind.KEEPER]: "the Lantern-Keeper",
  [EntityKind.CORPSE]: "a fallen delver",
};

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

/** Pickup lessons (D-tut): the first time a FINDABLE item reaches the pack,
 *  one plaque names the thing and the gesture that spends it. Keyed by Item
 *  id. The three starting tools (flint/salt/chalk) are absent — they are
 *  taught by USE, in context, not by finding (see runGuides). */
const PICKUP_LESSONS: Record<number, { title: string; text: string }> = {
  [Item.MIRROR]: {
    title: "The shard that sees",
    text: "A mirror shard. Tap it when a chest sits wrong — its reflection catches a mirrormaw's fangs before you do.",
  },
  [Item.BELL]: {
    title: "A voice to throw",
    text: "A bell. Face a way and tap it to throw — the dark chases the sound, not you.",
  },
  [Item.GLOWVIAL]: {
    title: "A light you leave",
    text: "A glowmoss vial. Tap it to plant a light in the stone underfoot — it will burn for every delver after you.",
  },
  [Item.DOUSE]: {
    title: "The cap that hides you",
    text: "A dousing cap. Tap it to snuff the flame at once — no wax spent, and the dark takes you in a breath.",
  },
  [Item.KEY_IRON]: {
    title: "One turn of iron",
    text: "An iron key. Walk into a barred iron door and it turns once, then is spent.",
  },
  [Item.KEY_MASTER]: {
    title: "The Keeper's key",
    text: "The Lantern-Keeper's master key. Walk into any locked door — it knows every lock in the Vault.",
  },
  [Item.WSHARD]: {
    title: "A stone in your pocket",
    text: "A waystone shard. Tap it to carve your truths into the Codex from where you stand — once, then it crumbles.",
  },
  [Item.ROPE]: {
    title: "Your own way down",
    text: "A coil of rope. Tap it to drop to the next floor from anywhere — your own way down when a floor turns against you. Once only.",
  },
  [Item.WAXCAKE]: {
    title: "The Vault's one mercy",
    text: "A tallow cake. Tap it to feed your candle a hundred wax — the one mercy the Vault offers. Once only.",
  },
  [Item.BONEKEY]: {
    title: "A key that keeps",
    text: "A bone key. Face an iron door and tap it — it opens without a sound, and is never spent.",
  },
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
  private lightVeil!: Phaser.GameObjects.Image; // pool-edge rounder (D96)
  private halo!: Phaser.GameObjects.Image;
  private fx!: WorldFx;
  private followBias = 0; // HUD-aware vertical bias (applyViewport)
  private camPullX = 0; // frame the LIT world, not just the player (D81)
  private camPullY = 0;
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
  private echoWorldToasted = false; // once per run: "you are not the first" (D107)
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
    // the pool-edge veil rounds the tile-stepped light boundary (D96);
    // depth above every world sprite — its alpha lives only at the edge
    ensureVeilTexture(this);
    this.lightVeil = this.add.image(0, 0, "uv-light-veil");
    this.lightVeil.depth = 800;
    this.lightVeil.setVisible(false);
    this.worldLayer.add(this.lightVeil);
    this.cursorG = this.add.graphics();
    this.cursorG.depth = DEPTH_CURSOR;
    this.worldLayer.add(this.cursorG);
    // hold-to-inspect progress ring — screen-space, above everything (D96)
    this.pressRing = this.add.graphics();
    this.pressRing.setScrollFactor(0);
    this.pressRing.depth = 1500;
    this.uiLayer.add(this.pressRing);
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
    // The menu IS the antechamber (D91, operator: "the story tells a lot
    // anyway... start the game directly"). The hall screen is cut from
    // the path; its soul survives: daily vitals on the menu, the strike
    // as the Begin transition, the how-to as in-game lessons (D66).
    // guildhall.ts is parked unused. The menu returns after every run.
    const g = this.ports.getGuildhall();
    let closeMenu: (() => void) | null = null;
    closeMenu = openMainMenu(
      host,
      this.audio,
      {
        onBegin: () => {
          closeMenu?.();
          this.tellThenStrike(host);
        },
        onTelling: (done) => {
          // watching it from the menu counts as told for this session
          this.registry.set(STORY_KEY, true);
          openStoryIntro(host, done, this.audio);
        },
        onCodex: () => {
          this.audio.play("sheet");
          openCodexSheet(host, this.ports.getCodex(), () => undefined);
        },
      },
      {
        day: g.day,
        gatePct: g.gatePct,
        codexPct: g.codexPct,
        fallenToday: g.fallenToday,
        rumor: g.omenRumor,
        // the changed world (D108): the season completed — for everyone once
        // the counter fills, immediately for whoever witnessed the finale
        rescued: g.gatePct >= 100 || this.registry.get(RESCUED_KEY) === true,
      },
    );
  }

  /** "The Last Wick" (D79): the telling plays once per session — then the
   *  match strikes and the descent begins, no hall between (D91). */
  private tellThenStrike(host: HTMLElement): void {
    if (this.registry.get(STORY_KEY) !== true) {
      this.registry.set(STORY_KEY, true);
      openStoryIntro(host, () => this.matchStrike(), this.audio);
      return;
    }
    this.matchStrike();
  }

  private matchStrike(): void {
    // 04 §4.2 — the audio unlock and the brand moment. The vigil theme is
    // NOT stopped here: floor 1's setScoreBiome crossfades it into the
    // Tallow lament — the same tune, thinner, now underground (D93)
    this.overlayOpen = false;
    this.audio.unlock();
    this.audio.play("match-strike");
    this.cameras.main.flash(MOTION.matchStrike, 245, 169, 63); // --flame bloom
    this.time.delayedCall(500, () => this.startRun());
  }

  private startRun(): void {
    // M2b resume: mobile webviews die on app-switch — a reload adopts the
    // server-replayed run mid-floor instead of voiding the day's candle
    const maybe = this.ports.getResume?.() ?? null;
    const resume = maybe !== null && maybe.state.status === Status.ALIVE ? maybe : null;
    const f = resume?.floor ?? this.ports.getFloor(1);
    if (resume !== null) {
      this.state = resume.state;
    } else {
      const setup = this.ports.getRunSetup();
      this.state = initState(f.floorData, f.rngInit, {
        mods: setup.mods,
        heirloom: setup.heirloom,
        noSalt: setup.noSalt,
      });
    }
    this.floorEchoes = f.echoes;
    this.echoPlayed.clear();
    this.visibleMask = visibleFor(this.state);
    // resume: the run's learned truths re-enter the table BEFORE the baseline
    // is cut, and baseline 0 keeps them bankable; banked keys must not re-bank
    this.runBaseline = this.rules.learned.length;
    if (resume !== null) {
      for (const r of resume.learned) this.rules.set(r.key, r.effect);
    }
    this.bankedKeys.clear();
    if (resume !== null) for (const k of resume.banked) this.bankedKeys.add(k);
    this.recovered = [];
    this.echoRing = [];
    this.running = true;
    this.playerView.setVisible(true);
    this.playerShadow.setVisible(true);

    this.buildFloor();
    this.redraw(true);
    armBloomValve(this, this.cameras.main, this.fx); // sample fps IN-run (D77)
    this.hud.toast(
      resume !== null
        ? "Your candle still burns where you left it."
        : "The match catches. The Vault is listening.",
      "info",
    );
    this.echoWorldToasted = false;
    if (this.floorEchoes.length > 0) {
      this.echoWorldToasted = true;
      this.hud.toast("You are not the first down here today.", "info");
    }
    // the first lesson lands as soon as the flash settles (D93): the very
    // first thing a new delver needs is "press this to move"
    this.time.delayedCall(900, () => {
      if (!this.running) return;
      const touch = this.sys.game.device.input.touch && !this.sys.game.device.os.desktop;
      this.teach(
        "move",
        touch
          ? "Tap a tile to walk there. Tap yourself to stand still."
          : "W A S D or Arrows — walk the dark. Hold a key to keep walking.",
        { title: "First steps" },
      );
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

  // ── Lessons of the Wick (D93): the teaching plaques — contextual, one at
  // a time, each dismissed by DOING the thing it teaches (operator: "teach
  // people what is what one by one, not bombard in one go") ────────────────
  private lessonKey: string | null = null;
  private lessonMoves = 0;
  private lessonTimer: Phaser.Time.TimerEvent | null = null;
  private bumpStreak = 0; // consecutive wall-grinds → the "blocked" lesson
  private lastBumpAt = 0;
  private lightMap: Float32Array | null = null; // last redraw's light values
  private pressRing!: Phaser.GameObjects.Graphics; // hold-charge feedback (D96)
  private lastRejectAt = 0; // throttle for the universal reject toast (D97)
  private lastHurtKind = 0; // who struck last — the epitaph names them (D98)
  /** Threshold beacons (D98): entry + stairs breathe so they never get
   *  lost in the dark once seen. Rebuilt when the floor changes. */
  private beacons: { img: Phaser.GameObjects.Image; i: number; phase: number }[] = [];
  private beaconFloor = -1;

  private teach(
    key: string,
    text: string,
    opts: { timed?: number; title?: string; at?: { x: number; y: number } } = {},
  ): void {
    if (this.guides.has(key) || this.lessonKey !== null) return;
    this.guides.add(key);
    this.lessonKey = key;
    this.lessonMoves = 0;
    this.hud.lesson(text, opts.title);
    // point AT the subject (D96): a lesson about an unmarked thing in the
    // dark reads as a riddle — the gold diamond says "this one"
    if (opts.at !== undefined) this.markLesson(opts.at.x, opts.at.y);
    this.lessonTimer?.remove();
    this.lessonTimer =
      opts.timed !== undefined && opts.timed > 0
        ? this.time.delayedCall(opts.timed, () => this.lessonDone(key))
        : null;
  }

  /** The lesson's subject glows — LIGHT, not lines (D98 operator: the
   *  wireframe diamond read as a debug artifact, "not a proper game
   *  design way"). A soft golden pool beneath the subject, two breaths,
   *  then gone. Same visual language as the vigils and beacons. */
  private lessonMark: Phaser.GameObjects.Image | null = null;
  private markLesson(x: number, y: number): void {
    this.clearLessonMark();
    const c = gridToScreen(x, y);
    const img = this.add.image(c.sx, c.sy, "halo");
    img.setBlendMode(Phaser.BlendModes.ADD);
    img.setDisplaySize(TILE_W * 1.5, TILE_H * 1.8);
    img.setTint(COLOR.goldInk);
    img.depth = depthOf(x, y, Layer.CORPSE); // pools UNDER the subject
    img.setAlpha(0);
    this.worldLayer.add(img);
    this.tweens.add({
      targets: img,
      alpha: { from: 0, to: 0.5 },
      duration: 650,
      yoyo: true,
      repeat: 2,
      ease: "Sine.easeInOut",
      onComplete: () => {
        if (this.lessonMark === img) this.lessonMark = null;
        this.tweens.add({ targets: img, alpha: 0, duration: 400, onComplete: () => img.destroy() });
      },
    });
    this.lessonMark = img;
  }

  private clearLessonMark(): void {
    this.lessonMark?.destroy();
    this.lessonMark = null;
  }

  private lessonDone(key: string): void {
    if (this.lessonKey !== key) return;
    this.lessonKey = null;
    this.lessonTimer?.remove();
    this.lessonTimer = null;
    this.hud.clearLesson();
    this.clearLessonMark();
    // the burn truth follows the first steps; the camera follows the burn
    if (key === "move") {
      this.time.delayedCall(700, () =>
        this.teach("burn", "Every act burns the candle. The meter on the left is your life.", {
          timed: 6500,
          title: "The candle is life",
        }),
      );
    } else if (key === "burn") {
      // touch has no V key — teaching it there was a dead lesson (D97)
      const touch = this.sys.game.device.input.touch && !this.sys.game.device.os.desktop;
      if (!touch) {
        this.time.delayedCall(900, () =>
          this.teach("view", "V — the dark steps back and shows the room. V again, and it leans close.", {
            timed: 8000,
            title: "Two ways of seeing",
          }),
        );
      }
    }
  }

  private runGuides(): void {
    const s = this.state;
    if (s === null || s.status !== Status.ALIVE) return;
    // a door within reach → the interact lesson (do-to-dismiss)
    if (!this.guides.has("interact")) {
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
        const t = s.tiles[(s.py + dy) * s.w + (s.px + dx)];
        if (t === Tile.DOOR_CLOSED || t === Tile.DOOR_STUCK || t === Tile.DOOR_IRON) {
          this.teach("interact", "A door. Face it and press E — see if it gives. (A tap works too.)", {
            title: "What stands before you",
            at: { x: s.px + dx, y: s.py + dy },
          });
          break;
        }
      }
    }
    if (!this.guides.has("inspect")) {
      for (const e of s.entities) {
        const ei = e.y * s.w + e.x;
        // only teach about a creature the player can actually SEE well —
        // a lesson pointing into near-darkness reads as a riddle (D96)
        if (e.kind !== EntityKind.CORPSE && this.visibleMask[ei]! === 1 && (this.lightMap?.[ei] ?? 0) >= 0.3) {
          this.teach(
            "inspect",
            "Something lives down here. Hold your pointer on it — finger or mouse — and learn its shape before it learns yours.",
            { timed: 9000, title: "The things below", at: { x: e.x, y: e.y } },
          );
          break;
        }
      }
    }
    // a visible corpse → the communal-inheritance lesson (D107)
    if (!this.guides.has("corpse")) {
      for (const e of s.entities) {
        const ei = e.y * s.w + e.x;
        if (e.kind === EntityKind.CORPSE && this.visibleMask[ei]! === 1 && (this.lightMap?.[ei] ?? 0) >= 0.3) {
          this.teach(
            "corpse",
            "A fallen delver. What they learned dies unbanked — unless you stand beside them, press E, and carry it up.",
            { timed: 10000, title: "What the fallen leave", at: { x: e.x, y: e.y } },
          );
          break;
        }
      }
    }
    if (!this.guides.has("bank") || !this.guides.has("stairs") || !this.guides.has("wax")) {
      for (let i = 0; i < s.tiles.length; i++) {
        if (this.visibleMask[i]! !== 1) continue;
        const t = s.tiles[i];
        const tx = i % s.w;
        const ty = (i / s.w) | 0;
        if (t === Tile.WAYSTONE) {
          this.teach("bank", "A waystone. Stand on it, press E — what you carve there outlives you.", {
            timed: 9000,
            title: "What outlives you",
            at: { x: tx, y: ty },
          });
        } else if (t === Tile.STAIRS_DOWN) {
          this.guide("stairs", "The stairs down. Deeper floors keep deeper secrets.");
        } else if (t === Tile.WAX_DRIP || t === Tile.WAX_STUB || t === Tile.WAX_CAKE) {
          this.teach("wax", "Wax on the stone. Walk over it — your candle drinks it.", {
            timed: 9000,
            title: "The Vault provides",
            at: { x: tx, y: ty },
          });
        }
      }
    }
    // a gloomcap slime oozes into salt-range while you still carry salt: the
    // one creature whose counter is already in your pack (D-tut)
    if (!this.guides.has("use-salt") && s.inv.includes(Item.SALT)) {
      for (const e of s.entities) {
        if (e.kind !== EntityKind.SLIME) continue;
        if (Math.abs(e.x - s.px) + Math.abs(e.y - s.py) > 3) continue;
        if (this.visibleMask[e.y * s.w + e.x]! !== 1) continue;
        this.teach(
          "use-salt",
          "A gloomcap slime nears. Salt is a wall it cannot cross, and it burns where it touches — press T (or tap the salt) to pour a line before it.",
          { timed: 8000, title: "A wall of salt", at: { x: e.x, y: e.y } },
        );
        break;
      }
    }
    // something is CLOSE (D98, operator cornered with no idea of the
    // counterplay): teach stealth at the moment of pursuit, not at low wax
    if (!this.guides.has("hunted")) {
      for (const e of s.entities) {
        if (e.kind === EntityKind.CORPSE) continue;
        if (Math.abs(e.x - s.px) + Math.abs(e.y - s.py) > 2) continue;
        if (this.visibleMask[e.y * s.w + e.x]! !== 1) continue;
        this.teach(
          "hunted",
          "It hunts your light. Cup it (C) — or snuff and vanish. Each creature keeps its own law: test them.",
          { timed: 9000, title: "The dark hunts the light" },
        );
        break;
      }
    }
    // the flame is out and flint waits in your pack: the way back to light
    if (s.candle === Candle.SNUFFED && s.inv.includes(Item.FLINT)) {
      this.teach(
        "use-flint",
        "Your candle is snuffed, and the dark has you. Flint will catch it again — press R (or tap the flint); three beats to steady the flame.",
        { timed: 8000, title: "Strike it alight" },
      );
    }
    if (s.wax > 0 && s.wax < 150) {
      this.teach("cup", "The candle wanes. C — cup the flame in your palm: unseen, and it sips instead of burns.", {
        timed: 8000,
        title: "Guard the flame",
      });
    }
    // early on the first floor, once walking is learned: the mark that is
    // yours alone — a private map, and a ward against Rustlings (D-tut)
    if (!this.guides.has("use-chalk") && s.floor === 1 && this.guides.has("move") && s.inv.includes(Item.CHALK)) {
      this.teach(
        "use-chalk",
        "Chalk marks the stone — press G (or tap the chalk). What you draw here endures into your own days to come, a map only you will read; and no Rustling will cross it.",
        { timed: 9000, title: "A mark of your own" },
      );
    }
    // finds name themselves the first time they reach your hand (D-tut): one
    // plaque, the thing and the gesture that spends it. teach() serializes,
    // so unheard finds simply retry until the folio is free.
    for (let sl = 0; sl < s.inv.length; sl++) {
      const item = s.inv[sl]!;
      if (item === Item.NONE) continue;
      const lesson = PICKUP_LESSONS[item];
      if (lesson === undefined || this.guides.has(`find:${item}`)) continue;
      this.teach(`find:${item}`, lesson.text, { timed: 9000, title: lesson.title });
      if (this.lessonKey !== null) break; // one plaque at a time; the rest wait
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
      this.sendExit();
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
    this.makeAtmosphere(bi);
    this.audio.setBiome(bi); // the sound direction changes too (D72)
    this.audio.setScoreBiome(bi); // and each biome sings its own lament (D93)
  }

  // (D83) the darkness-dressing program — ghost prisms, rim masses, deep
  // motes, painted backdrops — was reverted on operator verdict ("looks
  // ugly"). The paintings are parked unplugged in render/backdrops/. The
  // dark is the dark.

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
    // guards (D97): V used to zoom under open sheets and pre-run menus
    if (this.overlayOpen || !this.running) return;
    this.lessonDone("view"); // doing dismisses the lesson (D95)
    const before = this.cameras.main.zoom;
    this.viewMode = this.viewMode === "scout" ? "delve" : "scout";
    this.registry.set(VIEW_KEY, this.viewMode);
    this.applyViewport(true);
    // at wide viewports the two modes nearly coincide — announcing a
    // dramatic change for a 4% zoom reads as a broken toggle (D97)
    if (Math.abs(this.baseZoom - before) / before > 0.08) {
      this.hud.toast(
        this.viewMode === "delve" ? "Delve view — the dark leans close. (V to step back)" : "Scout view — the room at a glance.",
        "info",
      );
    }
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
   * is already the CUT rule; this asks whether a DEEPER cone tile hides
   * something that MATTERS — the player or a visible creature. (D96: it
   * used to ghost for ANY visible floor, which turned whole room edges
   * into glass — operator: "clutter in rendering". Empty floor may hide;
   * a monster you can see must never render invisible.)
   */
  private static readonly OCCLUSION_CONE: readonly [number, number][] = [
    [1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [2, 2], [3, 2], [2, 3],
  ];
  /** Tiles that must never be buried: player + currently visible entities.
   *  Rebuilt once per redraw, read by buriesVisibleGround. */
  private importantTiles = new Set<number>();
  private buriesVisibleGround(x: number, y: number): boolean {
    const s = this.state;
    if (s === null) return false;
    for (const [i, j] of DescentScene.OCCLUSION_CONE) {
      const tx = x - i;
      const ty = y - j;
      if (tx < 0 || ty < 0 || tx >= s.w || ty >= s.h) continue;
      if (this.importantTiles.has(ty * s.w + tx)) return true;
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
  /** Held direction keys, polled every frame (D92): OS key-repeat gives a
   *  first-step hitch (step… pause… stream) — the clunk the operator felt.
   *  Polling feeds the drain at its own 70 ms cadence instead. wasDown =
   *  two-frame confirmation (D97): a tap straddling one SLOW frame used to
   *  read as a hold and inject phantom steps at low fps. */
  private heldDirs: { key: Phaser.Input.Keyboard.Key; d: number; op: number; wasDown: boolean }[] = [];

  /** Facing → body (D92): walking away (N/W) shows the hood's back, walking
   *  toward (S/E) the candle-lit front; E/W mirror via flip. The iso screen
   *  mapping — N up-right, E down-right, S down-left, W up-left. */
  private applyFacing(): void {
    const away = this.facing === DIRS.N || this.facing === DIRS.W;
    this.playerView.setTexture(away ? "iso-player-back" : "iso-player");
    this.playerView.setFlipX(this.facing === DIRS.W || this.facing === DIRS.S);
  }

  private bindInput(): void {
    const kb = this.input.keyboard;
    if (kb !== null) {
      const move = (d: number, op: number, ev?: KeyboardEvent): void => {
        // OS auto-repeat is IGNORED (D92 fix: it double-fed the queue with
        // the held-key poller — one tap walked 2-3 steps). A press is ONE
        // step; sustained walking belongs to the poller alone.
        if (ev?.repeat === true) return;
        this.facing = d;
        this.applyFacing(); // the body turns the INSTANT the key lands
        this.enqueue(op);
      };
      kb.on("keydown-W", (ev: KeyboardEvent) => move(DIRS.N, Action.MOVE_N, ev));
      kb.on("keydown-UP", (ev: KeyboardEvent) => move(DIRS.N, Action.MOVE_N, ev));
      kb.on("keydown-D", (ev: KeyboardEvent) => move(DIRS.E, Action.MOVE_E, ev));
      kb.on("keydown-RIGHT", (ev: KeyboardEvent) => move(DIRS.E, Action.MOVE_E, ev));
      kb.on("keydown-S", (ev: KeyboardEvent) => move(DIRS.S, Action.MOVE_S, ev));
      kb.on("keydown-DOWN", (ev: KeyboardEvent) => move(DIRS.S, Action.MOVE_S, ev));
      kb.on("keydown-A", (ev: KeyboardEvent) => move(DIRS.W, Action.MOVE_W, ev));
      kb.on("keydown-LEFT", (ev: KeyboardEvent) => move(DIRS.W, Action.MOVE_W, ev));
      kb.on("keydown-SPACE", () => this.enqueue(Action.WAIT));
      kb.on("keydown-C", () => this.enqueue(Action.CUP));
      kb.on("keydown-E", () => this.smartInteract());
      kb.on("keydown-T", () => this.throwSaltSmart());
      kb.on("keydown-G", () => this.enqueue(Action.CHALK_MARK));
      kb.on("keydown-ENTER", () => {
        const s2 = this.state;
        if (s2 === null || !this.running || this.overlayOpen) return;
        // pre-validate (D97): descending off-stairs used to silently burn wax
        if (s2.tiles[s2.py * s2.w + s2.px] !== Tile.STAIRS_DOWN) {
          this.audio.play("reject", true);
          this.hud.toast("No stairs beneath you.", "info");
          return;
        }
        this.enqueue(Action.DESCEND);
      });
      kb.on("keydown-R", () => this.enqueueRelight());
      // X is HOLD-to-snuff (D97): a single stray keypress used to snuff the
      // candle instantly — keyboard now honors the same 450ms as the HUD
      kb.on("keydown-X", (ev: KeyboardEvent) => {
        if (ev.repeat) return;
        this.xDownAt = this.time.now;
      });
      kb.on("keyup-X", () => {
        if (this.xDownAt === 0) return;
        const held = this.time.now - this.xDownAt;
        this.xDownAt = 0;
        if (!this.running || this.overlayOpen) return;
        if (held >= 450) this.enqueueSnuff();
        else this.hud.toast("Hold X to snuff the flame.", "info");
      });
      kb.on("keydown-B", () => this.openSigns()); // plant a sign
      kb.on("keydown-V", () => this.toggleView()); // scout ↔ delve camera (D67)
      kb.on("keydown-M", () => this.devTeleport()); // DEV-ONLY: deleted at M2
      kb.on("keydown-L", () => this.devOpenSeal()); // DEV-ONLY: deleted at M2
      kb.on("keydown-K", () => this.devOpenSeal(true)); // DEV-ONLY: the 100th candle

      const KC = Phaser.Input.Keyboard.KeyCodes;
      this.heldDirs = [
        { key: kb.addKey(KC.W), d: DIRS.N, op: Action.MOVE_N, wasDown: false },
        { key: kb.addKey(KC.UP), d: DIRS.N, op: Action.MOVE_N, wasDown: false },
        { key: kb.addKey(KC.D), d: DIRS.E, op: Action.MOVE_E, wasDown: false },
        { key: kb.addKey(KC.RIGHT), d: DIRS.E, op: Action.MOVE_E, wasDown: false },
        { key: kb.addKey(KC.S), d: DIRS.S, op: Action.MOVE_S, wasDown: false },
        { key: kb.addKey(KC.DOWN), d: DIRS.S, op: Action.MOVE_S, wasDown: false },
        { key: kb.addKey(KC.A), d: DIRS.W, op: Action.MOVE_W, wasDown: false },
        { key: kb.addKey(KC.LEFT), d: DIRS.W, op: Action.MOVE_W, wasDown: false },
      ];
    }

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.overlayOpen || !this.running || this.state === null) return;
      if (this.pointerEaten(p.x, p.y)) return;
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
      this.cursorG.clear(); // no orphaned hover diamond (D96)
      this.cursorAt = 0;
    };
    this.input.on("gameout", cancelPress);
    this.game.canvas.addEventListener("pointercancel", cancelPress);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.canvas.removeEventListener("pointercancel", cancelPress);
    });

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      this.cursorG.clear();
      if (this.overlayOpen || !this.running || this.state === null) return;
      // never advertise tappability where pointerdown is eaten (D97)
      if (this.pointerEaten(p.x, p.y)) return;
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
      this.cursorAt = this.time.now; // idles away in update() (D96)
    });
  }

  /** Last hover-cursor draw time — a parked mouse must not leave a
   *  dotted diamond floating in the scene forever (D96). */
  private cursorAt = 0;

  /** Tiles the SIM's interactTile actually answers (D97 audit): sending
   *  INTERACT at anything else burns a turn of wax for silent nothing. */
  private static readonly SIM_INTERACTABLE: ReadonlySet<number> = new Set([
    Tile.DOOR_CLOSED, Tile.DOOR_STUCK, Tile.DOOR_IRON, Tile.DOOR_HUNGER,
    Tile.DOOR_CHOIR, Tile.DOOR_SIGIL, Tile.BRAZIER_UNLIT, Tile.CHEST,
    Tile.ALTAR, Tile.POOL, Tile.FONT, Tile.SEAL, Tile.WAYSTONE,
  ]);

  private static readonly WALKABLE: ReadonlySet<number> = new Set([
    Tile.FLOOR, Tile.MOSS, Tile.WEBBING, Tile.WATER, Tile.GLOWMOSS,
    Tile.PLATE, Tile.DOOR_OPEN, Tile.KEY_DROP, Tile.WAX_DRIP,
    Tile.WAX_STUB, Tile.WAX_CAKE, Tile.STAIRS_DOWN, Tile.ENTRY,
    Tile.WAYSTONE,
  ]);

  private static readonly DXA = [0, 1, 0, -1] as const;
  private static readonly DYA = [-1, 0, 1, 0] as const;

  private livingAt(tx: number, ty: number): Entity | null {
    const s = this.state;
    if (s === null) return null;
    for (const e of s.entities) {
      if (e.x === tx && e.y === ty && e.kind !== EntityKind.CORPSE) return e;
    }
    return null;
  }

  /** Brief diamond flash where a tap landed — a tap is NEVER silent (D97). */
  private tapAck(tx: number, ty: number, ok: boolean): void {
    const c = gridToScreen(tx, ty);
    const g = this.add.graphics();
    g.lineStyle(1.4, ok ? COLOR.bone : COLOR.seal, 0.9);
    g.beginPath();
    g.moveTo(0, -HALF_H);
    g.lineTo(HALF_W, 0);
    g.lineTo(0, HALF_H);
    g.lineTo(-HALF_W, 0);
    g.closePath();
    g.strokePath();
    g.setPosition(c.sx, c.sy);
    g.depth = DEPTH_CURSOR;
    this.worldLayer.add(g);
    this.tweens.add({ targets: g, alpha: 0, duration: 340, onComplete: () => g.destroy() });
  }

  /** Leaving costs your whole run — one stray tap must never do it (D97). */
  private exitArmAt = 0;
  private confirmExit(dir: number): void {
    if (this.time.now - this.exitArmAt < 3200) {
      this.exitArmAt = 0;
      this.enqueue(Action.INTERACT_N + dir);
      return;
    }
    this.exitArmAt = this.time.now;
    this.hud.toast("The way out. Use it again to end the run and keep what you banked.", "warning");
  }

  /** Far tap → one safe step toward it (D97): the phone's only locomotion
   *  was a lie before — "tap a tile to walk there" now walks there. */
  private stepToward(tx: number, ty: number): void {
    const s = this.state;
    if (s === null) return;
    const dx = tx - s.px;
    const dy = ty - s.py;
    const h = dx > 0 ? DIRS.E : DIRS.W;
    const v = dy > 0 ? DIRS.S : DIRS.N;
    const order: number[] = [];
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx !== 0) order.push(h);
      if (dy !== 0) order.push(v);
    } else {
      if (dy !== 0) order.push(v);
      if (dx !== 0) order.push(h);
    }
    for (const d of order) {
      const nx = s.px + DescentScene.DXA[d]!;
      const ny = s.py + DescentScene.DYA[d]!;
      if (nx < 0 || ny < 0 || nx >= s.w || ny >= s.h) continue;
      const t = s.tiles[ny * s.w + nx]!;
      // auto-route only across SAFE ground: never onto a plate, never
      // into a creature — those must be deliberate adjacent taps
      if (t === Tile.PLATE || !DescentScene.WALKABLE.has(t)) continue;
      if (this.livingAt(nx, ny) !== null) continue;
      this.facing = d;
      this.applyFacing();
      this.enqueue(Action.MOVE_N + d);
      this.tapAck(tx, ty, true);
      return;
    }
    this.tapAck(tx, ty, false);
  }

  /** Zones where world presses die — matched to the ACTUAL chrome (D97:
   *  the old full-width bands ate 29% of landscape height). */
  private pointerEaten(x: number, y: number): boolean {
    const w = this.scale.width;
    const h = this.scale.height;
    if (y > h - 72) return true; // the bottom bar, exactly
    if (y < 60 && (x < 240 || x > w - 110)) return true; // plaque | mute+menu
    const mb = this.hud.meterBounds();
    return x < mb.x + mb.w && y > mb.y && y < mb.y + mb.h;
  }

  private tapTile(tx: number, ty: number): void {
    const s = this.state;
    if (s === null) return;
    const dx = tx - s.px;
    const dy = ty - s.py;
    const t = s.tiles[ty * s.w + tx]!;
    if (dx === 0 && dy === 0) {
      if (t === Tile.STAIRS_DOWN) {
        this.enqueue(Action.DESCEND);
        return;
      }
      // tap-self ON the stone banks (D98): the lesson says "stand on it"
      // — touch had no gesture to honor that promise
      if (t === Tile.WAYSTONE) {
        this.openBank();
        return;
      }
      this.enqueue(Action.WAIT);
      return;
    }
    if (Math.abs(dx) + Math.abs(dy) !== 1) {
      this.stepToward(tx, ty);
      return;
    }
    const dir = dy === -1 ? DIRS.N : dx === 1 ? DIRS.E : dy === 1 ? DIRS.S : DIRS.W;
    this.facing = dir;
    this.applyFacing();
    // a living thing there: tapping IT is the deliberate touch (sim bump)
    if (this.livingAt(tx, ty) !== null) {
      this.enqueue(Action.MOVE_N + dir);
      return;
    }
    if (t === Tile.ENTRY) {
      this.confirmExit(dir);
      return;
    }
    // ONLY tiles the sim answers get INTERACT (D97: open doors, wax and
    // stairs are WALKED onto — they were unreachable on touch before)
    if (DescentScene.SIM_INTERACTABLE.has(t)) {
      this.enqueue(Action.INTERACT_N + dir);
      return;
    }
    if (DescentScene.WALKABLE.has(t)) {
      this.enqueue(Action.MOVE_N + dir);
      return;
    }
    this.tapAck(tx, ty, false); // wall/void: seen, refused, never silent
  }

  private inspect(tx: number, ty: number): void {
    const s = this.state;
    if (s === null) return;
    this.lessonDone("inspect"); // doing dismisses the lesson (D93)
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
        this.hud.toast(`A sign, carved by a delver's hand: "${template.replace("___", noun)}"`, "discovery");
        return;
      }
    }
    // a creature on the tile speaks before the stone under it (D97: the
    // lesson said "learn its shape" but the plaque named the floor)
    const ent = s.entities.find((e2) => e2.x === tx && e2.y === ty);
    if (ent !== undefined && this.visibleMask[i]! === 1) {
      // a disguised mirrormaw lies to the plaque too — secrets hold
      const disguised = ent.kind === EntityKind.MIMIC && ent.state === MimicState.DISGUISED;
      const name = disguised ? "an old chest" : ENTITY_NAMES[ent.kind] ?? "something nameless";
      this.hud.toast(`Fl. ${floorRoman} · ${gridRef(tx, ty)} — ${name}`, "info");
      return;
    }
    const what = TILE_NAMES[s.tiles[i]!] ?? "…";
    this.hud.toast(`Fl. ${floorRoman} · ${gridRef(tx, ty)} — ${what}`, "info");
  }

  private useSlot(slot: number): void {
    const s = this.state;
    if (s === null || !this.running) return;
    const item = s.inv[slot]!;
    if (item === Item.NONE) {
      this.hud.toast("Nothing in that slot.", "info"); // never silent (D97)
      return;
    }
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
    // Generic USE, slot + facing packed: bell/mirror/glowvial/douse/wshard
    // AND the three new finds — rope & tallow-cake (self-use, direction
    // ignored) and the bone key (uses the facing to turn the iron door it
    // fronts). The bone key is deliberately NOT caught by the KEY branch
    // above: unlike spent iron/master keys, it is a reusable USE verb.
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

  /** X held to confirm — 0 while idle (D97). */
  private xDownAt = 0;

  /**
   * The candle verbs FLUSH pending moves instead of silently dropping the
   * confirmed gesture (D97): a completed 450ms hold used to vanish if a
   * step was still queued — the deliberate act wins over the stale queue.
   */
  private enqueueSnuff(): void {
    const s = this.state;
    if (s === null || s.candle === Candle.SNUFFED) return;
    this.queue.length = 0;
    for (let i = 0; i < SNUFF_TICKS; i++) this.enqueue(Action.SNUFF);
  }

  private enqueueRelight(): void {
    const s = this.state;
    if (s === null || s.candle !== Candle.SNUFFED) return;
    this.queue.length = 0;
    for (let i = 0; i < RELIGHT_TICKS; i++) this.enqueue(Action.RELIGHT);
  }

  /**
   * Smart interact (D97, operator: "it's hard to interact with anything
   * until I am facing it"). E means "use the thing here": faced tile
   * first, then the tile underfoot (waystone/stairs/exit), then the ONE
   * adjacent thing that answers — turning the body toward it. Never
   * sends an action the sim would reject (rejects burned wax silently).
   */
  private smartInteract(): void {
    const s = this.state;
    if (s === null || !this.running || this.overlayOpen) return;
    const here = s.tiles[s.py * s.w + s.px]!;
    if (here === Tile.WAYSTONE) {
      this.openBank();
      return;
    }
    if (here === Tile.STAIRS_DOWN) {
      this.enqueue(Action.DESCEND);
      return;
    }
    if (here === Tile.ENTRY) {
      this.hud.toast("Step beside the doorway, then use it to leave.", "info");
      return;
    }
    // faced living thing: the deliberate touch (Keeper pickpocket path)
    const fx = s.px + DescentScene.DXA[this.facing]!;
    const fy = s.py + DescentScene.DYA[this.facing]!;
    if (this.livingAt(fx, fy) !== null) {
      this.enqueue(Action.INTERACT_N + this.facing);
      return;
    }
    const order = [this.facing, DIRS.N, DIRS.E, DIRS.S, DIRS.W];
    for (const d of order) {
      const nx = s.px + DescentScene.DXA[d]!;
      const ny = s.py + DescentScene.DYA[d]!;
      if (nx < 0 || ny < 0 || nx >= s.w || ny >= s.h) continue;
      const t = s.tiles[ny * s.w + nx]!;
      if (t === Tile.ENTRY) {
        this.facing = d;
        this.applyFacing();
        this.confirmExit(d);
        return;
      }
      if (t === Tile.STAIRS_DOWN) {
        this.hud.toast("Stairs — step onto them, then Enter (or tap yourself).", "info");
        return;
      }
      if (DescentScene.SIM_INTERACTABLE.has(t)) {
        this.facing = d;
        this.applyFacing();
        this.enqueue(Action.INTERACT_N + d);
        return;
      }
    }
    this.audio.play("reject", true);
    this.hud.toast("Nothing answers.", "info");
  }

  /** Salt pre-validated against the sim's own ray rules (D97): a throw
   *  that cannot land no longer burns a silent turn. */
  private throwSaltSmart(): void {
    const s = this.state;
    if (s === null || !this.running || this.overlayOpen) return;
    let lands = false;
    for (let r = 1; r <= 2; r++) {
      const nx = s.px + DescentScene.DXA[this.facing]! * r;
      const ny = s.py + DescentScene.DYA[this.facing]! * r;
      if (nx < 0 || ny < 0 || nx >= s.w || ny >= s.h) break;
      const t = s.tiles[ny * s.w + nx]!;
      if (!DescentScene.WALKABLE.has(t) || this.livingAt(nx, ny) !== null) break;
      if (s.salt[ny * s.w + nx]! === 0) {
        lands = true;
        break;
      }
    }
    if (!lands) {
      this.audio.play("reject", true);
      this.hud.toast("No clear ground for the salt that way.", "info");
      return;
    }
    this.enqueue(Action.SALT_N + this.facing);
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

    // the hold CHARGES visibly (D96): without this, players hold, see
    // nothing move, and release before the threshold — "nothing happened"
    this.pressRing.clear();
    if (this.pressTile !== null && !this.pressConsumed) {
      const frac = Math.min(1, (time - this.pressAt) / LONG_PRESS_MS);
      if (frac > 0.18) {
        const p = this.input.activePointer;
        this.pressRing.lineStyle(3, COLOR.goldInk, 0.9);
        this.pressRing.beginPath();
        this.pressRing.arc(p.x, p.y - 34, 13, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
        this.pressRing.strokePath();
      }
    }

    if (this.pressTile !== null && !this.pressConsumed && time - this.pressAt >= LONG_PRESS_MS) {
      this.pressConsumed = true;
      this.pressRing.clear();
      this.inspect(this.pressTile.x, this.pressTile.y);
    }

    // a parked mouse's hover diamond fades after a beat (D96)
    if (this.cursorAt > 0 && time - this.cursorAt > 1200) {
      this.cursorG.clear();
      this.cursorAt = 0;
    }

    // threshold beacons breathe (D98): seen = ember of memory, lit = alive
    for (const b of this.beacons) {
      if (this.state.seen[b.i]! !== 1) {
        b.img.setAlpha(0);
        continue;
      }
      const vis = this.visibleMask[b.i]! === 1;
      const breathe = 0.7 + 0.3 * Math.sin(time / 640 + b.phase);
      b.img.setAlpha((vis ? 0.24 : 0.1) * breathe);
    }

    // hit-stop restoration: real game time is unscaled, so this is exact
    if (this.hitStopUntil > 0 && time >= this.hitStopUntil) {
      this.hitStopUntil = 0;
      this.tweens.timeScale = 1;
      if (this.dust !== null) this.dust.timeScale = 1;
    }

    // held-direction streaming (D92): only once a key has been HELD past
    // the repeat delay — a tap is exactly one step (the keydown event's),
    // a deliberate hold streams at drain cadence. Most recent key wins,
    // so rolling from W to D corners crisply without releasing.
    const HOLD_REPEAT_MS = 200;
    if (this.running && !this.overlayOpen && this.queue.length === 0) {
      let best: { d: number; op: number; t: number } | null = null;
      for (const h of this.heldDirs) {
        // two-frame confirmation (D97): must have been down LAST frame too
        if (h.key.isDown && h.wasDown && time - h.key.timeDown > HOLD_REPEAT_MS && (best === null || h.key.timeDown > best.t)) {
          best = { d: h.d, op: h.op, t: h.key.timeDown };
        }
      }
      if (best !== null) {
        this.facing = best.d;
        this.applyFacing();
        this.enqueue(best.op);
      }
    }
    for (const h of this.heldDirs) h.wasDown = h.key.isDown;

    if (
      this.queue.length > 0 &&
      !this.overlayOpen &&
      !this.ruleWait &&
      !this.floorLoading &&
      time - this.lastStep > 70 &&
      time >= this.hitStopUntil
    ) {
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
  // M2b: async gaps (unknown rule, floor fetch) live between ticks, never
  // inside the sim (08 §7). While either flag holds, the world is paused.
  private ruleWait = false;
  private floorLoading = false;

  private step(stepIn: Step, actLogged = false): void {
    const s0 = this.state;
    if (s0 === null || this.ruleWait || this.floorLoading) return;
    // lessons are dismissed by DOING (D93/D97): moves count on Ev.MOVED,
    // the door lesson on Ev.DOOR_OPENED — a FAILED attempt must not eat
    // the guidance at the exact moment the player got it wrong
    if (this.lessonKey === "cup" && stepIn.op === Action.CUP) {
      this.lessonDone("cup");
    }
    const before = this.meaningfulLearned();
    // Ev.TIER_CHANGED only carries the NEW radius — remember the old one so
    // handleEvent can tell a guttering-down from a brightening-up
    this.preTickRadius = effectiveRadius(s0);
    let result: TickResult;
    const ra = this.ports.resolveRuleAsync;
    if (ra === undefined) {
      result = tickResolving(s0, stepIn, this.rules, (key) => this.ports.resolveRule(key));
    } else {
      // remote play: an unknown rule holds the world while the Vault answers,
      // then the SAME step re-runs against the now-warmer table. A tick can
      // miss more than one rule — recursion drains them one round-trip each.
      const first = tick(s0, stepIn, this.rules);
      if (isRuleRequest(first)) {
        this.ruleWait = true;
        this.queue = [];
        // the triggering act must ride the flush: ActRes.rules is the set the
        // server's replay consulted, and it only consults what the log holds —
        // logged here EXACTLY ONCE (the re-run below passes actLogged)
        if (!actLogged) this.ports.actApplied?.(stepIn.op, stepIn.arg, s0.tick);
        void ra(first.needRule)
          .then((eff) => {
            this.rules.set(first.needRule, eff);
            this.ruleWait = false;
            this.step(stepIn, true);
          })
          .catch(() => {
            this.ruleWait = false;
            this.hud.toast("The Vault did not answer. Try once more.", "warning");
          });
        return;
      }
      result = first;
    }
    if (!actLogged) this.ports.actApplied?.(stepIn.op, stepIn.arg, s0.tick);
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
  private installFloor(next: number, attempt = 0): void {
    const s = this.state;
    if (s === null) return;
    const ga = this.ports.getFloorAsync;
    if (ga !== undefined) {
      // remote: the payload usually arrived with the stairs-touch prefetch;
      // when it didn't, hold the descent (world paused) and keep asking —
      // a lost descend otherwise strands the run in DESCENDING forever
      this.floorLoading = true;
      ga(next)
        .then((nf) => {
          this.floorLoading = false;
          this.finishInstallFloor(nf);
        })
        .catch(() => {
          if (attempt === 0) this.hud.toast("The stair below is slow to answer…", "info");
          this.time.delayedCall(1500, () => {
            this.floorLoading = false;
            this.installFloor(next, attempt + 1);
          });
        });
      return;
    }
    this.finishInstallFloor(this.ports.getFloor(next));
  }

  private finishInstallFloor(nf: FloorPayloadLike): void {
    const s = this.state;
    if (s === null) return;
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
    if (!this.echoWorldToasted && this.floorEchoes.length > 0) {
      this.echoWorldToasted = true;
      this.hud.toast("You are not the first down here today.", "info");
    }
  }

  // DEV-ONLY: deleted at M2 — L forces the Seal open (VICTORY) from anywhere,
  // so the operator can judge the Meeting without banking five truths.
  // K plays it as the HUNDREDTH candle: the Rescue finale (D106).
  private devHundredth = false;
  private devOpenSeal(hundredth = false): void {
    const s = this.state;
    if (s === null || !this.running || this.overlayOpen || s.status !== Status.ALIVE) return;
    this.devHundredth = hundredth;
    s.status = Status.VICTORY;
    this.audio.play("bank"); // stands in for the Seal grinding open
    this.hud.toast(hundredth ? "(dev) The hundredth candle." : "(dev) The Seal forgets its price.", "info");
    this.time.delayedCall(600, () => this.openVictory());
  }

  // DEV-ONLY: deleted at M2 — operator floor-skip for judging every biome
  // without earning the stairs. Same transition as a real descend.
  private devTpAt = 0; // debounce (D97: slow frames double-teleported)
  private devTeleport(target?: number): void {
    const s = this.state;
    if (s === null || !this.running || this.overlayOpen || s.status !== Status.ALIVE) return;
    if (this.time.now - this.devTpAt < 300) return;
    this.devTpAt = this.time.now;
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
        if (this.lessonKey === "move" && ++this.lessonMoves >= 3) this.lessonDone("move");
        // arriving ON the stairs names the next gesture (D97: touch had
        // no path to descend at all before)
        if (t === Tile.STAIRS_DOWN) {
          this.ports.prefetchFloor?.(s.floor + 1); // idempotent; hides the round-trip
          this.hud.toast("The stairs. Tap yourself (or Enter) to descend.", "info");
        }
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
          const claims = this.pendingBank;
          this.pendingBank = null;
          const ba = this.ports.bankClaimsAsync;
          if (ba !== undefined) {
            void ba(claims).catch(() =>
              this.hud.toast("The Codex is distant — your truths ride with the run's end.", "warning"),
            );
          } else {
            this.ports.bankClaims(claims);
          }
        }
        this.hud.toast(
          `${e.a} truth${e.a === 1 ? "" : "s"} committed to the Codex — ${e.a === 1 ? "it belongs" : "they belong"} to every delver now.`,
          "discovery",
        );
        cue("bank");
        break;
      case Ev.REJECTED:
        if (e.a === Action.BANK && this.pendingBank !== null) {
          this.pendingBank = null;
          this.hud.toast("The stone is beyond reach — nothing was committed.", "warning");
          cue("reject");
          break;
        }
        // EVERY rejection is heard (D97): these still cost a turn of wax
        // sim-side, and total silence read as broken controls
        cue("reject", true);
        if (this.time.now - this.lastRejectAt > 2500) {
          this.lastRejectAt = this.time.now;
          this.hud.toast("Nothing answers.", "info");
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
        this.lessonDone("interact"); // the door GAVE — lesson learned (D97)
        this.puffAt(e.a, e.b, 8); // old hinges shed their dust (D75)
        cue("door");
        break;
      case Ev.DOOR_FORCED:
        this.lessonDone("interact");
        this.puffAt(e.a, e.b, 12);
        cue("door-force");
        // the hidden extra cost surfaces (D97): stuck doors are not free
        this.hud.toast("You force it — loud, and it takes wax.", "warning");
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
        this.lastHurtKind = e.a; // the epitaph names your killer (D98)
        this.damageFloat(e.b);
        this.impact(0.003 + e.b * 0.0002);
        this.hitStop(80);
        this.damageFlash();
        cue("bite");
        break;
      case Ev.FIRE_HURT:
        this.damageFloat(e.b);
        this.impact(0.005);
        this.hitStop(80);
        this.damageFlash();
        cue("fire");
        break;
      case Ev.SHOCK:
        this.damageFloat(e.b);
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
        this.audio.stopMenuTheme(); // the music dies with the candle (D93)
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
        this.lessonDone("wax"); // the candle drank — lesson learned (D95)
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
        this.lessonDone("use-chalk"); // you drew the mark — lesson learned
        this.ports.chalkChanged(s.floor, s.chalk);
        cue("chalk");
        break;
      case Ev.SALT_PLACED:
        this.lessonDone("use-salt"); // the line is poured — lesson learned
        cue("salt");
        break;
      case Ev.PLATE_PRESSED:
        cue("plate");
        break;
      case Ev.ITEM_USED:
        this.lessonDone(`find:${e.a}`); // you spent it — its lesson is learned
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
          this.lessonDone("use-flint"); // the flame is back — lesson learned
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

  /** Any of the 4 orthogonal neighbours currently inside the light? */
  private adjacentVisible(x: number, y: number): boolean {
    const s = this.state;
    if (s === null) return false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= s.w || ny >= s.h) continue;
      if (this.visibleMask[ny * s.w + nx]! === 1) return true;
    }
    return false;
  }

  /** A bite you can READ (D98): candle-burn and monster-damage felt
   *  identical, so players credited their own flame's cost to whatever
   *  was walking behind them. Real damage now rises off the body. */
  private damageFloat(amount: number): void {
    const s = this.state;
    if (s === null || amount <= 0) return;
    const c = gridToScreen(s.px, s.py);
    const t = this.add
      .text(c.sx, c.sy - 44, `−${amount}`, {
        fontFamily: "Georgia, serif",
        fontSize: "15px",
        fontStyle: "italic",
        color: "#a33b2e",
      })
      .setOrigin(0.5);
    t.setResolution(Math.min(window.devicePixelRatio || 1, 3));
    t.depth = 860;
    this.worldLayer.add(t);
    this.tweens.add({
      targets: t,
      y: c.sy - 68,
      alpha: { from: 1, to: 0 },
      duration: 900,
      ease: "Sine.easeOut",
      onComplete: () => t.destroy(),
    });
  }

  private playBump(): void {
    const b = this.pendingBump;
    this.pendingBump = null;
    if (b === null || this.state === null) return;
    const target = gridToScreen(b.x, b.y);
    const here = gridToScreen(this.state.px, this.state.py);
    // D95 playtest: the old 14%/55ms twitch was invisible in practice —
    // and most Reddit players are muted, so this recoil IS the bump.
    // Anchor to the TRUE rest pose first: back-to-back bumps otherwise
    // compound the relative tween and drift the sprite off its tile.
    this.tweens.killTweensOf(this.playerView);
    this.playerView.setPosition(here.sx, here.sy + HALF_H - 2);
    this.tweens.add({
      targets: this.playerView,
      x: `+=${(target.sx - here.sx) * 0.3}`,
      y: `+=${(target.sy - here.sy) * 0.3}`,
      duration: 80,
      yoyo: true,
      ease: "Sine.easeOut",
    });
    // dust where flesh met stone
    this.puffAt(b.x, b.y, 3);
    // grinding into hidden walls is the classic new-player fugue — teach
    const now = this.time.now;
    this.bumpStreak = now - this.lastBumpAt < 2600 ? this.bumpStreak + 1 : 1;
    this.lastBumpAt = now;
    if (this.bumpStreak >= 3) {
      this.teach("blocked", "Stone. The dark hides walls — what your light has not touched is not yet real.", {
        timed: 7000,
        title: "The unseen stone",
      });
    }
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
    // the human fingerprint (D107): an echo must read as a PERSON, not VFX
    this.teach(
      "echo",
      "That shape is an echo — the last minutes of a delver who fell here today. Watch where it goes. Watch where it stops.",
      { timed: 10000, title: "Those who came before" },
    );
    this.hud.toast("One who fell here today retraces their last steps…", "discovery");
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
    this.lightMap = light; // runGuides reads it: teach only what is LIT (D96)
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
    // the halo lives at the PLAYER'S depth, not above the world (D95):
    // a fixed depth let the amber wash paint OVER walls that stand
    // between camera and delver — light must not shine through stone
    this.halo.depth = depthOf(s.px, s.py, Layer.WALL);
    positionVeil(this.lightVeil, s, effR);
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

    // the inspect lesson's marker FOLLOWS the creature it points at (D96):
    // a static diamond over a tile the beast already left reads as a lie
    if (this.lessonKey === "inspect" && this.lessonMark !== null) {
      for (const e2 of s.entities) {
        const ei2 = e2.y * s.w + e2.x;
        if (e2.kind !== EntityKind.CORPSE && this.visibleMask[ei2]! === 1 && (light[ei2] ?? 0) >= 0.3) {
          const mc = gridToScreen(e2.x, e2.y);
          this.lessonMark.setPosition(mc.sx, mc.sy);
          this.lessonMark.depth = depthOf(e2.x, e2.y, Layer.CORPSE);
          break;
        }
      }
    }

    const pc = gridToScreen(s.px, s.py);
    const pi = s.py * s.w + s.px;
    // +0.5: the delver wins depth ties against same-tile-row entities
    // instead of flickering on insertion order (D73)
    this.glide(this.playerView, pc.sx, pc.sy + HALF_H - 2, depthOf(s.px, s.py, Layer.ENTITY) + 0.5, instant);
    this.glide(this.playerShadow, pc.sx, pc.sy + 4, depthOf(s.px, s.py, Layer.CORPSE), instant);
    this.applyFacing();
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

    // threshold beacons rebuild when the floor changes (D98)
    if (this.beaconFloor !== s.floor) {
      this.beaconFloor = s.floor;
      for (const b of this.beacons) b.img.destroy();
      this.beacons = [];
      for (let i = 0; i < s.tiles.length; i++) {
        const bt = s.tiles[i];
        if (bt !== Tile.ENTRY && bt !== Tile.STAIRS_DOWN) continue;
        const bx = i % s.w;
        const by = (i / s.w) | 0;
        const bc = gridToScreen(bx, by);
        const img = this.add.image(bc.sx, bc.sy, "halo");
        img.setBlendMode(Phaser.BlendModes.ADD);
        img.setDisplaySize(TILE_W * 1.15, TILE_H * 1.15);
        img.setTint(bt === Tile.ENTRY ? COLOR.flame : COLOR.verdigris);
        img.depth = depthOf(bx, by, Layer.CORPSE); // over ground, under feet
        img.setAlpha(0);
        this.worldLayer.add(img);
        this.beacons.push({ img, i, phase: (bx * 7 + by * 13) % 10 });
      }
    }

    // what must never be buried behind glass-faded walls (D96)
    this.importantTiles.clear();
    this.importantTiles.add(s.py * s.w + s.px);
    for (const e2 of s.entities) {
      if (e2.kind !== EntityKind.CORPSE && this.visibleMask[e2.y * s.w + e2.x]! === 1) {
        this.importantTiles.add(e2.y * s.w + e2.x);
      }
    }

    this.props.forEach((prop, i) => {
      const x = i % s.w;
      const y = (i / s.w) | 0;
      const seen = s.seen[i]! === 1;
      const vis = this.visibleMask[i]! === 1;
      if (!seen) {
        // penumbra (D95, tightened D96): an unseen WALL beside the player
        // shows as a faint cold silhouette — but only within arm's reach
        // (manhattan ≤ 2). The first cut ringed the WHOLE light pool in
        // ghosts and read as clutter; the point is "what will I bump
        // NEXT", not an x-ray of the room. Items in the dark stay secret.
        const near = Math.abs(x - s.px) + Math.abs(y - s.py) <= 2;
        if (near && isWallishTile(prop.tile) && this.adjacentVisible(x, y)) {
          prop.sprite.setVisible(true);
          prop.sprite.setTint(MEMORY_TINT);
          prop.occluded = false;
          prop.sprite.setAlpha(0.32);
        } else {
          prop.sprite.setVisible(false);
        }
        return;
      }
      prop.sprite.setVisible(true);
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
    this.lessonDone("bank"); // the stone answered — lesson learned (D97)
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
      const report = {
        day: this.ports.getGuildhall().day,
        floor: s.floor,
        x: s.px,
        y: s.py,
        cause: s.deathCause,
        lastWords: result.lastWords,
        gift: result.gift,
        unbanked: this.unbankedThisRun(),
        echoFrames: this.echoRing.slice(),
      };
      const rda = this.ports.reportDeathAsync;
      if (rda !== undefined) void rda(report).catch(() => undefined);
      else this.ports.reportDeath(report);
      this.confirmRun();
      this.afterCeremony(rest);
    }, { truths, nearClaims, nearMiss }, ENTITY_NAMES[this.lastHurtKind]);
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
      this.sendExit();
      this.afterCeremony(rest);
    });
  }

  /** Exit report over whichever wire this session has (08 §7). */
  private sendExit(): void {
    const rea = this.ports.reportExitAsync;
    if (rea !== undefined) void rea().catch(() => undefined);
    else this.ports.reportExit();
  }

  private openVictory(): void {
    const host = this.host();
    if (host === null || this.state === null) return;
    closeAllSheets(host);
    this.overlayOpen = true;
    this.running = false;
    this.audio.setHeartbeat(false);
    // The Seal breaks into her music, not fanfare: the Meeting first — she
    // is what the Vault was keeping — then the victory sheet reframed as
    // the wax-gift (D101). Her tune rises to full presence under the plates
    // (D104, operator: "without music it was emotionless").
    this.audio.setDarkness(0);
    this.audio.startMeetingTheme();
    // gate goal is 100, so the day's gatePct IS the season's candle count
    // (D105) — this victory is the next one given. The hundredth (or the
    // dev K key) completes the Long Rescue: the finale plates play (D106).
    const giftNo = this.devHundredth ? 100 : Math.min(100, this.ports.getGuildhall().gatePct + 1);
    this.devHundredth = false;
    const finale = giftNo >= 100;
    if (finale) this.registry.set(RESCUED_KEY, true); // the menu stays changed (D108)
    openMeeting(host, () => {
      this.audio.play("victory");
      openVictorySheet(host, this.runSummary(), () => {
        this.confirmRun();
        this.afterCeremony(true);
      }, giftNo, finale);
    }, this.audio, finale);
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
