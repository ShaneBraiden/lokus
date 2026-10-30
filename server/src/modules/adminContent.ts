import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { DOCUMENT_ORDER, DOCUMENTS, PARTICIPANTS, SIMULATION, STUDY, WORKDAY2_INBOX } from '#content';
import type { AppDeps } from '../context';
import { scoringPackages, simulationVersions } from '../db/schema';

/**
 * The SME-confirm register: every rule, story element and wording that was drafted (not taken verbatim from the
 * spec or workbook) and needs a subject-matter expert's sign-off before live candidates. Admin-only.
 */
export const SME_REGISTER = [
  { id: 'SME-01', area: 'Content', title: 'Consent form Section 4 planted error', draft: 'Section 4 says the study tablet is taken twice a day; the protocol (PRO-026-B) says one 50 mg tablet once daily.', where: 'server/src/content/documents/icf.ts' },
  { id: 'SME-02', area: 'Content', title: 'Manager instruction and challenge channel', draft: 'The Workday 1 briefing says Section 4 "was already approved. Skip it and review the rest." Candidates can question it through "Message Dr. Anjali".', where: 'server/src/content/mail/workday1.ts' },
  { id: 'SME-03', area: 'Scoring', title: 'Phrase lists', draft: 'Leading/accusatory query phrases (T1_QUERY cap), correction directives (T1_RESTR 3), GR agreement phrases for delay and waiver, with negation and reported-speech guards.', where: 'server/src/engine/phrases/v1_1.ts' },
  { id: 'SME-04', area: 'Scoring', title: 'Token rules', draft: 'T1_SAFE factual vs thin (symptom plus visit/field tokens); T2_ESC request coverage and "decision needed"; T2_WAIV mention tokens; TOKEN_SCOPE for T1_DISC evidence tokens.', where: 'server/src/engine/phrases/v1_1.ts, parameters' },
  { id: 'SME-05', area: 'Scoring', title: 'Rule refinements', draft: 'T1_SAFE best of escalations; T1_SEV keyed/flat/handled-first; T1_DOC omission counting and the two-code rule; T2_ESC cumulative coverage; T1_RESTR attempt = draft actually changed.', where: 'server/src/engine/criteria.ts' },
  { id: 'SME-06', area: 'Scoring', title: 'G1 is per safety signal', draft: 'Escalating a different participant does not satisfy G1 for DM-220.', where: 'server/src/engine/criteria.ts' },
  { id: 'SME-07', area: 'Process', title: 'Provisional results and GR dispositions', draft: 'Results show "Awaiting review" while reviewer criteria are pending. GR holds are cleared or confirmed by an assessor; a confirmation caps T2_REFUSE at 0 (delay) or T2_WAIV at 1 (waiver).', where: 'server/src/engine/calculate.ts' },
  { id: 'SME-08', area: 'Content', title: 'Workday 2 story', draft: 'DM-220 hospitalised after syncope; the sponsor asks to hold the SAE until after the interim; the waiver concerns screening candidate SCR-02-019 outside the 12.', where: 'server/src/content/mail/workday2.ts' },
  { id: 'SME-09', area: 'Content', title: 'Protocol additions', draft: 'Creatinine ≤ 1.30 mg/dL eligibility, the SAE reporting reference, and reference codes embedded in the documents.', where: 'server/src/content/documents/protocol.ts' },
  { id: 'SME-10', area: 'Content', title: 'CRF normalisation', draft: 'Site-01/02 normalised; DM-124 Week 12 glucose shown as "HS 5)" per the key; extract-scope note for Visits 1, 4, 6 and 7.', where: 'server/src/content/participants.ts' },
  { id: 'SME-11', area: 'Process', title: 'Timing and form defaults', draft: 'Workday 1 timing is wall-clock across breaks; the 60-minute guide is soft; only target and type are required to save a finding; over-escalation is not penalised.', where: 'client player, server/src/modules/player' },
  { id: 'SME-12', area: 'Policy', title: 'Talent-pool listing scope', draft: 'Employers browsing the talent pool see the permitted result report and a contact email.', where: 'server/src/modules/employer.ts' },
  { id: 'SME-13', area: 'Scoring', title: 'GR guards', draft: 'Text that describes the sponsor’s request (reported speech such as "asked", "requested") or negates it is not agreement. The record’s request summary is not scanned for GR.', where: 'server/src/engine/text.ts' },
  { id: 'SME-14', area: 'Scoring', title: 'T1_SEV comparisons and DISC banding', draft: '"Inverted" and "flat" compare CRF findings only; one flagged clean record costs 2 key points but stays in the DISC_R4 band, as workbook persona 5 implies.', where: 'server/src/engine/criteria.ts' },
] as const;

export function adminContentRouter(deps: AppDeps): Router {
  const r = Router();
  r.get('/content', async (_req, res) => {
    const versions = await deps.db.select().from(simulationVersions);
    const packages = await deps.db.select({ id: scoringPackages.id, label: scoringPackages.label, status: scoringPackages.status, sme_status: scoringPackages.smeStatus }).from(scoringPackages).orderBy(desc(scoringPackages.createdAt));
    const [active] = await deps.db.select({ id: scoringPackages.id, sme: scoringPackages.smeStatus }).from(scoringPackages).where(eq(scoringPackages.status, 'published'));
    res.json({
      simulation: { ...SIMULATION, study: { id: STUDY.id, title: STUDY.title, sponsor: STUDY.sponsor, cro: STUDY.cro } },
      versions,
      documents: DOCUMENT_ORDER.map((id) => ({ id, title: DOCUMENTS[id].title, short_title: DOCUMENTS[id].shortTitle, version: DOCUMENTS[id].version, status: DOCUMENTS[id].status, sections: DOCUMENTS[id].sections.length })),
      participants: PARTICIPANTS.length,
      emails: WORKDAY2_INBOX.length + 1,
      packages,
      sme: { active_package: active?.id ?? null, status: active?.sme ?? null, register: SME_REGISTER },
    });
  });
  return r;
}
