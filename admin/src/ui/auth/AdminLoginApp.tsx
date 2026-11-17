"use client";
import { FormEvent, useState } from "react";
import { useAdminSessionStore } from "../../store/adminSessionStore";
export function AdminLoginApp() {
  const login = useAdminSessionStore((s) => s.login);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await login({ phone, password });
      window.location.href = "/dashboard";
    } catch {
      setError("로그인 정보를 확인해 주세요.");
    }
  }
  return (
    <main className="login">
      <form onSubmit={submit}>
        <h1>BLENDING</h1>
        <p className="login-subtitle">관리자 계정으로 로그인하세요</p>
        <label>
          전화번호
          <input
            autoComplete="tel"
            inputMode="tel"
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-0000-0000"
            value={phone}
          />
        </label>
        <label>
          비밀번호
          <input
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            type="password"
            value={password}
          />
        </label>
        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit">로그인</button>
      </form>
    </main>
  );
}
