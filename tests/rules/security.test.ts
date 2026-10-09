import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const timestamp = "2026-10-09T00:00:00.000Z";
const tenantEmail = "tenant@example.com";
let environment: RulesTestEnvironment;
const base = (id: string, ownerId = "owner-a") => ({
  id,
  ownerId,
  createdAt: timestamp,
  updatedAt: timestamp,
  archived: false,
});
const property = (id: string, ownerId = "owner-a") => ({
  ...base(id, ownerId),
  name: "Garden apartment",
  address: "1 Garden Street",
  description: "",
  propertyType: "Apartment",
});
const access = (
  id: string,
  ownerId = "owner-a",
  tenantEmails: string[] = [],
) => ({
  id,
  ownerId,
  tenantEmails,
  createdAt: timestamp,
  updatedAt: timestamp,
});
const room = (id: string, propertyId = "property-a", ownerId = "owner-a") => ({
  ...base(id, ownerId),
  propertyId,
  name: "Kitchen",
  description: "",
});
const item = (
  id: string,
  propertyId = "property-a",
  roomId = "room-a",
  ownerId = "owner-a",
) => ({
  ...base(id, ownerId),
  propertyId,
  roomId,
  name: "Refrigerator",
  category: "Appliance",
  quantity: 1,
  condition: "Good",
  description: "",
  estimatedValue: 500,
  photos: [],
});
const tenancy = (id = "tenancy-a") => ({
  ...base(id),
  propertyId: "property-a",
  tenantName: "Taylor Tenant",
  tenantEmail,
  phone: "",
  startDate: "2026-10-01",
  endDate: "2027-10-01",
  status: "Active",
});
const inspection = (type = "check-in") => ({
  ...base(`tenancy-a_${type}`),
  propertyId: "property-a",
  tenancyId: "tenancy-a",
  tenantEmail,
  type,
  inspectedAt: timestamp,
  confirmed: false,
  confirmedAt: null,
  confirmedBy: null,
  itemCount: 1,
});
const snapshot = (type = "check-in", itemId = "item-a") => ({
  ...base(`tenancy-a_${type}_${itemId}`),
  propertyId: "property-a",
  inspectionId: `tenancy-a_${type}`,
  tenancyId: "tenancy-a",
  tenantEmail,
  itemId,
  itemName: "Refrigerator",
  roomName: "Kitchen",
  quantity: 1,
  condition: "Good",
  notes: "Original condition",
  photos: [],
  inspectedAt: timestamp,
});
const report = (id = "report-a") => ({
  ...base(id),
  propertyId: "property-a",
  tenancyId: "tenancy-a",
  tenantEmail,
  itemId: "item-a",
  itemName: "Refrigerator",
  description: "The door handle is loose.",
  photos: [],
  status: "Reported",
  ownerNotes: "",
  reportedBy: "tenant-a",
});
const ownerContext = () =>
  environment.authenticatedContext("owner-a", {
    email: "owner-a@example.com",
    email_verified: true,
  });
const ownerDb = () => ownerContext().firestore();
const tenantContext = (verified = true) =>
  environment.authenticatedContext("tenant-a", {
    email: tenantEmail,
    email_verified: verified,
  });
const tenantDb = (verified = true) => tenantContext(verified).firestore();

async function createHandover(type = "check-in") {
  const db = ownerDb();
  const parent = inspection(type);
  const child = snapshot(type);
  const batch = db.batch();
  batch.set(db.doc(`inspections/${parent.id}`), parent);
  batch.set(db.doc(`inspectionItems/${child.id}`), child);
  await assertSucceeds(batch.commit());
}

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: "demo-rental-rules",
    firestore: {
      host: "127.0.0.1",
      port: Number(process.env.RULES_FIRESTORE_PORT ?? "8080"),
      rules: readFileSync("firestore.rules", "utf8"),
    },
    storage: {
      host: "127.0.0.1",
      port: Number(process.env.RULES_STORAGE_PORT ?? "9199"),
      rules: readFileSync("storage.rules", "utf8"),
    },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    // Clean only this test project's bucket; never reset a concurrently running app's images.
    const bucketRoot = context.storage().ref();
    async function clearPrefix(prefix: typeof bucketRoot): Promise<void> {
      const listing = await prefix.listAll();
      await Promise.all(listing.items.map((entry) => entry.delete()));
      for (const child of listing.prefixes) await clearPrefix(child);
    }
    await clearPrefix(bucketRoot);
    const db = context.firestore();
    const batch = db.batch();
    for (const [id, role, email] of [
      ["owner-a", "landlord", "owner-a@example.com"],
      ["owner-b", "landlord", "owner-b@example.com"],
      ["tenant-a", "tenant", tenantEmail],
      ["outsider", "tenant", "outsider@example.com"],
    ]) {
      batch.set(db.doc(`users/${id}`), {
        id,
        name: id,
        email,
        role,
        createdAt: timestamp,
      });
    }
    batch.set(db.doc("properties/property-a"), property("property-a"));
    batch.set(
      db.doc("properties/property-b"),
      property("property-b", "owner-b"),
    );
    batch.set(
      db.doc("propertyAccess/property-a"),
      access("property-a", "owner-a", [tenantEmail]),
    );
    batch.set(
      db.doc("propertyAccess/property-b"),
      access("property-b", "owner-b"),
    );
    batch.set(db.doc("rooms/room-a"), room("room-a"));
    batch.set(db.doc("rooms/room-b"), room("room-b", "property-b", "owner-b"));
    batch.set(db.doc("items/item-a"), item("item-a"));
    batch.set(
      db.doc("items/item-b"),
      item("item-b", "property-b", "room-b", "owner-b"),
    );
    batch.set(db.doc("tenancies/tenancy-a"), tenancy());
    await batch.commit();
  });
});

afterAll(async () => {
  await environment?.cleanup();
});

describe("private inventory and immutable identity", () => {
  it("allows owner queries and rejects broad or cross-owner reads", async () => {
    const db = ownerDb();
    await assertSucceeds(
      db.collection("properties").where("ownerId", "==", "owner-a").get(),
    );
    await assertSucceeds(db.doc("properties/property-a").get());
    await assertFails(db.collection("properties").get());
    await assertFails(db.doc("properties/property-b").get());
    await assertFails(
      environment
        .unauthenticatedContext()
        .firestore()
        .doc("items/item-a")
        .get(),
    );
  });

  it("rejects ownership changes, cross-property rooms, malformed inventory, and hard deletion", async () => {
    const db = ownerDb();
    await assertFails(
      db.doc("properties/property-a").update({ ownerId: "owner-b" }),
    );
    await assertFails(db.doc("rooms/new").set(room("new", "property-b")));
    await assertFails(
      db.doc("items/new").set(item("new", "property-a", "room-b")),
    );
    await assertFails(db.doc("items/item-a").update({ quantity: 0 }));
    await assertFails(db.doc("items/item-a").update({ condition: "Perfect" }));
    await assertFails(db.doc("items/item-a").delete());
    await assertSucceeds(db.doc("items/item-a").update({ archived: true }));
    await assertFails(db.doc("items/item-a").update({ archived: false }));
  });

  it("allows only self-registration with matching email and a fixed supported role", async () => {
    const db = environment
      .authenticatedContext("new-user", { email: "new@example.com" })
      .firestore();
    const profile = {
      id: "new-user",
      name: "New User",
      email: "new@example.com",
      role: "tenant",
      createdAt: timestamp,
    };
    await assertFails(
      db.doc("users/new-user").set({ ...profile, role: "admin" }),
    );
    await assertFails(
      db.doc("users/new-user").set({ ...profile, email: tenantEmail }),
    );
    await assertSucceeds(db.doc("users/new-user").set(profile));
    await assertFails(db.doc("users/new-user").update({ role: "landlord" }));
    await assertFails(db.doc("users/new-user").update({ email: tenantEmail }));
    await assertSucceeds(
      db.doc("users/new-user").update({ name: "Updated Name" }),
    );
  });

  it("requires verified, assigned tenants and constrains tenant inventory queries", async () => {
    const db = tenantDb();
    await assertSucceeds(db.doc("properties/property-a").get());
    await assertFails(db.collection("properties").get());
    await assertSucceeds(
      db
        .collection("rooms")
        .where("propertyId", "in", ["property-a"])
        .where("archived", "==", false)
        .get(),
    );
    await assertSucceeds(
      db
        .collection("items")
        .where("propertyId", "in", ["property-a"])
        .where("archived", "==", false)
        .get(),
    );
    await assertSucceeds(db.doc("items/item-a").get());
    await assertFails(db.doc("items/item-b").get());
    await assertFails(tenantDb(false).doc("items/item-a").get());
    await assertFails(db.doc("items/item-a").update({ condition: "Broken" }));
    await assertFails(
      environment
        .authenticatedContext("outsider", {
          email: "outsider@example.com",
          email_verified: true,
        })
        .firestore()
        .doc("items/item-a")
        .get(),
    );
  });

  it("enforces membership grants atomically and immutable tenancy identity", async () => {
    const db = ownerDb();
    const newTenancy = {
      ...tenancy("tenancy-new"),
      tenantEmail: "new@example.com",
    };
    await assertFails(db.doc("tenancies/tenancy-new").set(newTenancy));
    const batch = db.batch();
    batch.update(db.doc("propertyAccess/property-a"), {
      tenantEmails: [tenantEmail, "new@example.com"],
    });
    batch.set(db.doc("tenancies/tenancy-new"), newTenancy);
    await assertSucceeds(batch.commit());
    await assertFails(
      db
        .doc("tenancies/tenancy-a")
        .update({ tenantEmail: "someone@example.com" }),
    );
    await assertFails(
      db.doc("tenancies/tenancy-a").update({ propertyId: "property-b" }),
    );
    await assertFails(
      db.doc("tenancies/tenancy-a").update({ startDate: "2028-01-01" }),
    );
  });
});

describe("private membership and archived inventory", () => {
  it("keeps invitation lists private and protects grant ownership", async () => {
    const db = ownerDb();
    await assertSucceeds(db.doc("propertyAccess/property-a").get());
    await assertFails(tenantDb().doc("propertyAccess/property-a").get());
    await assertFails(tenantDb().collection("propertyAccess").get());
    await assertFails(
      tenantDb()
        .doc("propertyAccess/property-a")
        .update({ tenantEmails: [tenantEmail, "intruder@example.com"] }),
    );
    await assertFails(db.doc("propertyAccess/property-b").get());
    await assertFails(
      db
        .doc("propertyAccess/property-b")
        .update({ tenantEmails: [tenantEmail] }),
    );
    await assertFails(
      db.doc("propertyAccess/property-a").update({ ownerId: "owner-b" }),
    );
    await assertFails(db.doc("propertyAccess/property-a").delete());
    const view = await assertSucceeds(
      tenantDb().doc("properties/property-a").get(),
    );
    expect(view.data()).not.toHaveProperty("tenantEmails");
    await assertSucceeds(
      db.doc("properties/property-new").set(property("property-new")),
    );
    const missing = await assertSucceeds(
      db.doc("propertyAccess/property-new").get(),
    );
    expect(missing.exists).toBe(false);
    await assertSucceeds(
      db.doc("propertyAccess/property-new").set(access("property-new")),
    );
  });

  it("hides archived inventory from tenants while retaining owner access", async () => {
    const db = ownerDb();
    await assertSucceeds(db.doc("items/item-a").update({ archived: true }));
    await assertSucceeds(db.doc("rooms/room-a").update({ archived: true }));
    await assertFails(tenantDb().doc("items/item-a").get());
    await assertFails(tenantDb().doc("rooms/room-a").get());
    await assertFails(
      tenantDb()
        .collection("items")
        .where("propertyId", "in", ["property-a"])
        .get(),
    );
    await assertSucceeds(db.doc("items/item-a").get());
    await assertSucceeds(db.doc("rooms/room-a").get());
  });
});

describe("historical handovers", () => {
  it("permits checking an unused deterministic inspection ID", async () => {
    const result = await assertSucceeds(
      ownerDb().doc("inspections/tenancy-a_check-in").get(),
    );
    expect(result.exists).toBe(false);
  });

  it("requires a check-in before creating check-out", async () => {
    await assertFails(
      ownerDb()
        .doc("inspections/tenancy-a_check-out")
        .set(inspection("check-out")),
    );
    await createHandover();
    await createHandover("check-out");
  });

  it("creates atomic immutable snapshots and rejects late snapshots or duplicate handovers", async () => {
    const db = ownerDb();
    await assertFails(
      db.doc("inspectionItems/tenancy-a_check-in_item-a").set(snapshot()),
    );
    await createHandover();
    await assertFails(
      db.doc("inspections/tenancy-a_check-in").set(inspection()),
    );
    await assertFails(
      db
        .doc("inspectionItems/tenancy-a_check-in_item-a")
        .update({ condition: "Broken" }),
    );
    await assertFails(
      db
        .doc("inspectionItems/tenancy-a_check-in_item-late")
        .set(snapshot("check-in", "item-late")),
    );
    await assertSucceeds(
      db
        .doc("items/item-a")
        .update({ name: "Renamed", condition: "Broken", archived: true }),
    );
    const original = await assertSucceeds(
      tenantDb().doc("inspectionItems/tenancy-a_check-in_item-a").get(),
    );
    expect(original.data()?.itemName).toBe("Refrigerator");
    expect(original.data()?.condition).toBe("Good");
  });

  it("prevents owners forging confirmation and restricts tenant confirmation to its fields", async () => {
    const db = ownerDb();
    await assertFails(
      db.doc("inspections/tenancy-a_check-in").set({
        ...inspection(),
        confirmed: true,
        confirmedAt: timestamp,
        confirmedBy: "tenant-a",
      }),
    );
    await createHandover();
    const changes = {
      confirmed: true,
      confirmedAt: timestamp,
      confirmedBy: "tenant-a",
      updatedAt: timestamp,
    };
    await assertFails(db.doc("inspections/tenancy-a_check-in").update(changes));
    await assertFails(
      tenantDb(false).doc("inspections/tenancy-a_check-in").update(changes),
    );
    await assertFails(
      tenantDb()
        .doc("inspections/tenancy-a_check-in")
        .update({ ...changes, itemCount: 2 }),
    );
    await assertFails(
      tenantDb()
        .doc("inspections/tenancy-a_check-in")
        .update({ ...changes, confirmedBy: "someone-else" }),
    );
    await assertSucceeds(
      tenantDb().doc("inspections/tenancy-a_check-in").update(changes),
    );
    await assertFails(
      tenantDb()
        .doc("inspections/tenancy-a_check-in")
        .update({ confirmed: false }),
    );
    await createHandover("check-out");
    await assertFails(
      tenantDb().doc("inspections/tenancy-a_check-out").update(changes),
    );
  });

  it("accepts a 400-item handover without per-item rule lookups", async () => {
    const db = ownerDb();
    const parent = { ...inspection(), itemCount: 400 };
    const batch = db.batch();
    batch.set(db.doc(`inspections/${parent.id}`), parent);
    for (let index = 0; index < 400; index++) {
      const child = snapshot("check-in", `historical-item-${index}`);
      batch.set(db.doc(`inspectionItems/${child.id}`), child);
    }
    await assertSucceeds(batch.commit());
    const records = await assertSucceeds(
      db.collection("inspectionItems").where("ownerId", "==", "owner-a").get(),
    );
    expect(records.size).toBe(400);
  }, 30000);

  it("keeps historical records readable after live property access ends", async () => {
    await createHandover();
    const db = ownerDb();
    const batch = db.batch();
    batch.update(db.doc("tenancies/tenancy-a"), { status: "Completed" });
    batch.update(db.doc("propertyAccess/property-a"), { tenantEmails: [] });
    await assertSucceeds(batch.commit());
    await assertFails(tenantDb().doc("properties/property-a").get());
    await assertSucceeds(
      tenantDb()
        .collection("inspections")
        .where("tenantEmail", "==", tenantEmail)
        .get(),
    );
    await assertSucceeds(
      tenantDb().doc("inspectionItems/tenancy-a_check-in_item-a").get(),
    );
  });
});

describe("damage report workflow", () => {
  it("accepts reports only from the verified active tenant with matching item identity", async () => {
    const db = tenantDb();
    await assertFails(
      tenantDb(false).doc("damageReports/report-a").set(report()),
    );
    await assertFails(
      db.doc("damageReports/report-a").set({ ...report(), ownerId: "owner-b" }),
    );
    await assertFails(
      db.doc("damageReports/report-a").set({ ...report(), itemId: "item-b" }),
    );
    await assertFails(
      db
        .doc("damageReports/report-a")
        .set({ ...report(), itemName: "Forged name" }),
    );
    await assertFails(
      db
        .doc("damageReports/report-a")
        .set({ ...report(), reportedBy: "owner-a" }),
    );
    await assertFails(ownerDb().doc("damageReports/report-a").set(report()));
    await assertSucceeds(db.doc("damageReports/report-a").set(report()));
    await assertSucceeds(
      ownerDb()
        .collection("damageReports")
        .where("ownerId", "==", "owner-a")
        .get(),
    );
    await assertFails(
      db
        .doc("damageReports/report-a")
        .update({ description: "Changed allegation" }),
    );
    await assertFails(
      ownerDb().doc("damageReports/report-a").update({ itemId: "item-b" }),
    );
    await assertSucceeds(
      ownerDb().doc("damageReports/report-a").update({
        status: "Repairing",
        ownerNotes: "Repair booked",
        updatedAt: timestamp,
      }),
    );
    await assertFails(ownerDb().doc("damageReports/report-a").delete());
  });

  it("rejects reports after the tenancy is completed", async () => {
    await assertSucceeds(
      ownerDb().doc("tenancies/tenancy-a").update({ status: "Completed" }),
    );
    await assertFails(tenantDb().doc("damageReports/report-a").set(report()));
  });
});

describe("image storage", () => {
  it("accepts owner images and rejects foreign, spoofed, invalid, oversized, and destructive writes", async () => {
    const storage = ownerContext().storage();
    const image = storage.ref("properties/property-a/owner-a/photo-a");
    await assertSucceeds(
      Promise.resolve(
        image.put(new Uint8Array([1, 2, 3]), { contentType: "image/jpeg" }),
      ),
    );
    await assertSucceeds(image.getMetadata());
    await assertFails(
      Promise.resolve(
        storage
          .ref("properties/property-b/owner-a/photo-b")
          .put(new Uint8Array([1]), { contentType: "image/png" }),
      ),
    );
    await assertFails(
      Promise.resolve(
        storage
          .ref("properties/property-a/owner-b/photo-b")
          .put(new Uint8Array([1]), { contentType: "image/png" }),
      ),
    );
    await assertFails(
      Promise.resolve(
        storage
          .ref("properties/property-a/owner-a/not-image")
          .put(new Uint8Array([1]), { contentType: "text/plain" }),
      ),
    );
    await assertFails(
      Promise.resolve(
        storage
          .ref("properties/property-a/owner-a/large")
          .put(new Uint8Array(8 * 1024 * 1024 + 1), {
            contentType: "image/jpeg",
          }),
      ),
    );
    await assertFails(
      Promise.resolve(
        image.put(new Uint8Array([4]), { contentType: "image/jpeg" }),
      ),
    );
    await assertFails(image.delete());
    await assertFails(
      environment
        .unauthenticatedContext()
        .storage()
        .ref("properties/property-a/owner-a/photo-a")
        .getMetadata(),
    );
  });

  it("requires verified active tenant upload metadata and prevents unrelated reads", async () => {
    const storage = tenantContext().storage();
    const metadata = {
      contentType: "image/webp",
      customMetadata: { tenancyId: "tenancy-a" },
    };
    const image = storage.ref("properties/property-a/tenant-a/tenant-photo");
    await assertFails(
      Promise.resolve(
        image.put(new Uint8Array([1]), { contentType: "image/webp" }),
      ),
    );
    await assertFails(
      Promise.resolve(
        tenantContext(false)
          .storage()
          .ref("properties/property-a/tenant-a/unverified")
          .put(new Uint8Array([1]), metadata),
      ),
    );
    await assertSucceeds(
      Promise.resolve(image.put(new Uint8Array([1]), metadata)),
    );
    await assertSucceeds(image.getMetadata());
    await assertFails(
      environment
        .authenticatedContext("outsider", {
          email: "outsider@example.com",
          email_verified: true,
        })
        .storage()
        .ref("properties/property-a/tenant-a/tenant-photo")
        .getMetadata(),
    );
    await assertSucceeds(
      ownerDb().doc("tenancies/tenancy-a").update({ status: "Completed" }),
    );
    await assertSucceeds(
      ownerDb().doc("propertyAccess/property-a").update({ tenantEmails: [] }),
    );
    await assertFails(image.getMetadata());
    await assertFails(
      Promise.resolve(
        storage
          .ref("properties/property-a/tenant-a/completed")
          .put(new Uint8Array([1]), metadata),
      ),
    );
  });
});
