// The Game object: the handful of things every scene needs.
//
// Rather than have scenes reach for global variables, main.ts builds one Game
// and hands it to each scene's constructor. (This is called "dependency
// injection", which is a grand name for "pass things in instead of importing
// globals". It makes it obvious what a scene depends on.)

import type { Renderer } from '../render/renderer';
import type { Input } from './input';
import type { SceneManager } from './scene';
import type { AudioEngine } from '../audio/audio';
import type { CampaignData } from '../systems/campaign';

export interface Settings {
  /** Softer, slower light flicker. Toggled with F; on by default if the OS asks for reduced motion. */
  reducedFlicker: boolean;
  muted: boolean;
}

/** What the end card shows. Built by the night scene when the shift is over. */
export interface EndData {
  heading: string;
  lines: string[];
  next: string;
  /** Only shown with ?debug. */
  debug?: string;
  /** Label on the button, and where it goes: the next night, or a fresh game. */
  button: string;
  onward: 'next' | 'newGame';
}

export interface Game {
  r: Renderer;
  input: Input;
  scenes: SceneManager;
  audio: AudioEngine;
  /** Progress through the nights: stats and flags carried forward. */
  campaign: CampaignData;
  settings: Settings;
  /** True when the URL has ?debug: shows the hidden numbers. */
  debug: boolean;
  /**
   * Change scene by name. Scenes call this instead of importing each other,
   * which would create circular imports (title -> night -> end -> title).
   */
  go(scene: 'title' | 'night'): void;
  go(scene: 'end', data: EndData): void;
}
