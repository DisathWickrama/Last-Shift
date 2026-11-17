// Tests for the rules of a night. No canvas, no browser: NightState is pure
// logic, so a whole visit can be played with plain function calls.

import { describe, it, expect } from 'vitest';
import { NightState } from '../src/systems/night';
import { Clock, minutesBetween } from '../src/systems/clock';
import { outcomeEffects } from '../src/systems/stats';
import { CHECKS } from '../src/systems/inspections';
import type { NightDef, VisitorDef } from '../src/core/content';

// Small made-up content, so these tests do not break when the story is rewritten.
function visitor(id: string, isMimic: boolean, extra: Partial<VisitorDef> = {}): VisitorDef {
  return {
    id,
    title: id,
    people: [{
      name: id, isMimic, face: { seed: id },
      tells: { veins: 'human', reflection: 'human', shadow: 'human', drift: isMimic ? ['eyeDrop'] : [] },
    }],
    patience: 3,
    greeting: [],
    annoyed: 'Are we done?',
    topics: [
      { id: 'hello', ask: 'Long night?', answer: 'Long enough.', tone: 'neutral' },
      { id: 'kind', ask: 'Sit down a minute.', answer: 'Thanks.', tone: 'warm' },
      { id: 'cold', ask: 'Prove it.', answer: 'Prove what?', tone: 'cold' },
      { id: 'echo', ask: 'Say something.', answer: '{echo|nothing yet}', tone: 'neutral' },
      { id: 'later', ask: 'And then?', answer: 'Then nothing.', tone: 'neutral', requires: 'hello' },
    ],
    wren: { advice: 'serve', adviceLine: 'Serve them.', key: 'give' },
    leave: {},
    report: { serve: `${id} was served.`, turnAway: `${id} was turned away.` },
    ...extra,
  };
}

const night: NightDef = {
  id: 'test', number: 1, title: 'Test', start: '22:00', end: '06:00',
  timeline: [
    { type: 'visitor', visitor: 'human', at: '22:20' },
    { type: 'script', script: 'onlyIfFlag', if: { flag: 'never' } },
    { type: 'visitor', visitor: 'mimic', at: '23:40' },
    { type: 'dawn' },
  ],
  scripts: { onlyIfFlag: [] },
  dawn: { intro: [], outro: [] },
  epilogue: [],
  summary: [],
  next: '',
};

const cast = { human: visitor('human', false), mimic: visitor('mimic', true) };
const fresh = () => new NightState(night, cast);

describe('Clock', () => {
  it('measures minutes across midnight', () => {
    expect(minutesBetween('22:00', '23:35')).toBe(95);
    expect(minutesBetween('22:00', '01:05')).toBe(185);
    expect(minutesBetween('22:00', '06:00')).toBe(480);
  });

  it('shows a 12-hour label and ends at 6 am', () => {
    const clock = new Clock();
    expect(clock.label).toBe('10:00 PM');
    clock.advance(125);
    expect(clock.label).toBe('12:05 AM');
    clock.advance(400);
    expect(clock.done).toBe(true);
    expect(clock.label).toBe('6:00 AM');
  });

  it('never jumps backwards', () => {
    const clock = new Clock();
    clock.advance(200);
    clock.advanceTo('22:30');
    expect(clock.minutes).toBe(200);
  });
});

describe('outcomeEffects', () => {
  const human = [{ isMimic: false }];
  const mimic = [{ isMimic: true }];

  it('rewards saving a human and punishes abandoning one', () => {
    expect(outcomeEffects(human, 'serve').humanity).toBe(1);
    expect(outcomeEffects(human, 'shelter').humanity).toBe(1);
    expect(outcomeEffects(human, 'turnAway').humanity).toBe(-1);
    expect(outcomeEffects(human, 'walkout').humanity).toBe(-1);
  });

  it('punishes letting a mimic through, but not turning it away', () => {
    expect(outcomeEffects(mimic, 'serve').humanity).toBe(-1);
    expect(outcomeEffects(mimic, 'shelter').humanity).toBe(-1);
    expect(outcomeEffects(mimic, 'turnAway').humanity).toBe(0);
  });

  it('costs Slip when you push a mimic until it breaks', () => {
    expect(outcomeEffects(mimic, 'break').slip).toBe(1);
  });

  it('adds up a mixed pair', () => {
    expect(outcomeEffects([...human, ...mimic], 'serve').humanity).toBe(0);
  });
});

describe('NightState timeline', () => {
  it('walks the timeline in order, skipping scripts whose condition fails', () => {
    const s = fresh();
    expect(s.nextEvent()).toMatchObject({ type: 'visitor', visitor: 'human' });
    expect(s.clock.label).toBe('10:20 PM');
    expect(s.nextEvent()).toMatchObject({ type: 'visitor', visitor: 'mimic' });
    expect(s.nextEvent()).toMatchObject({ type: 'dawn' });
    expect(s.nextEvent()).toBeNull();
  });

  it('records visitors as missed once the shift has ended', () => {
    const s = fresh();
    s.nextEvent();
    s.clock.advance(600);
    expect(s.nextEvent()).toMatchObject({ type: 'dawn' });
    expect(s.log).toEqual([expect.objectContaining({ visitor: 'mimic', outcome: 'missed' })]);
  });
});

describe('NightState visits', () => {
  it('charges time and patience for a check, and more patience for repeating it', () => {
    const s = fresh();
    s.nextEvent();
    const v = s.beginVisit('human');
    const before = s.clock.minutes;
    s.inspect('wrist');
    expect(s.clock.minutes - before).toBe(CHECKS.wrist.minutes);
    expect(v.patience).toBe(2);
    s.inspect('wrist');
    expect(v.patience).toBe(0);
  });

  it('only drifts mimics', () => {
    const s = fresh();
    const human = s.beginVisit('human');
    s.inspect('wrist');
    s.tick(60);
    expect(human.drift).toBe(0);
    s.finish('serve');
    const mimic = s.beginVisit('mimic');
    s.inspect('wrist');
    expect(mimic.drift).toBeGreaterThan(0);
  });

  it('warns once, then a human walks out', () => {
    const s = fresh();
    s.beginVisit('human');
    expect(s.inspect('wrist')).toBe('ok');
    expect(s.inspect('shadow')).toBe('annoyed');
    s.warned();
    expect(s.inspect('reflection')).toBe('walkout');
  });

  it('a mimic never walks out; it breaks when drift peaks', () => {
    const s = fresh();
    const v = s.beginVisit('mimic');
    v.patience = 0;
    expect(s.status()).not.toBe('walkout');
    v.drift = 1;
    expect(s.status()).toBe('break');
  });

  it('offers follow-up topics only after their parent has been asked', () => {
    const s = fresh();
    s.beginVisit('human');
    expect(s.topics().map((t) => t.id)).not.toContain('later');
    s.ask('hello');
    expect(s.topics().map((t) => t.id)).toContain('later');
    expect(s.topics().map((t) => t.id)).not.toContain('hello');
  });

  it('raises Slip for cold questions', () => {
    const s = fresh();
    s.beginVisit('human');
    s.ask('cold');
    expect(s.stats.slip).toBe(1);
  });

  it('lets a mimic echo what you said to an earlier visitor', () => {
    const s = fresh();
    s.beginVisit('human');
    expect(s.ask('echo').answer).toBe('nothing yet'); // nothing said yet: the fallback
    s.finish('serve');
    s.beginVisit('mimic');
    expect(s.ask('echo').answer).toBe('Say something.');
  });

  it('moves Bond only when you have heard what Wren wants', () => {
    const s = fresh();
    s.beginVisit('human');
    expect(s.finish('turnAway').sided).toBeNull();
    expect(s.stats.bond).toBe(0);

    s.beginVisit('human');
    s.hearAdvice();
    expect(s.finish('serve').sided).toBe(true);
    expect(s.stats.bond).toBe(1);

    s.beginVisit('human');
    s.hearAdvice();
    expect(s.finish('turnAway').sided).toBe(false);
    expect(s.stats.bond).toBe(0);
  });

  it('costs Bond when you are kind to a traveller', () => {
    const s = fresh();
    s.beginVisit('human');
    s.ask('kind');
    s.finish('serve');
    expect(s.stats).toMatchObject({ humanity: 1, bond: -1 });
  });

  it('flags who is in the back after sheltering', () => {
    const s = fresh();
    s.beginVisit('mimic');
    s.finish('shelter');
    expect(s.flags.has('mimicInBack')).toBe(true);
    expect(s.stats.humanity).toBe(-1);
  });

  it('lets Bond change whether Wren hands over the key', () => {
    const s = fresh();
    s.beginVisit('human'); // this visitor's file says Wren gives the key
    expect(s.wrenGivesKey()).toBe(true);
    s.stats.bond = -5;
    expect(s.wrenGivesKey()).toBe(false);
    expect(s.wrenSulks()).toBe(true);
    s.stats.bond = 6;
    expect(s.wrenGivesKey()).toBe(true);
  });

  it('carries stats and flags in from an earlier night, minus the cleared ones', () => {
    const s = new NightState({ ...night, clearFlags: ['scone'] }, cast, { stats: { humanity: 2, bond: -1, slip: 3 }, flags: ['scone', 'dale:serve'] });
    expect(s.stats).toEqual({ humanity: 2, bond: -1, slip: 3 });
    expect(s.flags.has('dale:serve')).toBe(true);
    expect(s.flags.has('scone')).toBe(false);
    expect(s.test({ anyFlag: ['nope', 'dale:serve'] })).toBe(true);
    expect(s.test({ noFlags: ['dale:serve'] })).toBe(false);
  });

  it('records how each visit ended as a flag', () => {
    const s = fresh();
    s.beginVisit('human');
    s.finish('turnAway');
    expect(s.flags.has('human:turnAway')).toBe(true);
  });

  it('charges Slip for staring only once per visit', () => {
    const s = fresh();
    s.beginVisit('human');
    expect(s.stare()).toBe(true);
    expect(s.stare()).toBe(false);
    expect(s.stats.slip).toBe(1);
  });
});
