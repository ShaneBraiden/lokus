import type { AppDeps } from '../context';
import { emailOutbox } from '../db/schema';

export interface RenderedEmail {
  template: string;
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

function render(template: string, subject: string, greeting: string, paragraphs: string[], cta?: { label: string; url: string }, footnote?: string): RenderedEmail {
  const text = [greeting, '', ...paragraphs.flatMap((p) => [p, '']), ...(cta ? [`${cta.label}: ${cta.url}`, ''] : []), footnote ?? '', '— Lokus'].join('\n').trim();
  const html = `<!doctype html><html><body style="margin:0;background:#FAFAF9;font-family:'Plus Jakarta Sans',Segoe UI,Arial,sans-serif;color:#1C2430">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E7E5E4;border-radius:12px">
<tr><td style="padding:28px 32px 8px;font-size:18px;font-weight:700;letter-spacing:-0.01em">Lokus</td></tr>
<tr><td style="padding:8px 32px 0;font-size:15px;line-height:1.6">
<p style="margin:0 0 16px">${escapeHtml(greeting)}</p>
${paragraphs.map((p) => `<p style="margin:0 0 16px">${escapeHtml(p)}</p>`).join('\n')}
${cta ? `<p style="margin:24px 0"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#A04E35;color:#FFFFFF;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px">${escapeHtml(cta.label)}</a></p><p style="margin:0 0 16px;font-size:13px;color:#57534E">Or paste this link into your browser:<br><span style="word-break:break-all">${escapeHtml(cta.url)}</span></p>` : ''}
${footnote ? `<p style="margin:0 0 16px;font-size:13px;color:#57534E">${escapeHtml(footnote)}</p>` : ''}
</td></tr>
<tr><td style="padding:16px 32px 28px;font-size:12px;color:#57534E;border-top:1px solid #E7E5E4">Lokus · Work-simulation assessments</td></tr>
</table></td></tr></table></body></html>`;
  return { template, subject, text, html };
}

export const emails = {
  verifyEmail: (name: string, url: string) =>
    render('verify_email', 'Confirm your email address', `Hi ${name},`, ['Please confirm the email address for your Lokus account.'], { label: 'Confirm email address', url }, 'This link expires in 48 hours. If you did not create an account, you can ignore this email.'),
  resetPassword: (name: string, url: string) =>
    render('reset_password', 'Reset your Lokus password', `Hi ${name},`, ['We received a request to reset the password for your Lokus account.'], { label: 'Choose a new password', url }, 'This link expires in 1 hour. If you did not ask for a reset, you can ignore this email; your password stays the same.'),
  setPassword: (name: string, url: string) =>
    render('set_password', 'Your Lokus staff account', `Hi ${name},`, ['A Lokus staff account has been created for you. Choose a password to activate it. You will then set up an authenticator app for two-step sign-in.'], { label: 'Set your password', url }, 'This link expires in 48 hours.'),
  candidateInvite: (p: { candidateName: string; orgName: string; simulationTitle: string; url: string; deadline: string | null }) =>
    render(
      'candidate_invite',
      `${p.orgName} has invited you to a work simulation`,
      `Hi ${p.candidateName || 'there'},`,
      [
        `${p.orgName} has invited you to complete ${p.simulationTitle} on Lokus. It is a realistic two-workday simulation of a Clinical Trial Associate role, taken online at your own pace.`,
        p.deadline ? `Please complete it by ${p.deadline}.` : 'There is no fixed deadline, but we recommend completing it within two weeks.',
      ],
      { label: 'Accept the invitation', url: p.url },
      'This invitation is personal to you. If you were not expecting it, you can ignore this email.',
    ),
  teamInvite: (p: { orgName: string; role: string; url: string }) =>
    render('team_invite', `Join ${p.orgName} on Lokus`, 'Hello,', [`You have been invited to join ${p.orgName} on Lokus as ${p.role === 'owner' ? 'an owner' : 'a recruiter'}.`], { label: 'Accept and create your account', url: p.url }, 'This invitation expires in 7 days.'),
};

/** Sends an email and records an outbox row (template, recipient, status). Bodies are not stored: they hold one-time links. */
export async function sendEmail(deps: Pick<AppDeps, 'db' | 'mailer' | 'log'>, to: string, email: RenderedEmail): Promise<void> {
  const recipient = to.toLowerCase();
  try {
    const { id } = await deps.mailer.send({ to: recipient, subject: email.subject, text: email.text, html: email.html, template: email.template });
    await deps.db.insert(emailOutbox).values({ to: recipient, template: email.template, subject: email.subject, status: deps.mailer.kind === 'resend' ? 'sent' : 'logged', providerId: id });
  } catch (err) {
    deps.log.error({ err, to: recipient, template: email.template }, 'email send failed');
    await deps.db.insert(emailOutbox).values({ to: recipient, template: email.template, subject: email.subject, status: 'failed', error: String((err as Error).message ?? err) });
  }
}
