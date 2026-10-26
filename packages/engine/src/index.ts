/**
 * @lokus/engine — SERVER-ONLY deterministic scoring engine for the Lokus CTA rubric v1.1.
 * No LLM or randomness in the scoring path. The web build refuses to import this package.
 */
export * from './types';
export { calculateAssessment, decideOutcome, inputDigest, type CalculateInput, type OutcomeDecision } from './calculate';
export { activeFindings, authoredT2Text, buildEvidence, orderEvents, positionT2Text, cellKeyString } from './evidence';
export type { CellKey, Evidence, FindingSnapshot, FindingState, FindingTarget, T1Evidence, T2Evidence } from './evidence';
export { discKeyScore, isCredited, keyedFindings, severityRank } from './criteria';
export { ev, type EventDraft } from './events';
export { ENGINE_VERSION, IDENTIFIERS_V1_1, defaultScoringPackage, packageDigest } from './package';
export { RUBRIC_V1_1, PARAMETERS_V1_1, PARAMETER_META, TASKS_V1_1, OUTCOME_RULES_V1_1 } from './rubric/v1_1';
export { ANSWER_KEY_V1_1, ANSWER_KEY_SCORING_NOTE } from './answerKey/v1_1';
export { PHRASES_V1_1 } from './phrases/v1_1';
export { ScenarioBuilder, actionToDrafts, type FindingInput, type ScenarioAction, type ScenarioResult, type TimedAction } from './scenario';
export { PERSONAS, scriptWorkday1, scriptWorkday2, type Persona, type PersonaExpectation, type T1Script, type T2Script } from './personas';
export { canonicalJson, sha256Hex } from './digest';
export { normalizeText, containsAny, matchedTokens, findPhrases, affirmedPhrases } from './text';
