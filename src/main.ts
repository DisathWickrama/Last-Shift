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
import { AudioEngine } from './audio/audio';
import { newCampaign } from './systems/campaign';
import { type Game, type EndData, defaultSettings } from './core/game';
import { Menu } from './ui/menu';
import { loadSettings, saveSettings } from './core/save';
import { setUiSounds } from './ui/widgets';
import { W } from './render/renderer';
import { PAL } from './render/palette';
import { TitleScene } from './scenes/title';
import { NightScene } from './scenes/night';
import { EndScene } from './scenes/end';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const params = new URLSearchParams(location.search);

const game: Game = {
  r: new Renderer(canvas),
  input: new Input(canvas),
  scenes: new SceneManager(),
  audio: new AudioEngine(),
  campaign: newCampaign(),
  // Saved settings, laid over defaults (softer flicker starts on if the OS asks for reduced motion).
  settings: loadSettings({
    ...defaultSettings(),
    reducedFlicker: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  }),
  menu: null as unknown as Menu, // created just below, because it needs the game object
  debug: params.has('debug'),
  // The one place that knows which scenes exist.
  go(scene: 'title' | 'night' | 'end', data?: EndData): void {
    if (scene === 'title') game.scenes.go(new TitleScene(game));
    else if (scene === 'night') game.scenes.go(new NightScene(game));
    else if (data) game.scenes.go(new EndScene(game, data));
  },
  applySettings(): void {
    const s = game.settings;
    game.audio.setVolumes(s.muted ? 0 : s.master, s.music, s.sfx);
  },
  toggleFullscreen(): void {
    // Allowed because this runs straight after the player's click.
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  },
};
game.menu = new Menu(game);
game.applySettings();
// Every button in the game ticks on hover and clicks on press.
setUiSounds(() => game.audio.sting('hover'), () => game.audio.sting('click'));

game.go('title');
// The first thing anyone sees is the content warning. (Skipped by the automated playtest.)
if (!params.has('nowarn')) game.menu.open('warning');

startLoop(
  (dt) => {
    // Keys that work everywhere.
    if (game.input.pressed('f')) {
      game.settings.reducedFlicker = !game.settings.reducedFlicker;
      saveSettings(game.settings);
    }
    if (game.input.pressed('m')) {
      game.settings.muted = !game.settings.muted;
      game.applySettings();
      saveSettings(game.settings);
    }
    const { menu, input } = game;
    if (menu.page) {
      // A menu is open: the scene underneath is frozen. That is all "pause" is.
      menu.update();
    } else {
      // Esc, or the small button in the corner (for touch screens), pauses a night.
      const corner = input.clicked && input.over(W - 34, 0, 34, 22); // generous, for thumbs
      if (menu.pausable && !game.scenes.busy && (input.pressed('escape') || corner)) {
        input.consume();
        menu.open('pause');
      } else {
        game.scenes.update(dt);
      }
    }
    game.input.endStep();
  },
  () => {
    game.r.begin();
    game.scenes.draw(game.r);
    if (game.menu.pausable && !game.menu.page && !game.debug) {
      game.r.text('II', W - 12, 5, { size: 7, bold: true, align: 'center', color: PAL.inkDim }); // pause button
    }
    if (game.menu.page) game.r.clearText(); // the scene's text must not show through the menu
    game.menu.draw(game.r);
    game.r.fx.fade = game.menu.page ? 0 : game.scenes.fade;
    game.r.present();
  },
);

// In debug mode, expose the game to the browser console and to the playtest script.
if (game.debug) (window as unknown as { __ls: unknown }).__ls = { game };
