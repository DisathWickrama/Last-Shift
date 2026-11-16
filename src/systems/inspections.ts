// The four inspections and what each one costs.
//
// Every check takes time off the clock, wears down the visitor's patience, and
// (if the visitor is a mimic) gives it a moment to drift. The numbers live in
// one table so the balance of the whole game can be tuned in one place.

export type CheckKind = 'wrist' | 'reflection' | 'shadow';
export type InspectionKind = CheckKind | 'talk';
export type Tone = 'warm' | 'neutral' | 'cold' | 'strange';

export interface Cost {
  /** In-game minutes. */
  minutes: number;
  /** Added to a mimic's drift (0..1 scale). */
  drift: number;
  /** Taken from the visitor's patience. */
  patience: number;
}

export const CHECKS: Record<CheckKind, Cost & { label: string }> = {
  wrist: { label: 'Wrists', minutes: 15, drift: 0.08, patience: 1 },
  reflection: { label: 'Reflection', minutes: 10, drift: 0.06, patience: 1 },
  shadow: { label: 'Shadow', minutes: 10, drift: 0.06, patience: 1 },
};

/** Doing the same check twice on one visitor is rude: it costs this much extra patience. */
export const REPEAT_PENALTY = 1;

/** What a question costs depends on how you ask it. Cold and strange questions also raise your Slip. */
export const TONES: Record<Tone, Cost & { slip: number }> = {
  warm: { minutes: 10, drift: 0.05, patience: 0, slip: 0 },
  neutral: { minutes: 10, drift: 0.07, patience: 1, slip: 0 },
  cold: { minutes: 10, drift: 0.16, patience: 2, slip: 1 },
  strange: { minutes: 10, drift: 0.12, patience: 1, slip: 1 },
};

/** While a visitor stands at the counter the clock keeps running: game minutes per real second. */
export const MINUTES_PER_SECOND = 0.3;
/** ...and a mimic keeps drifting: drift per real second. */
export const DRIFT_PER_SECOND = 0.0035;
/** Seconds of staring into the mirror (or at your own hands) before it costs you. */
export const STARE_SECONDS = 10;
