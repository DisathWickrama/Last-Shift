// Post-processing filters.
//
// A filter changes the finished picture rather than drawing anything new. Two
// stages, matching the two canvases in renderer.ts:
//   applyLowFilters    -> on the small 480x270 canvas (cheap: few pixels)
//   applyScreenFilters -> on the big visible canvas, on top of the text
//
// This first version only does the fade to black used by scene changes.
// Dithering, scanlines, flicker and glitch arrive in the "audio + filters" chunk.

/** Settings for one frame of post-processing. Scenes write these each frame. */
export interface PostFx {
  /** 0 = normal, 1 = fully black. Scene transitions. */
  fade: number;
  /** 0 = lights fully on, 1 = lights off. Driven by the fluoro flicker. */
  dim: number;
  /** 0..1 strength of the horizontal-slice glitch (a mimic breaking). */
  glitch: number;
  /** 0..1 chance-per-frame scale for interface text corruption (high Slip). */
  textGlitch: number;
  /** 0..1 deep red flash. Gore only. */
  gore: number;
}

export const defaultFx: PostFx = { fade: 0, dim: 0, glitch: 0, textGlitch: 0, gore: 0 };

export function applyLowFilters(_g: CanvasRenderingContext2D, _canvas: HTMLCanvasElement, _fx: PostFx): void {
  // Filled in later.
}

export function applyScreenFilters(
  s: CanvasRenderingContext2D,
  w: number,
  h: number,
  _scale: number,
  fx: PostFx,
): void {
  if (fx.fade > 0) {
    s.fillStyle = `rgba(5,7,6,${fx.fade})`;
    s.fillRect(0, 0, w, h);
  }
}
