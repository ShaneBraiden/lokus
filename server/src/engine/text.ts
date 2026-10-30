/** Deterministic text helpers used by the auto-caps and context rules. No fuzzy matching, no models. */

export function normalizeText(text: string | null | undefined): string {
  return (text ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function matcher(entry: string): RegExp {
  if (entry.startsWith('re:')) return new RegExp(entry.slice(3), 'g');
  const escaped = normalizeText(entry).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped, 'g');
}

/** True when any token occurs in the text (case-insensitive, NFKC-normalised). */
export function containsAny(text: string, tokens: readonly string[]): boolean {
  const t = normalizeText(text);
  return tokens.some((tok) => matcher(tok).test(t));
}

/** Tokens that occur in the text, in list order. */
export function matchedTokens(text: string, tokens: readonly string[]): string[] {
  const t = normalizeText(text);
  return tokens.filter((tok) => matcher(tok).test(t));
}

const CLAUSE_BREAK = /[.!?;:\n]/;

function words(s: string): string[] {
  return s
    .split(/[\s,]+/)
    .map((w) => w.replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, ''))
    .filter(Boolean);
}

/**
 * Words around a match: up to `before` words before it and `after` words after it within the same clause, plus every
 * word of the comma-delimited segment that leads up to it (used for reported speech, which governs a whole segment).
 */
function clauseWindow(text: string, start: number, end: number, before: number, after: number) {
  const prefix = text.slice(0, start);
  let clauseStart = 0;
  for (let i = prefix.length - 1; i >= 0; i--) {
    if (CLAUSE_BREAK.test(prefix[i])) {
      clauseStart = i + 1;
      break;
    }
  }
  const segmentStart = Math.max(clauseStart, prefix.lastIndexOf(',') + 1);
  const suffix = text.slice(end);
  const breakAt = suffix.search(CLAUSE_BREAK);
  const clauseEnd = breakAt === -1 ? suffix.length : breakAt;
  return {
    before: words(prefix.slice(clauseStart)).slice(-before),
    after: words(suffix.slice(0, clauseEnd)).slice(0, after),
    segment: words(prefix.slice(segmentStart)),
  };
}

export interface PhraseMatch {
  phrase: string;
  index: number;
  /** A negation cue sits in the same clause shortly before or after the phrase. */
  negated: boolean;
  /** A reported-speech cue ("asked", "requested") sits in the same clause before the phrase. */
  attributed: boolean;
}

export interface PhraseGuards {
  negation: readonly string[];
  attribution?: readonly string[];
}

/**
 * Finds every occurrence of every phrase. A match is negated when a negation cue appears among the 6 words before
 * it or the 4 words after it within the same clause ("I cannot agree to delay", "delaying ... is not possible"),
 * and attributed when a reported-speech cue appears earlier in the same comma-delimited segment
 * ("Mr Rao asked us to hold the SAE report until Monday").
 */
export function findPhrases(text: string, phrases: readonly string[], guards: PhraseGuards): PhraseMatch[] {
  const t = normalizeText(text);
  const negation = new Set(guards.negation.map(normalizeText));
  const attribution = new Set((guards.attribution ?? []).map(normalizeText));
  const out: PhraseMatch[] = [];
  for (const phrase of phrases) {
    const re = matcher(phrase);
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) {
      const w = clauseWindow(t, m.index, m.index + m[0].length, 6, 4);
      const negated = [...w.before, ...w.after].some((word) => negation.has(word));
      const attributed = w.segment.some((word) => attribution.has(word));
      out.push({ phrase, index: m.index, negated, attributed });
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  return out.sort((a, b) => a.index - b.index || a.phrase.localeCompare(b.phrase));
}

/** Phrases that matched at least once as the writer's own, un-negated position. */
export function affirmedPhrases(text: string, phrases: readonly string[], guards: PhraseGuards): string[] {
  const hits = findPhrases(text, phrases, guards)
    .filter((m) => !m.negated && !m.attributed)
    .map((m) => m.phrase);
  return [...new Set(hits)];
}
