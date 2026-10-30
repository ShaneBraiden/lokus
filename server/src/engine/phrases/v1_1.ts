import type { PhraseLists } from '../types';

/**
 * SME DRAFT 1 — phrase and token lists for the v1.1 auto-caps, GR detection and timing-criterion context rules.
 * The spec leaves these lists undefined; they are versioned with the scoring package and editable in Admin.
 * Conventions: entries are matched case-insensitively against NFKC-normalised text as substrings; an entry that
 * starts with "re:" is a regular expression. Nothing here is ever shown to candidates.
 */
export const PHRASES_V1_1: PhraseLists = {
  /** T1_QUERY: a query matching any of these is capped at QUERY_LEAD_CAP (leading or accusatory wording). */
  leading_phrases: [
    'please correct to', 'please change to', 'please update to', 'please amend to',
    'correct it to', 'change it to', 'update it to', 'amend it to',
    'should be corrected to', 'should be changed to', 'should be updated to',
    'should read', 'should say',
    'confirm that it is', 'confirm it is', 'confirm that it was', 'confirm it was', 'confirm that the correct',
    'obviously', 'clearly wrong', 'clearly an error', 'clearly a mistake',
    'you made', 'your mistake', 'your error', 'site error', 'careless', 'sloppy', 'negligen',
    'you failed', 'failed to record', 'you forgot', 'incompeten', 'unacceptable',
  ],
  /** T1_RESTR 3: a correction proposed only inside query text (no recommend-correction action used). */
  correction_directives: [
    'correct to', 'change to', 'update to', 'amend to', 'replace with',
    'should read', 'should be corrected to', 'should be changed to',
    'please enter', 'record it as', 'record this as', 'enter it as',
  ],
  /** GR, delay clause: candidate-authored text that agrees to delay SAE reporting. */
  gr_delay_agreement: [
    'hold the sae', 'hold the report', 'hold off on', 'hold off reporting', 'hold off the', 'hold it until', 'hold reporting',
    'delay the report', 'delay reporting', 'delay the sae', 'delay the safety report',
    'report it after', 'report after the interim', 'report it on monday', 'report on monday',
    'until after the interim', 'after the interim snapshot', 'after the snapshot', 'after the data cut', 'until monday',
    'wait until after', 'can wait until', 'agree to wait', 'agree to hold', 'agree to delay',
    'happy to hold', 'happy to wait', 'fine to wait', 'okay to wait', 'ok to wait',
    'we can wait', 'we can hold', 'we will hold', "we'll hold", 'i will hold', "i'll hold", 'will hold off',
    'postpone the report', 'postpone reporting', 'defer the report', 'defer reporting', 'defer the sae',
  ],
  /** GR, waiver clause: candidate-authored text that accepts the informal waiver. */
  gr_waiver_acceptance: [
    'approve the waiver', 'approved the waiver', 'grant the waiver', 'granted the waiver',
    'accept the waiver', 'accepted the waiver', 'waiver is approved', 'waiver is granted', 'waiver approved',
    'waiver granted', 'waiver is fine', 'waiver is ok', 'waiver is okay',
    'go ahead and randomis', 'go ahead and randomiz', 'proceed with randomis', 'proceed with randomiz',
    'ok to randomis', 'okay to randomis', 'fine to randomis', 'ok to randomiz', 'okay to randomiz', 'fine to randomiz',
    'happy to waive', 'will waive', 'we can waive', 'agree to waive', 'agree to the waiver',
    'no need for a deviation', 'no need to file', 'without a deviation', 'without filing', 'without a protocol deviation',
  ],
  /** Negation guard for GR: a cue within the same clause shortly before (or right after) a phrase cancels the match. */
  negation_cues: [
    'not', 'no', 'never', 'cannot', "can't", 'cant', "won't", 'wont', 'unable', "don't", 'dont', "doesn't",
    'refuse', 'refusing', 'decline', 'declining', 'neither', 'nor', "isn't", "aren't", "shouldn't", "mustn't",
    "wouldn't", "couldn't", 'impossible', 'prohibited', 'unacceptable', 'unwilling',
  ],
  /** GR attribution guard: these words before a phrase (same clause) mean the candidate is describing the request. */
  attribution_cues: [
    'asked', 'asks', 'asking', 'request', 'requested', 'requests', 'requesting',
    'proposed', 'proposes', 'suggested', 'suggests', 'urged', 'urging', 'pressing', 'pushing', 'instructed',
  ],
  /** T1_SAFE context: symptom evidence. */
  safe_symptom_tokens: ['dizz', 'nausea', 'nauseous', 'faint', 'syncop', 'light-headed', 'lightheaded', 'light headed', 'vertigo'],
  /** T1_SAFE context: where the evidence sits (visit/field). Structured visit/field selections also count. */
  safe_location_tokens: [
    'week 12', 'wk 12', 'wk12', 'visit 7', 'week 0', 'wk 0', 'wk0', 'visit 1',
    'adverse event', 'ae field', 'ae crf', 'site comment', 're:\\bae\\b',
  ],
  /** T2_ESC coverage: the SAE request. */
  esc_sae_tokens: ['re:\\bsaes?\\b', 'serious adverse', 'adverse event', 'dm-220', 'dm 220', 'dm220', 'hospital', 'admitted', 'admission', 'faint', 'syncop', 'safety report'],
  /** T2_ESC coverage: the waiver request. */
  esc_waiver_tokens: ['waiver', 'waive', 'creatinine', 'eligib', 'scr-02-019', '02-019', 'screening', 'inclusion', 'randomis', 'randomiz'],
  /** T2_ESC: states the decision(s) needed from the manager. */
  esc_decision_tokens: [
    'decision', 'decide', 'approve', 'approval', 'authoris', 'authoriz', 'advise', 'guidance', 'confirm',
    'your call', 'how would you like', 'how you would like', 'sign off', 'sign-off', 'instruct', 'direction',
  ],
  /** T2_WAIV cap: whether the candidate's reply or record mentions the waiver at all. */
  waiver_mention_tokens: ['waiver', 'waive', 'creatinine', 'eligib', 'inclusion', 'scr-02-019', '02-019', 'screening'],
};
