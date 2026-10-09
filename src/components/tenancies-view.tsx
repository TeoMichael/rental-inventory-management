"use client";

import { useState, type FormEvent } from "react";
import { CalendarDays, Mail, Phone, Plus, Search, Users } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import {
  Badge,
  Button,
  EmptyState,
  ErrorMessage,
  Field,
  Modal,
  PageHeading,
} from "@/components/ui";
import { formatDate, friendlyError } from "@/lib/format";
import { saveTenancy } from "@/lib/repository";
import {
  TENANCY_STATUSES,
  type Tenancy,
  type TenancyInput,
  type TenancyStatus,
} from "@/lib/types";

const statusTone = (status: TenancyStatus) =>
  status === "Active"
    ? "green"
    : status === "Upcoming"
      ? "blue"
      : status === "Cancelled"
        ? "red"
        : "neutral";

export default function TenanciesView() {
  const { profile, data } = useWorkspace();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [editing, setEditing] = useState<Tenancy | "new" | null>(null);
  const [selected, setSelected] = useState<Tenancy | null>(null);
  const landlord = profile.role === "landlord";
  const ownTenancies = data.tenancies.filter(
    (tenancy) =>
      landlord || tenancy.tenantEmail === profile.email.toLowerCase(),
  );
  const tenancies = ownTenancies
    .filter(
      (tenancy) =>
        (!status || tenancy.status === status) &&
        (!propertyId || tenancy.propertyId === propertyId) &&
        `${tenancy.tenantName} ${tenancy.tenantEmail} ${data.properties.find((property) => property.id === tenancy.propertyId)?.name ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  const active = ownTenancies.filter(
    (tenancy) => tenancy.status === "Active",
  ).length;

  return (
    <>
      <PageHeading
        eyebrow="RENTAL HANDOVERS"
        title={landlord ? "Tenancies" : "My tenancies"}
        description="Keep every tenancy connected to its property and handover history."
        action={
          landlord && (
            <Button
              onClick={() => setEditing("new")}
              disabled={!data.properties.some((property) => !property.archived)}
            >
              <Plus size={17} /> Add tenancy
            </Button>
          )
        }
      />
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <div className="stat-card">
          <span className="text-muted">Active tenancies</span>
          <strong className="block text-3xl mt-2">{active}</strong>
        </div>
        <div className="stat-card">
          <span className="text-muted">Upcoming</span>
          <strong className="block text-3xl mt-2">
            {
              ownTenancies.filter((tenancy) => tenancy.status === "Upcoming")
                .length
            }
          </strong>
        </div>
        <div className="stat-card">
          <span className="text-muted">Completed tenancies</span>
          <strong className="block text-3xl mt-2">
            {
              ownTenancies.filter((tenancy) => tenancy.status === "Completed")
                .length
            }
          </strong>
        </div>
      </div>
      <div className="filter-bar">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-slate-400" size={17} />
          <input
            aria-label="Search tenancies"
            className="input pl-10"
            placeholder="Search tenant or property…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <select
          aria-label="Filter tenancy status"
          className="input sm:max-w-48"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All statuses</option>
          {TENANCY_STATUSES.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select
          aria-label="Filter tenancy property"
          className="input sm:max-w-56"
          value={propertyId}
          onChange={(event) => setPropertyId(event.target.value)}
        >
          <option value="">All properties</option>
          {data.properties.map((property) => (
            <option value={property.id} key={property.id}>
              {property.name}
              {property.archived ? " (archived)" : ""}
            </option>
          ))}
        </select>
      </div>
      {!tenancies.length ? (
        <EmptyState
          icon={Users}
          title={
            ownTenancies.length
              ? "No tenancies match"
              : landlord
                ? "Your next tenancy starts here"
                : "No tenancy assigned yet"
          }
          description={
            ownTenancies.length
              ? "Try another search or status filter."
              : landlord
                ? "Add a tenant to a property to start recording handovers."
                : "Your landlord can connect your account using your email address."
          }
          action={
            landlord &&
            !ownTenancies.length && (
              <Button
                disabled={
                  !data.properties.some((property) => !property.archived)
                }
                onClick={() => setEditing("new")}
              >
                Add tenancy
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {tenancies.map((tenancy) => (
              <article className="card" key={tenancy.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold">{tenancy.tenantName}</h2>
                    <p className="text-muted text-sm mt-1 break-all">
                      {tenancy.tenantEmail}
                    </p>
                  </div>
                  <Badge tone={statusTone(tenancy.status)}>
                    {tenancy.status}
                  </Badge>
                </div>
                <p className="mt-4 text-sm font-medium">
                  {data.properties.find(
                    (property) => property.id === tenancy.propertyId,
                  )?.name ?? "Previous property"}
                </p>
                <p className="text-muted text-sm mt-1">
                  {formatDate(tenancy.startDate)} –{" "}
                  {formatDate(tenancy.endDate)}
                </p>
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="secondary"
                    onClick={() => setSelected(tenancy)}
                  >
                    View tenancy
                  </Button>
                  {landlord && (
                    <Button variant="ghost" onClick={() => setEditing(tenancy)}>
                      Edit
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
          <div className="table-wrap hidden md:block">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Property</th>
                  <th>Tenancy dates</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tenancies.map((tenancy) => (
                  <tr key={tenancy.id}>
                    <td>
                      <strong className="block">{tenancy.tenantName}</strong>
                      <span className="text-muted text-sm">
                        {tenancy.tenantEmail}
                      </span>
                    </td>
                    <td>
                      {data.properties.find(
                        (property) => property.id === tenancy.propertyId,
                      )?.name ?? "Previous property"}
                    </td>
                    <td className="whitespace-nowrap">
                      {formatDate(tenancy.startDate)}
                      <span className="text-muted block text-sm">
                        to {formatDate(tenancy.endDate)}
                      </span>
                    </td>
                    <td>
                      <Badge tone={statusTone(tenancy.status)}>
                        {tenancy.status}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        onClick={() => setSelected(tenancy)}
                      >
                        View
                      </Button>
                      {landlord && (
                        <Button
                          variant="ghost"
                          onClick={() => setEditing(tenancy)}
                        >
                          Edit
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {editing && (
        <TenancyForm
          tenancy={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {selected && (
        <Modal title={selected.tenantName} onClose={() => setSelected(null)}>
          <div className="flex items-center justify-between gap-3 mb-6">
            <span className="text-muted">
              {data.properties.find(
                (property) => property.id === selected.propertyId,
              )?.name ?? "Previous property"}
            </span>
            <Badge tone={statusTone(selected.status)}>{selected.status}</Badge>
          </div>
          <dl className="grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-muted flex gap-2 items-center text-sm">
                <Mail size={15} /> Email
              </dt>
              <dd className="mt-1 break-all">{selected.tenantEmail}</dd>
            </div>
            <div>
              <dt className="text-muted flex gap-2 items-center text-sm">
                <Phone size={15} /> Phone
              </dt>
              <dd className="mt-1">{selected.phone || "Not provided"}</dd>
            </div>
            <div>
              <dt className="text-muted flex gap-2 items-center text-sm">
                <CalendarDays size={15} /> Start date
              </dt>
              <dd className="mt-1">{formatDate(selected.startDate)}</dd>
            </div>
            <div>
              <dt className="text-muted text-sm">End date</dt>
              <dd className="mt-1">{formatDate(selected.endDate)}</dd>
            </div>
          </dl>
          <h3 className="section-heading mt-7 mb-3">Inspection history</h3>
          {data.inspections.filter(
            (inspection) => inspection.tenancyId === selected.id,
          ).length ? (
            <div className="space-y-3">
              {data.inspections
                .filter((inspection) => inspection.tenancyId === selected.id)
                .sort((a, b) => b.inspectedAt.localeCompare(a.inspectedAt))
                .map((inspection) => (
                  <div
                    key={inspection.id}
                    className="flex justify-between gap-3 rounded-xl border border-slate-200 p-3"
                  >
                    <div>
                      <strong className="capitalize">{inspection.type}</strong>
                      <div className="text-muted text-sm">
                        {formatDate(inspection.inspectedAt)} ·{" "}
                        {inspection.itemCount} items
                      </div>
                    </div>
                    <Badge tone={inspection.confirmed ? "green" : "neutral"}>
                      {inspection.confirmed ? "Confirmed" : "Recorded"}
                    </Badge>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-muted">
              No inspections recorded for this tenancy yet.
            </p>
          )}
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Close
            </Button>
            {landlord && (
              <Button
                onClick={() => {
                  setSelected(null);
                  setEditing(selected);
                }}
              >
                Edit tenancy
              </Button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

function TenancyForm({
  tenancy,
  onClose,
}: {
  tenancy?: Tenancy;
  onClose: () => void;
}) {
  const { profile, data, notify } = useWorkspace();
  const [input, setInput] = useState<TenancyInput>(() =>
    tenancy
      ? {
          propertyId: tenancy.propertyId,
          tenantName: tenancy.tenantName,
          tenantEmail: tenancy.tenantEmail,
          phone: tenancy.phone,
          startDate: tenancy.startDate,
          endDate: tenancy.endDate,
          status: tenancy.status,
        }
      : {
          propertyId:
            data.properties.find((property) => !property.archived)?.id ?? "",
          tenantName: "",
          tenantEmail: "",
          phone: "",
          startDate: "",
          endDate: "",
          status: "Upcoming",
        },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof TenancyInput>(key: K, value: TenancyInput[K]) =>
    setInput((previous) => ({ ...previous, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (input.startDate > input.endDate) {
      setError("Start date must be on or before the end date.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveTenancy(profile, input, tenancy?.id);
      notify(tenancy ? "Tenancy updated." : "Tenancy created.");
      onClose();
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={tenancy ? "Edit tenancy" : "Add tenancy"}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={submit}>
        <ErrorMessage message={error} />
        <div className="form-grid">
          <Field label="Tenant name">
            <input
              className="input"
              value={input.tenantName}
              onChange={(event) => set("tenantName", event.target.value)}
              required
              maxLength={120}
              disabled={busy}
              autoComplete="name"
            />
          </Field>
          <Field
            label="Email"
            hint={
              tenancy
                ? "Email is fixed to preserve the tenant’s inspection history."
                : "Use the email the tenant will sign in with."
            }
          >
            <input
              className="input"
              value={input.tenantEmail}
              onChange={(event) => set("tenantEmail", event.target.value)}
              required
              type="email"
              maxLength={254}
              disabled={busy || !!tenancy}
              autoComplete="email"
            />
          </Field>
          <Field label="Phone (optional)">
            <input
              className="input"
              value={input.phone}
              onChange={(event) => set("phone", event.target.value)}
              maxLength={40}
              disabled={busy}
              type="tel"
              autoComplete="tel"
            />
          </Field>
          <Field label="Property">
            <select
              className="input"
              value={input.propertyId}
              onChange={(event) => set("propertyId", event.target.value)}
              required
              disabled={busy || !!tenancy}
            >
              {data.properties
                .filter(
                  (property) =>
                    !property.archived || property.id === input.propertyId,
                )
                .map((property) => (
                  <option value={property.id} key={property.id}>
                    {property.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Start date">
            <input
              className="input"
              type="date"
              value={input.startDate}
              onChange={(event) => set("startDate", event.target.value)}
              required
              disabled={busy}
              max={input.endDate || undefined}
            />
          </Field>
          <Field label="End date">
            <input
              className="input"
              type="date"
              value={input.endDate}
              onChange={(event) => set("endDate", event.target.value)}
              required
              disabled={busy}
              min={input.startDate || undefined}
            />
          </Field>
          <Field label="Status">
            <select
              className="input"
              value={input.status}
              onChange={(event) =>
                set("status", event.target.value as TenancyStatus)
              }
              disabled={busy}
            >
              {TENANCY_STATUSES.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button disabled={busy || !input.propertyId}>
            {busy ? "Saving…" : "Save tenancy"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
