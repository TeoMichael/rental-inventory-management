"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Package,
  Plus,
  Users,
  Wrench,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Badge, EmptyState, PageHeading } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { Stat, ActivityList } from "./shared";
import { recentActivity } from "./activity";

export function LandlordDashboard() {
  const { profile, data, loading } = useWorkspace();
  const properties = data.properties.filter((property) => !property.archived);
  const propertyIds = new Set(properties.map((property) => property.id));
  const items = data.items.filter(
    (item) => !item.archived && propertyIds.has(item.propertyId),
  );
  const activeTenancies = data.tenancies.filter(
    (tenancy) =>
      !tenancy.archived &&
      tenancy.status === "Active" &&
      propertyIds.has(tenancy.propertyId),
  );
  const activeTenants = new Set(
    activeTenancies.map((tenancy) => tenancy.tenantEmail.toLowerCase()),
  ).size;
  const damagedUnits = items
    .filter(
      (item) => item.condition === "Damaged" || item.condition === "Broken",
    )
    .reduce((sum, item) => sum + item.quantity, 0);
  const reports = data.damageReports
    .filter((report) => !report.archived && report.status !== "Resolved")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const pending = data.inspections
    .filter(
      (inspection) => inspection.type === "check-in" && !inspection.confirmed,
    )
    .sort((a, b) => a.inspectedAt.localeCompare(b.inspectedAt));
  const activity = recentActivity(data);
  const propertyName = (id: string) =>
    data.properties.find((property) => property.id === id)?.name ??
    "Previous property";

  return (
    <>
      <PageHeading
        eyebrow="YOUR WORKSPACE AT A GLANCE"
        title={`Hello, ${profile.name.trim().split(" ")[0]}.`}
        description="A clear picture of your properties, tenants, and handovers."
        action={
          <Link className="button primary" href="/properties">
            <Plus size={17} /> Manage properties
          </Link>
        }
      />
      <div className="dashboard-banner">
        <div>
          <span className="banner-tag">EVERY DETAIL, IN ITS PLACE</span>
          <h2>
            Good handovers start
            <br />
            with a clear record.
          </h2>
          <p>
            {loading
              ? "Your property records are loading."
              : `${reports.length} open ${reports.length === 1 ? "report" : "reports"} · ${pending.length} check-in ${pending.length === 1 ? "confirmation" : "confirmations"} pending`}
          </p>
          <Link href="/inspections">
            View handovers <ArrowRight size={17} />
          </Link>
        </div>
        <div className="banner-house" aria-hidden="true">
          <Building2 size={110} strokeWidth={0.8} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-7 lg:grid-cols-3 xl:grid-cols-5">
        <Stat
          title="Properties"
          value={properties.length}
          detail="Current rental properties"
          icon={Building2}
          loading={loading}
          href="/properties"
        />
        <Stat
          title="Inventory units"
          value={items.reduce((sum, item) => sum + item.quantity, 0)}
          detail={`${items.length} inventory records`}
          icon={Package}
          loading={loading}
          href="/inventory"
        />
        <Stat
          title="Active tenants"
          value={activeTenants}
          detail="Distinct tenant email addresses"
          icon={Users}
          loading={loading}
          href="/tenancies"
        />
        <Stat
          title="Damaged units"
          value={damagedUnits}
          detail="Damaged or broken condition"
          icon={CircleAlert}
          loading={loading}
          href="/inventory"
        />
        <Stat
          title="Open reports"
          value={reports.length}
          detail="Awaiting a resolution"
          icon={Wrench}
          loading={loading}
          href="/damage"
        />
      </div>
      <div className="dashboard-columns mb-7">
        <section className="card">
          <div className="section-heading">
            <div>
              <h2>Needs attention</h2>
              <p className="text-muted">
                The next steps for a smoother tenancy.
              </p>
            </div>
            <Badge tone={reports.length + pending.length ? "amber" : "green"}>
              {loading
                ? "Loading"
                : reports.length + pending.length
                  ? `${reports.length + pending.length} pending`
                  : "Up to date"}
            </Badge>
          </div>
          {loading ? (
            <p className="text-muted py-5 text-sm">
              Loading outstanding actions…
            </p>
          ) : !reports.length && !pending.length ? (
            <div className="rounded-xl bg-[#f1f6ed] p-5 text-center">
              <CheckCircle2 className="mx-auto text-[#6c916b] mb-3" size={28} />
              <h3 className="font-semibold text-sm">
                Everything is up to date
              </h3>
              <p className="text-muted text-xs mt-2">
                No open damage reports or unconfirmed check-ins.
              </p>
            </div>
          ) : (
            <>
              {reports.slice(0, 3).map((report) => (
                <Link href="/damage" key={report.id} className="activity-row">
                  <span className="rounded-lg bg-[#fbf1e9] p-2 text-[#b0815d] shrink-0">
                    <Wrench size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate">
                      {report.itemName}
                    </strong>
                    <p className="truncate">
                      {propertyName(report.propertyId)} · Reported{" "}
                      {formatDate(report.createdAt)}
                    </p>
                  </div>
                  <Badge
                    tone={
                      report.status === "Reported"
                        ? "red"
                        : report.status === "Checking"
                          ? "amber"
                          : "blue"
                    }
                  >
                    {report.status}
                  </Badge>
                </Link>
              ))}
              {pending.slice(0, 3).map((inspection) => (
                <Link
                  href="/inspections"
                  key={inspection.id}
                  className="activity-row"
                >
                  <span className="rounded-lg bg-[#eef3e9] p-2 text-[#789269] shrink-0">
                    <ClipboardCheck size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate">
                      Check-in awaiting confirmation
                    </strong>
                    <p className="truncate">
                      {propertyName(inspection.propertyId)} ·{" "}
                      {data.tenancies.find(
                        (tenancy) => tenancy.id === inspection.tenancyId,
                      )?.tenantName ?? inspection.tenantEmail}
                    </p>
                  </div>
                  <ArrowRight size={16} className="text-[#97a68b] shrink-0" />
                </Link>
              ))}
              {(reports.length > 3 || pending.length > 3) && (
                <p className="text-muted text-xs mt-4">
                  Showing the oldest outstanding records. Open damage reports or
                  inspections to see all.
                </p>
              )}
            </>
          )}
          <div className="flex flex-wrap gap-4 mt-5">
            <Link className="text-link" href="/damage">
              Manage reports <ArrowRight size={14} />
            </Link>
            <Link className="text-link" href="/inspections">
              View inspections <ArrowRight size={14} />
            </Link>
          </div>
        </section>
        <section className="card">
          <div className="section-heading">
            <div>
              <h2>Recent activity</h2>
              <p className="text-muted">
                Latest changes to your saved records.
              </p>
            </div>
            <Clock3 size={19} className="text-[#9ca78f]" />
          </div>
          <ActivityList entries={activity} loading={loading} />
        </section>
      </div>
      <div className="section-heading">
        <div>
          <h2>Your properties</h2>
          <p className="text-muted">
            Inventory and tenancy coverage, in one place.
          </p>
        </div>
        <Link className="text-link" href="/properties">
          View all <ArrowRight size={16} />
        </Link>
      </div>
      <section className="card">
        {properties.length ? (
          <div className="dashboard-property-list">
            {properties.slice(0, 5).map((property) => {
              const units = items
                .filter((item) => item.propertyId === property.id)
                .reduce((sum, item) => sum + item.quantity, 0);
              const tenants = new Set(
                activeTenancies
                  .filter((tenancy) => tenancy.propertyId === property.id)
                  .map((tenancy) => tenancy.tenantEmail.toLowerCase()),
              ).size;
              return (
                <Link href={`/properties/${property.id}`} key={property.id}>
                  <span className="room-icon shrink-0">
                    <Building2 size={22} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate">{property.name}</strong>
                    <small className="truncate">
                      {property.address || property.propertyType} · {units}{" "}
                      inventory {units === 1 ? "unit" : "units"}
                    </small>
                  </div>
                  <span className="hidden sm:inline">
                    <Badge tone={tenants ? "green" : "neutral"}>
                      {tenants
                        ? `${tenants} active ${tenants === 1 ? "tenant" : "tenants"}`
                        : "No active tenancy"}
                    </Badge>
                  </span>
                  <ArrowRight size={18} />
                </Link>
              );
            })}
          </div>
        ) : (
          !loading && (
            <EmptyState
              icon={Building2}
              title="Let’s get your first property ready"
              description="Add a property, create its rooms, and record the items that make it a home."
              action={
                <Link className="button primary" href="/properties">
                  Add your first property <ArrowRight size={16} />
                </Link>
              }
            />
          )
        )}
      </section>
    </>
  );
}
