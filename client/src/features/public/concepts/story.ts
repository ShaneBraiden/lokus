import { FileSearch, Scale, ShieldCheck, Users, type LucideIcon } from 'lucide-react';

/**
 * Copy for the catalogue concepts. They share one section order, taken from job-simulation catalogue sites (hero, what
 * the work is built from, the catalogue, how it works, the figures, who it is for, what is looked at, the mission), and
 * differ only in the room they are drawn in. Nothing here is a claim the product cannot back: no invented employers,
 * students or quotes, and roles that are not built yet are marked as planned.
 */

export const HERO = {
  eyebrow: 'Job simulations for healthcare and life sciences',
  lines: ['Show how you work.', 'Get hired on it.'],
  body: 'Step into a real healthcare role for a realistic workday: the records, the inbox, the decisions. Pick a simulation, do the work, and let employers see it, not just the CV.',
};

/** Where the logo strip would be: the everyday materials the simulations are built from. */
export const PACKAGE = ['Patient records', 'Care protocols', 'Prescriptions', 'Lab reports', 'Consent forms', 'Shift handovers'];

/**
 * The simulations board. A new simulation is one more entry here: 'role' is open now, 'planned' is on the board but not
 * yet open. 'task' marks a part of a role and is kept for the earlier concepts.
 */
export type Simulation = { code: string; kind: 'role' | 'task' | 'planned'; title: string; field: string; format: string; duration: string; body: string };
export const SIMULATIONS: Simulation[] = [
  {
    code: 'CTA',
    kind: 'role',
    title: 'Clinical Trial Associate',
    field: 'Clinical research',
    format: 'Two workdays',
    duration: 'About 90 minutes',
    body: 'A new starter at a fictional contract research organisation. Review study records against the protocol, then handle the sponsor inbox.',
  },
  {
    code: 'RN',
    kind: 'planned',
    title: 'Ward Nurse',
    field: 'Nursing',
    format: 'Coming soon',
    duration: '',
    body: 'Take the morning handover, prioritise a busy ward and escalate the patient who is quietly getting worse.',
  },
  {
    code: 'PHA',
    kind: 'planned',
    title: 'Pharmacy Technician',
    field: 'Pharmacy',
    format: 'Coming soon',
    duration: '',
    body: 'Check prescriptions, catch the interaction that slipped through and explain a change to a worried patient.',
  },
  {
    code: 'LAB',
    kind: 'planned',
    title: 'Medical Laboratory Scientist',
    field: 'Laboratory',
    format: 'Coming soon',
    duration: '',
    body: 'Work a batch of results, spot the sample that does not add up and report a critical value on time.',
  },
  {
    code: 'MCO',
    kind: 'planned',
    title: 'Medical Coder',
    field: 'Health information',
    format: 'Coming soon',
    duration: '',
    body: 'Read discharge summaries, code them accurately and query the clinician when the notes are unclear.',
  },
  {
    code: 'PV',
    kind: 'planned',
    title: 'Pharmacovigilance Associate',
    field: 'Drug safety',
    format: 'Coming soon',
    duration: '',
    body: 'Triage incoming adverse event reports, decide what is serious and meet the reporting clock.',
  },
  {
    code: 'PCC',
    kind: 'planned',
    title: 'Patient Care Coordinator',
    field: 'Healthcare operations',
    format: 'Coming soon',
    duration: '',
    body: 'Juggle referrals, appointments and a frustrated family, and keep every patient moving through the clinic.',
  },
  {
    code: 'PH',
    kind: 'planned',
    title: 'Public Health Analyst',
    field: 'Public health',
    format: 'Coming soon',
    duration: '',
    body: 'Clean a week of surveillance data, find the signal and brief the team in plain language.',
  },
];

/** The fields on the board, in the order they first appear. */
export const FIELDS = [...new Set(SIMULATIONS.map((s) => s.field))];

export const STEPS = [
  { title: 'Create an account', body: 'Sign up and tell us a little about yourself. It takes a minute.' },
  { title: 'Pick a simulation', body: 'Choose a role in the field you want to work in, or open the one an employer sent you.' },
  { title: 'Do the work', body: 'Work through the records, the inbox and the decisions, the way the job is really done.' },
  { title: 'Your result', body: 'It goes to the employer who invited you, or into the Lokus talent pool where employers can find you.' },
];

export const STATS = [
  { value: String(FIELDS.length), unit: 'fields', body: 'of healthcare and life sciences on the board' },
  { value: '4', unit: 'competencies', body: 'scored against a published rubric' },
  { value: '0', unit: 'CVs needed', body: 'you are judged on the work you do' },
];

/** Where the employer logos would be: the teams the simulations are built for. */
export const AUDIENCES = ['Hospitals and health systems', 'Pharmacies', 'Clinical research organisations', 'Diagnostic laboratories', 'Healthcare recruiters'];

export const BENEFITS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: FileSearch, title: 'Evidence you can inspect', body: 'Every score links back to what the candidate did.' },
  { icon: Scale, title: 'Consistent and fair', body: 'The same simulation and the same rubric for everyone.' },
  { icon: ShieldCheck, title: 'Integrity built in', body: 'Every simulation is proctored, and critical failures are flagged on their own.' },
  { icon: Users, title: 'Your team, your candidates', body: 'Invite in bulk, follow progress, compare side by side.' },
];

/** Where the testimonials would be: what the result is made of. */
export const COMPETENCIES = [
  { title: 'Patient safety', body: 'Recognising when something could harm a patient or participant, and acting on it.' },
  { title: 'Integrity', body: 'Doing the right thing for the people in your care, even when it is inconvenient.' },
  { title: 'Accuracy and documentation', body: 'Careful, well-documented work that checks the record against the source.' },
  { title: 'Professional communication', body: 'Clear, calm and courteous writing with colleagues, patients and partners.' },
];

export const MISSION = {
  title: 'We want a world where candidates are judged on the work they can do.',
  body: 'Not on where they studied or who they know. Your care, judgement and follow-through, recognised and rewarded.',
};
