import type { DocumentId } from '@lokus/shared';
import type { Block, DocumentSection, ReferenceCode, StudyDocument } from '../types';
import { CONSENT_SOP } from './consentSop';
import { DICTIONARY } from './dictionary';
import { ICF } from './icf';
import { PROTOCOL } from './protocol';

export const DOCUMENTS: Record<DocumentId, StudyDocument> = {
  protocol: PROTOCOL,
  icf: ICF,
  dictionary: DICTIONARY,
  'consent-sop': CONSENT_SOP,
};

export const DOCUMENT_ORDER: DocumentId[] = ['protocol', 'icf', 'dictionary', 'consent-sop'];

export function getDocument(id: string): StudyDocument | undefined {
  return (DOCUMENTS as Record<string, StudyDocument>)[id];
}

export function getSection(documentId: string, sectionId: string): DocumentSection | undefined {
  return getDocument(documentId)?.sections.find((s) => s.id === sectionId);
}

/** Table of contents without section bodies: opening a section is a separate, server-observed request. */
export function tableOfContents(doc: StudyDocument) {
  return {
    id: doc.id,
    title: doc.title,
    shortTitle: doc.shortTitle,
    subtitle: doc.subtitle,
    version: doc.version,
    status: doc.status,
    owner: doc.owner,
    header: doc.header,
    footer: doc.footer,
    sections: doc.sections.map((s) => ({ id: s.id, number: s.number, title: s.title })),
  };
}

function collectClauses(blocks: Block[], documentId: DocumentId, sectionId: string, out: ReferenceCode[]) {
  for (const b of blocks) {
    if (b.type === 'clause') {
      out.push({ code: b.code, title: b.title, documentId, sectionId });
      collectClauses(b.blocks, documentId, sectionId, out);
    }
  }
}

/** Reference-code catalogue for the finding form, derived from the clauses embedded in the documents. */
export const REFERENCE_CODES: readonly ReferenceCode[] = (() => {
  const out: ReferenceCode[] = [];
  for (const id of DOCUMENT_ORDER) {
    for (const s of DOCUMENTS[id].sections) collectClauses(s.blocks, id, s.id, out);
  }
  return out.sort((a, b) => a.code.localeCompare(b.code));
})();

export { CONSENT_SOP, DICTIONARY, ICF, PROTOCOL };
