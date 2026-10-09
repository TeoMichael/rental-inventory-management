# Firebase setup

## Create the project

1. Create a Firebase project and register a Web app in the [Firebase console](https://console.firebase.google.com/).
2. Enable Authentication → Sign-in method → Email/Password. Add the deployed site's domain to Authentication's authorized domains. Add `localhost` for local development if it is not already listed.
3. Create the default Cloud Firestore database in a suitable region. Start with locked rules, then deploy this repository's rules.
4. Enable Cloud Storage. Select the appropriate region and use the Blaze plan required by Firebase for Storage. Use the bucket name shown in the console rather than assuming an `appspot.com` suffix.
5. Copy `.env.example` to `.env.local` and fill in the Web app's public configuration:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=your-web-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-console-bucket-name
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false
```

The Web configuration identifies the Firebase project and is intentionally public. Security Rules protect the data. Never put service-account keys, private signing keys, or admin credentials in `NEXT_PUBLIC_` variables. `.env.local` and other actual environment files are ignored by Git; only the empty example is tracked. The messaging sender ID is included for completeness and is not used by this MVP.

Restart Next.js after changing environment variables. Without configuration, the application presents setup guidance and can still build; that does not verify a live Firebase connection.

## Deploy access rules and indexes

From the repository root with Node.js, npm, and the dependencies installed:

```sh
npx firebase login
npx firebase deploy --project YOUR_PROJECT_ID --only firestore:rules,firestore:indexes,storage
```

The repository does not select a production project implicitly. `firebase.json` points to `firestore.rules`, `firestore.indexes.json`, and `storage.rules`. During the first Storage deployment, Firebase may ask to authorize Storage Rules to access Firestore; approve that product integration for this project. Wait for the inventory composite indexes to finish building before exercising tenant room/item queries.

Use the committed rules rather than open test-mode rules. Landlord access is scoped by immutable `ownerId`; tenant data requires verified matching email. New tenants must register with the exact email invited by the landlord and verify the email before accessing inventory, confirming check-in, or reporting damage. Refresh the app's verification state after following the emailed verification link.

## Local emulators

Install a current Java runtime supported by Firebase's Firestore emulator (Java 21 or later) and keep `java` on `PATH`. The first run downloads emulator binaries and requires network access. The repository binds local emulators to loopback only:

| Service        | Address          |
| -------------- | ---------------- |
| Authentication | `127.0.0.1:9099` |
| Firestore      | `127.0.0.1:8080` |
| Storage        | `127.0.0.1:9199` |

Start all three when manually exercising the app:

```sh
npx firebase emulators:start --project demo-rental-inventory --only auth,firestore,storage
```

Use local-only `.env.local` values, then restart the app:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=demo-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-rental-inventory.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-rental-inventory
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-rental-inventory.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:demo
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
```

These values target a `demo-` project and do not authorize production access. The Authentication emulator prints email verification links in its terminal output. Emulators do not persist data across runs unless explicitly started with import/export options. Never enable `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` for a deployed site.

To retain a local demo, start with `--export-on-exit .firebase/demo-export` and later add `--import .firebase/demo-export`. Export needs a graceful shutdown; an interrupted process can lose in-memory records. Keep exports outside Git because they may contain account and record data.

## Rule verification

```sh
npm run test:rules
```

This command starts only the Firestore and Storage emulators with the isolated `demo-rental-rules` test project, runs Vitest authorization tests, then shuts the emulators down. It does not need real project credentials. Avoid another emulator instance using the same ports. The tests clear only that test project's Firestore data and Storage bucket. They cover unauthorized reads/writes, private invitation lists, archived inventory, ownership and role tampering, tenant email verification, parent consistency, atomic snapshots, check-out ordering, tenant confirmation, damage-report integrity, and Storage upload validation/retention.

When emulators are already running with `--project demo-rental-rules`, use `npx vitest run --config vitest.rules.config.mts` directly rather than starting another instance. Stop the manual app's `demo-rental-inventory` emulator instance before starting the rules suite on the same ports; export its demo data first if you want to keep it. Storage rules perform Firestore lookups, so the test project ID must match the emulator CLI's project ID for cross-service checks. Separate projects alone do not isolate those cross-service lookups within one running Storage emulator.

Avoid parallel Storage emulator instances even on different ports: Firebase CLI 15.33 uses a shared temporary blob directory, which an instance removes on shutdown. Separate instances need separate process `TEMP`/`TMP` directories.

Unit tests, lint, and a production build are separate checks. Emulator tests validate deployed-rule behavior, not billing, production domain setup, email delivery, real-camera behavior, or production Storage integration. Perform those checks in a configured Firebase project before deployment.

See [database-design.md](database-design.md) for retained images, download-URL access, archival semantics, and the boundaries of browser-only integrity checks.

Firebase references: [email/password authentication](https://firebase.google.com/docs/auth/web/password-auth), [Storage setup](https://firebase.google.com/docs/storage/web/start), [emulator installation](https://firebase.google.com/docs/emulator-suite/install_and_configure), [rule unit testing](https://firebase.google.com/docs/rules/unit-tests).
