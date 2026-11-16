// The procedural face generator.
//
// Key idea: A FACE IS A LIST OF NUMBERS. `FaceParams` holds a "slider" for every
// feature (eye spacing, brow tilt, mouth width...). Two functions use it:
//
//   generateFace(seed)  -> picks slider values from a seeded RNG, so the same
//                          seed always gives the same person.
//   drawFace(g, params) -> turns the numbers into shapes on the canvas.
//
// Because drawing reads nothing but the numbers, making a face go *wrong* is
// easy: nudge a few numbers and redraw. That is all "drift" is. The nudging
// lives in src/systems/drift.ts; this file never needs to know a mimic exists.
//
// Units: "face units". The head is about 60 wide and 78 tall, centred on (0, 0),
// with negative y going up. drawFace() scales and moves that onto the screen.

import { Rng, lerp } from '../core/rng';
import { PAL, shade, mix } from './palette';

export type HairStyle = 'short' | 'messy' | 'long' | 'bob' | 'bun' | 'bald' | 'cap' | 'beanie';

export interface FaceParams {
  // --- head ---
  headW: number; // half width of the skull
  headH: number; // half height
  jaw: number; // 0 = pointed, 1 = square
  chin: number; // extra chin length
  ears: number; // ear size multiplier
  // --- eyes ---
  eyeGap: number; // half the distance between the eyes
  eyeY: number; // height of the eye line (negative = higher)
  eyeDropL: number; // extra vertical offset, left eye only
  eyeDropR: number; // extra vertical offset, right eye only
  eyeW: number; // half width of an eye
  eyeH: number; // half height of an eye
  pupil: number; // pupil size multiplier
  lid: number; // 0 = wide open, 0.5 = heavy lidded
  // --- brows ---
  browY: number; // gap between eye and brow
  browTilt: number; // -1 worried ... 1 stern
  browThick: number;
  browSkew: number; // one brow higher than the other
  // --- nose ---
  noseLen: number;
  noseW: number;
  // --- mouth ---
  mouthY: number;
  mouthW: number; // half width
  smile: number; // -1 frown ... 1 grin
  mouthSkew: number; // one corner higher than the other
  lip: number; // line thickness
  // --- hair / skin detail ---
  hairPart: number; // -1 ... 1; the SIGN is which side the hair parts on
  beard: number; // 0 clean ... 1 full beard
  wrinkles: number; // 0 smooth ... 1 deeply lined
  // --- body ---
  shoulders: number; // half width of the shoulders
  // --- timing ---
  blinkEvery: number; // average seconds between blinks
  // --- things that are not sliders ---
  skin: string;
  iris: string;
  hairColor: string;
  shirt: string;
  hat: string;
  hair: HairStyle;
  glasses: boolean;
}

/** Animation state for one frame. Changes every frame; FaceParams does not. */
export interface FaceAnim {
  blink: number; // 0 open ... 1 shut
  gazeX: number; // -1 ... 1
  gazeY: number; // -1 ... 1
  talk: number; // 0 mouth closed ... 1 open
  slack: number; // 0 normal ... 1 the mask has slipped (a mimic breaking)
  tilt: number; // head tilt in radians
}

export const restAnim: FaceAnim = { blink: 0, gazeX: 0, gazeY: 0, talk: 0, slack: 0, tilt: 0 };

const SKINS = ['#e6c7a6', '#d8b08a', '#c79a76', '#a97a58', '#8b5e42', '#ecd2ba'];
const HAIRS = ['#1d1b19', '#3a2b1e', '#5a4029', '#85683e', '#a9a296', '#2a2622'];
const IRISES = ['#4a3b2a', '#3c4a3a', '#46566a', '#2c2620', '#5a5236'];
const SHIRTS = ['#3d4a5a', '#5a5040', '#48584a', '#6a6258', '#2f3a44', '#70685a', '#4a4452'];
const STYLES: HairStyle[] = ['short', 'short', 'messy', 'long', 'bob', 'bun', 'bald', 'cap', 'beanie'];

/**
 * Make a face from a seed. `overrides` lets content JSON pin particular sliders
 * (for example: Dale always wears a cap) while everything else stays random.
 */
export function generateFace(seed: number | string, overrides: Partial<FaceParams> = {}): FaceParams {
  const rng = new Rng(seed);
  // The order of these calls matters: changing it changes every face in the game.
  const face: FaceParams = {
    headW: rng.range(27, 32),
    headH: rng.range(36, 41),
    jaw: rng.range(0.15, 0.9),
    chin: rng.range(0, 4),
    ears: rng.range(0.8, 1.2),
    eyeGap: rng.range(11.5, 14.5),
    eyeY: rng.range(-7, -3),
    eyeDropL: rng.range(-0.3, 0.3), // real faces are a little uneven
    eyeDropR: rng.range(-0.3, 0.3),
    eyeW: rng.range(5.2, 6.8),
    eyeH: rng.range(2.7, 3.8),
    pupil: rng.range(0.9, 1.1),
    lid: rng.range(0.05, 0.3),
    browY: rng.range(4.5, 7),
    browTilt: rng.range(-0.3, 0.4),
    browThick: rng.range(1.6, 3.2),
    browSkew: rng.range(-0.5, 0.5),
    noseLen: rng.range(9.5, 13.5),
    noseW: rng.range(3.5, 6),
    mouthY: rng.range(18, 22.5),
    mouthW: rng.range(7.5, 11),
    smile: rng.range(-0.15, 0.25),
    mouthSkew: rng.range(-0.4, 0.4),
    lip: rng.range(1.2, 2.2),
    hairPart: rng.range(0.35, 0.9) * (rng.chance(0.5) ? 1 : -1),
    beard: rng.chance(0.3) ? rng.range(0.3, 0.9) : 0,
    wrinkles: rng.range(0, 0.5),
    shoulders: rng.range(44, 54),
    blinkEvery: rng.range(2.8, 5),
    skin: rng.pick(SKINS),
    iris: rng.pick(IRISES),
    hairColor: rng.pick(HAIRS),
    shirt: rng.pick(SHIRTS),
    hat: rng.pick(SHIRTS),
    hair: rng.pick(STYLES),
    glasses: rng.chance(0.2),
  };
  return { ...face, ...overrides };
}

/** Blend two faces. Numbers are interpolated; colours and styles are taken from `b`. */
export function lerpFace(a: FaceParams, b: FaceParams, t: number): FaceParams {
  const out = { ...b } as unknown as Record<string, unknown>;
  const from = a as unknown as Record<string, unknown>;
  for (const key of Object.keys(out)) {
    const x = from[key];
    const y = out[key];
    if (typeof x === 'number' && typeof y === 'number') out[key] = lerp(x, y, t);
  }
  return out as unknown as FaceParams;
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

type G = CanvasRenderingContext2D;

/** Under the fluoro tubes every skin tone picks up a little green. */
const lit = (hex: string): string => mix(hex, PAL.fluoro, 0.12);

/** Trace the outline of the head. `drop` lengthens the jaw (used when a mimic breaks). */
function headPath(g: G, p: FaceParams, drop = 0): void {
  const w = p.headW;
  const h = p.headH;
  const top = -4 + (-h + 4) / 0.75; // control height that makes the curve peak at -h
  const jawX = w * (0.6 + 0.32 * p.jaw);
  const jawY = h * 0.55 + drop * 0.4;
  const chinY = h + p.chin + drop;
  g.beginPath();
  g.moveTo(-w, -4);
  g.bezierCurveTo(-w, top, w, top, w, -4);
  g.quadraticCurveTo(w, h * 0.25, jawX, jawY);
  g.quadraticCurveTo(w * (0.45 + 0.3 * p.jaw), chinY, 0, chinY);
  g.quadraticCurveTo(-w * (0.45 + 0.3 * p.jaw), chinY, -jawX, jawY);
  g.quadraticCurveTo(-w, h * 0.25, -w, -4);
  g.closePath();
}

function drawBody(g: G, p: FaceParams): void {
  const h = p.headH;
  const s = p.shoulders;
  // neck
  g.fillStyle = shade(lit(p.skin), 0.78);
  g.fillRect(-p.headW * 0.42, h * 0.5, p.headW * 0.84, h * 0.5 + 20);
  // shoulders: a trapezoid that runs off the bottom (the counter hides the rest)
  g.fillStyle = p.shirt;
  g.beginPath();
  g.moveTo(-p.headW * 0.5, h + 9);
  g.quadraticCurveTo(-s * 0.8, h + 11, -s, h + 24);
  g.lineTo(-s - 3, h + 90);
  g.lineTo(s + 3, h + 90);
  g.lineTo(s, h + 24);
  g.quadraticCurveTo(s * 0.8, h + 11, p.headW * 0.5, h + 9);
  g.closePath();
  g.fill();
  // collar shadow
  g.fillStyle = shade(p.shirt, 0.7);
  g.beginPath();
  g.moveTo(-p.headW * 0.5, h + 9);
  g.lineTo(0, h + 22);
  g.lineTo(p.headW * 0.5, h + 9);
  g.lineTo(p.headW * 0.42, h + 14);
  g.lineTo(0, h + 17);
  g.lineTo(-p.headW * 0.42, h + 14);
  g.closePath();
  g.fill();
}

/** Hair that sits behind the head (long styles and buns). */
function drawHairBack(g: G, p: FaceParams): void {
  const w = p.headW;
  const h = p.headH;
  g.fillStyle = p.hairColor;
  if (p.hair === 'long' || p.hair === 'bob') {
    const bottom = p.hair === 'long' ? h + 16 : h * 0.62;
    g.beginPath();
    g.moveTo(-w - 4, -6);
    g.bezierCurveTo(-w - 5, -h * 1.5, w + 5, -h * 1.5, w + 4, -6);
    g.lineTo(w + 6, bottom);
    g.quadraticCurveTo(0, bottom + 5, -w - 6, bottom);
    g.closePath();
    g.fill();
  } else if (p.hair === 'bun') {
    g.beginPath();
    g.arc(0, -h - 5, 9, 0, Math.PI * 2);
    g.fill();
  }
}

/** Hair, cap or beanie in front of the forehead. The parting side follows hairPart. */
function drawHairFront(g: G, p: FaceParams): void {
  const w = p.headW;
  const h = p.headH;
  const top = -4 + (-h - 2 + 4) / 0.75;

  if (p.hair === 'cap' || p.hair === 'beanie') {
    const rim = p.hair === 'cap' ? -h * 0.5 : -h * 0.4;
    // a little hair shows under the hat at the temples
    g.fillStyle = p.hairColor;
    g.fillRect(-w - 0.5, rim, 3, 8);
    g.fillRect(w - 2.5, rim, 3, 8);
    g.fillStyle = p.hat;
    g.beginPath();
    g.moveTo(-w - 1.5, rim);
    g.bezierCurveTo(-w - 1.5, top - 2, w + 1.5, top - 2, w + 1.5, rim);
    g.closePath();
    g.fill();
    if (p.hair === 'cap') {
      g.fillStyle = shade(p.hat, 0.72);
      g.beginPath();
      g.ellipse(0, rim + 1, w + 7, 4, 0, 0, Math.PI * 2);
      g.fill();
    } else {
      g.fillStyle = shade(p.hat, 0.8);
      g.fillRect(-w - 2, rim - 6, w * 2 + 4, 7);
    }
    return;
  }

  g.fillStyle = p.hairColor;
  if (p.hair === 'bald') {
    // just a fringe of hair above each ear
    g.fillRect(-w - 0.5, -h * 0.42, 3.5, 13);
    g.fillRect(w - 3, -h * 0.42, 3.5, 13);
    return;
  }

  // Everything else: a cap of hair with a parting. The fringe hangs lower on the
  // wide side of the parting, so flipping the sign of hairPart mirrors the hair.
  const side = p.hair === 'long' || p.hair === 'bob' ? h * 0.3 : p.hair === 'bun' ? -h * 0.12 : -h * 0.22;
  const line = -h * 0.56; // hairline height at the parting
  const px = p.hairPart * w * 0.62;
  const droopR = 3 + 8 * ((w - px) / (2 * w));
  const droopL = 3 + 8 * ((px + w) / (2 * w));
  g.beginPath();
  g.moveTo(-w - 1.2, side);
  g.lineTo(-w - 1.2, -4);
  g.bezierCurveTo(-w - 1.2, top, w + 1.2, top, w + 1.2, -4);
  g.lineTo(w + 1.2, side);
  g.lineTo(w - 3, side - 2);
  g.quadraticCurveTo((w + px) / 2 + 3, line + droopR, px, line - 4);
  g.quadraticCurveTo((-w + px) / 2 - 3, line + droopL, -w + 3, side - 2);
  g.closePath();
  g.fill();
  if (p.hair === 'messy') {
    // a few tufts sticking up, leaning away from the parting
    const lean = p.hairPart > 0 ? -3 : 3;
    for (let i = -2; i <= 2; i++) {
      const x = i * w * 0.36;
      g.beginPath();
      g.moveTo(x - 4, -h + 3 + Math.abs(i) * 2.5);
      g.lineTo(x + lean, -h - 5 + Math.abs(i) * 2.5);
      g.lineTo(x + 4, -h + 3 + Math.abs(i) * 2.5);
      g.closePath();
      g.fill();
    }
  }
}

function drawEye(g: G, p: FaceParams, side: -1 | 1, a: FaceAnim): void {
  const cx = side * p.eyeGap;
  const cy = p.eyeY + (side < 0 ? p.eyeDropL : p.eyeDropR);
  const open = Math.max(0.06, 1 - a.blink);
  const eh = p.eyeH * open;
  const skin = lit(p.skin);

  g.save();
  g.beginPath();
  g.ellipse(cx, cy, p.eyeW, eh, 0, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = '#dfe6dc';
  g.fillRect(cx - p.eyeW, cy - p.eyeH, p.eyeW * 2, p.eyeH * 2);
  const ix = cx + a.gazeX * p.eyeW * 0.4;
  const iy = cy + a.gazeY * p.eyeH * 0.35;
  g.fillStyle = p.iris;
  g.beginPath();
  g.arc(ix, iy, p.eyeH * 0.98, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#0b0a09';
  g.beginPath();
  g.arc(ix, iy, p.eyeH * 0.5 * p.pupil, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.fillRect(ix - p.eyeH * 0.55, iy - p.eyeH * 0.55, 1, 1);
  // upper lid
  g.fillStyle = shade(skin, 0.9);
  g.fillRect(cx - p.eyeW, cy - p.eyeH, p.eyeW * 2, p.eyeH * 2 * p.lid);
  g.restore();

  // lash line along the top of the eye
  g.strokeStyle = shade(skin, 0.35);
  g.lineWidth = 1;
  g.beginPath();
  g.ellipse(cx, cy, p.eyeW, eh, 0, Math.PI, Math.PI * 2);
  g.stroke();
}

function drawBrow(g: G, p: FaceParams, side: -1 | 1): void {
  const eyeY = p.eyeY + (side < 0 ? p.eyeDropL : p.eyeDropR);
  const y = eyeY - p.eyeH - p.browY + (side < 0 ? p.browSkew : -p.browSkew) * 0.8;
  const inner = side * (p.eyeGap - p.eyeW * 1.05);
  const outer = side * (p.eyeGap + p.eyeW * 1.15);
  g.strokeStyle = shade(p.hairColor, p.hair === 'bald' ? 1.2 : 0.9);
  g.lineWidth = p.browThick;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(inner, y + p.browTilt * 2.4);
  g.quadraticCurveTo(side * p.eyeGap, y - 1.2, outer, y - p.browTilt * 1.1 + 1);
  g.stroke();
  g.lineCap = 'butt';
}

function drawMouth(g: G, p: FaceParams, a: FaceAnim): void {
  const skin = lit(p.skin);
  const y = p.mouthY;
  const w = p.mouthW * (1 + Math.max(0, p.smile) * 0.18);
  const lift = p.smile * 3;
  const lx = -w;
  const ly = y - lift + p.mouthSkew;
  const rx = w;
  const ry = y - lift - p.mouthSkew;
  const mid = y + p.smile * 4;
  // How far the mouth is open: talking, a too-wide grin that shows teeth, or breaking.
  const grin = Math.max(0, p.smile - 0.55) * 7;
  const open = a.talk * 4.5 + grin + a.slack * 26;

  if (open > 0.4) {
    g.beginPath();
    g.moveTo(lx, ly);
    g.quadraticCurveTo(0, mid - (grin > 0 ? 0 : 1), rx, ry);
    g.quadraticCurveTo(0, mid + open * 1.6, lx, ly);
    g.closePath();
    // Teeth for a grin; a dark hole otherwise. The red is only for a breaking mimic.
    g.fillStyle = a.slack > 0.3 ? PAL.goreDark : grin > a.talk * 4.5 ? '#d6d8c6' : '#1c1412';
    g.fill();
  }
  g.strokeStyle = shade(skin, 0.42);
  g.lineWidth = p.lip;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(lx, ly);
  g.quadraticCurveTo(0, mid, rx, ry);
  g.stroke();
  g.lineCap = 'butt';
}

function drawFeatures(g: G, p: FaceParams, a: FaceAnim): void {
  const skin = lit(p.skin);
  const line = shade(skin, 0.66);

  // wrinkles first, so everything else sits on top of them
  if (p.wrinkles > 0.2) {
    g.strokeStyle = line;
    g.globalAlpha = Math.min(1, p.wrinkles) * 0.75;
    g.lineWidth = 0.8;
    for (const s of [-1, 1] as const) {
      // lines from the nose to the corners of the mouth
      g.beginPath();
      g.moveTo(s * (p.noseW + 2), p.eyeY + p.noseLen - 1);
      g.quadraticCurveTo(s * (p.mouthW + 4), p.mouthY - 5, s * (p.mouthW + 3), p.mouthY + 2);
      g.stroke();
      // bags under the eyes
      g.beginPath();
      g.ellipse(s * p.eyeGap, p.eyeY + p.eyeH + 2.2, p.eyeW * 0.9, 1.6, 0, 0.15, Math.PI - 0.15);
      g.stroke();
    }
    if (p.wrinkles > 0.45) {
      for (let i = 0; i < 2; i++) {
        g.beginPath();
        g.moveTo(-p.headW * 0.5, -p.headH * 0.52 + i * 4.5);
        g.quadraticCurveTo(0, -p.headH * 0.56 + i * 4.5, p.headW * 0.5, -p.headH * 0.52 + i * 4.5);
        g.stroke();
      }
    }
    g.globalAlpha = 1;
  }

  drawEye(g, p, -1, a);
  drawEye(g, p, 1, a);
  drawBrow(g, p, -1);
  drawBrow(g, p, 1);

  // nose: one soft "J" stroke
  g.strokeStyle = line;
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(1.5, p.eyeY + 3);
  g.lineTo(p.noseW * 0.55, p.eyeY + p.noseLen);
  g.quadraticCurveTo(0, p.eyeY + p.noseLen + 2.2, -p.noseW * 0.6, p.eyeY + p.noseLen);
  g.stroke();

  drawMouth(g, p, a);

  if (p.glasses) {
    g.strokeStyle = '#1a1d1c';
    g.lineWidth = 1.2;
    for (const s of [-1, 1] as const) {
      g.fillStyle = 'rgba(228,245,220,0.1)';
      g.beginPath();
      g.roundRect(s * p.eyeGap - p.eyeW - 2.5, p.eyeY - p.eyeH - 3, p.eyeW * 2 + 5, p.eyeH * 2 + 6.5, 2.5);
      g.fill();
      g.stroke();
    }
    g.beginPath();
    g.moveTo(-p.eyeGap + p.eyeW + 2.5, p.eyeY - 0.5);
    g.lineTo(p.eyeGap - p.eyeW - 2.5, p.eyeY - 0.5);
    g.stroke();
  }
}

/**
 * Draw a head-and-shoulders portrait. (x, y) is the centre of the head on screen;
 * scale 1 means one face unit is one virtual pixel.
 */
export function drawFace(g: G, p: FaceParams, x: number, y: number, scale: number, a: FaceAnim = restAnim): void {
  const skin = lit(p.skin);
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);

  drawBody(g, p);

  g.rotate(a.tilt);
  drawHairBack(g, p);

  // ears
  g.fillStyle = shade(skin, 0.86);
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(s * p.headW, p.eyeY + 5, 3.6 * p.ears, 6.5 * p.ears, 0, 0, Math.PI * 2);
    g.fill();
  }

  // head, with flat shading down one side and stubble or beard on the lower half
  const drop = a.slack * 20;
  headPath(g, p, drop);
  g.fillStyle = skin;
  g.fill();
  g.save();
  headPath(g, p, drop);
  g.clip();
  g.fillStyle = shade(skin, 0.87);
  g.fillRect(p.headW * 0.58, -p.headH * 1.2, p.headW, p.headH * 3 + drop);
  if (p.beard > 0) {
    // light values read as stubble, heavy ones as a full beard
    g.globalAlpha = p.beard < 0.6 ? p.beard * 0.45 : Math.min(0.92, p.beard * 0.9);
    g.fillStyle = shade(p.hairColor, 0.95);
    g.beginPath();
    g.moveTo(-p.headW - 2, p.mouthY - 12);
    g.quadraticCurveTo(0, p.mouthY - 5 + (1 - p.beard) * 4, p.headW + 2, p.mouthY - 12);
    g.lineTo(p.headW + 2, p.headH + 30);
    g.lineTo(-p.headW - 2, p.headH + 30);
    g.closePath();
    g.fill();
    g.globalAlpha = 1;
  }
  g.restore();

  // The features are one layer. When a mimic breaks, that layer slides off the
  // skull underneath it "like a mask" (DESIGN.md), and a seam opens.
  g.save();
  if (a.slack > 0) {
    g.translate(a.slack * 5, a.slack * 8);
    g.rotate(a.slack * 0.09);
  }
  drawFeatures(g, p, a);
  g.restore();

  if (a.slack > 0.05) {
    g.strokeStyle = PAL.gore;
    g.lineWidth = 0.6 + a.slack * 2.4;
    g.beginPath();
    g.moveTo(-p.headW * 0.3, -p.headH);
    g.lineTo(-p.headW * 0.22, -p.headH * 0.3);
    g.lineTo(-p.headW * 0.34, p.headH * 0.2);
    g.lineTo(-p.headW * 0.2, p.headH + drop);
    g.stroke();
  }

  drawHairFront(g, p);
  g.restore();
}

/**
 * The same person seen from behind: used for reflections in the convex mirror.
 * A back view has no face, so it only needs the outline, hair and shoulders.
 */
export function drawBackOfHead(g: G, p: FaceParams, x: number, y: number, scale: number, tilt = 0): void {
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);
  drawBody(g, p);
  g.rotate(tilt);
  drawHairBack(g, p);
  const covered = p.hair === 'cap' || p.hair === 'beanie';
  const skin = shade(lit(p.skin), 0.8);
  headPath(g, p);
  g.fillStyle = p.hair === 'bald' ? skin : shade(p.hairColor, 0.92);
  g.fill();
  // Short hair stops at the nape of the neck; long hair covers it.
  if (p.hair !== 'long' && p.hair !== 'bob' && p.hair !== 'bald') {
    g.save();
    headPath(g, p);
    g.clip();
    g.fillStyle = skin;
    g.fillRect(-p.headW, p.headH * 0.5, p.headW * 2, p.headH);
    g.restore();
  }
  if (covered) {
    const top = -4 + (-p.headH - 2 + 4) / 0.75;
    g.fillStyle = p.hat;
    g.beginPath();
    g.moveTo(-p.headW - 1.5, -p.headH * 0.25);
    g.bezierCurveTo(-p.headW - 1.5, top - 2, p.headW + 1.5, top - 2, p.headW + 1.5, -p.headH * 0.25);
    g.closePath();
    g.fill();
  }
  g.restore();
}
