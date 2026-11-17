"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Search } from "lucide-react";

import {
  loadDaumPostcodeScript,
  selectedPostcodeAddress,
  type DaumPostcodeData,
  type DaumPostcodeWindow,
} from "@/ui/shared/daumPostcode";

export type PostcodeSelection = {
  data: DaumPostcodeData;
  address: string;
};

export function PostcodeSearchField({
  ariaLabel = "주소 검색",
  postalCode,
  baseAddress,
  detailAddress,
  disabled,
  onComplete,
  onDetailAddressChange,
  onSearchOpenChange,
}: {
  ariaLabel?: string;
  postalCode: string;
  baseAddress: string;
  detailAddress: string;
  disabled?: boolean;
  onComplete: (selection: PostcodeSelection) => void;
  onDetailAddressChange: (value: string) => void;
  onSearchOpenChange?: (open: boolean) => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [postcodeError, setPostcodeError] = useState<string | null>(null);
  const postcodeContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(
    () => () => {
      onSearchOpenChange?.(false);
    },
    [onSearchOpenChange],
  );

  const closePostcodeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearched(false);
    onSearchOpenChange?.(false);
  }, [onSearchOpenChange]);

  const resetPostcodeSearch = useCallback(() => {
    setPostcodeError(null);
    setSearched(false);
    setResetKey((current) => current + 1);
  }, []);

  const handlePostcodeComplete = useCallback(
    (data: DaumPostcodeData) => {
      const address = selectedPostcodeAddress(data);
      if (!address) {
        setPostcodeError("주소를 선택할 수 없습니다. 다시 검색해주세요.");
        return;
      }

      onComplete({ data, address });
      closePostcodeSearch();
    },
    [closePostcodeSearch, onComplete],
  );

  useEffect(() => {
    if (!searchOpen) return;
    const previousOverflow = document.body.style.overflow;
    let cancelled = false;
    document.body.style.overflow = "hidden";

    loadDaumPostcodeScript()
      .then(() => {
        if (cancelled || !postcodeContainerRef.current) return;
        const postcodeWindow: DaumPostcodeWindow = window;
        const Postcode = postcodeWindow.daum?.Postcode;
        if (!Postcode) throw new Error("우편번호 검색을 불러오지 못했습니다.");
        new Postcode({
          oncomplete: handlePostcodeComplete,
          onsearch: () => setSearched(true),
          submitMode: false,
          width: "100%",
          height: "100%",
        }).embed(postcodeContainerRef.current);
      })
      .catch(() => {
        if (!cancelled)
          setPostcodeError(
            "우편번호 검색을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
          );
      });

    return () => {
      cancelled = true;
      document.body.style.overflow = previousOverflow;
    };
  }, [handlePostcodeComplete, resetKey, searchOpen]);

  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-[minmax(0,1fr)_116px] gap-2">
        <input
          aria-label="우편번호"
          readOnly
          disabled={disabled}
          value={postalCode}
          placeholder="우편번호"
          className="h-12 min-w-0 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-[16px] outline-none placeholder:text-[var(--fg-subtle)] disabled:cursor-not-allowed"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setPostcodeError(null);
            setSearched(false);
            setSearchOpen(true);
            onSearchOpenChange?.(true);
          }}
          className="h-12 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-alt)] px-3 text-[14px] font-bold text-[var(--fg)] disabled:opacity-30"
        >
          우편번호 찾기
        </button>
      </div>
      <input
        aria-label="기본 주소"
        readOnly
        disabled={disabled}
        value={baseAddress}
        placeholder="우편번호 찾기로 주소를 선택하세요"
        className="h-12 min-w-0 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-[16px] outline-none placeholder:text-[var(--fg-subtle)] disabled:cursor-not-allowed"
      />
      <input
        aria-label="상세 주소"
        disabled={disabled || !baseAddress}
        value={detailAddress}
        onChange={(event) => onDetailAddressChange(event.target.value)}
        placeholder="상세 주소"
        className="h-12 min-w-0 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-[16px] outline-none placeholder:text-[var(--fg-subtle)] focus:border-[var(--accent)] disabled:cursor-not-allowed disabled:bg-[var(--surface-alt)]"
      />
      {searchOpen
        ? createPortal(
            <section
              role="dialog"
              aria-modal="true"
              aria-label={ariaLabel}
              onSubmitCapture={(event) => event.preventDefault()}
              className="fixed inset-y-0 left-1/2 z-[80] flex w-full max-w-[var(--app-shell-max-width)] -translate-x-1/2 flex-col overflow-hidden bg-[var(--surface)] shadow-[0_0_0_1px_var(--border)]"
            >
              <div className="z-10 shrink-0 border-b border-[var(--border-strong)] bg-[var(--surface)] pt-[env(safe-area-inset-top)]">
                <div className="flex h-14 items-center pr-2">
                  <button
                    type="button"
                    aria-label="주소 검색 닫기"
                    onClick={closePostcodeSearch}
                    className="flex h-11 w-11 shrink-0 items-center justify-center text-[var(--fg)]"
                  >
                    <ArrowLeft size={25} strokeWidth={2.2} />
                  </button>
                  <h2 className="min-w-0 flex-1 truncate text-center text-[18px] font-bold text-[var(--fg-strong)]">
                    우편번호 찾기
                  </h2>
                  {searched ? (
                    <button
                      type="button"
                      aria-label="다시 검색"
                      onClick={resetPostcodeSearch}
                      className="flex h-11 w-11 shrink-0 items-center justify-center text-[var(--fg)]"
                    >
                      <Search size={22} strokeWidth={2.2} />
                    </button>
                  ) : (
                    <div className="h-11 w-11 shrink-0" />
                  )}
                </div>
              </div>
              <div className="min-h-0 flex-1 bg-[var(--surface)]">
                {postcodeError ? (
                  <p className="px-6 py-5 text-[13px] font-medium leading-[1.6] text-[var(--fg-muted)]">
                    {postcodeError}
                  </p>
                ) : null}
                <div
                  key={resetKey}
                  ref={postcodeContainerRef}
                  className="postcode-embed h-full w-full touch-pan-y overflow-hidden overscroll-contain"
                />
              </div>
            </section>,
            document.body,
          )
        : null}
    </div>
  );
}
