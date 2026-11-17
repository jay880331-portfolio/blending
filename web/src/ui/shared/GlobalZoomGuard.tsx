"use client";

import { useEffect } from "react";

const IMAGE_ZOOM_SELECTOR = "[data-allow-image-zoom]";

function isImageZoomEventTarget(target: EventTarget | null) {
  return (
    target instanceof Element && Boolean(target.closest(IMAGE_ZOOM_SELECTOR))
  );
}

export function GlobalZoomGuard() {
  useEffect(() => {
    const preventBrowserZoom = (event: Event) => {
      if (isImageZoomEventTarget(event.target)) return;
      event.preventDefault();
    };

    const preventCtrlWheelZoom = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      preventBrowserZoom(event);
    };

    const preventMultiTouchZoom = (event: TouchEvent) => {
      if (event.touches.length < 2) return;
      preventBrowserZoom(event);
    };

    document.addEventListener("wheel", preventCtrlWheelZoom, {
      passive: false,
    });
    document.addEventListener("touchmove", preventMultiTouchZoom, {
      passive: false,
    });
    document.addEventListener("gesturestart", preventBrowserZoom, {
      passive: false,
    });
    document.addEventListener("gesturechange", preventBrowserZoom, {
      passive: false,
    });

    return () => {
      document.removeEventListener("wheel", preventCtrlWheelZoom);
      document.removeEventListener("touchmove", preventMultiTouchZoom);
      document.removeEventListener("gesturestart", preventBrowserZoom);
      document.removeEventListener("gesturechange", preventBrowserZoom);
    };
  }, []);

  return null;
}
