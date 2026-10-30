/**
 * Single source for the visit schedule and permitted windows (workbook F3: Week 0 is ±3 everywhere).
 * Every protocol, ICF and dictionary statement about visits is generated from this table.
 */
export interface ScheduledVisit {
  visitNumber: number;
  week: number;
  studyDay: number;
  windowDays: number;
  crfKey?: 'W0' | 'W4' | 'W8' | 'W12';
  protocolActivity: string;
  participantActivity: string;
}

export const VISIT_SCHEDULE: readonly ScheduledVisit[] = [
  { visitNumber: 1, week: 0, studyDay: 0, windowDays: 3, crfKey: 'W0', protocolActivity: 'Baseline: weight, blood pressure, fasting glucose, first dose of study treatment', participantActivity: 'Baseline checks and first dose of study treatment' },
  { visitNumber: 2, week: 1, studyDay: 7, windowDays: 2, protocolActivity: 'Tolerability check and adverse event review', participantActivity: 'Check on how you are feeling and any side effects' },
  { visitNumber: 3, week: 2, studyDay: 14, windowDays: 3, protocolActivity: 'Fasting glucose and adverse event review', participantActivity: 'Blood sugar test and side-effect check' },
  { visitNumber: 4, week: 4, studyDay: 28, windowDays: 3, crfKey: 'W4', protocolActivity: 'Weight, blood pressure, fasting glucose, dose compliance, adverse event review', participantActivity: 'Weight, blood pressure, blood sugar and side-effect check' },
  { visitNumber: 5, week: 6, studyDay: 42, windowDays: 3, protocolActivity: 'Fasting glucose and adverse event review', participantActivity: 'Blood sugar test and side-effect check' },
  { visitNumber: 6, week: 8, studyDay: 56, windowDays: 3, crfKey: 'W8', protocolActivity: 'Weight, blood pressure, fasting glucose, dose compliance, adverse event review', participantActivity: 'Weight, blood pressure, blood sugar and side-effect check' },
  { visitNumber: 7, week: 12, studyDay: 84, windowDays: 5, crfKey: 'W12', protocolActivity: 'Final assessment: weight, blood pressure, fasting glucose, adverse event review, end of treatment', participantActivity: 'Final check-up and end of study treatment' },
];

export function windowLabel(v: ScheduledVisit): string {
  return `±${v.windowDays} days (Days ${v.studyDay - v.windowDays}–${v.studyDay + v.windowDays})`;
}

/** Parses DD-MM-YYYY into a UTC day number; returns null for blank or malformed values. */
export function parseCrfDate(value: string): number | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const t = Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd));
  return Math.round(t / 86_400_000);
}
