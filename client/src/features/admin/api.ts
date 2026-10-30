import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { EvidenceView, ResultView } from '@lokus/shared';
import { http } from '@/lib/api';

export interface Overview {
  attempts: Record<string, number>;
  submitted_last_7_days: number;
  review_queue: { open: number; in_progress: number; oldest_hours: number | null };
  outcomes: Record<string, number>;
  gate_rates: { gate: string; fired: number; of: number }[];
  organizations: number;
  candidates: number;
  environment: { env: string; database: string };
}

export interface QueueItem {
  id: string;
  pseudonym: string;
  status: 'open' | 'in_progress' | 'done';
  priority: number;
  assigned_to_me: boolean;
  assignee: string | null;
  created_at: string;
  completed_at: string | null;
  age_hours: number;
  pending: string[];
  gr_hold: boolean;
}

export interface PacketCriterion {
  id: string;
  name: string;
  task: 'T1' | 'T2';
  weight: number;
  what_to_observe: string;
  anchors: Record<'0' | '1' | '2' | '3' | '4', string>;
  notes: string;
  status: 'SCORED' | 'PENDING';
  needs_review: boolean;
  source: string;
  auto_rating: number | null;
  cap: number | null;
  cap_reasons: string[];
  explanation: string;
  effective_rating: number | null;
  current: { raw_rating: number; rationale: string; assessor: string; at: string } | null;
}

export interface ReviewPacket {
  item: { id: string; pseudonym: string; status: string; assigned_to_me: boolean; assigned: boolean; created_at: string };
  criteria: PacketCriterion[];
  gr: { fired: boolean; resolved: boolean; reason: string; clauses: { clause: 'delay' | 'waiver'; fired: boolean; disposition: 'cleared' | 'confirmed' | null; matches: string[] }[] };
  pending: string[];
  evidence: EvidenceView;
  history: {
    ratings: { criterion_id: string; raw_rating: number; rationale: string; assessor: string; at: string; supersedes: boolean }[];
    dispositions: { clause: string; disposition: string; note: string; assessor: string; at: string }[];
  };
}

export interface AttemptListRow {
  id: string;
  candidate: { id: string; name: string; email: string };
  org_name: string | null;
  origin: 'invite' | 'self';
  status: string;
  status_label: string;
  is_retake: boolean;
  created_at: string;
  submitted_at: string | null;
  result: { status: string; outcome: string | null; outcome_label: string | null; t1: number | null; t2: number | null } | null;
}

export interface AttemptDetail {
  attempt: {
    id: string;
    status: string;
    status_label: string;
    origin: string;
    is_retake: boolean;
    scoring_package_id: string;
    created_at: string;
    started_at: string | null;
    t1_submitted_at: string | null;
    w2_clock_started_at: string | null;
    t2_submitted_at: string | null;
    deadline_at: string | null;
    closed_at: string | null;
    close_reason: string | null;
    events: number;
  };
  candidate: { id: string; name: string; email: string };
  org: { id: string; name: string } | null;
  result: (ResultView & { version: number; trigger: string; computed_at: string }) | null;
  versions: { version: number; trigger: string; status: string; outcome: string | null; t1: number; t2: number; computed_at: string; input_digest: string; package: string }[];
  review: { id: string; status: string; pseudonym: string; assignee: string | null; created_at: string; completed_at: string | null } | null;
  ratings: { criterion_id: string; raw_rating: number; rationale: string; assessor: string; at: string }[];
  dispositions: { clause: string; disposition: string; note: string; assessor: string; at: string }[];
  shares: { org: string; basis: string; granted_at: string; revoked_at: string | null }[];
  chain: { ok: true; length: number } | { ok: false; brokenAtSeq: number };
  evidence: EvidenceView;
}

export interface RawEvent {
  seq: number;
  event_id: string;
  at: string;
  task: string;
  type: string;
  object_id: string | null;
  source: string;
  metadata: Record<string, unknown>;
  hash: string;
  prev_hash: string;
  actor: string | null;
}

export interface CompareSide {
  id: string;
  status: string;
  candidate: { id: string; name: string; email: string };
  org_name: string | null;
  outcome: string | null;
  outcome_label: string;
  outcome_reason: string;
  t1: number;
  t2: number;
  gates: { gate_id: string; fired: boolean; resolved: boolean | null; reason: string }[];
  competencies: { id: string; name: string; score: number | null; reportable: boolean }[];
}

export interface CompareCriterion {
  criterion_id: string;
  name: string;
  task: string;
  weight: number;
  method: string;
  a: { rating: number | null; raw_rating: number | null; points: number | null; status: string; cap: number | null; cap_reasons: string[]; rule_id: string; explanation: string; source: string } | null;
  b: CompareCriterion['a'];
  points_difference: number;
}

export interface CompareResult {
  a: CompareSide;
  b: CompareSide;
  criteria: CompareCriterion[];
  differences: CompareCriterion[];
}

export interface RegressionCase {
  persona_id: string;
  name: string;
  workbook_row: string | null;
  passed: boolean;
  mismatches: string[];
  expected: { t1: number | 'Pending'; t2: number | 'Pending'; outcome: string; gates: Record<string, number> };
  actual: { t1: number | 'Pending'; t2: number | 'Pending'; outcome: string | null; gates: Record<string, number> };
}

export interface PackageRow {
  id: string;
  label: string;
  status: 'draft' | 'published' | 'retired';
  engine_version: string;
  sha256: string;
  sme_status: string;
  notes: string;
  created_at: string;
  published_at: string | null;
  regression: { id: string; passed: boolean; total: number; failed: number; at: string } | null;
}

export interface PackageDetail extends Omit<PackageRow, 'regression'> {
  rubric: {
    version: string;
    criteria: { id: string; task: string; name: string; weight: number; method: string; competency: string; what_to_observe: string; anchors: Record<string, string>; notes: string }[];
    gates: { id: string; task: string; trigger: string; effect: string; severity: string }[];
    competencies: { id: string; name: string; definition: string; criteria: string[] }[];
  };
  parameters: Record<string, number | string>;
  /** Meaning of each parameter and, for enumerated ones, the allowed values (from the server). */
  parameter_meta: Record<string, { meaning: string; options: string[] | null }>;
  phrase_lists: Record<string, string[]>;
  identifiers: Record<string, string>;
  regression: ({ id: string; at: string; passed: boolean; total: number; failed: number; cases: RegressionCase[] }) | null;
}

export const adminKeys = {
  overview: ['admin', 'overview'] as const,
  queue: (scope: string) => ['review', 'queue', scope] as const,
  packet: (id: string) => ['review', 'packet', id] as const,
  attempts: (params: Record<string, string>) => ['admin', 'attempts', params] as const,
  attempt: (id: string) => ['admin', 'attempt', id] as const,
  events: (id: string) => ['admin', 'attempt', id, 'events'] as const,
  packages: ['admin', 'packages'] as const,
  pkg: (id: string) => ['admin', 'package', id] as const,
};

export const useOverview = () => useQuery({ queryKey: adminKeys.overview, queryFn: () => http.get<Overview>('/admin/overview') });
export const useQueue = (scope: string) => useQuery({ queryKey: adminKeys.queue(scope), queryFn: () => http.get<{ items: QueueItem[] }>(`/review/queue?scope=${scope}`).then((r) => r.items) });
export const usePacket = (id: string) => useQuery({ queryKey: adminKeys.packet(id), queryFn: () => http.get<ReviewPacket>(`/review/items/${id}`) });
export const useAttempts = (params: Record<string, string>) =>
  useQuery({
    queryKey: adminKeys.attempts(params),
    queryFn: () => http.get<{ attempts: AttemptListRow[]; has_more: boolean }>(`/admin/attempts?${new URLSearchParams(params)}`),
    placeholderData: keepPreviousData,
  });
export const useAttempt = (id: string) => useQuery({ queryKey: adminKeys.attempt(id), queryFn: () => http.get<AttemptDetail>(`/admin/attempts/${id}`) });
export const useAttemptEvents = (id: string, enabled: boolean) => useQuery({ queryKey: adminKeys.events(id), queryFn: () => http.get<{ events: RawEvent[]; chain: AttemptDetail['chain'] }>(`/admin/attempts/${id}/events`), enabled });
export const usePackages = () => useQuery({ queryKey: adminKeys.packages, queryFn: () => http.get<{ packages: PackageRow[] }>('/admin/packages').then((r) => r.packages) });
export const usePackage = (id: string) => useQuery({ queryKey: adminKeys.pkg(id), queryFn: () => http.get<PackageDetail>(`/admin/packages/${id}`) });
