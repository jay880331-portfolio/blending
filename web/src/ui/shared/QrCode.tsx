"use client";

import { useEffect, useRef, useState } from "react";

type QriousOptions = {
  element: HTMLCanvasElement;
  value: string;
  size: number;
  background: string;
  foreground: string;
  level: "H";
};
declare global {
  interface Window {
    QRious?: new (options: QriousOptions) => unknown;
  }
}
let loading: Promise<void> | undefined;

export function loadQrious(): Promise<void> {
  if (window.QRious) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      loading = undefined;
      reject(new Error("QR 코드를 불러오지 못했습니다."));
    };
    document.body.append(script);
  });
  return loading;
}

export function QrCode({
  value,
  label,
  size = 208,
  onReady,
}: {
  value: string | ((origin: string) => string);
  label: string;
  size?: number;
  onReady?: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let canceled = false;
    void loadQrious()
      .then(() => {
        if (canceled || !canvas.current || !window.QRious) return;
        const style = getComputedStyle(document.documentElement);
        new window.QRious({
          element: canvas.current,
          value:
            typeof value === "function" ? value(window.location.origin) : value,
          size,
          background: style.getPropertyValue("--surface").trim(),
          foreground: style.getPropertyValue("--fg").trim(),
          level: "H",
        });
        onReady?.();
      })
      .catch(() => {
        if (!canceled) setError(true);
      });
    return () => {
      canceled = true;
    };
  }, [value, size, onReady]);
  return error ? (
    <p role="alert" className="ds-body text-[var(--danger)]">
      QR을 불러오지 못했습니다. 화면을 새로고침해 주세요.
    </p>
  ) : (
    <canvas
      ref={canvas}
      aria-label={label}
      role="img"
      width={size}
      height={size}
      className="max-w-full"
    />
  );
}
