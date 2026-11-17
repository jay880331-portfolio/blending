import { create } from "zustand";
import { adminApi, adminHeaders } from "../adapters/http/adminApi";
type AdminActor = { id: string; name: string; role: "admin" };
type AdminLoginRequest = { phone: string; password: string };

type State = {
  user: AdminActor | null;
  csrfToken: string | null;
  status: "loading" | "authenticated" | "anonymous";
  restore: () => Promise<void>;
  login: (input: AdminLoginRequest) => Promise<void>;
  logout: () => Promise<void>;
};
export const useAdminSessionStore = create<State>((set, get) => ({
  user: null,
  csrfToken: null,
  status: "loading",
  restore: async () => {
    try {
      const { data } = await adminApi.get("/api/admin/auth/session");
      set({
        user: data.user,
        csrfToken: data.csrfToken,
        status: "authenticated",
      });
    } catch {
      set({ user: null, csrfToken: null, status: "anonymous" });
    }
  },
  login: async (input) => {
    const { data } = await adminApi.post("/api/admin/auth/login", input);
    set({
      user: data.user,
      csrfToken: data.csrfToken,
      status: "authenticated",
    });
  },
  logout: async () => {
    await adminApi.post("/api/admin/auth/logout", undefined, {
      headers: adminHeaders("POST", get().csrfToken),
    });
    set({ user: null, csrfToken: null, status: "anonymous" });
  },
}));
