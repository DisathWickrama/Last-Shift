// NightState: the rules of one night, with no drawing in it.
//
// This is the "model" of the game. It knows the clock, the hidden stats, who is
// at the counter, how drifted and how patient they are, and what has happened so
// far. The night scene (src/scenes/night.ts) asks it questions and tells it what
// the player did; everything on screen is derived from what is stored here.
//
// Because nothing here touches the canvas, the whole night can be played from a
// unit test: see tests/night.test.ts.

import type { Beat, Cond, NightDef, TimelineEvent, TopicDef, VisitorDef } from '../core/content';
import { clamp } from '../core/rng';
import { Clock } from './clock';
import { BREAK_AT } from './drift';
import {
  CHECKS, TONES, REPEAT_PENALTY, MINUTES_PER_SECOND, DRIFT_PER_SECOND,
  type CheckKind, type InspectionKind,
} from './inspections';
import { type Decision, type Outcome, type Stats, addStats, outcomeEffects, zeroStats } from './stats';

/** What should happen next with the visitor at the counter. */
export type VisitStatus =
  | 'ok'
  | 'annoyed' // patience nearly gone: they say so, once
  | 'walkout' // a human has had enough and leaves
  | 'break'; // a mimic's drift hit the top

export interface VisitState {
  def: VisitorDef;
  /** 0..1. Only matters if one of the people is a mimic. */
  drift: number;
  patience: number;
  asked: Set<string>;
  checked: Set<CheckKind>;
  /** Checks and questions so far. */
  actions: number;
  /** Has Wren told you what they want done with this visitor? */
  heardAdvice: boolean;
  /** Were you kind to them? (Wren notices.) */
  wasWarm: boolean;
  /** Has the "annoyed" line been said? */
  warned: boolean;
  /** Have you already paid for staring during this visit? */
  stared: boolean;
}

export interface VisitRecord {
  visitor: string;
  outcome: Outcome;
  /** Did you do what Wren wanted? null if Wren never said. */
  sided: boolean | null;
  delta: Stats;
}

export class NightState {
  readonly clock: Clock;
  stats: Stats = zeroStats();
  /** Named facts about the night: "scone", "mimicInBack", "photoFlipped"... */
  flags = new Set<string>();
  /** How each visit ended, in order. The dawn report is built from this. */
  log: VisitRecord[] = [];
  /** Things you have said to visitors tonight. Mimics borrow from this list. */
  said: { visitor: string; text: string }[] = [];
  /** How many times each inspection has been used tonight (later nights: mimics learn from this). */
  uses: Record<InspectionKind, number> = { wrist: 0, reflection: 0, shadow: 0, talk: 0 };
  /** The visit in progress, or null between visitors. */
  visit: VisitState | null = null;

  private cursor = 0;

  constructor(readonly def: NightDef, private visitors: Record<string, VisitorDef>) {
    this.clock = new Clock(def.start, def.end);
  }

  // --- the timeline -----------------------------------------------------------

  /**
   * The next thing that should happen, or null when the timeline is finished.
   * Skips events whose condition fails. Once the clock passes the end of the
   * shift, visitors who have not arrived are recorded as "missed" and everything
   * except dawn is skipped.
   */
  nextEvent(): TimelineEvent | null {
    while (this.cursor < this.def.timeline.length) {
      const ev = this.def.timeline[this.cursor++];
      if (ev.type === 'dawn') {
        this.clock.minutes = Math.max(this.clock.minutes, this.clock.length);
        return ev;
      }
      if (this.clock.done) {
        if (ev.type === 'visitor') {
          this.log.push({ visitor: ev.visitor, outcome: 'missed', sided: null, delta: zeroStats() });
        }
        continue;
      }
      if (ev.type === 'script' && ev.if && !this.test(ev.if)) continue;
      if (ev.at) this.clock.advanceTo(ev.at);
      return ev;
    }
    return null;
  }

  /** Does a condition from the content hold right now? */
  test(cond: Cond | undefined): boolean {
    if (!cond) return true;
    const s = this.stats;
    if (cond.flag !== undefined && !this.flags.has(cond.flag)) return false;
    if (cond.notFlag !== undefined && this.flags.has(cond.notFlag)) return false;
    if (cond.minBond !== undefined && s.bond < cond.minBond) return false;
    if (cond.maxBond !== undefined && s.bond > cond.maxBond) return false;
    if (cond.minSlip !== undefined && s.slip < cond.minSlip) return false;
    if (cond.maxSlip !== undefined && s.slip > cond.maxSlip) return false;
    if (cond.minHumanity !== undefined && s.humanity < cond.minHumanity) return false;
    if (cond.maxHumanity !== undefined && s.humanity > cond.maxHumanity) return false;
    return true;
  }

  /** Apply the side effects a line, script beat or choice can carry. */
  apply(effect: Partial<Stats> & { set?: string; clear?: string }): void {
    this.stats = addStats(this.stats, effect);
    if (effect.set) this.flags.add(effect.set);
    if (effect.clear) this.flags.delete(effect.clear);
  }

  /** Beats of a script that should play now (conditions checked at the time the script starts). */
  script(name: string): Beat[] {
    return this.def.scripts[name] ?? [];
  }

  // --- a visit ----------------------------------------------------------------

  beginVisit(id: string): VisitState {
    const def = this.visitors[id];
    if (!def) throw new Error(`Unknown visitor "${id}"`);
    this.visit = {
      def,
      drift: 0,
      // High Slip makes people uneasy around you before you have said a word.
      patience: def.patience - (this.stats.slip >= 3 ? 1 : 0),
      asked: new Set(),
      checked: new Set(),
      actions: 0,
      heardAdvice: false,
      wasWarm: false,
      warned: false,
      stared: false,
    };
    return this.visit;
  }

  private get hasMimic(): boolean {
    return !!this.visit?.def.people.some((p) => p.isMimic);
  }

  private get hasHuman(): boolean {
    return !!this.visit?.def.people.some((p) => !p.isMimic);
  }

  private addDrift(amount: number): void {
    const v = this.visit;
    if (!v || !this.hasMimic) return;
    v.drift = clamp(v.drift + amount * (v.def.driftRate ?? 1), 0, BREAK_AT);
  }

  /** Real time passing while someone stands at the counter. */
  tick(dt: number): void {
    if (!this.visit) return;
    this.clock.advance(dt * MINUTES_PER_SECOND);
    this.addDrift(dt * DRIFT_PER_SECOND);
  }

  /** Do one of the three look-at-them checks. */
  inspect(kind: CheckKind): VisitStatus {
    const v = this.need();
    const cost = CHECKS[kind];
    this.clock.advance(cost.minutes);
    this.addDrift(cost.drift);
    v.patience -= cost.patience + (v.checked.has(kind) ? REPEAT_PENALTY : 0);
    v.checked.add(kind);
    v.actions++;
    this.uses[kind]++;
    return this.status();
  }

  /** Questions you can ask right now: not asked yet, and their requirements met. */
  topics(): TopicDef[] {
    const v = this.need();
    return v.def.topics.filter(
      (t) =>
        !v.asked.has(t.id) &&
        (!t.requires || v.asked.has(t.requires)) &&
        (!t.requiresCheck || v.checked.has(t.requiresCheck)),
    );
  }

  /** Ask a question. Returns the answer with any {echo} filled in. */
  ask(id: string): { topic: TopicDef; answer: string; status: VisitStatus } {
    const v = this.need();
    const topic = v.def.topics.find((t) => t.id === id);
    if (!topic) throw new Error(`Unknown topic "${id}"`);
    const cost = TONES[topic.tone];
    // Fill in the echo BEFORE recording this question, so a mimic cannot echo the question it is answering.
    const answer = this.fill(topic.answer);
    this.clock.advance(topic.minutes ?? cost.minutes);
    this.addDrift(cost.drift);
    v.patience -= cost.patience;
    this.stats.slip += cost.slip;
    if (topic.tone === 'warm') v.wasWarm = true;
    v.asked.add(id);
    v.actions++;
    this.uses.talk++;
    this.said.push({ visitor: v.def.id, text: topic.ask });
    if (topic.triggers === 'break') v.drift = BREAK_AT;
    return { topic, answer, status: this.status() };
  }

  /**
   * Replace "{echo}" with something you said earlier tonight, preferably to a
   * different visitor. "{echo|fallback}" gives the text to use if you have said nothing yet.
   */
  fill(text: string): string {
    return text.replace(/\{echo(?:\|([^}]*))?\}/g, (_m, fallback: string | undefined) => {
      const here = this.visit?.def.id;
      const earlier = this.said.find((s) => s.visitor !== here) ?? this.said[0];
      return earlier?.text ?? fallback ?? '';
    });
  }

  /** Staring into the mirror, or at your own hands, for too long. Costs Slip once per visit. */
  stare(): boolean {
    const v = this.need();
    if (v.stared) return false;
    v.stared = true;
    this.stats.slip += 1;
    return true;
  }

  /** Wren says what they want done. From now on your decision counts as siding or defying. */
  hearAdvice(): string {
    const v = this.need();
    v.heardAdvice = true;
    return v.def.wren.adviceLine;
  }

  status(): VisitStatus {
    const v = this.need();
    if (this.hasMimic && v.drift >= BREAK_AT) return 'break';
    // Mimics never walk out: they want to be let in. Only a human gives up on you.
    if (v.patience <= 0 && this.hasHuman) return 'walkout';
    if (v.patience <= 1 && !v.warned) return 'annoyed';
    return 'ok';
  }

  /** Mark the "annoyed" line as said, so it is only said once. */
  warned(): void {
    this.need().warned = true;
  }

  /** Will Wren hand over the storeroom key for this visitor? */
  wrenGivesKey(): boolean {
    return this.need().def.wren.key === 'give';
  }

  /** You pushed past Wren's "no". */
  insistOnKey(): void {
    this.stats.bond -= 2;
  }

  /** End the visit. Works out the stat changes, records it, and clears the counter. */
  finish(outcome: Outcome): VisitRecord {
    const v = this.need();
    const def = v.def;
    let delta = { ...outcomeEffects(def.people, outcome), ...(def.effects?.[outcome] ?? {}) } as Stats;

    // Bond: did you do what Wren asked? Only counts if you actually heard it.
    let sided: boolean | null = null;
    const decided = outcome === 'serve' || outcome === 'turnAway' || outcome === 'shelter';
    if (decided && v.heardAdvice) {
      sided = (outcome as Decision) === def.wren.advice;
      delta = addStats(delta, { bond: sided ? 1 : -1 });
    }
    // Wren is quietly jealous when you are kind to a traveller.
    if (v.wasWarm) delta = addStats(delta, { bond: -1 });

    this.stats = addStats(this.stats, delta);
    for (const flag of def.flags?.[outcome] ?? []) this.flags.add(flag);
    if (outcome === 'shelter') this.flags.add(this.hasMimic ? 'mimicInBack' : 'humanInBack');

    const record: VisitRecord = { visitor: def.id, outcome, sided, delta };
    this.log.push(record);
    this.visit = null;
    return record;
  }

  private need(): VisitState {
    if (!this.visit) throw new Error('No visitor at the counter');
    return this.visit;
  }
}
