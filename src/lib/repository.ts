import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  where,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type Transaction,
  type Unsubscribe,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebase } from "./firebase";
import {
  EMPTY_WORKSPACE,
  type BaseRecord,
  type DamageInput,
  type DamageReport,
  type DamageStatus,
  type Inspection,
  type InspectionItem,
  type Item,
  type ItemInput,
  type Photo,
  type Profile,
  type Property,
  type PropertyInput,
  type Room,
  type RoomInput,
  type SnapshotInput,
  type Tenancy,
  type TenancyInput,
  type WorkspaceData,
} from "./types";
import {
  MAX_INSPECTION_ITEMS,
  normalizeEmail,
  validateDamage,
  validateDamageUpdate,
  validateItem,
  validatePhotoFiles,
  validateProperty,
  validateRoom,
  validateSnapshot,
  validateTenancy,
} from "./validation";

function now(): string {
  return new Date().toISOString();
}
function requireSession(profile: Profile, role?: Profile["role"]): void {
  const user = getFirebase().auth.currentUser;
  if (!user || user.uid !== profile.id)
    throw new Error("Your session expired. Please sign in again.");
  if (role && profile.role !== role)
    throw new Error(
      role === "landlord"
        ? "Only landlords can make this change."
        : "Only tenants can perform this action.",
    );
  if (
    profile.role === "tenant" &&
    (!user.emailVerified ||
      user.email?.toLowerCase() !== profile.email.toLowerCase())
  )
    throw new Error("Verify your email address before accessing your tenancy.");
}

function record<T>(snapshot: DocumentSnapshot<DocumentData>, label: string): T {
  if (!snapshot.exists())
    throw new Error(`${label} could not be found. It may have been removed.`);
  return { ...snapshot.data(), id: snapshot.id } as T;
}

function requireOwner<T extends BaseRecord>(
  value: T,
  profile: Profile,
  label: string,
  active = true,
): T {
  if (value.ownerId !== profile.id)
    throw new Error(`You do not have permission to manage this ${label}.`);
  if (active && value.archived)
    throw new Error(`This ${label} has been archived.`);
  return value;
}

async function owned<T extends BaseRecord>(
  transaction: Transaction,
  reference: DocumentReference,
  profile: Profile,
  label: string,
  active = true,
): Promise<T> {
  return requireOwner(
    record<T>(await transaction.get(reference), label),
    profile,
    label,
    active,
  );
}

function base(profile: Profile, id: string, timestamp: string): BaseRecord {
  return {
    id,
    ownerId: profile.id,
    createdAt: timestamp,
    updatedAt: timestamp,
    archived: false,
  };
}

/** Flat, owner-scoped listeners; tenants get only their email-scoped history and granted inventory. */
export function subscribeWorkspace(
  profile: Profile,
  onData: (data: WorkspaceData) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  requireSession(profile);
  const { db } = getFirebase();
  const data: WorkspaceData = structuredClone(EMPTY_WORKSPACE);
  const subscriptions: Unsubscribe[] = [];
  let inventorySubscriptions: Unsubscribe[] = [];
  let inventoryGeneration = 0;
  let closed = false;
  const publish = () => {
    if (!closed) onData({ ...data });
  };
  const clearInventory = () => {
    ++inventoryGeneration;
    inventorySubscriptions.forEach((unsubscribe) => unsubscribe());
    inventorySubscriptions = [];
    data.properties = [];
    data.rooms = [];
    data.items = [];
  };
  const fail = (key: keyof WorkspaceData, error: Error) => {
    if (closed) return;
    if (
      profile.role === "tenant" &&
      ["properties", "rooms", "items"].includes(key)
    )
      clearInventory();
    else (data[key] as unknown[]) = [];
    publish();
    onError(error);
  };
  const watch = (key: keyof WorkspaceData, field: string, value: string) => {
    subscriptions.push(
      onSnapshot(
        query(collection(db, key), where(field, "==", value)),
        { includeMetadataChanges: true },
        (snapshot) => {
          if (closed) return;
          // Tenant data is displayed only after the server has checked this query's permissions.
          if (profile.role === "tenant" && snapshot.metadata.fromCache) {
            (data[key] as unknown[]) = [];
            publish();
            return;
          }
          (data[key] as unknown[]) = snapshot.docs.map((entry) => ({
            ...entry.data(),
            id: entry.id,
          }));
          publish();
        },
        (error) => fail(key, error),
      ),
    );
  };
  if (profile.role === "landlord") {
    for (const key of Object.keys(EMPTY_WORKSPACE) as (keyof WorkspaceData)[])
      watch(key, "ownerId", profile.id);
  } else {
    const email = normalizeEmail(profile.email);
    for (const key of [
      "tenancies",
      "inspections",
      "inspectionItems",
      "damageReports",
    ] as const)
      watch(key, "tenantEmail", email);
    subscriptions.push(
      onSnapshot(
        query(
          collection(db, "properties"),
          where("tenantEmails", "array-contains", email),
          where("archived", "==", false),
        ),
        { includeMetadataChanges: true },
        (snapshot) => {
          if (closed) return;
          if (snapshot.metadata.fromCache) {
            clearInventory();
            publish();
            return;
          }
          const generation = ++inventoryGeneration;
          inventorySubscriptions.forEach((unsubscribe) => unsubscribe());
          inventorySubscriptions = [];
          data.properties = snapshot.docs.map(
            (entry) => ({ ...entry.data(), id: entry.id }) as Property,
          );
          data.rooms = [];
          data.items = [];
          const ids = data.properties
            .filter((property) => !property.archived)
            .map((property) => property.id);
          for (const key of ["rooms", "items"] as const) {
            const chunks = new Map<number, DocumentData[]>();
            // Rules resolve the user's profile plus each parent property (10 reads per query).
            for (let index = 0; index < ids.length; index += 9) {
              const offset = index;
              inventorySubscriptions.push(
                onSnapshot(
                  query(
                    collection(db, key),
                    where("propertyId", "in", ids.slice(index, index + 9)),
                  ),
                  { includeMetadataChanges: true },
                  (entries) => {
                    if (closed || generation !== inventoryGeneration) return;
                    if (entries.metadata.fromCache) {
                      chunks.delete(offset);
                      (data[key] as unknown[]) = [...chunks.values()].flat();
                      publish();
                      return;
                    }
                    chunks.set(
                      offset,
                      entries.docs.map((entry) => ({
                        ...entry.data(),
                        id: entry.id,
                      })),
                    );
                    (data[key] as unknown[]) = [...chunks.values()].flat();
                    publish();
                  },
                  (error) => {
                    if (!closed && generation === inventoryGeneration)
                      fail(key, error);
                  },
                ),
              );
            }
          }
          publish();
        },
        (error) => fail("properties", error),
      ),
    );
  }
  return () => {
    closed = true;
    subscriptions.forEach((unsubscribe) => unsubscribe());
    inventorySubscriptions.forEach((unsubscribe) => unsubscribe());
  };
}

export async function saveProperty(
  profile: Profile,
  input: PropertyInput,
  id?: string,
): Promise<string> {
  requireSession(profile, "landlord");
  const values = validateProperty(input);
  const { db } = getFirebase();
  const reference = id
    ? doc(db, "properties", id)
    : doc(collection(db, "properties"));
  await runTransaction(db, async (transaction) => {
    const existing = id
      ? await owned<Property>(transaction, reference, profile, "property")
      : null;
    const timestamp = now();
    transaction.set(reference, {
      ...(existing ?? base(profile, reference.id, timestamp)),
      ...values,
      tenantEmails: existing?.tenantEmails ?? [],
      updatedAt: timestamp,
    });
  });
  return reference.id;
}

export async function saveRoom(
  profile: Profile,
  input: RoomInput,
  id?: string,
): Promise<string> {
  requireSession(profile, "landlord");
  const values = validateRoom(input);
  const { db } = getFirebase();
  const reference = id ? doc(db, "rooms", id) : doc(collection(db, "rooms"));
  await runTransaction(db, async (transaction) => {
    await owned<Property>(
      transaction,
      doc(db, "properties", values.propertyId),
      profile,
      "property",
    );
    const existing = id
      ? await owned<Room>(transaction, reference, profile, "room")
      : null;
    if (existing && existing.propertyId !== values.propertyId)
      throw new Error("A room cannot be moved to another property.");
    const timestamp = now();
    transaction.set(reference, {
      ...(existing ?? base(profile, reference.id, timestamp)),
      ...values,
      updatedAt: timestamp,
    });
  });
  return reference.id;
}

export async function saveItem(
  profile: Profile,
  input: ItemInput,
  id?: string,
): Promise<string> {
  requireSession(profile, "landlord");
  const values = validateItem(input);
  const { db } = getFirebase();
  const reference = id ? doc(db, "items", id) : doc(collection(db, "items"));
  await runTransaction(db, async (transaction) => {
    await owned<Property>(
      transaction,
      doc(db, "properties", values.propertyId),
      profile,
      "property",
    );
    const roomReference = doc(db, "rooms", values.roomId);
    const room = await owned<Room>(transaction, roomReference, profile, "room");
    if (room.propertyId !== values.propertyId)
      throw new Error("The selected room belongs to a different property.");
    const existing = id
      ? await owned<Item>(transaction, reference, profile, "item")
      : null;
    if (existing && existing.propertyId !== values.propertyId)
      throw new Error("An item cannot be moved to another property.");
    const timestamp = now();
    transaction.set(reference, {
      ...(existing ?? base(profile, reference.id, timestamp)),
      ...values,
      updatedAt: timestamp,
    });
    // Serialize item changes with archiveRoom so an item cannot be added to a room being archived.
    transaction.update(roomReference, { updatedAt: timestamp });
  });
  return reference.id;
}

async function archive(
  profile: Profile,
  key: "properties" | "rooms" | "items",
  value: BaseRecord,
): Promise<void> {
  requireSession(profile, "landlord");
  const { db } = getFirebase();
  await runTransaction(db, async (transaction) => {
    const reference = doc(db, key, value.id);
    await owned(transaction, reference, profile, key.slice(0, -1));
    if (key === "properties") {
      // Tenancy saves write this property too, so simultaneous grants force a retry.
      const entries = await getDocs(
        query(collection(db, "tenancies"), where("ownerId", "==", profile.id)),
      );
      for (const entry of entries.docs.filter(
        (entry) =>
          entry.data().propertyId === value.id &&
          !entry.data().archived &&
          ["Upcoming", "Active"].includes(entry.data().status),
      )) {
        const tenancy = record<Tenancy>(
          await transaction.get(entry.ref),
          "Tenancy",
        );
        if (
          !tenancy.archived &&
          (tenancy.status === "Upcoming" || tenancy.status === "Active")
        )
          throw new Error(
            "Complete or cancel all upcoming and active tenancies before archiving this property.",
          );
      }
    }
    if (key === "rooms") {
      // The parent room is always read by item writes, so concurrent changes retry safely.
      const entries = await getDocs(
        query(collection(db, "items"), where("ownerId", "==", profile.id)),
      );
      for (const entry of entries.docs.filter(
        (entry) => entry.data().roomId === value.id && !entry.data().archived,
      )) {
        const item = record<Item>(await transaction.get(entry.ref), "Item");
        if (item.roomId === value.id && !item.archived)
          throw new Error(
            "Move or archive the items in this room before archiving it.",
          );
      }
    }
    transaction.update(reference, {
      archived: true,
      updatedAt: now(),
      ...(key === "properties" ? { tenantEmails: [] } : {}),
    });
  });
}

export function archiveProperty(
  profile: Profile,
  property: Property,
): Promise<void> {
  return archive(profile, "properties", property);
}
export function archiveRoom(profile: Profile, room: Room): Promise<void> {
  return archive(profile, "rooms", room);
}
export function archiveItem(profile: Profile, item: Item): Promise<void> {
  return archive(profile, "items", item);
}

export async function uploadPhotos(
  profile: Profile,
  propertyId: string,
  files: File[],
): Promise<Photo[]> {
  requireSession(profile);
  validatePhotoFiles(files);
  const { db, storage } = getFirebase();
  const property = record<Property>(
    await getDoc(doc(db, "properties", propertyId)),
    "Property",
  );
  if (property.archived) throw new Error("This property has been archived.");
  let tenancyId: string | undefined;
  if (profile.role === "landlord") requireOwner(property, profile, "property");
  else {
    const tenancies = await getDocs(
      query(
        collection(db, "tenancies"),
        where("tenantEmail", "==", normalizeEmail(profile.email)),
      ),
    );
    const active = tenancies.docs.find(
      (entry) =>
        entry.data().propertyId === propertyId &&
        entry.data().status === "Active" &&
        !entry.data().archived,
    );
    if (!active)
      throw new Error(
        "An active tenancy is required to upload supporting photos.",
      );
    tenancyId = active.id;
  }
  const uploaded: Photo[] = [];
  let storedCount = 0;
  try {
    for (const file of files) {
      const id = crypto.randomUUID();
      const path = `properties/${propertyId}/${profile.id}/${id}`;
      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, file, {
        contentType: file.type,
        ...(tenancyId ? { customMetadata: { tenancyId } } : {}),
      });
      storedCount++;
      uploaded.push({
        id,
        path,
        name: file.name,
        url: await getDownloadURL(fileRef),
        createdAt: now(),
      });
    }
    return uploaded;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Please try again.";
    // Stored evidence cannot be physically deleted by clients. Nothing is attached to a record on failure.
    throw new Error(
      `Photo upload failed. ${reason}${storedCount ? " Uploaded files were retained in Storage but were not attached; please retry your selection." : ""}`,
    );
  }
}

/** Remove the photo from a form/record; retain the bytes so older inspection snapshots keep working. */
export async function deletePhoto(
  profile: Profile,
  photo: Photo,
): Promise<void> {
  requireSession(profile);
  if (!photo.path.startsWith("properties/"))
    throw new Error("This photo does not belong to the application.");
}

export async function saveTenancy(
  profile: Profile,
  input: TenancyInput,
  id?: string,
): Promise<string> {
  requireSession(profile, "landlord");
  const values = validateTenancy(input);
  const { db } = getFirebase();
  const reference = id
    ? doc(db, "tenancies", id)
    : doc(collection(db, "tenancies"));
  await runTransaction(db, async (transaction) => {
    const propertyReference = doc(db, "properties", values.propertyId);
    const property = await owned<Property>(
      transaction,
      propertyReference,
      profile,
      "property",
      false,
    );
    if (
      property.archived &&
      (!id || values.status === "Upcoming" || values.status === "Active")
    )
      throw new Error(
        "An archived property cannot accept an upcoming or active tenancy.",
      );
    const existing = id
      ? await owned<Tenancy>(transaction, reference, profile, "tenancy")
      : null;
    if (
      existing &&
      (existing.propertyId !== values.propertyId ||
        existing.tenantEmail !== values.tenantEmail)
    )
      throw new Error(
        "Property and email cannot change after a tenancy is created. Cancel this tenancy and create a replacement.",
      );
    // Every tenancy change writes its parent property. That serializes membership updates,
    // including a simultaneous new tenancy that was not yet in this query's result.
    const entries = await getDocs(
      query(collection(db, "tenancies"), where("ownerId", "==", profile.id)),
    );
    const emails = new Set<string>();
    for (const entry of entries.docs.filter(
      (entry) =>
        entry.id !== reference.id &&
        entry.data().propertyId === values.propertyId,
    )) {
      const tenancy = record<Tenancy>(
        await transaction.get(entry.ref),
        "Tenancy",
      );
      if (
        !tenancy.archived &&
        (tenancy.status === "Upcoming" || tenancy.status === "Active")
      )
        emails.add(tenancy.tenantEmail);
    }
    if (values.status === "Upcoming" || values.status === "Active")
      emails.add(values.tenantEmail);
    const timestamp = now();
    transaction.set(reference, {
      ...(existing ?? base(profile, reference.id, timestamp)),
      ...values,
      updatedAt: timestamp,
    });
    transaction.update(propertyReference, {
      tenantEmails: [...emails].sort(),
      updatedAt: timestamp,
    });
  });
  return reference.id;
}

export async function createInspection(
  profile: Profile,
  tenancy: Tenancy,
  type: Inspection["type"],
  snapshots: SnapshotInput[],
): Promise<string> {
  requireSession(profile, "landlord");
  if (type !== "check-in" && type !== "check-out")
    throw new Error("Choose check-in or check-out.");
  if (!snapshots.length)
    throw new Error(
      "Add at least one inventory item before creating an inspection.",
    );
  if (snapshots.length > MAX_INSPECTION_ITEMS)
    throw new Error(
      `An inspection supports up to ${MAX_INSPECTION_ITEMS} items. Split larger inventories between properties.`,
    );
  const values = snapshots.map((snapshot) =>
    validateSnapshot(snapshot, tenancy.propertyId),
  );
  if (new Set(values.map((snapshot) => snapshot.itemId)).size !== values.length)
    throw new Error("Each item can appear only once in an inspection.");
  const { db } = getFirebase();
  const inspectionId = `${tenancy.id}_${type}`;
  const reference = doc(db, "inspections", inspectionId);
  await runTransaction(db, async (transaction) => {
    const currentTenancy = await owned<Tenancy>(
      transaction,
      doc(db, "tenancies", tenancy.id),
      profile,
      "tenancy",
    );
    if (currentTenancy.status === "Cancelled")
      throw new Error("Cancelled tenancies cannot have new inspections.");
    if (currentTenancy.propertyId !== tenancy.propertyId)
      throw new Error("This tenancy changed. Refresh and try again.");
    await owned<Property>(
      transaction,
      doc(db, "properties", currentTenancy.propertyId),
      profile,
      "property",
    );
    if ((await transaction.get(reference)).exists())
      throw new Error(
        `A ${type} inspection already exists for this tenancy. Historical inspections cannot be overwritten.`,
      );
    if (
      type === "check-out" &&
      !(
        await transaction.get(doc(db, "inspections", `${tenancy.id}_check-in`))
      ).exists()
    )
      throw new Error(
        "Create the check-in inspection before recording check-out.",
      );
    const itemRecords: Item[] = [];
    const rooms = new Map<string, Room>();
    for (const snapshot of values) {
      const item = await owned<Item>(
        transaction,
        doc(db, "items", snapshot.itemId),
        profile,
        "item",
      );
      if (item.propertyId !== currentTenancy.propertyId)
        throw new Error("Every inspection item must belong to this property.");
      itemRecords.push(item);
      if (!rooms.has(item.roomId))
        rooms.set(
          item.roomId,
          await owned<Room>(
            transaction,
            doc(db, "rooms", item.roomId),
            profile,
            "room",
          ),
        );
    }
    const timestamp = now();
    const inspection: Inspection = {
      ...base(profile, inspectionId, timestamp),
      propertyId: currentTenancy.propertyId,
      tenancyId: currentTenancy.id,
      tenantEmail: currentTenancy.tenantEmail,
      type,
      inspectedAt: timestamp,
      confirmed: false,
      confirmedAt: null,
      confirmedBy: null,
      itemCount: values.length,
    };
    transaction.set(reference, inspection);
    values.forEach((snapshot, index) => {
      const item = itemRecords[index];
      const snapshotId = `${inspectionId}_${snapshot.itemId}`;
      const entry: InspectionItem = {
        ...base(profile, snapshotId, timestamp),
        ...snapshot,
        propertyId: currentTenancy.propertyId,
        inspectionId,
        tenancyId: currentTenancy.id,
        tenantEmail: currentTenancy.tenantEmail,
        itemName: item.name,
        roomName: rooms.get(item.roomId)!.name,
        quantity: item.quantity,
        inspectedAt: timestamp,
      };
      transaction.set(doc(db, "inspectionItems", snapshotId), entry);
    });
  });
  return inspectionId;
}

export async function confirmInspection(
  profile: Profile,
  inspection: Inspection,
): Promise<void> {
  requireSession(profile, "tenant");
  const { db } = getFirebase();
  await runTransaction(db, async (transaction) => {
    const reference = doc(db, "inspections", inspection.id);
    const current = record<Inspection>(
      await transaction.get(reference),
      "Inspection",
    );
    if (current.tenantEmail !== normalizeEmail(profile.email))
      throw new Error("This inspection belongs to another tenant.");
    if (current.type !== "check-in")
      throw new Error("Only check-in inspections require tenant confirmation.");
    if (current.confirmed)
      throw new Error("This inspection has already been confirmed.");
    const timestamp = now();
    transaction.update(reference, {
      confirmed: true,
      confirmedAt: timestamp,
      confirmedBy: profile.id,
      updatedAt: timestamp,
    });
  });
}

export async function createDamageReport(
  profile: Profile,
  input: DamageInput,
): Promise<string> {
  requireSession(profile, "tenant");
  const values = validateDamage(input);
  const { db } = getFirebase();
  const reference = doc(collection(db, "damageReports"));
  await runTransaction(db, async (transaction) => {
    const tenancy = record<Tenancy>(
      await transaction.get(doc(db, "tenancies", values.tenancyId)),
      "Tenancy",
    );
    if (
      tenancy.tenantEmail !== normalizeEmail(profile.email) ||
      tenancy.status !== "Active" ||
      tenancy.archived ||
      tenancy.propertyId !== values.propertyId
    )
      throw new Error(
        "Select an item from your active tenancy to report damage.",
      );
    const property = record<Property>(
      await transaction.get(doc(db, "properties", values.propertyId)),
      "Property",
    );
    const item = record<Item>(
      await transaction.get(doc(db, "items", values.itemId)),
      "Item",
    );
    if (
      property.archived ||
      item.archived ||
      item.propertyId !== values.propertyId ||
      item.ownerId !== tenancy.ownerId
    )
      throw new Error(
        "This item is no longer available in your active inventory.",
      );
    const timestamp = now();
    const report: DamageReport = {
      ...base(profile, reference.id, timestamp),
      ...values,
      ownerId: tenancy.ownerId,
      tenantEmail: tenancy.tenantEmail,
      itemName: item.name,
      status: "Reported",
      ownerNotes: "",
      reportedBy: profile.id,
    };
    transaction.set(reference, report);
  });
  return reference.id;
}

export async function updateDamageReport(
  profile: Profile,
  report: DamageReport,
  status: DamageStatus,
  ownerNotes: string,
): Promise<void> {
  requireSession(profile, "landlord");
  const values = validateDamageUpdate(status, ownerNotes);
  const { db } = getFirebase();
  await runTransaction(db, async (transaction) => {
    const reference = doc(db, "damageReports", report.id);
    await owned<DamageReport>(transaction, reference, profile, "damage report");
    transaction.update(reference, { ...values, updatedAt: now() });
  });
}
