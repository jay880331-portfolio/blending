"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

const ROUTE_LOADING_TIMEOUT_MS = 8000;
const WAIT_FOR_STOP_TIMEOUT_MS = 30000;
const IMAGE_READY_TIMEOUT_MS = 600;
const FONT_READY_TIMEOUT_MS = 600;
const LOADING_COMPLETE_HOLD_MS = 320;
const LOADING_FONT_READY_PROGRESS = 45;
const LOADING_PAINT_READY_PROGRESS = 70;
const LOADING_IMAGE_READY_PROGRESS = 90;
const LOADING_PROGRESS_CAP = 90;
const LOADING_PROGRESS_TICK_MS = 180;
const GLOBAL_LOADING_START_EVENT = "blending:loading-start";
const GLOBAL_LOADING_STOP_EVENT = "blending:loading-stop";

export function startGlobalLoading() {
  window.dispatchEvent(
    new CustomEvent(GLOBAL_LOADING_START_EVENT, {
      detail: { waitForStop: true },
    }),
  );
}

export function stopGlobalLoading() {
  window.dispatchEvent(new Event(GLOBAL_LOADING_STOP_EVENT));
}

function isInternalNavigation(anchor: HTMLAnchorElement) {
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) return false;

  const url = new URL(anchor.href);
  if (url.origin !== window.location.origin) return false;

  return url.href !== window.location.href;
}

export function shouldFinishRouteLoading(
  previousPathname: string,
  pathname: string,
  waitingForStop: boolean,
) {
  return previousPathname !== pathname && !waitingForStop;
}

function primaryFontFamily(fontFamily: string) {
  const name = fontFamily.split(",")[0]?.trim() ?? "";
  return name.replace(/^["']|["']$/g, "");
}

function waitForFontsReady() {
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    window.setTimeout(finish, FONT_READY_TIMEOUT_MS);
    try {
      const fontSet = document.fonts;
      if (!fontSet?.load) {
        finish();
        return;
      }
      const loads: Promise<unknown>[] = [];
      const nodes = [document.body, document.querySelector("h1")];
      for (const node of nodes) {
        if (!(node instanceof HTMLElement)) continue;
        const style = getComputedStyle(node);
        const family = primaryFontFamily(style.fontFamily);
        if (
          !family ||
          family === "sans-serif" ||
          family === "system-ui" ||
          family === "inherit"
        )
          continue;
        const size = style.fontSize || "16px";
        let weight = style.fontWeight || "400";
        if (
          family === "SeoulNamsan" &&
          (weight === "400" || weight === "normal")
        )
          weight = "500";
        loads.push(
          fontSet
            .load(weight + " " + size + ' "' + family + '"')
            .catch(() => undefined),
        );
      }
      void Promise.all(loads).then(finish, finish);
    } catch {
      finish();
    }
  });
}

function waitForCurrentImages() {
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    window.setTimeout(finish, IMAGE_READY_TIMEOUT_MS);
    const images = Array.from(document.images).filter(
      (image) =>
        image.offsetParent !== null &&
        !image.complete &&
        !image.closest(".global-loading-coffee"),
    );
    if (images.length === 0) {
      finish();
      return;
    }
    void Promise.all(
      images.map((image) => {
        if (image.decode) return image.decode().catch(() => undefined);
        return new Promise<void>((res) => {
          image.addEventListener("load", () => res(), { once: true });
          image.addEventListener("error", () => res(), { once: true });
        });
      }),
    ).then(finish, finish);
  });
}

export function GlobalLoadingBar() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [loadingRun, setLoadingRun] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const timeoutRef = useRef<number | null>(null);
  const completeRef = useRef<number | null>(null);
  const progressRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const secondFrameRef = useRef<number | null>(null);
  const waitingForStopRef = useRef(false);
  const stopSequenceRef = useRef(0);
  const previousPathnameRef = useRef(pathname);

  const clearTimers = () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    if (completeRef.current !== null) window.clearTimeout(completeRef.current);
    if (progressRef.current !== null) window.clearInterval(progressRef.current);
    if (frameRef.current !== null)
      window.cancelAnimationFrame(frameRef.current);
    if (secondFrameRef.current !== null)
      window.cancelAnimationFrame(secondFrameRef.current);
    timeoutRef.current = null;
    completeRef.current = null;
    progressRef.current = null;
    frameRef.current = null;
    secondFrameRef.current = null;
  };

  useEffect(() => {
    const keepProgressMoving = () => {
      if (progressRef.current !== null)
        window.clearInterval(progressRef.current);

      progressRef.current = window.setInterval(() => {
        setLoadingProgress((progress) => {
          if (progress >= LOADING_PROGRESS_CAP) return LOADING_PROGRESS_CAP;

          const step = progress < 30 ? 8 : progress < 70 ? 5 : 2;
          return Math.min(progress + step, LOADING_PROGRESS_CAP);
        });
      }, LOADING_PROGRESS_TICK_MS);
    };

    const hideAfterPaint = () => {
      clearTimers();
      const sequence = stopSequenceRef.current + 1;
      stopSequenceRef.current = sequence;

      void waitForFontsReady().then(() => {
        if (stopSequenceRef.current !== sequence) return;
        setLoadingProgress((progress) =>
          Math.max(progress, LOADING_FONT_READY_PROGRESS),
        );

        frameRef.current = window.requestAnimationFrame(() => {
          secondFrameRef.current = window.requestAnimationFrame(() => {
            setLoadingProgress((progress) =>
              Math.max(progress, LOADING_PAINT_READY_PROGRESS),
            );
            setLoadingProgress((progress) =>
              Math.max(progress, LOADING_IMAGE_READY_PROGRESS),
            );

            void waitForCurrentImages().then(() => {
              if (stopSequenceRef.current !== sequence) return;
              setLoadingProgress(100);

              completeRef.current = window.setTimeout(() => {
                if (stopSequenceRef.current !== sequence) return;
                waitingForStopRef.current = false;
                setLoading(false);
              }, LOADING_COMPLETE_HOLD_MS);
            });
          });
        });
      });
    };

    const showLoading = (waitForStop = false) => {
      clearTimers();
      stopSequenceRef.current += 1;
      waitingForStopRef.current = waitForStop;
      setLoadingRun((run) => run + 1);
      setLoadingProgress(0);
      setLoading(true);
      keepProgressMoving();
      timeoutRef.current = window.setTimeout(
        () => {
          if (progressRef.current !== null)
            window.clearInterval(progressRef.current);
          progressRef.current = null;
          waitingForStopRef.current = false;
          setLoadingProgress(100);
          completeRef.current = window.setTimeout(() => {
            setLoading(false);
          }, LOADING_COMPLETE_HOLD_MS);
        },
        waitForStop ? WAIT_FOR_STOP_TIMEOUT_MS : ROUTE_LOADING_TIMEOUT_MS,
      );
    };

    const hideLoading = () => {
      hideAfterPaint();
    };

    const handleGlobalLoadingStart = (event: Event) => {
      const waitForStop =
        event instanceof CustomEvent &&
        event.detail &&
        typeof event.detail === "object" &&
        "waitForStop" in event.detail &&
        event.detail.waitForStop === true;

      showLoading(waitForStop);
    };

    const startLoading = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a");
      if (!anchor || !isInternalNavigation(anchor)) return;

      showLoading();
    };

    document.addEventListener("click", startLoading, true);
    window.addEventListener(
      GLOBAL_LOADING_START_EVENT,
      handleGlobalLoadingStart,
    );
    window.addEventListener(GLOBAL_LOADING_STOP_EVENT, hideLoading);

    return () => {
      document.removeEventListener("click", startLoading, true);
      window.removeEventListener(
        GLOBAL_LOADING_START_EVENT,
        handleGlobalLoadingStart,
      );
      window.removeEventListener(GLOBAL_LOADING_STOP_EVENT, hideLoading);
    };
  }, []);

  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    previousPathnameRef.current = pathname;
    if (
      !shouldFinishRouteLoading(
        previousPathname,
        pathname,
        waitingForStopRef.current,
      )
    )
      return;

    clearTimers();
    const sequence = stopSequenceRef.current + 1;
    stopSequenceRef.current = sequence;
    void waitForFontsReady().then(() => {
      if (stopSequenceRef.current !== sequence) return;
      setLoadingProgress((progress) =>
        Math.max(progress, LOADING_FONT_READY_PROGRESS),
      );

      frameRef.current = window.requestAnimationFrame(() => {
        secondFrameRef.current = window.requestAnimationFrame(() => {
          setLoadingProgress((progress) =>
            Math.max(progress, LOADING_PAINT_READY_PROGRESS),
          );
          setLoadingProgress((progress) =>
            Math.max(progress, LOADING_IMAGE_READY_PROGRESS),
          );

          void waitForCurrentImages().then(() => {
            if (stopSequenceRef.current !== sequence) return;
            setLoadingProgress(100);
            completeRef.current = window.setTimeout(() => {
              if (stopSequenceRef.current !== sequence) return;
              setLoading(false);
            }, LOADING_COMPLETE_HOLD_MS);
          });
        });
      });
    });
  }, [pathname]);

  if (!loading) return null;

  return (
    <>
      <div
        aria-hidden="true"
        className={[
          "global-loading-overlay pointer-events-none fixed inset-0 z-[9999]",
          "backdrop-blur-[6px]",
          "opacity-100",
        ].join(" ")}
      />
      <div
        key={loadingRun}
        aria-hidden="true"
        className="global-loading-coffee pointer-events-none fixed z-[10000]"
        style={
          {
            "--global-loading-progress": loadingProgress,
          } as CSSProperties
        }
      >
        <Image
          src="/images/global-loading-pixel-cup-outline.webp"
          alt=""
          className="global-loading-coffee-image global-loading-coffee-image-base"
          aria-hidden="true"
          width={96}
          height={71}
          priority
          draggable={false}
          sizes="96px"
        />
        <Image
          src="/images/global-loading-pixel-cup-fill.webp"
          alt=""
          className="global-loading-coffee-image global-loading-coffee-image-fill"
          aria-hidden="true"
          width={96}
          height={71}
          priority
          draggable={false}
          sizes="96px"
        />
      </div>
    </>
  );
}
