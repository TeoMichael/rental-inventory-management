"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { subscribeWorkspace } from "@/lib/repository";
import { EMPTY_WORKSPACE, type Profile, type WorkspaceData } from "@/lib/types";
import { friendlyError } from "@/lib/format";
type Workspace = {
  profile: Profile;
  data: WorkspaceData;
  loading: boolean;
  online: boolean;
  error: string | null;
  retry: () => void;
  notify: (message: string) => void;
};
const Context = createContext<Workspace | null>(null);
export function WorkspaceProvider({
  profile,
  children,
}: {
  profile: Profile;
  children: ReactNode;
}) {
  const [data, setData] = useState<WorkspaceData>(EMPTY_WORKSPACE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setOnline(navigator.onLine);
    });
    const reconnect = () => {
      setOnline(true);
      setAttempt((value) => value + 1);
    };
    const disconnect = () => setOnline(false);
    window.addEventListener("online", reconnect);
    window.addEventListener("offline", disconnect);
    return () => {
      active = false;
      window.removeEventListener("online", reconnect);
      window.removeEventListener("offline", disconnect);
    };
  }, []);
  useEffect(() => {
    let active = true;
    let stop: (() => void) | undefined;
    queueMicrotask(() => {
      if (!active) return;
      setData(EMPTY_WORKSPACE);
      setLoading(true);
      setError(null);
    });
    try {
      stop = subscribeWorkspace(
        profile,
        (next) => {
          if (!active) return;
          setData(next);
          setLoading(false);
        },
        (err) => {
          if (!active) return;
          setError(friendlyError(err));
          setLoading(false);
        },
      );
    } catch (err) {
      queueMicrotask(() => {
        if (!active) return;
        setError(friendlyError(err));
        setLoading(false);
      });
    }
    return () => {
      active = false;
      stop?.();
    };
  }, [profile, attempt]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <Context.Provider
      value={{
        profile,
        data,
        loading,
        online,
        error,
        retry: () => setAttempt((value) => value + 1),
        notify: setToast,
      }}
    >
      {children}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const context = useContext(Context);
  if (!context) throw new Error("Workspace is unavailable.");
  return context;
}
