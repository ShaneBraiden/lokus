import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { ev } from '#engine';
import { SPONSOR_EMAIL_ID, WORKDAY2_INBOX } from '#content';
import { decisionValueSchema, messageSchema, narrativeSchema, replySchema, requestRecordSchema, type MailSummaryDTO } from '@lokus/shared';
import type { AppDeps } from '../../context';
import { attempts } from '../../db/schema';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { parseBody, parseParams } from '../../lib/http';
import { appendEvents } from '../../services/eventStore';
import { actor, nextObjectId, requirePhase, withEvidence } from './access';
import { renderMail, w2Clock } from './derive';

/** Workday 2 (Task 2) mail workspace, decisions, reply, escalation and issue record: /api/attempts/:attemptId/t2. */
export function workday2Router(deps: AppDeps): Router {
  const r = Router({ mergeParams: true });
  r.use(requirePhase('workday2'));

  r.get('/inbox', async (req, res) => {
    const opened = await withEvidence(deps, req.attemptCtx!.attempt.id, ['workday2'], async (_tx, _a, { evidence }) => new Set(evidence.t2.emails_opened.keys()));
    const items: MailSummaryDTO[] = WORKDAY2_INBOX.map((m) => ({
      id: m.id,
      from_name: m.from.name,
      from_role: m.from.role,
      from_organisation: m.from.organisation,
      subject: m.subject,
      preview: m.preview,
      sent_at: m.sentAt,
      opened: opened.has(m.id),
    }));
    res.json({ messages: items });
  });

  /** Opening a message is server-observed; the first open of the sponsor email starts the 30-minute server clock (F16). */
  r.get('/emails/:emailId', async (req, res) => {
    const { emailId } = parseParams(z.object({ emailId: z.string().max(60) }), req);
    const message = WORKDAY2_INBOX.find((m) => m.id === emailId);
    if (!message) throw notFound('Message not found.');
    const clock = await withEvidence(deps, req.attemptCtx!.attempt.id, ['workday2'], async (tx, attempt, { pkg }) => {
      await appendEvents(tx, deps.clock, attempt, [ev.emailOpened(emailId)], actor(req));
      if (emailId === SPONSOR_EMAIL_ID && !attempt.w2ClockStartedAt) {
        const now = deps.clock.now();
        await tx.update(attempts).set({ w2ClockStartedAt: now, updatedAt: now }).where(eq(attempts.id, attempt.id));
        attempt.w2ClockStartedAt = now;
      }
      return w2Clock(attempt, pkg, deps.clock.now());
    });
    res.json({ message: renderMail(message, { name: req.auth!.user.name, email: req.auth!.user.email }), clock });
  });

  /** The two forced choices (F13): neutral, unselected by default, locked once the reply is sent. */
  r.put('/decisions/:decision', async (req, res) => {
    const { decision } = parseParams(z.object({ decision: z.enum(['sae', 'waiver']) }), req);
    const { value } = parseBody(z.object({ value: decisionValueSchema[decision] }), req);
    await withEvidence(deps, req.attemptCtx!.attempt.id, ['workday2'], async (tx, attempt, { evidence }) => {
      if (!evidence.t2.sponsor_first_open) throw conflict('sponsor_email_not_opened', 'Open the sponsor’s email before recording a decision.');
      if (evidence.t2.reply) throw conflict('decisions_locked', 'Your decisions are final once the reply has been sent.');
      if (evidence.t2.decisions[decision]?.value === value) return;
      await appendEvents(tx, deps.clock, attempt, [ev.decisionSelected(decision, value)], actor(req));
    });
    res.json({ ok: true, decision, value });
  });

  r.post('/reply', async (req, res) => {
    const body = parseBody(replySchema, req);
    if (!body.to.includes('sponsor')) throw badRequest('reply_must_address_sponsor', 'A reply goes to the sponsor who wrote to you.');
    await withEvidence(deps, req.attemptCtx!.attempt.id, ['workday2'], async (tx, attempt, { rows, evidence }) => {
      if (!evidence.t2.decisions.sae || !evidence.t2.decisions.waiver) throw conflict('decisions_required', 'Record your decision on both requests before replying.');
      if (evidence.t2.reply) throw conflict('reply_already_sent', 'You have already replied to the sponsor.');
      const id = nextObjectId(rows, 'R', (r) => r.eventType === 'reply_submitted');
      await appendEvents(
        tx,
        deps.clock,
        attempt,
        [ev.replySubmitted({ id, to: body.to, cc: body.cc, subject: body.subject, body_authored: body.body, decisions: { sae: evidence.t2.decisions.sae.value, waiver: evidence.t2.decisions.waiver.value } })],
        actor(req),
      );
    });
    res.status(201).json({ ok: true });
  });

  /** New internal message (the optional escalation path, F14). Never required to continue. */
  r.post('/messages', async (req, res) => {
    const body = parseBody(messageSchema, req);
    await withEvidence(deps, req.attemptCtx!.attempt.id, ['workday2'], async (tx, attempt, { rows }) => {
      const id = nextObjectId(rows, 'M', (r) => r.eventType === 'escalation_completed' && r.taskId === 'T2');
      await appendEvents(tx, deps.clock, attempt, [ev.escalationT2({ id, to: body.to, cc: body.cc, subject: body.subject, body: body.body })], actor(req));
    });
    res.status(201).json({ ok: true });
  });

  /** Structured issue record per request: summary, status, owner, next step, date (F15). */
  r.put('/record/:request', async (req, res) => {
    const { request } = parseParams(z.object({ request: z.enum(['sae', 'waiver']) }), req);
    const body = parseBody(requestRecordSchema, req);
    await withEvidence(deps, req.attemptCtx!.attempt.id, ['workday2'], (tx, attempt) => appendEvents(tx, deps.clock, attempt, [ev.statusUpdated({ request, ...body })], actor(req)));
    res.json({ ok: true });
  });

  r.put('/narrative', async (req, res) => {
    const { narrative } = parseBody(narrativeSchema, req);
    await withEvidence(deps, req.attemptCtx!.attempt.id, ['workday2'], (tx, attempt) => appendEvents(tx, deps.clock, attempt, [ev.summaryCreated(narrative)], actor(req)));
    res.json({ ok: true });
  });

  return r;
}
