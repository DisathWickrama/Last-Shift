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
import type { Menu } from '../ui/menu';

export interface Settings {
  /** Softer, slower light flicker. Toggled with F; on by default if the OS asks for reduced motion. */
  reducedFlicker: boolean;
  muted: boolean;
  /** Volumes, 0..1. Music is the score and the radio song; SFX is everything else. */
  master: number;
  music: number;
  sfx: number;
  /** 0 slow, 1 normal, 2 fast, 3 instant. */
  textSpeed: number;
  /** Jolt the picture on knocks and hits. */
  shake: boolean;
  /** The first-time hint on the tool tray has been shown. */
  tipsSeen: boolean;
}

export const defaultSettings = (): Settings => ({
  reducedFlicker: false, muted: false, master: 0.9, music: 0.8, sfx: 0.9, textSpeed: 1, shake: true, tipsSeen: false,
});

/** Letters per second for each text speed setting. */
export const TEXT_SPEEDS = [28, 48, 95, 100000];
export const TEXT_SPEED_NAMES = ['Slow', 'Normal', 'Fast', 'Instant'];

/** What the end card shows. Built by the night scene when the shift is over. */
export interface EndData {
  heading: string;
  lines: string[];
  next: string;
  /** Only shown with ?debug. */
  debug?: string;
  /** Small print under the card, e.g. which endings have been found. */
  footer?: string[];
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
  /** The overlay menus: pause, settings, how to play... See ui/menu.ts. */
  menu: Menu;
  /** True when the URL has ?debug: shows the hidden numbers. */
  debug: boolean;
  /**
   * Change scene by name. Scenes call this instead of importing each other,
   * which would create circular imports (title -> night -> end -> title).
   */
  go(scene: 'title' | 'night'): void;
  go(scene: 'end', data: EndData): void;
  /** Push the current settings into the audio engine and so on. */
  applySettings(): void;
  toggleFullscreen(): void;
}
