"use client";

import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { Button } from "./Button";

export function QrScanner({
  onScan,
  onClose,
  title = "QR을 비춰 주세요",
}: {
  onScan: (value: string) => void;
  onClose: () => void;
  title?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const callback = useRef(onScan);
  useEffect(() => {
    callback.current = onScan;
  }, [onScan]);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  useEffect(() => {
    let canceled = false;
    let controls: IScannerControls | undefined;
    const element = video.current;
    const stop = () => {
      controls?.stop();
      const stream = element?.srcObject;
      if (typeof MediaStream !== "undefined" && stream instanceof MediaStream)
        stream.getTracks().forEach((track) => track.stop());
    };
    const hide = () => {
      if (document.hidden) {
        canceled = true;
        stop();
        setError("카메라가 중지되었습니다. 닫은 뒤 다시 열어 주세요.");
      }
    };
    document.addEventListener("visibilitychange", hide);
    void import("@zxing/browser")
      .then(async ({ BrowserQRCodeReader }) => {
        if (canceled || !element) return;
        controls = await new BrowserQRCodeReader().decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: "environment" } } },
          element,
          (result, _error, scanner) => {
            if (!result || canceled) return;
            canceled = true;
            scanner.stop();
            callback.current(result.getText());
          },
        );
        if (canceled) stop();
      })
      .catch(() => {
        if (!canceled)
          setError(
            "카메라를 열 수 없습니다. 카메라 권한을 허용하거나 QR 사진을 선택해 주세요.",
          );
      });
    return () => {
      canceled = true;
      document.removeEventListener("visibilitychange", hide);
      stop();
    };
  }, []);

  const readImage = async (file?: File) => {
    if (!file) return;
    setReading(true);
    const url = URL.createObjectURL(file);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const result = await new BrowserQRCodeReader().decodeFromImageUrl(url);
      callback.current(result.getText());
    } catch {
      setError("QR을 읽지 못했습니다. QR 전체가 보이는 사진을 선택해 주세요.");
    } finally {
      URL.revokeObjectURL(url);
      setReading(false);
    }
  };

  return (
    <section aria-label="QR 스캐너" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="ds-h2">{title}</h2>
        <Button variant="ghost" onClick={onClose}>
          닫기
        </Button>
      </div>
      <video
        ref={video}
        muted
        playsInline
        aria-label="QR 카메라 미리보기"
        className="aspect-square w-full rounded-[var(--radius-lg)] bg-[var(--surface-alt)] object-cover"
      />
      {error ? (
        <p role="alert" className="ds-body text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      <label className="ds-body block text-center underline cursor-pointer">
        {reading ? "사진 확인 중…" : "QR 사진으로 확인"}
        <input
          aria-label="QR 사진 선택"
          type="file"
          accept="image/*"
          disabled={reading}
          className="sr-only"
          onChange={(event) => void readImage(event.target.files?.[0])}
        />
      </label>
    </section>
  );
}
