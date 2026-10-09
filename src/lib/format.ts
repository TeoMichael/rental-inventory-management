import type { Condition } from "./types";
export function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);
}
export function conditionTone(condition: Condition): "green" | "amber" | "red" {
  return condition === "New" || condition === "Good"
    ? "green"
    : condition === "Fair"
      ? "amber"
      : "red";
}
export function friendlyError(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  const errors: Record<string, string> = {
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/email-already-in-use":
      "An account already uses this email. Please sign in.",
    "auth/weak-password": "Use a password with at least 8 characters.",
    "auth/too-many-requests":
      "Too many attempts. Please wait a little and try again.",
    "auth/network-request-failed":
      "Cannot connect. Check your internet connection and try again.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/operation-not-allowed":
      "Email/password authentication must be enabled in Firebase.",
    "permission-denied":
      "Access denied. Check your account permissions and deployed Firebase rules.",
    "storage/unauthorized":
      "Photo upload denied. Check your tenancy and Storage rules.",
    unavailable:
      "Firebase is unavailable. Check your connection and try again.",
  };
  return (
    errors[code] ??
    (error instanceof Error
      ? error.message
      : "Something went wrong. Please try again.")
  );
}
