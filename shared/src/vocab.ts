/**
 * Client-safe simulation vocabulary for study AHS-DM-026 (Lokus CTA rubric v1.1 canon).
 * These lists drive the candidate forms and the server-side validation. They contain no answer-key
 * information: every option is offered identically for every record.
 */

export const STUDY_ID = 'AHS-DM-026';

/** Single finding taxonomy (workbook F9). "No deviation" is a separate per-participant decision. */
export const FINDING_TYPES = [
  'Visit date deviation / window violation',
  'Missing data / Incomplete CRF',
  'Dosing / Treatment mismatch',
  'Data recording unit inconsistency',
  'Clinical measurement anomaly (BP/Weight/Glucose)',
  'Safety concern / Potential adverse event',
  'Informed consent date discrepancy',
  'Document content discrepancy',
] as const;
export type FindingType = (typeof FINDING_TYPES)[number];

/** Severity scale from the workbook canon. Order matters: index = rank. */
export const SEVERITIES = ['Low', 'Medium', 'High', 'Critical (Safety / Regulatory)'] as const;
export type Severity = (typeof SEVERITIES)[number];

/** Candidate-chosen workflow status for a finding (data dictionary "Finding status", minus system states). */
export const FINDING_STATUSES = ['Open', 'Query proposed', 'Escalated', 'Resolved'] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

/** CRF visits captured in this review (Visits 1, 4, 6 and 7 of the 7-visit schedule). */
export const CRF_VISITS = [
  { key: 'W0', week: 0, visitNumber: 1, label: 'Week 0 (Visit 1)' },
  { key: 'W4', week: 4, visitNumber: 4, label: 'Week 4 (Visit 4)' },
  { key: 'W8', week: 8, visitNumber: 6, label: 'Week 8 (Visit 6)' },
  { key: 'W12', week: 12, visitNumber: 7, label: 'Week 12 (Visit 7)' },
] as const;
export type CrfVisitKey = (typeof CRF_VISITS)[number]['key'];
export const NOT_VISIT_SPECIFIC = 'NA' as const;
export type FindingVisit = CrfVisitKey | typeof NOT_VISIT_SPECIFIC;

/** CRF header fields (one value per participant). */
export const CRF_HEADER_FIELDS = [
  { key: 'participantId', label: 'Participant ID' },
  { key: 'siteId', label: 'Site ID' },
  { key: 'treatment', label: 'Treatment received' },
  { key: 'consentDate', label: 'Consent date' },
] as const;

/** CRF visit fields (one value per visit). */
export const CRF_VISIT_FIELDS = [
  { key: 'plannedDate', label: 'Planned visit date' },
  { key: 'actualDate', label: 'Actual visit date' },
  { key: 'visitStatus', label: 'Visit status' },
  { key: 'weight', label: 'Weight (kg)' },
  { key: 'bloodPressure', label: 'Blood pressure (mmHg)' },
  { key: 'bloodGlucose', label: 'Blood glucose (mg/dL)' },
  { key: 'doseReceived', label: 'Dose received' },
  { key: 'adverseEvents', label: 'Adverse events' },
  { key: 'siteComments', label: 'Site comments' },
] as const;

export type CrfHeaderFieldKey = (typeof CRF_HEADER_FIELDS)[number]['key'];
export type CrfVisitFieldKey = (typeof CRF_VISIT_FIELDS)[number]['key'];
export type CrfFieldKey = CrfHeaderFieldKey | CrfVisitFieldKey;

export const CRF_FIELD_LABELS: Record<CrfFieldKey, string> = Object.fromEntries(
  [...CRF_HEADER_FIELDS, ...CRF_VISIT_FIELDS].map((f) => [f.key, f.label]),
) as Record<CrfFieldKey, string>;

export const VISIT_LABELS: Record<FindingVisit, string> = {
  W0: 'Week 0 (Visit 1)',
  W4: 'Week 4 (Visit 4)',
  W8: 'Week 8 (Visit 6)',
  W12: 'Week 12 (Visit 7)',
  NA: 'Not visit-specific',
};

/** Study documents available in the Workday 1 document viewer. */
export const DOCUMENT_IDS = ['protocol', 'icf', 'dictionary', 'consent-sop'] as const;
export type DocumentId = (typeof DOCUMENT_IDS)[number];

/** Workday 2 forced choices (workbook F13). Option order is fixed and neutral; nothing is preselected. */
export const W2_DECISIONS = {
  sae: {
    label: 'Request to hold the AHS-007-DM-220 SAE report',
    options: [
      { value: 'REPORT_NOW', label: 'Report now' },
      { value: 'WAIT', label: 'Wait until after interim' },
    ],
  },
  waiver: {
    label: 'Request for an informal screening waiver (SCR-02-019)',
    options: [
      { value: 'ACCEPT', label: 'Accept' },
      { value: 'DECLINE_ROUTE', label: 'Decline and route to authorised decision-maker' },
    ],
  },
} as const;
export type W2DecisionKey = keyof typeof W2_DECISIONS;
export type SaeDecision = 'REPORT_NOW' | 'WAIT';
export type WaiverDecision = 'ACCEPT' | 'DECLINE_ROUTE';

/** Workday 2 issue record: one structured block per sponsor request (workbook F15). */
export const W2_REQUESTS = [
  { key: 'sae', label: 'SAE reporting request — AHS-007-DM-220' },
  { key: 'waiver', label: 'Screening waiver request — SCR-02-019' },
] as const;
export type W2RequestKey = (typeof W2_REQUESTS)[number]['key'];
export const REQUEST_STATUSES = ['Open', 'Escalated – awaiting decision', 'In hand', 'Closed'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** People and mailboxes the candidate can address (fictional; .example domains). */
export interface DirectoryEntry {
  id: string;
  name: string;
  role: string;
  organisation: string;
  email: string;
  internal: boolean;
}

export const DIRECTORY: readonly DirectoryEntry[] = [
  { id: 'anjali', name: 'Dr. Anjali Roy', role: 'Clinical Project Manager', organisation: 'Aurous Healthcare', email: 'anjali.roy@aurous.example', internal: true },
  { id: 'medical-monitor', name: 'Dr. Kavita Menon', role: 'Medical Monitor', organisation: 'Aurous Healthcare', email: 'kavita.menon@aurous.example', internal: true },
  { id: 'drug-safety', name: 'Drug Safety Desk', role: 'Pharmacovigilance', organisation: 'Aurous Healthcare', email: 'drug.safety@aurous.example', internal: true },
  { id: 'qa', name: 'Quality Assurance', role: 'Clinical QA', organisation: 'Aurous Healthcare', email: 'qa@aurous.example', internal: true },
  { id: 'data-management', name: 'Clinical Data Management', role: 'Data Management', organisation: 'Aurous Healthcare', email: 'cdm@aurous.example', internal: true },
  { id: 'site02-pi', name: 'Dr. S. Mehta', role: 'Principal Investigator, Site 02', organisation: 'Apex Clinical Centre', email: 's.mehta@apexclinical.example', internal: false },
  { id: 'sponsor', name: 'Vikram Rao', role: 'Global Clinical Director', organisation: 'Biovance Therapeutics', email: 'v.rao@biovance.example', internal: false },
];

export const DIRECTORY_BY_ID: Record<string, DirectoryEntry> = Object.fromEntries(DIRECTORY.map((d) => [d.id, d]));

/** The 12 participant IDs in CRF page order (page N = index + 1). */
export const PARTICIPANT_IDS = [
  'AHS-007-DM-206',
  'AHS-007-DM-082',
  'AHS-007-DM-008',
  'AHS-007-DM-220',
  'AHS-007-DM-189',
  'AHS-007-DM-284',
  'AHS-007-DM-598',
  'AHS-007-DM-494',
  'AHS-007-DM-124',
  'AHS-007-DM-022',
  'AHS-007-DM-180',
  'AHS-007-DM-384',
] as const;
export type ParticipantId = (typeof PARTICIPANT_IDS)[number];
