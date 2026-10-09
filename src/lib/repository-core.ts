import type {
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  Transaction,
} from "firebase/firestore";
import { getFirebase } from "./firebase";
import type { BaseRecord, Profile } from "./types";

export function now(): string {
  return new Date().toISOString();
}

export function requireSession(profile: Profile, role?: Profile["role"]): void {
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

export function record<T>(
  snapshot: DocumentSnapshot<DocumentData>,
  label: string,
): T {
  if (!snapshot.exists())
    throw new Error(`${label} could not be found. It may have been removed.`);
  return { ...snapshot.data(), id: snapshot.id } as T;
}

export function requireOwner<T extends BaseRecord>(
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

export async function owned<T extends BaseRecord>(
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

export function base(
  profile: Profile,
  id: string,
  timestamp: string,
): BaseRecord {
  return {
    id,
    ownerId: profile.id,
    createdAt: timestamp,
    updatedAt: timestamp,
    archived: false,
  };
}
