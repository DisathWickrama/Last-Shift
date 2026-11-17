// The overlay menus: content warning, pause, settings, how to play, endings, credits.
//
// A Menu sits on top of whatever scene is running. While a page is open,
// main.ts stops updating the scene underneath (that is all "pause" is) and
// lets the menu handle input instead. Pages are plain data built each step:
// a heading, some lines of text, and a list of buttons.
//
// Pattern: a tiny "stack" of one. Opening Settings from the pause menu
// remembers where Back should return to.

import type { Game } from '../core/game';
import { TEXT_SPEED_NAMES } from '../core/game';
import { type Renderer, W, H } from '../render/renderer';
import { PAL, alpha } from '../render/palette';
import { type Btn, handleButtons, drawButtons, drawPanel } from './widgets';
import { HOW_TO_PLAY, WARNING, CREDITS_TEXT } from './help';
import { saveSettings, foundEndings, loadCampaign, clearCampaign } from '../core/save';
import { ENDINGS, NIGHT_ORDER } from '../core/content';
import { newCampaign } from '../systems/campaign';

export type Page = 'warning' | 'pause' | 'settings' | 'howto' | 'endings' | 'credits' | 'confirmNew' | 'confirmQuit';

const BOX = { x: 70, y: 22, w: 340, h: 226 };

export class Menu {
  page: Page | null = null;
  /** True while a night is being played, so Esc can pause it. */
  pausable = false;
  private returnTo: Page | null = null;
  private buttons: Btn[] = [];
  private heading = '';
  private lines: string[] = [];

  constructor(private game: Game) {}

  /** Open a page. `returnTo` is the page Back goes to (null = close the menu). */
  open(page: Page, returnTo: Page | null = null): void {
    this.page = page;
    this.returnTo = returnTo;
  }

  private back(): void {
    this.page = this.returnTo;
    this.returnTo = null;
  }

  /** Change a setting, apply it at once and save it. */
  private set(change: () => void): void {
    change();
    this.game.applySettings();
    saveSettings(this.game.settings);
  }

  update(): void {
    const { input } = this.game;
    this.build();
    handleButtons(this.buttons, input);
    if (input.pressed('escape') && this.page && this.page !== 'warning') this.back();
  }

  /** Work out this page's heading, text and buttons from the current state. */
  private build(): void {
    const g = this.game;
    const s = g.settings;
    const cx = BOX.x + BOX.w / 2;
    const btn = (i: number, label: string, onClick: () => void, key?: string): Btn => ({
      x: cx - 80, y: BOX.y + 44 + i * 19, w: 160, h: 16, label, onClick, key,
    });
    const backBtn: Btn = { x: cx - 50, y: BOX.y + BOX.h - 24, w: 100, h: 15, label: 'Back', key: 'b', onClick: () => this.back() };
    this.lines = [];
    this.buttons = [];

    switch (this.page) {
      case 'warning':
        this.heading = 'BEFORE YOU CLOCK ON';
        this.lines = WARNING;
        this.buttons = [
          { x: cx - 122, y: BOX.y + BOX.h - 30, w: 116, h: 17, label: 'Settings', onClick: () => this.open('settings', 'warning') },
          {
            x: cx + 6, y: BOX.y + BOX.h - 30, w: 116, h: 17, label: 'I understand', key: 'enter',
            onClick: () => {
              g.audio.start(); // browsers only allow sound after a click, and this is the first one
              this.page = null;
            },
          },
        ];
        break;
      case 'pause':
        this.heading = 'PAUSED';
        this.buttons = [
          btn(0, 'Resume', () => (this.page = null), 'r'),
          btn(1, 'Settings', () => this.open('settings', 'pause')),
          btn(2, 'How to play', () => this.open('howto', 'pause')),
          btn(3, 'Quit to title', () => this.open('confirmQuit', 'pause')),
        ];
        break;
      case 'confirmQuit':
        this.heading = 'QUIT TO TITLE?';
        this.lines = ['The game saves at each dawn.', 'Tonight so far will be lost.'];
        this.buttons = [
          btn(3, 'Quit to title', () => {
            this.page = null;
            this.pausable = false;
            g.go('title');
          }),
          backBtn,
        ];
        break;
      case 'confirmNew': {
        const saved = loadCampaign();
        const night = saved ? NIGHT_ORDER[Math.min(saved.night, NIGHT_ORDER.length - 1)] : null;
        this.heading = 'START A NEW GAME?';
        this.lines = [night ? `Your saved shift (Night ${night.number}: ${night.title}) will be erased.` : 'Your saved shift will be erased.', 'Endings you have found are kept.'];
        this.buttons = [
          btn(3, 'Erase and start again', () => {
            clearCampaign();
            this.page = null;
            g.audio.start();
            g.campaign = newCampaign();
            g.go('night');
          }),
          backBtn,
        ];
        break;
      }
      case 'settings': {
        this.heading = 'SETTINGS';
        const pct = (v: number) => `${Math.round(v * 100)}%`;
        const step = (v: number, d: number) => Math.round(Math.min(1, Math.max(0, v + d)) * 10) / 10;
        // Each row: a label, the current value, and a minus and plus (or a single toggle).
        const rows: [string, string, () => void, () => void][] = [
          ['Master volume', pct(s.master), () => (s.master = step(s.master, -0.1)), () => (s.master = step(s.master, 0.1))],
          ['Music volume', pct(s.music), () => (s.music = step(s.music, -0.1)), () => (s.music = step(s.music, 0.1))],
          ['Sound effects', pct(s.sfx), () => (s.sfx = step(s.sfx, -0.1)), () => (s.sfx = step(s.sfx, 0.1))],
          ['Text speed', TEXT_SPEED_NAMES[s.textSpeed], () => (s.textSpeed = Math.max(0, s.textSpeed - 1)), () => (s.textSpeed = Math.min(3, s.textSpeed + 1))],
        ];
        rows.forEach(([label, value, minus, plus], i) => {
          const y = BOX.y + 36 + i * 19;
          this.lines[i] = `${label.padEnd(16)}${value.padStart(8)}`;
          this.buttons.push({ x: BOX.x + 232, y, w: 22, h: 15, label: '-', onClick: () => this.set(minus) });
          this.buttons.push({ x: BOX.x + 258, y, w: 22, h: 15, label: '+', onClick: () => this.set(plus) });
        });
        const toggles: [string, boolean, () => void][] = [
          ['Softer flicker', s.reducedFlicker, () => (s.reducedFlicker = !s.reducedFlicker)],
          ['Screen shake', s.shake, () => (s.shake = !s.shake)],
          ['Fullscreen', !!document.fullscreenElement, () => g.toggleFullscreen()],
        ];
        toggles.forEach(([label, on, flip], i) => {
          const y = BOX.y + 36 + (rows.length + i) * 19;
          this.lines[rows.length + i] = label;
          this.buttons.push({ x: BOX.x + 232, y, w: 48, h: 15, label: on ? 'On' : 'Off', color: on ? PAL.fluoro : PAL.inkDim, onClick: () => this.set(flip) });
        });
        this.buttons.push(backBtn);
        break;
      }
      case 'howto':
        this.heading = 'HOW TO PLAY';
        this.lines = HOW_TO_PLAY;
        this.buttons = [backBtn];
        break;
      case 'endings': {
        const found = foundEndings();
        this.heading = `ENDINGS FOUND  ${found.length} OF ${ENDINGS.length}`;
        this.lines = ENDINGS.flatMap((e) => (found.includes(e.id) ? [e.title.toUpperCase(), `  ${e.card[e.card.length - 1]}`, ''] : ['? ? ?', '  not found yet', '']));
        this.buttons = [backBtn];
        break;
      }
      case 'credits':
        this.heading = 'CREDITS';
        this.lines = CREDITS_TEXT;
        this.buttons = [backBtn];
        break;
    }
  }

  draw(r: Renderer): void {
    if (!this.page) return;
    const g = r.g;
    g.fillStyle = alpha(PAL.black, this.page === 'warning' ? 1 : 0.8);
    g.fillRect(0, 0, W, H);
    drawPanel(g, BOX.x, BOX.y, BOX.w, BOX.h);
    r.text(this.heading, BOX.x + BOX.w / 2, BOX.y + 10, { size: 11, bold: true, align: 'center', color: PAL.fluoro });
    if (this.page === 'settings') {
      // settings rows line up with their buttons
      this.lines.forEach((line, i) => r.text(line, BOX.x + 40, BOX.y + 40 + i * 19, { size: 7, color: PAL.ink }));
    } else {
      const size = this.lines.length > 12 ? 6 : 7;
      const gap = this.lines.length > 12 ? 9 : 11;
      const centred = this.page === 'warning' || this.page === 'confirmNew' || this.page === 'confirmQuit';
      this.lines.forEach((line, i) => {
        const y = BOX.y + 34 + i * gap;
        if (centred) r.text(line, BOX.x + BOX.w / 2, y, { size, align: 'center', color: PAL.ink });
        else r.text(line, BOX.x + 22, y, { size, color: /^[A-Z ?]+(\(|$)/.test(line) ? PAL.sodium : PAL.ink });
      });
    }
    drawButtons(r, this.buttons, this.game.input);
  }
}
