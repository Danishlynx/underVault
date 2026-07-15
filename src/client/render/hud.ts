/**
 * The Descent HUD per 04 §4.3 (pure Phaser, screen-fixed), orientation-
 * aware: every position derives from the CURRENT canvas size and layout()
 * re-flows on resize (portrait 480×854 / landscape 854×480). Structure:
 * top-left depth plaque · top-right mute (stub) + menu · left-edge
 * CandleMeter (height adapts) · bottom bar 72 px with Cup, SlotGrid ×6,
 * Snuff hold-to-confirm (450 ms). Danger rule: radius ≤ 2 → bar opacity
 * 100% + ember rim. Values from tokens only.
 */

import Phaser from "phaser";
import { COLOR, HUD, MOTION } from "../../../design/tokens/tokens.js";
import { Candle, Item, type SimState } from "../../shared/sim/types.js";
import { START_WAX } from "../../shared/sim/constants.js";
import { TEX_SCALE } from "./tilemap.js";
import { uiScale } from "../game.js";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX",
  "XXI", "XXII", "XXIII", "XXIV", "XXV"];

/** Slot icon per carriable item — chalk is the fallback no more (D64). */
const ITEM_ICON: Record<number, string> = {
  [Item.FLINT]: "icon-flint",
  [Item.SALT]: "icon-salt",
  [Item.CHALK]: "icon-chalk",
  [Item.MIRROR]: "icon-mirror",
  [Item.BELL]: "icon-bell",
  [Item.GLOWVIAL]: "icon-glowvial",
  [Item.DOUSE]: "icon-douse",
  [Item.KEY_IRON]: "icon-key",
  [Item.KEY_MASTER]: "icon-keymaster",
  [Item.WSHARD]: "icon-wshard",
  [Item.ROPE]: "icon-rope",
  [Item.WAXCAKE]: "icon-waxcake",
  [Item.BONEKEY]: "icon-bonekey",
};
const SANS = "system-ui, sans-serif"; // 04 §2.2 body fallback stack
const SERIF = "Georgia, serif"; // display fallback until bitmap fonts (W4)

const METER_X = 16;
const METER_Y = 120;

export interface HudCallbacks {
  onCup(): void;
  onSnuffComplete(): void;
  onRelight(): void;
  onRestart(): void;
  onUseSlot(slot: number): void;
  /** toggle audio; returns the new muted state for display */
}

export class Hud {
  private readonly scene: Phaser.Scene;
  private readonly cb: HudCallbacks;
  private readonly layer: Phaser.GameObjects.Layer | null;

  // High-DPI (D121): the game buffer renders in PHYSICAL pixels (game.ts), so
  // the whole HUD is parented to this root and scaled by uiScale() — the HUD is
  // authored in LOGICAL/CSS pixels (unchanged design metrics) and the root
  // magnifies it to keep the same apparent size while gaining the buffer's
  // crispness. layout() re-applies the scale so a dpr change tracks live.
  private root!: Phaser.GameObjects.Container;

  private w = 0;
  private h = 0;
  private barY = 0;
  private meterH = 300;

  private plaque!: Phaser.GameObjects.Rectangle;
  private plaqueInner!: Phaser.GameObjects.Rectangle;
  private depthText!: Phaser.GameObjects.Text;
  private objectiveText!: Phaser.GameObjects.Text;
  private menuText!: Phaser.GameObjects.Text;
  private barRect!: Phaser.GameObjects.Rectangle;
  private barRim!: Phaser.GameObjects.Rectangle;
  private cupBtn!: Phaser.GameObjects.Container;
  private cupFill!: Phaser.GameObjects.Arc;
  private snuffBtn!: Phaser.GameObjects.Container;
  private snuffRing!: Phaser.GameObjects.Graphics;
  private snuffLabel!: Phaser.GameObjects.Text;
  private slots: Phaser.GameObjects.Container[] = [];
  private slotCharges: Phaser.GameObjects.Text[] = [];
  private meterBg!: Phaser.GameObjects.Rectangle;
  private meterFill!: Phaser.GameObjects.Rectangle;
  private meterFlame!: Phaser.GameObjects.Arc;
  private meterGlow!: Phaser.GameObjects.Image;
  private meterZone!: Phaser.GameObjects.Rectangle;
  private waxText!: Phaser.GameObjects.Text;
  private waxTextTimer = 0;
  private graceText!: Phaser.GameObjects.Text;
  private restartArmedAt = 0;

  private snuffHoldStart = 0;
  private snuffHolding = false;

  constructor(scene: Phaser.Scene, cb: HudCallbacks, layer: Phaser.GameObjects.Layer | null = null) {
    this.scene = scene;
    this.cb = cb;
    this.layer = layer;
    this.build();
    this.layout(scene.scale.width, scene.scale.height);
  }

  private fixed<T extends Phaser.GameObjects.GameObject & { setScrollFactor(v: number): T }>(o: T): T {
    o.setScrollFactor(0);
    (o as unknown as { depth: number }).depth = 1000;
    this.root.add(o);
    return o;
  }

  // ── Construction (positions applied in layout()) ─────────────────────────
  private build(): void {
    const s = this.scene;

    // the DPR-compensation root — everything the HUD builds lives under it so a
    // single scale keeps apparent sizes right against the physical-px buffer.
    this.root = s.add.container(0, 0);
    this.root.setScrollFactor(0);
    this.root.setDepth(1000);
    this.root.setScale(uiScale());
    this.layer?.add(this.root);

    this.plaque = this.fixed(s.add.rectangle(0, 0, 96, 36, COLOR.surface, 0.92).setOrigin(0, 0));
    this.plaque.setStrokeStyle(1, COLOR.borderVoid, 1);
    this.plaqueInner = this.fixed(s.add.rectangle(0, 0, 88, 28, COLOR.surface, 0).setOrigin(0, 0));
    this.plaqueInner.setStrokeStyle(1, COLOR.borderVoid, 0.5);
    this.depthText = this.fixed(
      s.add.text(0, 0, "Fl. I", { fontFamily: SERIF, fontSize: "20px", color: "#b7ae9c" }).setOrigin(0.5, 0.5),
    );
    // the standing order under the plaque — a player must always know what
    // the game is asking of them right now (D66)
    this.objectiveText = this.fixed(
      s.add.text(0, 0, "", { fontFamily: SANS, fontSize: "11px", fontStyle: "italic", color: "#7e786c" }).setOrigin(0, 0),
    );

    // NO in-HUD audio control (D98 operator override, twice confirmed):
    // the music is part of the game and stays on during play. The menu's
    // SOUND toggle remains the app-level control. Invariant 6's
    // "always visible" is overridden by the operator — logged in
    // DECISIONS; visibilitychange hard-mute is untouched.
    this.menuText = this.fixed(
      s.add.text(0, 0, "≡", { fontFamily: SANS, fontSize: "28px", color: "#b7ae9c" }).setOrigin(0.5, 0),
    );
    this.menuText.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-16, -6, HUD.touchTarget, HUD.touchTarget),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    this.menuText.on("pointerdown", () => {
      const now = this.scene.time.now;
      if (now - this.restartArmedAt < 2000) {
        this.cb.onRestart();
      } else {
        this.restartArmedAt = now;
        this.toast("Tap again to strike a fresh match", "info");
      }
    });

    // CandleMeter
    this.meterBg = this.fixed(s.add.rectangle(0, 0, HUD.candleMeterW, this.meterH, COLOR.surface2, 0.8).setOrigin(0, 0));
    this.meterFill = this.fixed(
      s.add.rectangle(0, 0, HUD.candleMeterW - 2, this.meterH - 2, COLOR.parchment, 0.95).setOrigin(0, 1),
    );
    this.meterGlow = this.fixed(s.add.image(0, 0, "halo"));
    this.meterGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.meterGlow.setDisplaySize(44, 44);
    this.meterGlow.setTint(COLOR.flame);
    this.meterFlame = this.fixed(s.add.circle(0, 0, 5, COLOR.flameHi, 1));
    this.waxText = this.fixed(s.add.text(0, 0, "", { fontFamily: SANS, fontSize: "14px", color: "#b7ae9c" }));
    this.meterZone = this.fixed(s.add.rectangle(0, 0, HUD.touchTarget, this.meterH + 40, COLOR.void, 0.001).setOrigin(0, 0));
    this.meterZone.setInteractive();
    this.meterZone.on("pointerdown", () => {
      this.waxTextTimer = this.scene.time.now + 2000;
    });

    // Bottom bar
    this.barRect = this.fixed(s.add.rectangle(0, 0, 100, HUD.bottomBarH, COLOR.surface, HUD.bottomBarAlpha).setOrigin(0, 0));
    this.barRim = this.fixed(s.add.rectangle(0, 0, 100, 2, COLOR.ember, 0).setOrigin(0, 0));

    this.cupBtn = this.buildRoundButton("CUP", () => this.cb.onCup());
    this.cupFill = this.fixed(s.add.circle(0, 0, (HUD.iconToggle >> 1) - 6, COLOR.flame, 0));

    for (let i = 0; i < 6; i++) {
      const cell = this.fixed(s.add.container(0, 0));
      const bg = s.add.rectangle(0, 0, HUD.slotCell, HUD.slotCell, COLOR.surface2, 1).setOrigin(0, 0);
      bg.setStrokeStyle(1, COLOR.borderVoid, 1);
      bg.setScrollFactor(0);
      bg.setInteractive({ useHandCursor: true });
      const slotIndex = i;
      bg.on("pointerdown", () => {
        // pressed-state flash (D97): a tap must LOOK received
        bg.setFillStyle(COLOR.surface2, 0.6);
        this.cb.onUseSlot(slotIndex);
      });
      bg.on("pointerup", () => bg.setFillStyle(COLOR.surface2, 1));
      bg.on("pointerout", () => bg.setFillStyle(COLOR.surface2, 1));
      const underline = s.add.rectangle(4, HUD.slotCell - 3, HUD.slotCell - 8, 1, COLOR.flame, 0).setOrigin(0, 0);
      const icon = s.add.image(HUD.slotCell >> 1, (HUD.slotCell >> 1) - 2, "icon-flint").setVisible(false);
      icon.setScale(TEX_SCALE); // icons are baked on 4× masters
      const charges = s.add
        .text(HUD.slotCell - 4, HUD.slotCell - 15, "", { fontFamily: SANS, fontSize: "11px", color: "#f5a93f" })
        .setOrigin(1, 0);
      cell.add([bg, underline, icon, charges]);
      this.slots.push(cell);
      this.slotCharges.push(charges);
      (cell as unknown as { iconImg: Phaser.GameObjects.Image }).iconImg = icon;
      (cell as unknown as { underlineRect: Phaser.GameObjects.Rectangle }).underlineRect = underline;
    }

    this.snuffBtn = this.buildRoundButton("SNUFF", () => undefined);
    this.snuffRing = this.fixed(s.add.graphics());
    this.snuffLabel = this.snuffBtn.getAt(1) as Phaser.GameObjects.Text;
    const hit = this.snuffBtn.getAt(0) as Phaser.GameObjects.Arc;
    hit.on("pointerdown", () => {
      if (this.snuffLabel.text === "LIGHT") {
        this.cb.onRelight();
        return;
      }
      this.snuffHolding = true;
      this.snuffHoldStart = this.scene.time.now;
    });
    const cancel = (): void => {
      this.snuffHolding = false;
      this.snuffRing.clear();
    };
    hit.on("pointerup", cancel);
    hit.on("pointerout", cancel);

    this.graceText = this.fixed(
      s.add.text(0, 0, "", { fontFamily: SERIF, fontSize: "22px", color: "#a33b2e", align: "center" }).setOrigin(0.5, 0),
    );

    // crisp glyphs on HiDPI displays — the sanctioned per-Text fix (D75)
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const texts: Phaser.GameObjects.Text[] = [
      this.depthText, this.objectiveText, this.menuText,
      this.waxText, this.graceText, this.snuffLabel, ...this.slotCharges,
    ];
    for (const c of [this.cupBtn, this.snuffBtn]) {
      const label = c.getAt(1);
      if (label instanceof Phaser.GameObjects.Text) texts.push(label);
    }
    for (const t of texts) t.setResolution(dpr);
  }

  private buildRoundButton(label: string, onTap: () => void): Phaser.GameObjects.Container {
    const s = this.scene;
    const c = this.fixed(s.add.container(0, 0));
    const circle = s.add.circle(0, 0, HUD.iconToggle >> 1, COLOR.surface2, 1);
    circle.setStrokeStyle(1, COLOR.borderVoid, 1);
    circle.setScrollFactor(0); // hit area must not drift with camera scroll
    circle.setInteractive({ useHandCursor: true });
    const text = s.add.text(0, 0, label, { fontFamily: SANS, fontSize: "12px", color: "#b7ae9c" }).setOrigin(0.5, 0.5);
    text.setScrollFactor(0);
    c.add([circle, text]);
    // pressed-state flash on every round button (D97)
    circle.on("pointerdown", () => circle.setFillStyle(COLOR.surface2, 0.6));
    circle.on("pointerup", () => circle.setFillStyle(COLOR.surface2, 1));
    circle.on("pointerout", () => circle.setFillStyle(COLOR.surface2, 1));
    if (label === "CUP") circle.on("pointerdown", onTap);
    return c;
  }

  // ── Layout: everything derives from the current canvas size ─────────────
  layout(w: number, h: number): void {
    // args arrive in PHYSICAL px (scene.scale = the buffer). The HUD is authored
    // in LOGICAL px; the root magnifies it by the DPR factor (D121), so convert
    // the canvas size down to logical here and everything below is unchanged.
    const f = uiScale();
    this.root.setScale(f);
    w = w / f;
    h = h / f;
    this.w = w;
    this.h = h;
    // D126: on touch devices lift the bar clear of mobile-browser bottom
    // chrome (Chrome's nav bar overlaps embedded webviews and hid CUP/SNUFF
    // entirely on mobile web — the only snuff/cup path a phone has). The
    // Reddit app is fullscreen so the lift just breathes; mobile web survives.
    const touchLift =
      typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches ? 34 : 0;
    this.barY = h - HUD.bottomBarH - touchLift;
    this.meterH = Math.min(300, h - METER_Y - HUD.bottomBarH - touchLift - 16);

    this.plaque.setPosition(16, 16);
    this.plaqueInner.setPosition(20, 20);
    this.depthText.setPosition(16 + 48, 16 + 18);
    this.objectiveText.setPosition(17, 58);
    this.menuText.setPosition(w - 40, 12);

    this.meterBg.setPosition(METER_X, METER_Y);
    this.meterBg.setSize(HUD.candleMeterW, this.meterH);
    this.meterFill.setPosition(METER_X + 1, METER_Y + this.meterH - 1);
    this.meterFill.setSize(HUD.candleMeterW - 2, this.meterH - 2);
    this.meterFill.setOrigin(0, 1);
    this.meterGlow.setPosition(METER_X + (HUD.candleMeterW >> 1), METER_Y - 8);
    this.meterFlame.setPosition(METER_X + (HUD.candleMeterW >> 1), METER_Y - 8);
    this.waxText.setPosition(METER_X + 20, METER_Y - 14);
    this.meterZone.setPosition(METER_X - 8, METER_Y - 20);
    this.meterZone.setSize(HUD.touchTarget, this.meterH + 40);

    this.barRect.setPosition(0, this.barY);
    this.barRect.setSize(w, HUD.bottomBarH);
    this.barRim.setPosition(0, this.barY - 1);
    this.barRim.setSize(w, 2);

    const midY = this.barY + (HUD.bottomBarH >> 1);
    this.cupBtn.setPosition(52, midY);
    this.cupFill.setPosition(52, midY);
    // slots centered between the two round buttons
    const slotsW = 6 * (HUD.slotCell + 4) - 4;
    const gridX = Math.max(100, (w - slotsW) >> 1);
    for (let i = 0; i < 6; i++) {
      this.slots[i]!.setPosition(gridX + i * (HUD.slotCell + 4), this.barY + 12);
    }
    // w-44 not w-52 (D97): the circle overlapped slot 6 by 8px at 480 wide
    this.snuffBtn.setPosition(w - 44, midY);
    this.graceText.setPosition(w >> 1, 120);
  }

  /** The meter's touch strip in PHYSICAL screen coords (the scene input guard
   *  in Descent compares against physical pointer coords). Width 56 (D97): the
   *  old 64 ate a sliver of playable world. Scaled by the DPR factor (D121). */
  meterBounds(): { x: number; y: number; w: number; h: number } {
    const f = uiScale();
    return { x: 0, y: (METER_Y - 20) * f, w: 56 * f, h: (this.meterH + 40) * f };
  }

  // ── Per-frame ────────────────────────────────────────────────────────────
  updateFrame(now: number): void {
    if (this.snuffHolding) {
      const t = (now - this.snuffHoldStart) / HUD.snuffHoldMs;
      this.snuffRing.clear();
      const cx = this.w - 44; // matches the shifted SNUFF circle (D97)
      const cy = this.barY + (HUD.bottomBarH >> 1);
      this.snuffRing.setScrollFactor(0);
      this.snuffRing.depth = 1001;
      this.snuffRing.lineStyle(4, COLOR.ember, 1);
      this.snuffRing.beginPath();
      this.snuffRing.arc(cx, cy, (HUD.iconToggle >> 1) + 4, -Math.PI / 2, -Math.PI / 2 + Math.min(t, 1) * Math.PI * 2);
      this.snuffRing.strokePath();
      if (t >= 1) {
        this.snuffHolding = false;
        this.snuffRing.clear();
        this.cb.onSnuffComplete();
      }
    }
    if (this.waxText.text !== "" && now > this.waxTextTimer) this.waxText.setText("");
    if (this.meterGlow.visible) {
      this.meterGlow.setAlpha(0.7 + 0.3 * Math.sin(now / 180));
    }
  }

  // ── Per-turn ─────────────────────────────────────────────────────────────
  update(state: SimState, radius: number, day: number): void {
    this.depthText.setText(`Fl. ${ROMAN[state.floor] ?? String(state.floor)}`);
    void day;

    const frac = Math.min(state.wax / START_WAX, 1);
    this.meterFill.setScale(1, frac);
    const low = state.wax < START_WAX * 0.3;
    this.meterFlame.setFillStyle(state.candle === Candle.SNUFFED ? COLOR.boneDim : low ? COLOR.ember : COLOR.flameHi, 1);
    const burning = state.graceLeft === 0 && state.candle !== Candle.SNUFFED;
    this.meterFlame.setVisible(burning);
    this.meterGlow.setVisible(burning);
    this.meterGlow.setTint(low ? COLOR.ember : COLOR.flame);
    if (this.waxTextTimer > this.scene.time.now) this.waxText.setText(String(state.wax));

    this.cupFill.setAlpha(state.candle === Candle.CUPPED ? 0.5 : 0);
    this.snuffLabel.setText(state.candle === Candle.SNUFFED ? "LIGHT" : "SNUFF");

    for (let i = 0; i < 6; i++) {
      const item = state.inv[i]!;
      const charges = state.invCharges[i]!;
      const icon = (this.slots[i] as unknown as { iconImg: Phaser.GameObjects.Image }).iconImg;
      const underline = (this.slots[i] as unknown as { underlineRect: Phaser.GameObjects.Rectangle }).underlineRect;
      if (item === Item.NONE) {
        icon.setVisible(false);
        underline.setAlpha(0);
      } else {
        icon.setTexture(ITEM_ICON[item] ?? "icon-chalk");
        icon.setVisible(true);
        icon.setAlpha(charges === 0 ? 0.28 : 1);
        underline.setAlpha(charges === 0 ? 0.15 : 0.8);
      }
      // every multi-charge consumable shows its count (D64)
      const countable = item !== Item.NONE && item !== Item.FLINT &&
        item !== Item.KEY_IRON && item !== Item.KEY_MASTER;
      this.slotCharges[i]!.setText(countable && charges > 0 ? String(charges) : "");
    }

    if (state.graceLeft > 0) {
      this.graceText.setText(`THE DARK GRACE — ${state.graceLeft}\nreach flame, or the way out`);
    } else {
      this.graceText.setText("");
    }

    const danger = radius <= 2;
    this.barRect.setFillStyle(COLOR.surface, danger ? 1 : HUD.bottomBarAlpha);
    this.barRim.setAlpha(danger ? 1 : 0);
  }

  setObjective(text: string): void {
    if (this.objectiveText.text !== text) this.objectiveText.setText(text);
  }

  // ── Lessons of the Wick (D93, dressed D96): the teaching plaque — a
  // little manuscript folio against the dark, ONE at a time, dismissed by
  // DOING the thing it teaches. Built as a single container so its
  // entrance/exit can never strand half-faded pieces. ─────────────────────
  private lessonBox: Phaser.GameObjects.Container | null = null;

  lesson(text: string, title = "The Wick teaches"): void {
    this.clearLesson();
    const s = this.scene;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const eyebrow = s.add
      .text(0, 0, title.toUpperCase(), {
        fontFamily: SANS,
        fontSize: "10px",
        color: "#8a6d35",
      })
      .setOrigin(0.5);
    eyebrow.setLetterSpacing(3);
    eyebrow.setResolution(dpr);
    const t = s.add
      .text(0, 0, text, {
        fontFamily: SERIF,
        fontSize: "15px",
        fontStyle: "italic",
        color: "#2a2520",
        align: "center",
        wordWrap: { width: Math.min(430, this.w - 72) },
      })
      .setOrigin(0.5);
    t.setResolution(dpr);
    const w = Math.max(t.width, eyebrow.width) + 44;
    const h = t.height + eyebrow.height + 38;
    eyebrow.setY(-h / 2 + 8 + eyebrow.height / 2);
    t.setY(eyebrow.y + eyebrow.height / 2 + 9 + t.height / 2);
    const g = s.add.graphics();
    // soft shadow, parchment leaf, double ink rule (the sacred-panel frame)
    g.fillStyle(COLOR.void, 0.4);
    g.fillRoundedRect(-w / 2 + 3, -h / 2 + 4, w, h, 2);
    g.fillStyle(COLOR.parchment, 0.97);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 2);
    g.lineStyle(1, COLOR.ink, 0.9);
    g.strokeRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 1);
    g.lineStyle(1, COLOR.ink, 0.4);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 2);
    // gold-ink diamonds bridging the top and bottom rules — folio marks
    g.fillStyle(COLOR.goldInk, 1);
    for (const dy of [-h / 2, h / 2]) {
      g.beginPath();
      g.moveTo(0, dy - 3.2);
      g.lineTo(3.2, dy);
      g.lineTo(0, dy + 3.2);
      g.lineTo(-3.2, dy);
      g.closePath();
      g.fillPath();
    }
    // hairline under the chapter heading
    const sepY = eyebrow.y + eyebrow.height / 2 + 4.5;
    g.lineStyle(1, COLOR.ink, 0.25);
    g.beginPath();
    g.moveTo(-w / 2 + 26, sepY);
    g.lineTo(w / 2 - 26, sepY);
    g.strokePath();
    const box = s.add.container(this.w >> 1, this.h - HUD.bottomBarH - h / 2 - 20, [g, eyebrow, t]);
    box.setScrollFactor(0);
    box.depth = 1001;
    this.root.add(box);
    this.lessonBox = box;
    box.setAlpha(0);
    box.y += 6;
    s.tweens.add({ targets: box, alpha: 1, y: "-=6", duration: 240, ease: "Sine.easeOut" });
  }

  clearLesson(): void {
    const box = this.lessonBox;
    if (box === null) return;
    this.lessonBox = null;
    this.scene.tweens.add({ targets: box, alpha: 0, duration: 200, onComplete: () => box.destroy() });
  }

  /** Toasts stack downward so two whispers never overlap (D98). */
  private activeToasts: Phaser.GameObjects.Container[] = [];

  /**
   * A whisper from the Vault (D98, operator: "make them professional"):
   * dark leaf, hairline frame and one small diamond in the KIND's color —
   * the accent carries the meaning, the words stay parchment. Same
   * manuscript grammar as the lesson plaques, quieter register.
   */
  toast(text: string, kind: "info" | "discovery" | "warning" | "death"): void {
    const s = this.scene;
    const accent =
      kind === "discovery" ? COLOR.verdigris : kind === "warning" ? COLOR.ember : kind === "death" ? COLOR.seal : COLOR.boneDim;
    const body = text.replace(/^◆\s*/, ""); // the diamond is drawn, not typed
    const t = s.add
      .text(0, 0, body, {
        fontFamily: SERIF,
        fontSize: "14px",
        fontStyle: "italic",
        color: "#eae0c9",
        align: "center",
        wordWrap: { width: Math.min(360, this.w - 90) },
      })
      .setOrigin(0.5);
    t.setResolution(Math.min(window.devicePixelRatio || 1, 3)); // D75
    const w = t.width + 36;
    const h = t.height + 16;
    const g = s.add.graphics();
    g.fillStyle(COLOR.void, 0.5);
    g.fillRoundedRect(-w / 2 + 2, -h / 2 + 3, w, h, 2);
    g.fillStyle(COLOR.surface, 0.95);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 2);
    g.lineStyle(1, accent, 0.6);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 2);
    g.fillStyle(accent, 1);
    g.beginPath();
    g.moveTo(0, -h / 2 - 2.6);
    g.lineTo(2.6, -h / 2);
    g.lineTo(0, -h / 2 + 2.6);
    g.lineTo(-2.6, -h / 2);
    g.closePath();
    g.fillPath();
    let top = 56;
    for (const c of this.activeToasts) top = Math.max(top, c.y + 38);
    const box = s.add.container(this.w >> 1, top + h / 2, [g, t]);
    box.setScrollFactor(0);
    box.depth = 1002;
    this.root.add(box);
    this.activeToasts.push(box);
    box.setAlpha(0);
    s.tweens.add({ targets: box, alpha: 1, y: "+=4", duration: 200, ease: "Sine.easeOut" });
    s.tweens.add({
      targets: box,
      alpha: 0,
      delay: 3500,
      duration: MOTION.standard,
      onComplete: () => {
        this.activeToasts = this.activeToasts.filter((c) => c !== box);
        box.destroy();
      },
    });
  }
}
