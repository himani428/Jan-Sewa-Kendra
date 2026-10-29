# जनसेवा AI · Jansewa AI — दाखिल-खारिज review assistant

A bilingual (हिन्दी / English) workspace for **Naib Tehsildars and Tehsildars** who process **dakhil-kharij (mutation of land records)** applications in Uttar Pradesh. It shows what needs attention first, runs an evidence-linked review on each file, and leaves **approve / return / reject** entirely with the officer.

> All names, villages, khasra numbers, documents and decisions are **fictional demo data**. No real citizen data is used.

## Run

```bash
npm install     # installs everything and builds the UI (postinstall)
npm start       # http://localhost:3000
npm test        # 64 automated tests (API, i18n, rendered UI)
```

Node 18+. Login: **`officer` / `Jansewa@123`** (also `officer2`, `supervisor`, same password). Language can be switched on the login screen (top-right) and anywhere after login; the choice persists across refreshes and does not log you out.

Data is stored in `data/store.json` (created on first start, survives restarts). **Settings → Reset demo data** restores the starting state.

## The problem

When land is sold or an owner dies, the new owner or heirs apply to update the revenue record. The officer checks the application against several documents (ID, registered deed, khatauni, death certificate, family register, heirs’ affidavit) and must decide within a time limit. Read by hand, mismatched areas, missing documents or an incomplete list of heirs are found late; files bounce back repeatedly; deadlines are missed. This hurts families who cannot sell land or take loans until the record is corrected, and it overloads the tehsil office.

## How the product is organised (one screen = one purpose)

| Destination | Purpose |
|---|---|
| **Overview** | What needs attention first: four workload figures (each links to its filtered list), a short “Needs attention” list, and a 14-day deadline strip. Nothing else. |
| **My work queue** | Daily workspace. Tabs: my pending · needs attention · documents incomplete · ready to decide · past deadline · returned & resubmitted. Search, filters (collapsed by default), sorting, pagination, saved views, safe bulk actions, J/K/Enter keyboard navigation. |
| **All applications** | Search across the whole office (ID, name in either script, village, type, status). |
| **Document verification** | Pending cases’ documents that are missing, unclear or not yet verified. |
| **Tasks & follow-ups** | Follow-ups created inside cases. |
| **Decision history** | Read-only audit of approvals, rejections and returns: who, when, previous → new status, reason, whether it matched the AI suggestion. |
| **Reports** | Volume by date, by type, by status, processing time, pending ageing, returns/resubmissions, officer workload; date range; CSV export. |
| **Notifications / Settings** | In-app alerts; language, help, tour, demo reset. |

### Guided case review (five steps)
1. **Understand** – identity, concise summary, *next action* with reason, why the case is in the queue, return history.
2. **Documents** – checklist with statuses, extracted values, upload metadata, verification (who/when/note) and its history.
3. **Issues** – each finding shows what was seen, where (clickable evidence), *confirmed vs possible vs unverified*, uncertainty, next step; the officer can mark it reviewed / resolved / not applicable (reason required) and the suggestion updates.
4. **AI assistance** – summary, confirmed facts, suggestion with reasons, points to verify, limitations.
5. **Decide** – readiness check, then approve / return (choose points, editable bilingual draft letter, optional note templates) / reject (reason required). Every decision needs an explicit confirmation that the officer reviewed the evidence.

Notes, tasks and the searchable case history sit in a slide-over (“Case tools”) so they do not crowd the main flow.

## Features implemented

Smart next-action per case · deadline management (overdue/due-soon indicators, deadline strip, ageing report, demo SLA of 45 days clearly labelled) · return & **simulated** resubmission tracking · officer notes and follow-up tasks (persisted) · saved/renamable/removable views · completeness checklist with disclaimer · explainable findings with officer assessment · append-only audit trail · operational reports + CSV · notification centre (derived from real state; read flags persisted; no email/SMS is claimed) · global search and command palette (Ctrl/⌘ K, `/`) · bulk assign / add to review queue / export (never approve or reject) · onboarding tour and contextual tooltips · case assignment and workload view · **extras:** bilingual clarification-letter draft, decision-note templates, duplicate-parcel warning, repeated-return detection, “why is this case here?” explanation, resume-where-you-left-off, keyboard-shortcut help.

## Technical decisions

- **React + Vite + Tailwind + Framer Motion + Recharts; Express API.** One process serves both; `npm start` is enough. Design tokens (palette, type, radii, shadows) live in `tailwind.config.js`; motion is short (≈150–250 ms) and respects `prefers-reduced-motion`.
- **No database.** A file-backed JSON store (`server/store.js`) is enough for the demo and keeps setup trivial. The entities (applications, audit, notes, tasks, views) map directly to tables if moved to PostgreSQL. Schema changes are versioned (`VERSION`); a mismatch re-seeds the demo data.
- **Internationalisation with i18next** (`src/i18n/hi.js`, `en.js`, ~725 keys each). The **server never emits display text**: findings, next actions and audit entries are codes + parameters, translated on the client, so data stays independent of the display language. Fictional names exist in both scripts via a small dictionary (`server/translit.js`). A test enforces identical key sets and matching interpolation variables, and checks that every code the engine can emit has a translation.
- **“AI” is honest.** `server/analyze.js` is a transparent rule engine that compares document values (names with edit-distance, areas, heirs, land category, objections, duplicates, deadlines). It is labelled “Demo rule engine” in the UI and is **not** a language-model call or a legal opinion. It never changes a status; only `POST …/decision` does, and that endpoint requires the officer’s explicit acknowledgement.
- **Fair prioritisation.** Priority uses only deadline, open issues and resubmission status (see `summarize()`); the UI states this. No personal characteristics are used.
- **Security/accountability.** HMAC-signed stateless sessions (survive restarts), server-side authorization (officers can only decide their own or unassigned cases; supervisors any), input validation on every write, no API to edit or delete audit entries (tested), login throttling, CSV export without applicant names and with formula-injection escaping. Passwords are demo-only and stored as hashes.

## Tests

`npm test` runs 64 tests: 26 API tests (auth, scoping, search/filter/pagination, analysis, decisions, consistency across overview/list/history/audit, return→resubmission, notes/tasks, bulk safety, views, notifications, reports, CSV, persistence), 6 translation-integrity tests, and 32 rendered-UI tests (jsdom against a real server): every page in **both languages**, login + language switch, queue search, command palette, the findings view, the full return-for-clarification workflow and the rejection-reason validation. Writing these tests surfaced and fixed three real defects (Hindi “स्वीकृत” search also matching “अस्वीकृत”; an invalid `<div>` inside `<p>` on the overview; suggested return points not pre-selected if the analysis finished after the dialog opened).

## Limitations (please read)

- **Not visually inspected in a real browser.** The build environment had no browser, so layout, Hindi line-wrapping and mobile behaviour were *not* checked by eye or screenshot. Rendering was verified only through jsdom tests. Expect some spacing polish to be needed after the first real look.
- Document “upload” is not implemented: documents carry seeded metadata (file name, size, upload time) and values “read from the document”; nothing is OCR’d and no file is authenticated.
- The citizen portal is **simulated** (“Simulate applicant response” applies the requested corrections).
- Not implemented: Excel export, undo of actions, side-by-side comparison view, handover notes, UI for editing checklist requirements (they are defined per service type in `server/util.js`), an element-anchored tour (it is a short modal tour).
- “Resume where you left off” is stored in the browser (localStorage), not on the server.
- Single-process file store: fine for a demo, not for concurrent multi-server use.
- The 45-day deadline and document requirements are demo assumptions, not official rules; the land-category restriction is a simplified illustration needing legal examination.
- The JS bundle is one ~1 MB chunk (not code-split).

## Deploying

Any Node host: build `npm install`, start `npm start` (reads `PORT`; `DATA_FILE` overrides the store path). Nothing has been deployed or published to GitHub from this environment.
