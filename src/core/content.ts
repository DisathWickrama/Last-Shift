// Content: the shape of the story JSON, and the code that loads it.
//
// All story text lives under content/ as JSON. This file does two jobs:
//   1. TypeScript interfaces describing what those files must contain. If a
//      JSON file is missing a field, the type-checker and tests/content.test.ts
//      say so.
//   2. Loading. `import.meta.glob` is a Vite feature: it finds every file that
//      matches a pattern at build time. Dropping a new visitor file into
//      content/visitors/ is enough; no code needs to change.

import type { FaceParams } from '../render/face';
import type { DriftTell } from '../systems/drift';
import type { Decision, Outcome, Stats } from '../systems/stats';
import type { CheckKind, Tone } from '../systems/inspections';

// --- what each check can show -------------------------------------------------

export type VeinTell = 'human' | 'none' | 'black' | 'silver' | 'moving' | 'mirrored';
export type ReflectionTell = 'human' | 'delayed' | 'wrongWay' | 'smiling' | 'missing';
export type ShadowTell = 'human' | 'none' | 'wrongDir' | 'many' | 'moves';

// --- lines of dialogue --------------------------------------------------------

/** Who is speaking. "visitor" is the first person in a visit, "companion" the second. */
export type Who = 'visitor' | 'companion' | 'wren' | 'you' | 'radio' | 'narration';

export interface Line {
  who: Who;
  text: string;
}

/** A condition on the current state of the night. Every field given must hold. */
export interface Cond {
  flag?: string;
  notFlag?: string;
  minBond?: number;
  maxBond?: number;
  minSlip?: number;
  maxSlip?: number;
  minHumanity?: number;
  maxHumanity?: number;
}

// --- visitors -----------------------------------------------------------------

export interface PersonDef {
  name: string;
  isMimic: boolean;
  /** A seed plus any sliders this person must always have. */
  face: { seed: string } & Partial<FaceParams>;
  /** 1 = adult (default). A child is about 0.75. */
  size?: number;
  tells: {
    veins: VeinTell;
    reflection: ReflectionTell;
    shadow: ShadowTell;
    /** Which face sliders go wrong as drift rises. Empty or missing for humans. */
    drift?: DriftTell[];
  };
}

export interface TopicDef {
  id: string;
  /** What you say. */
  ask: string;
  /** What they say back. "{echo}" is replaced by something you said earlier tonight. */
  answer: string;
  tone: Tone;
  /** Who answers. Default: the visitor. */
  who?: 'visitor' | 'companion';
  /** Narration shown after the answer. */
  note?: string;
  /** Only offered after this other topic has been asked. */
  requires?: string;
  /** Only offered after you have done this check. */
  requiresCheck?: CheckKind;
  /** Asking this makes the mimic drop the act. */
  triggers?: 'break';
  /** Override the default minutes for this tone. */
  minutes?: number;
}

export interface VisitorDef {
  id: string;
  /** Short description for the debug overlay, e.g. "Dale, trucker". */
  title: string;
  /** One or two people. The first one does the talking and pays. */
  people: PersonDef[];
  /** How many checks and questions a human will put up with. */
  patience: number;
  /** Multiplier on how fast a mimic drifts. Default 1. */
  driftRate?: number;
  /** Played as they reach the counter. */
  greeting: Line[];
  /** Said when patience has almost run out. */
  annoyed: string;
  /** Optional narration for each close-up. */
  notes?: Partial<Record<CheckKind, string>>;
  topics: TopicDef[];
  wren: {
    /** A remark as the visitor walks in. */
    arrive?: string;
    /** What Wren wants you to do. Wren is not always honest. */
    advice: Decision;
    adviceLine: string;
    /** Will Wren hand over the storeroom key for this visitor? */
    key: 'give' | 'refuse';
    /** A line for a specific outcome, used instead of Wren's general pool. */
    after?: Partial<Record<Outcome, string>>;
  };
  /** Lines played as the visit ends, by outcome. */
  leave: Partial<Record<Outcome, Line[]>>;
  /** What the morning radio says about them, by outcome. */
  report: Partial<Record<Outcome, string>>;
  /** Replace the default stat changes for an outcome (see systems/stats.ts). */
  effects?: Partial<Record<Outcome, Partial<Stats>>>;
  /** Flags to set when the visit ends a certain way (the room and scripts read these). */
  flags?: Partial<Record<Outcome, string[]>>;
}

// --- nights -------------------------------------------------------------------

export interface ChoiceDef {
  text: string;
  tone?: Tone;
  bond?: number;
  slip?: number;
  humanity?: number;
  set?: string;
  /** Beats that play if this option is picked. */
  then?: Beat[];
}

/** One step of a script: either a line (with optional effects) or a choice. */
export type Beat =
  | (Line & {
      /** A named effect: "static", "knock", "glitch", "gore", "dark", "song", "songOff", "bell"... */
      fx?: string;
      /** Skip this beat unless the condition holds. */
      if?: Cond;
      set?: string;
      clear?: string;
      bond?: number;
      slip?: number;
    })
  | { choice: ChoiceDef[]; if?: Cond };

export type TimelineEvent =
  | { type: 'script'; script: string; at?: string; if?: Cond }
  | { type: 'visitor'; visitor: string; at: string }
  | { type: 'dawn' };

export interface NightDef {
  id: string;
  number: number;
  title: string;
  start: string;
  end: string;
  /** What happens, in order. Must end with a "dawn" event. */
  timeline: TimelineEvent[];
  /** Named scripts that timeline events refer to. */
  scripts: Record<string, Beat[]>;
  /** The morning radio report. Each visitor's own line is slotted between intro and outro. */
  dawn: { intro: string[]; outro: string[] };
  /** Closing narration. Lines are shown if their condition holds. */
  epilogue: (Line & { if?: Cond })[];
  /** Shown on the end card. */
  next: string;
}

// --- Wren ---------------------------------------------------------------------

export interface WrenLine {
  text: string;
  minBond?: number;
  maxBond?: number;
}

export interface WrenDef {
  face: { seed: string } & Partial<FaceParams>;
  /** Pools of lines, keyed by what just happened (see systems/wren.ts for the keys). */
  lines: Record<string, WrenLine[]>;
}

// --- loading ------------------------------------------------------------------

const visitorFiles = import.meta.glob<VisitorDef>('../../content/visitors/*.json', { eager: true, import: 'default' });
const nightFiles = import.meta.glob<NightDef>('../../content/nights/*.json', { eager: true, import: 'default' });
const wrenFiles = import.meta.glob<WrenDef>('../../content/wren.json', { eager: true, import: 'default' });

function byId<T extends { id: string }>(files: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const def of Object.values(files)) out[def.id] = def;
  return out;
}

export const VISITORS: Record<string, VisitorDef> = byId(visitorFiles);
export const NIGHTS: Record<string, NightDef> = byId(nightFiles);
export const WREN: WrenDef = Object.values(wrenFiles)[0];
