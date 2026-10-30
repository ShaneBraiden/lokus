# Implementation notes

Decisions taken while building, where they differ from or refine the approved plan.

## Deviations from the plan

| Plan | Built | Why |
|---|---|---|
| Better Auth for identity | Small custom auth: scrypt passwords, server-side sessions in httpOnly SameSite=Lax cookies, email-verification and reset tokens, TOTP two-step sign-in for staff | Roles, organisations and invitations are our own tables anyway; a custom layer avoids schema coupling and is fully covered by tests. |
| Local dev on the installed PostgreSQL 18 | Embedded PGlite (real Postgres in WASM) when `DATABASE_URL` is unset; node-postgres when it is set | Local Postgres needs credentials; PGlite runs the same migrations, triggers and RLS with zero setup. Set `DATABASE_URL` to use local Postgres or Supabase. |
| `append_event()` as a database function | `appendEvents()` service inside a transaction that locks the attempt row; database triggers reject UPDATE/DELETE/TRUNCATE | One code path; server time comes from an injectable clock so persona timings can be replayed in tests. |
| TanStack Table | To be decided at the dashboard phase (a light custom table may suffice) | Fewer dependencies. |

## Engine interpretations added during implementation (SME confirm)

- **GR guards.** Text that describes the sponsor's request is not agreement. Matches are ignored when a negation cue is near the phrase, or when a reported-speech cue ("asked", "requested") appears earlier in the same comma-delimited segment. The record's request summary is not scanned for GR; the reply body, next steps and narrative are.
- **T1_SEV order.** "Inverted" and "flat" compare only CRF (participant) findings. A consent-form finding rated Critical does not invert the order.
- **Phrase lists.** "should be recorded as" was removed from the leading-phrase and correction-directive lists because it matched neutral questions.
- **T1_DISC banding.** One flagged clean record costs 2 key points but stays in the DISC_R4 band (≥95), as the workbook's persona 5 implies.

## Simulation API behaviour (Phase 4)

- **Server-observed reads.** Opening the briefing, a participant CRF, a document section or an email is a `GET` that records an event; API responses are `no-store`. The web app must fetch these only when the candidate actually opens the item (no prefetching).
- **Commands only.** There is no endpoint that accepts raw events; client-sent timestamps or event fields are ignored.
- **Finding ids.** Findings get sequential ids per attempt (F-001, F-002…), so assessors and the candidate see the same labels.
- **No deviation and findings are exclusive.** Logging a finding on a participant marked "No deviation" retracts that decision; both events are recorded. Marking "No deviation" while active findings exist is refused.
- **No-op repeats.** Re-sending an unchanged decision or "No deviation" state records nothing.
- **Workday 2 clock.** Starts at the first open of the sponsor email, is stored on the attempt (survives refresh), and only reports overtime; it never blocks actions.
- **Deadlines.** An unfinished attempt past its deadline is closed the next time it is accessed; its outcome becomes a final Incomplete.
- **Results.** Results are recomputed under the attempt lock after each submission, rating, GR disposition or closure. A new version is written only when inputs change. Ratings and dispositions apply in insertion order, so "latest wins" never depends on clock ties. The assessor queue item opens while reviewer criteria are pending or a GR hold is unresolved, and closes automatically when neither applies.
- **Assessor endpoints.** The rating and disposition services exist and are tested; their HTTP endpoints and the review packet arrive with the Admin dashboard.

## Player and candidate UI (Phase 5)

- **Phase-gated screens.** Player screens live under `/sim/:attemptId/<screen>`; each route declares the attempt phases it belongs to and the shell redirects anything else to the right screen, so a candidate cannot type their way into a later or earlier step.
- **Autosave.** The current screen and unsent drafts (findings, escalations, notes, replies, issue-record blocks, reflection) are saved to `/progress` about a second after typing stops, and on tab hide. A conflict from another tab adopts the newer version and saves again (last writer wins). Drafts are never evidence.
- **Observed reads are never prefetched.** Records, document sections and emails are fetched when opened and refetched when reopened, so every open is recorded.
- **Neutral UI.** Every CRF value and every record offers identical actions; Workday 2 decisions start unselected; nothing in the candidate UI shows scores, ratings or rubric language.
- **Bundle canary.** `server/test/bundle-canary.test.ts` builds the client in production mode and fails if answer-key text, phrase-list entries, rubric anchors, parameter names, study-document passages or observed-email text appear in the shipped files.
- **Dev ports.** `npm run dev` pins the API to port 4000 with `--port=4000` (dev tooling may set `PORT` for the web server); production uses `PORT`.

## Review, admin and employer (Phases 6–7)

- **Blind review.** `/api/review` serves a pseudonymised packet: the rubric anchors for the six reviewer criteria, the caps the engine will apply, the GR clauses with the matched text, and the candidate's work. The candidate's name and email are redacted from their own free text. Packets never contain identity, employer, task scores or the outcome. Rating an unclaimed item claims it; another assessor's claimed item is read-only (admins may step in). Every packet view, rating and disposition is audited.
- **Admin explorer.** Attempt detail shows the full result (12 criteria with rule ids, caps and explanations), the evidence, the raw event log with a hash-chain check, result versions and review history. Actions: rescore (new version only when inputs change), close, withdraw, and retake. A retake withdraws the previous attempt by default, creates a new attempt on the active package, and carries over the employers who could see the old one.
- **Compare.** "Why did A score differently from B?" lists the criteria rated differently, largest point difference first, with each side's explanation.
- **Scoring packages.** Drafts copy an existing package (rubric and answer key unchanged) with edited parameters or phrase lists. Publishing requires a passing regression run on the draft as it is now, and retires the previous package; attempts stay pinned to the package they started with. Answer-key views are audited. SME sign-off is recorded on the package (metadata only).
- **Employer visibility.** Employers reach an attempt only through an active result share (their invitation or the candidate's approval) or the talent pool (self-started, opted-in, submitted). The report holds the outcome, a plain-language reason (no criterion ids or thresholds), the true task scores and competencies once the review is final, the critical flags with evidence links, and the evidence. Never criterion ratings, caps, rule ids, assessor rationale or answer-key content. Results views, PDF downloads, CSV exports and talent-pool views are audited. Anything else is a 404, so the existence of another organisation's attempt is never revealed.
- **CSV export** quotes every cell and neutralises leading `=`, `+`, `-`, `@` (spreadsheet formula injection).

## Hardening and launch (Phase 8)

- **Production serving.** Hashed assets are cached for a year; the HTML shell is served for client routes only, so a missing file (an old chunk after a deploy, a source map) is a 404 rather than the app shell. Source maps are not built.
- **Headers and cookies.** CSP (`script-src 'self'`, `frame-ancestors 'none'`), HSTS, no `x-powered-by`, `Cache-Control: no-store` on the API; session cookies are `HttpOnly`, `SameSite=Lax` and `Secure` in production; cross-site state-changing requests are refused.
- **Development outbox.** `/api/dev/outbox` lists the emails the console mailer printed (with links). It exists only when `NODE_ENV=development` and no Resend key is set; tests assert it is absent in production.
- **End-to-end.** `npm run e2e` starts a throwaway stack (API on 4001 with a wiped PGlite database, client on 5174) and runs two journeys: a candidate completing both workdays in the browser (draft and clock survive a reload, no scores shown), and employer invite → candidate acceptance and completion (the "Perfect" persona through the real API) → blind assessor rating in the UI → final employer report and PDF, with role isolation checks.
- **Deployment.** `render.yaml` and `docs/DEPLOYMENT.md`.

## Visual design

- No stock photography. Narrative screens and marketing panels use illustrations drawn with SVG and CSS from the design tokens (a study-team diagram, the document package, an inbox with a clock, completion rings, a product showcase, an animated sign-in panel).
- Motion (`motion` 14.3.0, pinned) loads its animation features after first paint; page transitions, scroll reveals, staggered lists and chart fills respect the operating system's reduced-motion setting.
- Charts follow the data-visualisation rules: one hue for single series, status colours (validated for colour-vision separation, each with an icon and label) for outcomes, values always visible, hover and focus tooltips that only repeat visible values.

## Repository layout

The repository is split into `client/` (React SPA), `server/` (Express API, plus the server-only scoring engine in `server/src/engine` and the simulation content in `server/src/content`) and `shared/` (client-safe vocabulary, command schemas and DTOs used by both). Inside the server, the engine and content are imported as `#engine` and `#content` (package.json subpath imports). The client build fails if any import resolves into `server/`.

## Where things live

- Drafted rules and phrase lists: `server/src/engine/phrases/v1_1.ts`, rule comments in `server/src/engine/criteria.ts`.
- Rubric, parameters and answer key are generated from the workbook: `server/fixtures/workbook_v1_1.json` → `server/src/engine/rubric/v1_1.ts`, `server/src/engine/answerKey/v1_1.ts`.
- Study content canon: `server/src/content` (tests in `server/test/content/canon.test.ts`).
- Local demo accounts: `DEV_*` in `.env.example` (development only).

## Known follow-ups

- `npm audit` reports moderate advisories in drizzle-kit's bundled esbuild (dev-only migration generator; not exploitable here).
- Printable PDFs of the study documents for the SME packet are not generated yet (the employer report PDF is). The admin Content & SME page lists every drafted item in the meantime.
- Not yet automated: an accessibility (axe) scan in the E2E suite, and the remaining regression personas (3, 8, 11, 13) as browser journeys; the engine and API suites already replay every persona.
- SME sign-off and a staging pilot on Render + Supabase are human steps (see docs/DEPLOYMENT.md).
