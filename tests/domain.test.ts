import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_PHOTO_BYTES,
  normalizeEmail,
  validateDamage,
  validateItem,
  validatePhotoFiles,
  validatePhotos,
  validateProperty,
  validateSnapshot,
  validateTenancy,
} from "../src/lib/validation";
import type {
  Inspection,
  ItemInput,
  Photo,
  Profile,
  Property,
  SnapshotInput,
  Tenancy,
  TenancyInput,
  WorkspaceData,
} from "../src/lib/types";
import {
  archiveProperty,
  createInspection,
  saveItem,
  saveProperty,
  saveTenancy,
  subscribeWorkspace,
} from "../src/lib/repository";

type TestReference = { path: string; id: string };
type TestFilter = { field: string; operator: string; value: unknown };
type TestQuery = { path: string; filters: TestFilter[] };
type TestSnapshot = {
  docs: ReturnType<typeof documentSnapshot>[];
  metadata: { fromCache: boolean };
};
type TestDocumentSnapshot = ReturnType<typeof documentSnapshot> & {
  metadata: { fromCache: boolean };
};
type TestListener = {
  query: TestQuery | TestReference;
  options: { includeMetadataChanges: boolean };
  next: (snapshot: TestSnapshot | TestDocumentSnapshot) => void;
  error: (error: Error) => void;
  stopped: boolean;
};
function documentSnapshot(path: string, value?: Record<string, unknown>) {
  return {
    id: path.split("/").at(-1)!,
    ref: { path, id: path.split("/").at(-1)! },
    exists: () => value !== undefined,
    data: () => (value === undefined ? undefined : structuredClone(value)),
  };
}
const harness = vi.hoisted(() => ({
  records: new Map<string, Record<string, unknown>>(),
  listeners: [] as TestListener[],
  services: {
    auth: {
      currentUser: {
        uid: "owner-1",
        email: "owner@example.com",
        emailVerified: true,
      },
    },
    db: {},
  },
  nextId: 0,
}));
vi.mock("../src/lib/firebase", () => ({ getFirebase: () => harness.services }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, path: string) => ({ path }),
  doc: (source: { path?: string }, ...parts: string[]): TestReference => {
    const path = source.path
      ? `${source.path}/${parts[0] ?? `auto-${++harness.nextId}`}`
      : parts.join("/");
    return { path, id: path.split("/").at(-1)! };
  },
  where: (field: string, operator: string, value: unknown): TestFilter => ({
    field,
    operator,
    value,
  }),
  query: (source: { path: string }, ...filters: TestFilter[]): TestQuery => ({
    path: source.path,
    filters,
  }),
  getDocs: async (query: TestQuery) => ({
    docs: [...harness.records]
      .filter(
        ([path, data]) =>
          path.split("/")[0] === query.path &&
          query.filters.every(
            (filter) =>
              filter.operator === "==" && data[filter.field] === filter.value,
          ),
      )
      .map(([path, value]) => documentSnapshot(path, value)),
  }),
  onSnapshot: (
    query: TestQuery | TestReference,
    options: TestListener["options"],
    next: TestListener["next"],
    error: TestListener["error"],
  ) => {
    const listener: TestListener = {
      query,
      options,
      next,
      error,
      stopped: false,
    };
    harness.listeners.push(listener);
    return () => {
      listener.stopped = true;
    };
  },
  runTransaction: async (
    _db: unknown,
    callback: (transaction: unknown) => Promise<void>,
  ) => {
    const pending: (() => void)[] = [];
    let writing = false;
    await callback({
      get: async (reference: TestReference) => {
        if (writing)
          throw new Error(
            "Firestore transactions require reads before writes.",
          );
        return documentSnapshot(
          reference.path,
          harness.records.get(reference.path),
        );
      },
      set: (reference: TestReference, value: Record<string, unknown>) => {
        writing = true;
        const frozen = structuredClone(value);
        pending.push(() => harness.records.set(reference.path, frozen));
      },
      update: (reference: TestReference, values: Record<string, unknown>) => {
        writing = true;
        const frozen = structuredClone(values);
        pending.push(() =>
          harness.records.set(reference.path, {
            ...harness.records.get(reference.path),
            ...frozen,
          }),
        );
      },
    });
    pending.forEach((commit) => commit());
  },
}));

const item: ItemInput = {
  propertyId: "property-1",
  roomId: "room-1",
  name: "Refrigerator",
  category: "Appliance",
  quantity: 1,
  condition: "Good",
  description: "",
  estimatedValue: null,
  photos: [],
};
const tenancy: TenancyInput = {
  propertyId: "property-1",
  tenantName: "Jamie",
  tenantEmail: "Jamie@Example.com",
  phone: "",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  status: "Active",
};
const photo: Photo = {
  id: "photo-1",
  path: "properties/property-1/tenant-1/photo-1",
  url: "https://example.com/photo.jpg",
  name: "photo.jpg",
  createdAt: "2026-01-01T00:00:00.000Z",
};
const imagekitPhoto: Photo = {
  ...photo,
  url: "https://ik.imagekit.io/rental/photo.jpg",
  provider: "imagekit",
  fileId: "imagekit-file-1",
};

describe("inventory validation", () => {
  it("normalizes user text and email without changing the source", () => {
    expect(
      validateProperty({
        name: "  River House  ",
        address: "",
        propertyType: "House",
        description: "",
      }).name,
    ).toBe("River House");
    expect(normalizeEmail(" Jamie@Example.com ")).toBe("jamie@example.com");
    expect(validateTenancy(tenancy).tenantEmail).toBe("jamie@example.com");
    expect(tenancy.tenantEmail).toBe("Jamie@Example.com");
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects an invalid item quantity %s",
    (quantity) => {
      expect(() => validateItem({ ...item, quantity })).toThrow("Quantity");
    },
  );

  it("allows an optional value and rejects invalid monetary values", () => {
    expect(validateItem(item).estimatedValue).toBeNull();
    expect(validateItem({ ...item, estimatedValue: 0 }).estimatedValue).toBe(0);
    expect(() => validateItem({ ...item, estimatedValue: -1 })).toThrow(
      "Estimated value",
    );
    expect(() => validateItem({ ...item, estimatedValue: Number.NaN })).toThrow(
      "Estimated value",
    );
  });

  it("rejects missing fields, invalid enums, and photos from another property", () => {
    expect(() =>
      validateProperty({
        name: " ",
        address: "",
        description: "",
        propertyType: "House",
      }),
    ).toThrow("Property name is required");
    expect(() =>
      validateItem({ ...item, condition: "Unknown" as ItemInput["condition"] }),
    ).toThrow("valid condition");
    expect(() =>
      validateItem({
        ...item,
        propertyId: "another-property",
        photos: [photo],
      }),
    ).toThrow("Photos must belong");
  });
});

describe("tenancy and reports", () => {
  it("checks actual calendar dates and date ordering", () => {
    expect(() =>
      validateTenancy({
        ...tenancy,
        startDate: "2026-12-31",
        endDate: "2026-01-01",
      }),
    ).toThrow("Start date must not be after end date");
    expect(() =>
      validateTenancy({ ...tenancy, startDate: "2026-02-30" }),
    ).toThrow("valid start date");
    expect(() =>
      validateTenancy({ ...tenancy, tenantEmail: "not-an-email" }),
    ).toThrow("valid email");
  });

  it("requires a clear damage description and matching photo property", () => {
    expect(() =>
      validateDamage({
        propertyId: "property-1",
        tenancyId: "tenancy-1",
        itemId: "item-1",
        description: " ",
        photos: [],
      }),
    ).toThrow("Damage description is required");
    expect(
      validateDamage({
        propertyId: "property-1",
        tenancyId: "tenancy-1",
        itemId: "item-1",
        description: " Door dent ",
        photos: [photo],
      }).description,
    ).toBe("Door dent");
  });
});

describe("historical snapshots and photos", () => {
  it("preserves both legacy and paired ImageKit photo metadata without sharing objects", () => {
    const result = validatePhotos([photo, imagekitPhoto], "property-1");
    expect(result).toEqual([photo, imagekitPhoto]);
    expect(result[0]).not.toBe(photo);
    expect(result[1]).not.toBe(imagekitPhoto);
    expect(result[0]).not.toHaveProperty("provider");
    expect(
      validatePhotos([{ ...imagekitPhoto, fileId: "a".repeat(128) }])[0].fileId,
    ).toHaveLength(128);
  });

  it.each([
    { provider: "imagekit" },
    { fileId: "file-only" },
    { provider: "another-service", fileId: "file-1" },
    { provider: "imagekit", fileId: null },
    { provider: "imagekit", fileId: 123 },
    { provider: "imagekit", fileId: "" },
    { provider: "imagekit", fileId: " \t\n" },
    { provider: "imagekit", fileId: "a".repeat(129) },
    { provider: "imagekit", fileId: "file-1", unexpected: true },
  ])("rejects invalid or extra provider metadata %j", (metadata) => {
    expect(() =>
      validatePhotos([{ ...photo, ...metadata } as unknown as Photo]),
    ).toThrow("invalid");
  });

  it("rejects ImageKit metadata scoped to another property in inventory, snapshots, and reports", () => {
    const foreign = {
      ...imagekitPhoto,
      path: "properties/property-2/tenant-1/photo-1",
    };
    expect(() => validateItem({ ...item, photos: [foreign] })).toThrow(
      "Photos must belong",
    );
    expect(() =>
      validateSnapshot(
        {
          itemId: "item-1",
          itemName: item.name,
          roomName: "Kitchen",
          quantity: 1,
          condition: "Good",
          notes: "",
          photos: [foreign],
        },
        "property-1",
      ),
    ).toThrow("Photos must belong");
    expect(() =>
      validateDamage({
        propertyId: "property-1",
        tenancyId: "tenancy-1",
        itemId: "item-1",
        description: "Door dent",
        photos: [foreign],
      }),
    ).toThrow("Photos must belong");
  });

  it("rejects eleven stored photos before an inventory or snapshot save", () => {
    const photos = Array.from({ length: 11 }, () => ({ ...imagekitPhoto }));
    expect(() => validateItem({ ...item, photos })).toThrow("10 photos");
    expect(() =>
      validateSnapshot(
        {
          itemId: "item-1",
          itemName: item.name,
          roomName: "Kitchen",
          quantity: 1,
          condition: "Good",
          notes: "",
          photos,
        },
        "property-1",
      ),
    ).toThrow("10 photos");
  });

  it("copies photo metadata so changes to a live form cannot mutate a snapshot", () => {
    const live = {
      itemId: "item-1",
      itemName: item.name,
      roomName: "Kitchen",
      quantity: 1,
      condition: item.condition,
      notes: "No scratches",
      photos: [{ ...photo }],
    };
    const snapshot = validateSnapshot(live, "property-1");
    live.condition = "Damaged";
    live.itemName = "Replacement refrigerator";
    live.photos[0].name = "changed.jpg";
    live.photos.length = 0;
    expect(snapshot.condition).toBe("Good");
    expect(snapshot.itemName).toBe("Refrigerator");
    expect(snapshot.photos).toHaveLength(1);
    expect(snapshot.photos[0].name).toBe("photo.jpg");
  });

  it("rejects oversized, empty, unsupported and excessive photo uploads", () => {
    expect(() =>
      validatePhotoFiles([{ size: MAX_PHOTO_BYTES + 1, type: "image/jpeg" }]),
    ).toThrow("8 MB");
    expect(() => validatePhotoFiles([{ size: 0, type: "image/png" }])).toThrow(
      "nonempty",
    );
    expect(() =>
      validatePhotoFiles([{ size: 12, type: "application/pdf" }]),
    ).toThrow("JPEG, PNG, or WebP");
    expect(() =>
      validatePhotoFiles(
        Array.from({ length: 11 }, () => ({ size: 12, type: "image/jpeg" })),
      ),
    ).toThrow("10 photos");
    validatePhotoFiles([{ size: MAX_PHOTO_BYTES, type: "image/webp" }]);
  });
});

const owner: Profile = {
  id: "owner-1",
  name: "Owner",
  email: "owner@example.com",
  role: "landlord",
  createdAt: "2026-01-01T00:00:00.000Z",
};
const tenantProfile: Profile = {
  ...owner,
  id: "tenant-1",
  name: "Jamie",
  email: "jamie@example.com",
  role: "tenant",
};
const recordBase = {
  ownerId: owner.id,
  createdAt: owner.createdAt,
  updatedAt: owner.createdAt,
  archived: false,
};
const property: Property = {
  ...recordBase,
  id: "property-1",
  name: "River House",
  address: "",
  description: "",
  propertyType: "House",
};
const activeTenancy: Tenancy = {
  ...recordBase,
  ...tenancy,
  id: "tenancy-1",
  tenantEmail: tenantProfile.email,
};
function seed(path: string, value: object) {
  harness.records.set(path, structuredClone(value) as Record<string, unknown>);
}
function emit(
  listener: TestListener,
  records: Record<string, unknown>[],
  fromCache = false,
) {
  listener.next({
    docs: records.map((value) =>
      documentSnapshot(`${listener.query.path}/${value.id}`, value),
    ),
    metadata: { fromCache },
  });
}
function emitDocument(
  listener: TestListener,
  value: Record<string, unknown> | undefined,
  fromCache = false,
) {
  listener.next({
    ...documentSnapshot(listener.query.path, value),
    metadata: { fromCache },
  });
}
function grantTenantProperty(value: Property = property) {
  emit(listenerFor("tenancies"), [{ ...activeTenancy, propertyId: value.id }]);
  emitDocument(listenerFor(`properties/${value.id}`), { ...value });
}
function listenerFor(path: string): TestListener {
  return harness.listeners
    .filter((listener) => listener.query.path === path && !listener.stopped)
    .at(-1)!;
}

describe("workspace listener authorization and lifecycle", () => {
  beforeEach(() => {
    harness.listeners.length = 0;
    harness.services.auth.currentUser = {
      uid: tenantProfile.id,
      email: tenantProfile.email,
      emailVerified: true,
    };
  });

  it("clears granted inventory immediately on an authorization error", () => {
    const output: WorkspaceData[] = [];
    const errors: Error[] = [];
    const stop = subscribeWorkspace(
      tenantProfile,
      (value) => output.push(value),
      (error) => errors.push(error),
    );
    grantTenantProperty();
    const items = listenerFor("items");
    emit(items, [{ ...recordBase, ...item, id: "item-1" }]);
    expect(output.at(-1)!.items).toHaveLength(1);
    listenerFor("rooms").error(new Error("permission-denied"));
    expect(output.at(-1)!.properties).toHaveLength(0);
    expect(output.at(-1)!.items).toHaveLength(0);
    expect(items.stopped).toBe(true);
    expect(errors).toHaveLength(1);
    stop();
  });

  it("ignores callbacks from replaced inventory listeners and from a closed workspace", () => {
    const output: WorkspaceData[] = [];
    const errors: Error[] = [];
    const stop = subscribeWorkspace(
      tenantProfile,
      (value) => output.push(value),
      (error) => errors.push(error),
    );
    const tenancies = listenerFor("tenancies");
    grantTenantProperty();
    const oldItems = listenerFor("items");
    grantTenantProperty({ ...property, id: "property-2" });
    const count = output.length;
    emit(oldItems, [{ ...item, id: "stale-item" }]);
    oldItems.error(new Error("old permission-denied"));
    expect(output).toHaveLength(count);
    expect(errors).toHaveLength(0);
    expect(output.at(-1)!.properties[0].id).toBe("property-2");
    stop();
    emit(tenancies, [{ ...activeTenancy }]);
    expect(output).toHaveLength(count);
  });

  it("does not expose cached tenant grants until the server authorizes them", () => {
    const output: WorkspaceData[] = [];
    const stop = subscribeWorkspace(
      tenantProfile,
      (value) => output.push(value),
      () => {},
    );
    const tenancies = listenerFor("tenancies");
    expect(tenancies.options.includeMetadataChanges).toBe(true);
    emit(tenancies, [{ ...activeTenancy }], true);
    expect(output.at(-1)!.properties).toHaveLength(0);
    expect(
      harness.listeners.some((listener) => listener.query.path === "items"),
    ).toBe(false);
    emit(tenancies, [{ ...activeTenancy }]);
    const properties = listenerFor("properties/property-1");
    emitDocument(properties, { ...property }, true);
    expect(output.at(-1)!.properties).toHaveLength(0);
    emitDocument(properties, { ...property });
    const items = listenerFor("items");
    emit(items, [{ ...item, id: "item-1" }], true);
    expect(output.at(-1)!.items).toHaveLength(0);
    emit(items, [{ ...item, id: "item-1" }]);
    expect(output.at(-1)!.items).toHaveLength(1);
    stop();
  });

  it("rejects an unverified tenant before creating subscriptions", () => {
    harness.services.auth.currentUser.emailVerified = false;
    expect(() =>
      subscribeWorkspace(
        tenantProfile,
        () => {},
        () => {},
      ),
    ).toThrow("Verify your email");
    expect(harness.listeners).toHaveLength(0);
  });

  it("revokes live data when the tenancy ends while retaining the tenant's history", () => {
    const output: WorkspaceData[] = [];
    const errors: Error[] = [];
    const stop = subscribeWorkspace(
      tenantProfile,
      (value) => output.push(value),
      (error) => errors.push(error),
    );
    grantTenantProperty();
    const oldProperty = listenerFor("properties/property-1");
    const oldItems = listenerFor("items");
    emit(oldItems, [{ ...item, id: "item-1" }]);
    emit(listenerFor("tenancies"), [{ ...activeTenancy, status: "Completed" }]);
    expect(output.at(-1)!.properties).toHaveLength(0);
    expect(output.at(-1)!.items).toHaveLength(0);
    expect(output.at(-1)!.tenancies[0].status).toBe("Completed");
    const count = output.length;
    emitDocument(oldProperty, { ...property });
    emit(oldItems, [{ ...item, id: "stale" }]);
    oldProperty.error(new Error("late permission-denied"));
    expect(output).toHaveLength(count);
    expect(errors).toHaveLength(0);
    stop();
  });

  it("clears only the failed owner collection and caps tenant property query chunks", () => {
    const output: WorkspaceData[] = [];
    harness.services.auth.currentUser = {
      uid: owner.id,
      email: owner.email,
      emailVerified: true,
    };
    const stopOwner = subscribeWorkspace(
      owner,
      (value) => output.push(value),
      () => {},
    );
    emit(listenerFor("properties"), [{ ...property }]);
    emit(listenerFor("items"), [{ ...item, id: "item-1" }]);
    listenerFor("items").error(new Error("network error"));
    expect(output.at(-1)!.items).toHaveLength(0);
    expect(output.at(-1)!.properties).toHaveLength(1);
    stopOwner();
    harness.services.auth.currentUser = {
      uid: tenantProfile.id,
      email: tenantProfile.email,
      emailVerified: true,
    };
    const stopTenant = subscribeWorkspace(
      tenantProfile,
      () => {},
      () => {},
    );
    const candidates = Array.from({ length: 10 }, (_, index) => ({
      ...property,
      id: `property-${index}`,
    }));
    emit(
      listenerFor("tenancies"),
      candidates.map((value, index) => ({
        ...activeTenancy,
        id: `tenancy-${index}`,
        propertyId: value.id,
      })),
    );
    for (const value of candidates)
      emitDocument(listenerFor(`properties/${value.id}`), { ...value });
    const queries = harness.listeners.filter(
      (listener) => listener.query.path === "items" && !listener.stopped,
    );
    const chunks = queries.map(
      (listener) =>
        ((listener.query as TestQuery).filters[0].value as string[]).length,
    );
    expect(chunks).toEqual([4, 4, 2]);
    expect(
      queries.every((listener) =>
        (listener.query as TestQuery).filters.some(
          (filter) => filter.field === "archived" && filter.value === false,
        ),
      ),
    ).toBe(true);
    expect(
      harness.listeners.some(
        (listener) => listener.query.path === "propertyAccess",
      ),
    ).toBe(false);
    expect(
      harness.listeners.some(
        (listener) =>
          "filters" in listener.query &&
          listener.query.filters.some(
            (filter) => filter.field === "tenantEmails",
          ),
      ),
    ).toBe(false);
    stopTenant();
  });
});

describe("service data integrity with atomic transaction doubles", () => {
  beforeEach(() => {
    harness.records.clear();
    harness.nextId = 0;
    harness.services.auth.currentUser = {
      uid: owner.id,
      email: owner.email,
      emailVerified: true,
    };
    seed("properties/property-1", property);
    seed("propertyAccess/property-1", {
      id: property.id,
      ownerId: owner.id,
      tenantEmails: [tenantProfile.email],
      createdAt: owner.createdAt,
      updatedAt: owner.createdAt,
    });
    seed("rooms/room-1", {
      ...recordBase,
      id: "room-1",
      propertyId: property.id,
      name: "Kitchen",
      description: "",
    });
    seed("items/item-1", { ...recordBase, ...item, id: "item-1" });
    seed("tenancies/tenancy-1", activeTenancy);
  });

  it("refuses property archival while a current tenancy exists without losing records", async () => {
    await expect(archiveProperty(owner, property)).rejects.toThrow(
      "Complete or cancel",
    );
    expect(harness.records.get("properties/property-1")!.archived).toBe(false);
    expect(harness.records.has("items/item-1")).toBe(true);
    await saveTenancy(
      owner,
      { ...tenancy, tenantEmail: tenantProfile.email, status: "Completed" },
      activeTenancy.id,
    );
    await archiveProperty(owner, property);
    expect(harness.records.get("properties/property-1")!.archived).toBe(true);
    expect(
      harness.records.get("propertyAccess/property-1")!.tenantEmails,
    ).toEqual([]);
    expect(
      "tenantEmails" in harness.records.get("properties/property-1")!,
    ).toBe(false);
    expect(harness.records.has("tenancies/tenancy-1")).toBe(true);
  });

  it("revokes inventory only after the last current tenancy for the email ends", async () => {
    seed("tenancies/tenancy-2", {
      ...activeTenancy,
      id: "tenancy-2",
      status: "Upcoming",
    });
    await saveTenancy(
      owner,
      { ...tenancy, tenantEmail: tenantProfile.email, status: "Completed" },
      activeTenancy.id,
    );
    expect(
      harness.records.get("propertyAccess/property-1")!.tenantEmails,
    ).toEqual([tenantProfile.email]);
    await saveTenancy(
      owner,
      { ...tenancy, tenantEmail: tenantProfile.email, status: "Cancelled" },
      "tenancy-2",
    );
    expect(
      harness.records.get("propertyAccess/property-1")!.tenantEmails,
    ).toEqual([]);
    expect(harness.records.size).toBe(6);
  });

  it("writes authorization emails only to the private projection and creates missing grants", async () => {
    const id = await saveProperty(owner, {
      name: "Private invitations",
      address: "",
      description: "",
      propertyType: "House",
    });
    expect("tenantEmails" in harness.records.get(`properties/${id}`)!).toBe(
      false,
    );
    harness.records.delete("propertyAccess/property-1");
    await saveTenancy(
      owner,
      { ...tenancy, tenantEmail: tenantProfile.email },
      activeTenancy.id,
    );
    const access = harness.records.get("propertyAccess/property-1")!;
    expect(Object.keys(access).sort()).toEqual([
      "createdAt",
      "id",
      "ownerId",
      "tenantEmails",
      "updatedAt",
    ]);
    expect(access.tenantEmails).toEqual([tenantProfile.email]);
    expect(access.updatedAt).toBe(
      harness.records.get("tenancies/tenancy-1")!.updatedAt,
    );
    expect(access.updatedAt).toBe(
      harness.records.get("properties/property-1")!.updatedAt,
    );
    expect(
      "tenantEmails" in harness.records.get("properties/property-1")!,
    ).toBe(false);
  });

  it("preserves authoritative historical identity and photos after current inventory changes", async () => {
    const input: SnapshotInput = {
      itemId: "item-1",
      itemName: item.name,
      roomName: "Kitchen",
      quantity: 1,
      condition: "Good",
      notes: "No dents",
      photos: [{ ...imagekitPhoto }],
    };
    const inspectionId = await createInspection(
      owner,
      activeTenancy,
      "check-in",
      [input],
    );
    expect(inspectionId).toBe("tenancy-1_check-in");
    input.photos[0].name = "mutated.jpg";
    await saveItem(
      owner,
      { ...item, name: "Replacement refrigerator", condition: "Damaged" },
      "item-1",
    );
    const snapshot = harness.records.get(
      "inspectionItems/tenancy-1_check-in_item-1",
    )!;
    expect(snapshot.itemName).toBe("Refrigerator");
    expect(snapshot.roomName).toBe("Kitchen");
    expect(snapshot.quantity).toBe(1);
    expect(snapshot.condition).toBe("Good");
    expect((snapshot.photos as Photo[])[0].name).toBe("photo.jpg");
    expect(snapshot.photos).toEqual([imagekitPhoto]);
    await expect(
      createInspection(owner, activeTenancy, "check-in", [input]),
    ).rejects.toThrow("cannot be overwritten");
    expect(
      harness.records.get("inspections/tenancy-1_check-in")!.itemCount,
    ).toBe(1);
  });

  it.each(["item name", "room name", "quantity"])(
    "rejects a concurrently changed reviewed %s without saving a mixed snapshot",
    async (field) => {
      const input: SnapshotInput = {
        itemId: "item-1",
        itemName: item.name,
        roomName: "Kitchen",
        quantity: 1,
        condition: "Damaged",
        notes: "Inspection notes are intentionally editable",
        photos: [{ ...photo }],
      };
      if (field === "item name")
        seed("items/item-1", {
          ...harness.records.get("items/item-1"),
          name: "Replacement refrigerator",
        });
      if (field === "room name")
        seed("rooms/room-1", {
          ...harness.records.get("rooms/room-1"),
          name: "Utility room",
        });
      if (field === "quantity")
        seed("items/item-1", {
          ...harness.records.get("items/item-1"),
          quantity: 2,
        });
      await expect(
        createInspection(owner, activeTenancy, "check-in", [input]),
      ).rejects.toThrow("Close the form, reopen it");
      expect(
        [...harness.records.keys()].some(
          (path) =>
            path.startsWith("inspections/") ||
            path.startsWith("inspectionItems/"),
        ),
      ).toBe(false);
    },
  );

  it("rejects invalid handover ordering and duplicate item identities atomically", async () => {
    const input: SnapshotInput = {
      itemId: "item-1",
      itemName: item.name,
      roomName: "Kitchen",
      quantity: 1,
      condition: "Good",
      notes: "",
      photos: [],
    };
    await expect(
      createInspection(owner, activeTenancy, "check-out", [input]),
    ).rejects.toThrow("check-in inspection before");
    await expect(
      createInspection(owner, activeTenancy, "check-in", [input, input]),
    ).rejects.toThrow("only once");
    expect(
      [...harness.records.keys()].some((path) =>
        path.startsWith("inspections/"),
      ),
    ).toBe(false);
    const id = await createInspection(owner, activeTenancy, "check-in", [
      input,
    ]);
    const parent = harness.records.get(
      `inspections/${id}`,
    ) as unknown as Inspection;
    const snapshot = harness.records.get(`inspectionItems/${id}_item-1`)!;
    expect(snapshot.inspectedAt).toBe(parent.inspectedAt);
    expect(snapshot.createdAt).toBe(parent.createdAt);
  });
});
