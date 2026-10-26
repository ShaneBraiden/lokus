import { STUDY } from '../study';
import type { StudyDocument } from '../types';

/** Consent SOP extract (ICF-026-A..D): the standard against which the draft informed consent form is reviewed. */
export const CONSENT_SOP: StudyDocument = {
  id: 'consent-sop',
  title: 'Standard Operating Procedure — Informed Consent (Extract)',
  shortTitle: 'Consent SOP',
  subtitle: 'SOP-QA-014 · Informed consent documentation',
  version: STUDY.consentSopVersion,
  status: 'Effective',
  owner: `${STUDY.cro} Quality Assurance`,
  header: [
    { label: 'Document', value: 'SOP-QA-014, version 4' },
    { label: 'Applies to', value: 'All Aurous Healthcare studies, including ' + STUDY.id },
  ],
  sections: [
    {
      id: 'A',
      title: 'Consent before study procedures',
      blocks: [
        {
          type: 'clause',
          code: 'ICF-026-A',
          title: 'Consent precedes any study-specific procedure',
          blocks: [
            { type: 'p', text: 'Written informed consent must be signed and dated before any study-specific procedure, test or treatment takes place. The consent date recorded on the CRF must not be later than the first study visit.' },
          ],
        },
      ],
    },
    {
      id: 'B',
      title: 'Signatures and dating',
      blocks: [
        {
          type: 'clause',
          code: 'ICF-026-B',
          title: 'Signatures, personal dating and corrections',
          blocks: [
            {
              type: 'list',
              items: [
                'The participant (or legal representative) and the person obtaining consent each sign and personally date the form.',
                'Backdating and blank date fields are not permitted.',
                'Corrections follow good documentation practice: single line through, initials, date and reason.',
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'C',
      title: 'Consistency with the protocol',
      blocks: [
        {
          type: 'clause',
          code: 'ICF-026-C',
          title: 'Consent form content must match the approved protocol',
          blocks: [
            {
              type: 'p',
              text: 'Procedures, study treatment and dosing, the visit schedule and the known risks described in the consent form must match the approved protocol. Any inconsistency is reported to the document owner and corrected through document control before the form is submitted or used.',
            },
          ],
        },
      ],
    },
    {
      id: 'D',
      title: 'Approval status and version control',
      blocks: [
        {
          type: 'clause',
          code: 'ICF-026-D',
          title: 'Approval must be verifiable from document control',
          blocks: [
            {
              type: 'p',
              text: 'The approval status of a consent form, or of any section of it, is established by its document control record and ethics committee approval for that version. A verbal or informal statement that a section was approved does not replace review of the current version.',
            },
          ],
        },
      ],
    },
  ],
  footer: `SOP-QA-014 v4 · ${STUDY.cro} · Fictional training material`,
};
