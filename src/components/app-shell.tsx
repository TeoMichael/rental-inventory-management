"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { doc, setDoc } from "firebase/firestore";
import { sendEmailVerification } from "firebase/auth";
import {
  Building2,
  ClipboardCheck,
  LayoutDashboard,
  Package,
  Users,
  Wrench,
  KeyRound,
  LogOut,
  Menu,
  X,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { firebaseConfigured, getFirebase } from "@/lib/firebase";
import { friendlyError } from "@/lib/format";
import { useAuth } from "./auth-provider";
import { WorkspaceProvider, useWorkspace } from "./workspace-provider";
import { SetupScreen } from "./setup-screen";
import { Button, ErrorMessage, Field } from "./ui";
const links = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    tenant: true,
  },
  { href: "/properties", label: "Properties", icon: Building2, tenant: false },
  { href: "/inventory", label: "Inventory", icon: Package, tenant: true },
  { href: "/tenancies", label: "Tenancies", icon: Users, tenant: false },
  {
    href: "/inspections",
    label: "Inspections",
    icon: ClipboardCheck,
    tenant: true,
  },
  { href: "/damage", label: "Damage reports", icon: Wrench, tenant: true },
];
function WorkspaceFrame({ children }: { children: ReactNode }) {
  const { profile, data, error, loading } = useWorkspace();
  const { logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const filtered = links.filter(
    (link) => profile.role === "landlord" || link.tenant,
  );
  const reports = data.damageReports.filter(
    (report) => report.status !== "Resolved",
  ).length;
  return (
    <div className="app-layout">
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <Link
          href="/dashboard"
          className="brand"
          onClick={() => setOpen(false)}
        >
          <KeyRound size={28} />
          keyline<span className="brand-dot">.</span>
        </Link>
        <button
          className="mobile-close"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        >
          <X />
        </button>
        <div className="workspace-label">PROPERTY WORKSPACE</div>
        <nav aria-label="Main navigation">
          {filtered.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-link ${pathname.startsWith(href) ? "active" : ""}`}
              onClick={() => setOpen(false)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {href === "/damage" && reports > 0 && (
                <span className="nav-count">{reports}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-tip">
          <ShieldCheck size={23} />
          <strong>A clearer handover.</strong>
          <p>Keep a photo record today. Have peace of mind tomorrow.</p>
          <Link href="/inspections" onClick={() => setOpen(false)}>
            View inspections <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="sidebar-user">
          <div className="avatar">{profile.name.slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{profile.name}</strong>
            <small>
              {profile.role === "landlord"
                ? "Landlord workspace"
                : "Tenant workspace"}
            </small>
          </div>
          <button
            aria-label="Sign out"
            title="Sign out"
            onClick={() =>
              logout().catch((err) => setLogoutError(friendlyError(err)))
            }
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      {open && (
        <button
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="app-content">
        <header className="topbar">
          <div>
            <button
              className="mobile-menu"
              aria-label="Open navigation"
              onClick={() => setOpen(true)}
            >
              <Menu />
            </button>
            <span className="topbar-breadcrumb">
              Workspace <span>/</span>{" "}
              <strong>
                {links.find((link) => pathname.startsWith(link.href))?.label ??
                  "Property details"}
              </strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="live-dot" />
            {process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true"
              ? "Local emulator"
              : "Connected to Firebase"}
            <div className="avatar small">
              {profile.name.slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>
        <main className="main-content">
          <ErrorMessage message={error || logoutError} />
          {loading && (
            <div className="loading-strip" role="status">
              Loading your workspace…
            </div>
          )}
          {children}
        </main>
        <footer className="workspace-footer">
          KEYLINE <span>Your property. A clearer picture.</span>
        </footer>
      </div>
      <nav className="mobile-bottom-nav" aria-label="Quick navigation">
        {filtered
          .filter((link) =>
            ["/dashboard", "/inventory", "/inspections", "/damage"].includes(
              link.href,
            ),
          )
          .map(({ href, label, icon: Icon }) => (
            <Link
              href={href}
              key={href}
              className={pathname.startsWith(href) ? "active" : ""}
            >
              <Icon size={20} />
              <span>{label === "Damage reports" ? "Damage" : label}</span>
            </Link>
          ))}
      </nav>
    </div>
  );
}
export function AppShell({ children }: { children: ReactNode }) {
  const { user, profile, loading, error, logout } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (firebaseConfigured && !loading && !user) router.replace("/login");
  }, [loading, user, router]);
  if (!firebaseConfigured) return <SetupScreen />;
  if (loading || !user)
    return (
      <div className="center-screen">
        <div className="spinner" />
        <p>Opening your workspace…</p>
        <ErrorMessage message={error} />
      </div>
    );
  if (!profile)
    return (
      <div className="center-screen">
        <form
          className="card recovery-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            const form = new FormData(event.currentTarget);
            try {
              await setDoc(doc(getFirebase().db, "users", user.uid), {
                id: user.uid,
                name: String(form.get("name")).trim(),
                email: user.email?.toLowerCase(),
                role: form.get("role"),
                createdAt: new Date().toISOString(),
              });
            } catch (err) {
              setStatus(friendlyError(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>Finish your account</h2>
          <p>Your sign-in exists. Add a profile to open your workspace.</p>
          <Field label="Your name">
            <input className="input" name="name" maxLength={100} required />
          </Field>
          <Field label="Role">
            <select className="input" name="role">
              <option value="landlord">Landlord</option>
              <option value="tenant">Tenant</option>
            </select>
          </Field>
          <ErrorMessage message={error || status} />
          <Button disabled={busy}>Save profile</Button>
          <Button type="button" variant="ghost" onClick={logout}>
            Sign out
          </Button>
        </form>
      </div>
    );
  if (profile.role === "tenant" && !user.emailVerified)
    return (
      <div className="center-screen">
        <div className="card verification-card">
          <ShieldCheck size={38} />
          <h2>Verify your email</h2>
          <p>
            Verify <strong>{user.email}</strong> to securely access your
            assigned tenancy. Check your inbox for a verification link.
          </p>
          <ErrorMessage message={error} />
          {status && <p role="status">{status}</p>}
          <div className="form-actions">
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await user.reload();
                  await user.getIdToken(true);
                  if (user.emailVerified) window.location.reload();
                  else
                    setStatus(
                      "Your email is not verified yet. Open the link in your inbox first.",
                    );
                } catch (err) {
                  setStatus(friendlyError(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              I’ve verified my email
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await sendEmailVerification(user);
                  setStatus("Verification email sent. Check your inbox.");
                } catch (err) {
                  setStatus(friendlyError(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Resend email
            </Button>
            <Button variant="ghost" onClick={logout}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  return (
    <WorkspaceProvider key={profile.id} profile={profile}>
      <WorkspaceFrame>{children}</WorkspaceFrame>
    </WorkspaceProvider>
  );
}
