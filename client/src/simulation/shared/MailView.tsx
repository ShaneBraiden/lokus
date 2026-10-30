import type { ReactNode } from 'react';
import type { MailMessageDTO } from '@lokus/shared';
import { Avatar, cn } from '@/ui';

/** One email, rendered like a mail client's reading pane. */
export function MailView({ message, className, footer }: { message: MailMessageDTO; className?: string; footer?: ReactNode }) {
  const { from } = message;
  return (
    <article className={cn('flex flex-col', className)}>
      <h2 className="text-xl font-semibold leading-snug tracking-tight text-ink">{message.subject}</h2>
      <div className="mt-4 flex items-start gap-3 border-b border-line pb-4">
        <Avatar name={from.name} />
        <div className="min-w-0 flex-1 text-sm">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold text-ink">{from.name}</span>
            <span className="text-muted">&lt;{from.email}&gt;</span>
          </p>
          <p className="text-[13px] text-muted">
            {from.role} · {from.organisation}
          </p>
          <p className="mt-1.5 text-[13px] text-muted">
            <span className="font-medium text-ink-2">To</span> {message.to.join(', ')}
            {message.cc.length > 0 && (
              <>
                <span className="ml-3 font-medium text-ink-2">Cc</span> {message.cc.join(', ')}
              </>
            )}
          </p>
        </div>
        <p className="shrink-0 text-[13px] text-muted">{message.sent_at}</p>
      </div>
      <div className="flex flex-col gap-3.5 py-5 text-[15px] leading-relaxed text-ink">
        {message.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {message.signature.length > 0 && (
          <p className="text-ink-2">
            {message.signature.map((line, i) => (
              <span key={i} className={cn('block', i === 0 && 'font-medium text-ink')}>
                {line}
              </span>
            ))}
          </p>
        )}
      </div>
      {footer}
    </article>
  );
}
