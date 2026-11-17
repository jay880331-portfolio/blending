"use client";

import Image from "next/image";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cropImageFile } from "./imageCropFile";
import {
  createCropState,
  fitAspectWithin,
  getCropAspectRatio,
  getCropRect,
  getMaxCropZoom,
  getPreviewPlacement,
  isUntouchedOriginal,
  MAX_CROP_ZOOM,
  panCropState,
  replaceCroppableFiles,
  setCropAspectForAll,
  zoomCropStateAtPoint,
  type CropAspect,
  type CropDraft,
  type CropPoint,
  type ImageSize,
} from "./imageCrop";

export type ImageCropEditorProps = {
  files: File[];
  onCancel: () => void;
  onComplete: (files: File[]) => void;
  fixedAspect?: CropAspect;
  touchOnly?: boolean;
  cropGuideShape?: "circle";
};

type Entry = { file: File; url: string; width: number; height: number };
const RATIO_OPTIONS: {
  value: CropAspect;
  label: string;
  ariaLabel: string;
}[] = [
  { value: "original", label: "원본", ariaLabel: "원본 비율" },
  { value: "square", label: "1:1", ariaLabel: "1대1 비율" },
  { value: "portrait", label: "세로", ariaLabel: "세로 4대5 비율" },
  { value: "landscape", label: "가로", ariaLabel: "가로 1.91대1 비율" },
];

const isCroppableFile = (file: File) =>
  file.type === "image/jpeg" || file.type === "image/png";

export function shouldShowCropAspectPicker(fixedAspect?: CropAspect) {
  return !fixedAspect;
}

export function shouldShowCropZoomSlider(touchOnly = false) {
  return !touchOnly;
}

export function shouldShowCircularCropGuide(cropGuideShape?: "circle") {
  return cropGuideShape === "circle";
}

export function ImageCropEditor({
  files,
  onCancel,
  onComplete,
  fixedAspect,
  touchOnly,
  cropGuideShape,
}: ImageCropEditorProps): ReactNode {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [drafts, setDrafts] = useState<CropDraft[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [frame, setFrame] = useState<ImageSize>({ width: 0, height: 0 });
  const [adjusting, setAdjusting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, CropPoint>());
  const cancelledRef = useRef(false);

  useEffect(() => {
    const urls = files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    let cancelled = false;
    Promise.all(
      urls.map(
        ({ file, url }, index) =>
          new Promise<Entry>((resolve, reject) => {
            const image = new window.Image();
            image.onload = () =>
              resolve({
                file,
                url,
                width: image.naturalWidth,
                height: image.naturalHeight,
              });
            image.onerror = () =>
              reject(
                new Error(
                  `${index + 1}번째 선택 이미지(${file.name})를 불러오지 못했습니다.`,
                ),
              );
            image.src = url;
          }),
      ),
    )
      .then((loaded) => {
        if (cancelled) return;
        setEntries(loaded);
        setDrafts(
          loaded.map((entry) => ({
            aspect: fixedAspect ?? "original",
            state: createCropState(entry),
          })),
        );
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(
            reason instanceof Error
              ? reason.message
              : "이미지를 불러오지 못했습니다.",
          );
      });
    return () => {
      cancelled = true;
      urls.forEach(({ url }) => URL.revokeObjectURL(url));
    };
  }, [files, fixedAspect]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const inertSiblings = Array.from(document.body.children)
      .filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && element !== dialog,
      )
      .map((element) => ({ element, inert: element.inert }));
    document.body.style.overflow = "hidden";
    inertSiblings.forEach(({ element }) => {
      element.inert = true;
    });
    cancelButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      inertSiblings.forEach(({ element, inert }) => {
        element.inert = inert;
      });
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () =>
      setFrame({
        width: container.clientWidth - 32,
        height: container.clientHeight - 32,
      });
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    measure();
    return () => observer.disconnect();
  }, []);

  const ready =
    entries.length === files.length &&
    entries.every((entry, index) => entry.file === files[index]);
  const currentIndex = Math.min(activeIndex, Math.max(entries.length - 1, 0));
  const activeEntry = entries[currentIndex];
  const activeDraft = drafts[currentIndex];
  const image = activeEntry
    ? { width: activeEntry.width, height: activeEntry.height }
    : undefined;
  const frameSize =
    image && activeDraft && frame.width > 0 && frame.height > 0
      ? fitAspectWithin(frame, getCropAspectRatio(activeDraft.aspect, image))
      : { width: 0, height: 0 };
  const rect =
    image && activeDraft
      ? getCropRect(image, activeDraft.aspect, activeDraft.state)
      : undefined;
  const placement =
    image && rect && frameSize.width
      ? getPreviewPlacement(image, frameSize, rect)
      : undefined;
  const previewScale = placement && image ? placement.width / image.width : 1;
  const maxZoom =
    image && activeDraft
      ? getMaxCropZoom(image, activeDraft.aspect)
      : MAX_CROP_ZOOM;
  const updateDraft = useCallback(
    (next: CropDraft) =>
      setDrafts((current) =>
        current.map((draft, index) => (index === currentIndex ? next : draft)),
      ),
    [currentIndex],
  );
  const setAspect = (aspect: CropAspect) =>
    setDrafts((current) => setCropAspectForAll(entries, current, aspect));
  const setZoom = (zoom: number) => {
    if (!image || !activeDraft) return;
    updateDraft({
      ...activeDraft,
      state: zoomCropStateAtPoint(
        image,
        activeDraft.aspect,
        activeDraft.state,
        zoom,
        { x: 0.5, y: 0.5 },
      ),
    });
  };
  const point = (event: React.PointerEvent) => {
    const bounds = frameRef.current?.getBoundingClientRect();
    return {
      x: event.clientX - (bounds?.left ?? 0),
      y: event.clientY - (bounds?.top ?? 0),
    };
  };
  const distance = (a: CropPoint, b: CropPoint) =>
    Math.hypot(a.x - b.x, a.y - b.y);
  const midpoint = (a: CropPoint, b: CropPoint) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, point(event));
    setAdjusting(true);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous || !image || !activeDraft) return;
    const next = point(event);
    const current = new Map(pointers.current);
    const values = [...current.values()];
    if (values.length === 1)
      updateDraft({
        ...activeDraft,
        state: panCropState(
          image,
          activeDraft.aspect,
          activeDraft.state,
          { x: next.x - previous.x, y: next.y - previous.y },
          previewScale,
        ),
      });
    else {
      const other = values.find(
        (_, index) => [...current.keys()][index] !== event.pointerId,
      )!;
      const beforeMid = midpoint(previous, other),
        afterMid = midpoint(next, other);
      const zoomed = zoomCropStateAtPoint(
        image,
        activeDraft.aspect,
        activeDraft.state,
        activeDraft.state.zoom *
          (distance(next, other) / distance(previous, other)),
        { x: beforeMid.x / frameSize.width, y: beforeMid.y / frameSize.height },
      );
      updateDraft({
        ...activeDraft,
        state: panCropState(
          image,
          activeDraft.aspect,
          zoomed,
          { x: afterMid.x - beforeMid.x, y: afterMid.y - beforeMid.y },
          previewScale * (zoomed.zoom / activeDraft.state.zoom),
        ),
      });
    }
    pointers.current.set(event.pointerId, next);
  };
  const onPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) setAdjusting(false);
  };
  const cancel = () => {
    cancelledRef.current = true;
    onCancel();
  };
  const onFrameKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!image || !activeDraft) return;
    const delta =
      event.key === "ArrowLeft"
        ? { x: -16, y: 0 }
        : event.key === "ArrowRight"
          ? { x: 16, y: 0 }
          : event.key === "ArrowUp"
            ? { x: 0, y: -16 }
            : event.key === "ArrowDown"
              ? { x: 0, y: 16 }
              : undefined;

    if (delta) {
      event.preventDefault();
      setAdjusting(true);
      updateDraft({
        ...activeDraft,
        state: panCropState(
          image,
          activeDraft.aspect,
          activeDraft.state,
          delta,
          previewScale,
        ),
      });
      return;
    }

    if (
      event.key === "+" ||
      event.key === "=" ||
      event.key === "Add" ||
      event.key === "-" ||
      event.key === "Subtract"
    ) {
      event.preventDefault();
      setAdjusting(true);
      updateDraft({
        ...activeDraft,
        state: zoomCropStateAtPoint(
          image,
          activeDraft.aspect,
          activeDraft.state,
          activeDraft.state.zoom *
            (event.key === "-" || event.key === "Subtract" ? 0.9 : 1.1),
          { x: 0.5, y: 0.5 },
        ),
      });
    }
  };
  const onDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (
      event.shiftKey
        ? document.activeElement === first
        : document.activeElement === last
    ) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  };
  const complete = async () => {
    if (!ready || processing) return;
    cancelledRef.current = false;
    setProcessing(true);
    setError("");
    try {
      const croppedFiles = await entries.reduce(
        async (result, entry, index) => {
          const files = await result;
          const draft = drafts[index];
          return [
            ...files,
            isUntouchedOriginal(draft.aspect, draft.state)
              ? entry.file
              : await cropImageFile(
                  entry.file,
                  getCropRect(entry, draft.aspect, draft.state),
                ),
          ];
        },
        Promise.resolve([] as File[]),
      );
      if (!cancelledRef.current) onComplete(croppedFiles);
    } catch (reason) {
      if (!cancelledRef.current)
        setError(
          reason instanceof Error
            ? reason.message
            : "이미지 변환에 실패했습니다.",
        );
    } finally {
      if (!cancelledRef.current) setProcessing(false);
    }
  };
  if (typeof document === "undefined") return null;
  const imageStyle = placement
    ? {
        left: placement.x,
        top: placement.y,
        width: placement.width,
        height: placement.height,
      }
    : undefined;
  const frameStyle = { width: frameSize.width, height: frameSize.height };
  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="이미지 영역 편집"
      className="fixed inset-0 z-[110] flex flex-col bg-[var(--surface)]"
      onKeyDown={onDialogKeyDown}
    >
      <header className="border-b border-[var(--border)] pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 items-center justify-between px-4">
          <button
            ref={cancelButtonRef}
            type="button"
            className="min-h-11 min-w-11 px-3"
            onClick={cancel}
          >
            취소
          </button>
          <span>
            {currentIndex + 1}/{entries.length}
          </span>
          <button
            type="button"
            className="min-h-11 min-w-11 px-3"
            disabled={!ready || processing}
            onClick={complete}
          >
            완료
          </button>
        </div>
      </header>
      <main
        ref={containerRef}
        className="flex min-h-0 flex-1 items-center justify-center bg-[var(--fg)] p-4"
      >
        <div
          ref={frameRef}
          tabIndex={0}
          aria-label="크롭 영역. 화살표 키로 이동하고 더하기와 빼기 키로 확대하거나 축소합니다."
          className="relative cursor-grab overflow-hidden bg-[var(--fg)] outline outline-1 outline-[var(--surface)] touch-none active:cursor-grabbing"
          style={frameStyle}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onKeyDown={onFrameKeyDown}
          onKeyUp={() => setAdjusting(false)}
        >
          {activeEntry && imageStyle ? (
            <Image
              alt=""
              src={activeEntry.url}
              width={activeEntry.width}
              height={activeEntry.height}
              unoptimized
              className="pointer-events-none absolute max-w-none select-none"
              style={imageStyle}
              draggable={false}
            />
          ) : null}
          {shouldShowCircularCropGuide(cropGuideShape) ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full border border-[var(--surface)] shadow-[0_0_0_9999px_color-mix(in_srgb,var(--fg)_55%,transparent)]"
            />
          ) : null}
          {adjusting ? (
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <span className="absolute inset-y-0 left-1/3 w-px bg-[var(--surface)] opacity-70" />
              <span className="absolute inset-y-0 left-2/3 w-px bg-[var(--surface)] opacity-70" />
              <span className="absolute inset-x-0 top-1/3 h-px bg-[var(--surface)] opacity-70" />
              <span className="absolute inset-x-0 top-2/3 h-px bg-[var(--surface)] opacity-70" />
            </div>
          ) : null}
        </div>
      </main>
      {shouldShowCropZoomSlider(touchOnly) ? (
        <div className="bg-[var(--surface)] px-6 pt-3">
          <input
            type="range"
            min={1}
            max={maxZoom}
            step={0.01}
            value={activeDraft?.state.zoom ?? 1}
            aria-label="이미지 확대 축소"
            className="h-11 w-full cursor-pointer accent-[var(--accent)]"
            disabled={!activeDraft || maxZoom <= 1}
            onChange={(event) => setZoom(Number(event.target.value))}
            onPointerDown={() => setAdjusting(true)}
            onPointerUp={() => setAdjusting(false)}
            onPointerCancel={() => setAdjusting(false)}
            onKeyDown={() => setAdjusting(true)}
            onKeyUp={() => setAdjusting(false)}
          />
        </div>
      ) : (
        <p className="bg-[var(--surface)] px-6 pt-3 text-center text-[13px] text-[var(--fg-muted)]">
          한 손가락으로 이동 · 두 손가락으로 확대/축소
        </p>
      )}
      <nav
        aria-label="편집할 이미지 선택"
        className="flex gap-2 overflow-x-auto px-4 py-3"
      >
        {entries.map((entry, index) => (
          <button
            type="button"
            className={`min-h-11 min-w-11 ${index === currentIndex ? "outline outline-2 outline-[var(--accent)] outline-offset-2" : ""}`}
            aria-current={index === currentIndex ? "true" : undefined}
            aria-label={`${index + 1}번째 이미지 편집`}
            key={entry.url}
            onClick={() => setActiveIndex(index)}
          >
            <Image
              alt=""
              src={entry.url}
              width={48}
              height={48}
              unoptimized
              className="h-12 w-12 object-cover"
            />
          </button>
        ))}
      </nav>
      <footer className="pb-[calc(var(--app-safe-area-bottom)+16px)]">
        {shouldShowCropAspectPicker(fixedAspect) ? (
          <div
            role="group"
            aria-label="이미지 비율 선택"
            className="grid grid-cols-4 gap-2 px-4"
          >
            {RATIO_OPTIONS.map((option) => (
              <button
                type="button"
                className={`min-h-11 min-w-11 ${activeDraft?.aspect === option.value ? "bg-[var(--accent)] text-[var(--surface)]" : ""}`}
                key={option.value}
                aria-label={option.ariaLabel}
                aria-pressed={activeDraft?.aspect === option.value}
                onClick={() => setAspect(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="px-4 pt-2 text-[13px] text-[var(--danger)]"
          >
            {error}
          </p>
        ) : null}
      </footer>
    </div>,
    document.body,
  );
}

export function useImageCropFlow(
  onComplete: (files: File[]) => void,
  options?: {
    fixedAspect?: CropAspect;
    touchOnly?: boolean;
    cropGuideShape?: "circle";
  },
): {
  startImageCrop: (files: File[]) => void;
  imageCropEditor: ReactNode;
} {
  const [selection, setSelection] = useState<
    { selectedFiles: File[]; croppableFiles: File[] } | undefined
  >();
  const startImageCrop = useCallback(
    (files: File[]) => {
      const croppableFiles = files.filter(isCroppableFile);
      if (croppableFiles.length)
        setSelection({ selectedFiles: files, croppableFiles });
      else onComplete(files);
    },
    [onComplete],
  );
  return {
    startImageCrop,
    imageCropEditor: selection ? (
      <ImageCropEditor
        files={selection.croppableFiles}
        fixedAspect={options?.fixedAspect}
        touchOnly={options?.touchOnly}
        cropGuideShape={options?.cropGuideShape}
        onCancel={() => setSelection(undefined)}
        onComplete={(croppedImages) => {
          onComplete(
            replaceCroppableFiles(selection.selectedFiles, croppedImages),
          );
          setSelection(undefined);
        }}
      />
    ) : null,
  };
}
