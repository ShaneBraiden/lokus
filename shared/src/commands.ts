/**
 * Validated simulation commands. The API parses every player request with these schemas (and rejects anything
 * else); the web app reuses them for its forms. Only the candidate's own inputs appear here — never scoring data.
 */
import { z } from 'zod';
import {
  CRF_HEADER_FIELDS,
  CRF_VISIT_FIELDS,
  DIRECTORY,
  DOCUMENT_IDS,
  FINDING_STATUSES,
  FINDING_TYPES,
  PARTICIPANT_IDS,
  REQUEST_STATUSES,
  SEVERITIES,
} from './vocab';

const fieldKeys = [...CRF_HEADER_FIELDS.map((f) => f.key), ...CRF_VISIT_FIELDS.map((f) => f.key)] as [string, ...string[]];
const directoryIds = DIRECTORY.map((d) => d.id) as [string, ...string[]];

export const crfFieldSchema = z.enum(fieldKeys);
export const findingVisitSchema = z.enum(['W0', 'W4', 'W8', 'W12', 'NA']);
export const directoryIdSchema = z.enum(directoryIds);
export const participantIdSchema = z.enum(PARTICIPANT_IDS);
export const referenceCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}-\d{3}-[A-Z]$/, 'Use a reference code such as PRO-026-A.');

export const findingTargetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('participant'), participant_id: participantIdSchema }),
  z.object({ type: z.literal('document'), document_id: z.enum(DOCUMENT_IDS), section_id: z.string().trim().min(1).max(20) }),
]);
export type FindingTargetInput = z.infer<typeof findingTargetSchema>;

/** Only target and type are required to save; completeness is the candidate's responsibility (T1_DOC). */
export const findingFieldsSchema = z.object({
  visit: findingVisitSchema.nullable().default(null),
  crf_field: crfFieldSchema.nullable().default(null),
  finding_type: z.enum(FINDING_TYPES),
  severity: z.enum(SEVERITIES).nullable().default(null),
  reference_codes: z.array(referenceCodeSchema).max(6).default([]),
  observed_issue: z.string().trim().max(4000).default(''),
  action: z.string().trim().max(2000).default(''),
  status: z.enum(FINDING_STATUSES).nullable().default(null),
  query_text: z.string().trim().max(4000).default(''),
});

export const createFindingSchema = findingFieldsSchema.extend({ target: findingTargetSchema });
export type CreateFindingInput = z.input<typeof createFindingSchema>;

export const updateFindingSchema = z.object({
  version: z.number().int().min(1),
  visit: findingVisitSchema.nullable().optional(),
  crf_field: crfFieldSchema.nullable().optional(),
  finding_type: z.enum(FINDING_TYPES).optional(),
  severity: z.enum(SEVERITIES).nullable().optional(),
  reference_codes: z.array(referenceCodeSchema).max(6).optional(),
  observed_issue: z.string().trim().max(4000).optional(),
  action: z.string().trim().max(2000).optional(),
  status: z.enum(FINDING_STATUSES).nullable().optional(),
  query_text: z.string().trim().max(4000).optional(),
});
export type UpdateFindingInput = z.input<typeof updateFindingSchema>;

export const noDeviationSchema = z.object({ recorded: z.boolean() });

export const safetyEscalationSchema = z.object({
  participant_id: participantIdSchema,
  to: z.array(directoryIdSchema).min(1).max(6),
  cc: z.array(directoryIdSchema).max(6).default([]),
  visit: findingVisitSchema.nullable().default(null),
  fields: z.array(crfFieldSchema).max(13).default([]),
  facts: z.string().trim().min(1, 'Describe what you observed.').max(4000),
  requested_action: z.string().trim().max(2000).default(''),
});
export type SafetyEscalationInput = z.input<typeof safetyEscalationSchema>;

export const noteSchema = z.object({
  to: z.array(directoryIdSchema).min(1).max(6),
  subject: z.string().trim().min(1).max(200),
  text: z.string().trim().min(1).max(4000),
});
export type NoteInput = z.input<typeof noteSchema>;

export const cellSchema = z.object({ participant_id: participantIdSchema, visit: findingVisitSchema, field: crfFieldSchema });
export type CellInput = z.infer<typeof cellSchema>;
export const editCancelSchema = cellSchema.extend({ draft_changed: z.boolean() });
export const editCommitSchema = cellSchema.extend({ value: z.string().trim().max(200) });
export const correctionSchema = cellSchema.extend({ proposed: z.string().trim().min(1).max(200), rationale: z.string().trim().max(2000).default('') });

export const decisionValueSchema = {
  sae: z.enum(['REPORT_NOW', 'WAIT']),
  waiver: z.enum(['ACCEPT', 'DECLINE_ROUTE']),
};

export const replySchema = z.object({
  to: z.array(directoryIdSchema).min(1).max(6),
  cc: z.array(directoryIdSchema).max(6).default([]),
  subject: z.string().trim().min(1).max(250),
  body: z.string().trim().min(1, 'Write your reply before sending.').max(10000),
});
export type ReplyInput = z.input<typeof replySchema>;

export const messageSchema = replySchema;
export type MessageInput = z.input<typeof messageSchema>;

export const requestRecordSchema = z.object({
  summary: z.string().trim().max(2000).default(''),
  status: z.union([z.enum(REQUEST_STATUSES), z.literal('')]).default(''),
  owner: z.string().trim().max(200).default(''),
  next_step: z.string().trim().max(2000).default(''),
  date: z.string().trim().max(20).default(''),
});
export type RequestRecordInput = z.input<typeof requestRecordSchema>;

export const narrativeSchema = z.object({ narrative: z.string().trim().max(6000) });

export const TELEMETRY_TYPES = ['interruption_started', 'interruption_ended', 'screen_viewed'] as const;
export const telemetrySchema = z.object({
  type: z.enum(TELEMETRY_TYPES),
  metadata: z.record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean()])).default({}),
});

/** Lockdown (employer-required proctoring). Strikes are the candidate leaving the assessment; blocked actions never leave it. */
export const LOCKDOWN_STRIKES = ['tab_hidden', 'window_blur', 'fullscreen_exit', 'devtools', 'multiple_screens', 'second_tab', 'screen_capture'] as const;
export const LOCKDOWN_BLOCKED = ['copy', 'cut', 'paste', 'context_menu', 'shortcut', 'print', 'drop', 'injected_text'] as const;
export type LockdownViolationKind = (typeof LOCKDOWN_STRIKES)[number] | (typeof LOCKDOWN_BLOCKED)[number];
/** At this many strikes the attempt is closed. */
export const LOCKDOWN_STRIKE_LIMIT = 3;
export const lockdownViolationSchema = z.object({
  kind: z.enum([...LOCKDOWN_STRIKES, ...LOCKDOWN_BLOCKED]),
  detail: z.string().trim().max(200).default(''),
});

export const reflectionSchema = z.object({ text: z.string().trim().max(4000) });

export const progressSchema = z.object({
  version: z.number().int().min(0),
  state: z.record(z.string(), z.unknown()),
});
