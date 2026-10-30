import { expect, test } from '@playwright/test';
import { DEMO, allowFullscreen, expectNoScores, signIn } from './helpers';

const RECORDS = ['DM-206', 'DM-082', 'DM-008', 'DM-220', 'DM-189', 'DM-284', 'DM-598', 'DM-494', 'DM-124', 'DM-022', 'DM-180', 'DM-384'];

test('a candidate completes both workdays in the browser; drafts and the clock survive a reload; no scores are shown', async ({ page }) => {
  await allowFullscreen(page);
  await signIn(page, DEMO.candidate);
  await expect(page.getByRole('heading', { name: /Welcome, Priya/ })).toBeVisible();

  // Self-start (talent-pool route), then the pre-start readiness check.
  await page.getByRole('button', { name: 'Start the simulation' }).click();
  await page.getByLabel(/my actions in the simulation are recorded/).check();
  await page.getByRole('button', { name: 'Create my attempt' }).click();
  await page.getByLabel(/I’m ready/).check();
  await page.getByRole('button', { name: 'Open the simulation' }).click();

  // Overview → Workday 1 → briefing (the instruction is shown and recorded) → workspace.
  await expect(page.getByRole('heading', { name: /Welcome to Aurous Healthcare/ })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Start Workday 1' }).click();
  await expect(page.getByText('Section 4 was already approved')).toBeVisible();
  await page.getByRole('button', { name: 'Open the review workspace' }).click();
  await page.getByRole('button', { name: 'I’ll explore myself' }).click();

  // The field guide replays a single step; its try-it completes when the candidate uses the real control.
  await page.getByRole('button', { name: /^Guide/ }).click();
  await page.getByRole('button', { name: 'Work straight on the page' }).click();
  await page.getByRole('button', { name: /^Weight \(kg\), Week 4/ }).click();
  await expect(page.getByText('Done. That’s all there is to it.')).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByRole('button', { name: /^Guide/ })).toContainText('1/3');

  // A finding on the first record from a cell's menu: only the clicked location is prefilled.
  await page.getByRole('button', { name: /^Weight \(kg\), Week 8/ }).click();
  await page.getByRole('menuitem', { name: 'Log finding' }).click();
  const form = page.getByRole('region', { name: 'Log a finding' });
  await expect(form.getByLabel('Finding type')).toHaveValue('');
  await form.getByLabel('Finding type').selectOption('Clinical measurement anomaly (BP/Weight/Glucose)');
  await form.getByLabel('Observed issue').pressSequentially('Weight falls 3 kg between Week 4 and Week 8.', { delay: 50 });
  await form.getByRole('button', { name: 'Save finding' }).click();
  await expect(page.getByText('F-001 logged')).toBeVisible();

  // A safety escalation on DM-220.
  const nav = page.getByRole('navigation', { name: 'Participant records' });
  await nav.getByRole('button', { name: /DM-220/ }).click();
  await page.getByRole('button', { name: 'Escalate safety concern' }).click();
  const esc = page.getByRole('dialog', { name: 'Escalate a safety concern' });
  await esc.getByRole('button', { name: 'To' }).click();
  await page.getByRole('option', { name: /Dr\. Kavita Menon/ }).click();
  await page.keyboard.press('Escape');
  await esc.getByLabel('What you observed').pressSequentially('Dizziness and nausea reported at the Week 8 visit; please assess as a possible adverse event.', { delay: 50 });
  await esc.getByRole('button', { name: 'Send escalation' }).click();
  await expect(page.getByText('Safety concern escalated')).toBeVisible();

  // "No deviation" on every other record.
  for (const id of RECORDS.slice(1)) {
    await nav.getByRole('button', { name: new RegExp(id) }).click();
    await expect(page.getByRole('heading', { name: new RegExp(id) })).toBeVisible();
    await page.getByRole('button', { name: 'No deviation', exact: true }).click();
    await expect(page.getByRole('button', { name: 'No deviation recorded' })).toBeVisible();
  }

  await page.getByRole('button', { name: 'Review & submit' }).click();
  await expect(page.getByText('Every record has a decision.')).toBeVisible();
  await page.getByRole('button', { name: 'Submit Workday 1' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByRole('heading', { name: 'That’s the end of Workday 1' })).toBeVisible();

  // Workday 2: the server clock starts when the sponsor's email is opened.
  await page.getByRole('button', { name: 'Continue to Workday 2' }).click();
  await page.getByRole('button', { name: 'Start Workday 2' }).click();
  await page.getByRole('button', { name: 'I’ll explore myself' }).click();
  await expect(page.getByRole('timer')).toHaveCount(0);
  await page.getByRole('button', { name: /Vikram Rao/ }).click();
  await expect(page.getByRole('timer')).toContainText('left');
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
  await page.getByRole('radio', { name: 'Report now' }).check();
  await page.getByRole('radio', { name: /Decline and route/ }).check();

  await page.getByRole('button', { name: 'Reply' }).click();
  await page.getByLabel('Message').pressSequentially('I cannot hold the SAE report; it will be reported within the required timelines. The waiver must go to the Medical Monitor.', { delay: 50 });
  await page.waitForTimeout(2000); // let the draft autosave

  // A reload keeps the clock (server-side) and the unsent reply (autosaved draft).
  await page.reload();
  await page.getByRole('button', { name: 'Return to the assessment' }).click();
  await expect(page.getByRole('timer')).toContainText('left');
  await page.getByRole('button', { name: 'Reply' }).click();
  await expect(page.getByLabel('Message')).toHaveValue(/cannot hold the SAE report/);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Reply sent')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Report now' })).toBeDisabled();

  await page.getByRole('button', { name: 'Finish Workday 2' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Finish Workday 2' }).click();
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByRole('heading', { name: 'You’ve completed the simulation' })).toBeVisible();
  await expectNoScores(page);

  // Back on the dashboard: submitted, still no scores; going back into Workday 1 is refused by the phase gate.
  const simPath = new URL(page.url()).pathname.replace(/\/complete$/, '');
  await page.goto(`${simPath}/workspace`);
  await expect(page).toHaveURL(/\/(complete|debrief)$/);
  await page.goto('/app');
  await expect(page.getByText('Submitted', { exact: true }).first()).toBeVisible();
  await expectNoScores(page);
});
