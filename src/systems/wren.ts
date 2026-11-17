// Wren's voice: choosing which line Wren says.
//
// content/wren.json holds pools of lines keyed by what just happened, for
// example "serve.human" or "kind". Each line can require a minimum or maximum
// Bond, so Wren warms up or cools off as the night goes. This class picks a line
// that fits, and avoids repeating one until the pool is used up.

import type { WrenDef } from '../core/content';
import { Rng } from '../core/rng';
import type { Outcome } from './stats';

export class WrenVoice {
  private used = new Set<string>();
  private rng: Rng;

  constructor(private def: WrenDef, seed: number | string = 'wren') {
    this.rng = new Rng(seed);
  }

  /** A line for this situation at the current Bond, or null if the pool has nothing suitable. */
  line(key: string, bond: number): string | null {
    const pool = (this.def.lines[key] ?? []).filter(
      (l) => (l.minBond === undefined || bond >= l.minBond) && (l.maxBond === undefined || bond <= l.maxBond),
    );
    if (pool.length === 0) return null;
    const fresh = pool.filter((l) => !this.used.has(l.text));
    const pick = this.rng.pick(fresh.length > 0 ? fresh : pool);
    this.used.add(pick.text);
    return pick.text;
  }
}

/**
 * Which pool Wren reacts from after a visit ends: the outcome plus whether the
 * visitor was really a person. Wren always seems to know which it was.
 */
export function reactionKey(outcome: Outcome, people: readonly { isMimic: boolean }[]): string {
  const kind = people.some((p) => p.isMimic) ? 'mimic' : 'human';
  return `${outcome}.${kind}`;
}
