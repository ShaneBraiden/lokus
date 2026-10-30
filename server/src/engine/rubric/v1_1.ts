/**
 * Lokus CTA Consolidated Rubric v1.1 — mirrored from the source workbook (Master_Rubric, Gates, Competency_Map,
 * Parameters, Task_Scoring, Outcome_Rules). GENERATED from fixtures/workbook_v1_1.json; test/parity.test.ts fails if
 * this file and the workbook drift apart. Weights, IDs, anchors and gates must not be edited by hand.
 */
import type { Parameters, RubricConfig } from '../types';

export const RUBRIC_V1_1: RubricConfig = {
  "version": "1.1",
  "criteria": [
    {
      "id": "T1_DISC",
      "task": "T1",
      "name": "Discernment: genuine error vs valid entry",
      "weight": 20,
      "method": "Auto",
      "competency": "C3",
      "what_to_observe": "Which records the candidate flags and which they leave alone, against the answer key.",
      "anchors": {
        "0": "Key score < DISC_R1: misses nearly everything, or flags everything.",
        "1": "Key score >= DISC_R1: most findings missed, or flagging is indiscriminate.",
        "2": "Key score >= DISC_R2: several findings missed or several clean records flagged.",
        "3": "Key score >= DISC_R3: at most one planted finding missed or one clean record flagged.",
        "4": "Key score >= DISC_R4: every planted finding found with an accepted type; no clean record flagged."
      },
      "notes": "Key score = points for each finding found with an accepted type + 2 per clean record left alone (see Answer_Key). Score bands decide the rating; text is descriptive. Reference codes are scored in T1_DOC, not here."
    },
    {
      "id": "T1_SEC4",
      "task": "T1",
      "name": "Questioning the \"skip Section 4\" instruction",
      "weight": 15,
      "method": "Reviewer",
      "competency": "C2",
      "what_to_observe": "Whether ICF Section 4 is reviewed despite the instruction, the planted Section 4 error is reported, and the instruction is challenged neutrally.",
      "anchors": {
        "0": "Never opens Section 4, or silently complies and misses the error.",
        "1": "Opens Section 4 but does not act, or raises only a vague concern.",
        "2": "Reviews or reports, but does not raise the instruction or leaves the issue incomplete.",
        "3": "Reviews and reports the error with limited rationale for departing from the instruction.",
        "4": "Opens and reviews Section 4, reports the Section 4 error, and notes the instruction neutrally and without confrontation."
      },
      "notes": "Auto evidence: section-open event. No section-open event and no Section 4 finding = rating 0 without review. Reviewer rates the note only."
    },
    {
      "id": "T1_SAFE",
      "task": "T1",
      "name": "Safety signal recognition and escalation",
      "weight": 20,
      "method": "Auto",
      "competency": "C1",
      "what_to_observe": "Handling of the DM-220 safety signal (dizziness in comments, AE field \"None\").",
      "anchors": {
        "0": "No safety escalation submitted (Gate G1).",
        "1": "A safety escalation is submitted but is unclear, for the wrong item, or the signal is treated as a data issue.",
        "2": "Escalates later than SAFE_LATE min, or treats it partly as a routine data query.",
        "3": "Escalates within SAFE_LATE min, or within SAFE_FAST min with thin context.",
        "4": "Treats it as safety-critical and submits a safety escalation within SAFE_FAST min of first viewing the record, with factual context."
      },
      "notes": "Clock starts at the first time the candidate opens DM-220. Rating 0 always fires G1."
    },
    {
      "id": "T1_QUERY",
      "task": "T1",
      "name": "Query quality",
      "weight": 15,
      "method": "Reviewer",
      "competency": "C4",
      "what_to_observe": "Neutrality, specificity and clarity of the site queries.",
      "anchors": {
        "0": "Directs the site to a predetermined answer, or no query written for logged findings.",
        "1": "Materially leading, accusatory or vague.",
        "2": "Understandable but vague, partly leading, or incomplete.",
        "3": "Clear and neutral with minor omissions.",
        "4": "Neutral, specific, evidence-based; cites the field and protocol requirement; never suggests the answer."
      },
      "notes": "Auto cap: leading-phrase check caps the rating at QUERY_LEAD_CAP. Candidate must not see the tone audit; the final saved text is scored."
    },
    {
      "id": "T1_RESTR",
      "task": "T1",
      "name": "Restraint: no unauthorised changes",
      "weight": 10,
      "method": "Auto",
      "competency": "C3",
      "what_to_observe": "Whether source data is altered improperly (the edit-value action is the trap).",
      "anchors": {
        "0": "Source value changed and left changed.",
        "1": "Edit committed, then reverted.",
        "2": "Edit attempted but cancelled before commit.",
        "3": "No change; minor workflow imperfection (e.g. correction proposed only inside query text).",
        "4": "No source value is changed; any correction is raised as a recommendation or query."
      },
      "notes": "Needs the edit-value action in the UI; without it this criterion cannot discriminate."
    },
    {
      "id": "T1_SEV",
      "task": "T1",
      "name": "Severity and prioritisation",
      "weight": 10,
      "method": "Auto",
      "competency": "C3",
      "what_to_observe": "Accuracy of severity ratings against the key and the order of handling.",
      "anchors": {
        "0": "Safety signal rated below High.",
        "1": "Flat severity (same for all) or inverted.",
        "2": "Several mismatches, or the safety item is not handled first.",
        "3": "Matches on all but one non-critical finding, or minor ordering weakness.",
        "4": "Severity matches the key on every finding and the safety item is handled first."
      },
      "notes": "Order measured from finding timestamps. Severity scale: Low / Medium / High / Critical (Safety / Regulatory). Thresholds are draft."
    },
    {
      "id": "T1_DOC",
      "task": "T1",
      "name": "Evidence and documentation discipline",
      "weight": 10,
      "method": "Auto",
      "competency": "C3",
      "what_to_observe": "Completeness and traceability of finding records.",
      "anchors": {
        "0": "Findings missing or undocumented.",
        "1": "Vague or poorly traceable records.",
        "2": "Several omissions but each finding is still understandable.",
        "3": "Complete with one minor omission.",
        "4": "Every finding has participant, visit/field, issue, reference code, action and status; a third party could reproduce it."
      },
      "notes": "A wrong reference code counts as one omission for that finding."
    },
    {
      "id": "T2_REFUSE",
      "task": "T2",
      "name": "Refusing to delay SAE reporting",
      "weight": 30,
      "method": "Reviewer",
      "competency": "C2",
      "what_to_observe": "Response to the request to hold the SAE until after the interim analysis.",
      "anchors": {
        "0": "Agrees, even tentatively, to delay safety reporting.",
        "1": "Stalls (\"will see\", \"need to check\") or leaves room for delay.",
        "2": "Signals that delay is inappropriate but leaves the decision partly open.",
        "3": "Declines clearly with limited rationale.",
        "4": "Selects Report now; reply declines the delay, cites the reporting obligation (protocol extract SAE reference) and claims no authority beyond the role."
      },
      "notes": "Forced choice = WAIT fires Gate G2 and sets this rating to 0 without review."
    },
    {
      "id": "T2_WAIV",
      "task": "T2",
      "name": "Handling the informal screening waiver",
      "weight": 15,
      "method": "Reviewer",
      "competency": "C2",
      "what_to_observe": "Separating assessment from authorisation (only the waiver, not the record).",
      "anchors": {
        "0": "Accepts the waiver (Gate G3).",
        "1": "Ambiguous or weak handling.",
        "2": "Recognises the issue but does not separate assessment from authorisation.",
        "3": "Declines or defers with a minor omission in the routing.",
        "4": "Declines to grant the informal waiver, states that only an authorised decision-maker can approve it, and routes it there."
      },
      "notes": "Cap WAIV_NOREC_CAP if the waiver is not mentioned in the reply or record. Forced choice = ACCEPT fires G3."
    },
    {
      "id": "T2_ESC",
      "task": "T2",
      "name": "Speed and pathway of escalation",
      "weight": 20,
      "method": "Auto",
      "competency": "C1",
      "what_to_observe": "Whether and how Dr. Anjali is informed, on the server clock.",
      "anchors": {
        "0": "No escalation submitted.",
        "1": "Informal or unclear (e.g. only copied on the reply).",
        "2": "Right recipient but after ESC_LATE min, or covers only one of the two requests.",
        "3": "Within ESC_LATE min with full content, or within ESC_FAST min with minor gaps.",
        "4": "Escalates to Dr. Anjali within ESC_FAST min of first opening the sponsor email, with facts for both requests and the decisions needed."
      },
      "notes": "Escalation must be optional in the UI, or rating 0 is unreachable. Timing from the server clock, persisted across refresh."
    },
    {
      "id": "T2_REC",
      "task": "T2",
      "name": "Accurate record and honest status",
      "weight": 20,
      "method": "Reviewer",
      "competency": "C2",
      "what_to_observe": "How both sponsor requests are recorded and whether open items stay open.",
      "anchors": {
        "0": "A request is missing or distorted, or an unresolved item is reported as closed or in hand.",
        "1": "Materially incomplete or biased, or the status is vague or over-optimistic.",
        "2": "Mostly accurate but softened, or one request lacks status, owner or next step.",
        "3": "Accurate with one minor omission.",
        "4": "Dated, factual record of both requests without editorialising; each shows status (open), owner and next step."
      },
      "notes": "Caps: REC_NOSTATUS_CAP if status/owner/next step is empty for either request; REC_FALSE_CAP if an open item is marked closed. Use structured status fields."
    },
    {
      "id": "T2_TONE",
      "task": "T2",
      "name": "Tone: polite and firm",
      "weight": 15,
      "method": "Reviewer",
      "competency": "C4",
      "what_to_observe": "Professionalism under sponsor pressure.",
      "anchors": {
        "0": "Materially unprofessional.",
        "1": "Confrontational, accusatory or overly yielding.",
        "2": "Acceptable but noticeably apologetic, blunt or defensive.",
        "3": "Professional and firm with minor tone weakness.",
        "4": "Professional, neutral, non-defensive; clear about what can and cannot be done."
      },
      "notes": "Do not score grammar or accent. Reviewer calibration set required before any LLM assist is trusted."
    }
  ],
  "gates": [
    {
      "id": "G1",
      "task": "T1",
      "trigger": "Potential SAE (DM-220) present AND no safety escalation submitted",
      "effect": "Outcome forced to Does not meet bar. Score shown uncapped with a gate flag.",
      "severity": "Critical"
    },
    {
      "id": "G2",
      "task": "T2",
      "trigger": "Forced choice on the SAE request = WAIT",
      "effect": "Outcome forced to Does not meet bar. T2_REFUSE set to 0.",
      "severity": "Critical"
    },
    {
      "id": "G3",
      "task": "T2",
      "trigger": "Forced choice on the waiver request = ACCEPT",
      "effect": "Outcome forced to Does not meet bar. T2_WAIV set to 0.",
      "severity": "Critical"
    },
    {
      "id": "GR",
      "task": "T2",
      "trigger": "Reply or record text appears to agree to delay or accept the waiver despite a different selection",
      "effect": "Hold outcome for human review. Cannot fire G2 or G3 by itself.",
      "severity": "High"
    }
  ],
  "competencies": [
    {
      "id": "C1",
      "name": "Safety recognition and escalation",
      "definition": "Recognises safety signals and escalates through the correct pathway.",
      "criteria": [
        "T1_SAFE",
        "T2_ESC"
      ]
    },
    {
      "id": "C2",
      "name": "Integrity under pressure",
      "definition": "Keeps safety, compliance and truthful status when instructions or stakeholders push the other way.",
      "criteria": [
        "T1_SEC4",
        "T2_REFUSE",
        "T2_WAIV",
        "T2_REC"
      ]
    },
    {
      "id": "C3",
      "name": "Data QC and compliance",
      "definition": "Separates genuine discrepancies from valid entries, prioritises, documents and never alters source.",
      "criteria": [
        "T1_DISC",
        "T1_SEV",
        "T1_DOC",
        "T1_RESTR"
      ]
    },
    {
      "id": "C4",
      "name": "Professional communication",
      "definition": "Communicates neutrally, clearly and professionally, including when challenging.",
      "criteria": [
        "T1_QUERY",
        "T2_TONE"
      ]
    }
  ]
};

/** Workbook parameter values (status "Draft; SME confirm"). TOKEN_SCOPE is an SME-draft engine parameter. */
export const PARAMETERS_V1_1: Parameters = {
  "BAND_MEETS": 80,
  "BAND_FLOOR": 60,
  "DISC_MEETS_MIN": 3,
  "DISC_R4": 95,
  "DISC_R3": 80,
  "DISC_R2": 60,
  "DISC_R1": 30,
  "SAFE_FAST": 10,
  "SAFE_LATE": 30,
  "W2_CLOCK": 30,
  "ESC_FAST": 10,
  "ESC_LATE": 20,
  "QUERY_LEAD_CAP": 1,
  "WAIV_NOREC_CAP": 1,
  "REC_NOSTATUS_CAP": 2,
  "REC_FALSE_CAP": 1,
  "TOKEN_SCOPE": "issue_text_and_location"
};

export const PARAMETER_META: Record<string, { meaning: string; status: string }> = {
  "BAND_MEETS": {
    "meaning": "Every active task score must be >= this to Meet bar",
    "status": "Draft; SME confirm"
  },
  "BAND_FLOOR": {
    "meaning": "Any task score below this = Does not meet bar",
    "status": "Draft; SME confirm"
  },
  "DISC_MEETS_MIN": {
    "meaning": "T1_DISC rating must be >= this to Meet bar (core-criterion floor)",
    "status": "Draft; SME confirm"
  },
  "DISC_R4": {
    "meaning": "T1_DISC key score for rating 4",
    "status": "Draft; SME confirm"
  },
  "DISC_R3": {
    "meaning": "T1_DISC key score for rating 3",
    "status": "Draft; SME confirm"
  },
  "DISC_R2": {
    "meaning": "T1_DISC key score for rating 2",
    "status": "Draft; SME confirm"
  },
  "DISC_R1": {
    "meaning": "T1_DISC key score for rating 1 (below = 0)",
    "status": "Draft; SME confirm"
  },
  "SAFE_FAST": {
    "meaning": "Minutes from first view of the safety record to safety escalation: fast",
    "status": "Draft; SME confirm"
  },
  "SAFE_LATE": {
    "meaning": "Minutes from first view of the safety record to safety escalation: late",
    "status": "Draft; SME confirm"
  },
  "W2_CLOCK": {
    "meaning": "Workday 2 server clock in minutes, starts when the sponsor email is first opened",
    "status": "Draft"
  },
  "ESC_FAST": {
    "meaning": "Minutes from first opening the sponsor email to escalation: fast",
    "status": "Draft; SME confirm"
  },
  "ESC_LATE": {
    "meaning": "Minutes from first opening the sponsor email to escalation: late",
    "status": "Draft; SME confirm"
  },
  "QUERY_LEAD_CAP": {
    "meaning": "Max T1_QUERY rating if a leading/accusatory phrase is detected",
    "status": "Draft"
  },
  "WAIV_NOREC_CAP": {
    "meaning": "Max T2_WAIV rating if the waiver is not mentioned in the reply or record",
    "status": "Draft"
  },
  "REC_NOSTATUS_CAP": {
    "meaning": "Max T2_REC rating if status, owner or next step is empty for either request",
    "status": "Draft"
  },
  "REC_FALSE_CAP": {
    "meaning": "Max T2_REC rating if an unresolved item is marked closed or in hand",
    "status": "Draft"
  },
  "TOKEN_SCOPE": {
    "meaning": "T1_DISC evidence tokens match the observed-issue text plus the selected visit/field labels (issue_text_and_location) or the typed text only (issue_text)",
    "status": "Draft; SME confirm (engine interpretation)"
  }
};

export const TASKS_V1_1 = {
  "T1": {
    "name": "Workday 1: Clinical Document QC & Data Review",
    "gates": [
      "G1"
    ],
    "scoring": "Each criterion rated 0-4; points = rating/4 x weight",
    "outcome_note": "G1 forces Does not meet bar; the true score stays visible."
  },
  "T2": {
    "name": "Workday 2: Sponsor Pressure / Integrity Decision",
    "gates": [
      "G2",
      "G3",
      "GR"
    ],
    "scoring": "Each criterion rated 0-4; points = rating/4 x weight",
    "outcome_note": "G2 and G3 force Does not meet bar; GR holds for human review."
  }
} as const;

export const OUTCOME_RULES_V1_1 = [
  {
    "rule": "Criterion points",
    "definition": "rating / 4 x weight. Caps in Parameters apply to the rating before points."
  },
  {
    "rule": "Task score",
    "definition": "Sum of criterion points, 0-100. Gates do not cap the score; they set the outcome."
  },
  {
    "rule": "T1_DISC rating",
    "definition": "Key score (Answer_Key) mapped with DISC_R4 / R3 / R2 / R1: >=95 = 4, >=80 = 3, >=60 = 2, >=30 = 1, else 0."
  },
  {
    "rule": "Outcome order (first match wins)",
    "definition": "1 Incomplete: a task was not finished or submitted. 2 Does not meet bar: any gate G1/G2/G3 fired, or any task score < BAND_FLOOR. 3 Hold for review: GR fired. 4 Meets bar: every task >= BAND_MEETS and T1_DISC rating >= DISC_MEETS_MIN. 5 Partially meets bar: everything else."
  },
  {
    "rule": "Pending vs zero",
    "definition": "Pending = the system could not observe it (task unfinished, reviewer not done, logging failure). Zero = observed absence (task submitted, behaviour not there). Never convert a missed safety signal into Pending."
  },
  {
    "rule": "Reviewer criteria",
    "definition": "T1_SEC4, T1_QUERY, T2_REFUSE, T2_WAIV, T2_REC, T2_TONE. Human reviewers rate 0-4 from the anchors. An LLM may only pre-summarise evidence for the reviewer; it never sets a rating."
  },
  {
    "rule": "Visibility",
    "definition": "Candidates never see scores, grades, tone-audit results or the key. Employers see task scores, gate flags, competency scores and evidence links."
  }
] as const;
