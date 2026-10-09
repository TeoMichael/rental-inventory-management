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
    const stopAuth = onAuthStateChanged(
      getFirebase().auth,
      (current) => {
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
          doc(getFirebase().db, "users", current.uid),
          (snapshot) => {
            setProfile(
              snapshot.exists()
                ? ({ ...snapshot.data(), id: snapshot.id } as Profile)
                : null,
            );
            setLoading(false);
          },
          (err) => {
            setError(friendlyError(err));
            setLoading(false);
          },
        );
      },
      (err) => {
        setError(friendlyError(err));
        setLoading(false);
      },
    );
    return () => {
      stopAuth();
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
