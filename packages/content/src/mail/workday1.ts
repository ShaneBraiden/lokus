import { STUDY } from '../study';
import type { MailMessage } from '../types';

/** Instruction identifiers recorded with server-observed `instruction_viewed` events. */
export const INSTRUCTION_SKIP_SECTION_4 = 'skip_s4';

/**
 * Dr. Anjali's Workday 1 briefing. Carries the "skip Section 4" instruction (workbook F6) with NO softening line.
 */
export const WORKDAY1_BRIEFING: MailMessage = {
  id: 'w1-briefing',
  folder: 'inbox',
  from: { name: 'Dr. Anjali Roy', role: 'Clinical Project Manager', organisation: 'Aurous Healthcare', email: 'anjali.roy@aurous.example' },
  to: ['{candidate}'],
  cc: [],
  sentAt: `${STUDY.workday1Date}, 08:30`,
  subject: `Your first assignment — QC review for ${STUDY.id}`,
  preview: 'Welcome to the study team. Your first task is a quality-control review of the data package…',
  body: [
    'Hi {candidateFirstName},',
    `Welcome to the study team. Your first task is a quality-control review of the data package for study ${STUDY.id}. It contains the case report forms (CRFs) for 12 participants, covering Weeks 0, 4, 8 and 12, and version 3.0 of the informed consent form, which we are preparing for ethics committee submission.`,
    'Compare the records against the protocol extract, the data dictionary and the consent SOP. Log each finding with the evidence and a query to the site where one is needed, and raise any safety concern through the safety escalation pathway.',
    'On the consent form: Section 4 was already approved. Skip it and review the rest.',
    'Work carefully. If something doesn’t look right, investigate it rather than making assumptions.',
  ],
  signature: ['Dr. Anjali Roy', 'Clinical Project Manager', STUDY.cro],
  observed: 'briefing',
  instructionIds: [INSTRUCTION_SKIP_SECTION_4],
};
