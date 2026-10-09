"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, type FormEvent } from "react";
import { CircleAlert, Plus, Search } from "lucide-react";
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
import { PhotoPicker } from "@/components/photo-picker";
import { formatDate, friendlyError } from "@/lib/format";
import { createDamageReport, updateDamageReport } from "@/lib/repository";
import {
  DAMAGE_STATUSES,
  type DamageInput,
  type DamageReport,
  type DamageStatus,
} from "@/lib/types";

const statusTone = (status: DamageStatus) =>
  status === "Resolved"
    ? "green"
    : status === "Reported"
      ? "red"
      : status === "Repairing"
        ? "blue"
        : "amber";

export default function DamageView() {
  const { profile, data } = useWorkspace();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<DamageReport | null>(null);
  const landlord = profile.role === "landlord";
  const reports = data.damageReports.filter(
    (report) => landlord || report.tenantEmail === profile.email.toLowerCase(),
  );
  const filtered = reports
    .filter(
      (report) =>
        (!status || report.status === status) &&
        (!propertyId || report.propertyId === propertyId) &&
        `${report.itemName} ${report.description}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const canReport = data.tenancies.some(
    (tenancy) =>
      tenancy.status === "Active" &&
      tenancy.tenantEmail === profile.email.toLowerCase(),
  );
  return (
    <>
      <PageHeading
        eyebrow="CARE FOR YOUR PROPERTY"
        title="Damage reports"
        description={
          landlord
            ? "Track reported issues from the first notification to a completed repair."
            : "Let your landlord know when something needs attention, with photos and a clear description."
        }
        action={
          !landlord && (
            <Button onClick={() => setCreating(true)} disabled={!canReport}>
              <Plus size={17} /> Report damage
            </Button>
          )
        }
      />
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <div className="stat-card">
          <span className="text-muted">Open reports</span>
          <strong className="block text-3xl mt-2">
            {reports.filter((report) => report.status !== "Resolved").length}
          </strong>
        </div>
        <div className="stat-card">
          <span className="text-muted">Being repaired</span>
          <strong className="block text-3xl mt-2">
            {reports.filter((report) => report.status === "Repairing").length}
          </strong>
        </div>
        <div className="stat-card">
          <span className="text-muted">Resolved</span>
          <strong className="block text-3xl mt-2">
            {reports.filter((report) => report.status === "Resolved").length}
          </strong>
        </div>
      </div>
      <div className="filter-bar">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3 top-3 text-slate-400" />
          <input
            className="input pl-10"
            aria-label="Search damage reports"
            placeholder="Search item or issue…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <select
          className="input sm:max-w-48"
          aria-label="Filter damage status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All statuses</option>
          {DAMAGE_STATUSES.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select
          className="input sm:max-w-56"
          aria-label="Filter damage property"
          value={propertyId}
          onChange={(event) => setPropertyId(event.target.value)}
        >
          <option value="">All properties</option>
          {data.properties.map((property) => (
            <option value={property.id} key={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </div>
      {!filtered.length ? (
        <EmptyState
          icon={CircleAlert}
          title={
            reports.length ? "No reports match" : "Everything is looking good"
          }
          description={
            reports.length
              ? "Try another search or status filter."
              : landlord
                ? "Damage reports submitted by your tenants will appear here."
                : canReport
                  ? "Report an issue as soon as you notice it so your landlord can help."
                  : "You can submit a report when you have an active tenancy."
          }
          action={
            !landlord &&
            canReport && (
              <Button onClick={() => setCreating(true)}>Report damage</Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((report) => (
            <article className="card flex flex-col" key={report.id}>
              <div className="flex justify-between items-start gap-3 mb-4">
                <span className="rounded-xl bg-orange-50 text-orange-700 p-3">
                  <CircleAlert size={22} />
                </span>
                <Badge tone={statusTone(report.status)}>{report.status}</Badge>
              </div>
              <h2 className="font-semibold text-lg">{report.itemName}</h2>
              <p className="text-muted text-sm mt-1">
                {data.properties.find(
                  (property) => property.id === report.propertyId,
                )?.name ?? "Previous property"}
              </p>
              <p className="text-sm line-clamp-3 mt-4 whitespace-pre-wrap">
                {report.description}
              </p>
              {report.photos[0] && (
                <img
                  src={report.photos[0].url}
                  alt={`Damage reported on ${report.itemName}`}
                  loading="lazy"
                  className="rounded-xl h-36 object-cover mt-4 w-full"
                />
              )}
              <div className="flex items-center justify-between gap-2 mt-auto pt-5">
                <span className="text-muted text-xs">
                  {formatDate(report.createdAt)}
                </span>
                <Button variant="secondary" onClick={() => setSelected(report)}>
                  {landlord ? "Manage report" : "View report"}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      {creating && <DamageForm onClose={() => setCreating(false)} />}
      {selected && (
        <DamageDetail
          report={
            data.damageReports.find((report) => report.id === selected.id) ??
            selected
          }
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}

function DamageForm({ onClose }: { onClose: () => void }) {
  const { profile, data, notify } = useWorkspace();
  const tenancies = data.tenancies.filter(
    (tenancy) =>
      tenancy.status === "Active" &&
      tenancy.tenantEmail === profile.email.toLowerCase(),
  );
  const first = tenancies[0];
  const [input, setInput] = useState<DamageInput>({
    propertyId: first?.propertyId ?? "",
    tenancyId: first?.id ?? "",
    itemId: "",
    description: "",
    photos: [],
  });
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = busy || uploadBusy;
  const items = data.items.filter(
    (item) => item.propertyId === input.propertyId && !item.archived,
  );
  function changeTenancy(id: string) {
    const tenancy = tenancies.find((record) => record.id === id);
    setInput((previous) => ({
      ...previous,
      tenancyId: id,
      propertyId: tenancy?.propertyId ?? "",
      itemId: "",
      photos: [],
    }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (locked) return;
    if (!input.description.trim()) {
      setError("Describe the issue before submitting your report.");
      return;
    }
    if (!input.itemId || !input.tenancyId) {
      setError("Choose your tenancy and the affected inventory item.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createDamageReport(profile, input);
      notify("Damage report submitted to your landlord.");
      onClose();
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Report damage"
      onClose={() => {
        if (!locked) onClose();
      }}
    >
      <form onSubmit={submit}>
        <p className="text-muted text-sm mb-5">
          Tell your landlord what happened and add photos to help them assess
          the issue.
        </p>
        <ErrorMessage message={error} />
        <div className="space-y-5">
          <Field label="Tenancy">
            <select
              className="input"
              value={input.tenancyId}
              onChange={(event) => changeTenancy(event.target.value)}
              disabled={locked}
              required
            >
              {tenancies.map((tenancy) => (
                <option value={tenancy.id} key={tenancy.id}>
                  {data.properties.find(
                    (property) => property.id === tenancy.propertyId,
                  )?.name ?? "Assigned property"}{" "}
                  · {formatDate(tenancy.startDate)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Affected item">
            <select
              className="input"
              value={input.itemId}
              onChange={(event) =>
                setInput((previous) => ({
                  ...previous,
                  itemId: event.target.value,
                }))
              }
              disabled={busy}
              required
            >
              <option value="">Choose an inventory item</option>
              {items.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name} ·{" "}
                  {data.rooms.find((room) => room.id === item.roomId)?.name ??
                    "Unassigned room"}
                </option>
              ))}
            </select>
          </Field>
          {!items.length && (
            <p className="text-sm text-amber-800 rounded-xl bg-amber-50 p-3">
              Your landlord needs to add inventory to this property before you
              can report an item.
            </p>
          )}
          <Field label="What needs attention?">
            <textarea
              className="input"
              value={input.description}
              onChange={(event) =>
                setInput((previous) => ({
                  ...previous,
                  description: event.target.value,
                }))
              }
              rows={4}
              maxLength={4000}
              required
              disabled={busy}
              placeholder="Describe the damage, where it is, and when you noticed it."
            />
          </Field>
          <div className="field">
            <span>Supporting photos</span>
            <PhotoPicker
              propertyId={input.propertyId}
              photos={input.photos}
              onChange={(photos) =>
                setInput((previous) => ({ ...previous, photos }))
              }
              onBusyChange={setUploadBusy}
              disabled={busy || !input.propertyId}
            />
            <small>Add a close-up and a wider photo when possible.</small>
          </div>
        </div>
        <div className="form-actions">
          <Button
            variant="secondary"
            type="button"
            disabled={locked}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button disabled={locked || !items.length}>
            {busy
              ? "Submitting…"
              : uploadBusy
                ? "Uploading photos…"
                : "Submit report"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DamageDetail({
  report,
  onClose,
}: {
  report: DamageReport;
  onClose: () => void;
}) {
  const { profile, data, notify } = useWorkspace();
  const [status, setStatus] = useState(report.status);
  const [notes, setNotes] = useState(report.ownerNotes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const landlord = profile.role === "landlord";
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateDamageReport(profile, report, status, notes);
      notify("Damage report updated.");
      onClose();
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={report.itemName}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={submit}>
        <div className="flex justify-between gap-3 items-start mb-5">
          <div>
            <p className="text-muted">
              {data.properties.find(
                (property) => property.id === report.propertyId,
              )?.name ?? "Previous property"}
            </p>
            <p className="text-muted text-sm mt-1">
              Reported {formatDate(report.createdAt)}
            </p>
          </div>
          <Badge tone={statusTone(report.status)}>{report.status}</Badge>
        </div>
        <ErrorMessage message={error} />
        <h3 className="section-heading mb-2">Reported issue</h3>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {report.description}
        </p>
        {landlord && (
          <p className="text-muted text-xs mt-3">
            Submitted by{" "}
            {data.tenancies.find((tenancy) => tenancy.id === report.tenancyId)
              ?.tenantName ?? report.tenantEmail}
          </p>
        )}
        {report.photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-5">
            {report.photos.map((photo) => (
              <a
                href={photo.url}
                target="_blank"
                rel="noreferrer"
                key={photo.id}
                aria-label={`Open photo: ${photo.name}`}
              >
                <img
                  src={photo.url}
                  alt={photo.name}
                  className="rounded-xl h-36 object-cover w-full border border-slate-200"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        )}
        {landlord ? (
          <div className="space-y-5 mt-6 pt-5 border-t border-slate-200">
            <Field label="Report status">
              <select
                className="input"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as DamageStatus)
                }
                disabled={busy}
              >
                {DAMAGE_STATUSES.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>
            <Field label="Owner notes" hint="The tenant can see these notes.">
              <textarea
                className="input"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={4000}
                rows={4}
                disabled={busy}
                placeholder="Add an update, inspection result, or repair plan."
              />
            </Field>
          </div>
        ) : (
          <div className="rounded-xl bg-slate-50 p-4 mt-6">
            <h3 className="font-semibold text-sm mb-2">Landlord update</h3>
            <p className="text-sm whitespace-pre-wrap">
              {report.ownerNotes ||
                "Your landlord has not added an update yet."}
            </p>
          </div>
        )}
        <div className="form-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={busy}
          >
            Close
          </Button>
          {landlord && (
            <Button disabled={busy}>{busy ? "Saving…" : "Save update"}</Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
