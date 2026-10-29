import { useQuery } from '@tanstack/react-query';
import { http } from '@/lib/api';

export interface AttemptCard {
  id: string;
  simulation_title: string;
  org_name: string | null;
  origin: 'invite' | 'self';
  status: string;
  status_label: string;
  deadline_at: string | null;
  started_at: string | null;
  submitted_at: string | null;
  created_at: string;
}

export interface CandidateHome {
  email_verified: boolean;
  attempts: AttemptCard[];
  share_requests: { id: string; org_name: string; created_at: string }[];
}

export interface Privacy {
  talent_pool: { listed: boolean; eligible: boolean; consent_version: string };
  shares: { id: string; org_name: string; basis: 'invite' | 'reuse_consent'; granted_at: string; revoked_at: string | null }[];
}

export const candidateKeys = {
  home: ['candidate', 'home'] as const,
  privacy: ['candidate', 'privacy'] as const,
  profile: ['candidate', 'profile'] as const,
};

export const useCandidateHome = () => useQuery({ queryKey: candidateKeys.home, queryFn: () => http.get<CandidateHome>('/candidate/home') });
export const usePrivacy = () => useQuery({ queryKey: candidateKeys.privacy, queryFn: () => http.get<Privacy>('/candidate/privacy') });
export const useProfile = () => useQuery({ queryKey: candidateKeys.profile, queryFn: () => http.get<{ name: string; email: string; headline: string; location: string }>('/candidate/profile') });
