"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import type { Photo } from "@/lib/types";
import { uploadPhotos } from "@/lib/repository";
import { friendlyError } from "@/lib/format";
import { useWorkspace } from "./workspace-provider";
import { ErrorMessage } from "./ui";
export function PhotoPicker({
  photos,
  onChange,
  propertyId,
  disabled = false,
  onBusyChange,
}: {
  photos: Photo[];
  onChange: (photos: Photo[]) => void;
  propertyId: string;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { profile } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    setBusy(true);
    onBusyChange?.(true);
    try {
      if (photos.length + files.length > 10)
        throw new Error("Use up to 10 photos per record.");
      const next = await uploadPhotos(profile, propertyId, Array.from(files));
      onChange([...photos, ...next]);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <div className="photo-picker">
      <div className="photo-grid">
        {photos.map((photo) => (
          <div className="photo-tile" key={photo.id}>
            <a href={photo.url} target="_blank" rel="noreferrer">
              <img src={photo.url} alt={photo.name} />
            </a>
            {!disabled && (
              <button
                type="button"
                aria-label={`Remove ${photo.name}`}
                disabled={busy}
                onClick={() =>
                  onChange(photos.filter((entry) => entry.id !== photo.id))
                }
              >
                <X size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
      {!disabled && (
        <div className="photo-actions">
          <label
            className={`button secondary ${busy || !propertyId ? "disabled" : ""}`}
          >
            <ImagePlus size={17} />
            {busy ? "Uploading…" : "Add photos"}
            <input
              type="file"
              className="sr-only"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={busy || !propertyId}
              onChange={(e) => {
                void upload(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <label
            className={`button secondary ${busy || !propertyId ? "disabled" : ""}`}
          >
            <Camera size={17} />
            Take photo
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              disabled={busy || !propertyId}
              onChange={(e) => {
                void upload(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <small className="text-muted">
            JPG, PNG or WebP · up to 8 MB each
          </small>
        </div>
      )}
      <ErrorMessage message={error} />
      {photos.length > 0 && !disabled && (
        <small className="text-muted">
          Removing a photo detaches it here. Saved inspection evidence is
          retained.
        </small>
      )}
    </div>
  );
}
