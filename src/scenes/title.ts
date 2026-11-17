// The title screen: the roadhouse forecourt in the fog, and a prompt to start.
//
// A scene is just an object with update() and draw(). This is the smallest one,
// so it is a good place to see the shape before reading scenes/night.ts.

import type { Scene } from '../core/scene';
import type { Game } from '../core/game';
import { type Renderer, W, H } from '../render/renderer';
import { drawOutside, defaultRoom } from '../render/room';
import { PAL, alpha } from '../render/palette';
import { type Btn, handleButtons, drawButtons } from '../ui/widgets';
import { loadCampaign, foundEndings } from '../core/save';
import { newCampaign, type CampaignData } from '../systems/campaign';
import { NIGHT_ORDER, ENDINGS } from '../core/content';

export class TitleScene implements Scene {
  private time = 0;
  private buttons: Btn[] = [];
  /** A game in progress, if one was saved at a dawn. */
  private saved: CampaignData | null;
  private found = foundEndings();

  constructor(private game: Game) {
    const saved = loadCampaign();
    this.saved = saved && saved.night > 0 && saved.night < NIGHT_ORDER.length && !saved.ending ? saved : null;
  }

  private begin(campaign: CampaignData): void {
    // Browsers only allow sound after a click or key press, so audio starts here.
    this.game.audio.start();
    this.game.campaign = campaign;
    this.game.go('night');
  }

  update(dt: number): void {
    this.time += dt;
    this.game.audio.update(dt, { drift: 0, light: 1, scene: 'title' });
    if (this.game.scenes.busy || this.time < 0.4) return;

    const { menu } = this.game;
    const saved = this.saved;
    const items: [string, () => void][] = [];
    if (saved) {
      const night = NIGHT_ORDER[saved.night];
      items.push([`Continue  ·  Night ${night.number}: ${night.title}`, () => this.begin(saved)]);
    }
    // Starting again over a save asks first.
    items.push(['New game', () => (saved ? menu.open('confirmNew') : this.begin(newCampaign()))]);
    items.push(['How to play', () => menu.open('howto')]);
    items.push(['Settings', () => menu.open('settings')]);
    items.push([`Endings found  ${this.found.length} / ${ENDINGS.length}`, () => menu.open('endings')]);
    items.push(['Credits', () => menu.open('credits')]);
    this.buttons = items.map(([label, onClick], i) => ({ x: W / 2 - 80, y: 202 + i * 10, w: 160, h: 9, label, onClick }));
    handleButtons(this.buttons, this.game.input);
  }

  draw(r: Renderer): void {
    const g = r.g;
    // The same forecourt you see through the shop's glass, filling the screen.
    drawOutside(g, { ...defaultRoom, time: this.time }, 0, 0, W, H);
    g.fillStyle = PAL.fogDark;
    g.fillRect(0, 150, W, H - 150);
    const dark = g.createLinearGradient(0, 0, 0, H);
    dark.addColorStop(0, alpha(PAL.black, 0.75));
    dark.addColorStop(0.45, alpha(PAL.black, 0.15));
    dark.addColorStop(1, alpha(PAL.black, 0.9));
    g.fillStyle = dark;
    g.fillRect(0, 0, W, H);

    r.text('LAST SHIFT', W / 2, 140, { size: 38, bold: true, align: 'center', color: PAL.fluoro });
    r.text("CORRIGAN'S ROADHOUSE  ·  LAST FUEL FOR 80 KM", W / 2, 184, {
      size: 8, align: 'center', color: PAL.sodium,
    });
    drawButtons(r, this.buttons, this.game.input);
    r.text('Three nights  ·  five endings  ·  headphones recommended', W / 2, 263, { size: 5, align: 'center', color: PAL.inkDim });
  }
}
