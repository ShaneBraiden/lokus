import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ANSWER_KEY_V1_1, PARAMETERS_V1_1, RUBRIC_V1_1 } from '../src';

const wb = JSON.parse(readFileSync(fileURLToPath(new URL('../fixtures/workbook_v1_1.json', import.meta.url)), 'utf8'));
const split = (s: unknown) => String(s ?? '').split(/;|\|/).map((x) => x.trim()).filter(Boolean);

describe('rubric mirror matches the workbook (Master_Rubric)', () => {
  it('has the 12 criteria with the workbook IDs, tasks, weights, methods and competencies', () => {
    const fromWb = wb.master_rubric.map((r: any) => [r['Criterion ID'], r['Task'] === 'Task 1' ? 'T1' : 'T2', r['Weight'], r['Method'], r['Competency']]);
    const fromCode = RUBRIC_V1_1.criteria.map((c) => [c.id, c.task, c.weight, c.method, c.competency]);
    expect(fromCode).toEqual(fromWb);
  });

  it('copies every anchor and note verbatim', () => {
    for (const r of wb.master_rubric) {
      const c = RUBRIC_V1_1.criteria.find((x) => x.id === r['Criterion ID'])!;
      expect(c.name).toBe(r['Criterion']);
      expect(c.what_to_observe).toBe(r['What to observe']);
      expect([c.anchors[4], c.anchors[3], c.anchors[2], c.anchors[1], c.anchors[0]]).toEqual([r['Rating 4'], r['Rating 3'], r['Rating 2'], r['Rating 1'], r['Rating 0']]);
      expect(c.notes).toBe(r['Notes / caps / auto evidence']);
    }
  });

  it('weights each task to exactly 100 (Task_Scoring check)', () => {
    const sum = (t: string) => RUBRIC_V1_1.criteria.filter((c) => c.task === t).reduce((s, c) => s + c.weight, 0);
    expect([sum('T1'), sum('T2')]).toEqual([100, 100]);
  });

  it('mirrors the gates and the competency map', () => {
    expect(RUBRIC_V1_1.gates.map((g) => [g.id, g.task, g.trigger, g.effect, g.severity])).toEqual(
      wb.gates.map((g: any) => [g['Gate ID'], g['Task'], g['Trigger'], g['Effect'], g['Severity']]),
    );
    expect(RUBRIC_V1_1.competencies.map((c) => [c.id, c.name, c.criteria])).toEqual(wb.competency_map.map((c: any) => [c['ID'], c['Competency'], split(c['Mapped criteria'])]));
    for (const c of RUBRIC_V1_1.competencies) expect(c.criteria.length).toBeGreaterThanOrEqual(2);
  });

  it('uses the workbook parameter values', () => {
    for (const p of wb.parameters) expect(PARAMETERS_V1_1[p['Parameter'] as keyof typeof PARAMETERS_V1_1]).toBe(p['Value']);
  });
});

describe('answer key matches the workbook (Answer_Key_CONFIDENTIAL)', () => {
  it('has 12 rows whose points total 100', () => {
    expect(ANSWER_KEY_V1_1).toHaveLength(12);
    expect(ANSWER_KEY_V1_1.reduce((s, r) => s + r.points, 0)).toBe(100);
  });

  it('copies class, references, accepted types, severities and evidence tokens', () => {
    wb.answer_key.forEach((r: any, i: number) => {
      const k = ANSWER_KEY_V1_1[i];
      expect(k.participant_id).toBe(r['Participant ID']);
      expect(k.class).toBe(r['Class']);
      expect(k.points).toBe(r['Points']);
      expect(k.expected_reference).toBe(r['Expected Reference'] === 'NIL' ? null : r['Expected Reference']);
      expect(k.accepted_types).toEqual([r['Accepted Type 1'], r['Accepted Type 2']].filter(Boolean));
      expect(k.accepted_severities).toEqual([r['Accepted Severity 1'], r['Accepted Severity 2']].filter(Boolean));
      expect(k.evidence_tokens).toEqual(split(r['Evidence Tokens']));
    });
  });

  it('marks DM-206, DM-284 and DM-022 clean (the remix key flagged them)', () => {
    const cls = Object.fromEntries(ANSWER_KEY_V1_1.map((r) => [r.participant_id, r.class]));
    expect([cls['AHS-007-DM-206'], cls['AHS-007-DM-284'], cls['AHS-007-DM-022']]).toEqual(['CLEAN', 'CLEAN', 'CLEAN']);
  });
});
