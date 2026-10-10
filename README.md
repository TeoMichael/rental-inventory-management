# Keyline Rental Inventory Management

Keyline helps landlords and tenants manage properties, rooms, household inventory, photographs, tenancies, handovers, and damage reports.

The frozen MVP is `v0.1.0-mvp` at `5de01de`, published on `main` in the private [GitHub repository](https://github.com/TeoMichael/rental-inventory-management). The `chore/free-production-infrastructure` branch replaces new Firebase Storage uploads with ImageKit while preserving the frozen product and multi-account authorization. Firebase Auth and Singapore Firestore are live without billing. Cloudflare Linux CI serves [the verification app](https://keyline-rental-inventory.tripd04-nmc.workers.dev), and public owner/tenant/photo/history/security workflows passed. Two measured near-limit uploads still used 13 and 14 ms CPU after optimization, exceeding the 10 ms Workers Free allowance. Cloudflare is therefore not accepted as the final production host. A no-card Render Free fallback is prepared in `render.yaml`; deployment and verification there, main merge, and `v0.1.1` remain pending. See [production deployment](docs/production-deployment.md).

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

Never put private ImageKit values in any `.env*` file: OpenNext copies those values into Worker build output. Cloudflare uses runtime secrets; the prepared Render fallback uses server environment settings. Build in a process without `IMAGEKIT_PRIVATE_KEY`; the Cloudflare preflight rejects a nonempty private key in `.env*` or the build process. See [Firebase setup](docs/firebase-setup.md) and [deployment setup](docs/production-deployment.md).

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

The frozen release passed 26 domain/service and 17 authorization tests. The migration currently passes lint, TypeScript, the Next.js production build, **109 application tests**, and the previously completed **40 Firestore/legacy Storage rules tests**. Native bounded-read behavior also passed three real local workerd checks. Production rules match the local source and indexes are ready. Public Cloudflare verification passed owner registration/login, reset request, property/room/item creation, real multiple-image upload and reload, tenancy/check-in/check-out/comparison, tenant confirmation/supporting-photo report, repair status/note, completed-tenancy revocation and retained evidence. The already registered, human-verified tenant was reused; the unverified account remains blocked. Twenty-four public fixture isolation/retention checks and 14 further retained-evidence/upload-bound checks passed. A deployed Worker/29 public HTML and JavaScript resource scan found no ImageKit private key. Three valid 8,355,073-byte uploads succeeded on the native-reader deployment; the two captured CPU samples were 13 and 14 ms. This exceeds the Free CPU allowance, so public functionality does not establish final hosting readiness. Render deployment is pending; actual device camera capture remains unverified.

Rule tests require Java 21+. `pnpm test:rules` uses `firebase.emulators.json` to retain historical Storage rules and emulator checks. Production `firebase.json` contains Auth/Firestore configuration only, and the active application no longer initializes the Storage SDK. Separate concurrent Storage emulators with different ports **and** process `TEMP`/`TMP` directories. See [Firebase setup](docs/firebase-setup.md).

## Data and retention

Landlords access records by immutable owner ID; tenants need a verified matching email. Private property grants hide other invitation emails. Independent inspection snapshots survive live edits. Completed tenancies retain historical records while losing live inventory access.

New uploads use `/api/photos`. The server validates the Firebase account and reads authorization records under the user's token before uploading to a controlled ImageKit path. Responses retain the frozen `{id, path, name, url, createdAt}` format; ImageKit's file ID is validated on the server and is not persisted for new uploads. Earlier verification records with paired provider/file ID metadata remain compatible. JPEG, PNG, and WebP files are limited to 8 MiB each and ten photos per record. Removal detaches metadata; originals and partial uploads remain. CDN URLs are public capabilities: anyone holding one can retrieve the image after tenancy access ends. Legacy Firebase photos depend on the original bucket and URLs remaining available. See [database design](docs/database-design.md).

## Free infrastructure and remaining limits

Production Firebase Authentication and default Firestore are on Spark, with no linked billing account. ImageKit and Cloudflare must remain on free plans; no card, paid binding, or automatic upgrade is authorized. Quotas can stop service. ImageKit's 3 GB storage/20 GB monthly bandwidth and Workers Free's 100,000 daily requests/10 ms CPU allowance require real workload verification. Sources and scope are in [production deployment](docs/production-deployment.md).

Archives have no restore interface or automatic cleanup. Each tenancy supports one check-in/check-out pair with at most 400 items. Tenancy email/property are fixed; statuses/dates are manual. Client timestamps and complete snapshot counts are not trusted server audit guarantees. Deployed email action URLs, authorized domains, and real mobile camera capture still need verification.

See [development progress](docs/development-progress.md) and the historical [v0.1.0 release notes](docs/release-v0.1.0.md). QR labels, PDF reports, notifications, PWA support, templates, and AI remain outside this migration.
