"use client";

import { useWorkspace } from "./workspace-provider";
import { LandlordDashboard } from "./dashboard/landlord";
import { TenantDashboard } from "./dashboard/tenant";

export default function DashboardView() {
  const { profile } = useWorkspace();
  return profile.role === "landlord" ? (
    <LandlordDashboard />
  ) : (
    <TenantDashboard />
  );
}
