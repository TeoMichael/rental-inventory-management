import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { Activity } from "./activity";

export function Stat({
  title,
  value,
  detail,
  icon: Icon,
  loading,
  href,
}: {
  title: string;
  value: number;
  detail: string;
  icon: LucideIcon;
  loading: boolean;
  href?: string;
}) {
  const content = (
    <>
      <span>
        {title}
        <Icon size={19} aria-hidden="true" />
      </span>
      <strong>{loading ? "—" : value}</strong>
      <small>{detail}</small>
    </>
  );
  return href ? (
    <Link
      className="stat-card hover:border-[#afc8a9] transition-colors"
      href={href}
      aria-busy={loading}
    >
      {content}
    </Link>
  ) : (
    <div className="stat-card" aria-busy={loading}>
      {content}
    </div>
  );
}

export function ActivityList({
  entries,
  loading,
}: {
  entries: Activity[];
  loading: boolean;
}) {
  if (loading)
    return <p className="text-muted text-sm py-5">Loading recent activity…</p>;
  if (!entries.length)
    return (
      <p className="text-muted text-sm py-5">
        Your saved properties, inventory, and handovers will appear here as you
        build your workspace.
      </p>
    );
  return (
    <div>
      {entries.map(({ id, date, title, detail, href, icon: Icon }) => (
        <Link href={href} className="activity-row" key={id}>
          <span className="rounded-lg bg-[#f1f5ed] p-2 text-[#8b9d7c] shrink-0">
            <Icon size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <strong className="block truncate">{title}</strong>
            <p className="truncate">{detail}</p>
          </div>
          <small>{formatDate(date)}</small>
        </Link>
      ))}
    </div>
  );
}
