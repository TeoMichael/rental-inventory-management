import {
  CATEGORIES,
  CONDITIONS,
  DAMAGE_STATUSES,
  TENANCY_STATUSES,
  type DamageInput,
  type DamageStatus,
  type ItemInput,
  type Photo,
  type PropertyInput,
  type RoomInput,
  type SnapshotInput,
  type TenancyInput,
} from "./types";

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const MAX_PHOTOS = 10;
export const MAX_INSPECTION_ITEMS = 400;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

function required(value: unknown, label: string, max = 200): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${label} is required.`);
  if (value.trim().length > max)
    throw new Error(`${label} must be ${max} characters or fewer.`);
  return value.trim();
}

function optional(value: unknown, label: string, max = 5000): string {
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  if (value.trim().length > max)
    throw new Error(`${label} must be ${max} characters or fewer.`);
  return value.trim();
}

export function normalizeEmail(value: string): string {
  const email = required(value, "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Enter a valid email address.");
  return email;
}

function quantity(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 10000)
    throw new Error("Quantity must be a whole number between 1 and 10,000.");
  return value;
}

export function validatePhotos(photos: Photo[], propertyId?: string): Photo[] {
  if (!Array.isArray(photos) || photos.length > MAX_PHOTOS)
    throw new Error(`Use ${MAX_PHOTOS} photos or fewer.`);
  return photos.map((photo) => {
    if (
      !photo ||
      !photo.id ||
      !photo.name ||
      !photo.createdAt ||
      !photo.path ||
      !photo.url
    )
      throw new Error("A photo is incomplete. Remove it and upload again.");
    const parts = photo.path.split("/");
    if (
      photo.id.length > 128 ||
      photo.name.length > 255 ||
      photo.url.length > 2048 ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(photo.createdAt) ||
      parts.length !== 4 ||
      parts[0] !== "properties" ||
      !parts[1] ||
      !parts[2] ||
      parts[3] !== photo.id
    )
      throw new Error("A photo is invalid. Remove it and upload again.");
    if (
      !/^https:\/\//.test(photo.url) &&
      !/^http:\/\/127\.0\.0\.1(?::\d+)?\//.test(photo.url)
    )
      throw new Error("A photo URL is invalid.");
    if (propertyId && !photo.path.startsWith(`properties/${propertyId}/`))
      throw new Error("Photos must belong to this property.");
    return {
      id: photo.id,
      name: photo.name,
      path: photo.path,
      url: photo.url,
      createdAt: photo.createdAt,
    };
  });
}

export function validateProperty(input: PropertyInput): PropertyInput {
  return {
    name: required(input.name, "Property name"),
    address: optional(input.address, "Address", 500),
    description: optional(input.description, "Description"),
    propertyType: required(input.propertyType, "Property type", 100),
  };
}

export function validateRoom(input: RoomInput): RoomInput {
  return {
    propertyId: required(input.propertyId, "Property"),
    name: required(input.name, "Room name"),
    description: optional(input.description, "Description"),
  };
}

export function validateItem(input: ItemInput): ItemInput {
  if (!CATEGORIES.includes(input.category))
    throw new Error("Choose a valid category.");
  if (!CONDITIONS.includes(input.condition))
    throw new Error("Choose a valid condition.");
  if (
    input.estimatedValue !== null &&
    (!Number.isFinite(input.estimatedValue) ||
      input.estimatedValue < 0 ||
      input.estimatedValue > 1e12)
  )
    throw new Error("Estimated value must be zero or a positive amount.");
  const propertyId = required(input.propertyId, "Property");
  return {
    ...input,
    propertyId,
    roomId: required(input.roomId, "Room"),
    name: required(input.name, "Item name"),
    quantity: quantity(input.quantity),
    description: optional(input.description, "Description"),
    photos: validatePhotos(input.photos, propertyId),
  };
}

function calendarDate(value: string, label: string): string {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new Error(`Enter a valid ${label.toLowerCase()}.`);
  return value;
}

export function validateTenancy(input: TenancyInput): TenancyInput {
  if (!TENANCY_STATUSES.includes(input.status))
    throw new Error("Choose a valid tenancy status.");
  const startDate = calendarDate(input.startDate, "Start date");
  const endDate = calendarDate(input.endDate, "End date");
  if (startDate > endDate)
    throw new Error("Start date must not be after end date.");
  return {
    ...input,
    propertyId: required(input.propertyId, "Property"),
    tenantName: required(input.tenantName, "Tenant name"),
    tenantEmail: normalizeEmail(input.tenantEmail),
    phone: optional(input.phone, "Phone", 80),
    startDate,
    endDate,
  };
}

export function validateSnapshot(
  input: SnapshotInput,
  propertyId?: string,
): SnapshotInput {
  if (!CONDITIONS.includes(input.condition))
    throw new Error("Choose a valid inspection condition.");
  return {
    itemId: required(input.itemId, "Item"),
    itemName: required(input.itemName, "Item name"),
    roomName: required(input.roomName, "Room name"),
    quantity: quantity(input.quantity),
    condition: input.condition,
    notes: optional(input.notes, "Inspection notes"),
    photos: validatePhotos(input.photos, propertyId),
  };
}

export function validateDamage(input: DamageInput): DamageInput {
  const propertyId = required(input.propertyId, "Property");
  return {
    propertyId,
    tenancyId: required(input.tenancyId, "Tenancy"),
    itemId: required(input.itemId, "Item"),
    description: required(input.description, "Damage description", 5000),
    photos: validatePhotos(input.photos, propertyId),
  };
}

export function validateDamageUpdate(
  status: DamageStatus,
  ownerNotes: string,
): { status: DamageStatus; ownerNotes: string } {
  if (!DAMAGE_STATUSES.includes(status))
    throw new Error("Choose a valid report status.");
  return { status, ownerNotes: optional(ownerNotes, "Owner notes") };
}

export function validatePhotoFiles(files: Pick<File, "size" | "type">[]): void {
  if (!files.length) throw new Error("Choose at least one photo.");
  if (files.length > MAX_PHOTOS)
    throw new Error(`Upload ${MAX_PHOTOS} photos or fewer at once.`);
  for (const file of files) {
    if (!PHOTO_TYPES.includes(file.type))
      throw new Error("Photos must be JPEG, PNG, or WebP images.");
    if (file.size <= 0 || file.size > MAX_PHOTO_BYTES)
      throw new Error("Each photo must be nonempty and no larger than 8 MB.");
  }
}
