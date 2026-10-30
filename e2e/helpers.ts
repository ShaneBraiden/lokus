import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { PERSONAS } from '../server/src/engine/personas';
import type { ScenarioAction } from '../server/src/engine/scenario';

/** Local demo accounts seeded in development (documented in .env.example). */
export const DEMO_PASSWORD = process.env.DEV_DEMO_PASSWORD ?? 'LokusDemo-2026!';
export const DEMO = {
  admin: 'admin@lokus.local',
  assessor: 'assessor@lokus.local',
  employer: 'employer@lokus.local',
  candidate: 'candidate@lokus.local',
};

export async function signIn(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

/** The newest link containing `marker` from the development outbox (emails are never sent in development). */
export async function linkFromOutbox(request: APIRequestContext, to: string, marker: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const res = await request.get(`/api/dev/outbox?to=${encodeURIComponent(to)}`);
    const { emails } = (await res.json()) as { emails: { text: string }[] };
    const link = emails.flatMap((e) => e.text.match(/https?:\/\/\S+/g) ?? []).find((l) => l.includes(marker));
    if (link) return link.replace(/^https?:\/\/[^/]+/, '');
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no ${marker} link for ${to}`);
}

function call(request: APIRequestContext, base: string, a: ScenarioAction) {
  const json = (data: unknown) => ({ data });
  switch (a.kind) {
    case 'task_start':
      return request.post(`${base}/tasks/${a.task}/start`);
    case 'view_briefing':
      return request.get(`${base}/t1/briefing`);
    case 'open_record':
      return request.get(`${base}/t1/participants/${a.participant_id}`);
    case 'open_section':
      return request.get(`${base}/documents/${a.document_id}/sections/${a.section_id}`);
    case 'create_finding': {
      const { id: _id, ...f } = a.finding;
      return request.post(`${base}/t1/findings`, json(f));
    }
    case 'modify_finding': {
      const { id: _id, target: _t, ...f } = a.finding;
      return request.patch(`${base}/t1/findings/${a.ref}`, json({ ...f, version: a.version - 1 }));
    }
    case 'withdraw_finding':
      return request.post(`${base}/t1/findings/${a.ref}/withdraw`);
    case 'no_deviation':
      return request.put(`${base}/t1/participants/${a.participant_id}/no-deviation`, json({ recorded: a.recorded }));
    case 'escalate_t1':
      return request.post(`${base}/t1/escalations`, json({ participant_id: a.target_participant_id, to: a.to, cc: a.cc, visit: a.visit, fields: a.fields, facts: a.facts, requested_action: a.requested_action }));
    case 'clarification':
      return request.post(`${base}/t1/notes`, json({ to: a.to, subject: a.subject, text: a.text }));
    case 'edit_start':
      return request.post(`${base}/t1/edits/start`, json(a.cell));
    case 'edit_cancel':
      return request.post(`${base}/t1/edits/cancel`, json({ ...a.cell, draft_changed: a.changed }));
    case 'edit_commit':
      return request.post(`${base}/t1/edits/commit`, json({ ...a.cell, value: a.to }));
    case 'edit_revert':
      return request.post(`${base}/t1/edits/revert`, json(a.cell));
    case 'recommend_correction':
      return request.post(`${base}/t1/corrections`, json({ ...a.cell, proposed: a.proposed, rationale: a.rationale }));
    case 'task_submit':
      return request.post(`${base}/tasks/${a.task}/submit`);
    case 'open_email':
      return request.get(`${base}/t2/emails/${a.email_id}`);
    case 'decide':
      return request.put(`${base}/t2/decisions/${a.decision}`, json({ value: a.value }));
    case 'reply':
      return request.post(`${base}/t2/reply`, json({ to: a.to, cc: a.cc, subject: a.subject, body: a.body }));
    case 'escalate_t2':
      return request.post(`${base}/t2/messages`, json({ to: a.to, cc: a.cc, subject: a.subject, body: a.body }));
    case 'record':
      return request.put(`${base}/t2/record/${a.request}`, json({ summary: a.summary, status: a.status, owner: a.owner, next_step: a.next_step, date: a.date }));
    case 'narrative':
      return request.put(`${base}/t2/narrative`, json({ narrative: a.text }));
  }
}

/** Plays a regression persona's candidate actions through the real API using the signed-in page's session. */
export async function playPersona(page: Page, attemptId: string, personaId: string) {
  const run = PERSONAS.find((p) => p.id === personaId)!.build();
  for (const { action } of run.actions) {
    const res = await call(page.request, `/api/attempts/${attemptId}`, action);
    expect(res.status(), `${action.kind}: ${await res.text()}`).toBeLessThan(300);
  }
}

/** Candidate-facing pages must never show scoring language. */
export async function expectNoScores(page: Page) {
  const text = await page.locator('body').innerText();
  for (const word of [/\bscore\s*[:\d]/i, /meets bar/i, /does not meet/i, /\brating\b/i, /\/ 100\b/]) expect(text).not.toMatch(word);
}
