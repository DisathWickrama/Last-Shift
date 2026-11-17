// Saving: the campaign between nights, and which endings you have found.
//
// The browser gives every site a small key-value store called localStorage. It
// only holds strings, so the campaign (plain numbers and strings: see
// systems/campaign.ts) is turned into JSON text on the way in and parsed on the
// way out. The game saves at each dawn, so "continue" always resumes at the
// start of a night.
//
// Everything is wrapped in try/catch: private-browsing windows can refuse
// storage, and a save that fails should never break the game.

import type { CampaignData } from '../systems/campaign';

const SAVE_KEY = 'last-shift:campaign:v1';
const ENDINGS_KEY = 'last-shift:endings:v1';

export function saveCampaign(campaign: CampaignData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(campaign));
  } catch {
    // no storage: the game simply will not offer "continue"
  }
}

/** The saved campaign, or null if there is none (or it is unreadable). */
export function loadCampaign(): CampaignData | null {
  try {
    const text = localStorage.getItem(SAVE_KEY);
    if (!text) return null;
    const data = JSON.parse(text) as Partial<CampaignData>;
    // Check the shape before trusting it: a save from an older version could be anything.
    if (typeof data.night !== 'number' || !data.stats || !Array.isArray(data.flags)) return null;
    return { night: data.night, stats: data.stats, flags: data.flags, ending: data.ending };
  } catch {
    return null;
  }
}

export function clearCampaign(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // nothing to clear
  }
}

/** Ids of the endings this player has reached, across all playthroughs. */
export function foundEndings(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(ENDINGS_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Remember an ending. Returns the updated list. */
export function recordEnding(id: string): string[] {
  const found = foundEndings();
  if (!found.includes(id)) found.push(id);
  try {
    localStorage.setItem(ENDINGS_KEY, JSON.stringify(found));
  } catch {
    // not saved; the card still shows this run's ending
  }
  return found;
}
