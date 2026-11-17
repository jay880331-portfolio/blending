"use client";

import Image from "next/image";
import { FileText, GripVertical, Plus, X } from "lucide-react";
import {
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

type PreviewImage = {
  id: string;
  name: string;
  url: string;
  contentType?: string;
};

export function ImageAttachmentSection<TImage extends PreviewImage>({
  title = "이미지",
  images,
  limit,
  accept,
  inputName,
  ariaPrefix,
  addLabel = "이미지 첨부",
  countUnit = "장",
  countLabel,
  onAttachImages,
  onOpenNativePicker,
  onRemoveImage,
  onMoveImage,
}: {
  title?: string;
  images: TImage[];
  limit: number;
  accept: string;
  inputName: string;
  ariaPrefix: string;
  addLabel?: string;
  countUnit?: string;
  countLabel?: string;
  onAttachImages: (event: ChangeEvent<HTMLInputElement>) => void;
  onOpenNativePicker?: () => void;
  onRemoveImage: (image: TImage) => void;
  onMoveImage?: (from: number, to: number) => void;
}) {
  const canAttachMore = images.length < limit;
  const [draggingIndex, setDraggingIndex] = useState<number>();
  const [dropTargetIndex, setDropTargetIndex] = useState<number>();
  const dragSourceRef = useRef<number | undefined>(undefined);
  const dropTargetRef = useRef<number | undefined>(undefined);
  const pickerClassName =
    "flex aspect-square cursor-pointer flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-dashed)] bg-[var(--surface-alt)] text-[var(--fg-muted)]";
  const pickerContent = (
    <>
      <Plus size={24} />
      <span className="mt-2 text-[13px]">{addLabel}</span>
    </>
  );
  const startImageDrag = (
    event: PointerEvent<HTMLButtonElement>,
    index: number,
  ) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragSourceRef.current = index;
    dropTargetRef.current = index;
    setDraggingIndex(index);
    setDropTargetIndex(index);
  };
  const updateDropTarget = (event: PointerEvent<HTMLButtonElement>) => {
    const tile = event.currentTarget.ownerDocument
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-image-index]");
    const index = Number(tile?.dataset.imageIndex);

    if (Number.isInteger(index) && index >= 0 && index < images.length) {
      dropTargetRef.current = index;
      setDropTargetIndex(index);
    }
  };
  const finishImageDrag = () => {
    const from = dragSourceRef.current;
    const to = dropTargetRef.current;

    if (from !== undefined && to !== undefined && from !== to) {
      onMoveImage?.(from, to);
    }
    dragSourceRef.current = undefined;
    dropTargetRef.current = undefined;
    setDraggingIndex(undefined);
    setDropTargetIndex(undefined);
  };

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[var(--fg-strong)]">
          {title}
        </h2>
        <span className="shrink-0 rounded-[var(--radius-pill)] border border-[var(--border-strong)] px-3 py-1 text-[12px] font-bold text-[var(--fg-muted)]">
          {countLabel ?? `선택 ${images.length}/${limit}${countUnit}`}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {images.map((image, index) => (
          <ImagePreviewTile
            key={image.id}
            image={image}
            label={index === 0 ? "대표 첨부 파일 삭제" : "첨부 파일 삭제"}
            badge={index === 0 ? "대표" : undefined}
            onRemove={() => onRemoveImage(image)}
            index={onMoveImage ? index : undefined}
            isDragging={draggingIndex === index}
            isDropTarget={draggingIndex !== index && dropTargetIndex === index}
            sortHandle={
              onMoveImage ? (
                <ImageSortHandle
                  index={index}
                  imageCount={images.length}
                  onMoveImage={onMoveImage}
                  onPointerDown={(event) => startImageDrag(event, index)}
                  onPointerMove={updateDropTarget}
                  onPointerUp={finishImageDrag}
                  onPointerCancel={finishImageDrag}
                  onLostPointerCapture={finishImageDrag}
                />
              ) : undefined
            }
          />
        ))}
        {canAttachMore ? (
          onOpenNativePicker ? (
            <>
              <button
                type="button"
                aria-label={`${ariaPrefix} 이미지 추가`}
                className={pickerClassName}
                onClick={onOpenNativePicker}
              >
                {pickerContent}
              </button>
              {accept.includes("pdf") ? (
                <label className={pickerClassName}>
                  <input
                    type="file"
                    name={`${inputName}Pdf`}
                    aria-label={`${ariaPrefix} PDF 추가`}
                    accept="application/pdf,.pdf"
                    multiple
                    className="sr-only"
                    onChange={onAttachImages}
                  />
                  <FileText size={24} />
                  <span className="mt-2 text-[13px]">PDF</span>
                </label>
              ) : null}
            </>
          ) : (
            <label className={pickerClassName}>
              <input
                type="file"
                name={inputName}
                aria-label={`${ariaPrefix} 첨부 파일 추가`}
                accept={accept}
                multiple
                className="sr-only"
                onChange={onAttachImages}
              />
              {pickerContent}
            </label>
          )
        ) : null}
      </div>
    </section>
  );
}

export function ImagePreviewTile({
  image,
  label,
  badge,
  onRemove,
  index,
  isDragging = false,
  isDropTarget = false,
  sortHandle,
}: {
  image: PreviewImage;
  label: string;
  badge?: string;
  onRemove: () => void;
  index?: number;
  isDragging?: boolean;
  isDropTarget?: boolean;
  sortHandle?: ReactNode;
}) {
  const isImage = image.contentType?.startsWith("image/") ?? true;
  const stateClassName = isDragging
    ? "opacity-60"
    : isDropTarget
      ? "ring-2 ring-[var(--accent)] ring-offset-2"
      : "";

  return (
    <div
      data-image-index={index}
      className={`relative aspect-square overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-alt)]${stateClassName ? ` ${stateClassName}` : ""}`}
    >
      {isImage ? (
        <Image
          src={image.url}
          alt=""
          fill
          unoptimized
          sizes="20vw"
          className="object-cover"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center px-3 text-center text-[var(--fg-muted)]">
          <FileText size={26} strokeWidth={1.8} />
          <span className="mt-2 line-clamp-2 text-[11px] leading-[1.35]">
            {image.name}
          </span>
        </div>
      )}
      {badge ? (
        <span className="absolute left-1.5 top-1.5 rounded-[var(--radius-sm)] bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      ) : null}
      {sortHandle}
      <button
        type="button"
        aria-label={label}
        onClick={onRemove}
        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--fg)]/70 text-white"
      >
        <X size={13} />
      </button>
    </div>
  );
}

function ImageSortHandle({
  index,
  imageCount,
  onMoveImage,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
}: {
  index: number;
  imageCount: number;
  onMoveImage: (from: number, to: number) => void;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onLostPointerCapture: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`${index + 1}번째 사진 순서 변경`}
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onLostPointerCapture}
      onKeyDown={(event) => {
        const offset =
          event.key === "ArrowLeft" || event.key === "ArrowUp"
            ? -1
            : event.key === "ArrowRight" || event.key === "ArrowDown"
              ? 1
              : 0;
        const nextIndex = index + offset;

        if (!offset || nextIndex < 0 || nextIndex >= imageCount) return;
        event.preventDefault();
        onMoveImage(index, nextIndex);
      }}
      className="absolute bottom-1.5 left-1.5 z-10 flex h-8 w-8 touch-none cursor-grab items-center justify-center rounded-[var(--radius-pill)] bg-[var(--fg)]/70 text-white active:cursor-grabbing"
    >
      <GripVertical size={16} aria-hidden />
    </button>
  );
}
