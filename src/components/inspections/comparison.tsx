"use client";

import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { Badge, Button, EmptyState, Field, Modal } from "@/components/ui";
import { conditionTone, formatDate } from "@/lib/format";
import type { InspectionItem } from "@/lib/types";
import { PhotoStrip } from "./photo-strip";

export function Comparison({
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
              )?.name ?? "Previous property"}{" "}
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
