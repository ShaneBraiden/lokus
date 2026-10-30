import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ANSWER_KEY_SCORING_NOTE, ANSWER_KEY_V1_1, PARAMETERS_V1_1, PHRASES_V1_1, RUBRIC_V1_1 } from '#engine';
import { DOCUMENTS, WORKDAY1_BRIEFING, WORKDAY2_INBOX, type Block } from '#content';
import * as shared from '@lokus/shared';

/**
 * Bundle canary (plan: "build, then grep dist/ for canary strings"). Builds the web app and fails if anything
 * server-only reaches the browser: answer key, phrase lists, rubric anchors and parameter names (scoring), or the
 * text of study documents and observed emails (which must only arrive through server-observed requests).
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const webDir = path.join(repoRoot, 'client');
let outDir = '';
let bundle = '';

/** Client-safe vocabulary (finding types, field labels, directory...) is public by definition, so never a leak. */
const PUBLIC_VOCAB = JSON.stringify(Object.values(shared).filter((v) => typeof v !== 'function')).toLowerCase();

/** Third-party text that happens to contain a canary phrase, identified by its surrounding message. */
const THIRD_PARTY = [{ text: 'please update to', context: 'contains an invalid URL which will probably break when clicked' }];

/** Distinctive, ASCII-only strings that survive minification unchanged inside string literals. */
const usable = (s: string | null | undefined, min: number): s is string =>
  typeof s === 'string' && s.length >= min && /^[\x20-\x7e]+$/.test(s) && !/["'`\\]/.test(s) && !PUBLIC_VOCAB.includes(s.toLowerCase());

function leaksIn(bundle: string, text: string): boolean {
  for (let i = bundle.indexOf(text); i >= 0; i = bundle.indexOf(text, i + 1)) {
    const window = bundle.slice(Math.max(0, i - 160), i + text.length + 160);
    if (!THIRD_PARTY.some((t) => t.text === text && window.includes(t.context))) return true;
  }
  return false;
}

function blockTexts(blocks: Block[]): string[] {
  return blocks.flatMap((b) => {
    switch (b.type) {
      case 'p':
      case 'note':
        return [b.text];
      case 'list':
        return b.items;
      case 'table':
        return b.rows.flat();
      case 'clause':
        return [b.title, ...blockTexts(b.blocks)];
      case 'signature':
        return [];
    }
  });
}

function canaries(): { source: string; text: string }[] {
  const out: { source: string; text: string }[] = [];
  const add = (source: string, text: string | null | undefined, min: number) => {
    if (usable(text, min)) out.push({ source, text });
  };
  for (const row of ANSWER_KEY_V1_1) {
    add(`answer key ${row.participant_id} why_correct`, row.why_correct, 24);
    add(`answer key ${row.participant_id} value_as_shown`, row.value_as_shown, 16);
    add(`answer key ${row.participant_id} tolerated_observation`, row.tolerated_observation, 24);
  }
  add('answer key scoring note', ANSWER_KEY_SCORING_NOTE, 24);
  for (const [list, phrases] of Object.entries(PHRASES_V1_1)) {
    for (const p of phrases as string[]) if (p.includes(' ') && !p.startsWith('re:')) add(`phrase list ${list}`, p, 10);
  }
  for (const c of RUBRIC_V1_1.criteria) {
    for (const [rating, anchor] of Object.entries(c.anchors)) add(`rubric ${c.id} anchor ${rating}`, anchor, 24);
    add(`rubric ${c.id} what_to_observe`, c.what_to_observe, 24);
    add(`rubric ${c.id} notes`, c.notes, 24);
  }
  for (const name of Object.keys(PARAMETERS_V1_1)) if (name.includes('_')) add('parameter name', name, 7);
  for (const doc of Object.values(DOCUMENTS)) for (const s of doc.sections) for (const t of blockTexts(s.blocks)) add(`document ${doc.id} section ${s.id}`, t, 40);
  for (const m of [WORKDAY1_BRIEFING, ...WORKDAY2_INBOX]) for (const p of m.body) add(`email ${m.id}`, p.replaceAll('{candidateFirstName}', ''), 40);
  return out;
}

function readTree(dir: string): string {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .map((e) => (e.isDirectory() ? readTree(path.join(dir, e.name)) : /\.(js|css|html|json|map|txt)$/.test(e.name) ? fs.readFileSync(path.join(dir, e.name), 'utf8') : ''))
    .join('\n');
}

describe('web bundle canary', () => {
  beforeAll(() => {
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lokus-web-canary-'));
    const vite = path.join(repoRoot, 'node_modules/vite/bin/vite.js');
    // Vitest sets NODE_ENV=test; the child must build exactly what production ships.
    execFileSync(process.execPath, [vite, 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'], { cwd: webDir, stdio: 'pipe', env: { ...process.env, NODE_ENV: 'production' } });
    bundle = readTree(outDir);
  }, 180_000);

  afterAll(() => {
    if (outDir) fs.rmSync(outDir, { recursive: true, force: true });
  });

  it('has a meaningful canary list and a real bundle to scan', () => {
    const list = canaries();
    expect(list.length).toBeGreaterThan(150);
    expect(bundle.length).toBeGreaterThan(100_000);
    // The scan itself works: the same canaries are found in the server-only sources they come from.
    const engineSource = fs.readFileSync(path.join(repoRoot, 'server/src/engine/phrases/v1_1.ts'), 'utf8');
    expect(list.filter((c) => c.source.startsWith('phrase list')).every((c) => engineSource.includes(c.text))).toBe(true);
  });

  it('contains no answer key, phrase list, rubric, parameter, document or observed-email text', () => {
    const leaks = canaries().filter((c) => leaksIn(bundle, c.text));
    expect(leaks.map((l) => `${l.source}: ${l.text.slice(0, 80)}`)).toEqual([]);
  });

  it('ships no source maps', () => {
    expect(fs.readdirSync(path.join(outDir, 'assets')).filter((f) => f.endsWith('.map'))).toEqual([]);
  });
});
