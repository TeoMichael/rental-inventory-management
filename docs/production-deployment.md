# Free production deployment

The `chore/free-production-infrastructure` migration branch is separate from frozen `main` at `5de01de` in the private [GitHub repository](https://github.com/TeoMichael/rental-inventory-management); `v0.1.0-mvp` identifies that baseline. The local ImageKit integration phase is complete, and production Firestore rules/indexes are deployed. Cloudflare authentication/application deployment, verification on the deployed URL, main merge and `v0.1.1` remain pending.

## Current checkpoint

| Component  | Verified state                                                                                                                                                         | Still required                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Firebase   | Email/Password and default Singapore Firestore; rules/indexes deployed; local owner/tenant workflows and revocation; 37 fresh live security checks; no billing account | Domains, deployed email actions and complete deployed verification                           |
| ImageKit   | Forever Free $0 confirmed; real owner/tenant uploads and saved evidence; historical snapshot photos retained                                                           | Actual device camera capture and deployed quotas                                             |
| Cloudflare | OpenNext 1.20.10 configured for full Next.js with `ASSETS`                                                                                                             | User authentication, Linux build, Free plan confirmation, preview/deployment and CPU testing |
| Tests      | Lint, TypeScript, Next.js build and 136 tests passed; rules script rerun after config cleanup; mobile controls checked                                                 | Worker packaging and deployed verification                                                   |
| Release    | Frozen MVP published on main; infrastructure migration isolated on its branch                                                                                          | Verified deployment, merge and `v0.1.1`                                                      |

Cloudflare authentication is the remaining user-controlled account checkpoint. ImageKit authentication and key verification are complete. Do not add a card, enable billing, choose an automatic paid upgrade, or provision paid bindings. Quotas can stop service; budget alerts do not make paid services free.

## Secrets and public build settings

| Setting                              | Local development/preview                                                                                            | Production                                                  |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `NEXT_PUBLIC_FIREBASE_*`             | Public `.env.local` values                                                                                           | Public build variables matching production Firebase         |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` | `true` only for local demo Auth/Firestore                                                                            | `false`                                                     |
| `IMAGEKIT_PRIVATE_KEY`               | Ignored `.dev.vars`, loaded by Node 24 `pnpm dev` or Wrangler preview; development-only process injection also works | Cloudflare runtime secret                                   |
| `IMAGEKIT_URL_ENDPOINT`              | Ignored `.dev.vars`                                                                                                  | Runtime configuration set through the secret mechanism here |

Copy blank `.dev.vars.example` into `.dev.vars` and fill it locally. Keep both ImageKit variables out of **every `.env*` file**. The installed OpenNext adapter serializes those files into `cloudflare/next-env.mjs`, including values without a public prefix. Runtime overrides do not remove an embedded copy. The preflight rejects nonempty private keys in `.env*` or the build process; build in a clean process with private values available only as runtime bindings. [OpenNext compiler](https://github.com/opennextjs/opennextjs-cloudflare/blob/main/packages/cloudflare/src/cli/build/open-next/compile-env-files.ts), [Local secrets](https://developers.cloudflare.com/workers/local-development/environment-variables/).

After Cloudflare authentication and Free plan confirmation, set secrets through interactive prompts rather than command-line values:

```sh
pnpm exec wrangler secret put IMAGEKIT_PRIVATE_KEY
pnpm exec wrangler secret put IMAGEKIT_URL_ENDPOINT
```

The dashboard equivalent is the Worker's runtime **Settings → Variables and Secrets**. Do not add the private key to Workers Builds build variables/secrets: it is needed only by the deployed request handler. Keep keys out of logs, screenshots, tracked config, browser code, and release descriptions. The proxy needs no Firebase admin/service-account credentials.

## Upload authorization and retention

`POST /api/photos` receives the user's Firebase token and one image. Firebase Auth REST validates the account; Firestore REST reads profile/property/tenancy under that token, preserving Security Rules. Landlords must own an unarchived property. Tenants require a verified matching email and an Active, unarchived tenancy.

The server bounds the body at 8 MiB, accepts JPEG/PNG/WebP, checks signatures against MIME type, generates the UID-scoped path, and privately authenticates to ImageKit. New metadata retains the frozen `{id, url, path, name, createdAt}` format. ImageKit's file ID is validated on the server and is not persisted for new uploads. Earlier verification photos with paired `provider: "imagekit"` and `fileId` remain strictly compatible.

Real owner uploads confirmed response path/URL/type/size checks and decoded previews. Saving the earlier paired metadata exposed Firestore's 1,000-expression limit. The correction preserves UTF16 string bounds and strict schemas, and regressions accept ten five-field photos across inventory, inspections and reports, including two earlier paired photos plus eight new-format photos. Updated rules are deployed and independently verified against the local source. Live requests saved/read back two and ten mixed photos and rejected malformed final metadata. Owner check-in/check-out comparison retained all five 720-pixel thumbnails after a live condition change and photo detachment; the changes-only filter passed.

A registered tenant verified the real email, logged in to assigned records, confirmed check-in, and uploaded a five-field supporting photo through the damage-report UI. Saving and reloading retained its 720-pixel image. After the owner completed the tenancy, live inventory cleared without an error; the Repairing report, owner note, evidence and both inspection snapshots remained readable. Comparison retained all five 720-pixel thumbnails. Mobile report history had no horizontal overflow.

All 37 fresh live security/retention checks passed, including nine forbidden writes and immutable roles. Completed-tenant property/item reads and uploads returned HTTP 403; unauthenticated uploads returned 401, cross-owner uploads 403, spoofed PNG input 400 and an 8 MiB + 1 byte PNG 413. These checks used the local production build and live Firebase/ImageKit; the deployed Cloudflare application still needs verification.

URLs are public CDN capabilities, not tenant-authenticated image delivery. Anyone holding one can read it after tenant access ends. Removal detaches metadata; originals, canceled-form uploads, partial successes, and uncertain-response uploads remain. There is no physical-delete endpoint or automatic cleanup. Legacy Firebase URLs need the old bucket to remain available; existing images are not copied by this migration.

## Free-plan limits

| Service               | Current allowance                                                                                          | Consequence                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Firebase Auth         | Enabled Email/Password on Spark with billing disabled                                                      | No paid GCIP initialization, phone or MFA configuration                                                    |
| Firestore             | One free database; 1 GiB stored; 50,000 reads, 20,000 writes and 20,000 deletes/day; 10 GiB outbound/month | Shared across users/listeners; daily quota resets around midnight Pacific                                  |
| ImageKit Forever Free | 3 GB total DAM storage; 20 GB bandwidth/month                                                              | Retained files use storage; exceeded free inclusions stop relevant functionality                           |
| Workers Free          | 100,000 requests/account/day; 10 ms CPU per HTTP invocation                                                | Requests reset midnight UTC; network wait is excluded, but Next.js and image buffering/validation must fit |

[Firebase pricing](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), [Firestore quotas](https://firebase.google.com/docs/firestore/quotas), [ImageKit plans](https://imagekit.io/plans/), [ImageKit quota behavior](https://imagekit.io/docs/how-pricing-works), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

Direct static assets have free requests/storage; invoking a Worker for assets counts against its quota. Workers Caching requests also use Worker pricing, including cached static assets. Configuration uses only `ASSETS`, with no R2, D1, KV, Queues, Images, or other service bindings. Real preview/deployment must confirm behavior and CPU, especially an 8 MiB upload. Do not solve CPU failure with an unauthorized paid plan. [Asset billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

## Build environment

Final lint, TypeScript and the Next.js production build passed, including dynamic `/api/photos` and `/properties/[id]` routes. A scan of 82 Git candidate files and 25 built client files found no private key. Native Windows OpenNext packaging failed with `EPERM` while creating the pnpm `@next/env` symlink. No completed Worker output or local Cloudflare preview was produced. Use a supported Linux environment before claiming deployment readiness.

Cloudflare Workers Builds is a possible Linux path after account authentication and branch publication. Free Builds allows 3,000 build minutes/month with a 20-minute build timeout; verify the account remains Free. Connect `chore/free-production-infrastructure` as the initial production build branch after integration is ready. Set `NODE_VERSION=24.19.0` and `PNPM_VERSION=11.25.0`, build command `pnpm cloudflare:build`, and deploy command `pnpm exec opennextjs-cloudflare deploy -- --keep-vars` to avoid rebuilding and preserve dashboard runtime variables. Supply public Firebase variables to the build and ImageKit values only as runtime secrets. This CI connection has not been configured. [Build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), [Build limits/pricing](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/).

## Remaining verification and release

1. Complete user Cloudflare authentication and confirm Free with no card/paid bindings. Connect the migration branch to the Linux build/deploy pipeline, public Firebase build settings and ImageKit runtime secrets. Keep production emulator flags off; confirm rules/index readiness. Production `firebase.json` contains Auth/Firestore only; historical Storage regressions use `firebase.emulators.json` and all 40 rules tests passed again after cleanup.
2. Package successfully on Linux, inspect output for private values without printing them, smoke test an available preview, and deploy. Native Windows packaging has not established readiness.
3. Add the deployed hostname to Firebase Auth. Verify registration, verification/reset emails, inventory, snapshots/confirmation/comparison, reports, tenant revocation, privacy and realistic upload CPU on the actual URL. Exercise actual device camera capture; mobile controls and `capture="environment"` availability passed at a 390 × 844 viewport. Record the URL, checks, quotas and remaining limits.
4. Only after successful production verification, merge preserving history to main, push main and create/push annotated `v0.1.1`. Then switch the production build branch to main. Never move or overwrite `v0.1.0-mvp`.

These are remaining steps, not a claim of completed deployment or release.
