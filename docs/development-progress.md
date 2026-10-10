# Development progress

Started 9 October 2026. The workspace was empty, without Git history, a remote, or Firebase configuration. Initialized local `main` and selected current stable Next.js 16.4.0 from the npm registry.

The phase and frozen-release entries below record facts at those checkpoints. GitHub publication and production migration status are recorded separately at the end; historical test counts and the `v0.1.0-mvp` tag are unchanged.

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

## Free production infrastructure migration — 9 October 2026

Status: Local ImageKit integration complete and pushed as `d45e638` on `chore/free-production-infrastructure`. Live owner inventory/handover workflows, tenant registration and real email verification, tenant confirmation/evidence, owner repair management, completed tenancy revocation/retention, mobile controls and 37 fresh live security checks passed through the local production build. Cloudflare authentication is complete; Linux build/deployment and verification on the deployed URL remain pending.

The frozen `v0.1.0-mvp` tag and `main` resolve to `5de01de`. The baseline is published in the private [GitHub repository](https://github.com/TeoMichael/rental-inventory-management). Infrastructure changes remain isolated on the migration branch; main merge and `v0.1.1` follow successful Cloudflare deployment and verification. No Cloudflare application URL is established by the local checks.

Firebase `keyline-rental-inventory-prod` now has ordinary free Email/Password Authentication and default Standard Firestore in `asia-southeast1` (Singapore), with `freeTier: true`. Updated ImageKit-compatible rules and indexes are deployed; independent API verification matches the local rules source, and indexes report ready. API checks still confirm billing disabled and no linked billing account. Console terms-status loading failed; supported CLI provisioning enabled ordinary Auth without a GCIP/billing upgrade.

New uploads use a private `/api/photos` ImageKit proxy, Firebase Auth REST validation, and Firestore reads under the user's token. Owner/verified Active-tenant authorization, controlled UID paths, 8 MiB JPEG/PNG/WebP limits, strict provider response validation, legacy compatibility, immutable evidence, and retained partial uploads are implemented. New responses keep the frozen `{id, path, name, url, createdAt}` metadata; ImageKit's file ID is checked on the server and not persisted. Strict optional paired metadata remains supported for earlier verification records. OpenNext 1.20.10 targets full Next.js on Workers Free with `ASSETS` only. Public Firebase `.env.local` settings and ignored `.dev.vars` runtime ImageKit settings remain separate; a preflight rejects private keys in `.env*` or build process variables.

Latest verification: lint, TypeScript, the Next.js production build, 96 application tests and all 40 Firestore/legacy Storage rules tests passed: 136 total. The application suite includes rejection of whitespace-only ImageKit file IDs. Production build output includes dynamic `/api/photos` and `/properties/[id]` routes. A scan of 82 Git candidate files and 25 built client files found no private key. Native Windows OpenNext packaging failed with `EPERM` creating the pnpm `@next/env` symlink. No application Worker output/preview was completed. The free Cloudflare Workers Builds pipeline is now connected; its first Linux application build/deployment remains pending.

### Live integration checkpoint — 10 October 2026

The user authenticated ImageKit and completed its key-reveal verification. The dashboard confirms Forever Free as the current $0 plan. Runtime settings are stored only in ignored `.dev.vars`; the private key was not printed or committed. The local development launcher now loads that file without Node CLI environment flags, which Next.js restart rejected.

The real owner registration, property and room creation, and two ImageKit uploads succeeded through the existing UI and authenticated proxy. Both returned canonical metadata and decoded as 720-pixel images in browser previews. Disposable second-owner/tenant accounts also verified cross-owner Firestore/upload denial and protected profile roles through user-token requests.

Saving two ImageKit photos exposed Firestore's 1,000-expression evaluation limit. The earlier rules tests missed this boundary. The correction keeps new uploads in the frozen five-field metadata format and validates ImageKit's file ID only on the server, while retaining strict optional paired metadata for earlier verification records. Local rules preserve the original UTF16 bounds and required fields, and regressions now accept ten five-field photos in inventory, immutable check-in/check-out snapshots, and tenant damage reports. Checks also reject invalid last photos, excess photos, replaced fields, and tampered historical evidence.

The 40-rule suite and 96 application tests passed: 136 tests total. The rules suite includes a mixed record with two earlier paired photos plus eight new-format photos. The normal `pnpm test:rules` script passed again with an isolated override after emulator configuration cleanup. Updated production rules and indexes are deployed. Independent API verification matched the local rules SHA-256 `0adc99ff66c8da79fa06027f53f97c1a68d45230c068184b9b3887bcaab03654`; billing remains disabled with no linked account, and indexes report ready.

Real user-token requests saved/read back two and ten mixed-photo item records and rejected malformed final metadata with HTTP 403. The two-photo owner item saved in the existing UI; reloading displayed both 720-pixel images. A third actual upload returned the frozen five fields and saved alongside the two earlier paired photos. The owner created an Active tenancy and saved check-in with all three photos, then changed the live condition from Good to Damaged and detached one original photo before saving check-out with two. Comparison displayed Good with three photos and Damaged with two; all five 720-pixel thumbnails loaded, including the detached original. The changes-only filter passed. At a 390 × 844 mobile viewport, comparison and forms remained scrollable without horizontal overflow, inventory navigation worked, and Add photos/Take photo inputs were enabled with `capture="environment"`. Actual device hardware capture is unverified.

The registered tenant verified the real email and logged in with a fresh session to assigned records. Check-in confirmation passed. A real supporting photo returned five-field metadata, saved with a damage report through the existing UI and reloaded as a 720-pixel image. The owner changed the report to Repairing and added a repair note, which the tenant could read. After the owner completed the tenancy, tenant live inventory cleared without an error. The report, repair note and 720-pixel evidence remained readable; mobile report history had no horizontal overflow. Inspection comparison still showed Good with three photos and Damaged with two, with all five 720-pixel thumbnails loaded.

All 37 fresh live security/retention checks passed: the first 23 included nine forbidden writes returning HTTP 403 and immutable roles, and 14 further checks covered completed-tenant history and upload denials. Completed-tenant property/item reads and uploads returned HTTP 403; unauthenticated uploads returned 401, cross-owner uploads 403, spoofed PNG input 400 and an 8 MiB + 1 byte PNG 413. Both snapshots and the Repairing report/note remained readable. Supporting metadata had exactly the frozen five keys, and the retrieved photo matched the uploaded fixture in memory. These checks made no additional successful uploads or data writes. The earlier two/ten-photo persistence checks also passed. Local ImageKit integration is complete against the local production build and live Firebase/ImageKit; these results do not establish a deployed Cloudflare application.

Production `firebase.json` now has Auth/Firestore configuration only, with no Storage deployment or emulator section. Historical Storage rules remain, and `pnpm test:rules` selects the separate `firebase.emulators.json` configuration for Firestore/Storage regressions.

Actual camera capture, deployed email/domain/privacy flows, Cloudflare CPU/request behavior, deployment and verification on its URL remain pending. Main merge and `v0.1.1` follow those checks. No credit card, billing account, paid binding, or automatic upgrade is authorized. See [production deployment](production-deployment.md).

### Cloudflare account checkpoint — 10 October 2026

The ImageKit migration commit `d45e638` is pushed to `chore/free-production-infrastructure`. Frozen `main` and the immutable `v0.1.0-mvp` tag remain at `5de01de`; no merge or new release tag has occurred. The completed local checks remain 136 automated tests and 37 fresh live security/retention checks.

The user completed Cloudflare authentication. Wrangler OAuth succeeded with the narrow account/user read, Worker script write, tail read and offline access scopes. The dashboard confirms Workers Free at $0, with 100,000 requests/day, 10 ms CPU per HTTP invocation and 3,000 build minutes/month. The account already has the `tripd04-nmc.workers.dev` subdomain.

Ignored `.dev.vars` values were piped privately into `wrangler secret bulk`, creating the minimal draft `keyline-rental-inventory` Worker and encrypted runtime `IMAGEKIT_PRIVATE_KEY` and `IMAGEKIT_URL_ENDPOINT` secrets. Secret listing confirms their names and types without revealing values. The draft has no active routes or public application deployment; it does not establish build or application readiness.

The user authorized the official Cloudflare Workers and Pages GitHub App for only `TeoMichael/rental-inventory-management`. The Workers Builds connection was submitted successfully and the dashboard confirms that repository, production branch `chore/free-production-infrastructure`, repository root `/`, build command `pnpm cloudflare:build`, deploy command `pnpm exec opennextjs-cloudflare deploy -- --keep-vars`, and disabled preview builds. Saved build variables include `NODE_VERSION=24.19.0`, `PNPM_VERSION=11.25.0`, public Firebase values and emulator flag `false`; they contain no ImageKit values.

The automatic broad build token was not created. The user created `Keyline free production builds` with this account's Workers Scripts Edit and Account Settings Read, plus User Details Read and Memberships Read, then separately approved Workers Builds Configuration Edit. The extra permission was required to register the user token in the separate Builds token registry; the narrow Wrangler OAuth returned HTTP 403 for that registry. Private registration returned HTTP 200, and the saved pipeline selects this token. Its temporary local credential file was removed; no credential value was printed or committed. Missing permissions for unused Cloudflare products are expected and were not granted. The dashboard reports that the first build starts on a Git push; no Linux application build or deployment has run yet. Next, push this checkpoint, inspect the Linux build/deployment, then verify the actual application URL. ImageKit secrets remain runtime-only. No card, paid plan, paid binding, or automatic upgrade was enabled.

### First Linux deployment and adapter correction — 10 October 2026

CI checkpoint `a3ca252` is pushed. Build `4bd4d427-6d95-4938-910c-3312c14f85b5` installed Node 24.19.0 and pnpm 11.25.0, used `pnpm install --frozen-lockfile`, packaged Next.js 16.4.0 with OpenNext 1.20.10, and deployed successfully in 75 seconds. Worker version `b0c688f3-a81c-461a-bfa1-0ef7706ef13c` serves `https://keyline-rental-inventory.tripd04-nmc.workers.dev`. The upload was 6,992.82 KiB uncompressed / 1,427.88 KiB gzip, with 16 ms startup time. Only `ASSETS` and the two encrypted ImageKit runtime secrets are configured; no paid bindings were added.

The public app redirects logged-out visitors to login, and the existing real landlord signed in to the correct dashboard. The deployed 7,160,646-byte Worker module and 18 public HTML/JS resources contain no ImageKit private key. Firebase Auth now authorizes the deployed hostname, preserving its previous domains and Email/Password configuration.

Public verification exposed an adapter compatibility defect: `/api/photos` returned HTTP 500 instead of the expected completed-tenant HTTP 403. A sanitized real-time tail identified `Unexpected loadManifest(/.next/server/preview-props.json) call!`, with 3 ms CPU and 4 ms wall time; this was an exception, not CPU exhaustion. Next.js 16.4 requires this real manifest. OpenNext 1.20.10 is still the registry's current release and omits it from its glob. The [upstream one-line correction](https://github.com/opennextjs/opennextjs-cloudflare/pull/1356) is applied as a version-specific pnpm patch, preserving the app's Next.js version. A direct adapter regression confirms the exact synthetic preview properties are inlined and unknown required manifests still throw. Frozen-lockfile installation passes. Explicit `preview_urls: false` also prevents automatic version preview URLs. Redeployment and complete public workflows/CPU verification remain pending; main and `v0.1.0-mvp` are unchanged and `v0.1.1` is not created.

The adapter fix is tested, committed and pushed as `6beaf43`. Linux build `459c98e3-7c1a-41ee-99c1-37230d25ec8d` deployed version `97c971c0-0c14-4923-88a0-a0c4e869343c`. The manifest exception is gone, but the completed-tenant upload check now returns the existing Firebase-verification HTTP 503 response. Encrypted runtime secrets remain present, and the updated Worker/18 public resources still contain no ImageKit private key. A cold POST recorded 112 ms CPU / 120 ms wall time; three page requests recorded 14/2/4 ms CPU. These samples do not establish suitability for the 10 ms Free limit. The public comparison retained all five 720-pixel images and the changes-only filter passed. Credential-redacted upstream failure diagnostics and a privacy regression are prepared to identify the new failure; lint, TypeScript and all 97 application tests passed. Public upload/CPU verification and release remain unfinished.
