import axios from "axios";
import { useAdminSessionStore } from "../../store/adminSessionStore";

const webOrigin =
  process.env.NEXT_PUBLIC_WEB_ORIGIN ??
  (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : undefined);

export const adminApi = axios.create({
  baseURL: webOrigin,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});
adminApi.interceptors.response.use(undefined, (error) => {
  if (error.response?.status === 401) {
    useAdminSessionStore.setState({
      status: "anonymous",
      user: null,
      csrfToken: null,
    });
    if (typeof window !== "undefined") window.location.assign("/login");
  }
  return Promise.reject(error);
});

export function adminHeaders(
  method: string,
  csrfToken: string | null,
): Record<string, string> {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase()) &&
    csrfToken
    ? { "X-CSRF-Token": csrfToken }
    : {};
}

export function adminMultipartHeaders(csrfToken: string | null) {
  return {
    "Content-Type": "multipart/form-data",
    ...adminHeaders("POST", csrfToken),
  };
}
