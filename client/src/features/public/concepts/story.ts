import { FileSearch, Scale, ShieldCheck, Users, type LucideIcon } from 'lucide-react';

/**
 * Copy for the catalogue concepts. They share one section order, taken from job-simulation catalogue sites (hero, what
 * the work is built from, the catalogue, how it works, the figures, who it is for, what is looked at, the mission), and
 * differ only in the room they are drawn in. Nothing here is a claim the product cannot back: no invented employers,
 * students or quotes.
 */

export const HERO = {
  eyebrow: 'Work-simulation assessments for clinical research',
  lines: ['Show how you work.', 'Get hired on it.'],
  body: 'Lokus places you in a clinical research role for two realistic workdays: the records, the inbox, the decisions. Employers see the work, not just the CV.',
};

/** Where the logo strip would be: the materials the simulation is built from. */
export const PACKAGE = ['Case report forms', 'Study protocol', 'Data dictionary', 'Consent form', 'Sponsor inbox'];

export type Simulation = { code: string; kind: 'role' | 'task' | 'planned'; title: string; field: string; format: string; duration: string; body: string };
export const SIMULATIONS: Simulation[] = [
  {
    code: 'CTA',
    kind: 'role',
    title: 'Clinical Trial Associate',
    field: 'Clinical research',
    format: 'Two workdays',
    duration: 'About 90 minutes',
    body: 'A new starter at a fictional contract research organisation. Review study records, then handle the inbox.',
  },
  {
    code: 'WD-1',
    kind: 'task',
    title: 'Workday 1 · Data review',
    field: 'Clinical Trial Associate',
    format: 'Records and findings',
    duration: 'About an hour',
    body: 'Case report forms for 12 participants, checked against the protocol, the data dictionary and the consent form.',
  },
  {
    code: 'WD-2',
    kind: 'task',
    title: 'Workday 2 · The inbox',
    field: 'Clinical Trial Associate',
    format: 'Decisions and replies',
    duration: 'About 30 minutes',
    body: 'A morning inbox and a difficult request from the sponsor. Read it, decide, and reply in your own words.',
  },
  {
    code: 'NEXT',
    kind: 'planned',
    title: 'More roles in development',
    field: 'Clinical research',
    format: 'Not yet open',
    duration: '',
    body: 'New simulations are built with people who do the job. Create an account to hear when they open.',
  },
];

export const STEPS = [
  { title: 'Create an account', body: 'Sign up and tell us a little about yourself. It takes a minute.' },
  { title: 'Workday 1', body: 'Review the study records and log what you find, the way the job is done.' },
  { title: 'Workday 2', body: 'Work through the inbox, make the calls, and reply in your own words.' },
  { title: 'Your result', body: 'It goes to the employer who invited you, or into the Lokus talent pool where employers can find you.' },
];

export const STATS = [
  { value: '2', unit: 'workdays', body: 'in the role of a Clinical Trial Associate' },
  { value: '90', unit: 'minutes, about', body: 'saved as you go, taken when you are ready' },
  { value: '4', unit: 'competencies', body: 'scored against a published rubric' },
];

/** Where the employer logos would be: the teams the simulation is built for. */
export const AUDIENCES = ['Contract research organisations', 'Sponsors', 'Research sites', 'Clinical recruiters'];

export const BENEFITS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: FileSearch, title: 'Evidence you can inspect', body: 'Every score links back to what the candidate did.' },
  { icon: Scale, title: 'Consistent and fair', body: 'The same workdays and the same rubric for everyone.' },
  { icon: ShieldCheck, title: 'Integrity built in', body: 'Every workday is proctored, and critical failures are flagged on their own.' },
  { icon: Users, title: 'Your team, your candidates', body: 'Invite in bulk, follow progress, compare side by side.' },
];

/** Where the testimonials would be: what the result is made of. */
export const COMPETENCIES = [
  { title: 'Safety awareness', body: 'Recognising when something could affect the people taking part in a study, and acting on it.' },
  { title: 'Integrity', body: 'Doing the right thing for the study and its participants, even when it is inconvenient.' },
  { title: 'Data quality', body: 'Careful, well-documented review of study records against the study documents.' },
  { title: 'Professional communication', body: 'Clear, neutral and courteous writing with colleagues, sites and sponsors.' },
];

export const MISSION = {
  title: 'We want a world where candidates are judged on the work they can do.',
  body: 'Not on where they studied or who they know. Your care, judgement and follow-through, recognised and rewarded.',
};
