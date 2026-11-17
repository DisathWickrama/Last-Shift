// The haunting: small things that go wrong in the shop on their own.
//
// Nothing here affects the rules of the game; it only decides WHEN something
// unsettling happens, and the night scene shows it. Events come more often the
// higher the night's `dread` (set in the night's JSON: 0.15, 0.5, 1) and the
// later the hour, so the three nights escalate without any event being scripted.
//
// The aim is slow tension, not jump scares: long gaps, quiet events, and things
// that are gone when you look again. Timing is random on purpose (this is
// cosmetic, so Math.random() is allowed here; see CLAUDE.md rule 6).

export type HauntEvent =
  | 'tear' // a split-second tear across the picture
  | 'figure' // somebody standing out by the pumps
  | 'glass' // knocking on the shop window
  | 'whisper' // the CB radio plays something you said earlier, in your voice
  | 'blackout' // the tubes go out for a couple of seconds
  | 'flash'; // a mimic's face slips for a single frame

export interface HauntContext {
  /** 0..1 from the night file. */
  dread: number;
  /** 0..1 how far through the shift. */
  progress: number;
  /** Your Slip stat: the more you slip, the more the picture tears. */
  slip: number;
  /** A mimic is at the counter and its drift is past halfway. */
  mimicSlipping: boolean;
}

export class Haunt {
  private wait = 25; // seconds until the next event
  /** How many times the figure has appeared tonight: it starts far away and comes closer. */
  figureVisits = 0;

  /** Call every step. Returns an event when one is due, otherwise null. */
  update(dt: number, c: HauntContext): HauntEvent | null {
    this.wait -= dt;
    if (this.wait > 0) return null;
    // Level rises with the night's dread and with the hour.
    const level = Math.min(1, c.dread * (0.55 + 0.6 * c.progress));
    this.wait = (34 - 22 * level) * (0.6 + Math.random() * 0.8);

    // Each event has a minimum level and a weight; pick one of those allowed, by weight.
    const table: [HauntEvent, number, number][] = [
      ['tear', 0, 2 + c.slip * 0.5],
      ['figure', 0.06, 3],
      ['glass', 0.3, 2],
      ['whisper', 0.3, 2],
      ['blackout', 0.5, 1.5 + level],
      ['flash', 0.3, c.mimicSlipping ? 4 : 0],
    ];
    const allowed = table.filter(([, min, weight]) => level >= min && weight > 0);
    let roll = Math.random() * allowed.reduce((sum, [, , w]) => sum + w, 0);
    for (const [event, , weight] of allowed) {
      roll -= weight;
      if (roll <= 0) {
        if (event === 'figure') this.figureVisits++;
        return event;
      }
    }
    return null;
  }
}
