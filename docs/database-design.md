# Database design

The MVP uses the default Firestore database and flat top-level collections. IDs are also stored in each record for consistent client models. `ownerId` always identifies the landlord, including records created by tenants. `createdAt`, `updatedAt`, and inspection times are ISO UTC strings; tenancy dates use `YYYY-MM-DD`. Dates are validated by the client and bounded/formatted by the rules. They are client-supplied timestamps rather than trusted server audit times.

| Collection | Main relationships | Application query |
| --- | --- | --- |
| `users` | Firebase Authentication UID | Read own UID only |
| `properties` | `ownerId`, `tenantEmails` | Landlord: `ownerId == uid`; tenant: `tenantEmails array-contains email` and `archived == false` |
| `rooms` | `ownerId`, `propertyId` | Landlord: `ownerId == uid`; tenant: `propertyId in granted IDs` |
| `items` | `ownerId`, `propertyId`, `roomId` | Same scope as rooms |
| `tenancies` | `ownerId`, `propertyId`, `tenantEmail` | Landlord: `ownerId == uid`; tenant: `tenantEmail == verified token email` |
| `inspections` | `ownerId`, `propertyId`, `tenancyId`, `tenantEmail` | Same scope as tenancies |
| `inspectionItems` | Inspection, tenancy, property, historical item ID | Same scope as tenancies |
| `damageReports` | Tenancy, property, current item, reporter UID | Same scope as tenancies |

Owner queries use a single equality filter and sort/filter in the client. The tenant property query has a declared composite index. Photo arrays are not indexed. Tenant room/item listeners split granted property IDs into small groups to stay within Firestore rule document-access limits. A listener reads the complete authorized collection scope, so pagination is a future scalability improvement.

## Ownership and tenancy membership

A user chooses `landlord` or `tenant` during registration. The `users` role and email cannot be changed by the client after creation; users can edit only their own name. The profile email must initially match the authenticated token. No admin role exists. Tenant reads require both the tenant role and a verified Authentication email matching the immutable profile email. Guessing another tenancy's email during signup does not grant access before verification.

Landlords can read and manage only their own inventory. Rules validate parent property ownership and room/property consistency when inventory changes. Record IDs, ownership, creation time, and property relationships are immutable. An item may move to another room within the same property. A tenancy's email and property cannot be edited; correcting those requires creating a new tenancy.

`properties.tenantEmails` is a landlord-maintained authorization projection for current inventory. The repository updates it in the same transaction as tenancy creation/status changes. Upcoming and Active tenancies grant access. Completed and Cancelled tenancies lose live-property access unless another current tenancy grants it. The array supports at most 200 distinct emails per property. Rules require a matching grant when an Upcoming/Active tenancy is written, but do not enumerate all tenancy documents to prove the entire projection. The authorized landlord controls invitations and may grant a verified email access.

Tenancies, inspections, snapshots, and reports also carry immutable `tenantEmail`, allowing historical records to remain readable to that verified tenant after live-property access ends. This access includes the original tenancy's contact information and reports, not unrelated records belonging to the same landlord.

## Immutable handover records

Inspection IDs are deterministic: `{tenancyId}_check-in` and `{tenancyId}_check-out`. Rules deny landlord updates, so a second create cannot overwrite the original. The repository checks that a check-in exists before check-out.

Each inspection item has ID `{inspectionId}_{itemId}` and stores item name, room name, quantity, condition, notes, photo metadata, and inspection time. It does not read the live item to display history. Later item edits, archival, or removal of a current photo cannot rewrite the snapshot.

The repository reads and validates current inventory, then creates the inspection and all snapshots atomically. Snapshot rules use `getAfter` to require a new matching parent inspection in that same transaction. Late snapshot additions and all snapshot updates/deletes are denied. The limit is 400 snapshot records per inspection, leaving room below Firestore's write limit. Rules intentionally validate the historical item ID as a scalar reference instead of reading every live item: per-item rule reads would exceed the atomic request document-access budget. The authorized landlord supplies snapshot text. Rules cannot enumerate child collections to prove that `itemCount` equals the number of created snapshots; the repository enforces completeness.

Only the verified assigned tenant can confirm an unconfirmed check-in. The update may change only `confirmed`, `confirmedAt`, `confirmedBy`, and `updatedAt`. Confirmation is one way; landlords cannot preconfirm an inspection on creation. Check-out records cannot be tenant-confirmed.

## Damage reports

Only a verified assigned tenant with an Active, unarchived tenancy may create a report. Rules verify the tenancy, property, owner, reporter UID, current item/property relationship, and item-name snapshot. New reports must start as `Reported` with empty owner notes. The report body, item, tenant identity, and photos are then immutable. The landlord may change only status, owner notes, and update time. Statuses are `Reported`, `Checking`, `Repairing`, and `Resolved`.

## Archival and image retention

The delete controls archive properties, rooms, and items. Client hard deletion and unarchival are denied. Property archival revokes live tenant membership and hides the property and its inventory in the application. The repository rejects room archival while current items remain; the rules do not enumerate child inventory to enforce that UX safeguard. Existing historical references remain intact. Archived entities are retained, so storage usage is not automatically reclaimed.

Photos are uploaded to `properties/{propertyId}/{uploaderUid}/{photoId}` and stored in record arrays as `{id, url, path, name, createdAt}`. Records allow up to 10 photos. Storage accepts JPEG, PNG, and WebP uploads of at most 8 MiB, under the uploader's authenticated UID. Landlords must own the property. Tenant uploads include `customMetadata.tenancyId` and require an Active matching verified-email tenancy. Storage uses at most two Firestore document lookups, so role integrity is inherited from the Firestore documents rather than reading the profile again.

Storage files are append-only: overwrites and physical client deletion are denied. Removing a photo detaches it from current inventory while preserving bytes used by older snapshots. Partially successful uploads can leave unattached files; cleanup requires a trusted administrative process with reference checks, which is outside this MVP.

Firebase download URLs contain access tokens. Anyone holding a URL can retrieve the image; ending a tenancy does not revoke previously obtained URLs. The application treats these as private capabilities and does not publish them. Strong URL expiration or revocation would require a trusted delivery service. Storage SDK reads still require ownership/current membership.

## Further hardening

Use a trusted backend if a deployment needs server audit timestamps, enforced complete snapshot counts, automatic orphan-file cleanup, legally binding handover signatures, or strict image-link expiration. The Admin SDK bypasses Security Rules, so privileged scripts require separate authorization and care. These are documented boundaries, not guarantees supplied by the browser client.

Firebase references: [atomic transaction rules and access limits](https://firebase.google.com/docs/firestore/manage-data/transactions), [Storage rule conditions and Firestore access](https://firebase.google.com/docs/storage/security/rules-conditions), [query authorization](https://firebase.google.com/docs/firestore/security/rules-query).
