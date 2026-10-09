import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebase } from "./firebase";
import { requireSession } from "./repository-core";
import {
  EMPTY_WORKSPACE,
  type Profile,
  type Property,
  type WorkspaceData,
} from "./types";
import { normalizeEmail } from "./validation";

/** Private grant documents are evaluated by rules, never read into the tenant workspace. */
export function subscribeWorkspace(
  profile: Profile,
  onData: (data: WorkspaceData) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  requireSession(profile);
  const { db } = getFirebase();
  const data: WorkspaceData = structuredClone(EMPTY_WORKSPACE);
  const subscriptions: Unsubscribe[] = [];
  let propertySubscriptions: Unsubscribe[] = [];
  let inventorySubscriptions: Unsubscribe[] = [];
  let propertyGeneration = 0;
  let inventoryGeneration = 0;
  let currentTenancyIds = "";
  let currentInventoryIds = "";
  let closed = false;
  const publish = () => {
    if (!closed) onData({ ...data });
  };
  const stopInventory = () => {
    ++inventoryGeneration;
    inventorySubscriptions.forEach((unsubscribe) => unsubscribe());
    inventorySubscriptions = [];
    currentInventoryIds = "";
    data.rooms = [];
    data.items = [];
  };
  const clearProperties = () => {
    ++propertyGeneration;
    propertySubscriptions.forEach((unsubscribe) => unsubscribe());
    propertySubscriptions = [];
    currentTenancyIds = "";
    data.properties = [];
    stopInventory();
  };
  const fail = (key: keyof WorkspaceData, error: Error) => {
    if (closed) return;
    (data[key] as unknown[]) = [];
    if (
      profile.role === "tenant" &&
      ["tenancies", "properties", "rooms", "items"].includes(key)
    )
      clearProperties();
    publish();
    onError(error);
  };

  function refreshInventory(ids: string[]) {
    const signature = ids.join("|");
    if (signature === currentInventoryIds) return;
    stopInventory();
    currentInventoryIds = signature;
    const generation = inventoryGeneration;
    for (const key of ["rooms", "items"] as const) {
      const chunks = new Map<number, DocumentData[]>();
      // Rules check a profile, the private grant, and the parent property for each ID.
      for (let index = 0; index < ids.length; index += 4) {
        const offset = index;
        inventorySubscriptions.push(
          onSnapshot(
            query(
              collection(db, key),
              where("propertyId", "in", ids.slice(index, index + 4)),
              where("archived", "==", false),
            ),
            { includeMetadataChanges: true },
            (snapshot) => {
              if (closed || generation !== inventoryGeneration) return;
              if (snapshot.metadata.fromCache) chunks.delete(offset);
              else
                chunks.set(
                  offset,
                  snapshot.docs.map((entry) => ({
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
  }

  function refreshProperties() {
    const ids = [
      ...new Set(
        data.tenancies
          .filter(
            (tenancy) =>
              !tenancy.archived &&
              (tenancy.status === "Upcoming" || tenancy.status === "Active"),
          )
          .map((tenancy) => tenancy.propertyId),
      ),
    ].sort();
    const signature = ids.join("|");
    if (signature === currentTenancyIds) return;
    clearProperties();
    currentTenancyIds = signature;
    const generation = propertyGeneration;
    const properties = new Map<string, Property>();
    const serverReady = new Set<string>();
    for (const id of ids) {
      propertySubscriptions.push(
        onSnapshot(
          doc(db, "properties", id),
          { includeMetadataChanges: true },
          (snapshot) => {
            if (closed || generation !== propertyGeneration) return;
            if (snapshot.metadata.fromCache) {
              properties.delete(id);
              serverReady.delete(id);
            } else {
              serverReady.add(id);
              if (!snapshot.exists() || snapshot.data().archived)
                properties.delete(id);
              else
                properties.set(id, {
                  ...snapshot.data(),
                  id: snapshot.id,
                } as Property);
            }
            data.properties = [...properties.values()].sort((left, right) =>
              left.id.localeCompare(right.id),
            );
            // Wait for all initial document checks so a large workspace creates one set of chunk queries.
            refreshInventory(
              serverReady.size === ids.length
                ? data.properties.map((property) => property.id)
                : [],
            );
            publish();
          },
          (error) => {
            if (!closed && generation === propertyGeneration)
              fail("properties", error);
          },
        ),
      );
    }
    publish();
  }

  function watch(key: keyof WorkspaceData, field: string, value: string) {
    subscriptions.push(
      onSnapshot(
        query(collection(db, key), where(field, "==", value)),
        { includeMetadataChanges: true },
        (snapshot) => {
          if (closed) return;
          (data[key] as unknown[]) =
            profile.role === "tenant" && snapshot.metadata.fromCache
              ? []
              : snapshot.docs.map((entry) => ({
                  ...entry.data(),
                  id: entry.id,
                }));
          if (profile.role === "tenant" && key === "tenancies") {
            if (snapshot.metadata.fromCache) clearProperties();
            else refreshProperties();
          }
          publish();
        },
        (error) => fail(key, error),
      ),
    );
  }

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
  }
  return () => {
    closed = true;
    subscriptions.forEach((unsubscribe) => unsubscribe());
    propertySubscriptions.forEach((unsubscribe) => unsubscribe());
    inventorySubscriptions.forEach((unsubscribe) => unsubscribe());
  };
}
