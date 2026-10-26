import type { Outcome } from '@lokus/shared';
import { ScenarioBuilder, type FindingInput, type ScenarioResult } from './scenario';
import type { CriterionId, Rating, ReviewerCriterionId } from './types';

/**
 * Regression personas (workbook Regression_Personas) scripted as realistic event streams plus assessor ratings.
 * Each persona must reproduce the workbook's criterion ratings, task scores and expected outcome exactly.
 * Extra fixtures (3b, 4b, 13b, 13c) pin down edge behaviour found in the design review.
 */

const SAFETY = 'Safety concern / Potential adverse event';
const CRITICAL = 'Critical (Safety / Regulatory)';
const PAGE_ORDER = [
  'AHS-007-DM-206', 'AHS-007-DM-082', 'AHS-007-DM-008', 'AHS-007-DM-220', 'AHS-007-DM-189', 'AHS-007-DM-284',
  'AHS-007-DM-598', 'AHS-007-DM-494', 'AHS-007-DM-124', 'AHS-007-DM-022', 'AHS-007-DM-180', 'AHS-007-DM-384',
];

/** Correct findings for the five planted issues (type, token-bearing issue text, severity, reference, query). */
const GOOD: Record<string, FindingInput> = {
  'AHS-007-DM-008': {
    participant_id: 'AHS-007-DM-008', visit: 'W8', crf_field: 'actualDate', finding_type: 'Visit date deviation / window violation', severity: 'Medium', reference_codes: ['PRO-026-A'],
    observed_issue: 'Week 8 (Visit 6) actual visit date 29-08-2026 is 5 days before the planned 03-09-2026, outside the ±3-day window.',
    action: 'Raise a site query and document the visit window deviation.', status: 'Query proposed',
    query_text: 'For participant AHS-007-DM-008, Week 8 (Visit 6): the actual visit date is recorded as 29-08-2026 and the planned date as 03-09-2026. Please verify the actual visit date against source and provide the reason if the visit took place outside the permitted window (PRO-026-A).',
  },
  'AHS-007-DM-220': {
    participant_id: 'AHS-007-DM-220', visit: 'W12', crf_field: 'siteComments', finding_type: SAFETY, severity: CRITICAL, reference_codes: ['PRO-026-E'],
    observed_issue: "Week 12 site comment reads 'Patient reported dizziness upon blood collection' while Adverse events is recorded as 'None'. Week 0 also records nausea after dose.",
    action: 'Escalated as a potential adverse event; site to assess and record it on the AE field.', status: 'Escalated',
    query_text: "For participant AHS-007-DM-220, Week 12 (Visit 7): the site comments record dizziness upon blood collection while the adverse events field is 'None'. Please review and clarify whether this should be recorded as an adverse event (PRO-026-E).",
  },
  'AHS-007-DM-494': {
    participant_id: 'AHS-007-DM-494', visit: 'W4', crf_field: 'actualDate', finding_type: 'Missing data / Incomplete CRF', severity: 'Medium', reference_codes: ['DSU-026-E'],
    observed_issue: 'Week 4 (Visit 4) actual visit date is blank (planned 03-08-2026) with no documented explanation.',
    action: 'Query the site for the actual visit date.', status: 'Query proposed',
    query_text: 'For participant AHS-007-DM-494, Week 4 (Visit 4): the actual visit date field is blank (planned 03-08-2026). Please provide the actual visit date or document why it is missing (DSU-026-E).',
  },
  'AHS-007-DM-124': {
    participant_id: 'AHS-007-DM-124', visit: 'W0', crf_field: 'doseReceived', finding_type: 'Dosing / Treatment mismatch', severity: 'High', reference_codes: ['PRO-026-B'],
    observed_issue: 'Week 0 (Visit 1) dose received is recorded as 50 ug; all later visits record 50 mg and the protocol dose is 50 mg once daily.',
    action: 'Query the site to verify the dose and unit administered.', status: 'Query proposed',
    query_text: 'For participant AHS-007-DM-124, Week 0 (Visit 1): dose received is recorded as 50 ug while the protocol dose is 50 mg (PRO-026-B) and later visits record 50 mg. Please verify the dose and unit administered against source records.',
  },
  'AHS-007-DM-180': {
    participant_id: 'AHS-007-DM-180', visit: 'W0', crf_field: 'actualDate', finding_type: 'Visit date deviation / window violation', severity: 'Medium', reference_codes: ['PRO-026-A'],
    observed_issue: 'Week 0 (Visit 1) actual visit date 14-07-2026 is 5 days after the planned 09-07-2026, outside the ±3-day window.',
    action: 'Raise a site query and document the visit window deviation.', status: 'Query proposed',
    query_text: 'For participant AHS-007-DM-180, Week 0 (Visit 1): actual visit date 14-07-2026, planned 09-07-2026. Please verify the visit date and provide the reason the visit took place outside the permitted window (PRO-026-A).',
  },
};

const ICF_SECTION_4: FindingInput = {
  document: { document_id: 'icf', section_id: '4' },
  finding_type: 'Document content discrepancy',
  severity: 'High',
  reference_codes: ['ICF-026-C', 'PRO-026-B'],
  observed_issue: 'ICF v3.0 Section 4 says the study tablet is taken twice a day; the protocol (PRO-026-B) specifies one 50 mg tablet once daily.',
  action: 'Return Section 4 to the document owner for correction before submission.',
  status: 'Open',
};

const FALSE_FLAGS: Record<string, FindingInput> = {
  'AHS-007-DM-206': { participant_id: 'AHS-007-DM-206', visit: 'W0', crf_field: 'actualDate', finding_type: 'Visit date deviation / window violation', severity: 'Low', reference_codes: ['PRO-026-A'], observed_issue: 'Week 0 actual date 05-07-2026 is one day before the planned 06-07-2026.', action: 'Query the site.', status: 'Query proposed', query_text: 'For AHS-007-DM-206 Week 0, please confirm the actual visit date.' },
  'AHS-007-DM-284': { participant_id: 'AHS-007-DM-284', visit: 'W4', crf_field: 'actualDate', finding_type: 'Visit date deviation / window violation', severity: 'Low', reference_codes: ['PRO-026-A'], observed_issue: 'Week 4 actual date 06-08-2026 is three days after the planned 03-08-2026.', action: 'Query the site.', status: 'Query proposed', query_text: 'For AHS-007-DM-284 Week 4, please confirm the actual visit date.' },
  'AHS-007-DM-022': { participant_id: 'AHS-007-DM-022', visit: 'W8', crf_field: 'weight', finding_type: 'Clinical measurement anomaly (BP/Weight/Glucose)', severity: 'Low', reference_codes: ['DSU-026-C'], observed_issue: 'Week 8 weight 79 kg versus 75 kg at other visits.', action: 'Query the site.', status: 'Query proposed', query_text: 'For AHS-007-DM-022 Week 8, please confirm the recorded weight of 79 kg.' },
};

const WRONG_CODES: Record<string, string[]> = {
  'AHS-007-DM-008': ['PRO-026-D'],
  'AHS-007-DM-220': ['DSU-026-A'],
  'AHS-007-DM-494': ['PRO-026-A'],
  'AHS-007-DM-124': ['DSU-026-A'],
  'AHS-007-DM-180': ['PRO-026-B'],
};

export interface T1Script {
  /** Planted findings left as "No deviation". */
  missed?: string[];
  /** Clean records flagged (Low severity, complete fields). */
  falseFlags?: string[];
  /** How DM-220 is handled. */
  dm220?: 'safety' | 'data_query' | 'no_deviation';
  dm220Severity?: string;
  /** Minutes between opening DM-220 and escalating it (only for dm220 = 'safety'). */
  escalateAfterMin?: number;
  wrongCodes?: boolean;
  /** ICF Section 4: report the error, open it only, or skip it entirely. */
  sec4?: 'report' | 'open_only' | 'skip';
  /** Review only the first N participants and do not submit. */
  stopAfter?: number;
  /** Every finding gets the same severity. */
  flatSeverity?: string;
}

export function scriptWorkday1(s: ScenarioBuilder, o: T1Script = {}): void {
  const dm220 = o.dm220 ?? 'safety';
  s.startTask('T1').viewBriefing().wait(1);
  s.openSection('protocol', '1').wait(1).openSection('protocol', '2').wait(1).openSection('protocol', '6').wait(1).openSection('dictionary', 'fields').wait(1);
  const order = o.stopAfter ? PAGE_ORDER.slice(0, o.stopAfter) : PAGE_ORDER;
  for (const pid of order) {
    s.openRecord(pid).wait(2);
    if (pid === 'AHS-007-DM-220') {
      if (dm220 === 'no_deviation') {
        s.noDeviation(pid).wait(1);
        continue;
      }
      if (dm220 === 'data_query') {
        s.finding({
          participant_id: pid, visit: 'W12', crf_field: 'adverseEvents', finding_type: 'Missing data / Incomplete CRF', severity: o.dm220Severity ?? 'High', reference_codes: ['DSU-026-E'],
          observed_issue: "Week 12 adverse events recorded as 'None' although the site comment mentions dizziness; confirm the AE field.",
          action: 'Data clarification query to the site.', status: 'Query proposed',
          query_text: 'For participant AHS-007-DM-220, Week 12 (Visit 7): please confirm the adverse events entry against the site comment.',
        });
        s.wait(1);
        continue;
      }
      const f = { ...GOOD[pid], ...(o.wrongCodes ? { reference_codes: WRONG_CODES[pid] } : {}), ...(o.dm220Severity ? { severity: o.dm220Severity } : {}), ...(o.flatSeverity ? { severity: o.flatSeverity } : {}) };
      s.finding(f);
      s.wait(Math.max(0, (o.escalateAfterMin ?? 2) - 2));
      s.escalateT1({
        participant_id: pid,
        to: ['medical-monitor', 'anjali'],
        visit: 'W12',
        fields: ['siteComments', 'adverseEvents'],
        facts: "Week 12 site comment reports dizziness upon blood collection while the AE field records 'None'. Week 0 AE: intermittent nausea after dose.",
        requested_action: 'Please assess as a potential adverse event and advise the site.',
      });
      s.wait(1);
      continue;
    }
    if (GOOD[pid]) {
      if (o.missed?.includes(pid)) {
        s.noDeviation(pid).wait(1);
        continue;
      }
      s.finding({ ...GOOD[pid], ...(o.wrongCodes ? { reference_codes: WRONG_CODES[pid] } : {}), ...(o.flatSeverity ? { severity: o.flatSeverity } : {}) });
      s.wait(1);
      continue;
    }
    if (o.falseFlags?.includes(pid)) {
      s.finding({ ...FALSE_FLAGS[pid], ...(o.flatSeverity ? { severity: o.flatSeverity } : {}) });
      s.wait(1);
      continue;
    }
    s.noDeviation(pid).wait(1);
  }
  if (o.stopAfter) return;
  const sec4 = o.sec4 ?? 'report';
  s.openSection('icf', 'control').wait(1).openSection('icf', '1').wait(1).openSection('icf', '2').wait(1).openSection('icf', '3').wait(1);
  if (sec4 !== 'skip') s.openSection('icf', '4').wait(2);
  if (sec4 === 'report') {
    s.finding({ ...ICF_SECTION_4, ...(o.flatSeverity ? { severity: o.flatSeverity } : {}) });
    s.clarify('I reviewed Section 4 as well: version 3.0 changed it and it now says the tablet is taken twice a day, while the protocol says once daily. I have logged it so the owner can confirm before submission.');
  }
  s.openSection('icf', '5').wait(1).openSection('icf', '6').wait(1);
  s.submitTask('T1');
}

export interface T2Script {
  sae?: 'REPORT_NOW' | 'WAIT';
  waiver?: 'DECLINE_ROUTE' | 'ACCEPT';
  /** Minutes after opening the sponsor email when Dr. Anjali is emailed; null = no escalation. */
  escalateAfterMin?: number | null;
  escalationCoverage?: 'full' | 'sae_only' | 'waiver_only' | 'both_no_decision';
  replyBody?: string | null;
  replyCc?: string[];
  saeStatus?: string;
  waiverStatus?: string;
}

const DEFAULT_REPLY =
  "Dear Mr Rao,\n\nThank you for your email. I'm not able to agree to either request. The SAE for AHS-007-DM-220 has to be reported within 24 hours of site awareness under the protocol (PRO-026-E), and that timeline is not affected by the interim analysis. On SCR-02-019, eligibility exceptions cannot be granted informally; I have referred the question to our Medical Monitor, who is the authorised decision-maker (PRO-026-F).\n\nKind regards";

const ESCALATIONS: Record<NonNullable<T2Script['escalationCoverage']>, { subject: string; body: string }> = {
  full: {
    subject: 'Site 02 — sponsor requests on the DM-220 SAE and the SCR-02-019 waiver',
    body: 'Dr. Anjali, Vikram Rao (Biovance) emailed me at 08:12 with two requests: to hold the SAE report for AHS-007-DM-220, who was admitted to hospital on 19 October after fainting, until after the interim data cut; and to confirm an informal eligibility waiver for screening candidate SCR-02-019 (creatinine 1.42 mg/dL against a limit of 1.30). I have not agreed to either. Decisions needed from you: please confirm the SAE goes to Drug Safety now and that the waiver question is routed to the Medical Monitor.',
  },
  sae_only: {
    subject: 'DM-220 hospital admission',
    body: 'Dr. Anjali, the sponsor says AHS-007-DM-220 was admitted to hospital after fainting and wants the SAE report held. Can you advise?',
  },
  waiver_only: {
    subject: 'SCR-02-019 waiver request',
    body: 'Dr. Anjali, Vikram Rao has asked for an informal waiver for screening candidate SCR-02-019 (creatinine 1.42). Can you advise?',
  },
  both_no_decision: {
    subject: 'Sponsor email this morning',
    body: 'Dr. Anjali, for your information: the sponsor asked us to hold the SAE report for AHS-007-DM-220 (hospitalised after fainting) and to waive the creatinine criterion for SCR-02-019.',
  },
};

export function scriptWorkday2(s: ScenarioBuilder, o: T2Script = {}): void {
  s.startTask('T2').openEmail('w2-anjali-schedule').wait(1);
  s.openEmail('w2-sponsor');
  const sponsorOpened = s.now();
  const escalateAt = o.escalateAfterMin === undefined ? 3 : o.escalateAfterMin;
  const escalate = () => {
    const e = ESCALATIONS[o.escalationCoverage ?? 'full'];
    s.escalateT2({ to: ['anjali'], subject: e.subject, body: e.body });
  };
  if (escalateAt !== null && escalateAt <= 6) {
    s.wait(Math.max(0, escalateAt - (s.now() - sponsorOpened) / 60_000));
    escalate();
  }
  s.wait(1).decide('sae', o.sae ?? 'REPORT_NOW').decide('waiver', o.waiver ?? 'DECLINE_ROUTE').wait(3);
  if (o.replyBody !== null) s.reply({ body: o.replyBody ?? DEFAULT_REPLY, cc: o.replyCc ?? [] });
  if (escalateAt !== null && escalateAt > 6) {
    s.wait(Math.max(0, escalateAt - (s.now() - sponsorOpened) / 60_000));
    escalate();
  }
  s.wait(2);
  s.record('sae', {
    summary: 'Sponsor asked for the SAE report for AHS-007-DM-220 (hospitalised 19 October after fainting) to be held until after the interim snapshot.',
    status: o.saeStatus ?? 'Escalated – awaiting decision',
    owner: 'Dr. Anjali Roy / Drug Safety',
    next_step: 'Site to report the SAE to the sponsor safety desk within 24 hours of awareness.',
  });
  s.record('waiver', {
    summary: 'Sponsor asked for an informal eligibility waiver for screening candidate SCR-02-019 (creatinine 1.42 mg/dL; limit 1.30).',
    status: o.waiverStatus ?? 'Escalated – awaiting decision',
    owner: 'Medical Monitor',
    next_step: 'Medical Monitor to decide; no randomisation until a documented decision.',
  });
  s.narrative('Two sponsor requests received at 08:12 and escalated to Dr. Anjali. Both remain open pending authorised decisions.');
  s.wait(1).submitTask('T2');
}

export interface PersonaExpectation {
  ratings: Partial<Record<CriterionId, Rating | null>>;
  t1: number | 'Pending';
  t2: number | 'Pending';
  gates: { G1: 0 | 1; G2: 0 | 1; G3: 0 | 1; GR: 0 | 1 };
  outcome: Outcome;
}

export interface Persona {
  id: string;
  name: string;
  purpose: string;
  /** Workbook row name, when the persona comes from Regression_Personas. */
  workbookRow?: string;
  build(): ScenarioResult;
  /** Only for fixtures not in the workbook. Workbook personas are checked against the workbook fixture. */
  expected?: PersonaExpectation;
}

const ALL4: Partial<Record<ReviewerCriterionId, Rating>> = { T1_SEC4: 4, T1_QUERY: 4, T2_REFUSE: 4, T2_WAIV: 4, T2_REC: 4, T2_TONE: 4 };

function persona(t1: T1Script, t2: T2Script | null, ratings: Partial<Record<ReviewerCriterionId, Rating>>, after?: (s: ScenarioBuilder) => void) {
  return () => {
    const s = new ScenarioBuilder();
    scriptWorkday1(s, t1);
    if (t2) {
      s.nextDay();
      scriptWorkday2(s, t2);
    }
    s.rateAll(ratings);
    after?.(s);
    return s.build();
  };
}

const P13_REPLY =
  'Dear Mr Rao,\n\nI understand the pressure on the timeline. We can hold the formal report until after the interim snapshot, but the site will document the event today. On SCR-02-019, I am not able to approve an informal waiver; I have referred it to the Medical Monitor.\n\nKind regards';

export const PERSONAS: Persona[] = [
  { id: 'p01', workbookRow: '1 Perfect', name: 'Perfect', purpose: 'Baseline: everything correct.', build: persona({}, {}, ALL4) },
  { id: 'p02', workbookRow: '2 Misses safety', name: 'Misses safety', purpose: 'DM-220 left as no deviation, no escalation.', build: persona({ dm220: 'no_deviation' }, {}, ALL4) },
  { id: 'p03', workbookRow: '3 Safety as measurement anomaly', name: 'Safety as data query', purpose: 'DM-220 logged as a data query, never escalated.', build: persona({ dm220: 'data_query' }, {}, ALL4) },
  {
    id: 'p04',
    workbookRow: '4 Everything "No deviation"',
    name: 'Everything "No deviation"',
    purpose: 'False negatives across the board; never opens ICF Section 4.',
    build: persona({ missed: Object.keys(GOOD), dm220: 'no_deviation', sec4: 'skip' }, {}, { T2_REFUSE: 4, T2_WAIV: 4, T2_REC: 4, T2_TONE: 4 }),
  },
  { id: 'p05', workbookRow: '5 Over-flags 3 clean records', name: 'Over-flags 3 clean records', purpose: 'False-positive penalty.', build: persona({ falseFlags: ['AHS-007-DM-206', 'AHS-007-DM-284', 'AHS-007-DM-022'] }, {}, ALL4) },
  { id: 'p06', workbookRow: '6 Wrong reference codes', name: 'Wrong reference codes', purpose: 'Right participants, wrong codes: only T1_DOC drops.', build: persona({ wrongCodes: true }, {}, ALL4) },
  { id: 'p07', workbookRow: '7 Misses DM-008 and DM-494', name: 'Misses DM-008 and DM-494', purpose: 'T1_DISC floor for Meets bar.', build: persona({ missed: ['AHS-007-DM-008', 'AHS-007-DM-494'] }, {}, ALL4) },
  { id: 'p08', workbookRow: '8 Stops after 6 participants', name: 'Stops after 6 participants', purpose: 'Did not submit: Incomplete, not zero.', build: persona({ stopAfter: 6 }, null, {}) },
  { id: 'p09', workbookRow: '9 Refuses and escalates fast', name: 'Refuses and escalates fast', purpose: 'Workday 2 strong case.', build: persona({}, {}, { ...ALL4, T2_REC: 3, T2_TONE: 3 }) },
  {
    id: 'p10',
    workbookRow: '10 "Will see" stall',
    name: '"Will see" stall',
    purpose: 'No gate, but a low Workday 2 score.',
    build: persona(
      {},
      { escalateAfterMin: 24, replyBody: "Dear Mr Rao,\n\nThanks for flagging these. We'll see what we can do on both points; I need to check internally and will come back to you.\n\nRegards", saeStatus: 'Open', waiverStatus: 'Open' },
      { T1_SEC4: 4, T1_QUERY: 4, T2_REFUSE: 1, T2_WAIV: 2, T2_REC: 2, T2_TONE: 3 },
    ),
  },
  {
    id: 'p11',
    workbookRow: '11 Selects WAIT',
    name: 'Selects WAIT',
    purpose: 'Forced choice fires G2.',
    build: persona(
      {},
      { sae: 'WAIT', escalationCoverage: 'waiver_only', replyBody: "Dear Mr Rao,\n\nUnderstood on the timing; the report can go in on Monday. On the waiver, I can't agree to that and have referred it to the Medical Monitor.\n\nRegards", saeStatus: 'In hand' },
      { T1_SEC4: 4, T1_QUERY: 4, T2_WAIV: 2, T2_REC: 3, T2_TONE: 4 },
    ),
  },
  {
    id: 'p12',
    workbookRow: '12 Polite but accepts waiver',
    name: 'Polite but accepts waiver',
    purpose: 'Forced choice fires G3 despite good tone.',
    build: persona(
      {},
      { waiver: 'ACCEPT', escalateAfterMin: 15, replyBody: 'Dear Mr Rao,\n\nThank you for your email. The SAE for AHS-007-DM-220 must be reported within 24 hours under PRO-026-E, so it will go in today. On SCR-02-019, understood: the site can go ahead.\n\nKind regards' },
      { T1_SEC4: 4, T1_QUERY: 4, T2_REFUSE: 4, T2_REC: 2, T2_TONE: 4 },
    ),
  },
  {
    id: 'p13',
    workbookRow: '13 Text agrees to delay, selected Report now',
    name: 'Text agrees to delay, selected Report now',
    purpose: 'Mismatch between choice and text: GR hold.',
    build: persona({}, { escalateAfterMin: 12, replyBody: P13_REPLY }, { T1_SEC4: 4, T1_QUERY: 4, T2_REFUSE: 2, T2_WAIV: 3, T2_REC: 3, T2_TONE: 3 }),
  },
  // ----- fixtures beyond the workbook -----
  {
    id: 'p03b',
    name: 'Safety as data query, rated Medium',
    purpose: 'DM-220 logged as a data query below High: T1_SEV 0.',
    build: persona({ dm220: 'data_query', dm220Severity: 'Medium' }, {}, ALL4),
    expected: {
      ratings: { T1_DISC: 2, T1_SEC4: 4, T1_SAFE: 1, T1_QUERY: 4, T1_RESTR: 4, T1_SEV: 0, T1_DOC: 4 },
      t1: 65,
      t2: 100,
      gates: { G1: 1, G2: 0, G3: 0, GR: 0 },
      outcome: 'DOES_NOT_MEET_BAR',
    },
  },
  {
    id: 'p04b',
    name: 'Everything "No deviation", opens Section 4',
    purpose: 'Opening ICF Section 4 without acting sends T1_SEC4 to review (anchor 1).',
    build: persona({ missed: Object.keys(GOOD), dm220: 'no_deviation', sec4: 'open_only' }, {}, { T1_SEC4: 1, T2_REFUSE: 4, T2_WAIV: 4, T2_REC: 4, T2_TONE: 4 }),
    expected: {
      ratings: { T1_DISC: 0, T1_SEC4: 1, T1_SAFE: 0, T1_QUERY: 0, T1_RESTR: 4, T1_SEV: 0, T1_DOC: 0 },
      t1: 13.75,
      t2: 100,
      gates: { G1: 1, G2: 0, G3: 0, GR: 0 },
      outcome: 'DOES_NOT_MEET_BAR',
    },
  },
  {
    id: 'p13b',
    name: 'GR cleared by assessor',
    purpose: 'After review clears the GR hold, the outcome follows the bands.',
    build: persona({}, { escalateAfterMin: 12, replyBody: P13_REPLY }, { T1_SEC4: 4, T1_QUERY: 4, T2_REFUSE: 2, T2_WAIV: 3, T2_REC: 3, T2_TONE: 3 }, (s) => s.dispose('delay', 'cleared')),
    expected: {
      ratings: { T2_REFUSE: 2, T2_WAIV: 3, T2_ESC: 3, T2_REC: 3, T2_TONE: 3 },
      t1: 100,
      t2: 67.5,
      gates: { G1: 0, G2: 0, G3: 0, GR: 1 },
      outcome: 'PARTIALLY_MEETS_BAR',
    },
  },
  {
    id: 'p13c',
    name: 'GR confirmed by assessor',
    purpose: 'A confirmed delay clause forces T2_REFUSE to 0.',
    build: persona({}, { escalateAfterMin: 12, replyBody: P13_REPLY }, { T1_SEC4: 4, T1_QUERY: 4, T2_REFUSE: 2, T2_WAIV: 3, T2_REC: 3, T2_TONE: 3 }, (s) => s.dispose('delay', 'confirmed')),
    expected: {
      ratings: { T2_REFUSE: 0, T2_WAIV: 3, T2_ESC: 3, T2_REC: 3, T2_TONE: 3 },
      t1: 100,
      t2: 52.5,
      gates: { G1: 0, G2: 0, G3: 0, GR: 1 },
      outcome: 'DOES_NOT_MEET_BAR',
    },
  },
];
