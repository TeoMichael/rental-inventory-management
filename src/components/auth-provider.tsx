"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { firebaseConfigured, getFirebase } from "@/lib/firebase";
import type { Profile } from "@/lib/types";
import { friendlyError } from "@/lib/format";
type AuthState = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  logout: () => Promise<void>;
};
const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  loading: true,
  error: null,
  logout: async () => {},
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!firebaseConfigured) return;
    let stopProfile: (() => void) | undefined;
    let stopAuth: (() => void) | undefined;
    let generation = 0;
    let closed = false;
    const fail = (err: unknown) => {
      if (closed) return;
      setProfile(null);
      setError(friendlyError(err));
      setLoading(false);
    };
    try {
      const { auth, db } = getFirebase();
      stopAuth = onAuthStateChanged(
        auth,
        (current) => {
          if (closed) return;
          const currentGeneration = ++generation;
          stopProfile?.();
          setUser(current);
          setProfile(null);
          setError(null);
          if (!current) {
            setLoading(false);
            return;
          }
          setLoading(true);
          stopProfile = onSnapshot(
            doc(db, "users", current.uid),
            { includeMetadataChanges: true },
            (snapshot) => {
              if (closed || generation !== currentGeneration) return;
              // Cached absence is not proof that registration failed or a profile needs recovery.
              if (!snapshot.exists() && snapshot.metadata.fromCache) return;
              setProfile(
                snapshot.exists()
                  ? ({ ...snapshot.data(), id: snapshot.id } as Profile)
                  : null,
              );
              setError(null);
              setLoading(false);
            },
            (err) => {
              if (generation === currentGeneration) fail(err);
            },
          );
        },
        (err) => {
          if (closed) return;
          ++generation;
          stopProfile?.();
          setUser(null);
          fail(err);
        },
      );
    } catch (err) {
      queueMicrotask(() => fail(err));
    }
    return () => {
      closed = true;
      ++generation;
      stopAuth?.();
      stopProfile?.();
    };
  }, []);
  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        error,
        logout: () => signOut(getFirebase().auth),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  return useContext(AuthContext);
}
