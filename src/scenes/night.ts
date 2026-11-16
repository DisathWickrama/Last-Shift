// The night scene (first version): the counter, one visitor, and live drift.
//
// This version exists to show the face generator working. A stranger walks in;
// each click pushes their drift up a step, and you can watch the face go
// subtly wrong. Later chunks replace the clicking with real inspections.

import type { Scene } from '../core/scene';
import type { Game } from '../core/game';
import { type Renderer } from '../render/renderer';
import { drawRoomBack, drawRoomFront, defaultRoom, VISITOR_SPOT, type RoomState } from '../render/room';
import { generateFace } from '../render/face';
import { FaceView } from '../render/faceview';
import { drawTinted } from '../render/layer';
import { applyDrift, ALL_TELLS, type DriftTell } from '../systems/drift';
import { Rng, clamp, lerp, smooth } from '../core/rng';
import { PAL } from '../render/palette';

export class NightScene implements Scene {
  private room: RoomState = { ...defaultRoom };
  private visitor!: FaceView;
  private tells: DriftTell[] = [];
  private drift = 0;
  /** 0 = at the door, 1 = at the counter. */
  private walk = 0;
  private count = 0;

  constructor(private game: Game) {
    this.nextVisitor();
  }

  private nextVisitor(): void {
    this.count++;
    const seed = `stranger-${this.count}`;
    this.visitor = new FaceView(generateFace(seed), seed);
    // Each stranger gets three tells, chosen by the same seed.
    const rng = new Rng(seed + '-tells');
    const pool = ALL_TELLS.filter((t) => t !== 'hairFlip' || !['bald', 'cap', 'beanie'].includes(this.visitor.base.hair));
    this.tells = [];
    while (this.tells.length < 3) {
      const t = rng.pick(pool);
      if (!this.tells.includes(t)) this.tells.push(t);
    }
    this.drift = 0;
    this.walk = 0;
  }

  update(dt: number): void {
    const { input } = this.game;
    this.room.time += dt;
    this.walk = clamp(this.walk + dt / 2.4, 0, 1);
    this.room.doorOpen = this.walk < 0.5 ? smooth(this.walk * 4) : smooth((1 - this.walk) * 2);

    if (this.walk >= 1 && (input.clicked || input.pressed(']'))) {
      this.drift += 0.2;
      if (this.drift > 1.01) this.nextVisitor();
    }
    if (input.pressed('[')) this.drift = 0;
    if (input.pressed('n')) this.nextVisitor();

    const target = applyDrift(this.visitor.base, this.drift, this.tells);
    this.visitor.update(dt, target, {
      lookX: (input.x - VISITOR_SPOT.x) / 200,
      lookY: (input.y - VISITOR_SPOT.y) / 150,
      stare: this.drift,
    });
  }

  draw(r: Renderer): void {
    const g = r.g;
    drawRoomBack(g, this.room);

    // Walking in: the visitor starts small and dark at the door, and grows as they approach.
    const t = smooth(this.walk);
    const scale = lerp(0.42, 1, t);
    const y = lerp(104, VISITOR_SPOT.y, t);
    g.save();
    g.beginPath();
    g.rect(0, 0, 480, 196); // nothing below the counter line
    g.clip();
    drawTinted(g, (l) => this.visitor.draw(l, VISITOR_SPOT.x, y, scale), PAL.fogDark, (1 - t) * 0.85);
    g.restore();

    drawRoomFront(g, this.room);

    r.text(`drift ${this.drift.toFixed(1)}   tells: ${this.tells.join(', ')}`, 8, 232, { color: PAL.inkDim, size: 7 });
    r.text('click: more drift    [ : reset    N : next stranger', 8, 246, { color: PAL.ink, size: 8 });
  }
}
