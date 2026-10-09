"use client";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  Package,
  Plus,
} from "lucide-react";
import { useWorkspace } from "./workspace-provider";
import { EmptyState, PageHeading } from "./ui";
export default function DashboardView() {
  const { data, profile, loading } = useWorkspace();
  const properties = data.properties.filter((p) => !p.archived);
  const items = data.items.filter(
    (item) =>
      !item.archived && properties.some((p) => p.id === item.propertyId),
  );
  return (
    <>
      <PageHeading
        eyebrow="YOUR WORKSPACE AT A GLANCE"
        title={`Hello, ${profile.name.split(" ")[0]}.`}
        description="A little clarity for the places you look after."
        action={
          <Link
            className="button primary"
            href={profile.role === "landlord" ? "/properties" : "/inventory"}
          >
            <Plus size={17} />
            {profile.role === "landlord"
              ? "Manage properties"
              : "View inventory"}
          </Link>
        }
      />
      <div className="dashboard-banner">
        <div>
          <span className="banner-tag">EVERY DETAIL, IN ITS PLACE</span>
          <h2>
            Good handovers start
            <br />
            with a clear record.
          </h2>
          <p>Document your inventory. Preserve your peace of mind.</p>
          <Link href="/inventory">
            Explore inventory <ArrowRight size={17} />
          </Link>
        </div>
        <div className="banner-house">
          <Building2 size={110} strokeWidth={0.8} />
        </div>
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <span>
            Properties <Building2 size={19} />
          </span>
          <strong>{properties.length}</strong>
          <small>Spaces in your workspace</small>
        </div>
        <div className="stat-card">
          <span>
            Inventory items <Package size={19} />
          </span>
          <strong>{items.reduce((sum, item) => sum + item.quantity, 0)}</strong>
          <small>Across {items.length} inventory records</small>
        </div>
        <div className="stat-card">
          <span>
            Inspections <ClipboardCheck size={19} />
          </span>
          <strong>{data.inspections.length}</strong>
          <small>Preserved handover records</small>
        </div>
      </div>
      <div className="section-heading">
        <h2>Your properties</h2>
        <Link
          href={profile.role === "landlord" ? "/properties" : "/inventory"}
          className="text-link"
        >
          View all <ArrowRight size={16} />
        </Link>
      </div>
      <div className="card">
        {properties.length ? (
          <div className="dashboard-property-list">
            {properties.map((p) => (
              <Link
                key={p.id}
                href={
                  profile.role === "landlord"
                    ? `/properties/${p.id}`
                    : "/inventory"
                }
              >
                <div className="room-icon">
                  <Building2 size={22} />
                </div>
                <div>
                  <strong>{p.name}</strong>
                  <small>{p.address || p.propertyType}</small>
                </div>
                <ArrowRight size={18} />
              </Link>
            ))}
          </div>
        ) : (
          !loading && (
            <EmptyState
              icon={Building2}
              title={
                profile.role === "landlord"
                  ? "Let’s get your first property ready"
                  : "Your tenancy will appear here"
              }
              description={
                profile.role === "landlord"
                  ? "Add your property, create its rooms, and record the items that make it a home."
                  : "Ask your landlord to add a tenancy using your verified account email."
              }
              action={
                profile.role === "landlord" && (
                  <Link className="button primary" href="/properties">
                    Add your first property <ArrowRight size={16} />
                  </Link>
                )
              }
            />
          )
        )}
      </div>
    </>
  );
}
