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
import { loadCampaign, clearCampaign, foundEndings } from '../core/save';
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
    this.game.audio.sting('click');
    this.game.campaign = campaign;
    this.game.go('night');
  }

  update(dt: number): void {
    this.time += dt;
    this.game.audio.update(dt, { drift: 0, light: 1, scene: 'title' });
    if (this.game.scenes.busy || this.time < 0.4) return;

    if (this.saved) {
      const saved = this.saved;
      const night = NIGHT_ORDER[saved.night];
      this.buttons = [
        { x: W / 2 - 80, y: 212, w: 160, h: 15, label: `Continue  ·  Night ${night.number}: ${night.title}`, onClick: () => this.begin(saved) },
        {
          x: W / 2 - 80, y: 229, w: 160, h: 13, label: 'New game', color: PAL.inkDim,
          onClick: () => {
            clearCampaign();
            this.begin(newCampaign());
          },
        },
      ];
      handleButtons(this.buttons, this.game.input);
    } else if (this.game.input.advance) {
      this.begin(newCampaign());
    }
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

    r.text('LAST SHIFT', W / 2, 150, { size: 38, bold: true, align: 'center', color: PAL.fluoro });
    r.text("CORRIGAN'S ROADHOUSE  ·  LAST FUEL FOR 80 KM", W / 2, 192, {
      size: 8, align: 'center', color: PAL.sodium,
    });
    if (this.saved) {
      drawButtons(r, this.buttons, this.game.input);
    } else {
      const pulse = 0.55 + 0.45 * Math.sin(this.time * 2.4);
      r.text('click to clock on', W / 2, 218, { size: 9, align: 'center', color: PAL.ink, alpha: pulse });
    }
    const endings = this.found.length > 0 ? `  ·  endings found ${this.found.length} of ${ENDINGS.length}` : '';
    r.text(`Three nights  ·  headphones recommended  ·  flickering lights and horror themes${endings}`, W / 2, 246, {
      size: 6, align: 'center', color: PAL.inkDim,
    });
    const { reducedFlicker, muted } = this.game.settings;
    r.text(`F  softer flicker: ${reducedFlicker ? 'on' : 'off'}      M  sound: ${muted ? 'off' : 'on'}`, W / 2, 256, {
      size: 6, align: 'center', color: PAL.inkDim,
    });
  }
}
