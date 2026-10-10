import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  where,
} from "firebase/firestore";
import { getFirebase } from "./firebase";
import { friendlyError } from "./format";
import {
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
  type PropertyAccess,
  type PropertyInput,
  type Room,
  type RoomInput,
  type SnapshotInput,
  type Tenancy,
  type TenancyInput,
} from "./types";
import {
  MAX_INSPECTION_ITEMS,
  normalizeEmail,
  validateDamage,
  validateDamageUpdate,
  validateItem,
  validatePhotoFiles,
  validatePhotos,
  validateProperty,
  validateRoom,
  validateSnapshot,
  validateTenancy,
} from "./validation";

import {
  base,
  now,
  owned,
  record,
  requireOwner,
  requireSession,
} from "./repository-core";
export { subscribeWorkspace } from "./workspace";

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
    const accessReference =
      key === "properties" ? doc(db, "propertyAccess", value.id) : null;
    const accessSnapshot = accessReference
      ? await transaction.get(accessReference)
      : null;
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
    const timestamp = now();
    transaction.update(reference, {
      archived: true,
      updatedAt: timestamp,
    });
    if (accessReference)
      transaction.set(accessReference, {
        id: value.id,
        ownerId: profile.id,
        tenantEmails: [],
        createdAt: accessSnapshot?.data()?.createdAt ?? timestamp,
        updatedAt: timestamp,
      } satisfies PropertyAccess);
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
  const { db, auth } = getFirebase();
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
      const token = await auth.currentUser!.getIdToken();
      const parameters = new URLSearchParams({ propertyId });
      if (tenancyId) parameters.set("tenancyId", tenancyId);
      const response = await fetch(`/api/photos?${parameters}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": file.type,
          "X-File-Name": encodeURIComponent(file.name),
        },
        body: file,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          typeof result?.error === "string"
            ? result.error
            : "Photo upload could not finish. Please try again.",
        );
      const photo = validatePhotos([result as Photo], propertyId)[0];
      storedCount++;
      uploaded.push(photo);
    }
    return uploaded;
  } catch (error) {
    const reason = friendlyError(error);
    // Stored evidence cannot be physically deleted by clients. Nothing is attached to a record on failure.
    throw new Error(
      `Photo upload failed. ${reason}${storedCount ? " Uploaded files were retained but were not attached; please retry your selection." : ""}`,
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
    const accessReference = doc(db, "propertyAccess", values.propertyId);
    const accessSnapshot = await transaction.get(accessReference);
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
    transaction.set(accessReference, {
      id: values.propertyId,
      ownerId: profile.id,
      tenantEmails: property.archived ? [] : [...emails].sort(),
      createdAt: accessSnapshot.data()?.createdAt ?? timestamp,
      updatedAt: timestamp,
    } satisfies PropertyAccess);
    transaction.update(propertyReference, { updatedAt: timestamp });
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
      const room = rooms.get(item.roomId)!;
      if (
        item.name !== snapshot.itemName ||
        room.name !== snapshot.roomName ||
        item.quantity !== snapshot.quantity
      )
        throw new Error(
          "Inventory changed while you were reviewing this inspection. Close the form, reopen it, and review the updated items before saving.",
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
