"use client";

import axios from "axios";
import { apiMessage } from "@/adapters/http/apiError";
import { forgetSessionToken } from "@/adapters/http/sessionPersistence";
import type {
  PublicMemberRole,
  WorkplaceLocation,
} from "@/domain/member/types";

type VerifyPhoneResponse = {
  success: boolean;
  message: string;
  code?: string;
};

type ConfirmPhoneResponse = {
  success: boolean;
  verificationToken: string;
};

export type LoginMethod = "phone" | "kakao" | "naver" | "apple";

type LoginResponse = {
  success: boolean;
  method?: LoginMethod;
  nextPath?: string;
};

type RecentLoginResponse = {
  method: LoginMethod | null;
};

export async function requestPhoneVerification(
  phone: string,
): Promise<VerifyPhoneResponse> {
  try {
    const response = await axios.post<VerifyPhoneResponse>(
      "/api/auth/verify-phone",
      { phone },
    );
    return response.data;
  } catch (error) {
    throw new Error(apiMessage(error, "인증번호 전송에 실패했습니다."));
  }
}

export async function confirmPhoneVerification(
  phone: string,
  code: string,
): Promise<ConfirmPhoneResponse> {
  try {
    const response = await axios.post<ConfirmPhoneResponse>(
      "/api/auth/verify-phone/confirm",
      { phone, code },
    );
    return response.data;
  } catch (error) {
    throw new Error(apiMessage(error, "인증번호 확인에 실패했습니다."));
  }
}

export async function registerWithPhone(input: {
  phone: string;
  password: string;
  name: string;
  role: PublicMemberRole;
  phoneVerificationToken: string;
  workplaces: string[];
  workplaceLocations?: WorkplaceLocation[];
  termsAccepted: boolean;
}) {
  try {
    const response = await axios.post("/api/auth/register", input);
    return response.data as LoginResponse;
  } catch (error) {
    throw new Error(apiMessage(error, "회원가입에 실패했습니다."));
  }
}

export async function loginWithPhone(phone: string, password: string) {
  try {
    const response = await axios.post("/api/auth/login", {
      phone,
      password,
    });
    return response.data as LoginResponse;
  } catch (error) {
    throw new Error(apiMessage(error, "로그인에 실패했습니다."));
  }
}

export async function testLogin() {
  try {
    const response = await axios.post("/api/auth/test-login");
    return response.data as LoginResponse;
  } catch (error) {
    throw new Error(apiMessage(error, "테스트 로그인에 실패했습니다."));
  }
}

export async function fetchRecentLoginMethod() {
  try {
    const response = await axios.get<RecentLoginResponse>(
      "/api/auth/recent-login",
    );
    return response.data.method;
  } catch {
    return null;
  }
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}) {
  try {
    const response = await axios.patch("/api/auth/password", input);
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "비밀번호 변경에 실패했습니다."));
  }
}

export async function resetPasswordWithPhone(input: {
  phone: string;
  phoneVerificationToken: string;
  newPassword: string;
}) {
  try {
    const response = await axios.patch("/api/auth/password/reset", input);
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "비밀번호 재설정에 실패했습니다."));
  }
}

export async function logout() {
  try {
    const response = await axios.post("/api/auth/logout");
    return response.data as { success: boolean };
  } catch (error) {
    throw new Error(apiMessage(error, "로그아웃에 실패했습니다."));
  } finally {
    forgetSessionToken();
  }
}
