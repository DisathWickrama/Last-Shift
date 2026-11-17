// The end card: shown when the shift is over.
//
// It is handed everything it needs as `EndData` (see core/game.ts), so it knows
// nothing about how a night works.

import type { Scene } from '../core/scene';
import type { Game, EndData } from '../core/game';
import { type Renderer, W, H } from '../render/renderer';
import { PAL } from '../render/palette';
import { type Btn, handleButtons, drawButtons } from '../ui/widgets';
import { newCampaign } from '../systems/campaign';

export class EndScene implements Scene {
  private time = 0;
  private buttons: Btn[] = [];

  constructor(private game: Game, private data: EndData) {}

  update(dt: number): void {
    this.time += dt;
    this.game.audio.update(dt, { drift: 0, light: 1, scene: 'end' });
    this.buttons = this.time > 1.5
      ? [{
          x: W / 2 - 70, y: 226, w: 140, h: 16, label: this.data.button,
          onClick: () => {
            if (this.data.onward === 'newGame') this.game.campaign = newCampaign();
            this.game.go(this.data.onward === 'newGame' ? 'title' : 'night');
          },
        }]
      : [];
    if (!this.game.scenes.busy) handleButtons(this.buttons, this.game.input);
  }

  draw(r: Renderer): void {
    r.g.fillStyle = PAL.black;
    r.g.fillRect(0, 0, W, H);
    r.text(this.data.heading, W / 2, 34, { size: 16, bold: true, align: 'center', color: PAL.fluoro });
    let y = 70;
    for (const line of this.data.lines) {
      for (const part of r.wrap(line, 380, 8)) {
        r.text(part, W / 2, y, { size: 8, align: 'center', color: PAL.ink });
        y += 11;
      }
      y += 6;
    }
    r.text(this.data.next, W / 2, 206, { size: 7, align: 'center', color: PAL.sodium });
    drawButtons(r, this.buttons, this.game.input);
    if (this.game.debug && this.data.debug) {
      r.text(this.data.debug, W / 2, 254, { size: 6, align: 'center', color: PAL.inkDim });
    }
  }
}
