// Entry point. Builds the Game object, starts the loop, shows the title screen.
//
// Read this file first, then follow the imports:
//   core/loop.ts      how update/draw are called
//   core/scene.ts     how scenes swap
//   render/renderer.ts how pixels and text reach the screen
//   scenes/*.ts       what actually happens

import { startLoop } from './core/loop';
import { SceneManager } from './core/scene';
import { Input } from './core/input';
import { Renderer } from './render/renderer';
import type { Game, EndData } from './core/game';
import { TitleScene } from './scenes/title';
import { NightScene } from './scenes/night';
import { EndScene } from './scenes/end';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const params = new URLSearchParams(location.search);

const game: Game = {
  r: new Renderer(canvas),
  input: new Input(canvas),
  scenes: new SceneManager(),
  settings: {
    reducedFlicker: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    muted: false,
  },
  debug: params.has('debug'),
  // The one place that knows which scenes exist.
  go(scene: 'title' | 'night' | 'end', data?: EndData): void {
    if (scene === 'title') game.scenes.go(new TitleScene(game));
    else if (scene === 'night') game.scenes.go(new NightScene(game));
    else if (data) game.scenes.go(new EndScene(game, data));
  },
};

game.go('title');

startLoop(
  (dt) => {
    // Keys that work everywhere.
    if (game.input.pressed('f')) game.settings.reducedFlicker = !game.settings.reducedFlicker;
    if (game.input.pressed('m')) game.settings.muted = !game.settings.muted;
    game.scenes.update(dt);
    game.input.endStep();
  },
  () => {
    game.r.begin();
    game.scenes.draw(game.r);
    game.r.fx.fade = game.scenes.fade;
    game.r.present();
  },
);

// In debug mode, expose the game to the browser console and to the playtest script.
if (game.debug) (window as unknown as { __ls: unknown }).__ls = { game };
