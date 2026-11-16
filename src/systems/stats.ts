// The three hidden stats, and the rules for how a decision moves them.
//
//   Humanity  people you saved minus people you doomed
//   Bond      your closeness with Wren
//   Slip      how much YOU are drifting
//
// The player never sees these numbers (unless ?debug is on). They shape Wren's
// lines, the dawn report and, in later nights, the ending.

export interface Stats {
  humanity: number;
  bond: number;
  slip: number;
}

export const zeroStats = (): Stats => ({ humanity: 0, bond: 0, slip: 0 });

/** The three things the player can choose to do with a visitor. */
export type Decision = 'serve' | 'turnAway' | 'shelter';

/**
 * Every way a visit can end. The first three are the player's decisions; the
 * rest happen to the player:
 *   walkout  a human lost patience with being inspected and left
 *   break    a mimic's drift reached the top and the mask came off
 *   missed   the shift ended before they were seen
 */
export type Outcome = Decision | 'walkout' | 'break' | 'missed';

export function addStats(a: Stats, b: Partial<Stats>): Stats {
  return {
    humanity: a.humanity + (b.humanity ?? 0),
    bond: a.bond + (b.bond ?? 0),
    slip: a.slip + (b.slip ?? 0),
  };
}

/**
 * The default rule for what an outcome does to the stats.
 *
 *              human                       mimic
 *   serve      +1 saved                    -1 it leaves wearing that face
 *   shelter    +1 saved                    -1 you let it in
 *   turnAway   -1 left in the fog           0 gone, for now
 *   walkout    -1 left in the fog           (mimics never walk out)
 *   break       0                           0, but +1 Slip: you pushed until it showed you
 *
 * A visitor's JSON can override this for special cases (see `effects`).
 */
export function outcomeEffects(people: readonly { isMimic: boolean }[], outcome: Outcome): Stats {
  const delta = zeroStats();
  for (const person of people) {
    if (person.isMimic) {
      if (outcome === 'serve' || outcome === 'shelter') delta.humanity -= 1;
    } else {
      if (outcome === 'serve' || outcome === 'shelter') delta.humanity += 1;
      if (outcome === 'turnAway' || outcome === 'walkout') delta.humanity -= 1;
    }
  }
  if (outcome === 'break') delta.slip += 1;
  return delta;
}
