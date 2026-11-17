// Content checks: catch mistakes in the story JSON before a player does.
//
// The JSON is typed in src/core/content.ts, but types cannot see things like
// "this night mentions a visitor that has no file". These tests can. They also
// play the real Night 1 through NightState, with no screen, to prove it reaches dawn.

import { describe, it, expect } from 'vitest';
import { VISITORS, NIGHTS, WREN, type Beat, type VisitorDef } from '../src/core/content';
import { NightState } from '../src/systems/night';
import { buildReport } from '../src/systems/report';
import { ALL_TELLS } from '../src/systems/drift';
import type { Decision, Outcome } from '../src/systems/stats';

const DECISIONS: Decision[] = ['serve', 'turnAway', 'shelter'];
/** Every pool of Wren's lines that the game code asks for by name. */
const WREN_KEYS = [
  'serve.human', 'serve.mimic', 'turnAway.human', 'turnAway.mimic', 'shelter.human', 'shelter.mimic',
  'walkout.human', 'break.mimic', 'sided', 'defied', 'kind', 'mirror', 'hands',
  'keyGive', 'keyRefuse', 'keyInsist', 'keyBackDown', 'poke', 'sulk', 'devoted',
];

const visitors = Object.values(VISITORS);
const nights = Object.values(NIGHTS);

describe('visitors', () => {
  it('loads at least the Night 1 cast', () => {
    expect(Object.keys(VISITORS)).toEqual(expect.arrayContaining(['dale', 'maureen', 'backpackers', 'gus', 'kid']));
  });

  it.each(visitors.map((v) => [v.id, v] as const))('%s is complete', (_id, v: VisitorDef) => {
    expect(v.people.length).toBeGreaterThanOrEqual(1);
    expect(v.people.length).toBeLessThanOrEqual(2);
    expect(v.greeting.length).toBeGreaterThan(0);
    expect(v.annoyed).toBeTruthy();

    const hasMimic = v.people.some((p) => p.isMimic);
    const hasHuman = v.people.some((p) => !p.isMimic);
    // Every way the visit can end needs leaving lines and a line for the dawn report.
    const outcomes: Outcome[] = [...DECISIONS];
    if (hasHuman) outcomes.push('walkout');
    if (hasMimic) outcomes.push('break');
    // (The dawn report only matters for visitors on a night that has a dawn.)
    const reported = nights.some((n) => n.timeline.some((e) => e.type === 'dawn') && n.timeline.some((e) => e.type === 'visitor' && e.visitor === v.id));
    for (const outcome of outcomes) {
      expect(v.leave[outcome]?.length, `leave.${outcome}`).toBeGreaterThan(0);
      if (reported) expect(v.report[outcome], `report.${outcome}`).toBeTruthy();
    }
    if (reported) expect(v.report.missed, 'report.missed').toBeTruthy();
    if (v.decide) expect(nights.some((n) => n.scripts[v.decide!]), `decide script ${v.decide}`).toBe(true);

    for (const person of v.people) {
      const drift = person.tells.drift ?? [];
      if (person.isMimic) expect(drift.length, `${person.name} needs drift tells`).toBeGreaterThan(0);
      else expect(drift.length, `${person.name} is human and must not drift`).toBe(0);
      for (const tell of drift) expect(ALL_TELLS).toContain(tell);
    }
    // A mimic must be catchable: at least one check has to show something wrong.
    if (hasMimic) {
      const wrong = v.people.some(
        (p) => p.isMimic && (p.tells.veins !== 'human' || p.tells.reflection !== 'human' || p.tells.shadow !== 'human'),
      );
      expect(wrong, 'mimic with no visible tell').toBe(true);
    }

    const ids = v.topics.map((t) => t.id);
    expect(new Set(ids).size, 'duplicate topic id').toBe(ids.length);
    for (const topic of v.topics) {
      if (topic.requires) expect(ids, `topic ${topic.id} requires a missing topic`).toContain(topic.requires);
      if (topic.who === 'companion') expect(v.people.length).toBe(2);
      // An option has to fit on one row of the choice list.
      expect(topic.ask.length, `"${topic.ask}" is too long for one row`).toBeLessThanOrEqual(80);
    }
    expect(DECISIONS).toContain(v.wren.advice);
    expect(v.wren.adviceLine).toBeTruthy();
  });
});

describe('nights', () => {
  it.each(nights.map((n) => [n.id, n] as const))('%s refers only to things that exist', (_id, night) => {
    expect(['dawn', 'ending']).toContain(night.timeline[night.timeline.length - 1].type);
    for (const ev of night.timeline) {
      if (ev.type === 'visitor') expect(VISITORS[ev.visitor], `visitor ${ev.visitor}`).toBeDefined();
      if (ev.type === 'script') expect(night.scripts[ev.script], `script ${ev.script}`).toBeDefined();
    }
    const checkBeats = (beats: Beat[]): void => {
      for (const beat of beats) {
        if ('choice' in beat) {
          expect(beat.choice.length).toBeGreaterThanOrEqual(2);
          expect(beat.choice.length).toBeLessThanOrEqual(5);
          for (const c of beat.choice) {
            expect(c.text.length).toBeLessThanOrEqual(80);
            checkBeats(c.then ?? []);
          }
        } else {
          expect(beat.text).toBeTruthy();
        }
      }
    };
    Object.values(night.scripts).forEach(checkBeats);
    checkBeats(night.epilogue);
    expect(night.summary.length).toBeGreaterThan(0);
  });

  it.each(nights.filter((n) => n.timeline.some((e) => e.type === 'dawn')).map((n) => [n.id, n] as const))('%s always has three things to say on the end card, whatever the stats', (_id, night) => {
    for (let humanity = -9; humanity <= 9; humanity += 1) {
      for (let bond = -12; bond <= 12; bond++) {
        for (let slip = 0; slip <= 8; slip++) {
          const state = new NightState(night, VISITORS);
          state.stats = { humanity, bond, slip };
          const shown = night.summary.filter((line) => state.test(line.if));
          expect(shown.length, `h${humanity} b${bond} s${slip}`).toBe(3);
        }
      }
    }
  });
});

describe('Wren', () => {
  it('has a pool for every situation the code asks about', () => {
    for (const key of WREN_KEYS) expect(WREN.lines[key]?.length, key).toBeGreaterThan(0);
  });

  it('has at least the 10 to 15 reactive lines the design asks for', () => {
    const total = Object.values(WREN.lines).reduce((n, pool) => n + pool.length, 0);
    expect(total).toBeGreaterThanOrEqual(15);
  });

  it('always has an unconditional line in each pool, so Wren is never silent', () => {
    for (const [key, pool] of Object.entries(WREN.lines)) {
      expect(pool.some((l) => l.minBond === undefined && l.maxBond === undefined), key).toBe(true);
    }
  });
});

describe('Night 1, played without a screen', () => {
  /** Play the whole timeline making the same decision for everyone. */
  function play(decision: Decision): NightState {
    const state = new NightState(NIGHTS.night1, VISITORS);
    for (let guard = 0; guard < 100; guard++) {
      const ev = state.nextEvent();
      if (!ev || ev.type === 'dawn') break;
      if (ev.type === 'visitor') {
        state.beginVisit(ev.visitor);
        state.inspect('wrist');
        state.inspect('reflection');
        state.finish(decision);
      } else if (ev.type === 'script') {
        // A script: apply every unconditional effect, taking the first option of each choice.
        for (const beat of state.script(ev.script)) {
          if ('choice' in beat) state.apply(beat.choice[0]);
          else if (state.test(beat.if)) state.apply(beat);
        }
      }
    }
    return state;
  }

  it.each(DECISIONS)('reaches dawn with a full report when you always %s', (decision) => {
    const state = play(decision);
    expect(state.clock.done).toBe(true);
    expect(state.log.map((r) => r.visitor)).toEqual(['dale', 'maureen', 'backpackers', 'gus', 'kid']);
    const report = buildReport(NIGHTS.night1, state.log, VISITORS);
    expect(report.length).toBe(5 + 2);
    for (const line of report) expect(line).toBeTruthy();
  });

  it('serving everyone saves the humans and lets the mimics through', () => {
    // Dale +1, Maureen +1, Jess +1 and Tom -1, Gus +1, the kid -1
    expect(play('serve').stats.humanity).toBe(2);
  });

  it('sheltering a mimic sets up the storeroom scene, which clears itself', () => {
    const state = play('shelter');
    expect(state.flags.has('marks')).toBe(true);
    expect(state.flags.has('mimicInBack')).toBe(false);
  });
});
