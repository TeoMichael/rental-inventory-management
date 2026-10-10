export const CONDITIONS = ["New", "Good", "Fair", "Damaged", "Broken"] as const;
export const CATEGORIES = [
  "Furniture",
  "Appliance",
  "Electronics",
  "Kitchen Equipment",
  "Bathroom Equipment",
  "Decoration",
  "Other",
] as const;
export const TENANCY_STATUSES = [
  "Upcoming",
  "Active",
  "Completed",
  "Cancelled",
] as const;
export const DAMAGE_STATUSES = [
  "Reported",
  "Checking",
  "Repairing",
  "Resolved",
] as const;
export type Condition = (typeof CONDITIONS)[number];
export type Category = (typeof CATEGORIES)[number];
export type TenancyStatus = (typeof TENANCY_STATUSES)[number];
export type DamageStatus = (typeof DAMAGE_STATUSES)[number];
export type Role = "landlord" | "tenant";
export interface Profile {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}
export interface BaseRecord {
  id: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
}
export interface Property extends BaseRecord {
  name: string;
  address: string;
  description: string;
  propertyType: string;
}
/** Private authorization projection; never included in tenant-readable property records. */
export interface PropertyAccess {
  id: string;
  ownerId: string;
  tenantEmails: string[];
  createdAt: string;
  updatedAt: string;
}
export interface Room extends BaseRecord {
  propertyId: string;
  name: string;
  description: string;
}
export interface Photo {
  id: string;
  url: string;
  path: string;
  name: string;
  createdAt: string;
  provider?: "imagekit";
  fileId?: string;
}
export interface Item extends BaseRecord {
  propertyId: string;
  roomId: string;
  name: string;
  category: Category;
  quantity: number;
  condition: Condition;
  description: string;
  estimatedValue: number | null;
  photos: Photo[];
}
export interface Tenancy extends BaseRecord {
  propertyId: string;
  tenantName: string;
  tenantEmail: string;
  phone: string;
  startDate: string;
  endDate: string;
  status: TenancyStatus;
}
export interface Inspection extends BaseRecord {
  propertyId: string;
  tenancyId: string;
  tenantEmail: string;
  type: "check-in" | "check-out";
  inspectedAt: string;
  confirmed: boolean;
  confirmedAt: string | null;
  confirmedBy: string | null;
  itemCount: number;
}
export interface InspectionItem extends BaseRecord {
  propertyId: string;
  inspectionId: string;
  tenancyId: string;
  tenantEmail: string;
  itemId: string;
  itemName: string;
  roomName: string;
  quantity: number;
  condition: Condition;
  notes: string;
  photos: Photo[];
  inspectedAt: string;
}
export interface DamageReport extends BaseRecord {
  propertyId: string;
  tenancyId: string;
  tenantEmail: string;
  itemId: string;
  itemName: string;
  description: string;
  photos: Photo[];
  status: DamageStatus;
  ownerNotes: string;
  reportedBy: string;
}
export interface WorkspaceData {
  properties: Property[];
  rooms: Room[];
  items: Item[];
  tenancies: Tenancy[];
  inspections: Inspection[];
  inspectionItems: InspectionItem[];
  damageReports: DamageReport[];
}
export const EMPTY_WORKSPACE: WorkspaceData = {
  properties: [],
  rooms: [],
  items: [],
  tenancies: [],
  inspections: [],
  inspectionItems: [],
  damageReports: [],
};
export type PropertyInput = Pick<
  Property,
  "name" | "address" | "description" | "propertyType"
>;
export type RoomInput = Pick<Room, "propertyId" | "name" | "description">;
export type ItemInput = Pick<
  Item,
  | "propertyId"
  | "roomId"
  | "name"
  | "category"
  | "quantity"
  | "condition"
  | "description"
  | "estimatedValue"
  | "photos"
>;
export type TenancyInput = Pick<
  Tenancy,
  | "propertyId"
  | "tenantName"
  | "tenantEmail"
  | "phone"
  | "startDate"
  | "endDate"
  | "status"
>;
export type SnapshotInput = Pick<
  InspectionItem,
  | "itemId"
  | "itemName"
  | "roomName"
  | "quantity"
  | "condition"
  | "notes"
  | "photos"
>;
export type DamageInput = Pick<
  DamageReport,
  "propertyId" | "tenancyId" | "itemId" | "description" | "photos"
>;
