// The roadhouse, as seen from behind the counter.
//
// Everything here is rectangles, circles and gradients: no image files. The room
// is drawn in two passes so that people can stand "inside" it:
//
//   drawRoomBack()  -> ceiling, walls, the view outside, fridge, floor
//   (the night scene draws the visitor here)
//   drawRoomFront() -> the counter and the things on it
//
// The functions take a RoomState describing what the room looks like right now
// (how bright the tubes are, whether the door is open...). They do not decide any
// of that themselves: "data in, pixels out".

import { W, H } from './renderer';
import { PAL, shade, mix, alpha } from './palette';

export interface RoomState {
  /** Seconds since the scene started. Drives the drifting fog. */
  time: number;
  /** Fluoro brightness: 1 = on, 0 = off. Flicker moves this. */
  light: number;
  /** 0 = shut, 1 = open. */
  doorOpen: number;
  /** 0 = night, 1 = dawn. */
  dawn: number;
  /** The staff photo on the noticeboard has been turned to face the wall. */
  photoFlipped: boolean;
  /** Maureen's scone is sitting on the counter, uneaten. */
  scone: boolean;
  /** Someone small is still standing at the glass. */
  lingerer: boolean;
  /** Dawn aftermath: a car left at the pumps. */
  car: boolean;
  /** Dawn aftermath: marks by the pumps. Deep red, so gore only. */
  marks: boolean;
  /** The CB radio's light: on while a broadcast is coming through. */
  radioLive: boolean;
  /** 0..1: how visible the figure outside is. */
  figure: number;
  /** 0 = out by the pumps, 1 = right at the glass. */
  figureNear: number;
}

export const defaultRoom: RoomState = {
  time: 0, light: 1, doorOpen: 0, dawn: 0, photoFlipped: false, scone: false,
  lingerer: false, car: false, marks: false, radioLive: false, figure: 0, figureNear: 0,
};

type G = CanvasRenderingContext2D;

// Where things are, in virtual pixels. Other files (close-ups, the night scene) reuse these.
export const DOOR = { x: 188, y: 34, w: 76, h: 116 };
export const VISITOR_SPOT = { x: 224, y: 116 };
export const WREN_SPOT = { x: 424, y: 152 };
const GLASS = { x: 88, y: 34, w: 242, h: 116 };
const FLOOR_Y = 150;
export const COUNTER_Y = 196;

/** The forecourt in the fog: canopy, pumps, sodium lamps. Drawn through the glass and on the title screen. */
export function drawOutside(g: G, s: RoomState, x = 0, y = 24, w = W, h = 126): void {
  const sky = g.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, mix(PAL.night, PAL.fogLight, 0.1 + s.dawn * 0.55));
  sky.addColorStop(1, mix(PAL.fog, PAL.fogLight, s.dawn * 0.9));
  g.fillStyle = sky;
  g.fillRect(x, y, w, h);

  // wet concrete
  g.fillStyle = mix(PAL.fogDark, PAL.fog, 0.35 + s.dawn * 0.4);
  g.fillRect(x, 136, w, y + h - 136);

  // the sign on its pole: "LAST FUEL FOR 80 KM", seen from behind
  g.fillStyle = PAL.fogDark;
  g.fillRect(307, 82, 3, 60);
  g.fillRect(292, 58, 34, 24);
  g.fillStyle = alpha(PAL.sodium, 0.28 * (1 - s.dawn));
  g.fillRect(291, 57, 36, 1);
  g.fillRect(291, 82, 36, 1);

  // canopy and its posts
  g.fillStyle = PAL.fogDark;
  g.fillRect(94, 68, 112, 7);
  g.fillRect(100, 75, 3, 66);
  g.fillRect(196, 75, 3, 66);

  // an abandoned car at the pumps (dawn aftermath)
  if (s.car) {
    g.fillStyle = shade(PAL.fogDark, 0.8);
    g.beginPath();
    g.roundRect(206, 124, 52, 13, 3);
    g.fill();
    g.beginPath();
    g.roundRect(216, 115, 30, 11, 4);
    g.fill();
    g.fillRect(246, 112, 2, 18); // a door left standing open
    g.fillStyle = PAL.black;
    g.fillRect(212, 135, 8, 5);
    g.fillRect(244, 135, 8, 5);
  }

  // pumps
  for (const px of [122, 164]) {
    g.fillStyle = shade(PAL.fogDark, 0.75);
    g.fillRect(px, 110, 13, 30);
    g.fillStyle = alpha(PAL.sodium, 0.7 * (1 - s.dawn * 0.8));
    g.fillRect(px + 3, 114, 7, 3);
    g.fillStyle = shade(PAL.fogDark, 0.55);
    g.fillRect(px + 12, 118, 2, 14); // hose
  }
  if (s.marks) {
    // Deep red is reserved for this.
    g.fillStyle = PAL.gore;
    g.fillRect(166, 124, 5, 2);
    g.fillRect(168, 126, 2, 9);
    g.fillRect(150, 139, 22, 2);
    g.fillStyle = PAL.goreDark;
    g.fillRect(140, 141, 34, 2);
  }

  // sodium lamps under the canopy, each with a glow that the fog scatters
  const lamp = 1 - s.dawn * 0.85;
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const lx of [116, 150, 184]) {
    const glow = g.createRadialGradient(lx, 78, 1, lx, 84, 46);
    glow.addColorStop(0, alpha(PAL.sodium, 0.55 * lamp));
    glow.addColorStop(0.4, alpha(PAL.sodium, 0.16 * lamp));
    glow.addColorStop(1, alpha(PAL.sodium, 0));
    g.fillStyle = glow;
    g.fillRect(lx - 48, 40, 96, 100);
    // reflection on the wet ground
    g.fillStyle = alpha(PAL.sodium, 0.1 * lamp);
    g.fillRect(lx - 3, 137, 6, 13);
  }
  g.restore();
  g.fillStyle = mix(PAL.sodiumDim, '#ffe2b0', lamp);
  for (const lx of [116, 150, 184]) g.fillRect(lx - 2, 75, 4, 2);

  // drifting fog: a few big soft blobs that wrap around
  for (let i = 0; i < 6; i++) {
    const speed = 3 + i * 1.7;
    const span = w + 280;
    const fx = x + ((s.time * speed + i * 137) % span) - 140;
    const fy = y + 22 + i * 17;
    const fog = g.createRadialGradient(fx, fy, 2, fx, fy, 90 + i * 8);
    fog.addColorStop(0, alpha(PAL.fogLight, 0.2 + s.dawn * 0.1));
    fog.addColorStop(1, alpha(PAL.fogLight, 0));
    g.fillStyle = fog;
    g.save();
    g.translate(fx, fy);
    g.scale(1, 0.22);
    g.translate(-fx, -fy);
    g.fillRect(fx - 140, fy - 140, 280, 280);
    g.restore();
  }

  // Somebody standing out there. Too tall, arms a little too long, perfectly still.
  // Drawn into the fog so that it is never quite sharp.
  if (s.figure > 0.01) {
    const n = s.figureNear;
    const fx = 150 + (236 - 150) * n; // from beside the pumps to the door glass
    const base = 141 + 9 * n;
    const tall = 30 + 52 * n;
    const wide = 5 + 8 * n;
    g.fillStyle = alpha(PAL.black, s.figure * (0.55 + 0.35 * n));
    g.beginPath();
    g.ellipse(fx, base - tall, wide * 0.55, wide * 0.7, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(fx - wide / 2, base - tall + wide * 0.5, wide, tall - wide * 0.5);
    g.fillRect(fx - wide / 2 - wide * 0.3, base - tall + wide * 0.8, wide * 0.3, tall * 0.62); // arms hang past the knee
    g.fillRect(fx + wide / 2, base - tall + wide * 0.8, wide * 0.3, tall * 0.62);
  }

  // whoever is still waiting at the glass
  if (s.lingerer) {
    g.fillStyle = alpha(PAL.black, 0.82);
    g.beginPath();
    g.arc(246, 118, 5, 0, Math.PI * 2);
    g.fill();
    g.fillRect(241, 122, 10, 28);
  }
}

function drawFloor(g: G, L: (c: string) => string): void {
  // A checkerboard in one-point perspective: every tile edge aims at one
  // vanishing point, and rows get taller as they come towards the viewer.
  const vx = 240;
  const vy = 40;
  const rows = [150, 156, 164, 175, 190, 210, 238, 276];
  const at = (i: number, y: number) => vx + i * 24 * ((y - vy) / (FLOOR_Y - vy));
  for (let k = 0; k < rows.length - 1; k++) {
    const y0 = rows[k];
    const y1 = rows[k + 1];
    for (let i = -12; i < 12; i++) {
      g.fillStyle = L((i + k) & 1 ? PAL.floorA : PAL.floorB);
      g.beginPath();
      g.moveTo(at(i, y0), y0);
      g.lineTo(at(i + 1, y0), y0);
      g.lineTo(at(i + 1, y1), y1);
      g.lineTo(at(i, y1), y1);
      g.closePath();
      g.fill();
    }
  }
}

export function drawRoomBack(g: G, s: RoomState): void {
  // L() darkens a colour when the tubes flicker. Things that make their own
  // light (the fridge, the pumps outside) do not go through it.
  const level = 0.28 + 0.72 * s.light + s.dawn * 0.1;
  const L = (c: string): string => shade(c, level);

  g.fillStyle = L(PAL.ceiling);
  g.fillRect(0, 0, W, 24);
  g.fillStyle = L(PAL.wall);
  g.fillRect(0, 24, W, 126);
  g.fillStyle = L(PAL.wallDark);
  g.fillRect(0, 134, W, 16);

  drawFloor(g, L);

  // --- the glass front ---
  g.save();
  g.beginPath();
  g.rect(GLASS.x, GLASS.y, GLASS.w, GLASS.h);
  g.clip();
  drawOutside(g, s);
  // the tubes reflected faintly in the glass
  g.fillStyle = alpha(PAL.fluoro, 0.07 * s.light);
  g.fillRect(104, 46, 110, 3);
  g.fillRect(250, 46, 70, 3);
  g.restore();

  // pillars either side of the door
  g.fillStyle = L(PAL.wall);
  g.fillRect(174, 30, 14, 120);
  g.fillRect(264, 30, 14, 120);
  g.fillStyle = L(PAL.wallDark);
  g.fillRect(174, 134, 14, 16);
  g.fillRect(264, 134, 14, 16);

  // window and door frames
  g.strokeStyle = L(PAL.metal);
  g.lineWidth = 2;
  g.strokeRect(89, 35, 84, 114);
  g.strokeRect(279, 35, 50, 114);
  g.strokeRect(DOOR.x + 1, DOOR.y + 1, DOOR.w - 2, DOOR.h - 1);
  const leaf = 226 + 34 * s.doorOpen; // the right-hand door swings away as it opens
  if (s.doorOpen > 0.02) {
    g.fillStyle = alpha(PAL.fogLight, 0.22 * s.doorOpen);
    g.fillRect(227, 37, leaf - 227, 112);
  }
  g.fillStyle = L(PAL.metal);
  g.fillRect(225, 36, 2, 114);
  g.fillRect(leaf, 36, 2, 114);
  g.fillRect(194, 98, 26, 2);
  g.fillRect(Math.min(leaf + 4, 258), 98, Math.max(2, 258 - leaf - 4), 2);

  // --- drinks fridge (left). It has its own light, so it ignores L(). ---
  g.fillStyle = L(PAL.counter);
  g.fillRect(12, 44, 70, 106);
  g.fillStyle = shade(PAL.fridge, 0.5);
  g.fillRect(17, 52, 60, 94);
  const bottles = ['#8fb89a', '#d9e6d4', '#c9a25a', '#6f8f84', '#b8c8a0'];
  for (let row = 0; row < 5; row++) {
    const by = 52 + row * 19;
    for (let i = 0; i < 8; i++) {
      // a fixed pattern; a couple of gaps where stock has run out
      const n = (row * 7 + i * 3) % 11;
      if (n === 4) continue;
      g.fillStyle = shade(bottles[n % bottles.length], 0.8);
      g.fillRect(19 + i * 7.2, by + 5, 5, 12);
      g.fillStyle = shade(bottles[(n + 2) % bottles.length], 0.6);
      g.fillRect(20 + i * 7.2, by + 3, 3, 2);
    }
    g.fillStyle = shade(PAL.fridge, 0.32);
    g.fillRect(17, by + 17, 60, 2);
  }
  g.fillStyle = alpha(PAL.fridge, 0.75);
  g.fillRect(17, 46, 60, 4);
  g.strokeStyle = L(PAL.metal);
  g.lineWidth = 1;
  g.strokeRect(16.5, 51.5, 61, 95);
  g.fillStyle = L(PAL.metal);
  g.fillRect(47, 52, 1, 94);
  // the fridge's glow spilling on the floor
  const spill = g.createRadialGradient(47, 152, 2, 47, 152, 60);
  spill.addColorStop(0, alpha(PAL.fridge, 0.22));
  spill.addColorStop(1, alpha(PAL.fridge, 0));
  g.fillStyle = spill;
  g.fillRect(0, 150, 120, 46);

  // --- noticeboard ---
  g.fillStyle = L('#3a3328');
  g.fillRect(342, 54, 56, 42);
  g.fillStyle = L('#5c503c');
  g.fillRect(344, 56, 52, 38);
  g.fillStyle = L('#cfd6c6');
  g.fillRect(347, 59, 12, 15);
  g.fillStyle = L('#c9c2a0');
  g.fillRect(361, 58, 10, 9);
  g.fillStyle = L('#cfd6c6');
  g.fillRect(348, 77, 18, 14);
  g.fillStyle = L('#8c9488');
  for (let i = 0; i < 4; i++) g.fillRect(349, 79 + i * 3, 16, 1);
  // the staff photo
  if (s.photoFlipped) {
    g.fillStyle = L('#b9bdb0');
    g.fillRect(375, 62, 16, 13);
  } else {
    g.fillStyle = L('#d9ddd0');
    g.fillRect(375, 62, 16, 13);
    g.fillStyle = L('#3c4640');
    g.fillRect(376, 63, 14, 9);
    g.fillStyle = L('#a08a70');
    g.fillRect(379, 65, 3, 3);
    g.fillRect(385, 65, 3, 3);
    g.fillStyle = L('#59685e');
    g.fillRect(378, 68, 5, 4);
    g.fillRect(384, 68, 5, 4);
  }
  g.fillStyle = L(PAL.metal);
  g.fillRect(382, 61, 2, 2);

  // --- storeroom door ---
  g.fillStyle = L(PAL.wallDark);
  g.fillRect(404, 54, 66, 96);
  g.fillStyle = L('#1b221f');
  g.fillRect(408, 58, 58, 92);
  g.fillStyle = L('#aab4a4');
  g.fillRect(424, 70, 26, 8);
  g.fillStyle = L('#3c4640');
  g.fillRect(427, 73, 20, 2);
  g.fillStyle = L(PAL.metal);
  g.fillRect(412, 106, 4, 8);
  g.fillStyle = PAL.black;
  g.fillRect(408, 148, 58, 2);

  // --- convex security mirror in the corner ---
  g.strokeStyle = L(PAL.metal);
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(470, 26);
  g.lineTo(456, 36);
  g.stroke();
  const dome = g.createRadialGradient(447, 36, 1, 452, 42, 16);
  dome.addColorStop(0, L('#a9bcae'));
  dome.addColorStop(0.6, L('#4c5d54'));
  dome.addColorStop(1, L('#1c2421'));
  g.fillStyle = dome;
  g.beginPath();
  g.arc(452, 42, 15, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = alpha(PAL.fluoro, 0.5 * s.light);
  g.fillRect(444, 34, 9, 1);
  g.strokeStyle = L(PAL.metal);
  g.lineWidth = 1;
  g.stroke();

  // --- fluoro tubes ---
  for (const tx of [100, 282]) {
    g.fillStyle = L(PAL.metal);
    g.fillRect(tx, 7, 118, 8);
    g.fillStyle = shade(PAL.fluoro, 0.2 + 0.8 * s.light);
    g.fillRect(tx + 4, 9, 110, 4);
    const cone = g.createLinearGradient(0, 14, 0, 74);
    cone.addColorStop(0, alpha(PAL.fluoro, 0.2 * s.light));
    cone.addColorStop(1, alpha(PAL.fluoro, 0));
    g.fillStyle = cone;
    g.beginPath();
    g.moveTo(tx + 4, 14);
    g.lineTo(tx + 114, 14);
    g.lineTo(tx + 134, 74);
    g.lineTo(tx - 16, 74);
    g.closePath();
    g.fill();
  }
}

export function drawRoomFront(g: G, s: RoomState): void {
  const level = 0.28 + 0.72 * s.light + s.dawn * 0.1;
  const L = (c: string): string => shade(c, level);

  // counter top: you are standing behind it, looking across it
  const top = g.createLinearGradient(0, COUNTER_Y, 0, H);
  top.addColorStop(0, L(PAL.counterTop));
  top.addColorStop(1, L(PAL.counter));
  g.fillStyle = top;
  g.fillRect(0, COUNTER_Y, W, H - COUNTER_Y);
  g.fillStyle = L(PAL.counterEdge);
  g.fillRect(0, COUNTER_Y, W, 2);

  // CB radio
  g.strokeStyle = L(PAL.metal);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(66.5, 174);
  g.lineTo(71.5, 144);
  g.stroke();
  g.fillStyle = L('#161b19');
  g.fillRect(12, 172, 60, 27);
  g.fillStyle = L('#2c3531');
  g.fillRect(15, 175, 54, 21);
  g.fillStyle = L('#0f1312');
  for (let i = 0; i < 6; i++) g.fillRect(18, 178 + i * 3, 20, 1);
  g.fillStyle = L(PAL.metal);
  g.beginPath();
  g.arc(50, 186, 5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = L('#161b19');
  g.fillRect(49.5, 182, 1, 4);
  const blink = s.radioLive ? 0.55 + 0.45 * Math.sin(s.time * 14) : 0.18;
  g.fillStyle = alpha(PAL.radio, blink);
  g.fillRect(60, 178, 4, 3);
  g.fillStyle = alpha(PAL.sodium, 0.5);
  g.fillRect(60, 184, 4, 2);

  // till
  g.fillStyle = L('#1d2320');
  g.fillRect(304, 170, 44, 29);
  g.fillStyle = L('#30403a');
  g.fillRect(308, 174, 36, 10);
  g.fillStyle = alpha(PAL.radio, 0.5);
  g.fillRect(326, 177, 15, 4);
  g.fillStyle = L(PAL.metal);
  for (let i = 0; i < 5; i++) g.fillRect(309 + i * 7, 188, 5, 3);

  // service bell
  g.fillStyle = L('#30403a');
  g.fillRect(264, 195, 14, 3);
  g.fillStyle = L(PAL.counterEdge);
  g.beginPath();
  g.arc(271, 195, 6, Math.PI, Math.PI * 2);
  g.fill();
  g.fillRect(270, 187, 2, 2);

  if (s.scone) {
    g.fillStyle = L('#c9d2c2');
    g.beginPath();
    g.ellipse(152, 201, 13, 3.5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = L('#b89a6a');
    g.beginPath();
    g.ellipse(152, 198, 7, 4.5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = L('#d8c9a0');
    g.fillRect(147, 196, 10, 1.5);
  }
}
