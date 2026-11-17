"use client";

import { useEffect, useRef } from "react";
import { UPLOAD_IMAGE_SIZE_ERROR_MESSAGE } from "@/adapters/http/uploadApi";

export type AttachedImage = {
  id: string;
  name: string;
  url: string;
  size: number;
  file?: File;
  contentType?: string;
};

export const IMAGE_ACCEPT = "image/jpeg,image/png";

export function createAttachedImage(file: File): AttachedImage {
  return {
    id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
    name: file.name,
    size: file.size,
    url: URL.createObjectURL(file),
    file,
    contentType: file.type,
  };
}

export function attachedImageFiles(images: ReadonlyArray<AttachedImage>) {
  return images.flatMap((image) => (image.file ? [image.file] : []));
}

export function moveImage<T>(images: T[], from: number, to: number) {
  if (
    from === to ||
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < 0 ||
    from >= images.length ||
    to >= images.length
  ) {
    return images;
  }

  const next = [...images];
  const [image] = next.splice(from, 1);
  next.splice(to, 0, image!);
  return next;
}

export function revokeAttachedImages(
  images: ReadonlyArray<AttachedImage | null | undefined>,
) {
  images.forEach((image) => {
    if (image?.file) URL.revokeObjectURL(image.url);
  });
}

export function useAttachedImageCleanup(images: ReadonlyArray<AttachedImage>) {
  const imagesRef = useRef(images);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => () => revokeAttachedImages(imagesRef.current), []);
}

export function isSupportedImage(file: File) {
  return file.type === "image/jpeg" || file.type === "image/png";
}

export function filterImageFiles(
  files: File[],
  maxSize: number,
  onError: (message: string) => void,
) {
  return files.filter((file) => {
    if (!isSupportedImage(file)) {
      onError("JPG, PNG 이미지만 첨부할 수 있습니다.");
      return false;
    }

    if (file.size > maxSize) {
      onError(UPLOAD_IMAGE_SIZE_ERROR_MESSAGE);
      return false;
    }

    return true;
  });
}
