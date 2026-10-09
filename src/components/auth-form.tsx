"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { ArrowRight, KeyRound, ShieldCheck } from "lucide-react";
import { firebaseConfigured, getFirebase } from "@/lib/firebase";
import { friendlyError } from "@/lib/format";
import type { Role } from "@/lib/types";
import { useAuth } from "./auth-provider";
import { Button, ErrorMessage, Field } from "./ui";
import { SetupScreen } from "./setup-screen";
export function AuthForm() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("landlord");
  useEffect(() => {
    if (user && profile && !loading) router.replace("/dashboard");
  }, [user, profile, loading, router]);
  if (!firebaseConfigured) return <SetupScreen />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    try {
      if (register) {
        const name = String(form.get("name")).trim();
        if (!name) throw new Error("Enter your name.");
        const credential = await createUserWithEmailAndPassword(
          getFirebase().auth,
          email.trim().toLowerCase(),
          password,
        );
        await setDoc(doc(getFirebase().db, "users", credential.user.uid), {
          id: credential.user.uid,
          name,
          email: email.trim().toLowerCase(),
          role,
          createdAt: new Date().toISOString(),
        });
        await updateProfile(credential.user, { displayName: name });
        if (role === "tenant") {
          try {
            await sendEmailVerification(credential.user);
          } catch {
            setMessage(
              "Account created. Resend verification from your workspace.",
            );
          }
        }
      } else
        await signInWithEmailAndPassword(
          getFirebase().auth,
          email.trim().toLowerCase(),
          password,
        );
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }
  async function resetPassword() {
    if (!email.trim()) {
      setError("Enter your email first, then request a reset link.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await sendPasswordResetEmail(
        getFirebase().auth,
        email.trim().toLowerCase(),
      );
      setMessage("If an account exists, a reset link has been sent.");
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="brand">
          <KeyRound /> keyline
        </div>
        <div>
          <p className="eyebrow">RENTAL INVENTORY, MADE CLEAR</p>
          <h1>
            Good records.
            <br />
            Better handovers.
          </h1>
          <p>
            Keep every room, every item, and every condition in one place. A
            little clarity goes a long way.
          </p>
          <div className="auth-illustration">
            <div className="illustration-window" />
            <div className="illustration-plant" />
            <div className="illustration-sofa" />
            <span>
              <ShieldCheck size={18} /> Everything accounted for
            </span>
          </div>
        </div>
        <small>Built for landlords. Shared with tenants.</small>
      </section>
      <section className="auth-form-panel">
        <form onSubmit={submit} className="auth-form">
          <p className="eyebrow">YOUR PROPERTY WORKSPACE</p>
          <h2>{register ? "Make yourself at home." : "Welcome back."}</h2>
          <p className="text-muted">
            {register
              ? "Create an account to start keeping a clearer record."
              : "Sign in to pick up where you left off."}
          </p>
          {register && (
            <>
              <Field label="Your name">
                <input
                  className="input"
                  name="name"
                  autoComplete="name"
                  maxLength={100}
                  required
                />
              </Field>
              <Field label="I am a">
                <select
                  className="input"
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                >
                  <option value="landlord">Landlord</option>
                  <option value="tenant">Tenant</option>
                </select>
              </Field>
            </>
          )}
          <Field label="Email address">
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
          </Field>
          <Field
            label="Password"
            hint={register ? "At least 8 characters" : undefined}
          >
            <input
              className="input"
              name="password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              minLength={register ? 8 : undefined}
              required
            />
          </Field>
          <ErrorMessage message={error} />
          {message && <p role="status">{message}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
            <ArrowRight size={17} />
          </Button>
          {!register && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={resetPassword}
            >
              Forgot password?
            </Button>
          )}
          <p className="auth-switch">
            {register ? "Already have an account?" : "New to Keyline?"}{" "}
            <button
              type="button"
              onClick={() => {
                setRegister(!register);
                setError("");
                setMessage("");
              }}
            >
              {register ? "Sign in" : "Create an account"}
            </button>
          </p>
          <small className="text-muted">
            Tenant access is linked to the verified email on your tenancy.
          </small>
        </form>
      </section>
    </main>
  );
}
