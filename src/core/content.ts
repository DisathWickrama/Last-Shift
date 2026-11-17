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
  /**
   * A named effect that fires as the line starts: "static" / "radioOff" (the CB
   * radio), "knock", "glitch", "gore", "dark" / "lights", "song" / "songOff", "bell", "photo".
   */
  fx?: string;
  /** Set or clear a flag as the line starts. */
  set?: string;
  clear?: string;
}

/** A condition on the current state of the night. Every field given must hold. */
export interface Cond {
  flag?: string;
  notFlag?: string;
  /** True if at least one of these flags is set. */
  anyFlag?: string[];
  /** True only if none of these flags is set. */
  noFlags?: string[];
  minBond?: number;
  maxBond?: number;
  minSlip?: number;
  maxSlip?: number;
  minHumanity?: number;
  maxHumanity?: number;
}

// --- visitors -----------------------------------------------------------------

export type FaceSpec = { seed: string } & Partial<FaceParams>;

export interface PersonDef {
  name: string;
  isMimic: boolean;
  /**
   * A seed plus any sliders this person must always have. Or `{ "like": "self" }`
   * / `{ "like": "wren" }` to wear a face defined elsewhere (content/self.json, content/wren.json).
   */
  face: FaceSpec | { like: 'self' | 'wren' };
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
  /**
   * Name of a script in the night file to run instead of the three decision
   * buttons. Its choices end the visit through their `outcome` field.
   */
  decide?: string;
}

// --- nights -------------------------------------------------------------------

export interface ChoiceDef {
  text: string;
  /** Only offer this option when the condition holds. */
  if?: Cond;
  /** End the current visit this way once the option's beats have played. */
  outcome?: Outcome;
  bond?: number;
  slip?: number;
  humanity?: number;
  set?: string;
  /** Beats that play if this option is picked. */
  then?: Beat[];
}

/** One step of a script: either a line (with optional conditions and stat changes) or a choice. */
export type Beat =
  | (Line & {
      /** Skip this beat unless the condition holds. */
      if?: Cond;
      bond?: number;
      slip?: number;
      humanity?: number;
    })
  | { choice: ChoiceDef[]; if?: Cond };

export type TimelineEvent =
  | { type: 'script'; script: string; at?: string; if?: Cond }
  | { type: 'visitor'; visitor: string; at: string; if?: Cond }
  | { type: 'dawn' }
  /** Stop the night here and play whichever ending matches (see content/endings.json). */
  | { type: 'ending'; if?: Cond };

export interface NightDef {
  id: string;
  number: number;
  title: string;
  start: string;
  end: string;
  /** Flags from earlier nights that should not carry into this one (last night's scone, and so on). */
  clearFlags?: string[];
  /** 0..1: how hard the building leans on you tonight (flicker, figures, knocking). */
  dread?: number;
  /** Which generated score plays tonight. */
  score?: number;
  /** What happens, in order. Must end with a "dawn" or "ending" event. */
  timeline: TimelineEvent[];
  /** Named scripts that timeline events refer to. */
  scripts: Record<string, Beat[]>;
  /** The morning radio report. Each visitor's own line is slotted between intro and outro. */
  dawn: { intro: string[]; outro: string[] };
  /** A script played after the dawn report, before the end card. */
  epilogue: Beat[];
  /** Sentences for the end card. Each is shown if its condition holds. */
  summary: { text: string; if?: Cond }[];
  /** Shown at the bottom of the end card. */
  next: string;
}

// --- Wren ---------------------------------------------------------------------

export interface WrenLine {
  text: string;
  minBond?: number;
  maxBond?: number;
}

export interface WrenDef {
  face: FaceSpec;
  /** Pools of lines, keyed by what just happened (see systems/wren.ts for the keys). */
  lines: Record<string, WrenLine[]>;
}

// --- endings ------------------------------------------------------------------

export interface EndingDef {
  id: string;
  title: string;
  /** The first ending in the file whose condition holds is the one you get. */
  if?: Cond;
  /** Played in the shop before the card. */
  script: Beat[];
  /** The sentences on the final card. */
  card: string[];
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

const endingFiles = import.meta.glob<{ endings: EndingDef[] }>('../../content/endings.json', { eager: true, import: 'default' });
const selfFiles = import.meta.glob<{ face: FaceSpec }>('../../content/self.json', { eager: true, import: 'default' });
export const ENDINGS: EndingDef[] = Object.values(endingFiles)[0]?.endings ?? [];
/** Your own face. You do not get to see it until late. */
export const SELF: { face: FaceSpec } = Object.values(selfFiles)[0] ?? { face: { seed: 'sam' } };

/** Nights in playing order. */
export const NIGHT_ORDER: NightDef[] = Object.values(NIGHTS).sort((a, b) => a.number - b.number);

/** Turn a person's `face` field into a concrete face spec. */
export function resolveFace(face: PersonDef['face']): FaceSpec {
  if ('like' in face) return face.like === 'wren' ? WREN.face : SELF.face;
  return face;
}
