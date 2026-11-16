# Last Shift — Game Design Doc

Nov 17, 2026 · @Disath Wickrama

## Pitch

**Last Shift** is a slow-burn psychological horror game about the night shift at an isolated mountain roadhouse. Fog has rolled down the pass, and the radio says some of the travellers coming out of it are not people anymore. You inspect every visitor's wrists, reflection, shadow and small talk, then decide who gets served. Over five nights your bond with your coworker tightens into something tender, possessive and wrong, and the evidence starts pointing back at the two of you.

**Core loop (one night):**

1. A visitor walks in. The clock is running.
2. Talk and inspect. Each check costs time, and the longer you talk, the more the visitor drifts.
3. Decide: serve, turn away, or let them shelter in the back.
4. Your coworker comments, sometimes helps, sometimes lies.
5. At dawn the morning radio report shows the consequences of what you chose.

## Setting

**Corrigan's Roadhouse** is a fuel stop and diner on a lonely mountain pass. A sign out front reads "Last fuel for 80 km". Truckers, grey nomads, backpackers and lost tourists stop in because there is nowhere else.

- **The view:** first-person from behind the counter, facing the glass front door. Fuel pumps glow orange out in the fog.
- **Inside:** buzzing fluoro tubes, a humming drinks fridge, a convex security mirror in the corner, a CB radio and a staff noticeboard with old photos.
- **The back storeroom:** locked. Your coworker has the only key, and sometimes something in there knocks back.
- **The fog:** it arrived the night before the game starts. Phones get no signal. The road down is "closed" and nobody who drives into it comes back the same.
- **Shift:** 10 pm to 6 am. Dawn ends each night.

## Characters

**You (the night attendant).** Your name tag says *Sam*, but you hesitate every time someone says it. You can't quite remember how you got this job or what you did before the fog. You're weirdly good at spotting mimics. You never seem to eat.

**Wren (your coworker).** Warm, teasing, darkly funny, and completely devoted to you. Wren treats travellers as interruptions to *your* time together and gets quietly jealous when you're kind to them. Wren says things like "it's just us up here" and "you're getting so good at being you." Wren has the storeroom key and won't let you look at your own hands for too long.

- **The twisted romance:** the bond grows each night through small moments (sharing a smoke out the back, Wren bandaging your cut hand, slow-dancing to the radio at 4 am). It's sweet on the surface, but every scene has something slightly off.
- **Neither of you knows the full truth at first.** Wren suspects first and hides it to keep you. You find out through the clues.
- **Bond meter (hidden):** goes up when you side with Wren, down when you question or defy them.

**The Radio.** An emergency broadcast from the ranger station down the mountain. Each night it teaches a new "tell" (the tutorial). Later broadcasts start describing missing persons who sound a lot like the two attendants at Corrigan's.

**Travellers (sample cast for Nights 1–2):**

| Visitor | Human? | Hook |
| --- | --- | --- |
| Dale, trucker | Human | Gruff, tired, wants coffee and diesel. The safe tutorial visitor. |
| Maureen, grey nomad | Human | Brings you a scone and chats too long. Wren hates her. |
| Backpacker couple | One mimic | One partner answers every question for both of them. |
| A kid alone | Mimic | Asks if you've seen their parents. A moral gut-punch either way. |
| Ranger Holt | Mimic | Knows your name before you say it. |

## The mimics

Mimics are things from the fog that copy people they've watched. They get *almost* everything right, and the horror is in the small errors: the uncanny valley.

- **Drift:** the key mechanic. Each mimic has a hidden drift meter. Talking to them, and especially asking pointed questions, makes their appearance change mid-conversation. An eye sits one pixel too low. A smile is held two seconds too long. Their hair parts on the other side than a minute ago. They borrow *your* exact words from earlier in the night.
- **Adapting to you:** when a mimic is nervous it tries harder to look like what you expect, and overcorrects. Ask about their family and their face softens a bit too much.
- **They learn:** whatever you check most on a night, the next mimic gets better at hiding. If you always check reflections, a later mimic has a perfect one but forgets its shadow. This keeps players from relying on one trick.
- **Breaking:** when a mimic is caught or provoked it stops pretending. The skin goes slack along a seam, the jaw opens too wide, and the face slides like a mask. Show this in quick, glitchy flashes, not long gore scenes.
- **What they want:** to be let in. To be someone. Which is exactly what you and Wren already did.

## Core mechanics

**Inspections.** Each costs in-game minutes and adds a little drift. Too many checks and a human gets annoyed and leaves; a mimic gets time to adapt.

| Check | How you do it | Human | Mimic tells |
| --- | --- | --- | --- |
| Wrist veins | Ask them to pay by card, then zoom in on the wrist | Faint blue veins with a natural pattern | No veins, black or silver veins, veins that move, or a mirrored pattern on both wrists |
| Reflection | Look at the glass door or the convex mirror | Matches them | Delayed by a beat, facing the wrong way, smiling when they aren't, or missing |
| Shadow | Glance at the floor under the fluoros | One soft shadow under them | No shadow, wrong direction, too many, or it moves on its own |
| Small talk | Pick questions from the dialogue box | Consistent, boring, human | Towns that don't exist, contradictions, repeating your words, knowing things they shouldn't |

**Decisions:**

- **Serve:** they get fuel and leave. A human is fine; a mimic now wears that person's face out in the world and may come back.
- **Turn away:** a mimic is gone for now; a human is left in the fog, and the morning radio may report what happened to them.
- **Shelter in the back:** a human survives the night; a mimic means a gore event at 3 am. Wren decides whether to hand over the storeroom key.

**Hidden stats:**

- **Humanity:** people you saved minus people you doomed.
- **Bond:** your closeness with Wren.
- **Slip:** how much *you* are drifting. It goes up when you pick cold or strange dialogue, or stare at mirrors. High slip makes the UI text glitch, makes your hands look wrong in close-ups, and makes visitors uneasy around you.

**Clock:** each night is about 6 to 8 visitors from 10 pm to 6 am, with quiet moments with Wren between them.

## Story: five nights

The twist: the real Sam and Wren died the night the fog came. You and Wren are mimics who took their place so completely that you forgot. That's why you're so good at spotting your own kind. The originals are in the storeroom.

1. **Night 1, "Last Fuel":** tutorial. The radio teaches wrist veins and reflections. 4 to 5 easy visitors. Wren is playful and flirty. Teaser: Wren flips the staff noticeboard photo face-down before you can look at it.
2. **Night 2, "Small Talk":** adds small talk and shadows. Maureen is lovely and Wren gets jealous. You cut your hand on a broken bottle; Wren bandages it fast and says "don't look."
3. **Night 3, "Familiar Faces":** the mimics have learned. Someone you served on Night 1 comes back, slightly wrong. The storeroom knocks back. Wren asks you to promise "it's just us, no matter what."
4. **Night 4, "Mirror":** the convex mirror lags behind *you* for a second. The radio reads out two missing attendants from Corrigan's, last seen three weeks ago. A traveller arrives wearing the face from the noticeboard photo: the real Sam's face. Choice: confront Wren or stay quiet.
5. **Night 5, "Last Shift":** the reveal. You can inspect yourself for the first time. Then the last human of the game walks in, and what you do with them decides the ending.

**Clues to plant early** (so the twist feels earned on a replay):

- You never eat the food Maureen brings.
- Mimics sometimes treat you like one of them: "you get it."
- Wren's dialogue is full of double meanings: "you're getting so good at being you."
- The CB radio picks up your own voice saying lines you haven't said yet.

## Endings

Which ending you get depends on Bond, Humanity, Slip and your Night 5 choice.

| Ending | How you get it | What happens |
| --- | --- | --- |
| **Close Enough** | High Bond; you accept what you are | You and Wren keep running Corrigan's together, forever, greeting travellers with perfect smiles. Tender and horrifying. |
| **Wrong Answer** | Low Bond; you warn the last human | You help them escape and Wren turns on you. The gore ending. |
| **Clean Hands** | High Slip; you insist you're human | You take the box cutter to your own wrist to prove there are veins. Fade to black. |
| **Fog Lifts** | High Humanity, low Bond | You walk into the fog alone. The morning radio says rescuers found two bodies in the roadhouse storeroom. Ambiguous. |
| **Secret: Just Us** | Check Wren's wrist on Night 2 | Wren shows you early, smiling: "I was wondering when you'd ask." A short, unsettling alternate route. |

## Art and audio

The look is flat, uncanny and minimal: simple shapes that are almost right. Everything is drawn in code so faces can morph live during conversations.

- **Palette:** fluoro green-white inside, sodium orange from the pumps, fog grey outside, and deep red reserved only for gore.
- **Faces:** built from parts (eyes, brows, mouth, nose, hair) with sliders for each. Drift just nudges the sliders: asymmetry, eye spacing, smile width, blink rate.
- **Filters:** low-res pixel scaling, light dithering, CRT scanlines, and fluoro flicker that gets worse as the night goes on.
- **Gore:** short glitchy flashes (a face sliding, a jaw opening too far) and the aftermath at dawn (marks on the pumps, an abandoned car). Implied more than shown.
- **Audio (Web Audio, generated in code):** fluoro buzz, fridge hum, wind, a distant truck, and a low drone that swells when drift rises. A soft, warped radio song plays for Wren's scenes.
- **Optional free assets:** fonts and sound effects from CC0 packs (e.g. Kenney.nl) if the generated ones aren't enough.

## Tech plan and tonight's scope

**Stack:** Vite + TypeScript + HTML Canvas, with no game engine. It runs in any browser and deploys free to GitHub Pages. All story content (visitors, dialogue, nights) lives in JSON files, so adding Night 2 later means writing data, not code.

```
last-shift/
  index.html
  src/
    main.ts          game loop + scene manager
    render/          face generator, room, filters
    systems/         inspections, drift, stats, clock
    audio/           Web Audio ambience + stings
    ui/              dialogue box, tool tray
  content/
    nights/night1.json
    visitors/*.json
    wren.json
```

**Tonight's MVP (before 7 pm, using Fable):**

- [ ] Title screen and the roadhouse counter scene
- [ ] Face generator with live drift
- [ ] All four inspections working
- [ ] Serve / turn away / shelter decisions
- [ ] Wren with 10 to 15 lines reacting to your choices
- [ ] Night 1: 4 to 5 visitors plus the radio tutorial
- [ ] Dawn radio report with consequences, and the noticeboard teaser
- [ ] Ambient audio
- [ ] Pushed to GitHub and live on GitHub Pages

**Later over summer:** Nights 2 to 5, endings, save system, mimic learning, settings and accessibility, then maybe an itch.io page.

## Build prompt for Claude Code

Save this doc as `DESIGN.md` in your repo (export it as Markdown), open Claude Code in that folder, switch to Fable 5.2 with `/model`, and paste:

```
Read DESIGN.md. It's the design doc for "Last Shift", a slow-burn psychological horror browser game.

Build the MVP described in "Tech plan and tonight's scope": Vite + TypeScript + HTML Canvas, no game engine, with all story content in JSON under content/.

Priorities, in order:
1. A playable Night 1, start to finish: title screen, 4-5 visitors, radio tutorial, dawn report.
2. The four inspections (wrist veins, reflection, shadow, small talk), each costing time and adding drift.
3. A procedural face generator in which drift visibly changes faces mid-conversation (uncanny, subtle).
4. Wren as a side character with reactive lines; hidden Bond / Humanity / Slip stats.
5. Atmosphere: fluoro flicker, CRT/dither filter, Web Audio ambience.

Work in small commits with clear messages. Explain the architecture to me as you go, because I'm an IT student and want to learn from the code. When Night 1 is playable, run it, playtest it yourself, fix the bugs, and then set up a GitHub Pages deploy.
```

Tips: playtest after each big step and give blunt feedback ("the drift is too obvious", "Wren needs to be creepier"). Fable's included access ends at about 7 pm Sydney time today.
