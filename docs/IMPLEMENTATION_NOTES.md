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

## Where things live

- Drafted rules and phrase lists: `packages/engine/src/phrases/v1_1.ts`, rule comments in `packages/engine/src/criteria.ts`.
- Rubric, parameters and answer key are generated from the workbook: `packages/engine/fixtures/workbook_v1_1.json` → `src/rubric/v1_1.ts`, `src/answerKey/v1_1.ts`.
- Study content canon: `packages/content/src` (tests in `packages/content/test/canon.test.ts`).
- Local demo accounts: `DEV_*` in `.env.example` (development only).

## Known follow-ups

- `npm audit` reports moderate advisories in drizzle-kit's bundled esbuild (dev-only migration generator; not exploitable here).
- PDF regeneration of the study documents is scheduled with the employer-report PDFs (dashboard phase).
