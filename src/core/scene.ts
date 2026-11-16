// Scenes and the scene manager.
//
// Pattern: "scene manager" (a small state machine). The game is always in exactly
// one scene: the title screen, a night, or the end card. Each scene knows how to
// update and draw itself. The manager holds the current one and swaps it with a
// fade to black, so scenes never need to know about each other's insides.

import type { Renderer } from '../render/renderer';

export interface Scene {
  /** Called once when the scene becomes the current one. */
  enter?(): void;
  /** Called once when the scene is being replaced. */
  exit?(): void;
  /** Game logic. dt is seconds, always 1/60. */
  update(dt: number): void;
  /** Paint the scene. */
  draw(r: Renderer): void;
}

const FADE_SECONDS = 0.6;

export class SceneManager {
  private current: Scene | null = null;
  private next: Scene | null = null;
  /** 0 = fully visible, 1 = fully black. Read by the renderer. */
  fade = 1;

  /** Ask for a scene change. It happens after the screen has faded out. */
  go(scene: Scene): void {
    this.next = scene;
  }

  get busy(): boolean {
    return this.next !== null;
  }

  update(dt: number): void {
    if (this.next) {
      // Fade out, then swap.
      this.fade = Math.min(1, this.fade + dt / FADE_SECONDS);
      if (this.fade >= 1) {
        this.current?.exit?.();
        this.current = this.next;
        this.next = null;
        this.current.enter?.();
      }
    } else if (this.fade > 0) {
      this.fade = Math.max(0, this.fade - dt / FADE_SECONDS);
    }
    this.current?.update(dt);
  }

  draw(r: Renderer): void {
    this.current?.draw(r);
  }
}
