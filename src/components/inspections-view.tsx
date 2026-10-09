"use client";

import { useState } from "react";
import { ArrowLeftRight, ClipboardCheck, Plus } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Badge, Button, EmptyState, PageHeading } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { Inspection } from "@/lib/types";
import { InspectionForm } from "./inspections/form";
import { InspectionDetail } from "./inspections/detail";
import { Comparison } from "./inspections/comparison";

export default function InspectionsView() {
  const { profile, data } = useWorkspace();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Inspection | null>(null);
  const [comparing, setComparing] = useState<string | null>(null);
  const [tenancyId, setTenancyId] = useState("");
  const [type, setType] = useState("");
  const landlord = profile.role === "landlord";
  const tenancies = data.tenancies.filter(
    (tenancy) =>
      landlord || tenancy.tenantEmail === profile.email.toLowerCase(),
  );
  const inspections = data.inspections
    .filter(
      (inspection) =>
        (landlord || inspection.tenantEmail === profile.email.toLowerCase()) &&
        (!tenancyId || inspection.tenancyId === tenancyId) &&
        (!type || inspection.type === type),
    )
    .sort((a, b) => b.inspectedAt.localeCompare(a.inspectedAt));
  const canCreate = tenancies.some(
    (tenancy) =>
      tenancy.status !== "Cancelled" &&
      data.properties.some(
        (property) => property.id === tenancy.propertyId && !property.archived,
      ) &&
      data.inspections.filter(
        (inspection) => inspection.tenancyId === tenancy.id,
      ).length < 2,
  );
  return (
    <>
      <PageHeading
        eyebrow="A RECORD YOU CAN RELY ON"
        title="Inspections"
        description="Record each handover, confirm check-in, and compare item conditions over time."
        action={
          landlord && (
            <Button onClick={() => setCreating(true)} disabled={!canCreate}>
              <Plus size={17} /> New inspection
            </Button>
          )
        }
      />
      <div className="card mb-6 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
        <div className="flex gap-3 items-start">
          <ClipboardCheck size={23} className="text-teal-600 mt-1 shrink-0" />
          <div>
            <h2 className="font-semibold">Historical records stay intact</h2>
            <p className="text-muted text-sm mt-1">
              Each inspection keeps its own item names, conditions, notes, and
              photos.
            </p>
          </div>
        </div>
        {tenancies.length > 0 && (
          <Button
            variant="secondary"
            onClick={() => setComparing(tenancyId || tenancies[0].id)}
          >
            <ArrowLeftRight size={16} /> Compare handovers
          </Button>
        )}
      </div>
      <div className="filter-bar">
        <select
          className="input sm:max-w-96"
          aria-label="Filter inspection tenancy"
          value={tenancyId}
          onChange={(event) => setTenancyId(event.target.value)}
        >
          <option value="">All tenancies</option>
          {tenancies.map((tenancy) => (
            <option key={tenancy.id} value={tenancy.id}>
              {tenancy.tenantName} ·{" "}
              {data.properties.find(
                (property) => property.id === tenancy.propertyId,
              )?.name ?? "Previous property"}{" "}
              · {formatDate(tenancy.startDate)}
            </option>
          ))}
        </select>
        <select
          className="input sm:max-w-52"
          aria-label="Filter inspection type"
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          <option value="">Check-in & check-out</option>
          <option value="check-in">Check-in</option>
          <option value="check-out">Check-out</option>
        </select>
      </div>
      {!inspections.length ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No inspections recorded"
          description={
            landlord
              ? "Create a tenancy, then record a check-in inspection from the property inventory."
              : "Your landlord’s handover records will appear here."
          }
          action={
            landlord && (
              <Button onClick={() => setCreating(true)} disabled={!canCreate}>
                Create inspection
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {inspections.map((inspection) => {
            const tenancy = tenancies.find(
              (record) => record.id === inspection.tenancyId,
            );
            return (
              <article className="card flex flex-col" key={inspection.id}>
                <div className="flex justify-between items-start gap-2 mb-5">
                  <span className="rounded-xl bg-teal-50 text-teal-700 p-3">
                    <ClipboardCheck size={22} />
                  </span>
                  <Badge
                    tone={inspection.type === "check-in" ? "blue" : "neutral"}
                  >
                    {inspection.type === "check-in" ? "Check-in" : "Check-out"}
                  </Badge>
                </div>
                <h2 className="font-semibold text-lg">
                  {data.properties.find(
                    (property) => property.id === inspection.propertyId,
                  )?.name ?? "Previous property"}
                </h2>
                <p className="text-muted text-sm mt-1">
                  {tenancy?.tenantName ?? inspection.tenantEmail}
                </p>
                <p className="text-muted text-sm mt-4">
                  {formatDate(inspection.inspectedAt)} · {inspection.itemCount}{" "}
                  recorded items
                </p>
                <div className="mt-3 mb-5">
                  <Badge
                    tone={
                      inspection.confirmed
                        ? "green"
                        : inspection.type === "check-in"
                          ? "amber"
                          : "neutral"
                    }
                  >
                    {inspection.confirmed
                      ? "Tenant confirmed"
                      : inspection.type === "check-in"
                        ? "Awaiting confirmation"
                        : "Recorded"}
                  </Badge>
                </div>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setSelected(inspection)}
                  >
                    View record
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setComparing(inspection.tenancyId)}
                  >
                    Compare
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {creating && <InspectionForm onClose={() => setCreating(false)} />}
      {selected && (
        <InspectionDetail
          inspection={
            data.inspections.find((record) => record.id === selected.id) ??
            selected
          }
          onClose={() => setSelected(null)}
        />
      )}
      {comparing && (
        <Comparison tenancyId={comparing} onClose={() => setComparing(null)} />
      )}
    </>
  );
}
