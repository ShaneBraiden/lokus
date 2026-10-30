import { expect, test } from '@playwright/test';
import { DEMO, expectNoScores, linkFromOutbox, playPersona, signIn } from './helpers';

test('employer invites → candidate accepts and completes → blind assessor review → employer sees the final report', async ({ browser }) => {
  const email = `e2e+${Date.now()}@example.com`;
  const name = 'Morgan Ellis';

  // Employer invites a candidate.
  const employer = await (await browser.newContext()).newPage();
  await signIn(employer, DEMO.employer);
  await employer.goto('/org/invites');
  await employer.getByLabel('Name').fill(name);
  await employer.getByLabel(/^Email/).fill(email);
  await employer.getByRole('button', { name: 'Send invitation' }).click();
  await expect(employer.getByText('1 invitation sent')).toBeVisible();

  // The candidate follows the emailed link, creates an account and consents.
  const candidate = await (await browser.newContext()).newPage();
  const invite = await linkFromOutbox(employer.request, email, '/invite');
  await candidate.goto(invite);
  await expect(candidate.getByRole('heading', { name: /has invited you/ })).toBeVisible();
  await candidate.getByLabel('Choose a password').fill('e2e-Passphrase-2026');
  await candidate.getByLabel(/will receive my results/).check();
  await candidate.getByRole('button', { name: 'Create account and accept' }).click();
  await candidate.waitForURL(/\/app\/assessments\//);
  const attemptId = candidate.url().split('/').pop()!;

  // The "Perfect" regression persona's actions, played through the real player API with the candidate's session.
  await playPersona(candidate, attemptId, 'p01');
  await candidate.goto('/app');
  await expect(candidate.getByText('Submitted', { exact: true }).first()).toBeVisible();
  await expectNoScores(candidate);

  // The employer sees the candidate as awaiting review, without scores.
  await employer.goto('/org/candidates');
  const row = employer.getByRole('row', { name: new RegExp(name) });
  await expect(row.getByText('Awaiting review')).toBeVisible();

  // A blind assessor rates every reviewer criterion.
  const assessor = await (await browser.newContext()).newPage();
  await signIn(assessor, DEMO.assessor);
  await expect(assessor).toHaveURL(/\/admin\/review$/);
  await assessor.getByRole('row').filter({ hasText: 'Employer invite' }).first().click();
  await expect(assessor.getByRole('heading', { name: /^Candidate [0-9A-F]{6}$/ })).toBeVisible();
  const packetText = await assessor.locator('main').innerText();
  expect(packetText).not.toContain(name);
  expect(packetText).not.toContain(email);
  await assessor.getByRole('button', { name: 'Claim' }).click();
  for (const label of ['Consent form Section 4', 'Query quality', 'Refusing the SAE delay', 'Handling the waiver', 'Issue record', 'Tone of the reply']) {
    const card = assessor.locator('aside').getByRole('button', { name: new RegExp(label) });
    if ((await card.getAttribute('aria-expanded')) !== 'true') await card.click();
  }
  const fours = assessor.locator('aside input[type="radio"][name^="rate-"]');
  const groups = new Set(await fours.evaluateAll((els) => els.map((e) => (e as HTMLInputElement).name)));
  for (const group of groups) {
    await assessor.locator(`aside input[name="${group}"]`).first().check();
    await assessor.locator(`#why-${group.replace('rate-', '')}`).fill('Evidence meets the level-4 anchor in full.');
  }
  await assessor.getByRole('button', { name: 'Save ratings' }).click();
  await expect(assessor.getByText('Review complete').first()).toBeVisible();

  // The employer now sees the final outcome, scores, flags and evidence, and can download the PDF.
  await employer.goto('/org/candidates');
  await expect(employer.getByRole('row', { name: new RegExp(name) }).getByText('Meets bar')).toBeVisible();
  await employer.getByRole('row', { name: new RegExp(name) }).click();
  await expect(employer.getByText('Both workdays met the bar, with no critical flags.')).toBeVisible();
  await expect(employer.getByRole('heading', { name: 'Evidence' })).toBeVisible();
  const pdf = await employer.request.get(`/api/org/results/${attemptId}/report.pdf`);
  expect(pdf.headers()['content-type']).toBe('application/pdf');
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');

  // Role isolation in the UI: each role is sent back to its own area.
  await candidate.goto('/org');
  await expect(candidate).toHaveURL(/\/app$/);
  await assessor.goto('/admin/attempts');
  await expect(assessor).toHaveURL(/\/admin\/review$/);
  await employer.goto('/admin');
  await expect(employer).toHaveURL(/\/org$/);
});
