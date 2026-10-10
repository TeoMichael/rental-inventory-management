# Keyline Rental Inventory Management

Keyline helps landlords and tenants manage properties, rooms, household inventory, photographs, tenancies, handovers, and damage reports.

[The Render application](https://keyline-rental-inventory.onrender.com) is live on a Free Node service in Singapore, with migration production verification complete. The ImageKit infrastructure is now merged into `main` for release target `v0.1.1`, preserving the frozen product and multi-account authorization. The production service now deploys main; its preserve-history merge is Live and fresh tenant UI, configured upload, 26 security/upload-denial checks and deployed public-resource inspection pass. The annotated release tag will be published only after final live verification. See [production deployment](docs/production-deployment.md).

Firebase Auth and Singapore Firestore are live without billing. The approved ImageKit credential is saved privately in the Render service environment; owner/tenant uploads, report persistence, completed-tenancy revocation/retention and public-resource inspection pass. The Render hostname is authorized in Firebase Auth, preserving earlier domains. The immutable MVP tag `v0.1.0-mvp` remains at `5de01de` in the private [GitHub repository](https://github.com/TeoMichael/rental-inventory-management). Cloudflare is historical: public workflows passed, but near-limit uploads used 13/14 ms CPU against Workers Free's 10 ms allowance, and its automatic builds are disabled.

## Stack

Next.js 16.4 App Router, React, TypeScript, Tailwind CSS 4, Firebase Authentication, and Cloud Firestore. Main now includes the private ImageKit upload proxy and normal Next.js Node service configuration for Render Free. OpenNext 1.20.10 remains for the historical Cloudflare deployment. Firestore Security Rules continue to protect ownership, verified tenant access, and immutable history independently of the UI.

## Local setup

Use Node.js 24 and the committed pnpm lockfile:

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
cp .dev.vars.example .dev.vars
pnpm dev
```

Open http://127.0.0.1:3000. Fill `.env.local` with **public Firebase Web configuration only**. Put ImageKit runtime settings in ignored `.dev.vars`; `pnpm dev` loads them into the development process. Without ImageKit configuration, inventory works but uploads report that they are unavailable. Without Firebase configuration, the app displays setup instructions.

For OpenNext/Cloudflare builds, keep private ImageKit values out of every `.env*` file and the build process: OpenNext copies file values into Worker output, and the Cloudflare preflight rejects a nonempty `IMAGEKIT_PRIVATE_KEY` in those locations. Cloudflare uses runtime secrets. The normal Next.js Node build on Render can receive server environment settings during build and runtime; the private key must have no `NEXT_PUBLIC_` prefix and stay behind the `server-only` upload boundary. Inspect the actual deployed public output for private values before accepting the host. See [Firebase setup](docs/firebase-setup.md) and [deployment setup](docs/production-deployment.md).

## Implemented workflows

- Registration, login/logout, password reset, landlord/tenant roles, and tenant email verification.
- Property, room, and item management with safe archives, categories, conditions, values, search, and filters.
- Multiple photos, previews, mobile camera input, and metadata removal retaining historical originals.
- Tenancies, immutable check-in/check-out snapshots, tenant confirmation, and before/after comparison.
- Tenant damage reports with evidence, landlord statuses/notes, and role-scoped dashboards.
- Responsive navigation, validation, empty states, errors, and reconnect/retry handling.

## Verification

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:rules
pnpm cloudflare:build
pnpm cloudflare:preview
```

The frozen release passed 26 domain/service and 17 authorization tests. Fresh migration checks pass lint, TypeScript, the Next.js production build, **109 application tests**, and **40 Firestore/legacy Storage rules tests**. Native bounded-read behavior also passed three real local workerd checks. Production rules match the local source and indexes are ready. Public Cloudflare verification passed registration, inventory creation, multiple images, handover creation/confirmation/comparison, reports, repair notes and completed-tenancy retention; 24 fixture checks and 14 retained-evidence/upload checks passed there. Its 13/14 ms near-limit CPU samples remain historical hosting results. On Render, a real 8,355,073-byte upload passed in 3.584 seconds, owner photos saved/reloaded, verified-tenant upload/report persistence and owner Repairing/note updates passed, and the unverified account remains gated. Completing the tenancy clears tenant inventory and new reporting while retaining both snapshots, reports, notes and original photos. Render security/history/evidence checks pass in Active and Completed states, including canonical five-field metadata, exact retained image bytes and a real oversize 413. The Live main merge also passes fresh tenant UI reload, all 26 Completed-fixture security/upload-denial checks, a configured upload probe and a scan of all 29 referenced public HTML/JavaScript resources with no raw or Basic-encoded private key; those rechecks created no records or successful uploads. Registration and handover creation were verified on Cloudflare and reused on Render; Render comparison retains Good/two photos versus Damaged/one and all three 720-pixel images. Mobile report/history/comparison and enabled multiple-photo/camera controls pass. Real Firebase email verification previously passed for the tenant. The generic Render password-reset request passed; reset-link delivery/action and email actions after the Render deployment were not rechecked. Actual device camera capture remains unverified.

Rule tests require Java 21+. `pnpm test:rules` uses `firebase.emulators.json` to retain historical Storage rules and emulator checks. Production `firebase.json` contains Auth/Firestore configuration only, and the active application no longer initializes the Storage SDK. Separate concurrent Storage emulators with different ports **and** process `TEMP`/`TMP` directories. See [Firebase setup](docs/firebase-setup.md).

## Data and retention

Landlords access records by immutable owner ID; tenants need a verified matching email. Private property grants hide other invitation emails. Independent inspection snapshots survive live edits. Completed tenancies retain historical records while losing live inventory access.

New uploads use `/api/photos`. The server validates the Firebase account and reads authorization records under the user's token before uploading to a controlled ImageKit path. Responses retain the frozen `{id, path, name, url, createdAt}` format; ImageKit's file ID is validated on the server and is not persisted for new uploads. Earlier verification records with paired provider/file ID metadata remain compatible. JPEG, PNG, and WebP files are limited to 8 MiB each and ten photos per record. Removal detaches metadata; originals and partial uploads remain. CDN URLs are public capabilities: anyone holding one can retrieve the image after tenancy access ends. Legacy Firebase photos depend on the original bucket and URLs remaining available. See [database design](docs/database-design.md).

## Free infrastructure and remaining limits

Production Firebase Authentication and default Firestore are on Spark, with no linked billing account. ImageKit, Render and the historical Cloudflare service must remain on free plans; no card, paid binding, or automatic upgrade is authorized. Quotas can stop service. ImageKit includes 3 GB storage/20 GB monthly bandwidth. This Render workspace shares 750 Free hours, 5 GB outbound bandwidth and 500 pipeline minutes monthly with its existing service; the Free Node service has 512 MB RAM/0.15 CPU. Render Free sleeps after 15 idle minutes, can take about a minute to wake, and can suspend unusually high outbound API/storage traffic; the provider discourages Free use for production. Exact CPU/memory usage was not measured because the dashboard graphs require an upgrade. Sources and scope are in [production deployment](docs/production-deployment.md).

Archives have no restore interface or automatic cleanup. Each tenancy supports one check-in/check-out pair with at most 400 items. Tenancy email/property are fixed; statuses/dates are manual. Client timestamps and complete snapshot counts are not trusted server audit guarantees. The Render Auth domain is configured; deployed email action URLs and real mobile camera capture still need verification.

See [development progress](docs/development-progress.md) and the historical [v0.1.0 release notes](docs/release-v0.1.0.md). QR labels, PDF reports, notifications, PWA support, templates, and AI remain outside this migration.
