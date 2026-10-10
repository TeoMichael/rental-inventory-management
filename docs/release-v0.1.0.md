# Rental Inventory Management MVP

Version: **v0.1.0** · Date: **9 October 2026** · Annotated tag: **`v0.1.0-mvp`** · Commit: **`5de01de`**

The first frozen MVP baseline preserves all four development phase commits. Release finalization changes documentation only; no application code, dependencies, tests, product features, redesign, or refactoring were added.

The scope and verification below describe this historical release. The separate `chore/free-production-infrastructure` branch replaces new images with ImageKit and verifies free hosting. Fresh checks pass lint, TypeScript, Next build, 109 application tests and all 40 rules regressions. Production Storage is no longer required. Public Cloudflare workflows pass, but near-limit uploads exceed Workers Free CPU (13/14 ms against 10 ms), so it is not the accepted final host and its automatic builds are disabled. [The Render Free application](https://keyline-rental-inventory.onrender.com) is live on a Singapore Node service with migration production verification complete: owner/tenant uploads, new report persistence, repair notes, completed-tenancy revocation/retention, security/history/evidence checks and public-resource inspection pass. Earlier registration and handover creation/confirmation evidence is reused from Cloudflare. The approved ImageKit credential is saved privately in the Render service environment, and its Firebase Auth hostname preserves prior domains. Main merge, deployment from main and annotated `v0.1.1` remain pending. Render retains idle sleep, shared quota, no-card suspension and unmeasured exact CPU/memory usage limitations; reset-link delivery/action and actual device camera capture remain unverified. Real Firebase email verification previously passed for the tenant; email actions were not rechecked after the Render deployment. This migration does not move or rewrite `v0.1.0-mvp`. See [current deployment status](production-deployment.md).

## Implemented MVP

- Registration/login, protected landlord/tenant workspaces, password reset, and tenant email verification.
- Property, room, and inventory management with safe archives, categories, quantities, conditions, values, search, and filters.
- Multiple Storage photos, previews, camera input where supported, and metadata removal that retains inspection evidence.
- Tenancy management and history; immutable check-in/check-out snapshots, tenant confirmation, and before/after comparison.
- Tenant damage reports with photos; landlord statuses/notes; role-aware dashboard and responsive navigation.
- Firestore/Storage ownership, membership, validation, and historical-record protection.

## Verification

Fresh checks on 9 October 2026:

| Script            | Result                              |
| ----------------- | ----------------------------------- |
| `pnpm lint`       | Passed                              |
| `pnpm typecheck`  | Passed                              |
| `pnpm test`       | Passed — 26 domain/service tests    |
| `pnpm build`      | Passed — production build           |
| `pnpm test:rules` | Passed — 17 Firestore/Storage tests |

**43 tests passed; all five commands exited successfully.** The rules script used an ignored temporary config (`--config .firebase/security-emulators.json`), Firestore 8180/Storage 9299, and separate process `TEMP`/`TMP` directories to preserve the running demo. Normal setup uses the committed default ports when free. Expected denied-request diagnostics and Java deprecation warnings were non-failing.

Workflow coverage matches all agreed landlord and tenant flows. Full emulator browser workflows and mobile checks were completed during the MVP phases; fresh release smoke checks confirmed dashboard counts, inventory images, confirmed handovers, comparison, and damage management without editing records.

## Known limitations

- Archives have no restore interface; retained/orphan photos need trusted cleanup. Download URLs remain usable by anyone holding them.
- One check-in/check-out pair per tenancy; at most 400 inventory records per inspection.
- Tenancy email/property are fixed; email is required and statuses/dates are manually managed.
- Client timestamps and snapshot text are not trusted server audit records; strict snapshot completeness and expiring image links need a backend.
- Production integration, email delivery, domains, and real-device camera capture remain unverified.

See [database design](database-design.md) for exact integrity and retention boundaries.

## Firebase production requirements

The frozen release required public Web settings, Email/Password Authentication, Firestore, and its Firebase Storage bucket/billing setup, followed by rules/index deployment, domain setup, and production role/email/upload checks. These were unverified at the release checkpoint. The active migration replaces that production Storage dependency with ImageKit while keeping Auth/Firestore on Spark without billing; follow the [current setup](firebase-setup.md) and [deployment guide](production-deployment.md), not a paid Storage upgrade.

## Future improvements

QR inventory labels, PDF handover reports, maintenance history, email notifications, PWA support, reusable inventory templates, richer before/after comparisons, and AI functionality remain future work. Start future development on new branches; never move or overwrite `v0.1.0-mvp`.

## GitHub publication

The original freeze happened before a remote was configured. The baseline `main` at `5de01de` is now published in the private [rental-inventory-management repository](https://github.com/TeoMichael/rental-inventory-management). The annotated `v0.1.0-mvp` tag continues to identify that same commit and must never be moved or overwritten. Active infrastructure work remains on its own branch. Render migration production verification is complete; main merge, deployment from main and annotated `v0.1.1` remain pending.

User-controlled 2FA, passkey, or browser approval remains an authentication checkpoint; do not bypass it or create replacement credentials.
