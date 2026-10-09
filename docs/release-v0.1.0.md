# Rental Inventory Management MVP

Version: **v0.1.0** · Date: **9 October 2026** · Annotated tag: **`v0.1.0-mvp`**

The first frozen MVP baseline preserves all four development phase commits. Release finalization changes documentation only; no application code, dependencies, tests, product features, redesign, or refactoring were added.

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

Provide public web-app environment settings; enable Email/Password Authentication, Firestore, and the appropriate Storage bucket/billing plan. Deploy the included rules/indexes, await index readiness, configure authorized domains, and disable emulators. Verify both roles, email verification, uploads, and deployed access rules before production use. Never commit local environment values or admin credentials. See [Firebase setup](firebase-setup.md).

## Future improvements

QR inventory labels, PDF handover reports, maintenance history, email notifications, PWA support, reusable inventory templates, richer before/after comparisons, and AI functionality remain future work. Start future development on new branches; never move or overwrite `v0.1.0-mvp`.

## GitHub publication

No remote is configured. The release commit on `main` and annotated tag are finalized locally; neither has been pushed. After GitHub authentication, substitute your actual repository URL:

```sh
git remote add origin "YOUR_GITHUB_REPOSITORY_URL"
git push origin main
git push origin v0.1.0-mvp
```

If authentication requests 2FA, a passkey, or browser approval, complete that user-controlled step before retrying. Do not bypass it or create replacement credentials.
