import { STUDY } from '../study';
import type { StudyDocument } from '../types';

/**
 * Data specification and units v1.3 (DSU-026-A..E) plus the CRF field dictionary.
 * Canon fixes: dates are DD-MM-YYYY and weights whole kilograms (matching the CRFs); the glucose "expected range"
 * and the Site-O1 caveat were removed because they contradicted clean records.
 */
export const DICTIONARY: StudyDocument = {
  id: 'dictionary',
  title: 'Data Specification and CRF Field Dictionary',
  shortTitle: 'Data dictionary',
  subtitle: `${STUDY.id} · Clinical data management`,
  version: STUDY.dictionaryVersion,
  status: 'Effective',
  owner: `${STUDY.cro} Clinical Data Management`,
  header: [
    { label: 'Study ID', value: STUDY.id },
    { label: 'Document', value: `Data specification v${STUDY.dictionaryVersion}` },
    { label: 'Applies to', value: 'Participant CRFs, Visits 1, 4, 6 and 7' },
  ],
  sections: [
    {
      id: 'A',
      title: 'Blood glucose',
      blocks: [
        {
          type: 'clause',
          code: 'DSU-026-A',
          title: 'Blood glucose units and values',
          blocks: [
            {
              type: 'list',
              items: [
                'Blood glucose is recorded in mg/dL as a numeric value.',
                'Values in another unit, without a unit, or that are not readable as a number require a data clarification query.',
                'An unusual value is not, by itself, proof of an error. Safety thresholds are defined in the protocol (PRO-026-E).',
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'B',
      title: 'Blood pressure',
      blocks: [
        {
          type: 'clause',
          code: 'DSU-026-B',
          title: 'Blood pressure format',
          blocks: [
            {
              type: 'list',
              items: [
                'Blood pressure is recorded in mmHg as systolic/diastolic, for example 128/82.',
                'Both values are required; an entry with only one value is incomplete and requires a query.',
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'C',
      title: 'Body weight',
      blocks: [
        {
          type: 'clause',
          code: 'DSU-026-C',
          title: 'Body weight units',
          blocks: [
            {
              type: 'list',
              items: [
                'Body weight is recorded in kilograms, as whole kilograms or to one decimal place.',
                'Check for transcription errors such as a missing decimal point. Small visit-to-visit fluctuations are expected and are not errors.',
                'Values in pounds or stones require a query.',
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'D',
      title: 'Dates',
      blocks: [
        {
          type: 'clause',
          code: 'DSU-026-D',
          title: 'Date format and chronology',
          blocks: [
            {
              type: 'list',
              items: [
                'All dates are recorded as DD-MM-YYYY.',
                'Check that each date is valid and in a plausible order: consent before the first visit, and visits in sequence.',
                'Apply the protocol visit windows (PRO-026-A) before classifying a date difference as a deviation.',
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'E',
      title: 'Missing data and data clarification queries',
      blocks: [
        {
          type: 'clause',
          code: 'DSU-026-E',
          title: 'Missing data, incomplete fields and site queries',
          blocks: [
            {
              type: 'list',
              items: [
                'Required fields must not be blank without a documented explanation.',
                'Reviewers must not assume, estimate or fill in missing values.',
                'Missing, illegible or inconsistent entries are raised with the site as a data clarification query that cites the participant ID, visit and field, and does not propose the expected answer.',
                'Source values are never overwritten by the reviewer. Corrections are recommended to the site, which corrects its own source records.',
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'fields',
      title: 'CRF field dictionary',
      blocks: [
        {
          type: 'table',
          headers: ['Field', 'Meaning', 'Format / unit', 'Required', 'Review notes'],
          rows: [
            ['Participant ID', 'Unique identifier for the participant', 'Text, e.g. AHS-007-DM-123', 'Yes', 'Must be unique; preserve exactly as recorded.'],
            ['Site ID', 'Site where the participant is enrolled', 'Text, e.g. Site-02', 'Yes', 'Check that it is present and valid.'],
            ['Treatment received', 'Treatment description recorded by the site', 'Text', 'Yes', 'Preserve source wording.'],
            ['Consent date', 'Date the participant gave written consent', 'DD-MM-YYYY', 'Yes', 'Must precede study-specific procedures.'],
            ['Visit number / week', 'Study visit identifier', 'Visit 1–7 / Week 0–12', 'Yes', 'This CRF shows Visits 1, 4, 6 and 7 only. Do not infer missing visits.'],
            ['Planned visit date', 'Scheduled date of the visit', 'DD-MM-YYYY', 'Yes', 'Reference date for the permitted window.'],
            ['Actual visit date', 'Date the visit took place', 'DD-MM-YYYY', 'Yes', 'Compare with the planned date and the permitted window (PRO-026-A).'],
            ['Visit status', 'Status recorded for the visit', 'Text, e.g. Completed', 'Yes', 'Check for contradictions with the visit date.'],
            ['Weight', 'Body weight', 'kg', 'When collected', 'See DSU-026-C.'],
            ['Blood pressure', 'Seated blood pressure', 'mmHg, systolic/diastolic', 'When collected', 'See DSU-026-B; thresholds in PRO-026-E.'],
            ['Blood glucose', 'Fasting blood glucose', 'mg/dL', 'When collected', 'See DSU-026-A.'],
            ['Dose received', 'Dose of study treatment taken', 'Number + unit (mg)', 'Yes', 'Check against the protocol dose (PRO-026-B).'],
            ['Adverse events', 'Adverse events recorded at the visit', 'Text; “None” is a valid entry', 'Yes', 'Review for potential safety information (PRO-026-E).'],
            ['Site comments', 'Free-text note from the site', 'Text', 'Optional', 'Review for context, inconsistencies and potential safety signals.'],
          ],
        },
      ],
    },
  ],
  footer: `${STUDY.id} · Data specification v${STUDY.dictionaryVersion} · Fictional training material`,
};
