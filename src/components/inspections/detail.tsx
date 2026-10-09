"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Badge, Button, ErrorMessage, Modal } from "@/components/ui";
import { conditionTone, formatDate, friendlyError } from "@/lib/format";
import { confirmInspection } from "@/lib/repository";
import type { Inspection } from "@/lib/types";
import { PhotoStrip } from "./photo-strip";

export function InspectionDetail({
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
            )?.name ?? "Previous property"}
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
