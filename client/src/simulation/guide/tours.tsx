import type { GuideTour } from './FieldGuide';

const B = ({ children }: { children: string }) => <span className="font-medium text-ink">{children}</span>;

/** Workday 1: how the review workspace works. Neutral: it never says what to look for. */
export const WORKDAY1_TOUR: GuideTour = {
  id: 'w1',
  label: 'Workday 1',
  intro: {
    title: 'A quick lap of your review desk',
    minutes: 'about 2 minutes',
    body: (
      <>
        <p>Your binder holds 12 participant records and the study documents. Each record needs your call before you submit: at least one finding, or &ldquo;No deviation&rdquo;.</p>
        <p>This walkthrough points at the real controls and lets you try the important ones. Nothing you do in it is recorded as a finding.</p>
      </>
    ),
  },
  steps: [
    {
      id: 'records',
      target: 'w1-records',
      title: 'Move between records',
      body: <p>Each tab is one participant&rsquo;s CRF, in binder order. The dot fills in once you have made a call on that record. It says nothing about whether the call is right.</p>,
      task: { prompt: 'open another participant’s record.', match: 'button, select' },
    },
    {
      id: 'value',
      target: 'w1-crf',
      title: 'Work straight on the page',
      body: (
        <>
          <p>The sheet is the printed CRF. Every value on it opens the same small menu:</p>
          <ul className="list-disc pl-5">
            <li>
              <B>Log finding</B> points the form at that exact value.
            </li>
            <li>
              <B>Edit value</B> changes it in pen; the printed original stays visible.
            </li>
            <li>
              <B>Recommend correction</B> asks the site to change it instead.
            </li>
          </ul>
        </>
      ),
      task: { prompt: 'select any value on the page to open its menu.', match: '[aria-haspopup="menu"]' },
    },
    {
      id: 'form',
      target: 'w1-form',
      title: 'Write it up on the right',
      body: (
        <>
          <p>The finding form follows whatever you pointed it at: the record, a value, or a document section. Choose a type, add references, describe what you saw and what should happen next.</p>
          <p>An unsaved draft is kept if you switch records or refresh.</p>
        </>
      ),
    },
    {
      id: 'record-actions',
      target: 'w1-record-actions',
      title: 'Decisions about the whole record',
      body: (
        <>
          <p>
            <B>No deviation</B> is a decision too: use it for a record you have checked and have nothing to log. It is only available while the record has no findings.
          </p>
          <p>
            <B>Escalate safety concern</B> is separate from findings, for anything you believe needs urgent attention.
          </p>
        </>
      ),
    },
    {
      id: 'panel',
      target: 'w1-panel',
      title: 'Everything on this record',
      body: <p>Findings, escalations, recommended corrections and changed values for the open record collect here. Edit or withdraw a finding, or restore a value you changed.</p>,
    },
    {
      id: 'docs',
      target: 'w1-docs',
      title: 'The study documents',
      body: <p>The controlled documents for the study open in a viewer beside your work. You can log a finding against a document section from inside it.</p>,
      task: { prompt: 'open the study documents, then close them to carry on.' },
    },
    {
      id: 'toolbar',
      target: 'w1-toolbar',
      title: 'The rest of your desk',
      body: (
        <p>
          Re-read the <B>Briefing</B> at any time, see every finding at once in the <B>Findings log</B>, or <B>Message Dr. Anjali</B> if you need to raise something with your manager.
        </p>
      ),
    },
    {
      id: 'submit',
      target: 'w1-submit',
      title: 'Review before you submit',
      body: <p>This opens a checklist of every record and document finding first. Nothing is final until you confirm there, and the 60-minute clock in the header is a guide, not a cut-off.</p>,
    },
    {
      id: 'guide',
      target: 'w1-guide',
      title: 'Need a reminder later?',
      body: <p>The Guide button replays this walkthrough or any single step. It never changes your work.</p>,
    },
  ],
};

/** Workday 2: how the mail workspace works. Kept short: it is a timed day. */
export const WORKDAY2_TOUR: GuideTour = {
  id: 'w2',
  label: 'Workday 2',
  intro: {
    title: 'Your inbox in five stops',
    minutes: 'about 1 minute',
    body: (
      <>
        <p>Today runs like a normal morning: read what has come in, reply where you need to, and keep the study record up to date.</p>
        <p>Plan for about 30 minutes; a countdown appears in the header once your time starts. This is kept short, so skip it if you&rsquo;d rather dive in.</p>
      </>
    ),
  },
  steps: [
    {
      id: 'inbox',
      target: 'w2-inbox',
      title: 'Read your mail',
      body: <p>New messages are marked with a dot. Opening one shows it in the reading pane with a Reply button underneath.</p>,
      task: { prompt: 'open any message.', match: 'button' },
    },
    {
      id: 'decisions',
      target: 'w2-reading',
      title: 'Decisions sit under the message',
      body: <p>When a message asks you to decide something, a decisions panel appears under it. You can change a decision until you send your reply; after that it is final.</p>,
    },
    {
      id: 'compose',
      target: 'w2-compose',
      title: 'Write to anyone',
      body: <p>Start a new message to anyone in the study directory, with Cc if you need it. Sent mail is under the Sent folder.</p>,
    },
    {
      id: 'record',
      target: 'w2-record',
      title: 'Keep the issue record current',
      body: <p>The study team&rsquo;s running record of open requests. Save each block when it is up to date: text you have not saved is not part of the record.</p>,
      task: { prompt: 'open the issue record.' },
    },
    {
      id: 'finish',
      target: 'w2-finish',
      title: 'Finish when you are done',
      body: <p>The clock is a guide; nothing is sent or submitted automatically. Study documents are in the toolbar, and the Guide button brings this back any time.</p>,
    },
  ],
};
