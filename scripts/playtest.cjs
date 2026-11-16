// Automated playthrough: opens the game in a headless browser, plays Night 1
// from the title screen to the end card, and fails if the page logs any error.
//
// This is a smoke test for the parts unit tests cannot reach (drawing, audio,
// the scene's command queue). It needs Playwright, which is NOT a dependency of
// this project. If you have it installed globally:
//
//   npm run dev                      (in one terminal)
//   node scripts/playtest.cjs        (in another)
//   node scripts/playtest.cjs http://localhost:4173/ shelter
//
// Arguments: [url] [serve | turnAway | shelter | wren | inspect]
//   wren     do one check, then whatever Wren asks
//   inspect  keep checking until every visitor walks out or breaks
//
// It drives the game through the debug hook that ?debug exposes as window.__ls.

const { chromium } = require('playwright');

const url = (process.argv[2] || 'http://localhost:5173/').replace(/\?.*$/, '') + '?debug';
const strategy = process.argv[3] || 'wren';
const LABEL = { serve: 'Serve', turnAway: 'Turn away', shelter: 'Shelter' };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  await page.waitForTimeout(600);

  // Click a point given in the game's 480x270 virtual pixels.
  const clickAt = async (x, y) => {
    const box = await page.locator('#game').boundingBox();
    await page.mouse.click(box.x + (x / 480) * box.width, box.y + (y / 270) * box.height);
  };
  const info = () =>
    page.evaluate(() => {
      const s = window.__ls && window.__ls.scene;
      if (!s) return null;
      return {
        step: s.step ? s.step.kind : null,
        idle: !s.step && s.queue.length === 0,
        over: s.over,
        visit: s.state.visit && { id: s.state.visit.def.id, advice: s.state.visit.def.wren.advice, actions: s.state.visit.actions },
        buttons: s.buttons.map((b) => ({ label: b.label, x: b.x + b.w / 2, y: b.y + b.h / 2, disabled: !!b.disabled })),
        stats: s.state.stats,
        log: s.state.log.map((r) => `${r.visitor}:${r.outcome}`),
      };
    });
  const press = async (s, text) => {
    const b = s.buttons.find((x) => x.label.includes(text) && !x.disabled);
    if (!b) throw new Error(`No button "${text}" among: ${s.buttons.map((x) => x.label).join(' | ')}`);
    await clickAt(b.x, b.y);
    await page.waitForTimeout(100);
  };

  await clickAt(240, 135); // title screen
  await page.waitForTimeout(1500);

  let last = null;
  let turns = 0;
  for (let i = 0; i < 4000; i++) {
    const s = await info();
    if (!s) break; // the night scene has been replaced by the end card
    last = s;
    if (s.over) break;
    if (s.step === 'say') {
      await clickAt(150, 235); // finish the line, then move on
      await page.waitForTimeout(30);
      await clickAt(150, 235);
    } else if (s.buttons.length > 0 && (s.step === 'choice' || s.idle)) {
      const labels = s.buttons.map((b) => b.label);
      if (labels.includes('Step back')) await press(s, 'Step back');
      else if (labels.includes('Serve')) {
        const check = ['Wrists', 'Reflection', 'Shadow'][turns++ % 3];
        if (strategy === 'inspect') await press(s, check);
        else if (strategy === 'wren') await press(s, s.visit.actions === 0 ? check : LABEL[s.visit.advice]);
        else await press(s, LABEL[strategy]);
      } else await press(s, labels[0]); // a choice in a script: take the first option
    }
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(1500);
  await browser.close();

  console.log(`strategy: ${strategy}`);
  console.log(`visits:   ${last ? last.log.join('  ') : '(none)'}`);
  console.log(`stats:    ${last ? JSON.stringify(last.stats) : '(none)'}`);
  const complete = last && last.log.length === 5;
  if (errors.length > 0 || !complete) {
    console.error(errors.length > 0 ? `FAILED: page errors:\n${errors.join('\n')}` : 'FAILED: the night did not reach its end');
    process.exit(1);
  }
  console.log('OK: Night 1 played from title to dawn with no page errors.');
})();
