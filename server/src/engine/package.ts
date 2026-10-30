import { ANSWER_KEY_V1_1 } from './answerKey/v1_1';
import { canonicalJson, sha256Hex } from './digest';
import { PHRASES_V1_1 } from './phrases/v1_1';
import { PARAMETERS_V1_1, RUBRIC_V1_1 } from './rubric/v1_1';
import type { ScoringPackage } from './types';

export const ENGINE_VERSION = '1.1.0';

/** Identifiers shared with @lokus/content; asserted equal by the API's integration tests. */
export const IDENTIFIERS_V1_1: ScoringPackage['identifiers'] = {
  safety_participant_id: 'AHS-007-DM-220',
  sponsor_email_id: 'w2-sponsor',
  manager_directory_id: 'anjali',
  icf_document_id: 'icf',
  icf_challenge_section_id: '4',
  safety_finding_type: 'Safety concern / Potential adverse event',
};

/** The v1.1 package with the workbook parameters and SME-draft phrase lists. */
export function defaultScoringPackage(): ScoringPackage {
  return structuredClone({
    id: 'v1.1-sme-draft-1',
    label: 'Rubric v1.1 · SME draft 1',
    engine_version: ENGINE_VERSION,
    rubric: RUBRIC_V1_1,
    parameters: PARAMETERS_V1_1,
    phrase_lists: PHRASES_V1_1,
    answer_key: ANSWER_KEY_V1_1,
    identifiers: IDENTIFIERS_V1_1,
  });
}

/** Content hash of everything that affects scoring (id and label excluded). */
export function packageDigest(pkg: ScoringPackage): string {
  const { id: _id, label: _label, ...scoring } = pkg;
  return sha256Hex(canonicalJson(scoring));
}
