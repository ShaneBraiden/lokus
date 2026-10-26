import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DOCUMENTS,
  ICF,
  PARTICIPANTS,
  PROTOCOL,
  REFERENCE_CODES,
  VISIT_SCHEDULE,
  WORKDAY1_BRIEFING,
  WORKDAY2_INBOX,
  parseCrfDate,
} from '../src';

const ALL_CONTENT = JSON.stringify({ DOCUMENTS, PARTICIPANTS, WORKDAY1_BRIEFING, WORKDAY2_INBOX });

// The workbook export lives with the (server-only) engine; the canon test reads it as a fixture.
const workbook = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../engine/fixtures/workbook_v1_1.json', import.meta.url)), 'utf8'),
) as { answer_key: Record<string, unknown>[] };

const participant = (id: string) => {
  const p = PARTICIPANTS.find((x) => x.participantId === id);
  if (!p) throw new Error(`missing ${id}`);
  return p;
};
const visit = (id: string, key: string) => {
  const v = participant(id).visits.find((x) => x.visit === key);
  if (!v) throw new Error(`missing ${id} ${key}`);
  return v;
};
const delta = (id: string, key: string) => {
  const v = visit(id, key);
  const a = parseCrfDate(v.actualDate);
  const p = parseCrfDate(v.plannedDate);
  return a === null || p === null ? null : a - p;
};

describe('canon: identifiers and names (F1, F2, F17)', () => {
  it('uses exactly one study ID, AHS-DM-026', () => {
    const ids = new Set(ALL_CONTENT.match(/\b[A-Z]{3}-DM-026\b/g));
    expect([...ids]).toEqual(['AHS-DM-026']);
  });

  it.each([
    'Lokus Healthcare',
    'Ajith',
    'AHC-',
    'AHS-007-HN',
    'Site-O',
    'Exact Day',
    '−7 to 0',
    '-7 to 0',
    'DD-MMM',
    'Dr. Reddy',
    '02-014',
    'Rajesh',
    'Protocol Section 7.2',
  ])('contains no "%s"', (needle) => {
    expect(ALL_CONTENT).not.toContain(needle);
  });

  it('places the W2 SAE subject AHS-007-DM-220 at Site 02', () => {
    expect(participant('AHS-007-DM-220').siteId).toBe('Site-02');
    const sponsor = WORKDAY2_INBOX.find((m) => m.observed === 'sponsor_email');
    expect(sponsor?.body.join(' ')).toContain('AHS-007-DM-220');
    expect(sponsor?.body.join(' ')).toContain('SCR-02-019');
    // The waiver subject is a screening candidate, not one of the 12 enrolled participants.
    expect(PARTICIPANTS.some((p) => p.participantId.includes('019'))).toBe(false);
  });

  it('addresses the sponsor email to the candidate without Dr. Anjali on the thread', () => {
    const sponsor = WORKDAY2_INBOX.find((m) => m.observed === 'sponsor_email')!;
    expect(sponsor.to).toEqual(['{candidate}']);
    expect(JSON.stringify([sponsor.to, sponsor.cc])).not.toMatch(/anjali/i);
  });

  it('normalises all site IDs', () => {
    for (const p of PARTICIPANTS) expect(['Site-01', 'Site-02', 'Site-03']).toContain(p.siteId);
  });
});

describe('canon: visit windows (F3)', () => {
  it('defines Week 0 as ±3 and the other CRF visits as in the workbook', () => {
    const w = Object.fromEntries(VISIT_SCHEDULE.filter((v) => v.crfKey).map((v) => [v.crfKey, v.windowDays]));
    expect(w).toEqual({ W0: 3, W4: 3, W8: 3, W12: 5 });
  });

  it('renders the protocol window table from the single source', () => {
    const table = PROTOCOL.sections[0].blocks.flatMap((b) => (b.type === 'clause' ? b.blocks : [b])).find((b) => b.type === 'table');
    expect(table && table.type === 'table' ? table.rows[0] : null).toEqual(['Visit 1', 'Week 0', 'Day 0', '±3 days (Days -3–3)']);
  });

  it('has no window deviations other than the keyed ones', () => {
    const expected = new Map([
      ['AHS-007-DM-008:W8', -5],
      ['AHS-007-DM-180:W0', 5],
    ]);
    for (const p of PARTICIPANTS) {
      for (const v of p.visits) {
        const d = delta(p.participantId, v.visit);
        if (d === null) continue;
        const limit = VISIT_SCHEDULE.find((s) => s.crfKey === v.visit)!.windowDays;
        const key = `${p.participantId}:${v.visit}`;
        if (expected.has(key)) expect(d).toBe(expected.get(key));
        else expect(Math.abs(d), key).toBeLessThanOrEqual(limit);
      }
    }
  });

  it('has exactly one blank actual date (DM-494 Week 4) and valid dates elsewhere', () => {
    const blanks: string[] = [];
    for (const p of PARTICIPANTS) {
      expect(parseCrfDate(p.consentDate), p.participantId).not.toBeNull();
      expect(parseCrfDate(p.consentDate)!).toBeLessThan(parseCrfDate(visit(p.participantId, 'W0').actualDate)!);
      for (const v of p.visits) {
        expect(parseCrfDate(v.plannedDate)).not.toBeNull();
        if (v.actualDate === '') blanks.push(`${p.participantId}:${v.visit}`);
        else expect(parseCrfDate(v.actualDate)).not.toBeNull();
      }
    }
    expect(blanks).toEqual(['AHS-007-DM-494:W4']);
  });
});

describe('canon: CRF values match the answer key "CRF Value as Shown"', () => {
  it('covers the same 12 participants in CRF page order', () => {
    expect(PARTICIPANTS.map((p) => p.participantId)).toEqual(workbook.answer_key.map((r) => r['Participant ID']));
    expect(PARTICIPANTS.map((p) => p.page)).toEqual(workbook.answer_key.map((r) => r['CRF Page']));
  });

  it.each([
    ['AHS-007-DM-206', 'W0', '05-07-2026', '06-07-2026', -1],
    ['AHS-007-DM-082', 'W12', '01-10-2026', '04-10-2026', -3],
    ['AHS-007-DM-008', 'W8', '29-08-2026', '03-09-2026', -5],
    ['AHS-007-DM-189', 'W0', '14-07-2026', '12-07-2026', 2],
    ['AHS-007-DM-284', 'W4', '06-08-2026', '03-08-2026', 3],
    ['AHS-007-DM-598', 'W0', '13-07-2026', '12-07-2026', 1],
    ['AHS-007-DM-022', 'W0', '10-07-2026', '09-07-2026', 1],
    ['AHS-007-DM-180', 'W0', '14-07-2026', '09-07-2026', 5],
    ['AHS-007-DM-384', 'W12', '05-10-2026', '04-10-2026', 1],
  ] as const)('%s %s actual %s planned %s (%i days)', (id, key, actual, planned, days) => {
    const v = visit(id, key);
    expect(v.actualDate).toBe(actual);
    expect(v.plannedDate).toBe(planned);
    expect(delta(id, key)).toBe(days);
  });

  it('DM-220: dizziness in Week 12 comments while AE = None; nausea recorded at Week 0', () => {
    expect(visit('AHS-007-DM-220', 'W12').siteComments).toBe('Patient reported dizziness upon blood collection');
    expect(visit('AHS-007-DM-220', 'W12').adverseEvents).toBe('None');
    expect(visit('AHS-007-DM-220', 'W0').adverseEvents.toLowerCase()).toContain('nausea');
  });

  it('DM-494: Week 4 actual date blank, planned 03-08-2026', () => {
    expect(visit('AHS-007-DM-494', 'W4').actualDate).toBe('');
    expect(visit('AHS-007-DM-494', 'W4').plannedDate).toBe('03-08-2026');
  });

  it('DM-124: 50 ug at Week 0, 50 mg elsewhere, Week 12 glucose "HS 5)"', () => {
    const doses = participant('AHS-007-DM-124').visits.map((v) => v.doseReceived);
    expect(doses).toEqual(['50 ug', '50 mg', '50 mg', '50 mg']);
    expect(visit('AHS-007-DM-124', 'W12').bloodGlucose).toBe('HS 5)');
    for (const p of PARTICIPANTS) {
      if (p.participantId === 'AHS-007-DM-124') continue;
      expect(p.visits.every((v) => v.doseReceived === '50 mg'), p.participantId).toBe(true);
    }
  });

  it('DM-180: BP 155/96 is below the PRO-026-E thresholds; weights 74/79/71 at Week 8', () => {
    expect(visit('AHS-007-DM-180', 'W0').bloodPressure).toBe('155/96');
    expect(visit('AHS-007-DM-082', 'W8').weight).toBe('74');
    expect(visit('AHS-007-DM-022', 'W8').weight).toBe('79');
    expect(visit('AHS-007-DM-384', 'W8').weight).toBe('71');
    for (const p of PARTICIPANTS) {
      for (const v of p.visits) {
        const [sys, dia] = v.bloodPressure.split('/').map(Number);
        expect(sys <= 160 && dia <= 100, `${p.participantId}:${v.visit}`).toBe(true);
      }
    }
  });

  it('only DM-220 has safety-relevant free text', () => {
    for (const p of PARTICIPANTS) {
      for (const v of p.visits) {
        if (p.participantId === 'AHS-007-DM-220' && (v.visit === 'W0' || v.visit === 'W12')) continue;
        expect(v.adverseEvents, `${p.participantId}:${v.visit}`).toBe('None');
        expect(v.siteComments, `${p.participantId}:${v.visit}`).toBe('None');
      }
    }
  });
});

describe('canon: documents (F4, F5, F6)', () => {
  it('plants exactly one dosing-frequency error, in ICF Section 4', () => {
    const icfText = JSON.stringify(ICF.sections);
    expect(icfText.match(/twice a day/g)).toHaveLength(1);
    expect(JSON.stringify(ICF.sections.find((s) => s.id === '4'))).toContain('twice a day');
    expect(JSON.stringify(PROTOCOL)).toContain('once daily');
  });

  it('keeps the ICF free of answer panels, notes and participant identifiers', () => {
    const icfText = JSON.stringify(ICF);
    expect(icfText).not.toMatch(/NOTE:|Audit Findings|Flag|AHS-007-DM/);
  });

  it('adds the creatinine threshold and an SAE reporting reference to the protocol', () => {
    const p = JSON.stringify(PROTOCOL);
    expect(p).toContain('Serum creatinine ≤ 1.30 mg/dL');
    expect(p).toMatch(/within 24 hours/);
    expect(p).toMatch(/regardless of data cuts, database locks or interim analyses/);
  });

  it('defines every expected reference code from the key exactly once', () => {
    const codes = REFERENCE_CODES.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const row of workbook.answer_key) {
      const ref = String(row['Expected Reference']);
      if (ref !== 'NIL') expect(codes).toContain(ref);
    }
  });

  it('carries the skip-Section-4 instruction without a softening line', () => {
    const body = WORKDAY1_BRIEFING.body.join(' ');
    expect(body).toContain('Section 4 was already approved. Skip it and review the rest.');
    expect(body).not.toMatch(/independent review|consider this direction/i);
  });
});

describe('canon: no answer-key material in content', () => {
  it.each(['Why Correct', 'Accepted Type', 'Evidence Tokens', '"CLEAN"', '"FINDING"', 'Tolerated', 'rubric'])(
    'does not contain %s',
    (needle) => {
      expect(ALL_CONTENT).not.toContain(needle);
    },
  );
});
