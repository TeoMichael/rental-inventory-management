"use client";

import { useState, type FormEvent } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { Badge, Button, ErrorMessage, Field, Modal } from "@/components/ui";
import { PhotoPicker } from "@/components/photo-picker";
import { conditionTone, formatDate, friendlyError } from "@/lib/format";
import { createInspection } from "@/lib/repository";
import {
  CONDITIONS,
  type Inspection,
  type SnapshotInput,
  type Tenancy,
} from "@/lib/types";

export function InspectionForm({ onClose }: { onClose: () => void }) {
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
