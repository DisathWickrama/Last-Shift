// The Game object: the handful of things every scene needs.
//
// Rather than have scenes reach for global variables, main.ts builds one Game
// and hands it to each scene's constructor. (This is called "dependency
// injection", which is a grand name for "pass things in instead of importing
// globals". It makes it obvious what a scene depends on.)

import type { Renderer } from '../render/renderer';
import type { Input } from './input';
import type { SceneManager } from './scene';

export interface Settings {
  /** Softer, slower light flicker. Toggled with F; on by default if the OS asks for reduced motion. */
  reducedFlicker: boolean;
  muted: boolean;
}

export interface Game {
  r: Renderer;
  input: Input;
  scenes: SceneManager;
  settings: Settings;
  /** True when the URL has ?debug: shows the hidden numbers. */
  debug: boolean;
}
