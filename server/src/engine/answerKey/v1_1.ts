/**
 * CONFIDENTIAL — SERVER SIDE ONLY. Answer key for the Lokus CTA rubric v1.1 (workbook Answer_Key_CONFIDENTIAL).
 * GENERATED from fixtures/workbook_v1_1.json. Never import this module from client code; the web build fails if it does.
 */
import type { AnswerKeyRow } from '../types';

export const ANSWER_KEY_V1_1: AnswerKeyRow[] = [
  {
    "participant_id": "AHS-007-DM-206",
    "class": "CLEAN",
    "category": "Clean records",
    "crf_page": 1,
    "crf_visit": "Week 0",
    "crf_field": "Actual visit date",
    "value_as_shown": "05-07-2026 (planned 06-07-2026, -1 day)",
    "expected_reference": null,
    "accepted_types": [],
    "accepted_severities": [],
    "evidence_tokens": [],
    "points": 2,
    "why_correct": "No finding. Week 0 is 1 day before plan, inside the +/-3 window. Later visits are inside their windows (Week 4 +1, Week 8 +2, Week 12 +1).",
    "tolerated_observation": null
  },
  {
    "participant_id": "AHS-007-DM-082",
    "class": "CLEAN",
    "category": "Clean records",
    "crf_page": 2,
    "crf_visit": "Week 12",
    "crf_field": "Actual visit date",
    "value_as_shown": "01-10-2026 (planned 04-10-2026, -3 days)",
    "expected_reference": null,
    "accepted_types": [],
    "accepted_severities": [],
    "evidence_tokens": [],
    "points": 2,
    "why_correct": "No finding. Week 12 window is +/-5 days, so -3 is valid (edge-of-window look-alike). Weight 74 at Week 8 is a small fluctuation, not a protocol issue.",
    "tolerated_observation": null
  },
  {
    "participant_id": "AHS-007-DM-008",
    "class": "FINDING",
    "category": "Visit window",
    "crf_page": 3,
    "crf_visit": "Week 8",
    "crf_field": "Actual visit date",
    "value_as_shown": "29-08-2026 (planned 03-09-2026, -5 days)",
    "expected_reference": "PRO-026-A",
    "accepted_types": [
      "Visit date deviation / window violation"
    ],
    "accepted_severities": [
      "Low",
      "Medium"
    ],
    "evidence_tokens": [
      "week 8",
      "visit 6",
      "wk 8",
      "29-08",
      "29 aug"
    ],
    "points": 15,
    "why_correct": "Week 8 (Visit 6) window is +/-3 days (Days 53-59). Actual is 5 days early, 2 days outside the window.",
    "tolerated_observation": null
  },
  {
    "participant_id": "AHS-007-DM-220",
    "class": "FINDING",
    "category": "Safety",
    "crf_page": 4,
    "crf_visit": "Week 12",
    "crf_field": "Site comments / Adverse events",
    "value_as_shown": "Site comments: 'Patient reported dizziness upon blood collection' while Adverse events = 'None'",
    "expected_reference": "PRO-026-E",
    "accepted_types": [
      "Safety concern / Potential adverse event"
    ],
    "accepted_severities": [
      "High",
      "Critical (Safety / Regulatory)"
    ],
    "evidence_tokens": [
      "dizz",
      "nausea",
      "week 12",
      "visit 7",
      "week 0",
      "visit 1"
    ],
    "points": 26,
    "why_correct": "A symptom is recorded in free-text comments but not on the AE field (PRO-026-E requires AEs on the AE CRF). Week 0 also records nausea after dose. Must be handled as a safety concern, not only a data query.",
    "tolerated_observation": null
  },
  {
    "participant_id": "AHS-007-DM-189",
    "class": "CLEAN",
    "category": "Clean records",
    "crf_page": 5,
    "crf_visit": "Week 0",
    "crf_field": "Actual visit date",
    "value_as_shown": "14-07-2026 (planned 12-07-2026, +2 days)",
    "expected_reference": null,
    "accepted_types": [],
    "accepted_severities": [],
    "evidence_tokens": [],
    "points": 2,
    "why_correct": "No finding. Week 0 is 2 days late, inside the +/-3 window.",
    "tolerated_observation": null
  },
  {
    "participant_id": "AHS-007-DM-284",
    "class": "CLEAN",
    "category": "Clean records",
    "crf_page": 6,
    "crf_visit": "Week 4",
    "crf_field": "Actual visit date",
    "value_as_shown": "06-08-2026 (planned 03-08-2026, +3 days)",
    "expected_reference": null,
    "accepted_types": [],
    "accepted_severities": [],
    "evidence_tokens": [],
    "points": 2,
    "why_correct": "No finding. Week 4 window is +/-3 days, so +3 is exactly on the limit and valid (edge-of-window look-alike).",
    "tolerated_observation": null
  },
  {
    "participant_id": "AHS-007-DM-598",
    "class": "CLEAN",
    "category": "Clean records",
    "crf_page": 7,
    "crf_visit": "Week 0",
    "crf_field": "Actual visit date",
    "value_as_shown": "13-07-2026 (planned 12-07-2026, +1 day)",
    "expected_reference": null,
    "accepted_types": [],
    "accepted_severities": [],
    "evidence_tokens": [],
    "points": 2,
    "why_correct": "No finding. Week 0 is 1 day late, inside the +/-3 window; Week 4 -1 and Week 12 +2 are also inside.",
    "tolerated_observation": null
  },
  {
    "participant_id": "AHS-007-DM-494",
    "class": "FINDING",
    "category": "Missing data",
    "crf_page": 8,
    "crf_visit": "Week 4",
    "crf_field": "Actual visit date",
    "value_as_shown": "(blank) - planned 03-08-2026",
    "expected_reference": "DSU-026-E",
    "accepted_types": [
      "Missing data / Incomplete CRF"
    ],
    "accepted_severities": [
      "Low",
      "Medium"
    ],
    "evidence_tokens": [
      "week 4",
      "visit 4",
      "wk 4",
      "03-08"
    ],
    "points": 15,
    "why_correct": "Required field 'Actual visit date' is blank for Week 4 with no documented explanation.",
    "tolerated_observation": null
  },
  {
    "participant_id": "AHS-007-DM-124",
    "class": "FINDING",
    "category": "Dosing",
    "crf_page": 9,
    "crf_visit": "Week 0",
    "crf_field": "Dose received",
    "value_as_shown": "50 ug (all other visits: 50 mg)",
    "expected_reference": "PRO-026-B",
    "accepted_types": [
      "Dosing / Treatment mismatch",
      "Data recording unit inconsistency"
    ],
    "accepted_severities": [
      "Medium",
      "High"
    ],
    "evidence_tokens": [
      "50 ug",
      "50ug",
      "µg",
      "μg",
      "microgram",
      "mcg",
      "week 0",
      "visit 1"
    ],
    "points": 15,
    "why_correct": "Protocol dose is exactly 50 mg once daily; entries in micrograms are erroneous and require clarification. Dose entered as 50 ug at Week 0 against 50 mg elsewhere.",
    "tolerated_observation": "Week 12 blood glucose 'HS 5)' is illegible; flagging it as a data-entry or measurement issue is tolerated."
  },
  {
    "participant_id": "AHS-007-DM-022",
    "class": "CLEAN",
    "category": "Clean records",
    "crf_page": 10,
    "crf_visit": "Week 0",
    "crf_field": "Actual visit date",
    "value_as_shown": "10-07-2026 (planned 09-07-2026, +1 day)",
    "expected_reference": null,
    "accepted_types": [],
    "accepted_severities": [],
    "evidence_tokens": [],
    "points": 2,
    "why_correct": "No finding. Week 0 is 1 day late, inside the +/-3 window. Weight 79 at Week 8 is a small fluctuation.",
    "tolerated_observation": null
  },
  {
    "participant_id": "AHS-007-DM-180",
    "class": "FINDING",
    "category": "Visit window",
    "crf_page": 11,
    "crf_visit": "Week 0",
    "crf_field": "Actual visit date",
    "value_as_shown": "14-07-2026 (planned 09-07-2026, +5 days)",
    "expected_reference": "PRO-026-A",
    "accepted_types": [
      "Visit date deviation / window violation"
    ],
    "accepted_severities": [
      "Low",
      "Medium"
    ],
    "evidence_tokens": [
      "week 0",
      "visit 1",
      "wk 0",
      "14-07",
      "14 jul"
    ],
    "points": 15,
    "why_correct": "Week 0 is 5 days after plan, outside the +/-3 window. BP 155/96 is below the PRO-026-E thresholds (>160 / >100): a distractor, not a finding.",
    "tolerated_observation": null
  },
  {
    "participant_id": "AHS-007-DM-384",
    "class": "CLEAN",
    "category": "Clean records",
    "crf_page": 12,
    "crf_visit": "Week 12",
    "crf_field": "Actual visit date",
    "value_as_shown": "05-10-2026 (planned 04-10-2026, +1 day)",
    "expected_reference": null,
    "accepted_types": [],
    "accepted_severities": [],
    "evidence_tokens": [],
    "points": 2,
    "why_correct": "No finding. All visits inside their windows. Weight 71 at Week 8 is a small fluctuation.",
    "tolerated_observation": null
  }
];

export const ANSWER_KEY_SCORING_NOTE = "Finding = points when found with an accepted type. Clean record = 2 points when left alone, 0 when flagged. Key score = total earned (0-100) -> T1_DISC rating via DISC_R4/R3/R2/R1. Evidence tokens are matched case-insensitively against the candidate Observed issue text; any one token is enough. Week windows: Week 0 +/-3, Week 4 +/-3, Week 8 +/-3, Week 12 +/-5 (Week 0 revised from -7 to 0).";
