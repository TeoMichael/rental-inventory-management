"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  Building2,
  MapPin,
  Package,
  Plus,
  DoorOpen,
} from "lucide-react";
import type { Property } from "@/lib/types";
import { saveProperty } from "@/lib/repository";
import { friendlyError } from "@/lib/format";
import { useWorkspace } from "./workspace-provider";
import {
  Badge,
  Button,
  EmptyState,
  ErrorMessage,
  Field,
  Modal,
  PageHeading,
} from "./ui";
export function PropertyForm({
  property,
  onClose,
}: {
  property?: Property;
  onClose: () => void;
}) {
  const { profile, notify } = useWorkspace();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await saveProperty(
        profile,
        {
          name: String(form.get("name")),
          address: String(form.get("address")),
          description: String(form.get("description")),
          propertyType: String(form.get("propertyType")),
        },
        property?.id,
      );
      notify(
        property
          ? "Property updated."
          : "Your property is ready. Add a room next.",
      );
      onClose();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={property ? "Edit property" : "Add a property"}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Property name">
            <input
              className="input"
              name="name"
              placeholder="e.g. Maple House"
              defaultValue={property?.name}
              required
              maxLength={100}
            />
          </Field>
          <Field label="Property type">
            <select
              className="input"
              name="propertyType"
              defaultValue={property?.propertyType ?? "Apartment"}
            >
              {["Apartment", "House", "Studio", "Townhouse", "Other"].map(
                (type) => (
                  <option key={type}>{type}</option>
                ),
              )}
            </select>
          </Field>
          <Field label="Address">
            <input
              className="input"
              name="address"
              placeholder="Street, city, postcode"
              defaultValue={property?.address}
              maxLength={300}
            />
          </Field>
          <Field label="Description">
            <textarea
              className="input"
              name="description"
              rows={3}
              placeholder="A few useful details about this property"
              defaultValue={property?.description}
              maxLength={2000}
            />
          </Field>
        </div>
        <ErrorMessage message={error} />
        <div className="form-actions">
          <Button
            variant="secondary"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button disabled={busy}>
            {busy ? "Saving…" : property ? "Save changes" : "Create property"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export default function PropertiesView() {
  const { data, profile, loading } = useWorkspace();
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  if (profile.role !== "landlord")
    return (
      <EmptyState
        title="Landlord workspace"
        description="View your assigned property items in Inventory."
      />
    );
  const properties = data.properties.filter(
    (p) => !p.archived && p.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="YOUR PORTFOLIO"
        title="Properties"
        description="A home for every room, item, and record."
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus size={18} />
            Add property
          </Button>
        }
      />
      <div className="filter-bar">
        <input
          aria-label="Search properties"
          className="input search-input"
          placeholder="Search properties…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="text-muted">
          {properties.length}{" "}
          {properties.length === 1 ? "property" : "properties"}
        </span>
      </div>
      {properties.length ? (
        <div className="property-grid">
          {properties.map((p, index) => {
            const items = data.items.filter(
              (item) => item.propertyId === p.id && !item.archived,
            );
            const active = data.tenancies.some(
              (t) => t.propertyId === p.id && t.status === "Active",
            );
            return (
              <Link
                className="property-card"
                href={`/properties/detail?id=${encodeURIComponent(p.id)}`}
                key={p.id}
              >
                <div className={`property-art art-${index % 4}`}>
                  <div className="building-shape">
                    <div />
                    <div />
                    <div />
                    <div />
                    <div />
                    <div />
                  </div>
                  <Badge tone={active ? "green" : "neutral"}>
                    {active ? "Occupied" : "Available"}
                  </Badge>
                  <span className="property-art-type">{p.propertyType}</span>
                </div>
                <div className="property-card-body">
                  <div className="property-card-title">
                    <h3>{p.name}</h3>
                    <ArrowUpRight size={20} />
                  </div>
                  <p className="address">
                    <MapPin size={14} />
                    {p.address || "No address added"}
                  </p>
                  <div className="property-card-footer">
                    <span>
                      <DoorOpen size={15} />
                      {
                        data.rooms.filter(
                          (r) => r.propertyId === p.id && !r.archived,
                        ).length
                      }{" "}
                      rooms
                    </span>
                    <span>
                      <Package size={15} />
                      {items.reduce((sum, item) => sum + item.quantity, 0)}{" "}
                      items
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        !loading && (
          <EmptyState
            icon={Building2}
            title={
              search
                ? "No matching properties"
                : "Start with your first property"
            }
            description={
              search
                ? "Try another property name."
                : "Add a property, organize its rooms, then record what’s inside."
            }
            action={
              !search && (
                <Button onClick={() => setAdding(true)}>
                  <Plus size={17} />
                  Add property
                </Button>
              )
            }
          />
        )
      )}
      {adding && <PropertyForm onClose={() => setAdding(false)} />}
    </>
  );
}
