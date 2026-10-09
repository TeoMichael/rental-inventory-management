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

## Implemented foundation

- Registration, login, logout, password reset, landlord/tenant roles, and tenant email verification.
- Property, room, and inventory create/read/update/delete workflows. Deletion archives records to preserve history.
- Category, condition, quantity, estimated value, search, and room/property filters.
- Multiple image uploads, previews, mobile camera input, and soft photo removal.
- Responsive navigation, mobile inventory cards, validation, empty states, and request errors.

The next phases add tenancy and inspection screens, damage reporting, dashboard statistics, and final workflow verification. See [development progress](docs/development-progress.md).

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

The workspace initially had no repository, remote, or Firebase configuration. Development is on local `main`. GitHub pushes and live project validation require a remote URL, available GitHub authentication, and Firebase configuration.

## Future improvements

QR inventory labels, PDF handover reports, maintenance history, email notifications, a PWA, inventory templates, and richer before/after comparisons. These are outside the MVP scope.
