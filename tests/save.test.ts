// Tests for saving. Vitest runs in Node, which has no localStorage, so each
// test installs a tiny stand-in (a Map behind the same three methods).

import { describe, it, expect, beforeEach } from 'vitest';
import { saveCampaign, loadCampaign, clearCampaign, foundEndings, recordEnding } from '../src/core/save';

function fakeStorage(): Map<string, string> {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  return store;
}

describe('saving', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = fakeStorage();
  });

  it('round-trips a campaign', () => {
    const campaign = { night: 1, stats: { humanity: 2, bond: -1, slip: 3 }, flags: ['dale:serve', 'photoFlipped'] };
    saveCampaign(campaign);
    expect(loadCampaign()).toEqual({ ...campaign, ending: undefined });
  });

  it('returns null when there is no save, or the save is rubbish', () => {
    expect(loadCampaign()).toBeNull();
    store.set('last-shift:campaign:v1', '{not json');
    expect(loadCampaign()).toBeNull();
    store.set('last-shift:campaign:v1', '{"night":"two"}');
    expect(loadCampaign()).toBeNull();
  });

  it('forgets the campaign but keeps the endings', () => {
    saveCampaign({ night: 2, stats: { humanity: 0, bond: 0, slip: 0 }, flags: [] });
    expect(recordEnding('closeEnough')).toEqual(['closeEnough']);
    expect(recordEnding('closeEnough')).toEqual(['closeEnough']); // no duplicates
    expect(recordEnding('fogLifts')).toEqual(['closeEnough', 'fogLifts']);
    clearCampaign();
    expect(loadCampaign()).toBeNull();
    expect(foundEndings()).toEqual(['closeEnough', 'fogLifts']);
  });

  it('does not throw when storage is unavailable', () => {
    delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
    expect(() => saveCampaign({ night: 1, stats: { humanity: 0, bond: 0, slip: 0 }, flags: [] })).not.toThrow();
    expect(loadCampaign()).toBeNull();
    expect(foundEndings()).toEqual([]);
  });
});
