// Interface pieces: buttons, panels and the dialogue box.
//
// There is no HTML here; the interface is drawn on the canvas like everything
// else. Buttons are plain data (`Btn`). Each update step the scene builds the
// list of buttons that should exist right now, `handleButtons` checks them
// against the input, and `drawButtons` paints the same list. Because the list is
// rebuilt from the game state every step, it can never go stale.

import type { Input } from '../core/input';
import type { Renderer } from '../render/renderer';
import { PAL, alpha } from '../render/palette';

export interface Btn {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  /** Small right-aligned note, e.g. the time a check costs. */
  hint?: string;
  /** Keyboard shortcut (lower-case key). */
  key?: string;
  disabled?: boolean;
  /** Left-align the label (used for lists of dialogue options). */
  left?: boolean;
  /** Text colour override. */
  color?: string;
  /** A sentence of help shown while the pointer is over the button. */
  tip?: string;
  onClick: () => void;
}

// Where the interface sits, in virtual pixels. The bottom band lies on the counter top.
export const BAND_Y = 204;
export const DIALOGUE = { x: 6, y: 207, w: 294, h: 58 };
export const COL_A = { x: 304, w: 84 }; // inspections
export const COL_B = { x: 392, w: 82 }; // decisions

// Sounds for every button in the game, set once from main.ts (so this file need not know about audio).
let onHover: () => void = () => {};
let onClick: () => void = () => {};
let hovered = '';
export function setUiSounds(hover: () => void, click: () => void): void {
  onHover = hover;
  onClick = click;
}

/** Run the first button that was clicked (or whose key was pressed). Returns it, or null. */
export function handleButtons(buttons: readonly Btn[], input: Input): Btn | null {
  // A soft tick when the pointer moves onto a different button.
  const over = buttons.find((b) => !b.disabled && input.over(b.x, b.y, b.w, b.h));
  const id = over ? `${over.label}@${over.x},${over.y}` : '';
  if (id && id !== hovered) onHover();
  hovered = id;

  for (const b of buttons) {
    if (b.disabled) continue;
    const hit = input.clicked && input.over(b.x, b.y, b.w, b.h);
    if (hit || (b.key && input.pressed(b.key))) {
      input.consume();
      onClick();
      b.onClick();
      return b;
    }
  }
  return null;
}

export function drawPanel(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, edge: string = PAL.panelEdge): void {
  g.fillStyle = alpha(PAL.panel, 0.9);
  g.fillRect(x, y, w, h);
  g.strokeStyle = edge;
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

export function drawButtons(r: Renderer, buttons: readonly Btn[], input: Input): void {
  for (const b of buttons) {
    const hover = !b.disabled && input.over(b.x, b.y, b.w, b.h);
    drawPanel(r.g, b.x, b.y, b.w, b.h, hover ? PAL.ink : PAL.panelEdge);
    if (hover) {
      r.g.fillStyle = alpha(PAL.fluoro, 0.08);
      r.g.fillRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    }
    const color = b.disabled ? PAL.panelEdge : (b.color ?? (hover ? PAL.fluoro : PAL.ink));
    const ty = b.y + (b.h - 7) / 2 - 0.5;
    if (b.left) r.text(b.label, b.x + 5, ty, { size: 7, color });
    else if (b.hint) {
      // Tool-tray buttons show their keyboard shortcut in front of the name.
      if (b.key) r.text(b.key.toUpperCase(), b.x + 4, ty + 0.5, { size: 6, color: PAL.sodiumDim });
      r.text(b.label, b.x + (b.key ? 12 : 5), ty, { size: 7, color });
    }
    else r.text(b.label, b.x + b.w / 2, ty, { size: 7, color, align: 'center' });
    if (b.hint) r.text(b.hint, b.x + b.w - 4, ty + 0.5, { size: 6, color: PAL.inkDim, align: 'right' });
  }
  // Tooltip: one line of help above the interface band for whichever button is under the pointer.
  const tipped = buttons.find((b) => b.tip && !b.disabled && input.over(b.x, b.y, b.w, b.h));
  if (tipped?.tip) drawTip(r, tipped.tip);
}

/** A one-line help strip just above the interface band. */
export function drawTip(r: Renderer, text: string): void {
  drawPanel(r.g, 6, 192, 468, 12, PAL.sodiumDim);
  r.text(text, 11, 195, { size: 6, color: PAL.ink });
}

/**
 * The dialogue box. Text appears a letter at a time ("typewriter"); one press
 * finishes the line early and the next press moves on. The scene decides what
 * "moving on" means; this class only handles showing one line.
 */
export class DialogueBox {
  name = '';
  color: string = PAL.ink;
  text = '';
  /** How many characters are visible. */
  private chars = 0;
  private wrapKey = '';
  private lines: string[] = [];

  say(name: string, color: string, text: string): void {
    this.name = name;
    this.color = color;
    this.text = text;
    this.chars = 0;
  }

  clear(): void {
    this.say('', PAL.ink, '');
  }

  get typing(): boolean {
    return this.chars < this.text.length;
  }

  finish(): void {
    this.chars = this.text.length;
  }

  /** Advance the typewriter. Returns true on steps where a new letter appeared (for the voice blip). */
  update(dt: number, speed = 48): boolean {
    if (!this.typing) return false;
    const before = Math.floor(this.chars);
    this.chars = Math.min(this.text.length, this.chars + dt * speed);
    return Math.floor(this.chars) > before;
  }

  draw(r: Renderer, time: number, box = DIALOGUE, showArrow = true): void {
    drawPanel(r.g, box.x, box.y, box.w, box.h);
    let y = box.y + 5;
    if (this.name) {
      r.text(this.name.toUpperCase(), box.x + 7, y, { size: 6, color: this.color, bold: true });
      y += 9;
    }
    // Wrapping depends on the real font size, so redo it only when the text or the window changes.
    const key = `${this.text}|${r.scale}|${box.w}`;
    if (key !== this.wrapKey) {
      this.wrapKey = key;
      this.lines = r.wrap(this.text, box.w - 14, 8);
    }
    let left = Math.floor(this.chars);
    for (const line of this.lines) {
      if (left <= 0) break;
      r.text(line.slice(0, left), box.x + 7, y, { size: 8, color: this.name ? PAL.ink : PAL.inkDim });
      left -= line.length + 1; // +1 for the space the wrap removed
      y += 10;
    }
    if (showArrow && !this.typing && this.text && Math.sin(time * 6) > -0.2) {
      r.text('▼', box.x + box.w - 6, box.y + box.h - 10, { size: 6, color: PAL.inkDim, align: 'right' });
    }
  }
}
