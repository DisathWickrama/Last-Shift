# Last Shift — project rules

Slow-burn psychological horror browser game. The design lives in `DESIGN.md`; read it before changing anything that touches story, tone or mechanics.

## Stack

- **Vite + TypeScript (strict) + HTML Canvas 2D.** No game engine, no UI framework, no runtime dependencies.
- Everything visible is drawn in code and every sound is synthesised with Web Audio. The default number of asset files is zero.

## Hard rules

1. **Story content is data.** Visitors, dialogue, nights, Wren's lines and radio broadcasts live in JSON under `content/`. TypeScript never contains story text. Adding Night 2 should mean writing JSON, not code.
2. **Small commits, clear messages.** One idea per commit. The message says what changed and why.
3. **Assets need a licence.** Any third-party font, sound or image must be CC0 or similarly free, and must be listed in `CREDITS.md` with its source and licence in the same commit that adds it.
4. **Explain the architecture as you go.** The repo owner is an IT student learning from this code.
   - Every source file starts with a header comment: what the file is for and how it fits in.
   - Comments explain *why*, and name the pattern being used (state machine, command queue, seeded RNG…).
   - `docs/ARCHITECTURE.md` is updated whenever a module is added or its job changes.
5. **Logic and drawing stay apart.** `src/systems/` is pure logic: no canvas, no DOM, no audio. It must be unit-testable. `src/render/` only draws the state it is handed.
6. **Deterministic by seed.** Anything random (faces, veins, drift) comes from the seeded RNG in `src/core/rng.ts`, never `Math.random()`, so a visitor looks the same every run. (Purely cosmetic noise such as flicker and static may use `Math.random()`.)

## Tone rules (from DESIGN.md)

- Palette: fluoro green-white inside, sodium orange from the pumps, fog grey outside. **Deep red is reserved for gore and nothing else.**
- Gore is short, glitchy flashes and dawn aftermath. Implied more than shown.
- Drift is subtle. If a mimic's face change is obvious at a glance, it is too strong.
- Never state the twist. Plant clues; let the player join them up.

## Commands

```bash
npm install        # once
npm run dev        # local dev server with hot reload
npm test           # unit tests (Vitest)
npm run build      # strict type-check, then production build into dist/
npm run preview    # serve the production build locally
npm run playtest   # optional: headless browser playthrough (needs Playwright; dev server must be running)
```

Add `?debug` to the URL to show the hidden stats, drift and patience.

## Folder map

```
index.html
src/
  main.ts        boot: build the Game object, start the loop
  core/          game loop, scene manager, input, seeded RNG, content types + loader, save
  render/        renderer (low-res canvas + text), face generator, room, close-ups, filters
  systems/       drift, inspections, clock, stats, night state machine, campaign, Wren, dawn report
  ui/            buttons, dialogue box, choice list, overlay menus, help text
  audio/         Web Audio ambience, stings, radio song
  scenes/        title, night, end card, haunt (when the shop misbehaves)
content/
  nights/        one JSON file per night (timeline + scripts + dawn report)
  endings.json   the endings, in priority order
  self.json      the player's own face
  visitors/      one JSON file per visitor
  wren.json      Wren's face and reactive lines
tests/           Vitest unit tests for systems/ and content validation
scripts/         playtest.cjs (browser smoke test)
docs/            ARCHITECTURE.md
```

## Deploy

GitHub Actions builds and publishes to GitHub Pages on every push to the working branch and to `main` (`.github/workflows/deploy.yml`). Vite uses a relative base path so the build works from any sub-folder.
