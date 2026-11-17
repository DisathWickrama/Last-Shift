// The campaign: what carries from one night to the next.
//
// A night is played by NightState. When it ends, the campaign "absorbs" it:
// the hidden stats and the flags are kept, and the next night starts from them.
// That is how a choice on Night 1 can change who walks in on Night 2.
//
// A Campaign is plain data (numbers and strings), so saving the game is just
// writing it out as JSON: see src/core/save.ts.

import type { Cond, EndingDef } from '../core/content';
import type { NightState } from './night';
import { type Stats, zeroStats } from './stats';

export interface CampaignData {
  /** Index of the next night to play (0 = Night 1). */
  night: number;
  stats: Stats;
  flags: string[];
  /** Id of the ending reached, once the game is over. */
  ending?: string;
}

export const newCampaign = (): CampaignData => ({ night: 0, stats: zeroStats(), flags: [] });

/** Fold a finished night into the campaign and move on to the next one. */
export function absorb(campaign: CampaignData, state: NightState): CampaignData {
  return { ...campaign, night: campaign.night + 1, stats: { ...state.stats }, flags: [...state.flags] };
}

/** The first ending whose condition holds. The last ending in the file should have no condition. */
export function pickEnding(endings: readonly EndingDef[], test: (cond: Cond | undefined) => boolean): EndingDef {
  return endings.find((e) => test(e.if)) ?? endings[endings.length - 1];
}
