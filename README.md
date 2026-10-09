# Keyline · Rental Inventory Management

A responsive rental inventory application for landlords and tenants. Organize properties and rooms, record household items and photographs, and preserve a clear record of each rental handover.

## Stack

Next.js 16.4 App Router, React, TypeScript, Tailwind CSS 4, Firebase Authentication, Cloud Firestore, and Firebase Storage. Firebase is accessed through a small typed repository layer; Security Rules enforce access independently of the UI.

## Local setup

Use Node.js 24 LTS (Node 20.9 or newer is supported by Next.js). The repository includes a pnpm lockfile for reproducible installation:

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

If using npm instead, run `npm install` and `npm run dev`. Open http://127.0.0.1:3000. Actual environment files are excluded from Git.

Fill in the `NEXT_PUBLIC_FIREBASE_*` values using your Firebase web-app configuration. Enable Email/Password Authentication, Firestore, and Storage, then deploy the included rules and indexes. See [Firebase setup](docs/firebase-setup.md) for exact steps and a local Emulator Suite configuration that needs no live credentials.

Without Firebase configuration the app displays setup instructions. With the emulator flag enabled, accounts and records stay in the local demo project. A successful unconfigured build does not prove a live Firebase connection.

## Implemented features

- Registration, login, logout, password reset, landlord/tenant roles, and tenant email verification.
- Property, room, and inventory create/read/update/delete workflows. Deletion archives records to preserve history.
- Category, condition, quantity, estimated value, search, and room/property filters.
- Multiple image uploads, previews, mobile camera input, and soft photo removal.
- Responsive navigation, mobile inventory cards, validation, empty states, and request errors.
- Tenancy creation/editing, status filters, contact details, and historical agreements.
- Immutable check-in/check-out item snapshots, verified tenant confirmation, and before/after comparison with changes highlighted.
- Tenant damage reports with supporting photographs, landlord status updates, notes, and status filters.
- Live dashboard counts, pending actions, recent activity, and property summaries scoped to the signed-in role.

See [development progress](docs/development-progress.md) for phase commits and verification results.

## Verification

```sh
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:rules
```

The corresponding `pnpm` commands run the same scripts. Rule tests require Java 21+ and available emulator ports. The development environment supplied pnpm rather than npm, so equivalent script entry points are used here.

## Project structure

```text
src/app/                 App Router pages and global styles
src/components/          Authentication, navigation, forms, and feature screens
src/lib/                 Domain types, validation, formatting, Firebase repository
tests/                   Domain and Firebase authorization tests
docs/                    Setup, database decisions, and phase tracking
firestore.rules          Private record access and validation
storage.rules            Image access and append-only evidence
```

## Data and retention

Landlords access records by immutable owner ID. Tenant access requires a verified matching email. Inspections store independent snapshots; changing live inventory cannot rewrite a handover. Photo removal detaches metadata while retaining original files for inspection evidence. See [database design](docs/database-design.md) for query choices, access boundaries, and retention limitations.

## Project status

The core inventory, tenancy, inspection, damage-reporting, and dashboard workflows are implemented on local `main`. Final security hardening and documentation review are in progress. GitHub pushes require a remote URL and available GitHub authentication. Production Firebase validation requires the project's public Web configuration; current browser verification uses local emulators.

## Known limitations

- Deletion archives records; there is no restore interface or automatic storage cleanup. Removing a photo keeps historical evidence. Failed or canceled forms can leave unattached Storage files.
- One immutable check-in and one check-out are supported per tenancy, with at most 400 inventory records in each inspection.
- Tenancy email/property are fixed after creation. Statuses and dates are managed manually. Email is required to link a tenant account.
- Tenant access requires a verified matching email. Previously obtained Firebase download URLs remain usable by anyone holding the URL.
- The client supplies timestamps and snapshot text; trusted audit timestamps, complete server-side snapshot enforcement, and expiring image links require a backend.
- Production email delivery, domain setup, Storage integration, and real mobile camera capture need verification in a configured Firebase project.

These choices and access boundaries are explained in [database design](docs/database-design.md).

## Future improvements

QR inventory labels, PDF handover reports, maintenance history, email notifications, a PWA, inventory templates, and richer before/after comparisons. These are outside the MVP scope.
