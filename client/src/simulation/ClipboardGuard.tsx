import { useEffect } from 'react';
import type { LockdownViolationKind } from '@lokus/shared';

type Field = HTMLInputElement | HTMLTextAreaElement;
const TEXT_INPUTS = new Set(['text', 'search', 'email', 'url', 'tel', 'password']);
const isField = (t: EventTarget | null): t is Field => t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && TEXT_INPUTS.has(t.type));

/**
 * The last value each field got from the app or from the candidate's own typing. Extensions run in an isolated world
 * with their own prototypes, so a value they write never passes through the setters patched here and shows up as a
 * mismatch.
 */
const known = new WeakMap<Field, string>();
const PATCHED = Symbol.for('lokus.fieldSetters');
const protos = [HTMLInputElement.prototype, HTMLTextAreaElement.prototype] as const;
if (!(PATCHED in HTMLInputElement.prototype)) {
  for (const proto of protos) {
    Object.defineProperty(proto, PATCHED, { value: true });
    for (const prop of ['value', 'defaultValue'] as const) {
      const d = Object.getOwnPropertyDescriptor(proto, prop);
      if (!d?.set) continue;
      const set = d.set;
      Object.defineProperty(proto, prop, {
        ...d,
        set(this: Field, v: string) {
          set.call(this, v);
          known.set(this, this.value);
        },
      });
    }
  }
}

const expected = (el: Field) => known.get(el) ?? el.defaultValue;
const restore = (el: Field) => {
  el.value = expected(el);
  const end = el.value.length;
  try {
    el.setSelectionRange(end, end);
  } catch {
    // Not every input type has a caret.
  }
};

/** Keyboard clipboard combos. */
function clipboardShortcut(e: KeyboardEvent): string | null {
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  const name = e.metaKey ? 'Cmd' : 'Ctrl';
  if (mod && !e.altKey && ['c', 'v', 'x'].includes(key)) return `${name}${e.shiftKey ? '+Shift' : ''}+${key.toUpperCase()}`;
  if (e.shiftKey && key === 'insert') return 'Shift+Insert';
  if (mod && key === 'insert') return 'Ctrl+Insert';
  return null;
}

/** More single-key insertions than this in a second is an auto-typer, not a person. Held-down keys are exempt. */
const BURST_LIMIT = 25;
/** Longest text a single real keystroke inserts (emoji and dead-key sequences included), in code points. */
const KEYSTROKE_MAX = 4;
const codePoints = (s: string | null) => (s ? [...s].length : 0);

/**
 * No copying out of or pasting into a workday, including through browser extensions. Clipboard events, shortcuts,
 * right-click and drag and drop are blocked; text that reaches a field any way other than the candidate typing it
 * (a script or extension setting the value, a synthetic or one-shot insertion, an auto-typer) is reverted.
 */
export function useClipboardGuard(onBlocked: (kind: LockdownViolationKind, detail?: string) => void) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('clipboard-locked');
    let repeating = false;
    const inserts: number[] = [];

    const stop = (kind: LockdownViolationKind) => (e: Event) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      onBlocked(kind);
    };
    const onCopy = stop('copy');
    const onCut = stop('cut');
    const onPaste = stop('paste');
    const onContext = stop('context_menu');
    const onDrop = stop('drop');
    const onDragStart = (e: DragEvent) => e.preventDefault();
    const onKey = (e: KeyboardEvent) => {
      repeating = e.repeat;
      const combo = clipboardShortcut(e);
      if (!combo) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onBlocked('shortcut', combo);
    };

    const reject = (el: Field, e: Event, detail: string) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      restore(el);
      onBlocked('injected_text', detail);
    };

    const onBeforeInput = (e: Event) => {
      const ie = e as InputEvent;
      if (/^insertFrom(Paste|Drop|Yank)/.test(ie.inputType)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        onBlocked(ie.inputType.includes('Drop') ? 'drop' : 'paste');
      }
    };

    const onInput = (e: Event) => {
      const el = e.target;
      if (!isField(el)) return;
      if (!e.isTrusted) return reject(el, e, 'Text set by a script or extension');
      const ie = e as InputEvent;
      const type = ie.inputType ?? '';
      const grown = el.value.length - expected(el).length;
      let allowed: number;
      if (type.startsWith('delete') || type.startsWith('history')) allowed = Infinity;
      else if (type === 'insertCompositionText') allowed = ie.data?.length ?? 0;
      else if (type === 'insertReplacementText') allowed = 40;
      else if (type === 'insertLineBreak' || type === 'insertParagraph') allowed = 1;
      else if (type === 'insertText') {
        if (!ie.isComposing && codePoints(ie.data) > KEYSTROKE_MAX) return reject(el, e, 'Text inserted in one go');
        allowed = Math.max(ie.data?.length ?? 0, 1);
        const now = performance.now();
        if (!repeating) inserts.push(now);
        while (inserts.length && now - inserts[0] > 1000) inserts.shift();
        if (inserts.length > BURST_LIMIT) return reject(el, e, 'Typing faster than a person can');
      } else allowed = 1;
      if (grown > allowed) return reject(el, e, 'Text set by a script or extension');
      known.set(el, el.value);
    };

    // A native form reset puts fields back to their defaults without the setters.
    const onReset = (e: Event) => {
      const form = e.target;
      if (form instanceof HTMLFormElement)
        queueMicrotask(() => {
          for (const el of form.elements) if (isField(el)) known.set(el, el.value);
        });
    };

    // Values written with no event at all are caught here, before the app can read them on save or submit.
    const scan = () => {
      for (const el of document.querySelectorAll('input, textarea')) if (isField(el) && el.value !== expected(el)) {
        restore(el);
        onBlocked('injected_text', 'Text set by a script or extension');
      }
    };
    const poll = window.setInterval(scan, 300);
    const onFocusOut = (e: FocusEvent) => {
      if (isField(e.target) && e.target.value !== expected(e.target)) scan();
    };

    const listeners: [EventTarget, string, EventListener][] = [
      [document, 'copy', onCopy],
      [document, 'cut', onCut],
      [document, 'paste', onPaste],
      [document, 'contextmenu', onContext],
      [document, 'drop', onDrop],
      [document, 'dragstart', onDragStart as EventListener],
      [window, 'keydown', onKey as EventListener],
      [window, 'beforeinput', onBeforeInput],
      [window, 'input', onInput],
      [document, 'reset', onReset],
      [document, 'focusout', onFocusOut as EventListener],
    ];
    for (const [t, type, fn] of listeners) t.addEventListener(type, fn, true);
    return () => {
      root.classList.remove('clipboard-locked');
      window.clearInterval(poll);
      for (const [t, type, fn] of listeners) t.removeEventListener(type, fn, true);
    };
  }, [onBlocked]);
}

export function blockedNotice(kind: LockdownViolationKind, detail = '') {
  if (kind === 'shortcut') return `${detail} is disabled during this assessment.`;
  if (kind === 'injected_text') return 'Only text you type yourself can go into the assessment.';
  if (kind === 'copy' || kind === 'cut' || kind === 'paste') return 'Copy and paste are disabled during this assessment.';
  return 'That action is disabled during this assessment.';
}
