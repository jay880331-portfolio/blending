"use client";

import type { AppPopupDto, AppPopupPlacement } from "@blending/admin-contracts";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { fetchAppPopups } from "@/adapters/http/appPopupApi";
import {
  APP_POPUP_HIDDEN_DATE_KEY,
  APP_POPUP_SESSION_CLOSED_KEY,
  isActivePopupImageReady,
  isAppPopupSuppressed,
  koreaDateKey,
  popupActiveSlideIndex,
  popupPlacementForPath,
  popupSlideIndex,
} from "@/ui/shared/appPopupState";
import styles from "./appPopup.module.css";

function popupStorage() {
  try {
    return {
      hiddenDate: localStorage.getItem(APP_POPUP_HIDDEN_DATE_KEY),
      sessionClosed:
        sessionStorage.getItem(APP_POPUP_SESSION_CLOSED_KEY) === "1",
    };
  } catch {
    return { hiddenDate: null, sessionClosed: false };
  }
}

export function AppPopupHost() {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const placement = popupPlacementForPath(pathname);
  const [popups, setPopups] = useState<AppPopupDto[]>([]);
  const [popupsPlacement, setPopupsPlacement] =
    useState<AppPopupPlacement | null>(null);
  const [imageErrorIds, setImageErrorIds] = useState<Set<string>>(new Set());
  const [loadedImageIds, setLoadedImageIds] = useState<Set<string>>(new Set());
  const [activeSlide, setActiveSlide] = useState(0);
  const visiblePopups =
    placement === popupsPlacement
      ? popups.filter((popup) => !imageErrorIds.has(popup.id))
      : [];
  const currentSlide = popupActiveSlideIndex(activeSlide, visiblePopups.length);
  const isCurrentImageReady = isActivePopupImageReady(
    loadedImageIds,
    visiblePopups,
    currentSlide,
  );

  const markImageError = (id: string) =>
    setImageErrorIds((ids) => new Set(ids).add(id));

  const markImageReady = (id: string, image: HTMLImageElement) => {
    try {
      const decoding = image.decode?.();
      if (!decoding) {
        setLoadedImageIds((ids) => new Set(ids).add(id));
        return;
      }
      void decoding
        .then(() => setLoadedImageIds((ids) => new Set(ids).add(id)))
        .catch(() => markImageError(id));
    } catch {
      markImageError(id);
    }
  };

  const close = (sessionClosed = false) => {
    if (sessionClosed) {
      try {
        sessionStorage.setItem(APP_POPUP_SESSION_CLOSED_KEY, "1");
      } catch {}
    }
    dialogRef.current?.close();
    setPopups([]);
    setPopupsPlacement(null);
  };

  useEffect(() => {
    queueMicrotask(() => {
      setPopups([]);
      setPopupsPlacement(null);
      setImageErrorIds(new Set());
      setLoadedImageIds(new Set());
      setActiveSlide(0);
      if (carouselRef.current) carouselRef.current.scrollLeft = 0;
    });
    if (!placement) return;
    const { hiddenDate, sessionClosed } = popupStorage();
    if (isAppPopupSuppressed(hiddenDate, sessionClosed)) return;

    const controller = new AbortController();
    void fetchAppPopups(placement, controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) {
          setImageErrorIds(new Set());
          setLoadedImageIds(new Set());
          setActiveSlide(0);
          setPopups(items);
          setPopupsPlacement(placement);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setPopups([]);
          setPopupsPlacement(null);
        }
      });

    return () => controller.abort();
  }, [placement]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (visiblePopups.length === 0) {
      dialog.close();
      return;
    }
    if (!dialog.open) dialog.showModal();
  }, [visiblePopups.length]);

  useEffect(() => {
    const nextSlide = currentSlide;
    if (nextSlide === activeSlide) return;

    if (carouselRef.current)
      carouselRef.current.scrollLeft =
        carouselRef.current.clientWidth * nextSlide;
    queueMicrotask(() => setActiveSlide(nextSlide));
  }, [activeSlide, currentSlide]);

  if (visiblePopups.length === 0) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-label="안내 팝업"
      className={styles.dialog}
      onCancel={(event) => {
        event.preventDefault();
        close(true);
      }}
    >
      <div
        ref={carouselRef}
        className={styles.carousel}
        onScroll={(event) =>
          setActiveSlide(
            popupSlideIndex(
              event.currentTarget.scrollLeft,
              event.currentTarget.clientWidth,
              visiblePopups.length,
            ),
          )
        }
      >
        {visiblePopups.map((popup, index) => {
          const isReady = loadedImageIds.has(popup.id);
          const isCurrentSlide = currentSlide === index;
          const image = (
            <img
              className={isReady ? styles.imageReady : undefined}
              src={popup.imageUrl}
              alt={popup.imageAlt}
              onLoad={(event) => markImageReady(popup.id, event.currentTarget)}
              onError={() => markImageError(popup.id)}
            />
          );

          return (
            <div
              className={styles.slide}
              key={popup.id}
              aria-hidden={index !== currentSlide}
              inert={index !== currentSlide}
            >
              <div
                className={styles.mediaFrame}
                aria-busy={isCurrentSlide && !isReady}
              >
                {!isReady && (
                  <p
                    className={styles.skeleton}
                    aria-hidden={!isCurrentSlide}
                    role={isCurrentSlide ? "status" : undefined}
                  >
                    이미지를 불러오는 중
                  </p>
                )}
                {popup.href ? (
                  <a
                    className={styles.mediaLink}
                    href={popup.href}
                    aria-label={`${popup.imageAlt} 열기`}
                    onClick={() => close(true)}
                  >
                    {image}
                  </a>
                ) : (
                  image
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className={styles.counter} aria-live="polite">
        {currentSlide + 1} / {visiblePopups.length}
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          disabled={!isCurrentImageReady}
          onClick={() => {
            try {
              localStorage.setItem(APP_POPUP_HIDDEN_DATE_KEY, koreaDateKey());
            } catch {}
            close();
          }}
        >
          오늘 그만 보기
        </button>
        <button type="button" onClick={() => close(true)}>
          닫기
        </button>
      </div>
    </dialog>
  );
}
