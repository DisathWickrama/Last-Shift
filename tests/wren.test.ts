// Tests for how Wren's lines are chosen.

import { describe, it, expect } from 'vitest';
import { WrenVoice, reactionKey } from '../src/systems/wren';
import type { WrenDef } from '../src/core/content';

const def: WrenDef = {
  face: { seed: 'wren' },
  lines: {
    hello: [{ text: 'a' }, { text: 'b' }, { text: 'c' }],
    close: [{ text: 'warm', minBond: 2 }, { text: 'cool', maxBond: -1 }],
  },
};

describe('WrenVoice', () => {
  it('does not repeat a line until the pool is used up', () => {
    const voice = new WrenVoice(def);
    const first = [voice.line('hello', 0), voice.line('hello', 0), voice.line('hello', 0)];
    expect(new Set(first).size).toBe(3);
    expect(['a', 'b', 'c']).toContain(voice.line('hello', 0)); // then it starts again
  });

  it('respects Bond limits on lines', () => {
    const voice = new WrenVoice(def);
    expect(voice.line('close', 3)).toBe('warm');
    expect(voice.line('close', -2)).toBe('cool');
    expect(voice.line('close', 0)).toBeNull();
  });

  it('returns null for a pool that does not exist', () => {
    expect(new WrenVoice(def).line('nothing', 0)).toBeNull();
  });
});

describe('reactionKey', () => {
  it('treats any group containing a mimic as a mimic', () => {
    expect(reactionKey('serve', [{ isMimic: false }])).toBe('serve.human');
    expect(reactionKey('serve', [{ isMimic: false }, { isMimic: true }])).toBe('serve.mimic');
  });
});
