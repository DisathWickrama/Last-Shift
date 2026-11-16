// A spare off-screen canvas ("layer") for effects that need a picture of one
// thing on its own: for example drawing a visitor, tinting *only* the visitor
// dark (a silhouette in the fog), then stamping the result onto the scene.
//
// The trick is the canvas blend mode 'source-atop': it paints only where the
// layer already has something drawn, so the tint follows the figure's outline.

import { W, H } from './renderer';

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

function layer(): CanvasRenderingContext2D {
  if (!ctx) {
    canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    ctx = canvas.getContext('2d')!;
  }
  return ctx;
}

/**
 * Draw something on its own layer, optionally darken it, then copy it onto `g`.
 * @param tint   colour to darken with
 * @param amount 0 = untouched, 1 = solid silhouette
 * @param alpha  overall opacity when copied onto g
 */
export function drawTinted(
  g: CanvasRenderingContext2D,
  paint: (l: CanvasRenderingContext2D) => void,
  tint: string,
  amount: number,
  alpha = 1,
): void {
  if (amount <= 0.01 && alpha >= 0.99) {
    paint(g);
    return;
  }
  const l = layer();
  l.setTransform(1, 0, 0, 1, 0, 0);
  l.globalCompositeOperation = 'source-over';
  l.globalAlpha = 1;
  l.clearRect(0, 0, W, H);
  paint(l);
  l.setTransform(1, 0, 0, 1, 0, 0);
  l.globalCompositeOperation = 'source-atop';
  l.globalAlpha = amount;
  l.fillStyle = tint;
  l.fillRect(0, 0, W, H);
  l.globalCompositeOperation = 'source-over';
  l.globalAlpha = 1;
  g.save();
  g.globalAlpha = alpha;
  g.drawImage(canvas!, 0, 0);
  g.restore();
}
