# Credits

**Last Shift** — design by Disath Wickrama. See `DESIGN.md`.

## Third-party assets

None.

Every picture in the game is drawn in code on an HTML canvas, and every sound is synthesised with the Web Audio API. There are no image, audio or font files in this repository. Text uses whatever monospace font the player's system provides (`Courier New` where available).

If an asset is ever added, it must be listed here in the same commit, like this:

| Asset | Used for | Source | Licence |
| --- | --- | --- | --- |
| *(example)* `door-bell.ogg` | door bell | https://kenney.nl/assets/… | CC0 1.0 |

## Tools

Built with [Vite](https://vitejs.dev/) (MIT) and [TypeScript](https://www.typescriptlang.org/) (Apache-2.0); tested with [Vitest](https://vitest.dev/) (MIT). These are development tools only: none of their code ships in the game.
