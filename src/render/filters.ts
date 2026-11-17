// Post-processing filters: the lo-fi CRT look, and the glitches.
//
// A filter changes the finished picture rather than drawing anything new. Two
// stages, matching the two canvases in renderer.ts:
//
//   applyLowFilters    on the small 480x270 canvas (cheap: few pixels)
//                        glitch slices -> gore tint -> ordered dithering
//   applyScreenFilters on the big visible canvas, on top of the text
//                        scanlines -> vignette -> fade to black

import { W, H } from './renderer';

/** Settings for one frame of post-processing. Scenes write these each frame. */
export interface PostFx {
  /** 0 = normal, 1 = fully black. Scene transitions. */
  fade: number;
  /** 0..1 strength of the horizontal-slice glitch (a mimic breaking). */
  glitch: number;
  /** 0..1 chance scale for interface text corruption (high Slip). */
  textGlitch: number;
  /** 0..1 deep red flash. Gore only. */
  gore: number;
  /** 0..1 how hard the whole picture is jolting (knocks, hits). */
  shake: number;
}

export const defaultFx: PostFx = { fade: 0, glitch: 0, textGlitch: 0, gore: 0, shake: 0 };

// --- ordered dithering ---------------------------------------------------------
//
// Old hardware could show only a few shades, so it faked the in-between ones
// with patterns of dots. "Ordered" dithering does that with a small repeating
// grid of thresholds (a Bayer matrix): before rounding each pixel to the nearest
// allowed shade, nudge it up or down by the threshold for its position. Smooth
// gradients, like the fog, turn into a fine cross-hatch.

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Allowed shades are multiples of this. Bigger = fewer shades = stronger effect. */
const STEP = 14;

function dither(g: CanvasRenderingContext2D): void {
  const image = g.getImageData(0, 0, W, H);
  const px = image.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nudge = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * STEP;
      const i = (y * W + x) * 4;
      // Uint8ClampedArray clamps to 0..255 for us.
      px[i] = Math.round((px[i] + nudge) / STEP) * STEP;
      px[i + 1] = Math.round((px[i + 1] + nudge) / STEP) * STEP;
      px[i + 2] = Math.round((px[i + 2] + nudge) / STEP) * STEP;
    }
  }
  g.putImageData(image, 0, 0);
}

export function applyLowFilters(g: CanvasRenderingContext2D, canvas: HTMLCanvasElement, fx: PostFx): void {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;

  // Glitch: copy a few horizontal strips of the picture sideways, like a torn video signal.
  if (fx.glitch > 0) {
    const strips = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < strips; i++) {
      const y = Math.floor(Math.random() * H);
      const h = 2 + Math.floor(Math.random() * 14);
      const dx = Math.round((Math.random() - 0.5) * 60 * fx.glitch);
      g.drawImage(canvas, 0, y, W, h, dx, y, W, h);
    }
  }

  // Deep red wash. Reserved for gore.
  if (fx.gore > 0) {
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = `rgba(150,20,26,${fx.gore})`;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
  }

  dither(g);
}

// The scanline and vignette overlays never change, so they are painted once
// onto their own canvas and re-used until the window is resized.
let overlay: HTMLCanvasElement | null = null;

function buildOverlay(w: number, h: number, scale: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const o = c.getContext('2d')!;
  // Scanlines: a dark line across the lower part of every virtual pixel row.
  o.fillStyle = 'rgba(0,0,0,0.17)';
  const line = Math.max(1, Math.round(scale * 0.34));
  for (let row = 0; row < H; row++) o.fillRect(0, Math.round((row + 1) * scale) - line, w, line);
  // Vignette: the corners of an old screen are darker than the middle.
  const v = o.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.95);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.42)');
  o.fillStyle = v;
  o.fillRect(0, 0, w, h);
  return c;
}

export function applyScreenFilters(s: CanvasRenderingContext2D, w: number, h: number, scale: number, fx: PostFx): void {
  if (!overlay || overlay.width !== w || overlay.height !== h) overlay = buildOverlay(w, h, scale);
  s.drawImage(overlay, 0, 0);
  if (fx.fade > 0) {
    s.fillStyle = `rgba(5,7,6,${fx.fade})`;
    s.fillRect(0, 0, w, h);
  }
}
