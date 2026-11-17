// Automated playthrough: opens the game in a headless browser and plays all
// three nights, from the title screen to an ending card. Fails if the page logs
// any error or no ending is reached.
//
// A smoke test for what unit tests cannot reach (drawing, audio, the scene's
// command queue). It needs Playwright, which is NOT a dependency of this project:
//
//   npm run dev                                   (in one terminal)
//   node scripts/playtest.cjs                     (in another)
//   node scripts/playtest.cjs http://localhost:5173/ decent "Walk out,Open the storeroom"
//
// Arguments: [url] [strategy] [comma-separated bits of choice text to prefer]
//   strategies: wren (do what Wren asks) | decent (serve humans, refuse mimics)
//               serve | turnAway | shelter | inspect (keep checking until they leave)
//
// It drives the game through the debug hook that ?debug exposes as window.__ls.

const { chromium } = require('playwright');

const url = (process.argv[2] || 'http://localhost:5173/').replace(/\?.*$/, '') + '?debug&nowarn';
const strategy = process.argv[3] || 'wren';
const prefer = (process.argv[4] || '').split(',').filter(Boolean);
const LABEL = { serve: 'Serve', turnAway: 'Turn away', shelter: 'Shelter' };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(600);

  // Click a point given in the game's 480x270 virtual pixels.
  const clickAt = async (x, y) => {
    const box = await page.locator('#game').boundingBox();
    await page.mouse.click(box.x + (x / 480) * box.width, box.y + (y / 270) * box.height);
  };
  const info = () =>
    page.evaluate(() => {
      const ls = window.__ls;
      const s = ls && ls.scene;
      const c = ls.game.campaign;
      const base = { ending: c.ending || null, night: c.night, stats: c.stats };
      if (!s || s.over) return base;
      const v = s.state.visit;
      return {
        ...base,
        live: true,
        stats: s.state.stats,
        step: s.step ? s.step.kind : null,
        idle: !s.step && s.queue.length === 0,
        visit: v && { id: v.def.id, advice: v.def.wren.advice, actions: v.actions, mimic: v.def.people.some((p) => p.isMimic) },
        buttons: s.buttons.map((b) => ({ label: b.label, x: b.x + b.w / 2, y: b.y + b.h / 2, disabled: !!b.disabled })),
        log: s.state.log.map((r) => `${r.visitor}:${r.outcome}`),
      };
    });
  const press = async (s, text) => {
    const b = s.buttons.find((x) => x.label.includes(text) && !x.disabled);
    if (!b) throw new Error(`No button "${text}" among: ${s.buttons.map((x) => x.label).join(' | ')}`);
    await clickAt(b.x, b.y);
    await page.waitForTimeout(100);
  };

  const visits = [];
  let last = null;
  let turns = 0;
  for (let i = 0; i < 12000; i++) {
    const s = await info();
    last = s;
    if (s.ending) break;
    if (!s.live) {
      // Title screen: "New game" is the first button. A between-nights card: its button is lower down.
      await clickAt(240, 206);
      await page.waitForTimeout(500);
      if (!(await info()).live) await clickAt(240, 234);
      await page.waitForTimeout(600);
      continue;
    }
    if (s.log.length) visits.splice(0, visits.length, ...new Set([...visits, ...s.log.map((l) => `n${s.night + 1} ${l}`)]));
    if (s.step === 'say') {
      await clickAt(150, 235); // finish the line, then move on
      await page.waitForTimeout(25);
      await clickAt(150, 235);
    } else if (s.buttons.length > 0 && (s.step === 'choice' || s.idle)) {
      const labels = s.buttons.map((b) => b.label);
      if (labels.includes('Step back')) await press(s, 'Step back');
      else if (labels.includes('Decide')) await press(s, 'Decide');
      else if (labels.includes('Serve')) {
        const check = ['Wrists', 'Reflection', 'Shadow'][turns++ % 3];
        if (strategy === 'inspect') await press(s, check);
        else if (s.visit.actions === 0 && (strategy === 'wren' || strategy === 'decent')) await press(s, check);
        else if (strategy === 'wren') await press(s, LABEL[s.visit.advice]);
        else if (strategy === 'decent') await press(s, s.visit.mimic ? 'Turn away' : 'Serve');
        else await press(s, LABEL[strategy]);
      } else {
        // A choice in a script: a preferred option if one is on offer, else the first.
        const want = prefer.find((t) => labels.some((l) => l.includes(t)));
        await press(s, want || labels[0]);
      }
    }
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(1200);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
  await browser.close();

  console.log(`strategy: ${strategy}${prefer.length ? ` (prefers: ${prefer.join(', ')})` : ''}`);
  console.log(`visits:   ${visits.join('  ')}`);
  console.log(`stats:    ${JSON.stringify(last.stats)}`);
  console.log(`ending:   ${last.ending}`);
  if (errors.length > 0 || !last.ending) {
    console.error(errors.length > 0 ? `FAILED: page errors:\n${errors.join('\n')}` : 'FAILED: no ending was reached');
    process.exit(1);
  }
  console.log('OK: played from the title screen to an ending with no page errors.');
})();
