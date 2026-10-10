import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim(),
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim(),
};

export const firebaseConfigured = Object.values(config).every((value) =>
  Boolean(value?.trim()),
);
type FirebaseServices = { auth: Auth; db: Firestore };
const shared = globalThis as typeof globalThis & {
  __rentalFirebase?: FirebaseServices;
};

/** Lazy initialization keeps the setup page and production build usable without credentials. */
export function getFirebase(): FirebaseServices {
  if (!firebaseConfigured)
    throw new Error(
      "Firebase is not configured. Add the public Firebase settings to .env.local and restart the app.",
    );
  if (shared.__rentalFirebase) return shared.__rentalFirebase;
  const app = getApps().some((app) => app.name === "[DEFAULT]")
    ? getApp()
    : initializeApp(config);
  const services = {
    auth: getAuth(app),
    db: getFirestore(app),
  };
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true") {
    connectAuthEmulator(services.auth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    connectFirestoreEmulator(services.db, "127.0.0.1", 8080);
  }
  shared.__rentalFirebase = services;
  return services;
}
