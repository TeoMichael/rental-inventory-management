import {
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Package,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { WorkspaceData } from "@/lib/types";

export type Activity = {
  id: string;
  date: string;
  title: string;
  detail: string;
  href: string;
  icon: LucideIcon;
};

export function recentActivity(data: WorkspaceData): Activity[] {
  const propertyName = (id: string) =>
    data.properties.find((property) => property.id === id)?.name ??
    "Previous property";
  const entries: Activity[] = [
    ...data.properties.map((property) => ({
      id: `property-${property.id}`,
      date: property.updatedAt,
      title: property.archived
        ? "Property archived"
        : property.updatedAt !== property.createdAt
          ? "Property updated"
          : "Property added",
      detail: property.name,
      href: property.archived
        ? "/properties"
        : `/properties/detail?id=${encodeURIComponent(property.id)}`,
      icon: Building2,
    })),
    ...data.items.map((item) => ({
      id: `item-${item.id}`,
      date: item.updatedAt,
      title: item.archived
        ? "Item archived"
        : item.updatedAt !== item.createdAt
          ? "Inventory item updated"
          : "Inventory item added",
      detail: `${item.name} · ${propertyName(item.propertyId)}`,
      href: "/inventory",
      icon: Package,
    })),
    ...data.tenancies.map((tenancy) => ({
      id: `tenancy-${tenancy.id}`,
      date: tenancy.updatedAt,
      title:
        tenancy.updatedAt !== tenancy.createdAt
          ? "Tenancy updated"
          : "Tenancy added",
      detail: `${tenancy.tenantName} · ${tenancy.status}`,
      href: "/tenancies",
      icon: Users,
    })),
    ...data.inspections.map((inspection) => ({
      id: `inspection-${inspection.id}`,
      date: inspection.inspectedAt,
      title:
        inspection.type === "check-in"
          ? "Check-in recorded"
          : "Check-out recorded",
      detail: `${propertyName(inspection.propertyId)} · ${inspection.itemCount} items`,
      href: "/inspections",
      icon: ClipboardCheck,
    })),
    ...data.inspections
      .filter((inspection) => inspection.confirmed && inspection.confirmedAt)
      .map((inspection) => ({
        id: `confirmation-${inspection.id}`,
        date: inspection.confirmedAt ?? inspection.inspectedAt,
        title: "Tenant confirmed check-in",
        detail: propertyName(inspection.propertyId),
        href: "/inspections",
        icon: CheckCircle2,
      })),
    ...data.damageReports.map((report) => ({
      id: `damage-${report.id}`,
      date: report.updatedAt,
      title:
        report.updatedAt !== report.createdAt
          ? "Damage report updated"
          : "Damage reported",
      detail: `${report.itemName} · ${report.status}`,
      href: "/damage",
      icon: Wrench,
    })),
  ];
  return entries.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
}
