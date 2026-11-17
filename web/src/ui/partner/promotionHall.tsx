"use client";

import Image from "next/image";
import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { partnerPromotionPdfDownloadPath } from "@/domain/partner/promotionAttachmentUrl";
import type { PartnerAttachment } from "@/domain/partner/types";

export {
  addDaysIso,
  formatPublishDate,
  isPdfAttachment,
  promotionImageUrls,
  promotionPublishState,
  toDateInputValue,
} from "@/domain/partner/promotionPublish";

function cn(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

export function PromotionKindTag({
  kind,
  imageCount,
}: {
  kind: "pdf" | "image";
  imageCount?: number;
}) {
  if (kind === "pdf") {
    return (
      <span className="rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] px-1.5 py-0.5 text-[11px] font-bold leading-none text-[var(--danger)]">
        PDF
      </span>
    );
  }
  return (
    <span className="rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--info)_12%,transparent)] px-1.5 py-0.5 text-[11px] font-bold leading-none text-[var(--info)]">
      이미지{imageCount ? ` ${imageCount}` : ""}
    </span>
  );
}

export function PromotionImageGallery({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);
  const [naturalMap, setNaturalMap] = useState<
    Record<string, { width: number; height: number }>
  >({});
  const current =
    images.length > 0
      ? (images[Math.min(index, images.length - 1)] ?? images[0])
      : "";
  const natural = current ? naturalMap[current] : undefined;

  if (images.length === 0 || !current) return null;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[16px] font-bold text-[var(--fg-strong)]">
          홍보 자료
        </h2>
        <span className="text-[12px] font-bold text-[var(--fg-muted)]">
          {index + 1} / {images.length}
        </span>
      </div>
      <div className="w-full overflow-hidden rounded-[var(--radius-lg)] bg-[var(--surface-alt)]">
        <Image
          key={current}
          src={current}
          alt=""
          width={natural?.width ?? 1200}
          height={natural?.height ?? 800}
          sizes="100vw"
          className="h-auto w-full"
          onLoadingComplete={(image) =>
            setNaturalMap((prev) => ({
              ...prev,
              [current]: {
                width: image.naturalWidth,
                height: image.naturalHeight,
              },
            }))
          }
        />
      </div>
      {images.length > 1 ? (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((image, imageIndex) => (
            <button
              key={`${image}-${imageIndex}`}
              type="button"
              aria-label={`${imageIndex + 1}번째 이미지`}
              aria-current={imageIndex === index}
              onClick={() => setIndex(imageIndex)}
              className={cn(
                "h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border-2",
                imageIndex === index
                  ? "border-[var(--fg)]"
                  : "border-transparent",
              )}
            >
              <Image
                src={image}
                alt=""
                width={56}
                height={56}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function PromotionPdfViewer({
  attachment,
}: {
  attachment: PartnerAttachment;
}) {
  const downloadPath = partnerPromotionPdfDownloadPath(
    attachment.url,
    attachment.name,
  );

  return (
    <section>
      <a
        href={downloadPath}
        download={attachment.name}
        className="grid grid-cols-[36px_minmax(0,1fr)_28px] items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-strong)] px-4 py-3 text-[var(--fg)]"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-alt)] text-[var(--fg-muted)]">
          <FileText size={19} strokeWidth={1.8} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-bold leading-[1.4]">
            {attachment.name}
          </span>
        </span>
        <Download
          size={18}
          strokeWidth={1.8}
          className="text-[var(--fg-muted)]"
        />
      </a>
    </section>
  );
}

export function PromotionPeriodChips({
  selectedDays,
  onSelect,
}: {
  selectedDays: 7 | 14 | 30 | "custom";
  onSelect: (days: 7 | 14 | 30 | "custom") => void;
}) {
  const options: Array<{ value: 7 | 14 | 30 | "custom"; label: string }> = [
    { value: 7, label: "7일" },
    { value: 14, label: "14일" },
    { value: 30, label: "30일" },
    { value: "custom", label: "직접 선택" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.label}
          type="button"
          onClick={() => onSelect(option.value)}
          className={cn(
            "rounded-[var(--radius-pill)] border px-3 py-1.5 text-[12px] font-medium",
            selectedDays === option.value
              ? "border-[var(--fg)] bg-[var(--fg)] font-bold text-[var(--surface)]"
              : "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--fg-muted)]",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
