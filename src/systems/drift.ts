// Drift: how a mimic's face goes wrong.
//
// Every mimic has a hidden drift value from 0 (a perfect copy) to 1 (it breaks).
// Talking and inspecting push it up. This file answers one question:
//
//   "Given the face this visitor walked in with, and their drift right now,
//    what should the face look like?"
//
// applyDrift() is a PURE FUNCTION: same inputs, same output, and it changes
// nothing. It only nudges numbers in FaceParams; src/render/face.ts redraws.
//
// Each mimic has its own short list of "tells" (from its JSON file). Tells switch
// on one after another as drift rises, so the face gets wrong in stages rather
// than all at once. Humans have an empty list: their faces never drift.

import type { FaceParams } from '../render/face';
import { clamp } from '../core/rng';

export type DriftTell =
  | 'eyeDrop' // one eye sits a pixel too low
  | 'eyeSpread' // the eyes move apart
  | 'smileHold' // the smile widens and stays
  | 'hairFlip' // the hair parts on the other side
  | 'noBlink' // blinking slows, then stops
  | 'pupilGrow' // the pupils swell
  | 'tooSymmetric' // the natural unevenness of a face is ironed out
  | 'browLift' // the brows creep up, fixed in polite surprise
  | 'mouthSkew'; // one corner of the mouth rides up

export const ALL_TELLS: DriftTell[] = [
  'eyeDrop', 'eyeSpread', 'smileHold', 'hairFlip', 'noBlink', 'pupilGrow', 'tooSymmetric', 'browLift', 'mouthSkew',
];

/** Drift at which the mask comes off. */
export const BREAK_AT = 1;

/**
 * How strongly tell number `index` (of `count`) is showing, from 0 to 1.
 * The first tell starts almost immediately; later ones need more drift.
 */
export function tellStrength(drift: number, index: number, count: number): number {
  const onset = (index + 0.4) / (count + 1);
  return clamp((drift - onset) / 0.35, 0, 1);
}

export function applyDrift(base: FaceParams, drift: number, tells: readonly DriftTell[]): FaceParams {
  if (drift <= 0 || tells.length === 0) return base;
  const f: FaceParams = { ...base };
  tells.forEach((tell, i) => {
    const k = tellStrength(drift, i, tells.length);
    if (k <= 0) return;
    switch (tell) {
      case 'eyeDrop':
        f.eyeDropL += 2.1 * k;
        break;
      case 'eyeSpread':
        f.eyeGap += 2.6 * k;
        break;
      case 'smileHold':
        f.smile += 0.62 * k;
        break;
      case 'hairFlip':
        if (k > 0.5) f.hairPart = -base.hairPart;
        break;
      case 'noBlink':
        f.blinkEvery = base.blinkEvery * (1 + 9 * k);
        break;
      case 'pupilGrow':
        f.pupil += 0.75 * k;
        f.lid = base.lid * (1 - k);
        break;
      case 'tooSymmetric':
        f.eyeDropL = base.eyeDropL * (1 - k) + (f.eyeDropL - base.eyeDropL);
        f.eyeDropR = base.eyeDropR * (1 - k);
        f.browSkew = base.browSkew * (1 - k);
        f.mouthSkew = base.mouthSkew * (1 - k);
        break;
      case 'browLift':
        f.browY += 2.6 * k;
        f.browTilt -= 0.25 * k;
        break;
      case 'mouthSkew':
        f.mouthSkew += 1.8 * k;
        break;
    }
  });
  return f;
}
