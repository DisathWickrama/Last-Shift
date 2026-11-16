# Last Shift

A slow-burn psychological horror game about the night shift at an isolated mountain roadhouse. Fog has come down the pass, and some of the travellers walking out of it are not people any more. Check their wrists, their reflection, their shadow and their small talk. Then decide who gets served.

**Play it:** https://disathwickrama.github.io/Last-Shift/

Night 1 of 5 is playable from start to finish: about 10 to 15 minutes. Headphones help.

Built with Vite + TypeScript + HTML Canvas. No game engine and no asset files: every picture is drawn in code and every sound is synthesised.

## How to play

- Click (or press Space) to move dialogue along.
- With a visitor at the counter, use the tray on the right:
  - **Wrists**, **Reflection**, **Shadow**: look for what the radio told you to look for. Each costs time and patience.
  - **Small talk**: ask questions. How you ask matters.
  - **Serve**, **Turn away**, **Shelter**: decide. Wren has opinions, and the only key.
- Click Wren to ask what they think.
- **M** mutes. **F** softens the light flicker.
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

runs the unit tests, including one that plays the whole of Night 1 with no screen.

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

- A new visitor: copy a file in `content/visitors/`, change the `id`, and add `{ "type": "visitor", "visitor": "<id>", "at": "03:20" }` to a night's `timeline`.
- A new quiet moment: add a script to `scripts` in the night file and a `{ "type": "script", "script": "<name>" }` entry to the timeline.
- `npm test` checks the JSON for missing lines and broken references.

## Deploy

Every push to `main` (and to the working branch) is built, tested and published to GitHub Pages by `.github/workflows/deploy.yml`.

## Credits

See `CREDITS.md`. There are no third-party assets.
