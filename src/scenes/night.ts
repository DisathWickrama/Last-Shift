// The night scene: where the game is actually played.
//
// It sits between the rules (src/systems/night.ts, which draws nothing) and the
// renderers (src/render/*, which decide nothing). Its own job is *presentation
// and pacing*: showing lines one at a time, walking visitors in and out, opening
// close-ups, and offering buttons.
//
// Pattern: "command queue". Anything that should happen in order (say this line,
// wait for a click, walk to the door, then finish the visit) is pushed onto
// `queue` as a list of small steps. update() works through one step at a time.
// When the queue is empty and someone is at the counter, the player is in
// control and the buttons appear. When the queue is empty and nobody is there,
// the scene asks NightState for the next event on the timeline.
//
//   queue has steps        -> runQueue()   (the game is "talking")
//   empty, visitor present -> interact()   (the player is choosing)
//   empty, nobody present  -> nextEvent()  (bring on the next thing)

import type { Scene } from '../core/scene';
import type { Game } from '../core/game';
import { type Renderer, W } from '../render/renderer';
import { drawRoomBack, drawRoomFront, defaultRoom, VISITOR_SPOT, WREN_SPOT, COUNTER_Y, type RoomState } from '../render/room';
import { generateFace } from '../render/face';
import { FaceView } from '../render/faceview';
import { drawTinted } from '../render/layer';
import { Flicker } from '../render/flicker';
import { hashString } from '../core/rng';
import { drawWristCloseup, drawMirrorCloseup, drawFloorCloseup } from '../render/closeups';
import { PAL } from '../render/palette';
import { applyDrift } from '../systems/drift';
import { NightState, type VisitStatus } from '../systems/night';
import { CHECKS, TONES, STARE_SECONDS, type CheckKind } from '../systems/inspections';
import type { Decision, Outcome } from '../systems/stats';
import { NIGHTS, VISITORS, WREN, type Beat, type Line, type PersonDef, type TopicDef, type Who } from '../core/content';
import { buildReport } from '../systems/report';
import { WrenVoice, reactionKey } from '../systems/wren';
import { lerp, smooth } from '../core/rng';
import { type Btn, DialogueBox, handleButtons, drawButtons, drawPanel, DIALOGUE, COL_A, COL_B } from '../ui/widgets';

/** What the player is looking at while they are in control. */
type Mode = 'counter' | 'talk' | CheckKind;

/** One entry in the command queue. */
type Step =
  | { kind: 'say'; who: Who; text: string; when?: () => boolean; enter?: () => void } // show a line, wait for a click
  | { kind: 'wait'; time: number } // do nothing for a moment
  | { kind: 'call'; fn: () => void } // run some code, then carry on
  | { kind: 'until'; done: () => boolean } // hold until something has finished (e.g. a walk)
  | { kind: 'choice'; options: Option[]; when?: () => boolean }; // offer options, wait for a pick

interface Option {
  text: string;
  pick: () => void;
}

/** A person standing in the shop: their data, their live face, and where they stand. */
interface PersonView {
  def: PersonDef;
  view: FaceView;
  x: number;
  y: number;
  scale: number;
}

/** Cut text after each sentence end (". ", "! ", "? "), keeping every character, including a leading "...". */
function splitSentences(text: string): string[] {
  const parts: string[] = [];
  let start = 0;
  for (let i = 1; i < text.length; i++) {
    if (text[i] === ' ' && /[.!?]["')]?$/.test(text.slice(Math.max(0, i - 2), i))) {
      parts.push(text.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (start < text.length) parts.push(text.slice(start));
  return parts;
}

const WALK_IN_SECONDS = 2.4;
const WALK_OUT_SECONDS = 1.8;
const BREAK_SECONDS = 1.9;

export class NightScene implements Scene {
  private state: NightState;
  private queue: Step[] = [];
  private step: Step | null = null;
  private dialogue = new DialogueBox();
  private buttons: Btn[] = [];
  private mode: Mode = 'counter';
  private people: PersonView[] = [];
  /** 0 = at the door, 1 = at the counter. */
  private walk = 0;
  private walkTo = 0;
  /** Leaving through the back (sheltered) instead of the front door. */
  private exitBack = false;
  /** Seconds into the "mask slips" animation, or -1 when nobody is breaking. */
  private breakT = -1;
  /** A status found during a close-up, dealt with once the player steps back. */
  private pending: VisitStatus = 'ok';
  private stareT = 0;
  private room: RoomState = { ...defaultRoom };
  private time = 0;
  private over = false;
  /** Who is walking right now. null means everyone at the counter. */
  private walkers: PersonView[] | null = null;
  /** Timers for one-off effects fired by scripts ("glitch", "gore", "dark"). */
  private glitchT = 0;
  private goreT = 0;
  private lightsOut = false;
  private dawnTo = 0;
  private flicker = new Flicker();
  /** Counts letters as they are typed, so only every third one makes a voice blip. */
  private letters = 0;
  /** Wren: always at your right shoulder, always looking at you. */
  private wren: FaceView;
  private wrenVoice = new WrenVoice(WREN);
  /** Where Wren's portrait can be clicked, in virtual pixels. */
  private readonly wrenZone = { x: 382, y: 98, w: 94, h: 104 };

  constructor(private game: Game, nightId = 'night1') {
    this.state = new NightState(NIGHTS[nightId], VISITORS);
    const { seed, ...pinned } = WREN.face;
    this.wren = new FaceView(generateFace(seed, pinned), seed);
    if (game.debug) (window as unknown as { __ls: Record<string, unknown> }).__ls.scene = this;
  }

  /** Leaving the scene: make sure nothing is left playing. */
  exit(): void {
    this.game.audio.song(false);
    this.game.audio.radio(false);
  }

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------

  update(dt: number): void {
    this.time += dt;
    this.room.time = this.time;
    this.animate(dt);

    if (this.step || this.queue.length > 0) this.runQueue(dt);
    else if (this.state.visit) this.interact(dt);
    else this.nextEvent();
  }

  /** Things that move on their own every step: walking, the door, faces. */
  private animate(dt: number): void {
    const { input } = this.game;
    if (this.walk < this.walkTo) this.walk = Math.min(this.walkTo, this.walk + dt / WALK_IN_SECONDS);
    else if (this.walk > this.walkTo) this.walk = Math.max(this.walkTo, this.walk - dt / WALK_OUT_SECONDS);

    const atDoor = this.people.length > 0 && !this.exitBack && this.walk > 0.01 && this.walk < 0.45;
    this.room.doorOpen = lerp(this.room.doorOpen, atDoor ? 1 : 0, 1 - Math.exp(-dt * 7));

    if (this.breakT >= 0) this.breakT += dt;
    this.glitchT = Math.max(0, this.glitchT - dt);
    this.goreT = Math.max(0, this.goreT - dt);

    // The room is drawn from the night's flags: content sets a flag, the picture follows.
    const flags = this.state.flags;
    this.room.dawn = lerp(this.room.dawn, this.dawnTo, 1 - Math.exp(-dt * 0.8));
    // The tubes get worse as the night goes on. A script can also put them out completely.
    const flick = this.flicker.update(dt, this.state.clock.progress, this.game.settings.reducedFlicker);
    this.room.light = this.lightsOut ? 0.04 : flick;
    this.room.scone = flags.has('scone');
    this.room.lingerer = flags.has('lingerer');
    this.room.photoFlipped = flags.has('photoFlipped');
    this.room.car = flags.has('car') && this.room.dawn > 0.3;
    this.room.marks = flags.has('marks') && this.room.dawn > 0.3;
    const slack = this.slackNow();

    const visit = this.state.visit;
    const hidden = this.mode === 'wrist' || this.mode === 'shadow';
    this.people.forEach((p, i) => {
      // This is the join between rules and pixels: ask the drift model what this
      // face should look like now, and hand the answer to the view.
      const drift = visit && p.def.isMimic ? visit.drift : 0;
      const target = applyDrift(p.view.base, drift, p.def.tells.drift ?? []);
      p.view.update(dt, target, {
        talking: this.speaker() === (i === 0 ? 'visitor' : 'companion'),
        lookX: (input.x - p.x) / 200,
        lookY: (input.y - p.y) / 150,
        stare: drift,
        hidden,
        slack: p.def.isMimic ? slack : 0,
        restless: this.mode === 'reflection',
      });
    });
    this.animateWren(dt);

    this.game.audio.update(dt, {
      drift: visit && visit.def.people.some((p) => p.isMimic) ? visit.drift : 0,
      light: this.room.light,
      scene: 'night',
    });
  }

  private animateWren(dt: number): void {
    // Wren's face never drifts and almost never looks away from you.
    this.wren.update(dt, this.wren.base, { talking: this.speaker() === 'wren', stare: 0.9 });
  }

  /** Queue one of Wren's lines for a situation, if the pool has one that fits the current Bond. */
  private wrenSays(key: string): void {
    const line = this.wrenVoice.line(key, this.state.stats.bond);
    if (line) this.say('wren', line);
  }

  /** Who is in the middle of saying a line right now, if anyone. */
  private speaker(): Who | null {
    return this.step?.kind === 'say' && this.dialogue.typing ? this.step.who : null;
  }

  /**
   * How far the mask has slipped, 0..1. DESIGN.md asks for "quick, glitchy
   * flashes, not long gore scenes": so the true face flickers in and out for a
   * second, holds for half a second, and is gone.
   */
  private slackNow(): number {
    const t = this.breakT;
    if (t < 0) return 0;
    if (t < 1.3) {
      const slot = Math.floor(t * 14);
      const on = (slot * 7919) % 5 < 2; // an irregular but repeatable on/off pattern
      return on ? Math.min(1, 0.45 + t * 0.6) : 0;
    }
    return t < 1.8 ? 1 : 0;
  }

  // --- the command queue ------------------------------------------------------

  private enqueue(...steps: Step[]): void {
    this.queue.push(...steps);
  }

  private say(who: Who, text: string): void {
    this.enqueue(...this.saySteps({ who, text }));
  }

  private lines(lines: readonly Line[]): void {
    for (const line of lines) this.enqueue(...this.saySteps(line));
  }

  /**
   * Turn one line of content into 'say' steps. A line too long for the box is
   * split at sentence ends into several pages, so writers never count letters.
   * Effects, flags and stat changes on the line fire as its first page starts.
   */
  private saySteps(line: Line & { bond?: number; slip?: number; humanity?: number }, when?: () => boolean): Step[] {
    const text = this.state.fill(line.text);
    const maxLines = line.who === 'narration' ? 5 : 4;
    const fits = (t: string) => this.game.r.wrap(t, DIALOGUE.w - 14, 8).length <= maxLines;
    const pages: string[] = [];
    let page = '';
    for (const sentence of splitSentences(text)) {
      if (page && !fits(page + sentence)) {
        pages.push(page.trim());
        page = sentence;
      } else {
        page += sentence;
      }
    }
    if (page.trim()) pages.push(page.trim());

    const enter = () => {
      if (line.fx) this.fx(line.fx);
      this.state.apply(line);
    };
    return pages.map((t, i) => ({ kind: 'say' as const, who: line.who, text: t, when, enter: i === 0 ? enter : undefined }));
  }

  /**
   * Turn a script from the night's JSON into steps. Conditions are checked when
   * each beat is reached, not now, so an earlier choice can change a later line.
   */
  private scriptSteps(beats: readonly Beat[]): Step[] {
    const steps: Step[] = [];
    for (const beat of beats) {
      const when = beat.if ? () => this.state.test(beat.if) : undefined;
      if ('choice' in beat) {
        steps.push({
          kind: 'choice',
          when,
          options: beat.choice.map((c) => ({
            text: c.text,
            pick: () => {
              this.state.apply(c);
              // The chosen branch plays next, ahead of whatever else is queued.
              this.queue.unshift(...this.scriptSteps(c.then ?? []));
            },
          })),
        });
      } else {
        steps.push(...this.saySteps(beat, when));
      }
    }
    return steps;
  }

  /** Named one-off effects that content can fire from a line ("fx": "knock"). */
  private fx(name: string): void {
    const { audio } = this.game;
    switch (name) {
      case 'static':
        this.room.radioLive = true;
        audio.radio(true);
        break;
      case 'radioOff':
        this.room.radioLive = false;
        audio.radio(false);
        break;
      case 'knock':
        audio.sting('knock');
        break;
      case 'bell':
        audio.sting('bell');
        break;
      case 'photo':
        audio.sting('photo');
        break;
      case 'song':
        audio.song(true);
        break;
      case 'songOff':
        audio.song(false);
        break;
      case 'glitch':
        this.glitchT = 0.5;
        audio.sting('static');
        break;
      case 'gore':
        this.glitchT = 0.7;
        this.goreT = 0.7;
        audio.sting('gore');
        break;
      case 'dark':
        this.lightsOut = true;
        audio.sting('thud');
        break;
      case 'lights':
        this.lightsOut = false;
        audio.sting('tick');
        break;
    }
  }

  private runQueue(dt: number): void {
    const { input } = this.game;
    while (!this.step && this.queue.length > 0) {
      const next = this.queue.shift()!;
      // A step with a condition is dropped if the condition no longer holds.
      if ((next.kind === 'say' || next.kind === 'choice') && next.when && !next.when()) continue;
      this.step = next;
      if (next.kind === 'say') {
        next.enter?.();
        const [name, color] = this.nameOf(next.who);
        this.dialogue.say(name, color, next.text);
      }
    }
    const s = this.step;
    if (!s) return;
    this.buttons = [];
    switch (s.kind) {
      case 'say':
        if (this.dialogue.update(dt) && this.letters++ % 3 === 0) {
          const speaker = s.who === 'companion' ? this.people[1] : this.people[0];
          // Each visitor's voice has its own pitch, taken from their name.
          const pitch = speaker ? (hashString(speaker.def.name) % 100) / 100 : 0.5;
          this.game.audio.voice(s.who, pitch);
        }
        if (input.advance) {
          input.consume();
          // First press finishes the line; the next one moves on.
          if (this.dialogue.typing) this.dialogue.finish();
          else this.step = null;
        }
        break;
      case 'wait':
        s.time -= dt;
        if (s.time <= 0) this.step = null;
        break;
      case 'call':
        this.step = null; // cleared first, because fn() may add more steps
        s.fn();
        break;
      case 'until':
        if (s.done()) this.step = null;
        break;
      case 'choice':
        this.buttons = this.optionButtons(s.options);
        if (handleButtons(this.buttons, input)) this.game.audio.sting('click');
        break;
    }
  }

  private nameOf(who: Who): [string, string] {
    switch (who) {
      case 'visitor':
        return [this.people[0]?.def.name ?? '', PAL.fluoro];
      case 'companion':
        return [this.people[1]?.def.name ?? '', PAL.fluoro];
      case 'wren':
        return ['Wren', PAL.wren];
      case 'you':
        return ['You', PAL.you];
      case 'radio':
        return ['CB radio', PAL.radio];
      default:
        return ['', PAL.inkDim];
    }
  }

  // --- the timeline -----------------------------------------------------------

  private nextEvent(): void {
    if (this.over) return;
    const ev = this.state.nextEvent();
    if (!ev) {
      this.over = true;
    } else if (ev.type === 'visitor') {
      this.arrive(ev.visitor);
    } else if (ev.type === 'script') {
      this.dialogue.clear();
      this.enqueue({ kind: 'wait', time: 0.5 }, ...this.scriptSteps(this.state.script(ev.script)));
    } else {
      this.dawn();
    }
  }

  /** 6 am: the light changes, the radio reads its report, the epilogue plays, then the end card. */
  private dawn(): void {
    const def = this.state.def;
    const report = buildReport(def, this.state.log, VISITORS);
    this.dialogue.clear();
    this.enqueue({ kind: 'call', fn: () => (this.dawnTo = 1) }, { kind: 'wait', time: 2.5 });
    report.forEach((text, i) => {
      this.enqueue(...this.saySteps({ who: 'radio', text, fx: i === 0 ? 'static' : undefined }));
    });
    this.enqueue({ kind: 'call', fn: () => this.fx('radioOff') });
    this.enqueue(...this.scriptSteps(def.epilogue));
    this.enqueue({
      kind: 'call',
      fn: () => {
        this.over = true;
        this.game.go('end', {
          heading: `NIGHT ${def.number}  ·  ${def.title.toUpperCase()}`,
          lines: def.summary.filter((line) => this.state.test(line.if)).map((line) => line.text),
          next: def.next,
          debug: this.statsLine(),
        });
      },
    });
  }

  private arrive(id: string): void {
    const visit = this.state.beginVisit(id);
    const n = visit.def.people.length;
    this.people = visit.def.people.map((def, i) => {
      const size = def.size ?? 1;
      const { seed, ...pinned } = def.face;
      return {
        def,
        view: new FaceView(generateFace(seed, pinned), seed),
        x: VISITOR_SPOT.x + (i - (n - 1) / 2) * 76,
        y: VISITOR_SPOT.y + (1 - size) * 165, // shorter people stand lower in the frame
        scale: size * 1.04,
      };
    });
    this.mode = 'counter';
    this.exitBack = false;
    this.walk = 0;
    this.walkTo = 1;
    this.game.audio.sting('bell');
    this.enqueue({ kind: 'until', done: () => this.walk >= 1 });
    this.lines(visit.def.greeting);
    if (visit.def.wren.arrive) this.say('wren', visit.def.wren.arrive);
  }

  // --- the player's turn ------------------------------------------------------

  private interact(dt: number): void {
    const { input } = this.game;
    this.state.tick(dt);

    // Looking too long into the mirror, or at your own hand on the card reader, costs Slip.
    if (this.mode === 'reflection' || this.mode === 'wrist') {
      this.stareT += dt;
      if (this.stareT > STARE_SECONDS && this.state.stare()) {
        // Wren does not like you looking into mirrors, or at your own hands.
        this.wrenSays(this.mode === 'reflection' ? 'mirror' : 'hands');
        return;
      }
    }
    // Drift also creeps up with time, so a mimic can break while you dither.
    if (this.mode === 'counter' && this.state.status() === 'break') {
      this.breakOut();
      return;
    }
    this.buttons = this.buildButtons();
    if (handleButtons(this.buttons, input)) {
      this.game.audio.sting('click');
      return;
    }

    // Clicking Wren: they tell you what they want done (or, if they already have, that they are still here).
    const z = this.wrenZone;
    if (this.mode === 'counter' && input.clicked && input.over(z.x, z.y, z.w, z.h)) {
      input.consume();
      if (this.state.visit!.heardAdvice) this.wrenSays('poke');
      else this.say('wren', this.state.hearAdvice());
    }
  }

  private buildButtons(): Btn[] {
    const visit = this.state.visit!;
    const out: Btn[] = [];
    if (this.mode === 'counter') {
      const kinds: CheckKind[] = ['wrist', 'reflection', 'shadow'];
      kinds.forEach((kind, i) => {
        out.push({
          x: COL_A.x, y: 207 + i * 15, w: COL_A.w, h: 13,
          label: CHECKS[kind].label, hint: `${CHECKS[kind].minutes}m`, key: String(i + 1),
          onClick: () => this.check(kind),
        });
      });
      out.push({
        x: COL_A.x, y: 252, w: COL_A.w, h: 13,
        label: 'Small talk', hint: `${TONES.neutral.minutes}m`, key: '4',
        disabled: this.state.topics().length === 0,
        onClick: () => (this.mode = 'talk'),
      });
      out.push(...this.decisionButtons());
    } else if (this.mode === 'talk') {
      const options: Option[] = this.state.topics().slice(0, 4).map((t) => ({ text: t.ask, pick: () => this.ask(t) }));
      options.push({ text: '(say nothing more)', pick: () => (this.mode = 'counter') });
      return this.optionButtons(options);
    } else {
      out.push({ x: COL_B.x, y: 207, w: COL_B.w, h: 20, label: 'Step back', key: 'b', onClick: () => this.stepBack() });
    }
    void visit;
    return out;
  }

  /** The right-hand column: the three things you can do with a visitor. */
  private decisionButtons(): Btn[] {
    const make = (i: number, label: string, key: string, decision: Decision): Btn => ({
      x: COL_B.x, y: 207 + i * 20, w: COL_B.w, h: 18, label, key,
      onClick: () => this.decide(decision),
    });
    return [make(0, 'Serve', 'q', 'serve'), make(1, 'Turn away', 'w', 'turnAway'), make(2, 'Shelter', 'e', 'shelter')];
  }

  private decide(decision: Decision): void {
    if (decision !== 'shelter') {
      this.endVisit(decision);
      return;
    }
    // Sheltering means the storeroom, and Wren holds the only key.
    if (this.state.wrenGivesKey()) {
      this.wrenSays('keyGive');
      this.endVisit('shelter');
      return;
    }
    this.wrenSays('keyRefuse');
    this.enqueue({
      kind: 'choice',
      options: [
        {
          text: 'Give me the key, Wren.',
          pick: () => {
            this.state.insistOnKey();
            this.wrenSays('keyInsist');
            this.endVisit('shelter');
          },
        },
        {
          text: '(let it go)',
          pick: () => {
            this.state.apply({ bond: 1 });
            this.wrenSays('keyBackDown');
          },
        },
      ],
    });
  }

  /** A list of full-width options, for small talk and for choices in scripts. */
  private optionButtons(options: Option[]): Btn[] {
    return options.map((o, i) => ({
      x: 6, y: 207 + i * 12, w: W - 12, h: 11, left: true,
      label: `${i + 1}. ${o.text}`, key: String(i + 1),
      onClick: () => {
        this.step = null;
        o.pick();
      },
    }));
  }

  private check(kind: CheckKind): void {
    const visit = this.state.visit!;
    this.pending = this.state.inspect(kind);
    this.mode = kind;
    this.stareT = 0;
    this.dialogue.say('', PAL.inkDim, visit.def.notes?.[kind] ?? '');
    this.dialogue.finish();
  }

  private stepBack(): void {
    this.mode = 'counter';
    this.dialogue.clear();
    this.resolve(this.pending);
    this.pending = 'ok';
    this.wrenWeighsIn();
  }

  /**
   * After your first look at a visitor, Wren leans in and says what they want
   * done. From then on your decision counts as siding with Wren or defying them.
   */
  private wrenWeighsIn(): void {
    const visit = this.state.visit;
    if (!visit || visit.heardAdvice || this.state.status() !== 'ok') return;
    this.say('wren', this.state.hearAdvice());
  }

  private ask(topic: TopicDef): void {
    const firstKindness = topic.tone === 'warm' && !this.state.visit!.wasWarm;
    const result = this.state.ask(topic.id);
    this.mode = 'counter';
    this.say('you', topic.ask);
    this.say(topic.who ?? 'visitor', result.answer);
    if (topic.note) this.say('narration', topic.note);
    this.enqueue({
      kind: 'call',
      fn: () => {
        this.resolve(result.status);
        if (firstKindness) this.wrenSays('kind'); // quietly jealous
        this.wrenWeighsIn();
      },
    });
  }

  /** React to what the rules say about the visitor's state after an action. */
  private resolve(status: VisitStatus): void {
    const visit = this.state.visit;
    if (!visit) return;
    if (status === 'annoyed') {
      this.state.warned();
      this.say('visitor', visit.def.annoyed);
    } else if (status === 'walkout') {
      this.endVisit('walkout');
    } else if (status === 'break') {
      this.breakOut();
    }
  }

  /** The mask slips: a second of flashes, then it leaves. */
  private breakOut(): void {
    this.mode = 'counter';
    this.enqueue(
      {
        kind: 'call',
        fn: () => {
          this.breakT = 0;
          this.game.audio.sting('break');
        },
      },
      { kind: 'until', done: () => this.breakT > BREAK_SECONDS },
      { kind: 'call', fn: () => (this.breakT = -1) },
    );
    this.endVisit('break');
  }

  /** Play the leaving lines, walk them out, and tell the rules how it ended. */
  private endVisit(outcome: Outcome): void {
    const visit = this.state.visit!;
    this.mode = 'counter';
    this.lines(visit.def.leave[outcome] ?? []);

    // When a mimic breaks, only the mimic goes out of the door. Anyone human
    // who came in with it is left at your counter, and is taken through to the back.
    const mimics = this.people.filter((p) => p.def.isMimic);
    const split = outcome === 'break' && mimics.length < this.people.length;
    const walkOut = (who: PersonView[] | null, back: boolean): Step[] => [
      {
        kind: 'call',
        fn: () => {
          this.walkers = who;
          this.exitBack = back;
          this.walk = 1;
          this.walkTo = 0;
        },
      },
      { kind: 'until', done: () => this.walk <= 0 },
      {
        kind: 'call',
        fn: () => {
          if (!back && outcome !== 'break') this.game.audio.sting('bell'); // the door, on the way out
          this.people = who ? this.people.filter((p) => !who.includes(p)) : [];
          this.walkers = null;
          this.walk = this.people.length > 0 ? 1 : 0;
          this.walkTo = this.walk;
        },
      },
    ];
    this.enqueue(...walkOut(split ? mimics : null, outcome === 'shelter'));
    if (split) this.enqueue({ kind: 'wait', time: 0.8 }, ...walkOut(null, true));

    this.enqueue(
      {
        kind: 'call',
        fn: () => {
          const record = this.state.finish(outcome);
          this.people = [];
          this.exitBack = false;
          this.dialogue.clear();
          // Wren always has something to say once the door has shut.
          const special = visit.def.wren.after?.[outcome];
          if (special) this.say('wren', special);
          else this.wrenSays(reactionKey(outcome, visit.def.people));
          if (record.sided !== null) this.wrenSays(record.sided ? 'sided' : 'defied');
        },
      },
      { kind: 'wait', time: 0.6 },
    );
  }

  // ---------------------------------------------------------------------------
  // draw
  // ---------------------------------------------------------------------------

  draw(r: Renderer): void {
    const g = r.g;
    const stats = this.state.stats;
    const light = this.room.light;

    if (this.mode === 'wrist' && this.people[0]) {
      drawWristCloseup(g, this.time, this.people[0], stats.slip, light);
    } else if (this.mode === 'reflection') {
      drawMirrorCloseup(g, this.time, this.people, this.wren, light);
    } else if (this.mode === 'shadow') {
      drawFloorCloseup(g, this.time, this.people, light);
    } else {
      drawRoomBack(g, this.room);
      this.drawPeople(g);
      drawRoomFront(g, this.room);
      // When the lights go out in a script, Wren is in the back with the key.
      if (!this.lightsOut) this.drawWren(r);
    }

    // High Slip makes the interface itself unreliable.
    r.fx.textGlitch = Math.max(0, stats.slip - 2) / 3;
    r.fx.glitch = (this.breakT >= 0 && this.breakT < 1.8) || this.glitchT > 0 ? 0.8 : 0;
    r.fx.gore = this.slackNow() > 0 ? 0.22 : this.goreT > 0 ? 0.5 : 0;

    this.drawBand(r);
    this.drawHud(r);
  }

  private drawPeople(g: CanvasRenderingContext2D): void {
    if (this.people.length === 0 || (this.walk <= 0 && this.walkTo <= 0)) return;
    g.save();
    g.beginPath();
    g.rect(0, 0, W, COUNTER_Y); // the counter hides everything below it
    g.clip();
    // Draw the second person first so the one doing the talking stands in front.
    for (let i = this.people.length - 1; i >= 0; i--) {
      const p = this.people[i];
      // Anyone not currently walking simply stands at the counter.
      const t = !this.walkers || this.walkers.includes(p) ? smooth(this.walk) : 1;
      const dim = (1 - this.room.light) * 0.5;
      if (this.exitBack) {
        // Led away to the right, towards the storeroom, fading as they go.
        drawTinted(g, (l) => p.view.draw(l, p.x + (1 - t) * 170, p.y, p.scale), PAL.fogDark, dim, t);
      } else {
        // Coming in from the door: small and dark at first, like a shape in the fog.
        const x = lerp(226 + (p.x - VISITOR_SPOT.x) * 0.3, p.x, t);
        const y = lerp(104, p.y, t);
        const scale = lerp(0.42, 1, t) * p.scale;
        drawTinted(g, (l) => p.view.draw(l, x, y, scale), PAL.fogDark, Math.min(1, (1 - t) * 0.85 + dim));
      }
    }
    g.restore();
  }

  /** Wren stands on your side of the counter, close, so they are drawn after it and larger. */
  private drawWren(r: Renderer): void {
    const dim = (1 - this.room.light) * 0.5;
    drawTinted(r.g, (l) => this.wren.draw(l, WREN_SPOT.x, WREN_SPOT.y, 1.16), PAL.black, dim);
    const z = this.wrenZone;
    const canAsk = this.mode === 'counter' && !this.step && this.queue.length === 0 && this.state.visit;
    if (canAsk && this.game.input.over(z.x, z.y, z.w, z.h)) {
      r.text('ask Wren', WREN_SPOT.x, 92, { size: 6, align: 'center', color: PAL.wren });
    }
  }

  /** The strip along the bottom: dialogue on the left, buttons on the right. */
  private drawBand(r: Renderer): void {
    const { input } = this.game;
    const options = this.mode === 'talk' || this.step?.kind === 'choice';
    if (!options) {
      this.dialogue.draw(r, this.time, DIALOGUE, this.step?.kind === 'say');
      const idle = !this.step && this.queue.length === 0 && this.state.visit && this.mode === 'counter';
      if (idle && !this.dialogue.text) {
        r.text('Inspect them, talk to them, or decide.', DIALOGUE.x + 7, DIALOGUE.y + 6, { size: 7, color: PAL.inkDim });
      }
    }
    drawButtons(r, this.buttons, input);
  }

  private drawHud(r: Renderer): void {
    drawPanel(r.g, 6, 5, 62, 14);
    r.text(this.state.clock.label, 37, 8, { size: 8, bold: true, align: 'center', color: PAL.sodium });
    const def = this.state.def;
    r.text(`NIGHT ${def.number}  ·  ${def.title.toUpperCase()}`, 8, 23, { size: 6, color: PAL.inkDim });
    if (this.game.settings.muted) r.text('SOUND OFF  (M)', 8, 31, { size: 6, color: PAL.inkDim });
    if (this.game.debug) this.drawDebug(r);
  }

  /** ?debug: the numbers the player is never meant to see. */
  private drawDebug(r: Renderer): void {
    const s = this.state.stats;
    const v = this.state.visit;
    const rows = [`humanity ${s.humanity}   bond ${s.bond}   slip ${s.slip}`];
    if (v) {
      const kinds = v.def.people.map((p) => (p.isMimic ? 'MIMIC' : 'human')).join(' + ');
      rows.push(`${v.def.title}: ${kinds}`);
      rows.push(`drift ${v.drift.toFixed(2)}   patience ${v.patience}   wren wants: ${v.def.wren.advice}`);
    }
    drawPanel(r.g, 300, 3, 176, 5 + rows.length * 8);
    rows.forEach((row, i) => r.text(row, 304, 6 + i * 8, { size: 6, color: PAL.radio }));
  }

  private statsLine(): string {
    const s = this.state.stats;
    const outcomes = this.state.log.map((rec) => `${rec.visitor}:${rec.outcome}`).join('  ');
    return `humanity ${s.humanity}  bond ${s.bond}  slip ${s.slip}   ${outcomes}`;
  }
}
