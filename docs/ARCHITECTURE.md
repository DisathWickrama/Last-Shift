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

`systems/night.ts` → `NightState` is the model of one night: the clock, the hidden stats, the visitor at the counter (their drift and patience), and a log of how each visit ended. It reads a night file (`content/nights/night1.json`) whose `timeline` lists what happens in order, and visitor files (`content/visitors/*.json`) that hold each person's face, tells, dialogue and outcomes.

`scenes/night.ts` → `NightScene` presents that model. It uses a **command queue**: anything that must happen in order (say a line, wait for a click, walk to the door, finish the visit) is pushed onto a list of small steps and worked through one at a time.

```
queue has steps          → the game is "talking": show lines, play walks
queue empty, visitor in  → the player's turn: buttons appear
queue empty, nobody in   → ask NightState for the next timeline event
```

One player action, traced end to end (clicking **Wrists**):

1. `ui/widgets.ts` `handleButtons` sees the click and runs the button's `onClick`.
2. `NightScene.check('wrist')` calls `NightState.inspect('wrist')`.
3. `inspect` looks up the cost in `systems/inspections.ts`, advances the clock, adds drift if a mimic is present, takes patience, and returns a status (`ok`, `annoyed`, `walkout`, `break`).
4. The scene switches to the wrist close-up. `render/closeups.ts` draws the arms, reading the visitor's `tells.veins` from their JSON to decide what the veins look like.
5. Meanwhile, every step, `animate()` asks `applyDrift` for the face the visitor should have now and passes it to their `FaceView`, so when you step back the face may have moved on.
6. On **Step back**, the scene acts on the status: an annoyed line, a walk-out, or the mask slipping.

## How a frame reaches the screen

`render/renderer.ts` keeps two canvases.

1. Scenes draw shapes on a hidden **480×270** canvas. Every position in the game is in these "virtual pixels", whatever the size of the window.
2. `present()` copies that canvas to the visible one, enlarged with smoothing off, which gives the chunky lo-fi look.
3. Text is queued during drawing and painted afterwards at full resolution, because tiny pixelated text is unreadable.
4. `render/filters.ts` runs post-processing at both stages:
   - on the small canvas: glitch (horizontal strips copied sideways), the deep-red gore wash, and **ordered dithering** (a 4×4 Bayer matrix nudges each pixel before it is rounded to a coarse shade, turning smooth gradients into a cross-hatch);
   - on the big canvas, over the text: scanlines and a vignette (painted once and cached), then the fade to black.

`render/flicker.ts` decides how bright the tubes are each moment. Bursts of stutter get more frequent and deeper as the clock runs. With **F** (or the OS "reduce motion" setting) a burst becomes one slow shallow dip instead. Room colours go through a helper that darkens them by the current light level; things that make their own light (the fridge, the pumps) skip it, so when the tubes cut out the shop is lit by the fridge and the sodium lamps.

## The haunting

`scenes/haunt.ts` decides *when* the shop does something by itself; the night scene shows it. Each night file has a `dread` value (0.15, 0.5, 1). Dread and the hour set a level; the level sets how often an event fires and which are allowed:

| Event | What you get |
| --- | --- |
| `tear` | a split-second tear across the picture (more often with high Slip) |
| `figure` | somebody standing by the pumps; each visit a little nearer, as far as tonight's dread allows |
| `glass` | knocking on the shop window |
| `whisper` | the CB replays a line you actually said tonight (from `NightState.said`) |
| `blackout` | the tubes go out for a couple of seconds; on the last night the figure is at the glass when they do |
| `flash` | a drifting mimic's face slips for a single frame |

None of it touches the rules. The mirror close-up also takes the dread value: on later nights Wren's reflection turns to watch you, and on the last night the blank where you should be has a face.

## Sound

`audio/audio.ts` builds everything from Web Audio nodes; there are no sound files.

- **Beds** run all the time and the game only turns their volume up and down: tube buzz (follows the flicker), fridge hum, wind (noise through a wandering band-pass filter), radio static, and the **drift drone**: two low tones a few hertz apart that swell with the visitor's drift, joined by a thin sour pair when drift is high.
- **Stings** are built on demand and discarded: the door bell, knocks, the mask-slip, and a "voice" blip for every third letter of dialogue, with a pitch per speaker.
- The **radio song** is a short waltz stored as numbers and scheduled a quarter of a second ahead so the rhythm stays even, played flat and through a small-speaker filter.

- The **score** is one recipe per night (`SCORES` in `audio.ts`, chosen by `score` in the night file): a dark three-note pad that slides between chords, bell tones at random, and on later nights a heartbeat that quickens with drift and a far-off metallic scrape. Night 1 is open and sad, Night 2 leans on a tritone, Night 3 is a cluster of semitones. Wren's song gets flatter each night and starts dropping wrong notes.
- **Footsteps** follow visitors in and out, a **breathing** bed rises when the figure is near, in a blackout, or when a mask is close to slipping, and there are stings for revelations (`boom`, `rise`).

Browsers block sound until the player interacts, so `start()` is called from the title screen's click. `NightScene.animate()` calls `audio.update()` every step with the current drift and light.

## The loop

`core/loop.ts` uses a **fixed timestep**: game logic always advances in steps of exactly 1/60 s, however fast the monitor refreshes. If a frame took longer, logic runs twice to catch up. This keeps the game the same speed on every machine.

`core/input.ts` turns browser events into simple flags the logic can poll once per step (`clicked`, `pressed('m')`, pointer position in virtual pixels).

## Randomness

`core/rng.ts` is a small seeded generator (mulberry32). Anything the player could notice changing between runs (faces, vein patterns, which tells a mimic has) uses it. `Math.random()` is only allowed for throwaway noise such as flicker.

## Scripts: quiet moments, the radio, dawn

Not everything in a night is a visitor. The radio tutorial, the scone, the smoke break, the storeroom and the noticeboard are **scripts**: lists of "beats" in the night's JSON.

```json
{ "who": "wren", "text": "You're not going to eat that." },
{ "choice": [
    { "text": "I'm not hungry.", "slip": 1, "then": [ { "who": "wren", "text": "No. We never are, on nights." } ] },
    { "text": "You have it.",    "bond": 1, "then": [ ... ] }
] }
```

A beat is either a line or a choice. A line can carry:

| Field | Effect |
| --- | --- |
| `if` | only play when a condition on flags or stats holds (`{ "flag": "mimicInBack" }`, `{ "minBond": 2 }`) |
| `fx` | fire a named effect: `static`, `radioOff`, `knock`, `glitch`, `gore`, `dark`, `lights`, `song`, `songOff`, `photo` |
| `set` / `clear` | set or clear a flag |
| `bond` / `slip` / `humanity` | move a hidden stat |

`NightScene.scriptSteps()` turns beats into queue steps. Conditions are checked when a beat is *reached*, so a choice early in a script can change a line later in it. Long lines are split into pages at sentence ends automatically.

**Flags** are how story reaches the picture. Content sets a flag (`"set": "scone"`); each frame the scene copies flags into `RoomState` (`room.scone = flags.has('scone')`); `render/room.ts` draws a scone. Nothing in the renderer knows why.

**The timeline** in the night file orders everything: scripts and visitors with clock times, ending in `dawn`. At dawn, `systems/report.ts` builds the radio report by picking, for each visitor, the sentence in their JSON that matches how their visit ended. Then the `epilogue` script plays, and the end card shows the `summary` sentences whose conditions match your hidden stats.

## Three nights: the campaign and the endings

- `systems/campaign.ts` holds what carries between nights: a `CampaignData` of the three stats and the set of flags. When a night ends the scene calls `absorb()`, and the next `NightState` is built from it. Each night file lists `clearFlags` for things that should not carry (last night's scone).
- Every visit leaves a flag such as `dale:serve`. Timeline events can carry an `if`, so Night 2 brings Maureen back if you saved her (`maureen2`) and something wearing her if you did not (`maureen2x`). Conditions can test `flag`, `notFlag`, `anyFlag`, `noFlags` and stat ranges.
- **They learn.** At each dawn `absorb()` notes the check you used most as a flag (`relied:wrist`). A mimic whose JSON says `"learns": true` turns up next night with that check looking human, provided it still has another tell to be caught by (`NightState.adapt`). The content is never modified: the visit works from a changed copy.
- A timeline event of type `ending` stops the game. `content/endings.json` is an ordered list; `pickEnding()` takes the first whose condition holds. The final visitor uses `"decide": "finale"`: instead of the three buttons, a script offers choices (some only when a stat is high enough) and each choice's `outcome` ends the visit.
- Script effects `showWrenWrist`, `showSelfWrist`, `showSelfMirror` put a close-up on screen during a script: this is how you finally inspect Wren, and yourself (`content/self.json` is your face).
- `core/save.ts` writes the campaign to the browser's `localStorage` at each dawn, and keeps a separate list of endings found. The title screen offers **Continue** when a save exists. A campaign is plain data, so saving is one `JSON.stringify`.
- `tests/campaign.test.ts` plays all three nights with no screen and checks each ending is reachable.

## Wren

Wren is three small pieces:

- **Lines** live in `content/wren.json` as pools keyed by situation (`serve.human`, `defied`, `kind`, `mirror`…). A line may carry `minBond` / `maxBond`.
- **Choosing** is `systems/wren.ts` → `WrenVoice.line(key, bond)`: filter the pool by Bond, avoid repeats, pick one.
- **Opinion**: every visitor file has a `wren` block with what Wren wants done (`advice`) and the line they say it with. Wren is not always honest. After your first look at a visitor, Wren says it; from then on `NightState.finish()` counts your decision as siding (+1 Bond) or defying (-1 Bond).

Wren also holds the storeroom key: `Shelter` asks `NightState.wrenGivesKey()`, and a refusal becomes a choice (insist: -2 Bond; let it go: +1).

## Content files

| File | Holds |
| --- | --- |
| `content/visitors/<id>.json` | one visit: the people (face seed, pinned sliders, tells), patience, greeting, small-talk topics, Wren's opinion, leaving lines and dawn-report lines for every outcome |
| `content/nights/night1.json` | the timeline, named scripts, dawn report framing, epilogue |
| `content/wren.json` | Wren's face and pools of reactive lines |

`core/content.ts` has the TypeScript types for all of these and loads them with Vite's `import.meta.glob`, so a new visitor file is picked up without touching code.

## Folder map

| Folder | Job |
| --- | --- |
| `src/core/` | loop, scene manager, input, RNG, content types + loader, the shared `Game` object |
| `src/render/` | renderer, palette, face generator, face view, room, close-ups, filters, flicker |
| `src/systems/` | pure game rules: drift, clock, inspections, stats, night state, Wren's line picker, dawn report |
| `src/ui/` | buttons, panels, the dialogue box |
| `src/audio/` | Web Audio ambience, stings, radio song |
| `src/scenes/` | title screen, night, end card |
| `content/` | story data as JSON |
| `tests/` | unit tests for `systems/`, content checks, and a screenless playthrough of Night 1 |
| `scripts/` | `playtest.cjs`: an optional browser playthrough (needs Playwright) |

## Testing

- `npm test` runs Vitest. `tests/night.test.ts` and friends test the rules with tiny made-up content; `tests/content.test.ts` checks the real story JSON (every outcome has lines, every mimic is catchable, references resolve) and plays the real Night 1 through `NightState` with no screen.
- `npm run playtest` drives the actual game in a headless browser from the title screen to the end card and fails on any page error. It needs Playwright installed separately, so it is not part of CI.
- `?debug` exposes `window.__ls` (the `Game` and the current `NightScene`) for poking at state from the browser console.

## Where to go next

Things the design asks for that Night 1 does not have yet, and where they would go:

| Feature | Where |
| --- | --- |
| More returning visitors | a visitor file plus a conditional timeline entry (`"if": { "flag": "kid:serve" }`) |
| Saving mid-night | serialise `NightState` as well as the campaign |
