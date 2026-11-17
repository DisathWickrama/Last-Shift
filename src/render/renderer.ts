// The renderer: one small canvas, scaled up.
//
// The game is drawn at a fixed "virtual" resolution of 480x270 onto a hidden
// canvas (`low`), then copied to the visible canvas enlarged, with smoothing off,
// so every virtual pixel becomes a crisp block. That gives the lo-fi look and
// means all drawing code can use the same coordinates on every screen size.
//
// Text is the one exception. Tiny pixelated text is hard to read, so text calls
// are *queued* while a scene draws, and painted afterwards directly on the big
// canvas at full sharpness. Scenes still give text positions in virtual pixels.
//
// Frame order:  begin() -> scene draws shapes + queues text -> present()
//   present():  filters on the small canvas -> scale up -> text -> screen filters

import { applyLowFilters, applyScreenFilters, type PostFx, defaultFx } from './filters';

export const W = 480;
export const H = 270;

const FONT = '"Courier New", "Liberation Mono", "DejaVu Sans Mono", monospace';

export interface TextOpts {
  /** Font size in virtual pixels. Default 8. */
  size?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  alpha?: number;
}

interface QueuedText extends Required<TextOpts> {
  str: string;
  x: number;
  y: number;
}

export class Renderer {
  /** Draw shapes with this. It is the 480x270 canvas. */
  readonly g: CanvasRenderingContext2D;
  readonly low: HTMLCanvasElement;
  /** Real pixels per virtual pixel. */
  scale = 1;
  /** Post-processing settings for this frame. Scenes set these. */
  fx: PostFx = { ...defaultFx };

  private screen: CanvasRenderingContext2D;
  private texts: QueuedText[] = [];

  constructor(private display: HTMLCanvasElement) {
    this.low = document.createElement('canvas');
    this.low.width = W;
    this.low.height = H;
    this.g = this.low.getContext('2d', { willReadFrequently: true })!;
    this.screen = display.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Fit the visible canvas to the window, keeping the 16:9 shape. */
  resize(): void {
    const fit = Math.min(window.innerWidth / W, window.innerHeight / H);
    // Snap to half steps (2, 2.5, 3...) once there is room: pixels stay nearly even
    // without leaving a thick black border on a laptop-sized window.
    const cssScale = fit >= 2 ? Math.floor(fit * 2) / 2 : fit;
    const dpr = window.devicePixelRatio || 1;
    this.display.style.width = `${W * cssScale}px`;
    this.display.style.height = `${H * cssScale}px`;
    this.display.width = Math.round(W * cssScale * dpr);
    this.display.height = Math.round(H * cssScale * dpr);
    this.scale = this.display.width / W;
  }

  /** Start a frame. */
  begin(): void {
    this.texts.length = 0;
    this.fx = { ...defaultFx }; // effects last one frame unless a scene sets them again
    this.g.setTransform(1, 0, 0, 1, 0, 0);
    this.g.globalAlpha = 1;
    this.g.globalCompositeOperation = 'source-over';
    this.g.fillStyle = '#050706';
    this.g.fillRect(0, 0, W, H);
  }

  /** Drop any text queued so far this frame (a menu covering the scene uses this). */
  clearText(): void {
    this.texts.length = 0;
  }

  /** Queue a line of text. x, y are virtual pixels; y is the top of the letters. */
  text(str: string, x: number, y: number, opts: TextOpts = {}): void {
    this.texts.push({
      str,
      x,
      y,
      size: opts.size ?? 8,
      color: opts.color ?? '#d9e6d4',
      align: opts.align ?? 'left',
      bold: opts.bold ?? false,
      alpha: opts.alpha ?? 1,
    });
  }

  private font(size: number, bold: boolean): string {
    return `${bold ? 'bold ' : ''}${size * this.scale}px ${FONT}`;
  }

  /** Width of a string in virtual pixels. */
  measure(str: string, size = 8, bold = false): number {
    this.screen.font = this.font(size, bold);
    return this.screen.measureText(str).width / this.scale;
  }

  /** Break a string into lines no wider than maxWidth (virtual pixels). */
  wrap(str: string, maxWidth: number, size = 8, bold = false): string[] {
    const lines: string[] = [];
    for (const paragraph of str.split('\n')) {
      let line = '';
      for (const word of paragraph.split(' ')) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && this.measure(candidate, size, bold) > maxWidth) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  /** Finish the frame: filters, scale up, text, screen filters. */
  present(): void {
    const s = this.screen;
    const dw = this.display.width;
    const dh = this.display.height;

    applyLowFilters(this.g, this.low, this.fx);

    s.setTransform(1, 0, 0, 1, 0, 0);
    s.globalAlpha = 1;
    s.imageSmoothingEnabled = false;
    // Screen shake: draw the whole picture a few pixels off, a different way each frame.
    const jolt = this.fx.shake * 3 * this.scale;
    const sx = jolt ? Math.round((Math.random() - 0.5) * 2 * jolt) : 0;
    const sy = jolt ? Math.round((Math.random() - 0.5) * 2 * jolt) : 0;
    if (jolt) {
      s.fillStyle = '#050706';
      s.fillRect(0, 0, dw, dh);
    }
    s.drawImage(this.low, sx, sy, dw, dh);

    s.textBaseline = 'top';
    for (const t of this.texts) {
      s.font = this.font(t.size, t.bold);
      s.textAlign = t.align;
      s.globalAlpha = t.alpha;
      s.fillStyle = t.color;
      let str = t.str;
      let dx = 0;
      // High "slip" makes the interface itself unreliable: letters swap, lines jitter.
      if (this.fx.textGlitch > 0 && Math.random() < this.fx.textGlitch * 0.04 && str.length > 3) {
        const i = Math.floor(Math.random() * str.length);
        const swap = '#/\\|_.:;'[Math.floor(Math.random() * 8)];
        str = str.slice(0, i) + swap + str.slice(i + 1);
        dx = (Math.random() - 0.5) * 2 * this.scale;
      }
      s.fillText(str, Math.round(t.x * this.scale + dx), Math.round(t.y * this.scale));
    }
    s.globalAlpha = 1;

    applyScreenFilters(s, dw, dh, this.scale, this.fx);
  }
}
