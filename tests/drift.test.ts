// Tests for the drift model. Because systems/ is pure logic, a test is just:
// build some numbers, call the function, check the numbers that come back.

import { describe, it, expect } from 'vitest';
import { applyDrift, tellStrength } from '../src/systems/drift';
import { generateFace } from '../src/render/face';

describe('generateFace', () => {
  it('gives the same face for the same seed', () => {
    expect(generateFace('dale')).toEqual(generateFace('dale'));
  });

  it('gives different faces for different seeds', () => {
    expect(generateFace('dale')).not.toEqual(generateFace('maureen'));
  });

  it('lets content pin individual sliders', () => {
    expect(generateFace('dale', { hair: 'cap' }).hair).toBe('cap');
  });
});

describe('applyDrift', () => {
  const face = generateFace('test-visitor');

  it('leaves a face untouched at zero drift', () => {
    expect(applyDrift(face, 0, ['eyeDrop', 'smileHold'])).toEqual(face);
  });

  it('never changes a visitor with no tells (a human)', () => {
    expect(applyDrift(face, 1, [])).toEqual(face);
  });

  it('does not modify the face it was given', () => {
    const before = { ...face };
    applyDrift(face, 1, ['eyeDrop', 'hairFlip', 'smileHold']);
    expect(face).toEqual(before);
  });

  it('drops one eye by more than a unit at full drift', () => {
    const drifted = applyDrift(face, 1, ['eyeDrop']);
    expect(drifted.eyeDropL - face.eyeDropL).toBeGreaterThan(1);
    expect(drifted.eyeDropR).toBe(face.eyeDropR);
  });

  it('flips the hair parting to the other side', () => {
    const drifted = applyDrift(face, 1, ['hairFlip']);
    expect(Math.sign(drifted.hairPart)).toBe(-Math.sign(face.hairPart));
  });

  it('switches tells on in order as drift rises', () => {
    // With three tells, the first should be showing before the last has started.
    expect(tellStrength(0.3, 0, 3)).toBeGreaterThan(0);
    expect(tellStrength(0.3, 2, 3)).toBe(0);
    expect(tellStrength(1, 2, 3)).toBeGreaterThan(0.5);
  });
});
