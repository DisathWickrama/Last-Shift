// Fluoro flicker: how bright the tubes are from moment to moment.
//
// Most of the time the light is steady. Every so often a "burst" starts: the
// light stutters between on and dim for a fraction of a second. Bursts come
// more often, and get worse, as the night goes on (DESIGN.md).
//
// Accessibility: fast flashing is a real problem for some players. With
// `reduced` on (the F key, or the operating system's "reduce motion" setting)
// a burst becomes one slow, shallow dip instead of a stutter.

export class Flicker {
  /** Current brightness, 0..1. */
  light = 1;
  private wait = 6; // seconds until the next burst
  private burst = 0; // seconds left in the current burst
  private flip = 0; // seconds until the light next changes within a burst
  private low = 0.5;
  private time = 0;

  /** @param intensity 0 at the start of the shift, 1 at the end. */
  update(dt: number, intensity: number, reduced: boolean): number {
    this.time += dt;
    if (this.burst > 0) {
      this.burst -= dt;
      if (reduced) {
        // one gentle dip over the length of the burst
        this.light = 1 - 0.12 * Math.sin(Math.min(1, this.burst) * Math.PI);
      } else {
        this.flip -= dt;
        if (this.flip <= 0) {
          this.flip = 0.03 + Math.random() * 0.08;
          this.light = this.light < 1 ? 1 : this.low;
        }
      }
      if (this.burst <= 0) this.light = 1;
    } else {
      this.light = 1;
      this.wait -= dt;
      if (this.wait <= 0) {
        // Early: a short stutter every 12 s or so. Late: longer, deeper, every 3 to 4 s.
        this.wait = (12 - 8.5 * intensity) * (0.6 + Math.random() * 0.8);
        this.burst = 0.15 + Math.random() * (0.3 + 0.7 * intensity);
        this.low = 0.62 - 0.4 * intensity * Math.random();
      }
    }
    return this.light;
  }
}
