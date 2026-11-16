// The title screen: the roadhouse forecourt in the fog, and a prompt to start.
//
// A scene is just an object with update() and draw(). This is the smallest one,
// so it is a good place to see the shape before reading scenes/night.ts.

import type { Scene } from '../core/scene';
import type { Game } from '../core/game';
import { type Renderer, W, H } from '../render/renderer';
import { drawOutside, defaultRoom } from '../render/room';
import { PAL, alpha } from '../render/palette';
import { NightScene } from './night';

export class TitleScene implements Scene {
  private time = 0;

  constructor(private game: Game) {}

  update(dt: number): void {
    this.time += dt;
    if (this.game.input.advance && !this.game.scenes.busy && this.time > 0.4) {
      this.game.scenes.go(new NightScene(this.game));
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
    const pulse = 0.55 + 0.45 * Math.sin(this.time * 2.4);
    r.text('click to clock on', W / 2, 218, { size: 9, align: 'center', color: PAL.ink, alpha: pulse });
    r.text('Night 1 of 5  ·  headphones recommended  ·  flickering lights and horror themes', W / 2, 246, {
      size: 6, align: 'center', color: PAL.inkDim,
    });
    r.text('F  softer flicker      M  mute', W / 2, 256, { size: 6, align: 'center', color: PAL.inkDim });
  }
}
