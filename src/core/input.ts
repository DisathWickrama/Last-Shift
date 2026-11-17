// Input: mouse / touch / keyboard.
//
// The browser tells us about input through events that can arrive at any moment.
// Game logic wants a simpler question answered once per update step: "was there a
// click since I last looked, and where is the pointer?" So this class collects
// events into flags, and the game loop calls endStep() after each logic step to
// clear the one-shot flags.
//
// Pointer positions are converted into *virtual* pixels (the 480x270 game screen),
// so nothing else in the game needs to know how big the real canvas is.

import { W, H } from '../render/renderer';

export class Input {
  /** Pointer position in virtual pixels. */
  x = -1;
  y = -1;
  /** True for one update step after the pointer was pressed. */
  clicked = false;
  /** Keys pressed since the last update step (lower-case, e.g. "m", "enter", " "). */
  private keys = new Set<string>();

  constructor(private canvas: HTMLCanvasElement) {
    canvas.addEventListener('pointermove', (e) => this.track(e));
    canvas.addEventListener('pointerdown', (e) => {
      this.track(e);
      this.clicked = true;
    });
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.key.toLowerCase());
      if (e.key === ' ') e.preventDefault(); // stop the page scrolling
    });
  }

  private track(e: PointerEvent): void {
    const box = this.canvas.getBoundingClientRect();
    this.x = ((e.clientX - box.left) / box.width) * W;
    this.y = ((e.clientY - box.top) / box.height) * H;
  }

  /** Was this key pressed since the last step? */
  pressed(key: string): boolean {
    return this.keys.has(key);
  }

  /** "Advance" = click, space or enter. Used to move dialogue along. */
  get advance(): boolean {
    return this.clicked || this.keys.has(' ') || this.keys.has('enter');
  }

  /** Is the pointer inside this rectangle (virtual pixels)? */
  over(x: number, y: number, w: number, h: number): boolean {
    return this.x >= x && this.x < x + w && this.y >= y && this.y < y + h;
  }

  /** Use up the click so that nothing else reacts to it in this step. */
  consume(): void {
    this.clicked = false;
    this.keys.delete(' ');
    this.keys.delete('enter');
  }

  /** Called by the game loop after every logic step. */
  endStep(): void {
    this.clicked = false;
    this.keys.clear();
  }
}
