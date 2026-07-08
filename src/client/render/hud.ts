/**
 * The Descent HUD per 04 §4.3 (pure Phaser, screen-fixed):
 * top-left depth plaque · top-right mute (stub) + menu · left-edge
 * CandleMeter · bottom bar 72 px with Cup toggle, SlotGrid ×6, Snuff
 * hold-to-confirm (450 ms). Danger rule: radius ≤ 2 → bar opacity 100% +
 * ember rim. Values from tokens only.
 */

import Phaser from "phaser";
import { COLOR, HUD, CANVAS, MOTION } from "../../../design/tokens/tokens.js";
import { Candle, Item, type SimState } from "../../shared/sim/types.js";
import { START_WAX } from "../../shared/sim/constants.js";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
const W = CANVAS.width;
const H = CANVAS.height;
const BAR_Y = H - HUD.bottomBarH;

const SANS = "system-ui, sans-serif"; // 04 §2.2 body fallback stack
const SERIF = "Georgia, serif"; // display fallback until bitmap fonts (W4)

export interface HudCallbacks {
  onCup(): void;
  onSnuffComplete(): void;
  onRelight(): void;
  onRestart(): void;
}

export class Hud {
  private readonly scene: Phaser.Scene;
  private readonly cb: HudCallbacks;

  private depthText!: Phaser.GameObjects.Text;
  private barRect!: Phaser.GameObjects.Rectangle;
  private barRim!: Phaser.GameObjects.Rectangle;
  private cupBtn!: Phaser.GameObjects.Container;
  private cupFill!: Phaser.GameObjects.Arc;
  private snuffBtn!: Phaser.GameObjects.Container;
  private snuffRing!: Phaser.GameObjects.Graphics;
  private snuffLabel!: Phaser.GameObjects.Text;
  private slots: Phaser.GameObjects.Container[] = [];
  private slotCharges: Phaser.GameObjects.Text[] = [];
  private meterFill!: Phaser.GameObjects.Rectangle;
  private meterFlame!: Phaser.GameObjects.Arc;
  private meterGlow!: Phaser.GameObjects.Image;
  private waxText!: Phaser.GameObjects.Text;
  private waxTextTimer = 0;
  private graceText!: Phaser.GameObjects.Text;
  private toastY = 64;
  private restartArmedAt = 0;

  private snuffHoldStart = 0;
  private snuffHolding = false;

  constructor(scene: Phaser.Scene, cb: HudCallbacks) {
    this.scene = scene;
    this.cb = cb;
    this.build();
  }

  private fixed<T extends Phaser.GameObjects.GameObject & { setScrollFactor(v: number): T }>(o: T): T {
    o.setScrollFactor(0);
    (o as unknown as { depth: number }).depth = 1000;
    return o;
  }

  private build(): void {
    const s = this.scene;

    // Depth plaque (top-left) — double-rule frame (04 §2.3 sacred panels)
    const plaque = this.fixed(s.add.rectangle(16, 16, 96, 36, COLOR.surface, 0.92).setOrigin(0, 0));
    plaque.setStrokeStyle(1, COLOR.borderVoid, 1);
    const plaqueInner = this.fixed(s.add.rectangle(20, 20, 88, 28, COLOR.surface, 0).setOrigin(0, 0));
    plaqueInner.setStrokeStyle(1, COLOR.borderVoid, 0.5);
    this.depthText = this.fixed(
      s.add.text(16 + 48, 16 + 18, "Fl. I", {
        fontFamily: SERIF,
        fontSize: "20px",
        color: "#b7ae9c", // --bone (numeric tokens carry the same value)
      }).setOrigin(0.5, 0.5),
    );

    // Top-right: mute stub + menu(restart)
    const mute = this.fixed(
      s.add.text(W - 96, 20, "MUTE", { fontFamily: SANS, fontSize: "12px", color: "#7e786c" }).setOrigin(0.5, 0),
    );
    mute.setAlpha(0.5); // audio lands at W6; control visible per invariant 6
    const menu = this.fixed(
      s.add.text(W - 40, 12, "≡", { fontFamily: SANS, fontSize: "28px", color: "#b7ae9c" }).setOrigin(0.5, 0),
    );
    menu.setInteractive({ useHandCursor: true });
    menu.on("pointerdown", () => {
      const now = this.scene.time.now;
      if (now - this.restartArmedAt < 2000) {
        this.cb.onRestart();
      } else {
        this.restartArmedAt = now;
        this.toast("Tap again to strike a fresh match", "info");
      }
    });

    // CandleMeter (left edge)
    const meterH = 300;
    const meterX = 16;
    const meterY = 120;
    this.fixed(s.add.rectangle(meterX, meterY, HUD.candleMeterW, meterH, COLOR.surface2, 0.8).setOrigin(0, 0));
    this.meterFill = this.fixed(
      s.add.rectangle(meterX + 1, meterY + meterH - 1, HUD.candleMeterW - 2, meterH - 2, COLOR.parchment, 0.95).setOrigin(0, 1),
    );
    this.meterGlow = this.fixed(s.add.image(meterX + (HUD.candleMeterW >> 1), meterY - 8, "halo"));
    this.meterGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.meterGlow.setDisplaySize(44, 44);
    this.meterGlow.setTint(COLOR.flame);
    this.meterFlame = this.fixed(s.add.circle(meterX + (HUD.candleMeterW >> 1), meterY - 8, 5, COLOR.flameHi, 1));
    this.waxText = this.fixed(
      s.add.text(meterX + 20, meterY - 14, "", { fontFamily: SANS, fontSize: "14px", color: "#b7ae9c" }),
    );
    const meterZone = this.fixed(
      s.add.rectangle(meterX - 8, meterY - 20, HUD.touchTarget, meterH + 40, COLOR.void, 0.001).setOrigin(0, 0),
    );
    meterZone.setInteractive();
    meterZone.on("pointerdown", () => {
      this.waxTextTimer = this.scene.time.now + 2000; // long-press-ish reveal
    });

    // Bottom bar
    this.barRect = this.fixed(s.add.rectangle(0, BAR_Y, W, HUD.bottomBarH, COLOR.surface, HUD.bottomBarAlpha).setOrigin(0, 0));
    this.barRim = this.fixed(s.add.rectangle(0, BAR_Y - 1, W, 2, COLOR.ember, 0).setOrigin(0, 0));

    // Cup toggle
    this.cupBtn = this.buildRoundButton(52, BAR_Y + (HUD.bottomBarH >> 1), "CUP", () => this.cb.onCup());
    this.cupFill = this.fixed(s.add.circle(52, BAR_Y + (HUD.bottomBarH >> 1), (HUD.iconToggle >> 1) - 6, COLOR.flame, 0));

    // Slot grid ×6 (48 px cells)
    const gridX = 100;
    for (let i = 0; i < 6; i++) {
      const x = gridX + i * (HUD.slotCell + 4);
      const cell = this.fixed(s.add.container(x, BAR_Y + 12));
      const bg = s.add.rectangle(0, 0, HUD.slotCell, HUD.slotCell, COLOR.surface2, 1).setOrigin(0, 0);
      bg.setStrokeStyle(1, COLOR.borderVoid, 1);
      const underline = s.add.rectangle(4, HUD.slotCell - 3, HUD.slotCell - 8, 1, COLOR.flame, 0).setOrigin(0, 0);
      const icon = s.add.image(HUD.slotCell >> 1, (HUD.slotCell >> 1) - 2, "icon-flint").setVisible(false);
      const charges = s.add
        .text(HUD.slotCell - 4, HUD.slotCell - 15, "", { fontFamily: SANS, fontSize: "11px", color: "#f5a93f" })
        .setOrigin(1, 0);
      cell.add([bg, underline, icon, charges]);
      this.slots.push(cell);
      this.slotCharges.push(charges);
      (cell as unknown as { iconImg: Phaser.GameObjects.Image }).iconImg = icon;
      (cell as unknown as { underlineRect: Phaser.GameObjects.Rectangle }).underlineRect = underline;
    }

    // Snuff (hold-to-confirm 450 ms) — right side; doubles as RELIGHT when snuffed
    this.snuffBtn = this.buildRoundButton(W - 52, BAR_Y + (HUD.bottomBarH >> 1), "SNUFF", () => undefined);
    this.snuffRing = this.fixed(s.add.graphics());
    this.snuffLabel = (this.snuffBtn.getAt(1) as Phaser.GameObjects.Text);
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

    // Grace banner
    this.graceText = this.fixed(
      s.add
        .text(W >> 1, 120, "", { fontFamily: SERIF, fontSize: "22px", color: "#a33b2e", align: "center" })
        .setOrigin(0.5, 0),
    );
  }

  private buildRoundButton(x: number, y: number, label: string, onTap: () => void): Phaser.GameObjects.Container {
    const s = this.scene;
    const c = this.fixed(s.add.container(x, y));
    const circle = s.add.circle(0, 0, HUD.iconToggle >> 1, COLOR.surface2, 1);
    circle.setStrokeStyle(1, COLOR.borderVoid, 1);
    // scrollFactor(0) on the interactive CHILD too — container scrollFactor
    // alone leaves the input hit area drifting once the camera scrolls
    circle.setScrollFactor(0);
    circle.setInteractive({ useHandCursor: true });
    const text = s.add
      .text(0, 0, label, { fontFamily: SANS, fontSize: "12px", color: "#b7ae9c" })
      .setOrigin(0.5, 0.5);
    text.setScrollFactor(0);
    c.add([circle, text]);
    if (label === "CUP") circle.on("pointerdown", onTap);
    return c;
  }

  /** Per-frame: hold-to-snuff progress ring (04 §3.3 misfire-proofing). */
  updateFrame(now: number): void {
    if (this.snuffHolding) {
      const t = (now - this.snuffHoldStart) / HUD.snuffHoldMs;
      this.snuffRing.clear();
      const cx = W - 52;
      const cy = BAR_Y + (HUD.bottomBarH >> 1);
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
    // candle-flame breath
    if (this.meterGlow.visible) {
      this.meterGlow.setAlpha(0.7 + 0.3 * Math.sin(now / 180));
    }
  }

  update(state: SimState, radius: number, day: number): void {
    this.depthText.setText(`Fl. ${ROMAN[state.floor] ?? String(state.floor)}`);
    void day;

    // CandleMeter: fill ∝ wax, flame hue shifts under 30% (04 §3.4)
    const frac = Math.min(state.wax / START_WAX, 1);
    this.meterFill.setScale(1, frac);
    const low = state.wax < START_WAX * 0.3;
    this.meterFlame.setFillStyle(state.candle === Candle.SNUFFED ? COLOR.boneDim : low ? COLOR.ember : COLOR.flameHi, 1);
    // flame visible only while it actually burns: not snuffed AND not in grace
    const burning = state.graceLeft === 0 && state.candle !== Candle.SNUFFED;
    this.meterFlame.setVisible(burning);
    this.meterGlow.setVisible(burning);
    this.meterGlow.setTint(low ? COLOR.ember : COLOR.flame);
    if (this.waxTextTimer > this.scene.time.now) this.waxText.setText(String(state.wax));

    // Cup toggle state
    this.cupFill.setAlpha(state.candle === Candle.CUPPED ? 0.5 : 0);

    // Snuff button doubles as LIGHT when snuffed
    this.snuffLabel.setText(state.candle === Candle.SNUFFED ? "LIGHT" : "SNUFF");

    // Slots: drawn icons + occupied amber underline (04 §3.5)
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

    // Grace banner
    if (state.graceLeft > 0) {
      this.graceText.setText(`THE DARK GRACE — ${state.graceLeft}\nreach flame, or the way out`);
    } else {
      this.graceText.setText("");
    }

    // Danger legibility rule (04 §4.3): radius ≤ 2 → full opacity + ember rim
    const danger = radius <= 2;
    this.barRect.setFillStyle(COLOR.surface, danger ? 1 : HUD.bottomBarAlpha);
    this.barRim.setAlpha(danger ? 1 : 0);
  }

  toast(text: string, kind: "info" | "discovery" | "warning" | "death"): void {
    const color = kind === "discovery" ? "#4fb39a" : kind === "warning" ? "#c9701e" : kind === "death" ? "#a33b2e" : "#b7ae9c";
    const t = this.scene.add
      .text(W >> 1, this.toastY, text, {
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
    this.scene.tweens.add({
      targets: t,
      alpha: 0,
      delay: 3500,
      duration: MOTION.standard,
      onComplete: () => t.destroy(),
    });
  }
}
