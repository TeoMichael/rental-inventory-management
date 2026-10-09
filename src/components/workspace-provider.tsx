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
  error: string | null;
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
  useEffect(() => {
    try {
      return subscribeWorkspace(
        profile,
        (next) => {
          setData(next);
          setLoading(false);
        },
        (err) => {
          setError(friendlyError(err));
          setLoading(false);
        },
      );
    } catch (err) {
      queueMicrotask(() => {
        setError(friendlyError(err));
        setLoading(false);
      });
    }
  }, [profile]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <Context.Provider
      value={{ profile, data, loading, error, notify: setToast }}
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
