# Last Shift

A slow-burn psychological horror game about the night shift at an isolated mountain roadhouse. Fog has come down the pass, and some of the travellers walking out of it are not people any more. Check their wrists, their reflection, their shadow and their small talk. Then decide who gets served.

**Play it:** https://disathwickrama.github.io/Last-Shift/

The full game is three nights and five endings: about 30 to 40 minutes a run. Headphones help. The game saves at each dawn, so you can stop between nights and continue later.

- **Night 1, Last Fuel:** wrists and reflections.
- **Night 2, Familiar Faces:** shadows, small talk, and people you have met before.
- **Night 3, Last Shift:** the last human on the mountain, and what you do with them.

Who comes back, what Wren says and which ending you get all depend on what you did on earlier nights. One ending is hidden on Night 2.

Built with Vite + TypeScript + HTML Canvas. No game engine and no asset files: every picture is drawn in code and every sound is synthesised.

## How to play

- Click (or press Space) to move dialogue along. Hold **Shift** to fast-forward.
- With a visitor at the counter, use the tray on the right. Point at any button to see what it does:
  - **Wrists**, **Reflection**, **Shadow**: look for what the radio told you to look for. Each costs time and patience.
  - **Small talk**: ask questions. How you ask matters.
  - **Serve**, **Turn away**, **Shelter**: decide. Wren has opinions, and the only key.
- Click Wren to ask what they think.
- **Esc** (or the `II` in the corner) opens the pause menu: settings, how to play, quit to title.
- Settings are saved: master, music and effects volume, text speed, softer flicker, screen shake, fullscreen.
- At 6 am the radio reads out what your choices did.

Keys: `1`–`4` for the checks, `Q` `W` `E` for the decisions, `B` to step back from a close-up.

## Run it locally

```bash
npm install
npm run dev
```

Open the address Vite prints (usually http://localhost:5173).

```bash
npm test
```

runs the unit tests, including one that plays all three nights with no screen and checks every ending can be reached.

```bash
npm run build
```

type-checks and builds the production site into `dist/`.

Add `?debug` to the URL to see the hidden stats (Humanity, Bond, Slip), each visitor's drift and patience, who is a mimic, and what Wren wants.

## Read the code

Start with `docs/ARCHITECTURE.md`: it walks through the code in reading order. Every source file opens with a comment saying what it is for.

| Path | What is there |
| --- | --- |
| `DESIGN.md` | the game design |
| `docs/ARCHITECTURE.md` | how the code fits together |
| `CLAUDE.md` | the rules this codebase follows |
| `content/` | all story text and data, as JSON |
| `src/systems/` | game rules, with no drawing in them |
| `src/render/` | drawing, with no rules in it |
| `src/scenes/` | title, night, end card |
| `tests/` | unit tests and content checks |

## Add to the story without writing code

- An ending: add an entry to `content/endings.json` (the first whose `if` holds wins).
- A new visitor: copy a file in `content/visitors/`, change the `id`, and add `{ "type": "visitor", "visitor": "<id>", "at": "03:20" }` to a night's `timeline`.
- A new quiet moment: add a script to `scripts` in the night file and a `{ "type": "script", "script": "<name>" }` entry to the timeline.
- `npm test` checks the JSON for missing lines and broken references.

## Deploy

Every push to `main` (and to the working branch) is built, tested and published to GitHub Pages by `.github/workflows/deploy.yml`.

## Credits

See `CREDITS.md`. There are no third-party assets.
