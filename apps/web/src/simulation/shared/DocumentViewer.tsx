import { ChevronLeft, ChevronRight, FilePen, FileText } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { DocumentSummaryDTO } from '@lokus/shared';
import { errorMessage } from '@/lib/api';
import { Alert, Button, Sheet, Spinner, cn } from '@/ui';
import { useDocuments, useSection } from '../api';
import { usePlayer } from '../PlayerContext';
import { ContentBlocks } from './ContentBlocks';

export interface DocLocation {
  documentId: string;
  sectionId: string | null;
}

function sectionLabel(s: { number?: string; title: string }) {
  return s.number ? `${s.number}  ${s.title}` : s.title;
}

/** "2.1" → "v2.1"; identifiers such as "SOP-QA-014 v4" are shown as they are. */
const versionLabel = (v: string) => (/^\d/.test(v) ? `v${v}` : v);

function Cover({ doc, onOpen }: { doc: DocumentSummaryDTO; onOpen: (sectionId: string) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{doc.short_title}</p>
        <h2 className="mt-1 font-serif text-[26px] leading-snug text-ink">{doc.title}</h2>
        {doc.subtitle && <p className="mt-1 text-sm text-ink-2">{doc.subtitle}</p>}
      </div>
      <dl className="grid gap-x-6 gap-y-2.5 rounded-md border border-paper-line bg-surface/70 p-4 text-[13px] sm:grid-cols-2">
        {[{ label: 'Version', value: doc.version }, { label: 'Status', value: doc.status }, { label: 'Owner', value: doc.owner }, ...doc.header].map((h) => (
          <div key={h.label} className="flex gap-2">
            <dt className="w-28 shrink-0 text-muted">{h.label}</dt>
            <dd className="font-medium text-ink">{h.value}</dd>
          </div>
        ))}
      </dl>
      <div>
        <p className="mb-2 text-[13px] font-semibold text-ink">Contents</p>
        <ol className="flex flex-col divide-y divide-paper-line rounded-md border border-paper-line bg-surface/70">
          {doc.sections.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => onOpen(s.id)} className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm text-ink hover:bg-subtle">
                <span>
                  {s.number && <span className="mr-2 tabular text-muted">{s.number}</span>}
                  {s.title}
                </span>
                <ChevronRight className="size-4 shrink-0 text-faint" />
              </button>
            </li>
          ))}
        </ol>
      </div>
      {doc.footer && <p className="border-t border-paper-line pt-3 text-xs text-muted">{doc.footer}</p>}
    </div>
  );
}

function SectionView({ doc, sectionId, onNavigate, onLogFinding }: { doc: DocumentSummaryDTO; sectionId: string; onNavigate: (id: string | null) => void; onLogFinding?: (loc: { documentId: string; sectionId: string }) => void }) {
  const { attemptId } = usePlayer();
  const section = useSection(attemptId, doc.id, sectionId);
  const index = doc.sections.findIndex((s) => s.id === sectionId);
  const prev = index > 0 ? doc.sections[index - 1] : null;
  const next = index >= 0 && index < doc.sections.length - 1 ? doc.sections[index + 1] : null;
  const meta = doc.sections[index];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button type="button" onClick={() => onNavigate(null)} className="text-xs font-semibold uppercase tracking-wider text-muted hover:text-ink">
            {doc.short_title} · {versionLabel(doc.version)}
          </button>
          <h2 className="mt-1 font-serif text-[24px] leading-snug text-ink">{meta ? sectionLabel(meta) : 'Section'}</h2>
        </div>
        {onLogFinding && (
          <Button variant="secondary" size="sm" onClick={() => onLogFinding({ documentId: doc.id, sectionId })}>
            <FilePen /> Log finding on this section
          </Button>
        )}
      </div>
      {section.isLoading && <Spinner label="Opening section" />}
      {section.error && <Alert tone="danger">{errorMessage(section.error)}</Alert>}
      {section.data && (
        <div className="text-[15px] text-ink">
          <ContentBlocks blocks={section.data.blocks} />
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-3 border-t border-paper-line pt-4">
        {prev ? (
          <Button variant="ghost" size="sm" onClick={() => onNavigate(prev.id)}>
            <ChevronLeft /> {sectionLabel(prev)}
          </Button>
        ) : (
          <span />
        )}
        {next && (
          <Button variant="ghost" size="sm" onClick={() => onNavigate(next.id)}>
            {sectionLabel(next)} <ChevronRight />
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Study documents (protocol extract, informed consent form, data dictionary, consent SOP). Each section is fetched
 * from the server when opened, which records the open; nothing is prefetched.
 */
export function DocumentViewer({
  open,
  onOpenChange,
  onLogFinding,
  location,
  onLocationChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogFinding?: (loc: { documentId: string; sectionId: string }) => void;
  location: DocLocation | null;
  onLocationChange: (loc: DocLocation) => void;
}) {
  const { attemptId } = usePlayer();
  const docs = useDocuments(attemptId);
  const list = docs.data ?? [];
  const current = list.find((d) => d.id === location?.documentId) ?? list[0];
  const sectionId = current && location?.documentId === current.id ? location.sectionId : null;
  const reading = useRef<HTMLDivElement>(null);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    reading.current?.scrollTo({ top: 0 });
  }, [current?.id, sectionId]);

  const go = (documentId: string, section: string | null) => {
    onLocationChange({ documentId, sectionId: section });
    setNavOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Study documents" description="AHS-DM-026 controlled documents" width="max-w-5xl" bodyClassName="flex flex-col overflow-hidden p-0">
      {docs.isLoading && <Spinner className="p-5" />}
      {docs.error && (
        <div className="p-5">
          <Alert tone="danger">{errorMessage(docs.error)}</Alert>
        </div>
      )}
      {current && (
        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[230px_minmax(0,1fr)] md:grid-rows-1">
          <nav aria-label="Documents" className={cn('min-h-0 overflow-y-auto border-b border-line bg-subtle/60 p-3 md:block md:border-b-0 md:border-r', navOpen ? 'block' : 'hidden')}>
            {list.map((d) => (
              <div key={d.id} className="mb-2">
                <button
                  type="button"
                  onClick={() => go(d.id, null)}
                  className={cn('flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left text-sm', d.id === current.id ? 'bg-surface font-semibold text-ink shadow-card' : 'text-ink-2 hover:bg-surface/70')}
                >
                  <FileText className="mt-0.5 size-4 shrink-0 text-muted" />
                  <span>
                    {d.short_title}
                    <span className="block text-xs font-normal text-muted">{versionLabel(d.version)}</span>
                  </span>
                </button>
                {d.id === current.id && (
                  <ol className="mt-1 flex flex-col border-l border-line-strong pl-2 ml-4">
                    {d.sections.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => go(d.id, s.id)}
                          className={cn('w-full rounded px-2 py-1 text-left text-[13px]', s.id === sectionId ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:text-ink')}
                        >
                          {sectionLabel(s)}
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </nav>
          <div ref={reading} className="min-h-0 overflow-y-auto bg-canvas p-4 sm:p-6">
            <button type="button" onClick={() => setNavOpen((o) => !o)} className="mb-3 text-sm font-medium text-accent md:hidden">
              {navOpen ? 'Hide contents' : 'Documents and contents'}
            </button>
            <div className="mx-auto max-w-3xl rounded-lg border border-paper-line bg-paper px-5 py-6 shadow-card sm:px-8 sm:py-8">
              {sectionId ? <SectionView doc={current} sectionId={sectionId} onNavigate={(id) => go(current.id, id)} onLogFinding={onLogFinding} /> : <Cover doc={current} onOpen={(id) => go(current.id, id)} />}
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}
