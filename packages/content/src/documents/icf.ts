import { STUDY } from '../study';
import type { StudyDocument } from '../types';
import { VISIT_SCHEDULE } from '../visits';

/**
 * Informed consent form, master version 3.0 (draft) — workbook F2, F5, F6.
 * - Unassigned master: no participant ID, no participant-specific dates (the old header named clean DM-206).
 * - Exactly ONE planted error, in Section 4 (SME draft): the dosing frequency says "twice a day" while the
 *   protocol (PRO-026-B) says once daily. Sections 1–3 and 5–11 are consistent with the protocol extract.
 * - No answer panel, no "[NOTE: ...]" text; the v1.0 errors (missing visit in §5, empty §6 risks, impossible
 *   dates, draft footer listing the problems) are removed.
 */
export const ICF: StudyDocument = {
  id: 'icf',
  title: 'Participant Information Sheet and Informed Consent Form',
  shortTitle: 'Informed consent form',
  subtitle: STUDY.title,
  version: STUDY.icfVersion,
  status: 'Draft for ethics committee submission — quality-control review in progress',
  owner: STUDY.cro,
  header: [
    { label: 'Study ID', value: STUDY.id },
    { label: 'Study phase', value: STUDY.phase },
    { label: 'Sponsor', value: STUDY.sponsor },
    { label: 'Form version', value: `${STUDY.icfVersion}, ${STUDY.icfDate}` },
    { label: 'Study doctor', value: 'Completed by each site' },
    { label: 'Study site', value: 'Completed by each site' },
  ],
  sections: [
    {
      id: 'control',
      title: 'Document control',
      blocks: [
        {
          type: 'table',
          headers: ['Version', 'Date', 'Status', 'Summary of changes'],
          rows: [
            ['2.0', '12 May 2026', 'Approved by the ethics committee on 02 June 2026', 'Version used to consent all currently enrolled participants.'],
            ['3.0 (draft)', STUDY.icfDate, 'Draft — not yet submitted', 'Aligned with protocol amendment 2.1: study treatment description (Section 4), visit windows (Section 5), possible side effects (Section 6).'],
          ],
        },
        { type: 'note', text: 'Each section of version 3.0 must pass quality-control review before the form is submitted to the ethics committee.' },
      ],
    },
    {
      id: '1',
      number: '1',
      title: 'Invitation to take part',
      blocks: [
        {
          type: 'p',
          text: 'You are invited to consider joining a research study for adults with Type 2 diabetes. Please read this form and ask the study team any questions you have. Taking part is your choice. You should agree only if you understand what the study involves.',
        },
      ],
    },
    {
      id: '2',
      number: '2',
      title: 'Why is this study being done?',
      blocks: [
        {
          type: 'p',
          text: 'Researchers are studying SGLT-440, a new investigational tablet, to learn about its safety and how well it works. The kidneys normally return sugar (glucose) from the urine back into the blood. SGLT-440 is designed to block a protein in the kidneys called SGLT2, so that more sugar leaves the body in the urine and blood sugar levels fall.',
        },
        {
          type: 'p',
          text: 'In this study, SGLT-440 is compared with a placebo (a dummy tablet that contains no medicine), taken alongside your usual diabetes treatment. “Investigational” means the medicine is still being studied in clinical trials.',
        },
      ],
    },
    {
      id: '3',
      number: '3',
      title: 'Who can take part?',
      blocks: [
        {
          type: 'p',
          text: 'You may be able to take part if you are 18 to 65 years old, have Type 2 diabetes, and meet the other requirements of the study, including a blood test of your kidney function. The study doctor will check whether you are eligible.',
        },
      ],
    },
    {
      id: '4',
      number: '4',
      title: 'What will happen if I take part?',
      blocks: [
        {
          type: 'p',
          text: 'The study team will ask about your medical history and current medicines, examine you, measure your weight and blood pressure, and take blood samples to measure your blood sugar.',
        },
        {
          type: 'p',
          text: 'You will be assigned by chance to receive either SGLT-440 or placebo, in addition to your usual diabetes treatment. You will take one study tablet twice a day, in the morning and in the evening, for 12 weeks.',
        },
        {
          type: 'p',
          text: 'Before some visits you will be asked not to eat for 8 hours so that your fasting blood sugar can be measured. At each visit the team will ask how you are feeling and whether you have noticed any side effects.',
        },
      ],
    },
    {
      id: '5',
      number: '5',
      title: 'How long will the study last?',
      blocks: [
        {
          type: 'p',
          text: 'Your participation will last about 12 weeks and includes seven study visits. Each visit can take place a few days before or after its planned date.',
        },
        {
          type: 'table',
          headers: ['Visit', 'Approximate time', 'What happens'],
          rows: VISIT_SCHEDULE.map((v) => [String(v.visitNumber), `Week ${v.week}`, v.participantActivity]),
        },
      ],
    },
    {
      id: '6',
      number: '6',
      title: 'What are the possible risks and side effects?',
      blocks: [
        { type: 'p', text: 'SGLT-440 may cause side effects. Those seen so far with this type of medicine include:' },
        {
          type: 'list',
          items: [
            'genital yeast infections and urinary tract infections;',
            'passing more urine than usual;',
            'dehydration, which can make you feel dizzy or light-headed, especially when you stand up;',
            'low blood sugar, mainly when taken with insulin or sulfonylurea medicines;',
            'rarely, a serious condition called ketoacidosis, which needs urgent medical care.',
          ],
        },
        {
          type: 'p',
          text: 'Blood tests may cause brief discomfort or bruising where the needle goes in. There may also be risks that are not yet known. Tell the study doctor promptly about any new symptoms, side effects or changes in your health. The study doctor will explain what to do if a side effect occurs and how to contact the team if you need medical help.',
        },
      ],
    },
    {
      id: '7',
      number: '7',
      title: 'Will I benefit from taking part?',
      blocks: [
        {
          type: 'p',
          text: 'You may receive no direct medical benefit. SGLT-440 may or may not improve your blood sugar control, and no improvement is guaranteed. The findings may help researchers learn more about future treatments for Type 2 diabetes.',
        },
      ],
    },
    {
      id: '8',
      number: '8',
      title: 'What happens to my usual diabetes treatment?',
      blocks: [
        {
          type: 'p',
          text: 'The study doctor will explain how your current diabetes treatment will be managed during the study and what to do if your blood sugar changes. Do not stop or change prescribed medicines on your own. Contact the study doctor if you have concerns.',
        },
      ],
    },
    {
      id: '9',
      number: '9',
      title: 'How will my information be kept confidential?',
      blocks: [
        {
          type: 'p',
          text: 'The study team will collect information about your health, tests and response to treatment. Your information will be handled confidentially and used only as allowed for the study. Authorised study staff, the sponsor, ethics committee representatives or regulatory authorities may review your records to check the study, as permitted by applicable rules.',
        },
      ],
    },
    {
      id: '10',
      number: '10',
      title: 'Is taking part voluntary?',
      blocks: [
        {
          type: 'p',
          text: 'Taking part is voluntary. You may refuse or leave the study at any time without giving a reason, without penalty and without any loss of your usual medical care. If you leave, speak with the study doctor about any steps needed to protect your health.',
        },
      ],
    },
    {
      id: '11',
      number: '11',
      title: 'Participant consent statement',
      blocks: [
        {
          type: 'p',
          text: 'By signing below, I confirm that I have read this form or had it explained in a language I understand; had the chance to ask questions and received answers; understand the study procedures, duration, possible risks and possible lack of direct benefit; understand how my information may be used and reviewed; and understand that taking part is voluntary and that I may withdraw at any time. I agree to take part.',
        },
        {
          type: 'signature',
          lines: [
            'Participant name',
            'Participant signature or thumb impression, and date',
            'Name of person obtaining consent',
            'Signature of person obtaining consent, and date',
            'Impartial witness name, signature and date (if required)',
          ],
        },
        { type: 'p', text: 'A copy of the signed consent form will be given to the participant.' },
      ],
    },
  ],
  footer: `${STUDY.id} · Informed consent form v${STUDY.icfVersion} · ${STUDY.icfDate} · Fictional training material`,
};
