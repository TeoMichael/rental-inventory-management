"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Archive,
  DoorOpen,
  MapPin,
  Pencil,
  Plus,
} from "lucide-react";
import type { Room } from "@/lib/types";
import { archiveProperty, archiveRoom, saveRoom } from "@/lib/repository";
import { friendlyError } from "@/lib/format";
import { useWorkspace } from "./workspace-provider";
import {
  Button,
  EmptyState,
  ErrorMessage,
  Field,
  Modal,
  PageHeading,
} from "./ui";
import { PropertyForm } from "./properties-view";
import InventoryView from "./inventory-view";
export default function PropertyDetail({ id }: { id: string }) {
  const { data, profile, loading, notify } = useWorkspace();
  const router = useRouter();
  const [editingProperty, setEditingProperty] = useState(false);
  const [roomForm, setRoomForm] = useState<Room | "new" | null>(null);
  const [remove, setRemove] = useState<Room | "property" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const property = data.properties.find((p) => p.id === id && !p.archived);
  if (profile.role !== "landlord")
    return (
      <EmptyState
        title="Access restricted"
        description="Your assigned inventory is available in the Inventory section."
      />
    );
  if (!property)
    return loading ? (
      <p role="status">Loading property…</p>
    ) : (
      <EmptyState
        title="Property unavailable"
        description="It may have been archived, or you do not have access."
        action={
          <Link className="button secondary" href="/properties">
            Back to properties
          </Link>
        }
      />
    );
  const rooms = data.rooms.filter((r) => r.propertyId === id && !r.archived);
  async function submitRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await saveRoom(
        profile,
        {
          propertyId: id,
          name: String(form.get("name")),
          description: String(form.get("description")),
        },
        roomForm && roomForm !== "new" ? roomForm.id : undefined,
      );
      notify("Room saved.");
      setRoomForm(null);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }
  async function deleteRecord() {
    if (!property || !remove) return;
    setBusy(true);
    setError("");
    try {
      if (remove === "property") {
        await archiveProperty(profile, property);
        router.push("/properties");
        notify("Property archived. Historical records are retained.");
      } else {
        await archiveRoom(profile, remove);
        notify("Room removed.");
      }
      setRemove(null);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link href="/properties" className="back-link">
        <ArrowLeft size={16} />
        All properties
      </Link>
      <PageHeading
        eyebrow={property.propertyType.toUpperCase()}
        title={property.name}
        description={
          property.description ||
          "Manage the rooms and inventory in this property."
        }
        action={
          <div className="heading-actions">
            <Button
              variant="secondary"
              onClick={() => setEditingProperty(true)}
            >
              <Pencil size={16} />
              Edit property
            </Button>
            <Button
              variant="ghost"
              aria-label="Delete property"
              onClick={() => {
                setRemove("property");
                setError("");
              }}
            >
              <Archive size={18} />
            </Button>
          </div>
        }
      />
      <div className="property-address">
        <MapPin size={17} />
        {property.address || "Add an address in property settings"}
      </div>
      <section className="rooms-section">
        <div className="section-heading">
          <div>
            <h2>Rooms</h2>
            <p className="text-muted">Give every item a place.</p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setRoomForm("new");
              setError("");
            }}
          >
            <Plus size={17} />
            Add room
          </Button>
        </div>
        {rooms.length ? (
          <div className="room-grid">
            {rooms.map((r) => (
              <div className="room-card" key={r.id}>
                <div className="room-icon">
                  <DoorOpen size={22} />
                </div>
                <div>
                  <h3>{r.name}</h3>
                  <p>
                    {
                      data.items.filter(
                        (item) => item.roomId === r.id && !item.archived,
                      ).length
                    }{" "}
                    inventory records
                  </p>
                  {r.description && <small>{r.description}</small>}
                </div>
                <div className="room-actions">
                  <Button
                    variant="ghost"
                    aria-label={`Edit ${r.name}`}
                    onClick={() => {
                      setRoomForm(r);
                      setError("");
                    }}
                  >
                    <Pencil size={15} />
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label={`Delete ${r.name}`}
                    onClick={() => {
                      setRemove(r);
                      setError("");
                    }}
                  >
                    <Archive size={15} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card">
            <EmptyState
              icon={DoorOpen}
              title="Start room by room"
              description="Add a living room, bedroom, kitchen, or any space you want to document."
            />
          </div>
        )}
      </section>
      <InventoryView compact propertyId={id} />
      {editingProperty && (
        <PropertyForm
          property={property}
          onClose={() => setEditingProperty(false)}
        />
      )}
      {roomForm && (
        <Modal
          title={roomForm === "new" ? "Add room" : "Edit room"}
          onClose={() => {
            if (!busy) setRoomForm(null);
          }}
        >
          <form onSubmit={submitRoom}>
            <div className="form-grid">
              <Field label="Room name">
                <input
                  className="input"
                  name="name"
                  placeholder="e.g. Living room"
                  defaultValue={roomForm === "new" ? "" : roomForm.name}
                  maxLength={100}
                  required
                />
              </Field>
              <Field label="Description">
                <textarea
                  className="input"
                  name="description"
                  defaultValue={roomForm === "new" ? "" : roomForm.description}
                  rows={3}
                  maxLength={2000}
                />
              </Field>
            </div>
            <ErrorMessage message={error} />
            <div className="form-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setRoomForm(null)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button disabled={busy}>{busy ? "Saving…" : "Save room"}</Button>
            </div>
          </form>
        </Modal>
      )}
      {remove && (
        <Modal
          title={
            remove === "property"
              ? "Remove this property?"
              : "Remove this room?"
          }
          onClose={() => {
            if (!busy) setRemove(null);
          }}
        >
          <p>
            {remove === "property"
              ? "This property and its live inventory will be hidden. Finish or cancel any active tenancies first. Inspection history is retained."
              : "Remove the room’s live items first. This room will be archived and past records will remain available."}
          </p>
          <ErrorMessage message={error} />
          <div className="form-actions">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => setRemove(null)}
            >
              Cancel
            </Button>
            <Button variant="danger" disabled={busy} onClick={deleteRecord}>
              {busy ? "Removing…" : "Confirm removal"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
