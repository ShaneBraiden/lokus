import type { ContentBlock, CrfVisitKey, DocumentId } from '@lokus/shared';

export interface CrfVisitRecord {
  visit: CrfVisitKey;
  visitNumber: number;
  week: number;
  plannedDate: string; // DD-MM-YYYY
  actualDate: string; // DD-MM-YYYY, '' when left blank on the source CRF
  visitStatus: string;
  weight: string;
  bloodPressure: string;
  bloodGlucose: string;
  doseReceived: string;
  adverseEvents: string;
  siteComments: string;
}

export interface ParticipantCrf {
  page: number;
  participantId: string;
  siteId: string;
  treatment: string;
  consentDate: string;
  visits: CrfVisitRecord[];
}

/** Document blocks are defined in @lokus/shared so the web app can render sections it receives from the API. */
export type Block = ContentBlock;

export interface DocumentSection {
  id: string; // stable within the document, e.g. "4"
  number?: string;
  title: string;
  blocks: Block[];
}

export interface StudyDocument {
  id: DocumentId;
  title: string;
  shortTitle: string;
  subtitle: string;
  version: string;
  status: string;
  owner: string;
  header: { label: string; value: string }[];
  sections: DocumentSection[];
  footer?: string;
}

export interface ReferenceCode {
  code: string;
  title: string;
  documentId: DocumentId;
  sectionId: string;
}

export interface MailMessage {
  id: string;
  folder: 'inbox';
  from: { name: string; role: string; organisation: string; email: string };
  to: string[]; // display strings; "{candidate}" is replaced with the candidate's name/email
  cc: string[];
  sentAt: string; // display time, e.g. "Wed 21 Oct 2026, 08:12"
  subject: string;
  preview: string;
  body: string[]; // paragraphs; "{candidateFirstName}" placeholder allowed
  signature: string[];
  /** When opening this message must be recorded as a server-observed event of special meaning. */
  observed?: 'sponsor_email' | 'briefing';
  instructionIds?: string[];
}
