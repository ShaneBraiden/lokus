import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { EvidenceView } from '@lokus/shared';
import { http } from '@/lib/api';
import type { OutcomeKey } from '@/features/results/Outcome';

export interface EmployerResult {
  status: 'provisional' | 'final';
  outcome: OutcomeKey;
  outcome_label: string;
  outcome_locked: boolean;
  reason: string;
  t1: number | null;
  t2: number | null;
  scores_final: boolean;
  gates: { gate_id: string; label: string; fired: boolean; held: boolean; explanation: string; evidence: string }[];
  competencies: { id: string; name: string; reportable: boolean; score: number | null }[];
  computed_at: string;
}

export interface CandidateRow {
  invitation_id: string;
  attempt_id: string | null;
  name: string;
  email: string;
  source: string;
  progress: 'invited' | 'not_started' | 'in_progress' | 'submitted' | 'closed' | 'withdrawn';
  progress_label: string;
  invited_at: string;
  deadline_at: string | null;
  submitted_at: string | null;
  result: { outcome: OutcomeKey; outcome_label: string; t1: number | null; t2: number | null; scores_final: boolean; flags: string[] } | null;
}

export interface EmployerOverview {
  invited: number;
  in_progress: number;
  completed: number;
  awaiting_review: number;
  meets_rate: number | null;
  outcomes: Record<string, number>;
  due_soon: { invitation_id: string; name: string; email: string; progress_label: string; deadline_at: string }[];
  recent: CandidateRow[];
}

export interface Report {
  candidate: { name: string; email: string; headline: string; location: string };
  attempt: { id: string; status: string; status_label: string; started_at: string | null; t1_submitted_at: string | null; submitted_at: string | null; deadline_at: string | null; in_progress: boolean };
  result: EmployerResult | null;
  evidence: EvidenceView | null;
  integrity: LockdownIntegrity;
  talent_pool?: boolean;
}

export interface LockdownIntegrity {
  lockdown: boolean;
  strikes: number;
  limit: number;
  closed_by_lockdown: boolean;
  violations: { kind: string; detail: string; strike: boolean; at: string }[];
}

export interface InvitationRow {
  id: string;
  email: string;
  name: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  progress: string;
  attempt_id: string | null;
  deadline_at: string | null;
  lockdown: boolean;
  created_at: string;
  accepted_at: string | null;
  last_sent_at: string | null;
}

export interface PoolRow {
  attempt_id: string;
  name: string;
  headline: string;
  location: string;
  submitted_at: string;
  result: { outcome: OutcomeKey; outcome_label: string; t1: number | null; t2: number | null; flags: string[]; competencies: EmployerResult['competencies'] };
}

export const orgKeys = {
  overview: ['org', 'overview'] as const,
  candidates: (p: Record<string, string>) => ['org', 'candidates', p] as const,
  invitations: ['org', 'invitations'] as const,
  report: (id: string, pool: boolean) => ['org', pool ? 'pool' : 'report', id] as const,
  pool: (q: string) => ['org', 'pool-list', q] as const,
  team: ['org', 'team'] as const,
  settings: ['org', 'settings'] as const,
};

export const useEmployerOverview = () => useQuery({ queryKey: orgKeys.overview, queryFn: () => http.get<EmployerOverview>('/org/overview') });
export const useCandidates = (p: Record<string, string>) =>
  useQuery({ queryKey: orgKeys.candidates(p), queryFn: () => http.get<{ candidates: CandidateRow[] }>(`/org/candidates?${new URLSearchParams(p)}`).then((r) => r.candidates), placeholderData: keepPreviousData });
export const useInvitations = () => useQuery({ queryKey: orgKeys.invitations, queryFn: () => http.get<{ invitations: InvitationRow[] }>('/org/invitations').then((r) => r.invitations) });
export const useReport = (id: string, pool = false) => useQuery({ queryKey: orgKeys.report(id, pool), queryFn: () => http.get<Report>(pool ? `/org/talent-pool/${id}` : `/org/results/${id}`), retry: false });
export const usePool = (q: string) => useQuery({ queryKey: orgKeys.pool(q), queryFn: () => http.get<{ candidates: PoolRow[] }>(`/org/talent-pool${q ? `?query=${encodeURIComponent(q)}` : ''}`).then((r) => r.candidates), placeholderData: keepPreviousData });
