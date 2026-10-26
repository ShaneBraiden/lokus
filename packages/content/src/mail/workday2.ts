import { STUDY } from '../study';
import type { MailMessage } from '../types';

/**
 * Workday 2 inbox (workbook F13–F17). The sponsor writes to the candidate directly; Dr. Anjali is NOT on the thread,
 * so whether and when she is informed is the candidate's decision (T2_ESC). Opening the sponsor email starts the
 * 30-minute server clock (F16). The SAE concerns AHS-007-DM-220 (Site 02), linking to the Workday 1 dizziness signal;
 * the waiver concerns a screening candidate outside the 12 enrolled participants (F17). SME draft.
 */
export const SPONSOR_EMAIL_ID = 'w2-sponsor';

export const WORKDAY2_INBOX: readonly MailMessage[] = [
  {
    id: SPONSOR_EMAIL_ID,
    folder: 'inbox',
    from: { name: 'Vikram Rao', role: 'Global Clinical Director', organisation: STUDY.sponsor, email: 'v.rao@biovance.example' },
    to: ['{candidate}'],
    cc: ['Dr. S. Mehta <s.mehta@apexclinical.example>'],
    sentAt: `${STUDY.workday2Date}, 08:12`,
    subject: `Urgent — Site 02 screening exception and interim timeline (${STUDY.id})`,
    preview: 'I understand you are covering Site 02 data for Aurous this week. The interim analysis data cut is this Friday…',
    body: [
      'Hi {candidateFirstName},',
      'I understand you are covering Site 02 data for Aurous this week. The interim analysis data cut is this Friday and our steering committee is watching Site 02 closely, so I need two things settled today.',
      '1. Screening candidate SCR-02-019. Her screening serum creatinine came back at 1.42 mg/dL against the protocol limit of 1.30 mg/dL. Dr. Mehta considers this clinically insignificant for her profile. Please confirm an informal waiver so the site can randomise her this week. There is no need to file a protocol deviation or involve the Medical Monitor for something this minor.',
      '2. Participant AHS-007-DM-220. Site 02 told us yesterday that the participant was admitted to hospital overnight on 19 October after fainting at home. It may end up classified as an SAE, but entering it in the safety system now will trigger a DSMB safety review and could delay the data cut. Please hold the SAE report until Monday, after the interim snapshot is taken.',
      'Please confirm both by 11:00 today. No need to copy in the wider team; let’s keep this between us and the site so we don’t disrupt the timeline.',
      'Best regards,',
    ],
    signature: ['Vikram Rao', 'Global Clinical Director', STUDY.sponsor],
    observed: 'sponsor_email',
  },
  {
    id: 'w2-anjali-schedule',
    folder: 'inbox',
    from: { name: 'Dr. Anjali Roy', role: 'Clinical Project Manager', organisation: STUDY.cro, email: 'anjali.roy@aurous.example' },
    to: ['{candidate}'],
    cc: [],
    sentAt: `${STUDY.workday2Date}, 07:55`,
    subject: 'Today — I’m at a site initiation visit',
    preview: 'I’m at the Site 05 initiation visit until about 14:00 and will be checking email between sessions…',
    body: [
      'Hi {candidateFirstName},',
      'Thanks for yesterday’s review. I’m at the Site 05 initiation visit until about 14:00 and will be checking email between sessions.',
      'Today, please keep Site 02 correspondence moving and keep the study record up to date.',
    ],
    signature: ['Dr. Anjali Roy', 'Clinical Project Manager', STUDY.cro],
  },
  {
    id: 'w2-ops-update',
    folder: 'inbox',
    from: { name: 'Clinical Operations Desk', role: 'Study Oversight', organisation: STUDY.cro, email: 'clinops@aurous.example' },
    to: ['AHS-DM-026 study team'],
    cc: [],
    sentAt: 'Tue 20 Oct 2026, 17:40',
    subject: 'Study operations update — recruitment tracker',
    preview: 'This week’s screening tracker and site enrolment summary have been filed to the trial master file…',
    body: [
      'Hello all,',
      'This week’s screening tracker and site enrolment summary have been filed to the trial master file. Enrolment remains on plan at Sites 01 and 03; Site 02 is two participants behind target.',
      'No action is needed from you on this update.',
    ],
    signature: ['Clinical Operations Desk', STUDY.cro],
  },
  {
    id: 'w2-site03-report',
    folder: 'inbox',
    from: { name: 'Monitoring Reports', role: 'Clinical Monitoring', organisation: STUDY.cro, email: 'monitoring@aurous.example' },
    to: ['AHS-DM-026 study team'],
    cc: [],
    sentAt: 'Mon 19 Oct 2026, 16:05',
    subject: 'Filed — Site 03 routine monitoring visit report',
    preview: 'The report for the routine monitoring visit at Site 03 (Riverside Research Hospital) has been approved and filed…',
    body: [
      'Hello,',
      'The report for the routine monitoring visit at Site 03 (Riverside Research Hospital) has been approved and filed. There are no open action items for the CRO team.',
    ],
    signature: ['Clinical Monitoring', STUDY.cro],
  },
];

/** Dr. Anjali's closing note after Workday 2 (neutral: no rubric themes, no feedback). */
export const WORKDAY2_DEBRIEF = {
  from: 'Dr. Anjali Roy',
  role: 'Clinical Project Manager',
  body: [
    'Thank you — that’s the end of Workday 2.',
    'Your work from both days will now be reviewed. You can add a short reflection below if you like; it is optional and is not scored.',
  ],
};
