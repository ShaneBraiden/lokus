import type { ContentBlock } from '@lokus/shared';

/** Renders structured study-document content (paragraphs, lists, tables, notes, coded clauses, signature blocks). */
export function ContentBlocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="flex flex-col gap-3.5">
      {blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}
    </div>
  );
}

function Block({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case 'p':
      return <p className="leading-relaxed">{block.text}</p>;
    case 'list':
      return (
        <ul className="flex list-disc flex-col gap-1.5 pl-5 leading-relaxed marker:text-faint">
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      );
    case 'note':
      return <p className="rounded-md border border-paper-line bg-subtle/60 px-3.5 py-2.5 text-[14px] italic leading-relaxed text-ink-2">{block.text}</p>;
    case 'table':
      return (
        <div className="overflow-x-auto rounded-md border border-paper-line">
          <table className="w-full border-collapse text-left text-[13.5px]">
            <thead className="bg-subtle/70">
              <tr>
                {block.headers.map((h, i) => (
                  <th key={i} scope="col" className="border-b border-paper-line px-3 py-2 font-semibold text-ink">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r} className="align-top">
                  {row.map((cell, c) => (
                    <td key={c} className="border-b border-paper-line px-3 py-2 text-ink-2 last:border-b-0">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'clause':
      return (
        <section className="rounded-md border border-paper-line bg-surface/60 px-4 py-3.5">
          <p className="mb-2 flex flex-wrap items-baseline gap-2">
            <span className="rounded bg-ink px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-white">{block.code}</span>
            <span className="font-semibold text-ink">{block.title}</span>
          </p>
          <ContentBlocks blocks={block.blocks} />
        </section>
      );
    case 'signature':
      return (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {block.lines.map((line, i) => (
            <div key={i} className="border-t border-ink/40 pt-1.5 text-[13px] text-muted">
              {line}
            </div>
          ))}
        </div>
      );
  }
}
