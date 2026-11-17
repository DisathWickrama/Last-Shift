// The three close-up views used by the inspections.
//
//   wrists      the visitor pays by card; you look at the veins
//   reflection  the convex mirror, beside the real person, so you can compare
//   shadow      the floor under the fluoro tubes
//
// Each function is told what the visitor's "tell" is for that check (from the
// visitor's JSON) and draws either the ordinary human version or the wrong one.
// None of them decide anything: the same function draws Dale's honest wrists and
// a mimic's empty ones, depending only on the data passed in.

import { resolveFace, type PersonDef, type VeinTell } from '../core/content';
import type { FaceView } from './faceview';
import { drawFace } from './face';
import { Rng, clamp } from '../core/rng';
import { PAL, shade, mix, alpha } from './palette';
import { W } from './renderer';

type G = CanvasRenderingContext2D;

/** One person being inspected: their data plus their live face. */
export interface Subject {
  def: PersonDef;
  view: FaceView;
}

/** Close-ups fill the screen above the interface band. */
const VIEW_H = 204;

// ---------------------------------------------------------------------------
// Wrists
// ---------------------------------------------------------------------------

type Vein = [number, number][]; // points as (u across the arm -1..1, v along the arm 0..1)
const veinCache = new Map<string, Vein[]>();

/** Grow a vein pattern from a seed: two or three wandering trunks, each with a branch or two. */
function makeVeins(seed: string): Vein[] {
  const cached = veinCache.get(seed);
  if (cached) return cached;
  const rng = new Rng(seed);
  const veins: Vein[] = [];
  const trunks = rng.int(2, 3);
  for (let t = 0; t < trunks; t++) {
    let u = rng.range(-0.55, 0.55);
    const trunk: Vein = [[u, -0.16]];
    for (let v = 0; v <= 1.001; v += 0.1) {
      u = clamp(u + rng.range(-0.14, 0.14), -0.72, 0.72);
      trunk.push([u, v]);
    }
    veins.push(trunk);
    const forks = rng.int(1, 2);
    for (let f = 0; f < forks; f++) {
      const from = trunk[rng.int(3, 8)];
      const dir = rng.chance(0.5) ? 1 : -1;
      const branch: Vein = [from];
      let bu = from[0];
      let bv = from[1];
      for (let k = 0; k < 4; k++) {
        bu = clamp(bu + dir * rng.range(0.07, 0.15), -0.8, 0.8);
        bv += rng.range(0.05, 0.11);
        branch.push([bu, bv]);
      }
      veins.push(branch);
    }
  }
  veinCache.set(seed, veins);
  return veins;
}

interface ArmSpec {
  x: number; // wrist position on screen
  y: number;
  angle: number;
  scale: number;
  skin: string;
  sleeve: string;
  thumb: -1 | 1;
  card: boolean;
  veinSeed: string;
  mirrorVeins: boolean;
  tell: VeinTell;
  time: number;
}

/** A forearm lying on the counter, palm up. Drawn pointing "up" from the wrist, then rotated into place. */
function drawArm(g: G, a: ArmSpec): void {
  const len = 118;
  const wTop = 36;
  const wWrist = 25;
  const bare = len * 0.5; // how much forearm shows below the sleeve
  const skin = mix(a.skin, PAL.fluoro, 0.12);
  const halfAt = (v: number) => (wWrist + (wTop - wWrist) * ((v * bare) / len)) / 2;

  g.save();
  g.translate(a.x, a.y);
  g.rotate(a.angle);
  g.scale(a.scale, a.scale);

  // forearm
  g.fillStyle = skin;
  g.beginPath();
  g.moveTo(-wWrist / 2, 2);
  g.lineTo(-wTop / 2, -len);
  g.lineTo(wTop / 2, -len);
  g.lineTo(wWrist / 2, 2);
  g.closePath();
  g.fill();
  g.fillStyle = shade(skin, 0.88);
  g.beginPath();
  g.moveTo(wWrist / 2, 2);
  g.lineTo(wTop / 2, -len);
  g.lineTo(wTop / 2 - 6, -len);
  g.lineTo(wWrist / 2 - 4, 2);
  g.closePath();
  g.fill();

  // --- veins: this is the whole inspection ---
  if (a.tell !== 'none') {
    const veins = makeVeins(a.veinSeed);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    veins.forEach((vein, i) => {
      g.beginPath();
      vein.forEach(([u0, v], k) => {
        let u = a.mirrorVeins ? -u0 : u0;
        // "moving": the pattern crawls, slowly enough that you have to watch for it
        if (a.tell === 'moving') u += 0.11 * Math.sin(a.time * 0.9 + v * 7 + i * 2.1);
        const px = u * halfAt(Math.max(0, v)) * 0.86;
        const py = -v * bare;
        if (k === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      });
      if (a.tell === 'black') {
        g.strokeStyle = 'rgba(12,14,16,0.86)';
        g.lineWidth = 1.5;
      } else if (a.tell === 'silver') {
        g.strokeStyle = `rgba(226,236,232,${0.6 + 0.3 * Math.sin(a.time * 3 + i)})`;
        g.lineWidth = 1.4;
      } else {
        // human (and the subtler tells): faint blue-green under the skin
        g.strokeStyle = 'rgba(64,104,128,0.34)';
        g.lineWidth = 1.5;
      }
      g.stroke();
    });
    g.lineCap = 'butt';
  }
  // crease at the wrist
  g.strokeStyle = shade(skin, 0.78);
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(-wWrist / 2 + 2, 1);
  g.quadraticCurveTo(0, 3.5, wWrist / 2 - 2, 1);
  g.stroke();

  // sleeve and cuff
  g.fillStyle = a.sleeve;
  g.beginPath();
  g.moveTo(-halfAt(1) - 3, -bare);
  g.lineTo(-wTop / 2 - 5, -len - 4);
  g.lineTo(wTop / 2 + 5, -len - 4);
  g.lineTo(halfAt(1) + 3, -bare);
  g.closePath();
  g.fill();
  g.fillStyle = shade(a.sleeve, 0.75);
  g.fillRect(-halfAt(1) - 3, -bare - 1, halfAt(1) * 2 + 6, 5);

  // hand: palm, four fingers, thumb
  g.fillStyle = skin;
  g.beginPath();
  g.roundRect(-wWrist * 0.64, 0, wWrist * 1.28, 37, 8);
  g.fill();
  const fingers = [20, 25, 26, 21];
  fingers.forEach((fl, i) => {
    const fx = -wWrist * 0.62 + i * ((wWrist * 1.24) / 4) + 0.5;
    g.beginPath();
    g.roundRect(a.thumb > 0 ? fx : -fx - 6.6, 30, 6.6, fl, 3.2);
    g.fill();
  });
  g.strokeStyle = shade(skin, 0.8);
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(-wWrist * 0.45, 14);
  g.quadraticCurveTo(0, 21, wWrist * 0.5, 12);
  g.moveTo(-wWrist * 0.4, 23);
  g.quadraticCurveTo(0, 28, wWrist * 0.45, 22);
  g.stroke();

  if (a.card) {
    g.fillStyle = '#c9d2c2';
    g.beginPath();
    g.roundRect(-20, 40, 44, 27, 3);
    g.fill();
    g.fillStyle = '#59685e';
    g.fillRect(-20, 46, 44, 5);
    g.fillStyle = PAL.sodiumDim;
    g.fillRect(-14, 56, 8, 6);
  }

  g.save();
  g.translate(a.thumb * wWrist * 0.62, 9);
  g.rotate(a.thumb * -0.7);
  g.fillStyle = shade(skin, 0.95);
  g.beginPath();
  g.roundRect(-3.6, 0, 7.2, a.card ? 34 : 22, 3.6);
  g.fill();
  g.restore();

  g.restore();
}

/**
 * The card-payment close-up. `slip` is the player's own Slip stat: at the
 * bottom of the view is YOUR hand on the card reader, and as you slip, it
 * stops looking quite right.
 */
export function drawWristCloseup(g: G, time: number, payer: Subject, slip: number, light: number, own = false): void {
  const bg = g.createLinearGradient(0, 0, 0, VIEW_H);
  bg.addColorStop(0, '#1b201e');
  bg.addColorStop(1, '#343c37');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, VIEW_H);
  // worn laminate
  g.fillStyle = 'rgba(228,245,220,0.03)';
  for (let i = 0; i < 9; i++) g.fillRect(0, 14 + i * 23, W, 1);

  const size = payer.def.size ?? 1;
  const p = payer.view.shown;
  const tell = payer.def.tells.veins;
  const seed = resolveFace(payer.def.face).seed;
  const adult = size > 0.9;
  const base = {
    scale: adult ? 1.22 : 0.92,
    skin: p.skin,
    sleeve: p.shirt,
    tell,
    time,
  };
  // A real person's two wrists carry different patterns. "mirrored" gives both
  // wrists the same pattern, flipped: too neat to be grown.
  drawArm(g, { ...base, x: 140, y: adult ? 78 : 62, angle: 0.16, thumb: -1, card: false, veinSeed: seed + '-L', mirrorVeins: false });
  drawArm(g, {
    ...base, x: 326, y: adult ? 70 : 62, angle: -0.2, thumb: 1, card: adult && !own,
    veinSeed: tell === 'mirrored' ? seed + '-L' : seed + '-R', mirrorVeins: tell === 'mirrored',
  });

  // the card reader, and your own hand holding it steady (not when the wrists are your own, or Wren's)
  if (!own) {
  g.fillStyle = '#141817';
  g.beginPath();
  g.roundRect(206, 134, 62, 84, 5);
  g.fill();
  g.fillStyle = shade(PAL.radio, 0.45);
  g.fillRect(213, 141, 48, 20);
  g.fillStyle = '#2c3531';
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) g.fillRect(215 + col * 16, 168 + row * 11, 12, 7);

  const yours = '#8d8377';
  g.fillStyle = shade(yours, 0.8);
  g.beginPath();
  g.moveTo(300, 150);
  g.lineTo(370, VIEW_H);
  g.lineTo(290, VIEW_H);
  g.lineTo(276, 176);
  g.closePath();
  g.fill();
  g.fillStyle = yours;
  const count = slip >= 4 ? 5 : 4; // one finger too many
  for (let i = 0; i < count; i++) {
    const tooLong = slip >= 2 && i === 1; // one finger too long
    const fw = tooLong ? 44 : 26 + (i % 2) * 3;
    g.beginPath();
    g.roundRect(292 - fw, 146 + i * 11.5, fw, 9, 4.5);
    g.fill();
  }
  }

  if (light < 1) {
    g.fillStyle = alpha(PAL.black, (1 - light) * 0.55);
    g.fillRect(0, 0, W, VIEW_H);
  }
}

// ---------------------------------------------------------------------------
// Reflection
// ---------------------------------------------------------------------------

const MIRROR = { x: 326, y: 102, r: 92 };
/** How far behind a "delayed" reflection runs, in seconds. */
const MIRROR_LAG = 0.8;

/**
 * Left: the visitor as they stand in front of you. Right: the convex mirror in
 * the corner, which sees them from behind, and sees you and Wren at the counter.
 */
export function drawMirrorCloseup(
  g: G, time: number, subjects: Subject[], wren: FaceView | null, light: number,
  /** 0..1 from the night file: how wrong the things behind the counter look in the glass. */
  dread = 0,
  /** Your own face, once the mirror is prepared to show it. */
  self: FaceView | null = null,
): void {
  g.fillStyle = shade(PAL.wall, 0.75);
  g.fillRect(0, 0, W, VIEW_H);

  // --- left: what is in front of you ---
  g.save();
  g.beginPath();
  g.rect(12, 22, 158, 164);
  g.clip();
  g.fillStyle = shade(PAL.wall, 1.05);
  g.fillRect(12, 22, 158, 164);
  g.fillStyle = mix(PAL.fog, PAL.night, 0.5);
  g.fillRect(44, 30, 94, 156);
  subjects.forEach((s, i) => {
    const size = s.def.size ?? 1;
    const x = 91 + (i - (subjects.length - 1) / 2) * 62;
    s.view.draw(g, x, 96 + (1 - size) * 120, 0.62 * size);
  });
  g.fillStyle = shade(PAL.counterTop, 0.9);
  g.fillRect(12, 170, 158, 16);
  g.restore();
  g.strokeStyle = PAL.panelEdge;
  g.lineWidth = 1;
  g.strokeRect(12.5, 22.5, 157, 163);

  // --- right: the mirror ---
  const { x: mx, y: my, r } = MIRROR;
  g.strokeStyle = shade(PAL.metal, 0.7);
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(W, 0);
  g.lineTo(mx + r * 0.6, my - r * 0.6);
  g.stroke();

  g.save();
  g.beginPath();
  g.arc(mx, my, r, 0, Math.PI * 2);
  g.clip();
  // the bent room
  g.fillStyle = shade(PAL.ceiling, 0.9);
  g.fillRect(mx - r, my - r, r * 2, r * 2);
  g.fillStyle = shade(PAL.wall, 0.9);
  g.fillRect(mx - r, my - 50, r * 2, 70);
  g.fillStyle = shade(PAL.floorB, 0.9);
  g.fillRect(mx - r, my + 14, r * 2, r);
  g.strokeStyle = alpha(PAL.floorA, 0.8);
  g.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.ellipse(mx, my - 30, 60 + i * 26, 46 + i * 20, 0, 0.12 * Math.PI, 0.88 * Math.PI);
    g.stroke();
  }
  // the tubes, as one curved streak
  g.strokeStyle = alpha(PAL.fluoro, 0.2 + 0.7 * light);
  g.lineWidth = 3;
  g.beginPath();
  g.ellipse(mx, my + 20, 74, 86, 0, 1.3 * Math.PI, 1.7 * Math.PI);
  g.stroke();
  // fridge glow, far left of the mirror
  g.fillStyle = alpha(PAL.fridge, 0.5);
  g.fillRect(mx - 84, my - 34, 12, 34);

  // behind the counter: you, and Wren
  // You are a shape with a pale blank where a face should be. The glare, probably.
  g.fillStyle = '#1b2220';
  g.beginPath();
  g.roundRect(mx - 40, my - 30, 24, 40, 6);
  g.fill();
  if (self && dread >= 1) {
    // Last night: the blank has a face now, and it runs a beat behind you.
    drawFace(g, self.shown, mx - 28 - self.leanAgo(0.9) * 0.24, my - 36, 0.24, { ...self.anim, gazeX: 0, gazeY: 0, talk: 0 });
  } else {
    g.fillStyle = '#87928a';
    g.beginPath();
    g.ellipse(mx - 28, my - 38, 7, 9, 0, 0, Math.PI * 2);
    g.fill();
  }
  if (wren) {
    // On later nights Wren's reflection stops watching you and watches the mirror instead: that is, you, looking.
    const watching = dread >= 0.5 && time % 9 > 6;
    const face = watching ? { ...wren.shown, smile: wren.shown.smile + 0.55 } : wren.shown;
    drawFace(g, face, mx + 22, my - 36, 0.24, { ...wren.anim, gazeX: watching ? 0 : -0.6, gazeY: 0, blink: watching ? 0 : wren.anim.blink });
  }
  // the counter
  g.fillStyle = shade(PAL.counterTop, 0.8);
  g.beginPath();
  g.ellipse(mx, my - 62, 150, 78, 0, 0.2 * Math.PI, 0.8 * Math.PI);
  g.ellipse(mx, my - 78, 150, 78, 0, 0.8 * Math.PI, 0.2 * Math.PI, true);
  g.closePath();
  g.fill();

  // in front of the counter, with their backs to the mirror: the visitors
  subjects.forEach((s, i) => {
    const size = s.def.size ?? 1;
    const scale = 0.7 * size;
    const x = mx + (i - (subjects.length - 1) / 2) * 62;
    const y = my + 34 + (1 - size) * 60;
    const tell = s.def.tells.reflection;
    // A mirror flips left and right, so the reflection leans the opposite way...
    // and a "delayed" one leans the way the visitor leaned a moment ago.
    const lean = -(tell === 'delayed' ? s.view.leanAgo(MIRROR_LAG) : s.view.lean);
    if (tell === 'missing') return;
    const glance = tell === 'smiling' && time % 7.5 > 6.3; // now and then it looks back at you
    if (tell === 'wrongWay' || glance) {
      // It should be the back of a head. It is a face.
      const face = glance ? { ...s.view.shown, smile: s.view.shown.smile + 0.75 } : s.view.shown;
      drawFace(g, face, x + lean * scale, y, scale, { ...s.view.anim, gazeX: 0, gazeY: -0.3, talk: 0, tilt: 0 });
    } else {
      s.view.drawBack(g, x, y, scale, lean);
    }
  });

  // dome shading: darker towards the rim, a highlight top-left
  const dome = g.createRadialGradient(mx - 20, my - 26, r * 0.2, mx, my, r);
  dome.addColorStop(0, 'rgba(228,245,220,0.06)');
  dome.addColorStop(0.65, 'rgba(5,7,6,0.08)');
  dome.addColorStop(1, 'rgba(5,7,6,0.72)');
  g.fillStyle = dome;
  g.fillRect(mx - r, my - r, r * 2, r * 2);
  if (light < 1) {
    g.fillStyle = alpha(PAL.black, (1 - light) * 0.5);
    g.fillRect(mx - r, my - r, r * 2, r * 2);
  }
  g.restore();
  g.strokeStyle = shade(PAL.metal, 0.9);
  g.lineWidth = 2.5;
  g.beginPath();
  g.arc(mx, my, r, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = alpha(PAL.fluoro, 0.35 * light);
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(mx, my, r - 6, 1.15 * Math.PI, 1.45 * Math.PI);
  g.stroke();
}

// ---------------------------------------------------------------------------
// Shadow
// ---------------------------------------------------------------------------

function softEllipse(g: G, x: number, y: number, rx: number, ry: number, rot: number, strength: number): void {
  // Two stacked ellipses fake a soft edge without needing a blur filter.
  g.fillStyle = `rgba(5,7,6,${0.2 * strength})`;
  g.beginPath();
  g.ellipse(x, y, rx * 1.18, ry * 1.25, rot, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = `rgba(5,7,6,${0.26 * strength})`;
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  g.fill();
}

/** Looking over the counter at the floor. Every ordinary thing casts one soft shadow the same way. */
export function drawFloorCloseup(g: G, time: number, subjects: Subject[], light: number): void {
  // tiles, seen from above with a little perspective
  const rows = [0, 26, 58, 96, 142, 204];
  const at = (i: number, y: number) => 240 + i * 56 * (0.72 + (0.28 * y) / VIEW_H);
  for (let k = 0; k < rows.length - 1; k++) {
    for (let i = -6; i < 6; i++) {
      g.fillStyle = (i + k) & 1 ? PAL.floorA : PAL.floorB;
      g.beginPath();
      g.moveTo(at(i, rows[k]), rows[k]);
      g.lineTo(at(i + 1, rows[k]), rows[k]);
      g.lineTo(at(i + 1, rows[k + 1]), rows[k + 1]);
      g.lineTo(at(i, rows[k + 1]), rows[k + 1]);
      g.closePath();
      g.fill();
    }
  }
  // a pool of tube light
  const pool = g.createRadialGradient(240, 80, 10, 240, 90, 230);
  pool.addColorStop(0, alpha(PAL.fluoro, 0.16 * light));
  pool.addColorStop(1, alpha(PAL.black, 0.35));
  g.fillStyle = pool;
  g.fillRect(0, 0, W, VIEW_H);

  // Two ordinary objects, for comparison: their shadows show which way shadows fall here.
  softEllipse(g, 84, 132, 24, 7, 0, 1);
  g.fillStyle = shade(PAL.sodium, 0.75);
  g.beginPath();
  g.moveTo(66, 126);
  g.lineTo(76, 80);
  g.lineTo(88, 80);
  g.lineTo(98, 126);
  g.closePath();
  g.fill();
  g.fillStyle = '#1b201e';
  g.fillRect(79, 92, 6, 14);
  g.fillRect(79, 110, 6, 4);

  softEllipse(g, 404, 104, 22, 7, 0, 1);
  g.fillStyle = shade(PAL.metal, 0.6);
  g.beginPath();
  g.roundRect(386, 56, 30, 44, 3);
  g.fill();
  g.fillStyle = shade(PAL.metal, 0.85);
  g.fillRect(384, 54, 34, 5);

  subjects.forEach((s, i) => {
    const size = s.def.size ?? 1;
    const x = 240 + (i - (subjects.length - 1) / 2) * 104 + s.view.lean * 1.5;
    const feet = 112;
    const tell = s.def.tells.shadow;
    const k = size;

    // --- the shadow: this is the whole inspection ---
    if (tell === 'human') {
      softEllipse(g, x + 6, feet + 12, 44 * k, 11 * k, 0, 1);
    } else if (tell === 'wrongDir') {
      // falls up the room, towards the light
      softEllipse(g, x - 34, feet - 34, 54 * k, 11 * k, 0.75, 1);
    } else if (tell === 'many') {
      // its own, and one each side: tall, and belonging to nobody
      softEllipse(g, x + 6, feet + 12, 44 * k, 11 * k, 0, 1);
      for (const side of [-1, 1]) {
        softEllipse(g, x + side * 62, feet + 34, 13, 56, side * -0.22, 0.85);
        softEllipse(g, x + side * 76, feet + 92, 11, 11, 0, 0.85);
      }
    } else if (tell === 'moves') {
      // slides about under its owner, in no hurry
      softEllipse(g, x + 6 + 30 * Math.sin(time * 0.5), feet + 12 + 13 * Math.cos(time * 0.37), 44 * k, 11 * k, 0.2 * Math.sin(time * 0.3), 1);
    }
    // 'none': nothing at all under them

    // legs and shoes
    const pants = shade(s.view.shown.shirt, 0.55);
    const lw = 21 * k;
    const gap = 5 * k;
    g.fillStyle = pants;
    g.fillRect(x - gap - lw, 0, lw, feet);
    g.fillRect(x + gap, 0, lw, feet);
    g.fillStyle = shade(pants, 0.8);
    g.fillRect(x + gap + lw - 4 * k, 0, 4 * k, feet);
    g.fillStyle = '#121514';
    g.beginPath();
    g.ellipse(x - gap - lw / 2, feet + 4, 13 * k, 8 * k, 0, 0, Math.PI * 2);
    g.ellipse(x + gap + lw / 2, feet + 4, 13 * k, 8 * k, 0, 0, Math.PI * 2);
    g.fill();
  });

  // your side of the counter, along the bottom
  g.fillStyle = shade(PAL.counter, 0.8);
  g.fillRect(0, 186, W, 18);
  g.fillStyle = shade(PAL.counterEdge, 0.8);
  g.fillRect(0, 186, W, 2);

  if (light < 1) {
    g.fillStyle = alpha(PAL.black, (1 - light) * 0.5);
    g.fillRect(0, 0, W, VIEW_H);
  }
}

// ---------------------------------------------------------------------------
// Yourself
// ---------------------------------------------------------------------------

/**
 * The mirror, with nobody in front of it but you. `lag` is how many seconds the
 * reflection runs behind; `wrong` (0..1) is how far it has stopped pretending to be a reflection.
 */
export function drawSelfMirror(g: G, time: number, self: FaceView, light: number, lag: number, wrong: number): void {
  g.fillStyle = shade(PAL.wall, 0.7);
  g.fillRect(0, 0, W, VIEW_H);
  const mx = 240;
  const my = 102;
  const r = 94;
  g.save();
  g.beginPath();
  g.arc(mx, my, r, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = shade(PAL.ceiling, 0.9);
  g.fillRect(mx - r, my - r, r * 2, r * 2);
  g.fillStyle = shade(PAL.wall, 0.85);
  g.fillRect(mx - r, my - 40, r * 2, r * 2);
  g.strokeStyle = alpha(PAL.fluoro, 0.2 + 0.6 * light);
  g.lineWidth = 3;
  g.beginPath();
  g.ellipse(mx, my + 24, 76, 92, 0, 1.3 * Math.PI, 1.7 * Math.PI);
  g.stroke();
  // You lean; a moment later, it leans. Then it smiles, and you had not.
  const lean = -self.leanAgo(lag);
  const face = wrong > 0 ? { ...self.shown, smile: self.shown.smile + 0.85 * wrong, pupil: self.shown.pupil + 0.5 * wrong } : self.shown;
  drawFace(g, face, mx + lean * 1.25, my + 22, 1.25, {
    ...self.anim, blink: wrong > 0.5 ? 0 : self.anim.blink, gazeX: 0, gazeY: 0, talk: 0, tilt: lean * 0.012,
  });
  const dome = g.createRadialGradient(mx - 20, my - 26, r * 0.2, mx, my, r);
  dome.addColorStop(0, 'rgba(228,245,220,0.06)');
  dome.addColorStop(0.65, 'rgba(5,7,6,0.1)');
  dome.addColorStop(1, 'rgba(5,7,6,0.75)');
  g.fillStyle = dome;
  g.fillRect(mx - r, my - r, r * 2, r * 2);
  if (light < 1) {
    g.fillStyle = alpha(PAL.black, (1 - light) * 0.5);
    g.fillRect(mx - r, my - r, r * 2, r * 2);
  }
  g.restore();
  g.strokeStyle = shade(PAL.metal, 0.9);
  g.lineWidth = 2.5;
  g.beginPath();
  g.arc(mx, my, r, 0, Math.PI * 2);
  g.stroke();
  void time;
}
