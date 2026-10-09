# Development progress

Started 9 October 2026. The workspace was empty, without Git history, a remote, or Firebase configuration. Initialized local `main` and selected current stable Next.js 16.4.0 from the npm registry.

## Phase 1 — Foundation & core inventory

Status: Complete.

Commit: `a2f4ec5` — `feat: complete core property inventory system`.

Implemented authentication, protected role-aware workspace, property/room/item CRUD with safe archives, Firebase data access, photo uploads/previews/camera input, search/filtering, responsive UI, validation, and environment examples. Firestore/Storage rules and emulator test infrastructure are included from the start.

Validation: ESLint passed with no warnings; production build and TypeScript passed; 21 domain/service tests and 14 Firestore/Storage emulator tests passed. Browser verified landlord registration, property creation/detail, room creation, item creation, and an actual Storage upload with preview. Browser testing found and fixed missing registration profile IDs and accessible form-label inconsistencies.

GitHub push: unavailable because no remote is configured. Live Firebase verification: awaiting public project configuration. Local emulators are used for verification without production credentials.

## Phase 2 — Tenancy & inspection workflow

Status: Complete.

Commit: `df1f2dc` — `feat: add tenancy and inspection workflow`.

Implemented tenancy forms/history/filters, immutable check-in/check-out snapshots, tenant confirmation, photo records, and comparison with changed conditions/quantities highlighted. One check-in and one check-out are allowed per tenancy. Property and email are fixed after tenancy creation to protect historical identity.

Validation: ESLint and production build passed; 21 domain/service tests passed. Browser verified creating an Active tenancy using native date controls, saving check-in, enforcing verification for a tenant account, confirming check-in, editing live condition from Good to Damaged, recording check-out, and showing the original Good snapshot in comparison. The changes-only filter passed. The 14 emulator authorization tests cover immutable records, tenant confirmation restrictions, and atomic snapshot behavior.

GitHub push: pending remote configuration.

## Phase 3 — Damage reports, dashboard & UX

Status: Complete.

Commit: `993acbc` — `feat: add damage reporting dashboard and responsive UX`.

Implemented tenant damage reporting with photo evidence, landlord status/notes management, status filters, and a live dashboard. Dashboard counts derive from current records, with pending actions, recent activity, property summaries, and tenant-specific next steps. Mobile navigation, inventory cards, forms, and filters were reviewed at a 390 × 844 viewport.

Validation: browser verified tenant photo upload/report creation, landlord transition to Repairing with repair notes, status filtering, and dashboard counts (one property, one inventory unit, one active tenant, one damaged unit, one open report). Check-in confirmation is reflected in pending counts. Mobile forms remain scrollable within the viewport; inventory filters use two columns for readable options. ESLint and production build passed before the phase commit.

GitHub push: pending remote configuration.

## Phase 4 — Security, testing & final MVP review

Status: Complete.

Commit: `e8af3bc` — `chore: harden security testing and MVP documentation`.

Separated private invitation grants from tenant-readable properties, enforced archived-inventory denial and check-out ordering, and revised tenant listeners to clear revoked/cached data. Added guarded auth callbacks, reconnect/retry behavior, friendly upload/auth errors, and explicit account-load failures. Split inspection and dashboard screens into focused modules. Reviewed archival dependencies, image retention, query/index limits, and historical snapshots.

Validation: ESLint, standalone TypeScript, production build, and all 26 domain/service tests passed. The 17 Firestore/Storage authorization tests passed, including private grants, verification, cross-owner access, archived inventory, immutable snapshots, atomic 400-item inspections, check-out ordering, confirmation tampering, damage-report integrity, image MIME/size validation, and overwrite/deletion denial. Regression tests also reject concurrent changes to reviewed item/room names or quantities.

Final browser checks verified assigned tenant inventory and photos, landlord repair notes visible to the tenant, Completed tenancy revoking live inventory while retaining confirmed inspections/reports, and restoring Active access. Room removal with inventory and property removal with an Active tenancy both reject with clear messages. The Good-to-Damaged comparison and original images remain readable after completion. Mobile inventory filters/cards, scrollable forms, and empty filter states passed. Logged-out access returns to login. The final preview is left on the landlord dashboard with an Active synthetic tenancy.

Diff review found no tracked local configuration or secrets. Actual environment values, emulator exports, screenshots, and diagnostic files are ignored. Known limits and production setup steps are documented in README and the database/Firebase guides.

GitHub push: unavailable because no remote is configured. Production Firebase checks require public Web-app configuration.

## MVP v0.1.0 baseline — 9 October 2026

Status: Frozen and verified. Release tag: `v0.1.0-mvp`.

Started from a clean `main` at `e8af3bc`, with all four phase commits intact and no remote or existing release tag. No unfinished implementation changes were found. Finalization adds release documentation only; application code, tests, dependencies, and configuration remain unchanged.

Fresh verification passed `pnpm lint`, `pnpm typecheck`, `pnpm test` (26 tests), `pnpm build`, and the `pnpm test:rules` script (17 tests): 43 tests total. Rules ran with an ignored temporary config on Firestore 8180 and Storage 9299 and a separate process temporary directory, preserving the manual demo. All five commands exited successfully. Expected denied-request diagnostics and Java runtime deprecation warnings did not fail the rules suite.

Reviewed all agreed landlord and tenant workflows against existing screens, repository operations, tests, and the completed phase browser checks. Fresh browser smoke checks confirmed dashboard counts, inventory photo loading, confirmed inspection history, Good-to-Damaged comparison, and damage-report management. No record edits or new features were made during release verification. Production Firebase and real-device camera checks remain pending.

Release commit: `chore: finalize rental inventory MVP v0.1.0`, identified by the immutable `v0.1.0-mvp` tag. GitHub branch/tag pushes remain pending because no remote is configured; no authentication bypass or credential creation was attempted. See [release notes](release-v0.1.0.md) for the frozen scope and safe push commands.

## Environment notes

Node.js 24 and Java 25 are available. npm is absent from PATH; the bundled pnpm and direct Node script entry points execute equivalent lint/build/test checks. Earlier restricted execution could not resolve some Windows dependency junctions; verification uses the available full-access runtime. Source files and completed commits were preserved across host interruptions.

An emulator temporary-directory collision and later runtime interruption lost only the synthetic browser demo's in-memory history. The scenario was recreated with the original Auth identities and restored sofa image URL. The final demo uses its own Storage temporary directory and has an ignored full export under `.firebase/demo-export`. No production Firebase project was connected.
