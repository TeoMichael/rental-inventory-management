# Firebase setup

This guide covers the active free-infrastructure migration. The immutable [v0.1.0 baseline](release-v0.1.0.md) used Firebase Storage; new uploads use the server ImageKit proxy. Storage rules and emulator tests remain for historical protection. No production Storage bucket, paid Firebase feature, or billing account is required by the migration.

## Current production project

`keyline-rental-inventory-prod` has Web app `1:401046214045:web:8862e7ce62363252858b74`. Ordinary Email/Password Authentication is enabled. Default Firestore uses Standard edition in `asia-southeast1` (Singapore) and reports `freeTier: true`. API checks confirm billing disabled and no linked account. Updated ImageKit-compatible Firestore rules and indexes are deployed; an independent API check matches the local rules source, and composite indexes are ready. The correction preserves UTF16 bounds and strict schemas while accepting ten five-field photos across inventory, inspections, and reports. All 40 rules tests passed, including mixed paired/five-field metadata, and the script passed again after configuration cleanup. Owner uploads, inventory, check-in/check-out and retained snapshot photos passed. A registered tenant verified the real email, accessed assigned records, confirmed check-in and saved/reloaded real ImageKit report evidence. After tenancy completion, live inventory cleared and new uploads were denied, while snapshots, the Repairing report, owner note and images remained readable. All 37 fresh live security/retention checks passed; live requests also saved/read back two and ten mixed photos and denied malformed metadata. The local ImageKit phase and public Cloudflare owner/tenant workflows are complete against these live backends. The public hostname is authorized, the reset request passes as designed, and the real verified tenant was reused without bypass. Fresh API inspection confirms billing disabled, no linked account, Standard Firestore in Singapore, ready indexes and deployed rules matching local SHA-256 `0adc99ff66c8da79fa06027f53f97c1a68d45230c068184b9b3887bcaab03654`. Final hosting verification is pending because Cloudflare near-limit uploads exceed its Free CPU allowance. Render Free is prepared as a no-card fallback; add its actual hostname to Auth only after deployment, preserving current domains.

The console encountered a terms-status loading problem. Auth was enabled through supported free CLI provisioning. Do not initialize Identity Platform or link billing as a workaround. Firebase's [Terraform codelab](https://firebase.google.com/codelabs/firebase-terraform) distinguishes ordinary free Authentication from GCIP setup requiring Blaze.

## Configure another Spark project

Register a Web app in the [Firebase console](https://console.firebase.google.com/). Enable Email/Password in Authentication, or use the documented CLI path, selecting Email/Password only:

```sh
pnpm exec firebase init auth --project YOUR_PROJECT_ID
pnpm exec firebase deploy --only auth --project YOUR_PROJECT_ID
```

The CLI may offer a free default Hosting site for Auth handlers; the application can still be hosted on Cloudflare. Preserve existing Firestore settings when initializing Auth. [Password-auth guide](https://firebase.google.com/docs/auth/web/password-auth), [CLI release notes](https://firebase.google.com/support/release-notes/cli).

List databases before creating the first one. Do not create additional databases or enable PITR, backups, TTL, restore, or clone:

```sh
pnpm exec firebase firestore:databases:list --project YOUR_PROJECT_ID
pnpm exec firebase firestore:databases:create "(default)" --location asia-southeast1 --edition standard --point-in-time-recovery DISABLED --project YOUR_PROJECT_ID
pnpm exec firebase deploy --only firestore:rules,firestore:indexes --project YOUR_PROJECT_ID
```

The first database has free quota; additional databases and those features require billing. New databases start with closed rules. Await index readiness before tenant checks. Deploy only Firestore rules/indexes. Production `firebase.json` contains Auth/Firestore configuration only. Historical Storage rules and emulator checks use the separate `firebase.emulators.json` configuration and do not require a production bucket. [Database management](https://firebase.google.com/docs/firestore/manage-databases), [Free quota](https://firebase.google.com/docs/firestore/pricing).

## Public application settings

Copy `.env.example` to `.env.local` and fill the public Web configuration:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=your-web-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=keyline-rental-inventory-prod.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=keyline-rental-inventory-prod
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=401046214045
NEXT_PUBLIC_FIREBASE_APP_ID=1:401046214045:web:8862e7ce62363252858b74
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false
```

The Web API key identifies the project; rules protect the data. No admin/service-account credentials are needed. Keep private ImageKit settings out of every `.env*` file because OpenNext embeds file values in build output. Use ignored `.dev.vars` locally and Cloudflare runtime secrets in production; see [production deployment](production-deployment.md). Restart after public settings change.

Add the eventual deployed hostname to Auth authorized domains and verify email action URLs. Tenants must use the invited email and verify it before inventory access, confirmation, or reporting. Refresh verification after following the link. The live test tenant's email is verified; deployed email action/domain checks remain pending.

## Local emulators and rule verification

Java 21+ must be on `PATH`; the first run downloads binaries. The active app needs Auth at `127.0.0.1:9099` and Firestore at `127.0.0.1:8080`:

```sh
pnpm exec firebase emulators:start --project demo-rental-inventory --only auth,firestore
```

Use a `demo-` project, matching public placeholder settings, and `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`. Never deploy with that flag enabled. Auth prints verification links. Persist data only with explicit import/export options; keep exports ignored and shut down gracefully.

Image uploads are not Firebase-emulated on this branch. They need real ImageKit configuration and consume its quota even with emulated Auth/Firestore. Historical Storage verification uses `firebase.emulators.json`, which adds Storage at `127.0.0.1:9199` without restoring a production Storage dependency.

```sh
pnpm test:rules
```

The script selects `firebase.emulators.json`, uses `demo-rental-rules`, starts Firestore/Storage, runs authorization tests, and stops them. It clears only the test project's data and needs no production credentials. All 40 rules tests passed, including a script rerun with an isolated override after configuration cleanup. Coverage includes private grants, ownership, verification, archives, immutable snapshots/reports, legacy Storage protection, optional paired ImageKit metadata, ten-photo records, required fields, and UTF16 bounds. This includes a mixed record with two earlier paired photos and eight five-field photos. The updated rules are deployed and local owner/tenant workflows against live backends are verified; emulator results alone do not establish complete production readiness.

Parallel Storage emulators need separate ports and process `TEMP`/`TMP`; the CLI otherwise shares temporary blobs. On this workspace, the isolated config is ignored at `.firebase/security-emulators.json`:

```powershell
$env:PATH = 'D:\Java\bin;' + $env:PATH
$env:RULES_FIRESTORE_PORT = '8180'
$env:RULES_STORAGE_PORT = '9299'
$testTemp = Join-Path (Get-Location) '.firebase/imagekit-rules-temp'
New-Item -ItemType Directory -Path $testTemp -Force | Out-Null
$env:TEMP = $testTemp
$env:TMP = $testTemp
pnpm exec firebase emulators:exec --config .firebase/security-emulators.json --project demo-rental-rules --only firestore,storage "pnpm exec vitest run --config vitest.rules.config.mts"
```

Use default ports if that local config is absent. Firestore/Storage must share the test project ID for cross-service lookups. Emulator tests do not verify production email, billing, image hosting, domains, or deployed browser behavior.
