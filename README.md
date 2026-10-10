# Keyline Rental Inventory Management

Keyline helps landlords and tenants manage properties, rooms, household inventory, photographs, tenancies, handovers, and damage reports.

The frozen MVP is `v0.1.0-mvp` at `5de01de`, published on `main` in the private [GitHub repository](https://github.com/TeoMichael/rental-inventory-management). The `chore/free-production-infrastructure` migration branch replaces new Firebase Storage uploads with ImageKit and prepares full Next.js hosting on Cloudflare Workers Free. The local ImageKit integration phase is complete: owner and verified tenant uploads, inventory, handovers, confirmation, damage reports and access revocation passed against live Firebase/ImageKit through the local production build. Updated rules are deployed and accept ten photos in the frozen metadata format; earlier paired metadata remains compatible. Cloudflare authentication/deployment, verification on the deployed URL, merge to main, and `v0.1.1` remain pending. See [production deployment](docs/production-deployment.md).

## Stack

Next.js 16.4 App Router, React, TypeScript, Tailwind CSS 4, Firebase Authentication, and Cloud Firestore. The migration adds a private ImageKit upload proxy and OpenNext 1.20.10 for Cloudflare Workers. Firestore Security Rules continue to protect ownership, verified tenant access, and immutable history independently of the UI.

## Local setup

Use Node.js 24 and the committed pnpm lockfile:

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
cp .dev.vars.example .dev.vars
pnpm dev
```

Open http://127.0.0.1:3000. Fill `.env.local` with **public Firebase Web configuration only**. Put ImageKit runtime settings in ignored `.dev.vars`; `pnpm dev` loads them into the development process. Without ImageKit configuration, inventory works but uploads report that they are unavailable. Without Firebase configuration, the app displays setup instructions.

Never put private ImageKit values in any `.env*` file: OpenNext copies those values into Worker build output. Production uses Cloudflare runtime secrets. Build in a process without `IMAGEKIT_PRIVATE_KEY`; the Cloudflare preflight rejects a nonempty private key in `.env*` or the build process. See [Firebase setup](docs/firebase-setup.md) and [deployment setup](docs/production-deployment.md).

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

The frozen release passed all original five checks: 26 domain/service tests and 17 authorization tests. Migration checks passed lint, TypeScript, the Next.js production build, 96 application tests and 40 Firestore/legacy Storage rules tests: **136 tests passed**. The rules script passed again after configuration cleanup. Coverage includes ten five-field photos across workflows and two earlier paired photos mixed with eight new-format photos. Live requests saved/read back two and ten mixed photos and denied malformed metadata. Owner handovers retained all snapshot thumbnails after photo detachment. A registered, email-verified tenant accessed assigned records, confirmed check-in and saved/reloaded real supporting evidence. The owner's Repairing status and note remained visible after tenancy completion, while live inventory cleared and uploads were denied. All 37 fresh live security/retention checks passed, including forbidden writes, immutable roles, cross-owner denial and invalid/oversized upload rejection. Mobile comparison/forms/report history fit the viewport, and photo/camera inputs are enabled; actual device capture remains unverified. Native Windows OpenNext packaging failed on a symlink; no Worker preview or deployment exists. Linux packaging, deployed email/domain workflows and Cloudflare limits remain pending.

Rule tests require Java 21+. `pnpm test:rules` uses `firebase.emulators.json` to retain historical Storage rules and emulator checks. Production `firebase.json` contains Auth/Firestore configuration only, and the active application no longer initializes the Storage SDK. Separate concurrent Storage emulators with different ports **and** process `TEMP`/`TMP` directories. See [Firebase setup](docs/firebase-setup.md).

## Data and retention

Landlords access records by immutable owner ID; tenants need a verified matching email. Private property grants hide other invitation emails. Independent inspection snapshots survive live edits. Completed tenancies retain historical records while losing live inventory access.

New uploads use `/api/photos`. The server validates the Firebase account and reads authorization records under the user's token before uploading to a controlled ImageKit path. Responses retain the frozen `{id, path, name, url, createdAt}` format; ImageKit's file ID is validated on the server and is not persisted for new uploads. Earlier verification records with paired provider/file ID metadata remain compatible. JPEG, PNG, and WebP files are limited to 8 MiB each and ten photos per record. Removal detaches metadata; originals and partial uploads remain. CDN URLs are public capabilities: anyone holding one can retrieve the image after tenancy access ends. Legacy Firebase photos depend on the original bucket and URLs remaining available. See [database design](docs/database-design.md).

## Free infrastructure and remaining limits

Production Firebase Authentication and default Firestore are on Spark, with no linked billing account. ImageKit and Cloudflare must remain on free plans; no card, paid binding, or automatic upgrade is authorized. Quotas can stop service. ImageKit's 3 GB storage/20 GB monthly bandwidth and Workers Free's 100,000 daily requests/10 ms CPU allowance require real workload verification. Sources and scope are in [production deployment](docs/production-deployment.md).

Archives have no restore interface or automatic cleanup. Each tenancy supports one check-in/check-out pair with at most 400 items. Tenancy email/property are fixed; statuses/dates are manual. Client timestamps and complete snapshot counts are not trusted server audit guarantees. Deployed email action URLs, authorized domains, and real mobile camera capture still need verification.

See [development progress](docs/development-progress.md) and the historical [v0.1.0 release notes](docs/release-v0.1.0.md). QR labels, PDF reports, notifications, PWA support, templates, and AI remain outside this migration.
