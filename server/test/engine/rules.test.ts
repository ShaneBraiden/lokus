import { describe, expect, it } from 'vitest';
import {
  ScenarioBuilder,
  calculateAssessment,
  defaultScoringPackage,
  scriptWorkday1,
  scriptWorkday2,
  type AssessmentResult,
  type CriterionId,
  type ScoringPackage,
  type T1Script,
} from '../../src/engine';

const DM220 = 'AHS-007-DM-220';
const PIDS = [
  'AHS-007-DM-206', 'AHS-007-DM-082', 'AHS-007-DM-008', 'AHS-007-DM-220', 'AHS-007-DM-189', 'AHS-007-DM-284',
  'AHS-007-DM-598', 'AHS-007-DM-494', 'AHS-007-DM-124', 'AHS-007-DM-022', 'AHS-007-DM-180', 'AHS-007-DM-384',
];
const FACTUAL = "Week 12 site comment reports dizziness upon blood collection while the AE field records 'None'.";
const ALL4 = { T1_SEC4: 4, T1_QUERY: 4, T2_REFUSE: 4, T2_WAIV: 4, T2_REC: 4, T2_TONE: 4 } as const;

function calc(s: ScenarioBuilder, pkg: ScoringPackage = defaultScoringPackage(), closed = true): AssessmentResult {
  const run = s.build();
  return calculateAssessment({ events: run.events, reviewerRatings: run.ratings, grDispositions: run.dispositions, pkg, evaluatedAt: 0, closed });
}
const crit = (r: AssessmentResult, id: CriterionId) => r.criteria.find((c) => c.criterion_id === id)!;
const gate = (r: AssessmentResult, id: string) => r.gates.find((g) => g.gate_id === id)!;

/** Workday 1 where every record except DM-220 is marked "No deviation"; `fn` scripts DM-220 after opening it. */
function safeScenario(fn: (s: ScenarioBuilder) => void): AssessmentResult {
  const s = new ScenarioBuilder();
  s.startTask('T1');
  for (const pid of PIDS) if (pid !== DM220) s.openRecord(pid).noDeviation(pid);
  s.openRecord(DM220);
  fn(s);
  s.submitTask('T1');
  return calc(s);
}

function perfectT1(o: T1Script = {}, extra?: (s: ScenarioBuilder) => void): AssessmentResult {
  const s = new ScenarioBuilder();
  scriptWorkday1(s, o);
  s.rateAll(ALL4);
  extra?.(s);
  return calc(s);
}

/** Perfect Workday 1, then a custom Workday 2 scripted by `fn` (sponsor email opened first). */
function t2Scenario(fn: (s: ScenarioBuilder) => void, ratings: Partial<typeof ALL4> = ALL4): AssessmentResult {
  const s = new ScenarioBuilder();
  scriptWorkday1(s);
  s.nextDay().startTask('T2').openEmail('w2-sponsor');
  fn(s);
  s.submitTask('T2');
  s.rateAll(ratings);
  return calc(s);
}

describe('T1_SAFE: timing from first view of DM-220 and factual context', () => {
  it.each([
    [9, 4],
    [11, 3],
    [31, 2],
  ])('escalating %i min after opening, with facts, rates %i', (minutes, rating) => {
    const r = perfectT1({ escalateAfterMin: minutes });
    expect(crit(r, 'T1_SAFE').rating).toBe(rating);
    expect(gate(r, 'G1').fired).toBe(false);
  });

  it('treats a fast escalation with thin context as 3', () => {
    const r = safeScenario((s) => s.wait(2).escalateT1({ participant_id: DM220, facts: 'Patient reported dizziness.' }));
    expect(crit(r, 'T1_SAFE').rating).toBe(3);
  });

  it('counts structured visit/field selections as location facts', () => {
    const r = safeScenario((s) => s.wait(2).escalateT1({ participant_id: DM220, visit: 'W12', fields: ['siteComments'], facts: 'Patient reported dizziness.' }));
    expect(crit(r, 'T1_SAFE').rating).toBe(4);
  });

  it('rates an unclear escalation 1, but the best escalation counts', () => {
    expect(crit(safeScenario((s) => s.wait(1).escalateT1({ participant_id: DM220, facts: 'Please look at this record.' })), 'T1_SAFE').rating).toBe(1);
    const both = safeScenario((s) => s.wait(1).escalateT1({ participant_id: DM220, facts: 'Please look at this record.' }).wait(6).escalateT1({ participant_id: DM220, facts: FACTUAL }));
    expect(crit(both, 'T1_SAFE').rating).toBe(4);
  });

  it('caps at 2 when DM-220 is logged only as a data issue, even if escalated fast', () => {
    const r = safeScenario((s) => {
      s.finding({ participant_id: DM220, visit: 'W12', crf_field: 'adverseEvents', finding_type: 'Missing data / Incomplete CRF', severity: 'High', observed_issue: 'AE field None vs comment' });
      s.wait(1).escalateT1({ participant_id: DM220, facts: FACTUAL });
    });
    expect(crit(r, 'T1_SAFE').rating).toBe(2);
    expect(crit(r, 'T1_SAFE').rule_id).toBe('SAFE_TREATED_AS_DATA_QUERY');
  });

  it('gives 1 and fires G1 when only a different participant is escalated', () => {
    const r = safeScenario((s) => s.escalateT1({ participant_id: 'AHS-007-DM-124', facts: 'Dose recorded as 50 ug.' }));
    expect(crit(r, 'T1_SAFE').rating).toBe(1);
    expect(gate(r, 'G1').fired).toBe(true);
  });

  it('gives 0 and fires G1 when nothing about DM-220 is logged or escalated', () => {
    const r = safeScenario((s) => s.noDeviation(DM220));
    expect(crit(r, 'T1_SAFE').rating).toBe(0);
    expect(gate(r, 'G1').fired).toBe(true);
  });
});

describe('T1_RESTR: the edit-value trap', () => {
  const cell = { participant_id: 'AHS-007-DM-124', visit: 'W0', field: 'doseReceived' };
  it.each([
    ['committed and left changed', (s: ScenarioBuilder) => s.editStart(cell, '50 ug').editCommit(cell, '50 ug', '50 mg'), 0],
    ['committed then reverted', (s: ScenarioBuilder) => s.editStart(cell, '50 ug').editCommit(cell, '50 ug', '50 mg').editRevert(cell, '50 mg', '50 ug'), 1],
    ['changed draft cancelled', (s: ScenarioBuilder) => s.editStart(cell, '50 ug').editCancel(cell, true), 2],
    ['editor opened and closed unchanged', (s: ScenarioBuilder) => s.editStart(cell, '50 ug').editCancel(cell, false), 4],
    ['correction recommended instead', (s: ScenarioBuilder) => s.recommendCorrection(cell, '50 mg', 'Protocol dose is 50 mg'), 4],
  ] as const)('%s → %i', (_label, act, rating) => {
    const s = new ScenarioBuilder();
    s.startTask('T1');
    act(s);
    for (const pid of PIDS) s.openRecord(pid).noDeviation(pid);
    s.submitTask('T1');
    expect(crit(calc(s), 'T1_RESTR').rating).toBe(rating);
  });

  it('rates 3 when a correction is proposed only inside query text', () => {
    const s = new ScenarioBuilder();
    s.startTask('T1');
    for (const pid of PIDS) {
      s.openRecord(pid);
      if (pid === 'AHS-007-DM-124') s.finding({ participant_id: pid, visit: 'W0', crf_field: 'doseReceived', finding_type: 'Dosing / Treatment mismatch', observed_issue: '50 ug at Week 0', query_text: 'Please correct to 50 mg.' });
      else s.noDeviation(pid);
    }
    s.submitTask('T1');
    expect(crit(calc(s), 'T1_RESTR').rating).toBe(3);
  });
});

describe('T1_SEV: accuracy and order of handling', () => {
  it('rates 1 when a non-safety finding is rated above the safety signal', () => {
    const r = perfectT1({ dm220Severity: 'High' }, () => undefined);
    expect(crit(r, 'T1_SEV').rating).toBe(4);
    const s = new ScenarioBuilder();
    scriptWorkday1(s, { dm220Severity: 'High', falseFlags: ['AHS-007-DM-206'] });
    const run = s.build();
    // Re-rate the clean-record flag as Critical to invert the order.
    const events = run.events.map((e) => (e.event_type === 'finding_created' && (e.metadata.finding as any).target.participant_id === 'AHS-007-DM-206' ? { ...e, metadata: { finding: { ...(e.metadata.finding as any), severity: 'Critical (Safety / Regulatory)' } } } : e));
    const inv = calculateAssessment({ events, reviewerRatings: [], pkg: defaultScoringPackage(), evaluatedAt: 0, closed: true });
    expect(crit(inv, 'T1_SEV').rating).toBe(1);
    expect(crit(inv, 'T1_SEV').rule_id).toBe('SEV_INVERTED');
  });

  it('rates 1 for flat severity with mismatches', () => {
    expect(crit(perfectT1({ flatSeverity: 'High' }), 'T1_SEV').rule_id).toBe('SEV_FLAT');
  });

  it('rates 3 for one mismatch and 2 for two', () => {
    const one = new ScenarioBuilder();
    scriptWorkday1(one);
    const run = one.build();
    const bump = (ids: string[]) =>
      run.events.map((e) => (e.event_type === 'finding_created' && ids.includes((e.metadata.finding as any).target.participant_id) ? { ...e, metadata: { finding: { ...(e.metadata.finding as any), severity: 'High' } } } : e));
    const r1 = calculateAssessment({ events: bump(['AHS-007-DM-008']), pkg: defaultScoringPackage(), evaluatedAt: 0, closed: true });
    const r2 = calculateAssessment({ events: bump(['AHS-007-DM-008', 'AHS-007-DM-180']), pkg: defaultScoringPackage(), evaluatedAt: 0, closed: true });
    expect(crit(r1, 'T1_SEV').rating).toBe(3);
    expect(crit(r2, 'T1_SEV').rating).toBe(2);
  });

  it('treats one finding logged before the safety escalation as a minor ordering weakness', () => {
    const r = safeScenario((s) => {
      s.finding({ participant_id: DM220, visit: 'W12', crf_field: 'siteComments', finding_type: 'Safety concern / Potential adverse event', severity: 'Critical (Safety / Regulatory)', observed_issue: 'dizziness week 12' });
      s.finding({ participant_id: 'AHS-007-DM-008', visit: 'W8', crf_field: 'actualDate', finding_type: 'Visit date deviation / window violation', severity: 'Low', observed_issue: 'Week 8 is 5 days early' });
      s.escalateT1({ participant_id: DM220, facts: FACTUAL });
    });
    expect(crit(r, 'T1_SEV').rating).toBe(3);
  });
});

describe('T1_DOC: completeness and traceability', () => {
  function docWith(change: Record<string, unknown>) {
    const s = new ScenarioBuilder();
    scriptWorkday1(s);
    const run = s.build();
    const events = run.events.map((e) =>
      e.event_type === 'finding_created' && (e.metadata.finding as any).target.participant_id === 'AHS-007-DM-008' ? { ...e, metadata: { finding: { ...(e.metadata.finding as any), ...change } } } : e,
    );
    return crit(calculateAssessment({ events, pkg: defaultScoringPackage(), evaluatedAt: 0, closed: true }), 'T1_DOC');
  }
  it('counts a missing action as one omission (3)', () => expect(docWith({ action: '' }).rating).toBe(3));
  it('treats more than two codes as a wrong reference (3)', () => expect(docWith({ reference_codes: ['PRO-026-A', 'PRO-026-B', 'DSU-026-D'] }).rating).toBe(3));
  it('rates 1 when a finding has no observed issue', () => expect(docWith({ observed_issue: '' }).rating).toBe(1));
});

describe('T1_QUERY and T1_DISC details', () => {
  it('caps the assessor rating at QUERY_LEAD_CAP when a query is leading', () => {
    const s = new ScenarioBuilder();
    scriptWorkday1(s);
    const run = s.build();
    const events = run.events.map((e) =>
      e.event_type === 'finding_created' && (e.metadata.finding as any).target.participant_id === 'AHS-007-DM-124'
        ? { ...e, metadata: { finding: { ...(e.metadata.finding as any), query_text: 'The dose is obviously wrong; please correct to 50 mg.' } } }
        : e,
    );
    const r = calculateAssessment({ events, reviewerRatings: [{ id: 'r1', criterion_id: 'T1_QUERY', raw_rating: 4, rationale: 'x', assessor_id: 'a', created_at: 1 }], pkg: defaultScoringPackage(), evaluatedAt: 0, closed: true });
    expect(crit(r, 'T1_QUERY')).toMatchObject({ raw_rating: 4, cap: 1, rating: 1, rule_id: 'REVIEWER_CAPPED' });
  });

  it('credits a finding from its selected visit label unless TOKEN_SCOPE is literal', () => {
    const s = new ScenarioBuilder();
    scriptWorkday1(s);
    const run = s.build();
    const events = run.events.map((e) =>
      e.event_type === 'finding_created' && (e.metadata.finding as any).target.participant_id === 'AHS-007-DM-494'
        ? { ...e, metadata: { finding: { ...(e.metadata.finding as any), observed_issue: 'Actual visit date not recorded.' } } }
        : e,
    );
    const located = calculateAssessment({ events, pkg: defaultScoringPackage(), evaluatedAt: 0, closed: true });
    const literalPkg = defaultScoringPackage();
    literalPkg.parameters.TOKEN_SCOPE = 'issue_text';
    const literal = calculateAssessment({ events, pkg: literalPkg, evaluatedAt: 0, closed: true });
    expect(crit(located, 'T1_DISC').explanation).toContain('Key score 100/100');
    expect(crit(literal, 'T1_DISC').explanation).toContain('Key score 85/100');
    expect(crit(literal, 'T1_DISC').rating).toBe(3);
  });

  it('rates T1_SEC4 0 without review only when Section 4 was neither opened nor reported', () => {
    expect(crit(perfectT1({ sec4: 'skip' }), 'T1_SEC4')).toMatchObject({ rating: 0, rule_id: 'SEC4_NOT_OPENED' });
    const s = new ScenarioBuilder();
    scriptWorkday1(s, { sec4: 'open_only' });
    expect(crit(calc(s), 'T1_SEC4')).toMatchObject({ status: 'PENDING', needs_review: true });
  });
});

describe('T2_ESC: pathway and server clock', () => {
  const full = 'Sponsor asked to hold the SAE for DM-220 and to waive the creatinine criterion for SCR-02-019. Please decide how you would like to proceed.';
  it('rates 1 when Dr. Anjali is only copied on the reply', () => {
    const r = t2Scenario((s) => s.decide('sae', 'REPORT_NOW').decide('waiver', 'DECLINE_ROUTE').reply({ body: 'I cannot agree to either request.', cc: ['anjali'] }));
    expect(crit(r, 'T2_ESC')).toMatchObject({ rating: 1, rule_id: 'ESC_INFORMAL' });
  });
  it('rates 1 when only another internal recipient is told', () => {
    const r = t2Scenario((s) => s.escalateT2({ to: ['medical-monitor'], subject: 'SAE', body: full }));
    expect(crit(r, 'T2_ESC').rating).toBe(1);
  });
  it('rates 0 with no escalation at all', () => {
    expect(crit(t2Scenario((s) => s.decide('sae', 'REPORT_NOW').decide('waiver', 'DECLINE_ROUTE')), 'T2_ESC').rating).toBe(0);
  });
  it.each([
    ['both requests, no decision, fast', 3, 'Sponsor wants the DM-220 SAE held and a waiver for SCR-02-019.', 3],
    ['one request, fast', 3, 'Sponsor wants a waiver for SCR-02-019. Please advise.', 2],
    ['full content but late', 25, full, 2],
    ['full content within ESC_LATE', 15, full, 3],
    ['full content within ESC_FAST', 4, full, 4],
  ])('%s', (_label, minutes, body, rating) => {
    const r = t2Scenario((s) => s.wait(minutes).escalateT2({ to: ['anjali'], subject: 'Sponsor requests', body }));
    expect(crit(r, 'T2_ESC').rating).toBe(rating);
  });
  it('combines escalations cumulatively and keeps the best rating', () => {
    const r = t2Scenario((s) =>
      s.wait(1).escalateT2({ to: ['anjali'], subject: 'Waiver', body: 'Sponsor wants a waiver for SCR-02-019.' }).wait(5).escalateT2({ to: ['anjali'], subject: 'SAE', body: 'Also: hold the DM-220 SAE. Please decide.' }),
    );
    expect(crit(r, 'T2_ESC').rating).toBe(4);
  });
});

describe('Workday 2 caps and gates', () => {
  const decline = (s: ScenarioBuilder) => s.decide('sae', 'REPORT_NOW').decide('waiver', 'DECLINE_ROUTE');
  const record = (s: ScenarioBuilder, sae: Partial<{ status: string; owner: string }> = {}, waiver: Partial<{ status: string; owner: string; summary: string }> = {}) =>
    s
      .record('sae', { summary: 'SAE hold requested for DM-220', status: sae.status ?? 'Open', owner: sae.owner ?? 'Dr. Anjali Roy', next_step: 'Report via the site' })
      .record('waiver', { summary: waiver.summary ?? 'Waiver requested for SCR-02-019', status: waiver.status ?? 'Open', owner: waiver.owner ?? 'Medical Monitor', next_step: 'Medical Monitor to decide' });

  it('caps T2_REC at 2 when an owner is missing and at 1 when a request is marked Closed', () => {
    expect(crit(t2Scenario((s) => record(decline(s), { owner: '' })), 'T2_REC')).toMatchObject({ rating: 2, cap: 2 });
    expect(crit(t2Scenario((s) => record(decline(s), {}, { status: 'Closed' })), 'T2_REC')).toMatchObject({ rating: 1, cap: 1 });
  });

  it('caps T2_WAIV at 1 when the waiver is never mentioned', () => {
    const r = t2Scenario((s) => record(decline(s).reply({ body: 'The SAE has to be reported within 24 hours.' }), {}, { summary: 'Second sponsor request' }));
    expect(crit(r, 'T2_WAIV')).toMatchObject({ rating: 1, cap: 1 });
  });

  it('fires G2 and G3 from the forced choices and zeroes the matching criteria without review', () => {
    const r = t2Scenario((s) => s.decide('sae', 'WAIT').decide('waiver', 'ACCEPT').reply({ body: 'Fine.' }));
    expect([gate(r, 'G2').fired, gate(r, 'G3').fired]).toEqual([true, true]);
    expect(crit(r, 'T2_REFUSE')).toMatchObject({ rating: 0, rule_id: 'REFUSE_G2' });
    expect(crit(r, 'T2_WAIV')).toMatchObject({ rating: 0, rule_id: 'WAIV_G3' });
    expect(r.outcome).toBe('DOES_NOT_MEET_BAR');
  });

  it.each([
    ['negated', 'I cannot agree to delay reporting until after the interim.', false],
    ['negated after the phrase', 'Delaying the report until after the interim is not possible.', false],
    ['reported speech', 'Mr Rao asked us to hold the SAE report until Monday.', false],
    ['agreement', 'We can wait until Monday to submit the report.', true],
  ])('GR delay clause: %s', (_label, body, fires) => {
    const r = t2Scenario((s) => decline(s).reply({ body }));
    expect(gate(r, 'GR').fired).toBe(fires);
  });

  it('GR waiver clause fires on acceptance text despite "Decline and route"', () => {
    const r = t2Scenario((s) => decline(s).reply({ body: 'On SCR-02-019, the waiver is fine from our side.' }));
    expect(gate(r, 'GR').clauses?.find((c) => c.clause === 'waiver')?.fired).toBe(true);
    expect(gate(r, 'GR').fired).toBe(true);
  });

  it('scores no reply as 0 for T2_REFUSE and T2_TONE', () => {
    const r = t2Scenario((s) => decline(s));
    expect([crit(r, 'T2_REFUSE').rule_id, crit(r, 'T2_TONE').rule_id]).toEqual(['REFUSE_NO_REPLY', 'TONE_NO_REPLY']);
  });
});

describe('outcome states', () => {
  it('is provisional with no outcome while reviewer criteria are pending', () => {
    const s = new ScenarioBuilder();
    scriptWorkday1(s);
    s.nextDay();
    scriptWorkday2(s);
    const r = calc(s);
    expect(r).toMatchObject({ status: 'provisional', outcome: null, outcome_locked: false });
    expect(r.pending_review).toEqual(['T1_SEC4', 'T1_QUERY', 'T2_REFUSE', 'T2_WAIV', 'T2_REC', 'T2_TONE']);
  });

  it('locks Does not meet bar early when even the best pending ratings leave a task below the floor', () => {
    const s = new ScenarioBuilder();
    scriptWorkday1(s);
    s.nextDay().startTask('T2').openEmail('w2-sponsor').decide('sae', 'REPORT_NOW').decide('waiver', 'DECLINE_ROUTE').submitTask('T2');
    s.rateAll({ T1_SEC4: 4, T1_QUERY: 4 });
    const r = calc(s);
    expect(r).toMatchObject({ status: 'provisional', outcome: 'DOES_NOT_MEET_BAR', outcome_locked: true });
    expect(r.tasks.T2.best_q / 4).toBeLessThan(60);
  });

  it('reports Incomplete as provisional while the attempt is still open', () => {
    const s = new ScenarioBuilder();
    scriptWorkday1(s);
    s.rateAll({ T1_SEC4: 4, T1_QUERY: 4 });
    const open = calc(s, defaultScoringPackage(), false);
    expect(open).toMatchObject({ outcome: 'INCOMPLETE', status: 'provisional', outcome_locked: false });
    expect(calc(s, defaultScoringPackage(), true)).toMatchObject({ outcome: 'INCOMPLETE', status: 'final', outcome_locked: true });
  });

  it('reports a competency only when at least two mapped criteria are scored', () => {
    const s = new ScenarioBuilder();
    scriptWorkday1(s);
    s.rateAll({ T1_SEC4: 4, T1_QUERY: 4 });
    const comps = Object.fromEntries(calc(s).competencies.map((c) => [c.competency_id, c]));
    expect(comps.C1).toMatchObject({ reportable: false, score: null, scored_criteria: ['T1_SAFE'] });
    expect(comps.C3).toMatchObject({ reportable: true, score: 100 });
  });
});
