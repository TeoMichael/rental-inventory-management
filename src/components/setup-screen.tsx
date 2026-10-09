import {
  ArrowUpRight,
  House,
  KeyRound,
  ShieldCheck,
  Terminal,
} from "lucide-react";
export function SetupScreen() {
  return (
    <main className="setup-screen">
      <div className="setup-brand">
        <KeyRound size={26} /> keyline<span>RENTAL INVENTORY</span>
      </div>
      <div className="setup-grid">
        <section>
          <p className="eyebrow">A PLACE FOR EVERY DETAIL</p>
          <h1>
            Every item.
            <br />
            Every handover.
            <br />
            <em>All accounted for.</em>
          </h1>
          <p className="setup-intro">
            A clear, photographic record of your rental property. From the first
            set of keys to the final walkthrough.
          </p>
          <div className="setup-feature">
            <House size={20} /> Properties, rooms & inventory
          </div>
          <div className="setup-feature">
            <ShieldCheck size={20} /> Private records & preserved inspections
          </div>
        </section>
        <section className="setup-card">
          <div className="empty-icon">
            <Terminal />
          </div>
          <p className="eyebrow">WORKSPACE SETUP</p>
          <h2>Connect your Firebase project</h2>
          <p>
            Your app is ready for configuration. Add your project settings to
            enable secure accounts, inventory, and photo storage.
          </p>
          <ol className="setup-steps">
            <li>
              <strong>Create a Firebase web app</strong>
              <span>
                Enable Email/Password Authentication, Firestore, and Storage.
              </span>
            </li>
            <li>
              <strong>Copy .env.example to .env.local</strong>
              <span>
                Fill in all six NEXT_PUBLIC_FIREBASE values from your web app
                settings.
              </span>
            </li>
            <li>
              <strong>Deploy the security rules</strong>
              <span>
                Follow docs/firebase-setup.md, then restart the development
                server.
              </span>
            </li>
          </ol>
          <p className="setup-footnote">
            Prefer a local test? The documented Firebase Emulator Suite works
            without a live project. <ArrowUpRight size={15} />
          </p>
        </section>
      </div>
      <footer>
        KEYLINE <span>Less uncertainty. Better handovers.</span>
      </footer>
    </main>
  );
}
