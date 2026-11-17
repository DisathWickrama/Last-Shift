// The whole game, played without a screen: three nights, carrying stats and
// flags forward, to prove that every route reaches an ending.

import { describe, it, expect } from 'vitest';
import { NIGHT_ORDER, VISITORS, ENDINGS, type Beat, type ChoiceDef } from '../src/core/content';
import { NightState } from '../src/systems/night';
import { absorb, newCampaign, pickEnding, type CampaignData } from '../src/systems/campaign';
import type { Decision, Outcome } from '../src/systems/stats';

interface Player {
  /** What to do with an ordinary visitor. */
  decide: (visitor: string, state: NightState) => Decision;
  /** Which option to take when a script offers a choice. Return part of the option's text, or nothing for the first. */
  choose?: (options: ChoiceDef[], state: NightState) => string | undefined;
  /** Do one check first, so Wren speaks and Bond moves. */
  listen?: boolean;
}

/** Run a script's effects, following choices. Returns an outcome if a choice ended the visit. */
function runBeats(beats: Beat[], state: NightState, player: Player): Outcome | undefined {
  let outcome: Outcome | undefined;
  for (const beat of beats) {
    if (!state.test(beat.if)) continue;
    if ('choice' in beat) {
      const open = beat.choice.filter((c) => state.test(c.if));
      const want = player.choose?.(open, state);
      const pick = open.find((c) => want && c.text.includes(want)) ?? open[0];
      state.apply(pick);
      outcome = runBeats(pick.then ?? [], state, player) ?? pick.outcome ?? outcome;
    } else {
      state.apply(beat);
    }
  }
  return outcome;
}

/** Play from Night 1 until an ending is reached. Returns the ending id and the final campaign. */
function playGame(player: Player): { ending: string; campaign: CampaignData; visits: string[] } {
  let campaign = newCampaign();
  const visits: string[] = [];
  for (let n = 0; n < NIGHT_ORDER.length; n++) {
    const state = new NightState(NIGHT_ORDER[n], VISITORS, campaign);
    for (let guard = 0; guard < 200; guard++) {
      const ev = state.nextEvent();
      if (!ev || ev.type === 'dawn') break;
      if (ev.type === 'ending') {
        const ending = pickEnding(ENDINGS, (c) => state.test(c));
        return { ending: ending.id, campaign: absorb(campaign, state), visits };
      }
      if (ev.type === 'script') {
        runBeats(state.script(ev.script), state, player);
      } else {
        const visit = state.beginVisit(ev.visitor);
        visits.push(ev.visitor);
        if (player.listen) {
          state.inspect('wrist');
          state.hearAdvice();
        }
        // The lines of a visit carry flags too (Maureen's scone, what Cal says on his way out).
        const outcome: Outcome = visit.def.decide
          ? (runBeats(state.script(visit.def.decide), state, player) ?? 'missed')
          : player.decide(ev.visitor, state);
        for (const line of [...visit.def.greeting, ...(visit.def.leave[outcome] ?? [])]) state.apply(line);
        state.finish(outcome);
      }
    }
    campaign = absorb(campaign, state);
  }
  throw new Error('The game finished all its nights without reaching an ending');
}

const wren = (visitor: string): Decision => VISITORS[visitor].wren.advice;
/** The decision a careful, decent player would make: help humans, refuse mimics. */
const decent = (visitor: string): Decision => (VISITORS[visitor].people.some((p) => p.isMimic) ? 'turnAway' : 'serve');

describe('the three-night campaign', () => {
  it('has three nights in order, the last ending the game', () => {
    expect(NIGHT_ORDER.map((n) => n.number)).toEqual([1, 2, 3]);
    expect(NIGHT_ORDER[2].timeline.at(-1)?.type).toBe('ending');
  });

  it('ends in Close Enough when you side with Wren throughout', () => {
    const game = playGame({ decide: wren, listen: true, choose: (o) => (o.some((c) => c.text.includes('Smile')) ? 'Smile' : undefined) });
    expect(game.campaign.stats.bond).toBeGreaterThan(2);
    expect(game.ending).toBe('closeEnough');
  });

  it('ends in Wrong Answer when you defy Wren and warn the ranger', () => {
    const game = playGame({
      decide: decent,
      listen: true,
      choose: (o) => ['Run', 'That\'s us', 'Open the storeroom', 'Let me see', 'I don\'t remember', 'kind of her'].find((t) => o.some((c) => c.text.includes(t))),
    });
    expect(game.campaign.stats.bond).toBeLessThanOrEqual(2);
    expect(game.ending).toBe('wrongAnswer');
  });

  it('offers Fog Lifts to a humane player who has drifted from Wren', () => {
    const game = playGame({
      decide: decent,
      listen: true,
      choose: (o) => ['Walk out', 'That\'s us', 'Open the storeroom', 'I don\'t remember', 'kind of her'].find((t) => o.some((c) => c.text.includes(t))),
    });
    expect(game.campaign.stats.humanity).toBeGreaterThanOrEqual(4);
    expect(game.ending).toBe('fogLifts');
  });

  it('offers Clean Hands only once Slip is high', () => {
    const slippery = playGame({
      decide: wren,
      choose: (o, s) => {
        s.stats.slip += 1; // stand-in for a player who stares at mirrors and asks cold questions
        return ['Watch', 'Let me see', 'Knock back', 'not hungry', 'I remember'].find((t) => o.some((c) => c.text.includes(t)));
      },
    });
    expect(slippery.ending).toBe('cleanHands');
    const steady = playGame({ decide: wren, choose: (o) => (o.some((c) => c.text.includes('Watch')) ? 'Watch' : undefined) });
    expect(steady.ending).not.toBe('cleanHands');
  });

  it('reaches the secret Just Us ending by asking for Wren\'s wrist on Night 2', () => {
    const game = playGame({ decide: wren, choose: (o) => (o.some((c) => c.text.includes('your wrist')) ? 'your wrist' : undefined) });
    expect(game.ending).toBe('justUs');
    expect(game.campaign.night).toBe(2); // it ends the game during the second night
  });

  it('brings different people back on Night 2 depending on Night 1', () => {
    const kind = playGame({ decide: () => 'serve' });
    const cruel = playGame({ decide: () => 'turnAway' });
    expect(kind.visits).toContain('maureen2');
    expect(kind.visits).toContain('dale2');
    expect(cruel.visits).toContain('maureen2x');
    expect(cruel.visits).not.toContain('dale2');
  });

  it('reaches some ending whatever single decision you repeat', () => {
    for (const decision of ['serve', 'turnAway', 'shelter'] as Decision[]) {
      const game = playGame({ decide: () => decision });
      expect(ENDINGS.map((e) => e.id)).toContain(game.ending);
    }
  });
});
