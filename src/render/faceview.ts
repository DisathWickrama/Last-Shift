// FaceView: one face on screen, with its moving parts.
//
// FaceParams (face.ts) describes what a face looks like. A FaceView adds what
// changes from moment to moment: blinking, where the eyes point, the mouth
// moving while talking, and a slow blend towards a "target" face.
//
// That slow blend is how drift shows on screen. The night scene asks
// applyDrift() for the face the visitor *should* have now and passes it in as
// the target; the view eases towards it over a second or two, so the change
// is never a visible jump.

import { type FaceParams, type FaceAnim, lerpFace, drawFace, drawBackOfHead } from './face';
import { Rng, clamp, lerp } from '../core/rng';

export interface FaceInputs {
  /** Is this person speaking right now? */
  talking?: boolean;
  /** Where to look, -1..1 on each axis (0, 0 = straight at you). */
  lookX?: number;
  lookY?: number;
  /** 0 = glances around like a person; 1 = never looks away. */
  stare?: number;
  /** True while the player cannot see the face (a close-up is open). */
  hidden?: boolean;
  /** 0..1 the mask slipping. */
  slack?: number;
}

export class FaceView {
  /** The face as currently drawn. */
  shown: FaceParams;
  anim: FaceAnim = { blink: 0, gazeX: 0, gazeY: 0, talk: 0, slack: 0, tilt: 0 };
  /** Sideways lean in virtual pixels: people shift their weight. Mirrors copy this. */
  lean = 0;

  private rng: Rng;
  private blinkIn: number;
  private blinkT = -1;
  private glanceIn: number;
  private glanceT = 0;
  private glanceX = 0;
  private leanTarget = 0;
  private leanIn = 1;
  private time = 0;
  /** Recent lean values, so a reflection can replay them late. */
  private leanHistory: number[] = [];

  constructor(public base: FaceParams, seed: number | string) {
    this.shown = { ...base };
    this.rng = new Rng(seed);
    this.blinkIn = this.rng.range(1, 3);
    this.glanceIn = this.rng.range(2, 5);
  }

  update(dt: number, target: FaceParams, inp: FaceInputs = {}): void {
    this.time += dt;

    // --- ease towards the target face ---
    const partFlipped = Math.sign(target.hairPart) !== Math.sign(this.shown.hairPart);
    const keepPart = this.shown.hairPart;
    this.shown = lerpFace(this.shown, target, 1 - Math.exp(-dt * 0.9));
    if (partFlipped) {
      // Hair cannot slide across a head. It swaps sides only while you cannot
      // see it happen: during a blink, or while you are looking at something else.
      this.shown.hairPart = inp.hidden || this.anim.blink > 0.85 ? target.hairPart : keepPart;
    }

    // --- blinking ---
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      const t = this.blinkT / 0.16;
      this.anim.blink = t < 0.5 ? t * 2 : Math.max(0, 2 - t * 2);
      if (t >= 1) {
        this.blinkT = -1;
        this.anim.blink = 0;
      }
    } else {
      this.blinkIn -= dt;
      if (this.blinkIn <= 0) {
        this.blinkT = 0;
        this.blinkIn = this.shown.blinkEvery * this.rng.range(0.6, 1.4);
      }
    }

    // --- eyes: mostly on you, with the odd glance away ---
    const stare = inp.stare ?? 0;
    this.glanceIn -= dt;
    if (this.glanceIn <= 0) {
      this.glanceIn = this.rng.range(2.5, 6);
      if (!this.rng.chance(stare)) {
        this.glanceT = this.rng.range(0.4, 0.9);
        this.glanceX = this.rng.chance(0.5) ? -0.9 : 0.9;
      }
    }
    this.glanceT -= dt;
    const gx = this.glanceT > 0 ? this.glanceX : (inp.lookX ?? 0);
    const gy = this.glanceT > 0 ? 0.2 : (inp.lookY ?? 0);
    const follow = 1 - Math.exp(-dt * lerp(9, 30, stare));
    this.anim.gazeX = lerp(this.anim.gazeX, clamp(gx, -1, 1), follow);
    this.anim.gazeY = lerp(this.anim.gazeY, clamp(gy, -1, 1), follow);

    // --- mouth ---
    const talkTarget = inp.talking ? 0.35 + 0.65 * Math.abs(Math.sin(this.time * 17)) : 0;
    this.anim.talk = lerp(this.anim.talk, talkTarget, 1 - Math.exp(-dt * 25));

    // --- shifting weight ---
    this.leanIn -= dt;
    if (this.leanIn <= 0) {
      this.leanIn = this.rng.range(1.2, 2.6);
      this.leanTarget = this.rng.range(-1, 1) * 5;
    }
    this.lean = lerp(this.lean, this.leanTarget, 1 - Math.exp(-dt * 4));
    this.anim.tilt = this.lean * 0.012;
    this.leanHistory.push(this.lean);
    if (this.leanHistory.length > 240) this.leanHistory.shift();

    this.anim.slack = inp.slack ?? 0;
  }

  /** The lean this person had `seconds` ago (logic runs at 60 steps a second). */
  leanAgo(seconds: number): number {
    const i = this.leanHistory.length - 1 - Math.round(seconds * 60);
    return this.leanHistory[Math.max(0, i)] ?? 0;
  }

  draw(g: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
    drawFace(g, this.shown, x + this.lean * scale, y, scale, this.anim);
  }

  drawBack(g: CanvasRenderingContext2D, x: number, y: number, scale: number, lean = this.lean): void {
    drawBackOfHead(g, this.shown, x + lean * scale, y, scale, lean * 0.012);
  }
}
