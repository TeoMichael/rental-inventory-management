import Link from "next/link";
export default function NotFound() {
  return (
    <main className="center-screen">
      <div className="card">
        <p className="eyebrow">404 · Page not found</p>
        <h1>This door doesn’t open.</h1>
        <p>The page may have moved or the address is incorrect.</p>
        <Link className="button primary" href="/dashboard">
          Back to workspace
        </Link>
      </div>
    </main>
  );
}
