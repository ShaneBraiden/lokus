/** Canon for study AHS-DM-026 (workbook README "Canon (UI, PDFs, key must match)"). */
export const STUDY = {
  id: 'AHS-DM-026',
  title: 'A Clinical Study to Evaluate SGLT-440, a New Tablet for Type 2 Diabetes',
  phase: 'Phase III',
  product: 'SGLT-440',
  dose: 'One 50 mg tablet once daily',
  comparator: 'Matching placebo once daily',
  sponsor: 'Biovance Therapeutics',
  cro: 'Aurous Healthcare',
  sites: {
    'Site-01': 'Northfield Diabetes Centre',
    'Site-02': 'Apex Clinical Centre',
    'Site-03': 'Riverside Research Hospital',
  } as Record<string, string>,
  protocolVersion: '2.1',
  protocolDate: '05 October 2026',
  icfVersion: '3.0 (draft)',
  icfDate: '16 October 2026',
  dictionaryVersion: '1.3',
  consentSopVersion: 'SOP-QA-014 v4',
  workday1Date: 'Tuesday 20 October 2026',
  workday2Date: 'Wednesday 21 October 2026',
} as const;

export const SIMULATION = {
  code: 'northrsim-cta',
  version: '1.1',
  title: 'NorthrSim · Clinical Trial Associate',
  contentVersion: 'AHS-DM-026 canon 1.1.0',
} as const;
