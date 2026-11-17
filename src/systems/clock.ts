// The shift clock: 10 pm to 6 am.
//
// Time is stored as minutes since the shift started, which makes "add 15
// minutes" trivial and keeps midnight from being a special case. Only the label
// shown to the player is converted back to a clock time.

/** Minutes from the start time to a clock time such as "23:35" or "01:05" (after midnight). */
export function minutesBetween(start: string, time: string): number {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  let diff = toMin(time) - toMin(start);
  if (diff < 0) diff += 24 * 60; // crossed midnight
  return diff;
}

export class Clock {
  /** Minutes since the shift began. Fractions are fine. */
  minutes = 0;
  readonly length: number;

  constructor(readonly start = '22:00', end = '06:00') {
    this.length = minutesBetween(start, end);
  }

  advance(minutes: number): void {
    this.minutes += minutes;
  }

  /** Jump forward to a clock time. Never goes backwards. */
  advanceTo(time: string): void {
    this.minutes = Math.max(this.minutes, minutesBetween(this.start, time));
  }

  /** Has the shift ended? */
  get done(): boolean {
    return this.minutes >= this.length;
  }

  /** 0 at the start of the shift, 1 at dawn. */
  get progress(): number {
    return Math.min(1, this.minutes / this.length);
  }

  /** "10:20 PM" */
  get label(): string {
    const [h0, m0] = this.start.split(':').map(Number);
    const total = (h0 * 60 + m0 + Math.floor(Math.min(this.minutes, this.length))) % (24 * 60);
    const h = Math.floor(total / 60);
    const m = total % 60;
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  }
}
