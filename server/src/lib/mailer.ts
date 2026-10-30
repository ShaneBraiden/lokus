import type { Logger } from 'pino';
import { Resend } from 'resend';

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  template: string;
}

export interface Mailer {
  readonly kind: 'memory' | 'console' | 'resend';
  send(message: OutgoingEmail): Promise<{ id: string | null }>;
}

/** Test mailer: keeps messages in memory so tests can follow verification, reset and invite links. */
export class MemoryMailer implements Mailer {
  readonly kind = 'memory' as const;
  readonly sent: OutgoingEmail[] = [];
  async send(message: OutgoingEmail) {
    this.sent.push(message);
    return { id: `mem-${this.sent.length}` };
  }
  lastTo(to: string): OutgoingEmail | undefined {
    return [...this.sent].reverse().find((m) => m.to === to.toLowerCase());
  }
  /** Extracts the first link containing `marker` from the latest email to `to`. */
  linkTo(to: string, marker: string): string {
    const mail = this.lastTo(to);
    const link = mail?.text.match(/https?:\/\/\S+/g)?.find((l) => l.includes(marker));
    if (!link) throw new Error(`no ${marker} link emailed to ${to}`);
    return link;
  }
  tokenFrom(to: string, marker: string): string {
    return new URL(this.linkTo(to, marker)).searchParams.get('token') ?? '';
  }
}

/** Development mailer: prints messages (including links) to the server log instead of sending them. */
export class ConsoleMailer implements Mailer {
  readonly kind = 'console' as const;
  constructor(private readonly log: Logger) {}
  async send(message: OutgoingEmail) {
    this.log.info({ to: message.to, subject: message.subject }, `\n──── email (not sent: development) ────\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n────────────────────────────────────────`);
    return { id: null };
  }
}

export class ResendMailer implements Mailer {
  readonly kind = 'resend' as const;
  private readonly client: Resend;
  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    this.client = new Resend(apiKey);
  }
  async send(message: OutgoingEmail) {
    const { data, error } = await this.client.emails.send({ from: this.from, to: message.to, subject: message.subject, text: message.text, html: message.html });
    if (error) throw new Error(`Resend: ${error.message}`);
    return { id: data?.id ?? null };
  }
}
