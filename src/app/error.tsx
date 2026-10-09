"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="center-screen">
      <div className="card">
        <h1>Something interrupted your workspace.</h1>
        <p>Please try again. Your saved records remain in Firebase.</p>
        <button className="button primary" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
