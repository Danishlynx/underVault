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

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
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
  onToggleMute(): boolean;
}

export class Hud {
  private readonly scene: Phaser.Scene;
  private readonly cb: HudCallbacks;
  private readonly layer: Phaser.GameObjects.Layer | null;

  private w = 0;
  private h = 0;
  private barY = 0;
  private meterH = 300;

  private plaque!: Phaser.GameObjects.Rectangle;
  private plaqueInner!: Phaser.GameObjects.Rectangle;
  private depthText!: Phaser.GameObjects.Text;
  private muteText!: Phaser.GameObjects.Text;
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
    this.layer?.add(o);
    return o;
  }

  // ── Construction (positions applied in layout()) ─────────────────────────
  private build(): void {
    const s = this.scene;

    this.plaque = this.fixed(s.add.rectangle(0, 0, 96, 36, COLOR.surface, 0.92).setOrigin(0, 0));
    this.plaque.setStrokeStyle(1, COLOR.borderVoid, 1);
    this.plaqueInner = this.fixed(s.add.rectangle(0, 0, 88, 28, COLOR.surface, 0).setOrigin(0, 0));
    this.plaqueInner.setStrokeStyle(1, COLOR.borderVoid, 0.5);
    this.depthText = this.fixed(
      s.add.text(0, 0, "Fl. I", { fontFamily: SERIF, fontSize: "20px", color: "#b7ae9c" }).setOrigin(0.5, 0.5),
    );

    this.muteText = this.fixed(
      s.add.text(0, 0, "MUTE", { fontFamily: SANS, fontSize: "12px", color: "#7e786c" }).setOrigin(0.5, 0),
    );
    this.muteText.setInteractive({ useHandCursor: true }); // always visible (invariant 6)
    this.muteText.on("pointerdown", () => {
      const muted = this.cb.onToggleMute();
      this.muteText.setText(muted ? "MUTED" : "MUTE");
      this.muteText.setAlpha(muted ? 1 : 0.6);
    });
    this.menuText = this.fixed(
      s.add.text(0, 0, "≡", { fontFamily: SANS, fontSize: "28px", color: "#b7ae9c" }).setOrigin(0.5, 0),
    );
    this.menuText.setInteractive({ useHandCursor: true });
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
      bg.on("pointerdown", () => this.cb.onUseSlot(slotIndex));
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
    if (label === "CUP") circle.on("pointerdown", onTap);
    return c;
  }

  // ── Layout: everything derives from the current canvas size ─────────────
  layout(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.barY = h - HUD.bottomBarH;
    this.meterH = Math.min(300, h - METER_Y - HUD.bottomBarH - 16);

    this.plaque.setPosition(16, 16);
    this.plaqueInner.setPosition(20, 20);
    this.depthText.setPosition(16 + 48, 16 + 18);
    this.muteText.setPosition(w - 96, 20);
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
    this.snuffBtn.setPosition(w - 52, midY);
    this.graceText.setPosition(w >> 1, 120);
  }

  /** The meter's touch strip in screen coords (scene input guard). */
  meterBounds(): { x: number; y: number; w: number; h: number } {
    return { x: 0, y: METER_Y - 20, w: 64, h: this.meterH + 40 };
  }

  // ── Per-frame ────────────────────────────────────────────────────────────
  updateFrame(now: number): void {
    if (this.snuffHolding) {
      const t = (now - this.snuffHoldStart) / HUD.snuffHoldMs;
      this.snuffRing.clear();
      const cx = this.w - 52;
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
        icon.setTexture(item === Item.FLINT ? "icon-flint" : item === Item.SALT ? "icon-salt" : "icon-chalk");
        icon.setVisible(true);
        icon.setAlpha(charges === 0 ? 0.28 : 1);
        underline.setAlpha(charges === 0 ? 0.15 : 0.8);
      }
      this.slotCharges[i]!.setText(item === Item.SALT || item === Item.CHALK ? String(charges) : "");
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

  toast(text: string, kind: "info" | "discovery" | "warning" | "death"): void {
    const color = kind === "discovery" ? "#4fb39a" : kind === "warning" ? "#c9701e" : kind === "death" ? "#a33b2e" : "#b7ae9c";
    const t = this.scene.add
      .text(this.w >> 1, 64, text, {
        fontFamily: SANS,
        fontSize: "14px",
        color,
        backgroundColor: "#16131cE6",
        padding: { x: 12, y: 6 },
        align: "center",
        wordWrap: { width: 320 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0);
    t.depth = 1002;
    this.layer?.add(t);
    this.scene.tweens.add({
      targets: t,
      alpha: 0,
      delay: 3500,
      duration: MOTION.standard,
      onComplete: () => t.destroy(),
    });
  }
}
