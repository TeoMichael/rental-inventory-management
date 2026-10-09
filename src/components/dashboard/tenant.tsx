"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  KeyRound,
  Package,
  Wrench,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Badge, EmptyState, PageHeading } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { Stat } from "./shared";

export function TenantDashboard() {
  const { profile, data, loading } = useWorkspace();
  const email = profile.email.toLowerCase();
  const tenancies = data.tenancies.filter(
    (tenancy) => !tenancy.archived && tenancy.tenantEmail === email,
  );
  const current = tenancies
    .filter(
      (tenancy) => tenancy.status === "Active" || tenancy.status === "Upcoming",
    )
    .sort(
      (a, b) =>
        Number(b.status === "Active") - Number(a.status === "Active") ||
        a.startDate.localeCompare(b.startDate),
    );
  const active = current.filter((tenancy) => tenancy.status === "Active");
  const propertyIds = new Set(current.map((tenancy) => tenancy.propertyId));
  const items = data.items.filter(
    (item) => !item.archived && propertyIds.has(item.propertyId),
  );
  const pending = data.inspections
    .filter(
      (inspection) =>
        inspection.tenantEmail === email &&
        inspection.type === "check-in" &&
        !inspection.confirmed,
    )
    .sort((a, b) => b.inspectedAt.localeCompare(a.inspectedAt));
  const reports = data.damageReports
    .filter(
      (report) =>
        !report.archived &&
        report.tenantEmail === email &&
        report.status !== "Resolved",
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const propertyName = (id: string) =>
    data.properties.find((property) => property.id === id)?.name ??
    "Assigned property";

  return (
    <>
      <PageHeading
        eyebrow="YOUR HOME, AT A GLANCE"
        title={`Welcome home, ${profile.name.trim().split(" ")[0]}.`}
        description="Your tenancy, inventory, and handover records, all together."
        action={
          <Link href="/inventory" className="button primary">
            <Package size={17} /> View inventory
          </Link>
        }
      />
      <div className="dashboard-banner">
        <div>
          <span className="banner-tag">SETTLE IN WITH A CLEAR RECORD</span>
          <h2>
            Your home.
            <br />
            Every detail recorded.
          </h2>
          <p>
            {pending.length
              ? `${pending.length} check-in ${pending.length === 1 ? "record is" : "records are"} ready for your review.`
              : "Review your inventory and keep your landlord informed."}
          </p>
          <Link href={pending.length ? "/inspections" : "/inventory"}>
            {pending.length ? "Review check-in" : "Explore your inventory"}{" "}
            <ArrowRight size={17} />
          </Link>
        </div>
        <div className="banner-house" aria-hidden="true">
          <KeyRound size={100} strokeWidth={0.8} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-7 xl:grid-cols-4">
        <Stat
          title="Active tenancies"
          value={active.length}
          detail="Your current rental agreements"
          icon={KeyRound}
          loading={loading}
        />
        <Stat
          title="Inventory units"
          value={items.reduce((sum, item) => sum + item.quantity, 0)}
          detail="In your assigned properties"
          icon={Package}
          loading={loading}
          href="/inventory"
        />
        <Stat
          title="To confirm"
          value={pending.length}
          detail="Check-in records awaiting you"
          icon={ClipboardCheck}
          loading={loading}
          href="/inspections"
        />
        <Stat
          title="Open reports"
          value={reports.length}
          detail="Issues your landlord is tracking"
          icon={Wrench}
          loading={loading}
          href="/damage"
        />
      </div>
      <div className="dashboard-columns">
        <section className="card">
          <div className="section-heading">
            <div>
              <h2>Your tenancies</h2>
              <p className="text-muted">
                Current and upcoming rental agreements.
              </p>
            </div>
            <CalendarDays size={19} className="text-[#9ca78f]" />
          </div>
          {current.length ? (
            <div className="space-y-4">
              {current.map((tenancy) => {
                const property = data.properties.find(
                  (record) => record.id === tenancy.propertyId,
                );
                return (
                  <article
                    key={tenancy.id}
                    className="rounded-xl border border-[#e4e9df] p-4"
                  >
                    <div className="flex gap-3 justify-between items-start">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm">
                          {propertyName(tenancy.propertyId)}
                        </h3>
                        <p className="text-muted text-xs mt-1">
                          {property?.address || "Property address not provided"}
                        </p>
                      </div>
                      <Badge
                        tone={tenancy.status === "Active" ? "green" : "blue"}
                      >
                        {tenancy.status}
                      </Badge>
                    </div>
                    <dl className="grid grid-cols-2 gap-3 mt-5 text-xs">
                      <div>
                        <dt className="text-muted">Starts</dt>
                        <dd className="font-medium mt-1">
                          {formatDate(tenancy.startDate)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted">Ends</dt>
                        <dd className="font-medium mt-1">
                          {formatDate(tenancy.endDate)}
                        </dd>
                      </div>
                    </dl>
                    <div className="flex flex-wrap gap-4 mt-5">
                      <Link className="text-link" href="/inventory">
                        View inventory <ArrowRight size={14} />
                      </Link>
                      <Link className="text-link" href="/inspections">
                        Handover records <ArrowRight size={14} />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            !loading && (
              <EmptyState
                icon={Building2}
                title="Your tenancy will appear here"
                description="Your landlord can connect your account by adding a tenancy with your verified email address."
              />
            )
          )}
        </section>
        <div className="space-y-5">
          <section className="card" style={{ height: "auto" }}>
            <div className="section-heading">
              <div>
                <h2>Your next steps</h2>
                <p className="text-muted">
                  A few useful actions for your home.
                </p>
              </div>
            </div>
            {pending.map((inspection) => (
              <Link
                key={inspection.id}
                href="/inspections"
                className="activity-row"
              >
                <span className="rounded-lg bg-[#eef3e9] text-[#789269] p-2 shrink-0">
                  <ClipboardCheck size={19} />
                </span>
                <div className="min-w-0 flex-1">
                  <strong className="block">Review and confirm check-in</strong>
                  <p className="truncate">
                    {propertyName(inspection.propertyId)} ·{" "}
                    {formatDate(inspection.inspectedAt)}
                  </p>
                </div>
                <ArrowRight size={16} className="text-[#97a68b] shrink-0" />
              </Link>
            ))}
            {!pending.length && !loading && (
              <p className="flex gap-2 items-center text-sm text-[#64805d] mb-4">
                <CheckCircle2 size={17} /> No check-ins awaiting confirmation.
              </p>
            )}
            <div className="grid gap-3 mt-4">
              <Link
                className="button secondary justify-between"
                href="/inventory"
              >
                <span className="flex gap-2 items-center">
                  <Package size={17} /> Browse your inventory
                </span>
                <ArrowRight size={15} />
              </Link>
              {active.length > 0 ? (
                <Link className="button primary justify-between" href="/damage">
                  <span className="flex gap-2 items-center">
                    <Wrench size={17} /> Report damage
                  </span>
                  <ArrowRight size={15} />
                </Link>
              ) : (
                <p className="text-muted text-xs">
                  Damage reporting becomes available when your tenancy is
                  active.
                </p>
              )}
            </div>
          </section>
          <section className="card" style={{ height: "auto" }}>
            <div className="section-heading">
              <div>
                <h2>Reported issues</h2>
                <p className="text-muted">Updates from your landlord.</p>
              </div>
              <Link href="/damage" className="text-link">
                View all <ArrowRight size={14} />
              </Link>
            </div>
            {reports.length
              ? reports.slice(0, 3).map((report) => (
                  <Link key={report.id} href="/damage" className="activity-row">
                    <span className="rounded-lg bg-[#fbf1e9] p-2 text-[#b0815d] shrink-0">
                      <Wrench size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate">
                        {report.itemName}
                      </strong>
                      <p className="line-clamp-2">
                        {report.ownerNotes ||
                          "Waiting for your landlord’s update."}
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
                ))
              : !loading && (
                  <p className="text-muted text-sm py-3">
                    You have no open damage reports.
                  </p>
                )}
          </section>
        </div>
      </div>
    </>
  );
}
