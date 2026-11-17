export type AdminActor = {
  id: string;
  name: string;
  role: "admin";
};

export type AdminLoginRequest = {
  phone: string;
  password: string;
};

export const ADMIN_SESSION_COOKIE = "blending_admin_session";

export type AdminSession = {
  userId: string;
  csrfToken: string;
};

export type AdminSessionResponse = {
  authenticated: true;
  user: AdminActor;
  csrfToken: string;
};

export type AdminLogoutResponse = { success: true };
