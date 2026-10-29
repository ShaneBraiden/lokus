import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type {
  AttemptStateDTO,
  DocumentSectionDTO,
  DocumentSummaryDTO,
  MailMessageDTO,
  MailSummaryDTO,
  ParticipantCrfDTO,
  ReferenceCodeDTO,
  ClockDTO,
} from '@lokus/shared';
import { http } from '@/lib/api';

/**
 * Player data access. Reads of records, document sections and emails are server-observed events, so those
 * queries are never prefetched and refetch whenever they are opened again.
 */
export const simKeys = {
  state: (id: string) => ['sim', id, 'state'] as const,
  crf: (id: string, pid: string) => ['sim', id, 'crf', pid] as const,
  documents: (id: string) => ['sim', id, 'documents'] as const,
  section: (id: string, doc: string, sec: string) => ['sim', id, 'section', doc, sec] as const,
  references: (id: string) => ['sim', id, 'references'] as const,
  briefing: (id: string) => ['sim', id, 'briefing'] as const,
  inbox: (id: string) => ['sim', id, 'inbox'] as const,
  email: (id: string, eid: string) => ['sim', id, 'email', eid] as const,
};

export const base = (attemptId: string) => `/attempts/${attemptId}`;

export function useAttemptState(attemptId: string) {
  return useQuery({ queryKey: simKeys.state(attemptId), queryFn: () => http.get<AttemptStateDTO>(`${base(attemptId)}/state`), retry: false, staleTime: 0 });
}

export function useRefreshState(attemptId: string) {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ queryKey: simKeys.state(attemptId) }), [qc, attemptId]);
}

export function useCrf(attemptId: string, participantId: string | null) {
  return useQuery({
    queryKey: simKeys.crf(attemptId, participantId ?? ''),
    queryFn: () => http.get<ParticipantCrfDTO>(`${base(attemptId)}/t1/participants/${participantId}`),
    enabled: Boolean(participantId),
    staleTime: 0,
    gcTime: 5 * 60_000,
  });
}

export function useDocuments(attemptId: string) {
  return useQuery({ queryKey: simKeys.documents(attemptId), queryFn: () => http.get<{ documents: DocumentSummaryDTO[] }>(`${base(attemptId)}/documents`).then((r) => r.documents), staleTime: Infinity });
}

export function useSection(attemptId: string, documentId: string, sectionId: string | null) {
  return useQuery({
    queryKey: simKeys.section(attemptId, documentId, sectionId ?? ''),
    queryFn: () => http.get<DocumentSectionDTO>(`${base(attemptId)}/documents/${documentId}/sections/${sectionId}`),
    enabled: Boolean(sectionId),
    staleTime: 0,
  });
}

export function useReferences(attemptId: string) {
  return useQuery({ queryKey: simKeys.references(attemptId), queryFn: () => http.get<{ references: ReferenceCodeDTO[] }>(`${base(attemptId)}/references`).then((r) => r.references), staleTime: Infinity });
}

export function useBriefing(attemptId: string, enabled = true) {
  return useQuery({ queryKey: simKeys.briefing(attemptId), queryFn: () => http.get<MailMessageDTO>(`${base(attemptId)}/t1/briefing`), enabled, staleTime: 0 });
}

export function useInbox(attemptId: string) {
  return useQuery({ queryKey: simKeys.inbox(attemptId), queryFn: () => http.get<{ messages: MailSummaryDTO[] }>(`${base(attemptId)}/t2/inbox`).then((r) => r.messages) });
}

export function useEmail(attemptId: string, emailId: string | null) {
  return useQuery({
    queryKey: simKeys.email(attemptId, emailId ?? ''),
    queryFn: () => http.get<{ message: MailMessageDTO; clock: ClockDTO | null }>(`${base(attemptId)}/t2/emails/${emailId}`),
    enabled: Boolean(emailId),
    staleTime: 0,
  });
}
