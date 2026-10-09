"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, type FormEvent } from "react";
import {
  ArrowLeftRight,
  CheckCircle2,
  ClipboardCheck,
  Plus,
} from "lucide-react";
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
import { conditionTone, formatDate, friendlyError } from "@/lib/format";
import { confirmInspection, createInspection } from "@/lib/repository";
import {
  CONDITIONS,
  type Inspection,
  type InspectionItem,
  type Photo,
  type SnapshotInput,
  type Tenancy,
} from "@/lib/types";

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
              )?.name ?? "Archived property"}{" "}
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
                  )?.name ?? "Archived property"}
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

function InspectionForm({ onClose }: { onClose: () => void }) {
  const { profile, data, notify } = useWorkspace();
  const tenancies = data.tenancies
    .filter(
      (tenancy) =>
        tenancy.status !== "Cancelled" &&
        data.properties.some(
          (property) =>
            property.id === tenancy.propertyId && !property.archived,
        ) &&
        data.inspections.filter(
          (inspection) => inspection.tenancyId === tenancy.id,
        ).length < 2,
    )
    .sort(
      (a, b) => Number(b.status === "Active") - Number(a.status === "Active"),
    );
  const first = tenancies[0];
  const snapshotsFor = (tenancy?: Tenancy): SnapshotInput[] =>
    tenancy
      ? data.items
          .filter(
            (item) => item.propertyId === tenancy.propertyId && !item.archived,
          )
          .map((item) => ({
            itemId: item.id,
            itemName: item.name,
            roomName:
              data.rooms.find((room) => room.id === item.roomId)?.name ??
              "Unassigned room",
            quantity: item.quantity,
            condition: item.condition,
            notes: "",
            photos: [...item.photos],
          }))
          .sort(
            (a, b) =>
              a.roomName.localeCompare(b.roomName) ||
              a.itemName.localeCompare(b.itemName),
          )
      : [];
  const [tenancyId, setTenancyId] = useState(first?.id ?? "");
  const [type, setType] = useState<Inspection["type"]>(() =>
    data.inspections.some(
      (inspection) =>
        inspection.tenancyId === first?.id && inspection.type === "check-in",
    )
      ? "check-out"
      : "check-in",
  );
  const [snapshots, setSnapshots] = useState<SnapshotInput[]>(() =>
    snapshotsFor(first),
  );
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const tenancy = tenancies.find((record) => record.id === tenancyId);
  const hasCheckIn = data.inspections.some(
    (inspection) =>
      inspection.tenancyId === tenancyId && inspection.type === "check-in",
  );
  const hasCheckOut = data.inspections.some(
    (inspection) =>
      inspection.tenancyId === tenancyId && inspection.type === "check-out",
  );
  const locked = busy || uploading.size > 0;
  function uploadState(itemId: string, uploadingPhoto: boolean) {
    setUploading((previous) => {
      const next = new Set(previous);
      if (uploadingPhoto) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }
  function changeTenancy(id: string) {
    setTenancyId(id);
    setType(
      data.inspections.some(
        (inspection) =>
          inspection.tenancyId === id && inspection.type === "check-in",
      )
        ? "check-out"
        : "check-in",
    );
    setSnapshots(snapshotsFor(tenancies.find((record) => record.id === id)));
    setError(null);
  }
  function update(index: number, patch: Partial<SnapshotInput>) {
    setSnapshots((previous) =>
      previous.map((snapshot, position) =>
        position === index ? { ...snapshot, ...patch } : snapshot,
      ),
    );
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (locked) return;
    if (!tenancy || !snapshots.length) {
      setError("Choose a tenancy with at least one inventory item.");
      return;
    }
    if (type === "check-out" && !hasCheckIn) {
      setError("Record a check-in before creating a check-out inspection.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createInspection(profile, tenancy, type, snapshots);
      notify(
        `${type === "check-in" ? "Check-in" : "Check-out"} inspection recorded.`,
      );
      onClose();
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="New inspection"
      onClose={() => {
        if (!locked) onClose();
      }}
    >
      <form onSubmit={submit}>
        <p className="text-muted text-sm mb-5">
          Review every item before saving. A saved inspection is a permanent
          snapshot.
        </p>
        <ErrorMessage message={error} />
        <div className="form-grid mb-6">
          <Field label="Tenancy">
            <select
              className="input"
              value={tenancyId}
              onChange={(event) => changeTenancy(event.target.value)}
              required
              disabled={locked}
            >
              {tenancies.map((record) => (
                <option key={record.id} value={record.id}>
                  {record.tenantName} ·{" "}
                  {
                    data.properties.find(
                      (property) => property.id === record.propertyId,
                    )?.name
                  }{" "}
                  · {formatDate(record.startDate)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Inspection type">
            <select
              className="input"
              value={type}
              onChange={(event) =>
                setType(event.target.value as Inspection["type"])
              }
              disabled={locked}
            >
              <option value="check-in" disabled={hasCheckIn}>
                Check-in{hasCheckIn ? " (recorded)" : ""}
              </option>
              <option value="check-out" disabled={hasCheckOut || !hasCheckIn}>
                Check-out{hasCheckOut ? " (recorded)" : ""}
              </option>
            </select>
          </Field>
        </div>
        {type === "check-out" && !hasCheckIn && (
          <p className="rounded-xl bg-amber-50 text-amber-800 p-3 text-sm mb-4">
            This tenancy needs a check-in record before check-out.
          </p>
        )}
        <h3 className="section-heading mb-4">
          Review inventory · {snapshots.length} items
        </h3>
        {!snapshots.length && (
          <p className="text-muted py-5">
            Add inventory to this property before recording an inspection.
          </p>
        )}
        <div className="space-y-5">
          {snapshots.map((snapshot, index) => (
            <section
              className="border border-slate-200 rounded-xl p-4"
              key={snapshot.itemId}
            >
              <div className="flex justify-between gap-3 mb-4">
                <div>
                  <h4 className="font-semibold">{snapshot.itemName}</h4>
                  <p className="text-muted text-sm">
                    {snapshot.roomName} · Quantity {snapshot.quantity}
                  </p>
                </div>
                <Badge tone={conditionTone(snapshot.condition)}>
                  {snapshot.condition}
                </Badge>
              </div>
              <div className="grid gap-4">
                <Field label="Recorded condition">
                  <select
                    className="input"
                    value={snapshot.condition}
                    onChange={(event) =>
                      update(index, {
                        condition: event.target
                          .value as SnapshotInput["condition"],
                      })
                    }
                    disabled={busy}
                  >
                    {CONDITIONS.map((condition) => (
                      <option key={condition}>{condition}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Inspection notes">
                  <textarea
                    className="input"
                    rows={2}
                    maxLength={2000}
                    placeholder="Describe marks, wear, or anything the tenant should know."
                    value={snapshot.notes}
                    onChange={(event) =>
                      update(index, { notes: event.target.value })
                    }
                    disabled={busy}
                  />
                </Field>
                <div className="field">
                  <span>Inspection photos</span>
                  <PhotoPicker
                    propertyId={tenancy?.propertyId ?? ""}
                    photos={snapshot.photos}
                    onChange={(photos) => update(index, { photos })}
                    onBusyChange={(uploadingPhoto) =>
                      uploadState(snapshot.itemId, uploadingPhoto)
                    }
                    disabled={busy}
                  />
                </div>
              </div>
            </section>
          ))}
        </div>
        <div className="form-actions sticky bottom-0 bg-white py-4">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={locked}
          >
            Cancel
          </Button>
          <Button
            disabled={
              locked ||
              !snapshots.length ||
              (type === "check-out" && !hasCheckIn)
            }
          >
            {busy
              ? "Recording…"
              : uploading.size
                ? "Uploading photos…"
                : "Save inspection"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function InspectionDetail({
  inspection,
  onClose,
}: {
  inspection: Inspection;
  onClose: () => void;
}) {
  const { profile, data, notify } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const items = data.inspectionItems
    .filter((item) => item.inspectionId === inspection.id)
    .sort(
      (a, b) =>
        a.roomName.localeCompare(b.roomName) ||
        a.itemName.localeCompare(b.itemName),
    );
  const canConfirm =
    profile.role === "tenant" &&
    inspection.tenantEmail === profile.email.toLowerCase() &&
    inspection.type === "check-in" &&
    !inspection.confirmed;
  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await confirmInspection(profile, inspection);
      notify("Check-in confirmed. Your confirmation has been recorded.");
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        inspection.type === "check-in"
          ? "Check-in inspection"
          : "Check-out inspection"
      }
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="flex justify-between flex-wrap gap-3 mb-5">
        <div>
          <strong>
            {data.properties.find(
              (property) => property.id === inspection.propertyId,
            )?.name ?? "Archived property"}
          </strong>
          <p className="text-muted text-sm mt-1">
            Recorded {formatDate(inspection.inspectedAt)} · {items.length} items
          </p>
        </div>
        <Badge tone={inspection.confirmed ? "green" : "neutral"}>
          {inspection.confirmed ? "Tenant confirmed" : "Historical snapshot"}
        </Badge>
      </div>
      <ErrorMessage message={error} />
      <div className="space-y-4">
        {items.map((item) => (
          <article
            key={item.id}
            className="border border-slate-200 rounded-xl p-4"
          >
            <div className="flex justify-between gap-3 mb-3">
              <div>
                <h3 className="font-semibold">{item.itemName}</h3>
                <p className="text-muted text-sm">
                  {item.roomName} · Quantity {item.quantity}
                </p>
              </div>
              <Badge tone={conditionTone(item.condition)}>
                {item.condition}
              </Badge>
            </div>
            <p className="text-sm whitespace-pre-wrap mb-3">
              {item.notes || "No additional notes."}
            </p>
            <PhotoStrip photos={item.photos} />
          </article>
        ))}
      </div>
      {inspection.confirmed && (
        <p className="mt-5 text-sm text-teal-700 flex items-center gap-2">
          <CheckCircle2 size={17} /> Tenant confirmed on{" "}
          {formatDate(inspection.confirmedAt)}
        </p>
      )}
      {canConfirm && (
        <div className="rounded-xl bg-teal-50 p-4 mt-5">
          <h3 className="font-semibold text-teal-900">
            Review your check-in record
          </h3>
          <p className="text-sm text-teal-800 mt-1">
            Confirm after reviewing the recorded conditions and photos. Contact
            your landlord about any differences before confirming.
          </p>
        </div>
      )}
      <div className="form-actions">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Close
        </Button>
        {canConfirm && (
          <Button onClick={confirm} disabled={busy}>
            {busy ? "Confirming…" : "Confirm check-in"}
          </Button>
        )}
      </div>
    </Modal>
  );
}

function Comparison({
  tenancyId: initialTenancyId,
  onClose,
}: {
  tenancyId: string;
  onClose: () => void;
}) {
  const { profile, data } = useWorkspace();
  const [tenancyId, setTenancyId] = useState(initialTenancyId);
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [chosenIn, setChosenIn] = useState("");
  const [chosenOut, setChosenOut] = useState("");
  const tenancies = data.tenancies.filter(
    (tenancy) =>
      profile.role === "landlord" ||
      tenancy.tenantEmail === profile.email.toLowerCase(),
  );
  const inspections = data.inspections
    .filter((inspection) => inspection.tenancyId === tenancyId)
    .sort((a, b) => b.inspectedAt.localeCompare(a.inspectedAt));
  const checkIns = inspections.filter(
    (inspection) => inspection.type === "check-in",
  );
  const checkOuts = inspections.filter(
    (inspection) => inspection.type === "check-out",
  );
  const checkIn =
    checkIns.find((inspection) => inspection.id === chosenIn) ?? checkIns[0];
  const checkOut =
    checkOuts.find((inspection) => inspection.id === chosenOut) ?? checkOuts[0];
  const before = data.inspectionItems.filter(
    (item) => item.inspectionId === checkIn?.id,
  );
  const after = data.inspectionItems.filter(
    (item) => item.inspectionId === checkOut?.id,
  );
  const ids = Array.from(
    new Set([
      ...before.map((item) => item.itemId),
      ...after.map((item) => item.itemId),
    ]),
  );
  const pairs = ids
    .map((id) => ({
      id,
      left: before.find((item) => item.itemId === id),
      right: after.find((item) => item.itemId === id),
    }))
    .map((pair) => ({
      ...pair,
      changed:
        !pair.left ||
        !pair.right ||
        pair.left.condition !== pair.right.condition ||
        pair.left.quantity !== pair.right.quantity,
    }));
  return (
    <Modal title="Compare handovers" onClose={onClose}>
      <Field label="Tenancy">
        <select
          className="input"
          value={tenancyId}
          onChange={(event) => {
            setTenancyId(event.target.value);
            setChosenIn("");
            setChosenOut("");
          }}
        >
          {tenancies.map((tenancy) => (
            <option key={tenancy.id} value={tenancy.id}>
              {tenancy.tenantName} ·{" "}
              {data.properties.find(
                (property) => property.id === tenancy.propertyId,
              )?.name ?? "Archived property"}{" "}
              · {formatDate(tenancy.startDate)}
            </option>
          ))}
        </select>
      </Field>
      {!checkIn || !checkOut ? (
        <div className="py-8">
          <EmptyState
            icon={ArrowLeftRight}
            title="Both handovers are needed"
            description="Record a check-in and a check-out for this tenancy to compare conditions and photos."
          />
        </div>
      ) : (
        <>
          <div className="form-grid mt-4">
            <Field label="Check-in record">
              <select
                className="input"
                value={checkIn.id}
                onChange={(event) => setChosenIn(event.target.value)}
              >
                {checkIns.map((inspection) => (
                  <option value={inspection.id} key={inspection.id}>
                    {formatDate(inspection.inspectedAt)} ·{" "}
                    {inspection.itemCount} items · {inspection.id.slice(-6)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Check-out record">
              <select
                className="input"
                value={checkOut.id}
                onChange={(event) => setChosenOut(event.target.value)}
              >
                {checkOuts.map((inspection) => (
                  <option value={inspection.id} key={inspection.id}>
                    {formatDate(inspection.inspectedAt)} ·{" "}
                    {inspection.itemCount} items · {inspection.id.slice(-6)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-3 justify-between items-center my-5">
            <Badge
              tone={pairs.some((pair) => pair.changed) ? "amber" : "green"}
            >
              {pairs.filter((pair) => pair.changed).length} of {pairs.length}{" "}
              items changed
            </Badge>
            <label className="flex gap-2 items-center text-sm">
              <input
                type="checkbox"
                checked={onlyChanged}
                onChange={(event) => setOnlyChanged(event.target.checked)}
              />{" "}
              Show changes only
            </label>
          </div>
          <div className="space-y-5">
            {pairs
              .filter((pair) => !onlyChanged || pair.changed)
              .map((pair) => (
                <article
                  key={pair.id}
                  className={`rounded-xl border p-4 ${pair.changed ? "border-amber-300 bg-amber-50/40" : "border-slate-200"}`}
                >
                  <div className="flex justify-between gap-3 mb-4">
                    <div>
                      <h3 className="font-semibold">
                        {pair.left?.itemName ?? pair.right?.itemName}
                      </h3>
                      <p className="text-muted text-sm">
                        {pair.left?.roomName ?? pair.right?.roomName}
                      </p>
                    </div>
                    {pair.changed && <Badge tone="amber">Changed</Badge>}
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <ComparisonSide title="Check-in" item={pair.left} />
                    <ComparisonSide title="Check-out" item={pair.right} />
                  </div>
                </article>
              ))}
          </div>
          {onlyChanged && !pairs.some((pair) => pair.changed) && (
            <p className="text-muted text-center py-8">
              All recorded conditions and quantities match.
            </p>
          )}
        </>
      )}
      <div className="form-actions">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}

function ComparisonSide({
  title,
  item,
}: {
  title: string;
  item?: InspectionItem;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
        {title}
      </p>
      {item ? (
        <>
          <div className="flex gap-2 items-center mb-3">
            <Badge tone={conditionTone(item.condition)}>{item.condition}</Badge>
            <span className="text-muted text-sm">Qty {item.quantity}</span>
          </div>
          <PhotoStrip photos={item.photos} />
          <p className="text-sm whitespace-pre-wrap mt-3">
            {item.notes || "No additional notes."}
          </p>
        </>
      ) : (
        <p className="text-muted text-sm">
          Item not recorded in this inspection.
        </p>
      )}
    </div>
  );
}

function PhotoStrip({ photos }: { photos: Photo[] }) {
  if (!photos.length)
    return <p className="text-muted text-xs">No photos recorded</p>;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {photos.map((photo) => (
        <a
          key={photo.id}
          href={photo.url}
          target="_blank"
          rel="noreferrer"
          className="shrink-0"
          aria-label={`Open photo: ${photo.name}`}
        >
          <img
            src={photo.url}
            alt={photo.name}
            className="h-24 w-28 object-cover rounded-lg border border-slate-200"
            loading="lazy"
          />
        </a>
      ))}
    </div>
  );
}
