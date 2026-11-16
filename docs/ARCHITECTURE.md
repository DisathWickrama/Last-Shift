# How Last Shift is built

This file is the guided tour. It grows with the code. Read it top to bottom once, then open the files it names: each one starts with a comment explaining its job.

## The big picture

```
            ┌──────────────┐
 browser →  │  main.ts     │  builds the Game object, starts the loop
            └──────┬───────┘
                   │ 60 times a second
        ┌──────────▼──────────┐
        │  core/loop.ts       │  update(dt) … update(dt) … draw()
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────┐
        │  core/scene.ts      │  exactly one scene is active
        └──────────┬──────────┘
        title ─► night ─► end card         (src/scenes/)
                   │
     ┌─────────────┼──────────────┐
     ▼             ▼              ▼
 systems/       render/         content/
 rules, no      pixels, no      story as JSON
 drawing        rules
```

Three ideas carry the whole design.

### 1. Data in, pixels out

`src/systems/` holds the rules of the game: how drift changes a face, what an inspection costs, how a decision moves the hidden stats. Nothing in there touches the canvas, so every rule can be unit-tested with plain numbers.

`src/render/` is the opposite: it is handed a description of what to draw (a `FaceParams`, a `RoomState`) and draws it. It decides nothing.

Scenes sit in the middle. Each frame a scene asks the systems "what is true now?" and hands the answer to the renderers.

### 2. A face is a list of numbers

`render/face.ts` defines `FaceParams`: about thirty sliders (eye spacing, brow tilt, mouth width, which side the hair parts on…).

- `generateFace(seed)` fills the sliders from a seeded random number generator, so `"dale"` is always the same man.
- `drawFace(g, params)` turns the sliders into shapes.
- `systems/drift.ts` → `applyDrift(face, drift, tells)` returns a copy of the sliders with a few of them nudged. That is the entire horror mechanic: the drawing code never knows a mimic exists.
- `render/faceview.ts` → `FaceView` adds the moving parts (blinking, eye direction, talking) and eases slowly from the face it is showing towards the face it is told to show, so drift creeps instead of jumping. One exception: hair cannot slide across a head, so the parting swaps sides only during a blink or while you are looking at something else.

### 3. A night is a state machine fed by JSON

*(arrives in a later chunk; this section will be filled in then)*

## How a frame reaches the screen

`render/renderer.ts` keeps two canvases.

1. Scenes draw shapes on a hidden **480×270** canvas. Every position in the game is in these "virtual pixels", whatever the size of the window.
2. `present()` copies that canvas to the visible one, enlarged with smoothing off, which gives the chunky lo-fi look.
3. Text is queued during drawing and painted afterwards at full resolution, because tiny pixelated text is unreadable.
4. `render/filters.ts` runs post-processing at both stages (for now only the fade to black).

## The loop

`core/loop.ts` uses a **fixed timestep**: game logic always advances in steps of exactly 1/60 s, however fast the monitor refreshes. If a frame took longer, logic runs twice to catch up. This keeps the game the same speed on every machine.

`core/input.ts` turns browser events into simple flags the logic can poll once per step (`clicked`, `pressed('m')`, pointer position in virtual pixels).

## Randomness

`core/rng.ts` is a small seeded generator (mulberry32). Anything the player could notice changing between runs (faces, vein patterns, which tells a mimic has) uses it. `Math.random()` is only allowed for throwaway noise such as flicker.

## Folder map

| Folder | Job |
| --- | --- |
| `src/core/` | loop, scene manager, input, RNG, the shared `Game` object |
| `src/render/` | renderer, palette, face generator, face view, room, filters |
| `src/systems/` | pure game rules (so far: drift) |
| `src/scenes/` | title screen, night |
| `content/` | story data as JSON (so far empty) |
| `tests/` | unit tests for `systems/` |
