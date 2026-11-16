// The dawn report: what the morning radio says about your night.
//
// Every visitor's JSON has one sentence per possible outcome. The report is the
// night's intro lines, then the sentence matching what actually happened to each
// visitor, then the outro. No story text lives here: this only assembles it.

import type { NightDef, VisitorDef } from '../core/content';
import type { VisitRecord } from './night';

export function buildReport(
  night: NightDef,
  log: readonly VisitRecord[],
  visitors: Record<string, VisitorDef>,
): string[] {
  const middle = log
    .map((rec) => visitors[rec.visitor]?.report[rec.outcome])
    .filter((line): line is string => !!line);
  return [...night.dawn.intro, ...middle, ...night.dawn.outro];
}
