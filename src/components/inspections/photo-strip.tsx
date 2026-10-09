/* eslint-disable @next/next/no-img-element */
import type { Photo } from "@/lib/types";

export function PhotoStrip({ photos }: { photos: Photo[] }) {
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
