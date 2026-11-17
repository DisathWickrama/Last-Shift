// The game loop.
//
// Pattern: "fixed timestep". The browser calls us back roughly every screen
// refresh (60, 120, 144 times a second, depending on the monitor). If game logic
// ran once per callback, the game would run faster on a faster monitor. So we
// measure how much real time passed, and run the logic in fixed 1/60 s steps
// until we have caught up. Drawing happens once per callback.
//
//   update(dt)  -> game logic, always called with the same dt
//   draw()      -> paint the current state

const STEP = 1 / 60;
const MAX_FRAME = 0.25; // if the tab was in the background, don't try to catch up minutes of time

export function startLoop(update: (dt: number) => void, draw: () => void): void {
  let last = performance.now();
  let owed = 0; // seconds of game time we still have to simulate

  function frame(now: number): void {
    owed += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    while (owed >= STEP) {
      update(STEP);
      owed -= STEP;
    }
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
