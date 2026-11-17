"use client";

import Image from "next/image";
import type {
  CSSProperties,
  ReactNode,
  TouchEvent,
  TouchList as ReactTouchList,
} from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getNearestCommunityImageSlideIndex,
  visibleCommunityImages,
} from "@/ui/community/communityImageSlider";

function cn(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

const MIN_IMAGE_SCALE = 1;
const MAX_IMAGE_SCALE = 4;

type ZoomState = {
  scale: number;
  x: number;
  y: number;
};

type GestureState =
  | {
      mode: "pinch";
      distance: number;
      scale: number;
      x: number;
      y: number;
      centerX: number;
      centerY: number;
    }
  | {
      mode: "pan";
      touchX: number;
      touchY: number;
      x: number;
      y: number;
    };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getTouchDistance(touches: ReactTouchList) {
  const first = touches[0];
  const second = touches[1];
  return Math.hypot(
    first.clientX - second.clientX,
    first.clientY - second.clientY,
  );
}

function getTouchCenter(touches: ReactTouchList) {
  const first = touches[0];
  const second = touches[1];
  return {
    x: (first.clientX + second.clientX) / 2,
    y: (first.clientY + second.clientY) / 2,
  };
}

function normalizeZoom(container: HTMLDivElement | null, nextZoom: ZoomState) {
  if (!container || nextZoom.scale <= MIN_IMAGE_SCALE) {
    return { scale: MIN_IMAGE_SCALE, x: 0, y: 0 };
  }

  const maxX = (container.clientWidth * (nextZoom.scale - 1)) / 2;
  const maxY = (container.clientHeight * (nextZoom.scale - 1)) / 2;

  return {
    scale: nextZoom.scale,
    x: clamp(nextZoom.x, -maxX, maxX),
    y: clamp(nextZoom.y, -maxY, maxY),
  };
}

function ZoomableImage({
  image,
  priority,
  square,
}: {
  image: string;
  priority: boolean;
  square?: boolean;
}) {
  const [imageSize, setImageSize] = useState({ width: 4, height: 3 });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fullscreenRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<GestureState | null>(null);
  const [zoom, setZoom] = useState<ZoomState>({
    scale: MIN_IMAGE_SCALE,
    x: 0,
    y: 0,
  });
  const [fullscreen, setFullscreen] = useState(false);

  const updateZoom = (nextZoom: ZoomState) => {
    setZoom(
      normalizeZoom(fullscreenRef.current ?? containerRef.current, nextZoom),
    );
  };

  const resetZoom = () => {
    gestureRef.current = null;
    setFullscreen(false);
    setZoom({ scale: MIN_IMAGE_SCALE, x: 0, y: 0 });
  };

  useEffect(() => {
    if (!fullscreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [fullscreen]);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      event.preventDefault();
      const center = getTouchCenter(event.touches);
      setFullscreen(true);
      gestureRef.current = {
        mode: "pinch",
        distance: getTouchDistance(event.touches),
        scale: zoom.scale,
        x: zoom.x,
        y: zoom.y,
        centerX: center.x,
        centerY: center.y,
      };
      return;
    }

    if (event.touches.length === 1 && zoom.scale > MIN_IMAGE_SCALE) {
      gestureRef.current = {
        mode: "pan",
        touchX: event.touches[0].clientX,
        touchY: event.touches[0].clientY,
        x: zoom.x,
        y: zoom.y,
      };
    }
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture) return;

    if (gesture.mode === "pinch" && event.touches.length === 2) {
      event.preventDefault();
      const center = getTouchCenter(event.touches);
      updateZoom({
        scale: clamp(
          (gesture.scale * getTouchDistance(event.touches)) / gesture.distance,
          MIN_IMAGE_SCALE,
          MAX_IMAGE_SCALE,
        ),
        x: gesture.x + center.x - gesture.centerX,
        y: gesture.y + center.y - gesture.centerY,
      });
      return;
    }

    if (gesture.mode === "pan" && event.touches.length === 1) {
      event.preventDefault();
      updateZoom({
        scale: zoom.scale,
        x: gesture.x + event.touches[0].clientX - gesture.touchX,
        y: gesture.y + event.touches[0].clientY - gesture.touchY,
      });
    }
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (fullscreen || event.touches.length < 2) {
      resetZoom();
      return;
    }

    gestureRef.current = null;
  };

  const imageStyle = {
    transform: `translate3d(${zoom.x}px, ${zoom.y}px, 0) scale(${zoom.scale})`,
  } satisfies CSSProperties;

  return (
    <div
      ref={containerRef}
      data-allow-image-zoom
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className={cn(
        "relative w-full select-none overflow-hidden",
        zoom.scale > MIN_IMAGE_SCALE ? "cursor-grab touch-none" : "touch-auto",
      )}
      style={{
        aspectRatio: square
          ? "1 / 1"
          : `${imageSize.width} / ${imageSize.height}`,
      }}
    >
      <Image
        src={image}
        alt=""
        fill
        priority={priority}
        sizes="(max-width: 768px) 100vw, 768px"
        className="object-contain transition-transform duration-150 ease-out"
        draggable={false}
        onLoad={(event) =>
          setImageSize({
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight,
          })
        }
        style={imageStyle}
      />
      {fullscreen
        ? createPortal(
            <div
              ref={fullscreenRef}
              data-allow-image-zoom
              role="dialog"
              aria-modal="true"
              aria-label="확대 이미지"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={resetZoom}
              className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black/95 touch-none"
            >
              <div className="relative h-full w-full">
                <Image
                  src={image}
                  alt=""
                  fill
                  priority={priority}
                  sizes="100vw"
                  className="object-contain transition-transform duration-150 ease-out"
                  draggable={false}
                  style={imageStyle}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function ImageDetailSlider({
  images,
  square = false,
  overlay,
  className,
  maxImages,
}: {
  images: string[];
  square?: boolean;
  overlay?: ReactNode;
  className?: string;
  maxImages?: number;
}) {
  const visibleImages = visibleCommunityImages(images, maxImages);
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  if (visibleImages.length === 0) return null;

  const updateActiveIndex = () => {
    const slider = sliderRef.current;
    if (!slider) return;

    const offsets = Array.from(slider.children).map(
      (child) => (child as HTMLElement).offsetLeft,
    );
    setActiveIndex(
      getNearestCommunityImageSlideIndex(slider.scrollLeft, offsets),
    );
  };

  const scrollToImage = (index: number) => {
    const slider = sliderRef.current;
    const target = slider?.children[index] as HTMLElement | undefined;
    if (!slider || !target) return;

    slider.scrollTo({ left: target.offsetLeft, behavior: "smooth" });
    setActiveIndex(index);
  };

  return (
    <section className={cn("mt-6", className)}>
      <div
        ref={sliderRef}
        onScroll={updateActiveIndex}
        className="scrollbar-none flex snap-x snap-mandatory scroll-smooth gap-3 overflow-x-auto overscroll-x-contain"
      >
        {visibleImages.map((image, index) => (
          <div
            key={`${image}-${index}`}
            className={cn(
              "relative w-full shrink-0 snap-start snap-always overflow-hidden bg-[var(--surface-alt)]",
              square ? "rounded-none" : "rounded-[var(--radius-lg)]",
            )}
          >
            <ZoomableImage
              image={image}
              priority={index === 0}
              square={square}
            />
            {overlay}
            {visibleImages.length > 1 ? (
              <span className="absolute bottom-3 right-3 rounded-[var(--radius-pill)] bg-[var(--fg)]/70 px-2.5 py-1 text-[12px] font-bold text-white">
                {activeIndex + 1}/{visibleImages.length}
              </span>
            ) : null}
          </div>
        ))}
      </div>
      {visibleImages.length > 1 ? (
        <div
          className="mt-3 flex justify-center gap-1.5"
          aria-label={`이미지 ${activeIndex + 1}/${visibleImages.length}`}
        >
          {visibleImages.map((image, index) => (
            <button
              key={`${image}-dot-${index}`}
              type="button"
              aria-label={`${index + 1}번째 이미지 보기`}
              aria-current={activeIndex === index}
              onClick={() => scrollToImage(index)}
              className={cn(
                "h-1.5 rounded-[var(--radius-pill)] transition-all",
                activeIndex === index
                  ? "w-7 bg-[var(--accent)]"
                  : "w-4 bg-[var(--border-strong)]",
              )}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
