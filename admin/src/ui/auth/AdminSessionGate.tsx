"use client";
import { useEffect } from "react";
import { useAdminSessionStore } from "../../store/adminSessionStore";
export function AdminSessionGate({ children }: { children: React.ReactNode }) {
  const status = useAdminSessionStore((state) => state.status);
  const restore = useAdminSessionStore((state) => state.restore);
  useEffect(() => {
    void restore();
  }, [restore]);
  useEffect(() => {
    if (status === "anonymous") window.location.assign("/login");
  }, [status]);
  if (status !== "authenticated") return <p>불러오는 중…</p>;
  return <>{children}</>;
}
