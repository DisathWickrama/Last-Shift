// The dawn report: what the morning radio says about your night.
//
// Every visitor's JSON has one sentence per possible outcome. The report is the
// night's intro lines, then the sentence matching what actually happened to each
// visitor, then the outro. No story text lives here: this only assembles it.

import type { Cond, NightDef, ReportLine, VisitorDef } from '../core/content';
import type { VisitRecord } from './night';

export function buildReport(
  night: NightDef,
  log: readonly VisitRecord[],
  visitors: Record<string, VisitorDef>,
  test: (cond: Cond | undefined) => boolean = () => true,
): string[] {
  // Framing lines may be conditional, so the radio can mention what you did on an earlier night.
  const pick = (lines: ReportLine[]): string[] =>
    lines.flatMap((l) => (typeof l === 'string' ? [l] : test(l.if) ? [l.text] : []));
  const middle = log
    .map((rec) => visitors[rec.visitor]?.report[rec.outcome])
    .filter((line): line is string => !!line);
  return [...pick(night.dawn.intro), ...middle, ...pick(night.dawn.outro)];
}
