"use client";
/* eslint-disable @next/next/no-img-element */
import { useState, type FormEvent } from "react";
import { Archive, Package, Pencil, Plus, Search } from "lucide-react";
import {
  CATEGORIES,
  CONDITIONS,
  type Item,
  type ItemInput,
  type Photo,
} from "@/lib/types";
import { archiveItem, saveItem } from "@/lib/repository";
import { conditionTone, formatDate, friendlyError } from "@/lib/format";
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
import { PhotoPicker } from "./photo-picker";
function ItemForm({
  item,
  propertyId,
  onClose,
}: {
  item?: Item;
  propertyId?: string;
  onClose: () => void;
}) {
  const { data, profile, notify } = useWorkspace();
  const [selectedProperty, setSelectedProperty] = useState(
    item?.propertyId ?? propertyId ?? "",
  );
  const [uploadBusy, setUploadBusy] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>(item?.photos ?? []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const rooms = data.rooms.filter(
    (r) => r.propertyId === selectedProperty && !r.archived,
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploadBusy) return;
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const input: ItemInput = {
        name: String(form.get("name")),
        propertyId: selectedProperty,
        roomId: String(form.get("roomId")),
        category: form.get("category") as ItemInput["category"],
        quantity: Number(form.get("quantity")),
        condition: form.get("condition") as ItemInput["condition"],
        description: String(form.get("description")),
        estimatedValue: form.get("estimatedValue")
          ? Number(form.get("estimatedValue"))
          : null,
        photos,
      };
      await saveItem(profile, input, item?.id);
      notify(
        item
          ? "Item updated. Past inspections are unchanged."
          : "Item added to your inventory.",
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
      title={item ? "Edit inventory item" : "Add an inventory item"}
      onClose={() => {
        if (!busy && !uploadBusy) onClose();
      }}
    >
      <form onSubmit={submit}>
        <div className="form-grid two-columns">
          <Field label="Item name">
            <input
              name="name"
              className="input"
              placeholder="e.g. Three-seat sofa"
              defaultValue={item?.name}
              required
              maxLength={100}
            />
          </Field>
          <Field label="Category">
            <select
              className="input"
              name="category"
              defaultValue={item?.category ?? "Furniture"}
            >
              {CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </Field>
          <Field label="Property">
            <select
              className="input"
              required
              disabled={!!item || uploadBusy}
              value={selectedProperty}
              onChange={(e) => {
                if (photos.length) {
                  setError(
                    "Remove the pending photos before changing property.",
                  );
                  return;
                }
                setSelectedProperty(e.target.value);
              }}
            >
              <option value="">Select property</option>
              {data.properties
                .filter((p) => !p.archived)
                .map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Room">
            <select
              className="input"
              name="roomId"
              key={selectedProperty}
              defaultValue={item?.roomId ?? ""}
              required
            >
              <option value="">Select room</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
            {selectedProperty && !rooms.length && (
              <small>Add a room in this property first.</small>
            )}
          </Field>
          <Field label="Quantity">
            <input
              className="input"
              type="number"
              name="quantity"
              defaultValue={item?.quantity ?? 1}
              min={1}
              max={10000}
              step={1}
              required
            />
          </Field>
          <Field label="Condition">
            <select
              name="condition"
              className="input"
              defaultValue={item?.condition ?? "Good"}
            >
              {CONDITIONS.map((condition) => (
                <option key={condition}>{condition}</option>
              ))}
            </select>
          </Field>
          <Field
            label="Estimated value (optional)"
            hint="Use one currency consistently across your workspace."
          >
            <input
              className="input"
              type="number"
              name="estimatedValue"
              min={0}
              step="0.01"
              defaultValue={item?.estimatedValue ?? ""}
              placeholder="0.00"
            />
          </Field>
          <Field label="Description / condition notes">
            <textarea
              className="input"
              name="description"
              rows={3}
              maxLength={2000}
              defaultValue={item?.description}
              placeholder="Brand, model, or details worth recording"
            />
          </Field>
        </div>
        <div className="form-section">
          <h3>Item photos</h3>
          <p className="text-muted">Capture the item and any existing wear.</p>
          <PhotoPicker
            photos={photos}
            onChange={setPhotos}
            onBusyChange={setUploadBusy}
            propertyId={selectedProperty}
            disabled={busy || uploadBusy}
          />
        </div>
        <ErrorMessage message={error} />
        <div className="form-actions">
          <Button
            variant="secondary"
            type="button"
            onClick={onClose}
            disabled={busy || uploadBusy}
          >
            Cancel
          </Button>
          <Button disabled={busy || uploadBusy || !rooms.length}>
            {busy ? "Saving…" : item ? "Save changes" : "Add item"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export default function InventoryView({
  propertyId,
  compact = false,
}: {
  propertyId?: string;
  compact?: boolean;
}) {
  const { data, profile, notify, loading } = useWorkspace();
  const [search, setSearch] = useState("");
  const [room, setRoom] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [detail, setDetail] = useState<Item | null>(null);
  const [removing, setRemoving] = useState<Item | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const landlord = profile.role === "landlord";
  const activeProperty = propertyId ?? propertyFilter;
  const items = data.items.filter(
    (item) =>
      !item.archived &&
      data.properties.some((p) => p.id === item.propertyId && !p.archived) &&
      (!activeProperty || item.propertyId === activeProperty) &&
      (!room || item.roomId === room) &&
      (!category || item.category === category) &&
      (!condition || item.condition === condition) &&
      item.name.toLowerCase().includes(search.toLowerCase()),
  );
  const currentDetail = detail
    ? (data.items.find((item) => item.id === detail.id) ?? detail)
    : null;
  async function remove() {
    if (!removing) return;
    setBusy(true);
    setError("");
    try {
      await archiveItem(profile, removing);
      notify(
        "Item removed from live inventory. Inspection history is preserved.",
      );
      setRemoving(null);
      setDetail(null);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }
  const add = landlord && (
    <Button onClick={() => setEditing("new")}>
      <Plus size={17} />
      Add item
    </Button>
  );
  return (
    <>
      {compact ? (
        <div className="section-heading">
          <div>
            <h2>Property inventory</h2>
            <p className="text-muted">
              Every item, with its current condition.
            </p>
          </div>
          {add}
        </div>
      ) : (
        <PageHeading
          eyebrow={landlord ? "KNOW WHAT’S INSIDE" : "YOUR HOME, DOCUMENTED"}
          title="Inventory"
          description={
            landlord
              ? "A clear record of everything your properties provide."
              : "Browse the items in your assigned property. Past conditions are in Inspections."
          }
          action={add}
        />
      )}
      <div className="filter-bar inventory-filters">
        <div className="search-field">
          <Search size={16} />
          <input
            className="input"
            placeholder="Search items…"
            aria-label="Search items"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {!propertyId && (
          <select
            className="input"
            aria-label="Filter by property"
            value={propertyFilter}
            onChange={(e) => {
              setPropertyFilter(e.target.value);
              setRoom("");
            }}
          >
            <option value="">All properties</option>
            {data.properties
              .filter((p) => !p.archived)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        )}
        <select
          className="input"
          aria-label="Filter by room"
          value={room}
          onChange={(e) => setRoom(e.target.value)}
        >
          <option value="">All rooms</option>
          {data.rooms
            .filter(
              (r) =>
                !r.archived &&
                (!activeProperty || r.propertyId === activeProperty),
            )
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
        </select>
        <select
          className="input"
          aria-label="Filter by category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          className="input"
          aria-label="Filter by condition"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
        >
          <option value="">All conditions</option>
          {CONDITIONS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="card inventory-card">
        <div className="table-summary">
          <span>
            <strong>{items.length}</strong> inventory records ·{" "}
            {items.reduce((sum, item) => sum + item.quantity, 0)} individual
            items
          </span>
          <span className="text-muted">Current condition</span>
        </div>
        {items.length ? (
          <div className="table-wrap">
            <table className="data-table inventory-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Property / room</th>
                  <th>Category</th>
                  <th>Qty</th>
                  <th>Condition</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <button
                        className="item-cell"
                        onClick={() => setDetail(item)}
                      >
                        <span className="item-thumbnail">
                          {item.photos[0] ? (
                            <img src={item.photos[0].url} alt="" />
                          ) : (
                            <Package size={23} />
                          )}
                        </span>
                        <span>
                          <strong>{item.name}</strong>
                          <small>
                            {item.photos.length
                              ? `${item.photos.length} photo${item.photos.length > 1 ? "s" : ""}`
                              : "No photos yet"}
                          </small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <span>
                        {data.properties.find((p) => p.id === item.propertyId)
                          ?.name ?? "Archived property"}
                      </span>
                      <small>
                        {data.rooms.find((r) => r.id === item.roomId)?.name ??
                          "Archived room"}
                      </small>
                    </td>
                    <td>
                      <span className="text-muted">{item.category}</span>
                    </td>
                    <td>{item.quantity}</td>
                    <td>
                      <Badge tone={conditionTone(item.condition)}>
                        {item.condition}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        aria-label={
                          landlord ? `Edit ${item.name}` : `View ${item.name}`
                        }
                        onClick={() =>
                          landlord ? setEditing(item) : setDetail(item)
                        }
                      >
                        {landlord ? <Pencil size={16} /> : "View"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !loading && (
            <EmptyState
              icon={Package}
              title={
                search || room || category || condition
                  ? "No items match your filters"
                  : "A clear record starts here"
              }
              description={
                landlord
                  ? "Add rooms to a property, then record its furniture, appliances, and household items."
                  : "Your landlord’s inventory will appear here when your tenancy is linked."
              }
              action={
                landlord && (
                  <Button onClick={() => setEditing("new")}>
                    <Plus size={17} />
                    Add item
                  </Button>
                )
              }
            />
          )
        )}
      </div>
      {editing && (
        <ItemForm
          item={editing === "new" ? undefined : editing}
          propertyId={propertyId}
          onClose={() => setEditing(null)}
        />
      )}
      {currentDetail && (
        <Modal title={currentDetail.name} onClose={() => setDetail(null)}>
          <div className="detail-meta">
            <Badge tone={conditionTone(currentDetail.condition)}>
              {currentDetail.condition}
            </Badge>
            <Badge>{currentDetail.category}</Badge>
            <span>Quantity: {currentDetail.quantity}</span>
          </div>
          <p>{currentDetail.description || "No description recorded."}</p>
          <dl className="detail-list">
            <dt>Room</dt>
            <dd>
              {data.rooms.find((r) => r.id === currentDetail.roomId)?.name ??
                "Archived room"}
            </dd>
            <dt>Estimated value</dt>
            <dd>
              {currentDetail.estimatedValue?.toLocaleString() ?? "Not recorded"}
            </dd>
            <dt>Last updated</dt>
            <dd>{formatDate(currentDetail.updatedAt)}</dd>
          </dl>
          <PhotoPicker
            photos={currentDetail.photos}
            onChange={() => {}}
            propertyId={currentDetail.propertyId}
            disabled
          />
          {landlord && (
            <div className="form-actions">
              <Button
                variant="danger"
                onClick={() => {
                  setRemoving(currentDetail);
                  setError("");
                }}
              >
                <Archive size={16} />
                Delete item
              </Button>
              <Button
                onClick={() => {
                  setEditing(currentDetail);
                  setDetail(null);
                }}
              >
                <Pencil size={16} />
                Edit item
              </Button>
            </div>
          )}
        </Modal>
      )}
      {removing && (
        <Modal
          title="Remove this item?"
          onClose={() => {
            if (!busy) setRemoving(null);
          }}
        >
          <p>
            <strong>{removing.name}</strong> will be archived and removed from
            the live inventory. Its existing inspection snapshots and photos
            will be retained.
          </p>
          <ErrorMessage message={error} />
          <div className="form-actions">
            <Button
              variant="secondary"
              onClick={() => setRemoving(null)}
              disabled={busy}
            >
              Keep item
            </Button>
            <Button variant="danger" disabled={busy} onClick={remove}>
              {busy ? "Removing…" : "Delete item"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
