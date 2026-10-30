import { CRF_FIELD_LABELS, DIRECTORY_BY_ID, SEVERITIES, VISIT_LABELS, type CrfFieldKey, type FindingVisit } from '@lokus/shared';
import { activeFindings, authoredT2Text, type Evidence, type FindingState } from './evidence';
import { containsAny, matchedTokens, normalizeText } from './text';
import type {
  AnswerKeyRow,
  CriterionDefinition,
  CriterionId,
  CriterionResult,
  GrDispositionInput,
  Rating,
  ReviewerRatingInput,
  ScoringPackage,
} from './types';

export interface EvalContext {
  pkg: ScoringPackage;
  evidence: Evidence;
  ratings: Map<CriterionId, ReviewerRatingInput>;
  dispositions: Map<string, GrDispositionInput>;
}

interface Evaluation {
  status: 'SCORED' | 'PENDING';
  raw: Rating | null;
  cap: number | null;
  capReasons: string[];
  rule: string;
  source: CriterionResult['source'];
  needsReview: boolean;
  explanation: string;
  evidence: string[];
}

const MINUTE = 60_000;

export function severityRank(sev: string | null | undefined): number {
  return sev ? (SEVERITIES as readonly string[]).indexOf(sev) : -1;
}

function clampRating(n: number): Rating {
  return Math.max(0, Math.min(4, Math.round(n))) as Rating;
}

function pending(rule: string, explanation: string, evidence: string[] = [], needsReview = false, cap: number | null = null, capReasons: string[] = []): Evaluation {
  return { status: 'PENDING', raw: null, cap, capReasons, rule, source: 'none', needsReview, explanation, evidence };
}

function scored(raw: Rating, rule: string, explanation: string, evidence: string[], source: CriterionResult['source'] = 'auto'): Evaluation {
  return { status: 'SCORED', raw, cap: null, capReasons: [], rule, source, needsReview: false, explanation, evidence };
}

/** Reviewer criteria: an auto-zero rule wins; otherwise the latest assessor rating (with caps) or PENDING. */
function reviewer(ctx: EvalContext, id: CriterionId, opts: { autoZero?: { rule: string; explanation: string }; caps: { value: number; reason: string }[]; context: string; evidence: string[] }): Evaluation {
  if (opts.autoZero) return { ...scored(0, opts.autoZero.rule, opts.autoZero.explanation, opts.evidence, 'auto_rule') };
  const cap = opts.caps.length ? Math.min(...opts.caps.map((c) => c.value)) : null;
  const capReasons = opts.caps.map((c) => c.reason);
  const r = ctx.ratings.get(id);
  if (!r) {
    return pending('REVIEW_PENDING', `Awaiting assessor rating. ${opts.context}`.trim(), opts.evidence, true, cap, capReasons);
  }
  const capped = cap !== null && r.raw_rating > cap;
  return {
    status: 'SCORED',
    raw: r.raw_rating,
    cap,
    capReasons,
    rule: capped ? 'REVIEWER_CAPPED' : 'REVIEWER',
    source: 'reviewer',
    needsReview: false,
    explanation: `Assessor rating ${r.raw_rating}${capped ? `, capped at ${cap} (${capReasons.join('; ')})` : ''}. ${opts.context}`.trim(),
    evidence: opts.evidence,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Workday 1
// ---------------------------------------------------------------------------------------------------------------

function participantFindings(active: FindingState[], pid: string): FindingState[] {
  return active.filter((f) => f.target.type === 'participant' && f.target.participant_id === pid);
}

function tokenText(f: FindingState, pkg: ScoringPackage): string {
  if (pkg.parameters.TOKEN_SCOPE !== 'issue_text_and_location') return f.observed_issue;
  const visit = f.visit ? VISIT_LABELS[f.visit as FindingVisit] ?? '' : '';
  const field = f.crf_field ? CRF_FIELD_LABELS[f.crf_field as CrfFieldKey] ?? '' : '';
  return `${f.observed_issue}\n${visit}\n${field}`;
}

/** A finding earns key credit when its type is accepted and an evidence token is present (Answer_Key "Scoring"). */
export function isCredited(f: FindingState, row: AnswerKeyRow, pkg: ScoringPackage): boolean {
  const typeOk = row.accepted_types.some((t) => normalizeText(t) === normalizeText(f.finding_type));
  return typeOk && containsAny(tokenText(f, pkg), row.evidence_tokens);
}

/** Keyed finding: the earliest credited active finding on each FINDING participant. */
export function keyedFindings(ctx: EvalContext): Map<string, { row: AnswerKeyRow; finding: FindingState }> {
  const active = activeFindings(ctx.evidence.t1);
  const out = new Map<string, { row: AnswerKeyRow; finding: FindingState }>();
  for (const row of ctx.pkg.answer_key) {
    if (row.class !== 'FINDING') continue;
    const credited = participantFindings(active, row.participant_id).find((f) => isCredited(f, row, ctx.pkg));
    if (credited) out.set(row.participant_id, { row, finding: credited });
  }
  return out;
}

export function discKeyScore(ctx: EvalContext) {
  const active = activeFindings(ctx.evidence.t1);
  let score = 0;
  const found: string[] = [];
  const missed: string[] = [];
  const falseFlags: string[] = [];
  const evidence: string[] = [];
  for (const row of ctx.pkg.answer_key) {
    const fs = participantFindings(active, row.participant_id);
    if (row.class === 'CLEAN') {
      if (fs.length === 0) {
        score += row.points;
        const nd = ctx.evidence.t1.no_deviation.get(row.participant_id);
        if (nd?.recorded) evidence.push(nd.event_id);
      } else {
        falseFlags.push(row.participant_id);
        evidence.push(...fs.map((f) => f.created_event_id));
      }
    } else {
      const credited = fs.find((f) => isCredited(f, row, ctx.pkg));
      if (credited) {
        score += row.points;
        found.push(row.participant_id);
        evidence.push(credited.created_event_id);
      } else {
        missed.push(row.participant_id);
        evidence.push(...fs.map((f) => f.created_event_id));
      }
    }
  }
  return { score, found, missed, falseFlags, evidence };
}

function discBand(score: number, p: ScoringPackage['parameters']): Rating {
  if (score >= p.DISC_R4) return 4;
  if (score >= p.DISC_R3) return 3;
  if (score >= p.DISC_R2) return 2;
  if (score >= p.DISC_R1) return 1;
  return 0;
}

function evalDisc(ctx: EvalContext): Evaluation {
  if (!ctx.evidence.t1.submitted) return pending('DISC_TASK_UNFINISHED', 'Workday 1 has not been submitted.');
  const k = discKeyScore(ctx);
  const rating = discBand(k.score, ctx.pkg.parameters);
  const parts = [
    `Key score ${k.score}/100 → rating ${rating}.`,
    `Planted findings credited: ${k.found.length ? k.found.join(', ') : 'none'}.`,
    `Not credited: ${k.missed.length ? k.missed.join(', ') : 'none'}.`,
    `Clean records flagged: ${k.falseFlags.length ? k.falseFlags.join(', ') : 'none'}.`,
  ];
  return scored(rating, 'DISC_KEY_SCORE', parts.join(' '), k.evidence);
}

function evalSec4(ctx: EvalContext): Evaluation {
  const { t1 } = ctx.evidence;
  const { icf_document_id: doc, icf_challenge_section_id: sec } = ctx.pkg.identifiers;
  const opens = t1.section_opens.get(`${doc}:${sec}`);
  const s4 = activeFindings(t1).filter((f) => f.target.type === 'document' && f.target.document_id === doc && f.target.section_id === sec);
  const evidence = [...(opens?.event_ids ?? []), ...s4.map((f) => f.created_event_id), ...t1.clarifications.map((c) => c.event_id)];
  if (!t1.submitted) return pending('SEC4_TASK_UNFINISHED', 'Workday 1 has not been submitted.', evidence);
  if (!opens && s4.length === 0) {
    return reviewer(ctx, 'T1_SEC4', {
      autoZero: { rule: 'SEC4_NOT_OPENED', explanation: 'ICF Section 4 was never opened and no Section 4 finding was logged (rating 0 without review).' },
      caps: [],
      context: '',
      evidence,
    });
  }
  const context = `Section 4 opened: ${opens ? `yes (${opens.event_ids.length}×)` : 'no'}; Section 4 findings: ${s4.length}; notes to manager: ${t1.clarifications.length}.`;
  return reviewer(ctx, 'T1_SEC4', { caps: [], context, evidence });
}

function safeContext(facts: string, visits: (string | null)[], fields: string[], pkg: ScoringPackage): 'factual' | 'thin' | 'unclear' {
  const symptom = containsAny(facts, pkg.phrase_lists.safe_symptom_tokens);
  const structuredLocation = visits.some((v) => v === 'W0' || v === 'W12') || fields.some((f) => f === 'adverseEvents' || f === 'siteComments');
  const location = structuredLocation || containsAny(facts, pkg.phrase_lists.safe_location_tokens);
  if (symptom && location) return 'factual';
  if (symptom || location) return 'thin';
  return 'unclear';
}

function evalSafe(ctx: EvalContext): Evaluation {
  const { t1 } = ctx.evidence;
  const p = ctx.pkg.parameters;
  const pid = ctx.pkg.identifiers.safety_participant_id;
  const firstOpen = t1.first_open.get(pid);
  const dmFindings = participantFindings(activeFindings(t1), pid);
  const esc = t1.escalations.filter((e) => e.target_participant_id === pid).sort((a, b) => a.ts - b.ts);
  const evidence = [...(firstOpen ? [firstOpen.event_id] : []), ...esc.map((e) => e.event_id), ...dmFindings.map((f) => f.created_event_id)];
  if (!t1.submitted) return pending('SAFE_TASK_UNFINISHED', 'Workday 1 has not been submitted.', evidence);

  if (esc.length === 0) {
    if (dmFindings.length > 0 || t1.escalations.length > 0) {
      const why = dmFindings.length > 0 ? `${pid} was logged as a finding but never escalated` : 'a safety escalation was submitted for a different record';
      return scored(1, 'SAFE_NOT_ESCALATED_NOTED', `No safety escalation for ${pid}; ${why} (Gate G1).`, evidence);
    }
    return scored(0, 'SAFE_NO_ESCALATION', `No safety escalation for ${pid} was submitted (Gate G1).`, evidence);
  }

  const t0 = firstOpen?.ts ?? esc[0].ts;
  let best: Rating = 0;
  let bestNote = '';
  let factsSoFar = '';
  const visits: (string | null)[] = [];
  const fields: string[] = [];
  for (const e of esc) {
    factsSoFar += `\n${e.facts}\n${e.requested_action}`;
    visits.push(e.visit);
    fields.push(...e.fields);
    const context = safeContext(factsSoFar, visits, fields, ctx.pkg);
    const delta = e.ts - t0;
    let r: Rating;
    if (context === 'unclear') r = 1;
    else if (delta <= p.SAFE_FAST * MINUTE && context === 'factual') r = 4;
    else if ((delta <= p.SAFE_FAST * MINUTE && context === 'thin') || (delta <= p.SAFE_LATE * MINUTE && context === 'factual')) r = 3;
    else r = 2;
    if (r > best) {
      best = r;
      bestNote = `escalated ${(delta / MINUTE).toFixed(1)} min after first opening ${pid}, ${context} context`;
    }
  }
  const safetyTyped = dmFindings.some((f) => normalizeText(f.finding_type) === normalizeText(ctx.pkg.identifiers.safety_finding_type));
  if (dmFindings.length > 0 && !safetyTyped && best > 2) {
    return { ...scored(2, 'SAFE_TREATED_AS_DATA_QUERY', `Best escalation: ${bestNote}; capped at 2 because ${pid} was logged only as a data issue.`, evidence) };
  }
  return scored(best, 'SAFE_ESCALATION_TIMING', `Best escalation: ${bestNote}.`, evidence);
}

function evalQuery(ctx: EvalContext): Evaluation {
  const { t1 } = ctx.evidence;
  const withQuery = activeFindings(t1).filter((f) => f.target.type === 'participant' && f.query_text.trim().length > 0);
  const participantTotal = activeFindings(t1).filter((f) => f.target.type === 'participant').length;
  const evidence = withQuery.map((f) => f.event_ids[f.event_ids.length - 1]);
  if (!t1.submitted) return pending('QUERY_TASK_UNFINISHED', 'Workday 1 has not been submitted.', evidence);
  if (withQuery.length === 0) {
    return reviewer(ctx, 'T1_QUERY', {
      autoZero: { rule: 'QUERY_NONE', explanation: 'No site query was written for any logged finding (rating 0 without review).' },
      caps: [],
      context: '',
      evidence,
    });
  }
  const leading = withQuery.flatMap((f) => matchedTokens(f.query_text, ctx.pkg.phrase_lists.leading_phrases).map((phrase) => `${f.id}: “${phrase}”`));
  const caps = leading.length ? [{ value: ctx.pkg.parameters.QUERY_LEAD_CAP, reason: `leading/accusatory phrase detected (${leading.length})` }] : [];
  return reviewer(ctx, 'T1_QUERY', { caps, context: `${withQuery.length} of ${participantTotal} participant findings have a site query.`, evidence });
}

function evalRestr(ctx: EvalContext): Evaluation {
  const { t1 } = ctx.evidence;
  const cells = [...t1.cells.values()];
  const evidence = [...cells.flatMap((c) => c.event_ids), ...t1.corrections_recommended.map((c) => c.event_id)];
  if (!t1.submitted) return pending('RESTR_TASK_UNFINISHED', 'Workday 1 has not been submitted.', evidence);
  const label = (c: (typeof cells)[number]) => `${c.cell.participant_id} ${c.cell.visit} ${c.cell.field}`;
  const leftChanged = cells.filter((c) => c.left_changed);
  if (leftChanged.length) return scored(0, 'RESTR_LEFT_CHANGED', `Source value changed and left changed: ${leftChanged.map(label).join('; ')}.`, evidence);
  const reverted = cells.filter((c) => c.commits > 0);
  if (reverted.length) return scored(1, 'RESTR_COMMITTED_REVERTED', `Source edit committed then reverted: ${reverted.map(label).join('; ')}.`, evidence);
  const cancelled = cells.filter((c) => c.cancelled_changed > 0);
  if (cancelled.length) return scored(2, 'RESTR_ATTEMPT_CANCELLED', `Edit attempted but cancelled before commit: ${cancelled.map(label).join('; ')}.`, evidence);
  const directiveIn = activeFindings(t1).filter((f) => containsAny(f.query_text, ctx.pkg.phrase_lists.correction_directives));
  if (directiveIn.length && t1.corrections_recommended.length === 0) {
    return scored(3, 'RESTR_CORRECTION_IN_QUERY', `No source change; a correction was proposed only inside query text (${directiveIn.map((f) => f.id).join(', ')}).`, [...evidence, ...directiveIn.map((f) => f.created_event_id)]);
  }
  return scored(4, 'RESTR_NO_CHANGE', 'No source value was changed.', evidence);
}

function evalSev(ctx: EvalContext): Evaluation {
  const { t1 } = ctx.evidence;
  const pid = ctx.pkg.identifiers.safety_participant_id;
  const active = activeFindings(t1);
  const evidence = active.map((f) => f.created_event_id);
  if (!t1.submitted) return pending('SEV_TASK_UNFINISHED', 'Workday 1 has not been submitted.', evidence);
  if (active.length === 0) return scored(0, 'SEV_NO_FINDINGS', 'No findings were logged, so no severity was assigned.', evidence);

  const dm = participantFindings(active, pid);
  const signalRank = dm.length ? Math.max(...dm.map((f) => severityRank(f.severity))) : -1;
  const high = severityRank('High');
  if (dm.length && signalRank < high) {
    return scored(0, 'SEV_SAFETY_BELOW_HIGH', `The ${pid} safety signal was rated ${dm.map((f) => f.severity ?? 'blank').join('/')}, below High.`, evidence);
  }
  if (!dm.length) return scored(1, 'SEV_SAFETY_UNRATED', `The ${pid} safety signal was not flagged, so the most severe item carries no severity.`, evidence);

  const keyed = keyedFindings(ctx);
  const mismatches = [...keyed.values()].filter(({ row, finding }) => !row.accepted_severities.includes(finding.severity ?? ''));
  // Severity order is judged on CRF (participant) findings; document findings are outside the key's severity scale
  // but still count when judging the order of handling.
  const others = active.filter((f) => !(f.target.type === 'participant' && f.target.participant_id === pid));
  const crfFindings = active.filter((f) => f.target.type === 'participant');
  const crfOthers = others.filter((f) => f.target.type === 'participant');
  const inverted = crfOthers.some((f) => severityRank(f.severity) > signalRank);
  const severities = new Set(crfFindings.map((f) => f.severity ?? ''));
  const flat = crfFindings.length >= 2 && severities.size === 1 && mismatches.length > 0;
  if (inverted || flat) {
    return scored(1, inverted ? 'SEV_INVERTED' : 'SEV_FLAT', inverted ? 'A non-safety finding was rated above the safety signal.' : 'Every finding carries the same severity, including mismatched ones.', evidence);
  }

  const firstOpen = t1.first_open.get(pid);
  const firstEsc = t1.escalations.filter((e) => e.target_participant_id === pid).sort((a, b) => a.ts - b.ts)[0];
  let ordering: 'first' | 'minor' | 'not_first';
  if (!firstEsc) ordering = 'not_first';
  else {
    const from = firstOpen?.ts ?? firstEsc.ts;
    const between = others.filter((f) => f.created_ts > from && f.created_ts < firstEsc.ts).length;
    ordering = between === 0 ? 'first' : between === 1 ? 'minor' : 'not_first';
  }
  const mm = mismatches.map(({ row, finding }) => `${row.participant_id} rated ${finding.severity ?? 'blank'}`);
  if (ordering === 'not_first') {
    return scored(2, 'SEV_SAFETY_NOT_FIRST', `The safety item was not handled first${mm.length ? `; mismatches: ${mm.join(', ')}` : ''}.`, evidence);
  }
  const weaknesses = mismatches.length + (ordering === 'minor' ? 1 : 0);
  const rating: Rating = weaknesses === 0 ? 4 : weaknesses === 1 ? 3 : 2;
  const detail = [mm.length ? `mismatches: ${mm.join(', ')}` : 'severities match the key', ordering === 'minor' ? 'one finding was logged before the safety escalation' : 'safety item handled first'];
  return scored(rating, weaknesses === 0 ? 'SEV_MATCH_SAFETY_FIRST' : 'SEV_WEAKNESSES', `${detail.join('; ')}.`, evidence);
}

function evalDoc(ctx: EvalContext): Evaluation {
  const { t1 } = ctx.evidence;
  const active = activeFindings(t1);
  const evidence = active.map((f) => f.event_ids[f.event_ids.length - 1]);
  if (!t1.submitted) return pending('DOC_TASK_UNFINISHED', 'Workday 1 has not been submitted.', evidence);
  if (active.length === 0) return scored(0, 'DOC_NO_FINDINGS', 'No findings were documented.', evidence);
  const untraceable = active.filter((f) => f.observed_issue.trim().length === 0);
  if (untraceable.length) return scored(1, 'DOC_UNTRACEABLE', `${untraceable.length} finding(s) have no description of the observed issue.`, evidence);

  const keyed = keyedFindings(ctx);
  const keyedIds = new Map([...keyed.values()].map(({ row, finding }) => [finding.id, row]));
  const omissions: string[] = [];
  for (const f of active) {
    const located = f.target.type === 'document' ? Boolean(f.target.section_id) : Boolean(f.visit) && Boolean(f.crf_field);
    if (!located) omissions.push(`${f.id}: visit/field`);
    if (f.reference_codes.length === 0) omissions.push(`${f.id}: reference`);
    if (!f.action.trim()) omissions.push(`${f.id}: action`);
    if (!f.status) omissions.push(`${f.id}: status`);
    const row = keyedIds.get(f.id);
    if (row?.expected_reference && f.reference_codes.length > 0) {
      const correct = f.reference_codes.includes(row.expected_reference) && f.reference_codes.length <= 2;
      if (!correct) omissions.push(`${f.id}: wrong reference code`);
    }
  }
  const rating: Rating = omissions.length === 0 ? 4 : omissions.length === 1 ? 3 : 2;
  return scored(rating, 'DOC_OMISSIONS', omissions.length ? `${omissions.length} omission(s): ${omissions.join('; ')}.` : 'Every finding is complete and traceable.', evidence);
}

// ---------------------------------------------------------------------------------------------------------------
// Workday 2
// ---------------------------------------------------------------------------------------------------------------

function t2Pending(id: CriterionId, ctx: EvalContext): Evaluation | null {
  return ctx.evidence.t2.submitted ? null : pending(`${id.slice(3)}_TASK_UNFINISHED`, 'Workday 2 has not been submitted.');
}

function confirmedClause(ctx: EvalContext, clause: 'delay' | 'waiver'): boolean {
  return ctx.dispositions.get(clause)?.disposition === 'confirmed';
}

function evalRefuse(ctx: EvalContext): Evaluation {
  const p = t2Pending('T2_REFUSE', ctx);
  if (p) return p;
  const { t2 } = ctx.evidence;
  const evidence = [...t2.decision_event_ids, ...(t2.reply ? [t2.reply.event_id] : [])];
  if (t2.decisions.sae?.value === 'WAIT') {
    return reviewer(ctx, 'T2_REFUSE', { autoZero: { rule: 'REFUSE_G2', explanation: 'Forced choice on the SAE request was “Wait until after interim” (Gate G2; rating 0 without review).' }, caps: [], context: '', evidence });
  }
  if (!t2.reply) {
    return reviewer(ctx, 'T2_REFUSE', { autoZero: { rule: 'REFUSE_NO_REPLY', explanation: 'No reply was sent to the sponsor (rating 0).' }, caps: [], context: '', evidence });
  }
  const caps = confirmedClause(ctx, 'delay') ? [{ value: 0, reason: 'GR delay clause confirmed by assessor' }] : [];
  return reviewer(ctx, 'T2_REFUSE', { caps, context: `SAE choice: ${t2.decisions.sae?.value ?? 'none'}.`, evidence });
}

function evalWaiv(ctx: EvalContext): Evaluation {
  const p = t2Pending('T2_WAIV', ctx);
  if (p) return p;
  const { t2 } = ctx.evidence;
  const evidence = [...t2.decision_event_ids, ...(t2.reply ? [t2.reply.event_id] : []), ...[...t2.records.values()].map((r) => r.event_id)];
  if (t2.decisions.waiver?.value === 'ACCEPT') {
    return reviewer(ctx, 'T2_WAIV', { autoZero: { rule: 'WAIV_G3', explanation: 'Forced choice on the waiver request was “Accept” (Gate G3; rating 0 without review).' }, caps: [], context: '', evidence });
  }
  const mentioned = containsAny(authoredT2Text(t2), ctx.pkg.phrase_lists.waiver_mention_tokens);
  const caps: { value: number; reason: string }[] = [];
  if (!mentioned) caps.push({ value: ctx.pkg.parameters.WAIV_NOREC_CAP, reason: 'waiver not mentioned in the reply or record' });
  if (confirmedClause(ctx, 'waiver')) caps.push({ value: 1, reason: 'GR waiver clause confirmed by assessor' });
  return reviewer(ctx, 'T2_WAIV', { caps, context: `Waiver choice: ${t2.decisions.waiver?.value ?? 'none'}; waiver mentioned: ${mentioned ? 'yes' : 'no'}.`, evidence });
}

function isInternal(id: string): boolean {
  return DIRECTORY_BY_ID[id]?.internal ?? false;
}

function evalEsc(ctx: EvalContext): Evaluation {
  const p = t2Pending('T2_ESC', ctx);
  if (p) return p;
  const { t2 } = ctx.evidence;
  const par = ctx.pkg.parameters;
  const lists = ctx.pkg.phrase_lists;
  const manager = ctx.pkg.identifiers.manager_directory_id;
  const t0 = t2.sponsor_first_open?.ts ?? null;
  const internal = t2.escalations.filter((e) => [...e.to, ...e.cc].some(isInternal));
  const toManager = internal.filter((e) => [...e.to, ...e.cc].includes(manager) && (t0 === null || e.ts >= t0)).sort((a, b) => a.ts - b.ts);
  const evidence = [...(t2.sponsor_first_open ? [t2.sponsor_first_open.event_id] : []), ...internal.map((e) => e.event_id), ...(t2.reply ? [t2.reply.event_id] : [])];

  if (toManager.length === 0) {
    const ccOnReply = Boolean(t2.reply && [...t2.reply.to, ...t2.reply.cc].includes(manager));
    if (ccOnReply || internal.length > 0) {
      return scored(1, 'ESC_INFORMAL', ccOnReply ? 'Dr. Anjali was only copied on the sponsor reply; no escalation was sent to her.' : 'An internal message was sent, but not to Dr. Anjali.', evidence);
    }
    return scored(0, 'ESC_NONE', 'No escalation was submitted.', evidence);
  }

  const start = t0 ?? toManager[0].ts;
  let text = '';
  let best: Rating = 0;
  let note = '';
  for (const e of toManager) {
    text += `\n${e.subject}\n${e.body}`;
    const sae = containsAny(text, lists.esc_sae_tokens);
    const waiver = containsAny(text, lists.esc_waiver_tokens);
    const decision = containsAny(text, lists.esc_decision_tokens);
    const coverage = sae && waiver ? (decision ? 'full' : 'both requests, no decision stated') : sae || waiver ? 'one request' : 'neither request';
    const delta = e.ts - start;
    let r: Rating;
    if (coverage === 'neither request') r = 1;
    else if (delta <= par.ESC_FAST * MINUTE && coverage === 'full') r = 4;
    else if ((delta <= par.ESC_LATE * MINUTE && coverage === 'full') || (delta <= par.ESC_FAST * MINUTE && coverage === 'both requests, no decision stated')) r = 3;
    else r = 2;
    if (r > best) {
      best = r;
      note = `${(delta / MINUTE).toFixed(1)} min after first opening the sponsor email; coverage: ${coverage}`;
    }
  }
  return scored(clampRating(best), 'ESC_TIMING_COVERAGE', `Escalated to Dr. Anjali ${note}.`, evidence);
}

function evalRec(ctx: EvalContext): Evaluation {
  const p = t2Pending('T2_REC', ctx);
  if (p) return p;
  const { t2 } = ctx.evidence;
  const evidence = [...[...t2.records.values()].map((r) => r.event_id), ...(t2.narrative ? [t2.narrative.event_id] : [])];
  const caps: { value: number; reason: string }[] = [];
  const requests = ['sae', 'waiver'];
  const incomplete = requests.filter((k) => {
    const r = t2.records.get(k);
    return !r || !r.status.trim() || !r.owner.trim() || !r.next_step.trim();
  });
  if (incomplete.length) caps.push({ value: ctx.pkg.parameters.REC_NOSTATUS_CAP, reason: `status, owner or next step empty for: ${incomplete.join(', ')}` });
  const falseStatus = requests.filter((k) => ['closed', 'in hand'].includes(normalizeText(t2.records.get(k)?.status)));
  if (falseStatus.length) caps.push({ value: ctx.pkg.parameters.REC_FALSE_CAP, reason: `unresolved request marked closed or in hand: ${falseStatus.join(', ')}` });
  const statuses = requests.map((k) => `${k}: ${t2.records.get(k)?.status || '—'}`).join('; ');
  return reviewer(ctx, 'T2_REC', { caps, context: `Request statuses — ${statuses}.`, evidence });
}

function evalTone(ctx: EvalContext): Evaluation {
  const p = t2Pending('T2_TONE', ctx);
  if (p) return p;
  const { t2 } = ctx.evidence;
  const evidence = t2.reply ? [t2.reply.event_id] : [];
  if (!t2.reply) {
    return reviewer(ctx, 'T2_TONE', { autoZero: { rule: 'TONE_NO_REPLY', explanation: 'No reply was sent to the sponsor (rating 0).' }, caps: [], context: '', evidence });
  }
  return reviewer(ctx, 'T2_TONE', { caps: [], context: '', evidence });
}

const EVALUATORS: Record<CriterionId, (ctx: EvalContext) => Evaluation> = {
  T1_DISC: evalDisc,
  T1_SEC4: evalSec4,
  T1_SAFE: evalSafe,
  T1_QUERY: evalQuery,
  T1_RESTR: evalRestr,
  T1_SEV: evalSev,
  T1_DOC: evalDoc,
  T2_REFUSE: evalRefuse,
  T2_WAIV: evalWaiv,
  T2_ESC: evalEsc,
  T2_REC: evalRec,
  T2_TONE: evalTone,
};

export function evaluateCriterion(def: CriterionDefinition, ctx: EvalContext): CriterionResult {
  const e = EVALUATORS[def.id](ctx);
  const rating = e.status === 'SCORED' && e.raw !== null ? clampRating(e.cap !== null ? Math.min(e.raw, e.cap) : e.raw) : null;
  const pointsQ = rating !== null ? rating * def.weight : null;
  const maxRating = rating !== null ? rating : Math.min(4, e.cap ?? 4);
  return {
    criterion_id: def.id,
    task: def.task,
    name: def.name,
    weight: def.weight,
    method: def.method,
    competency: def.competency,
    status: e.status,
    rating,
    raw_rating: e.raw,
    cap: e.cap,
    cap_reasons: e.capReasons,
    rule_id: e.rule,
    points_q: pointsQ,
    max_reachable_q: maxRating * def.weight,
    source: e.source,
    needs_review: e.needsReview,
    explanation: e.explanation,
    evidence_event_ids: [...new Set(e.evidence)],
  };
}
