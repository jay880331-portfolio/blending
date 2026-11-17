export type CropAspect = "original" | "square" | "portrait" | "landscape";
export type ImageSize = { width: number; height: number };
export type CropPoint = { x: number; y: number };
export type CropState = { zoom: number; centerX: number; centerY: number };
export type CropRect = { x: number; y: number; width: number; height: number };
export type CropDraft = { aspect: CropAspect; state: CropState };

const FIXED_RATIOS = {
  square: 1,
  portrait: 4 / 5,
  landscape: 1.91,
} as const;

export const MAX_CROP_ZOOM = 4;
const MIN_CROP_SIZE = 640;

export function getMaxCropZoom(image: ImageSize, aspect: CropAspect): number {
  const base = getCropSize(image, aspect, 1);

  return clamp(
    Math.min(base.width, base.height) / MIN_CROP_SIZE,
    1,
    MAX_CROP_ZOOM,
  );
}

export function createCropState(image: ImageSize): CropState {
  return {
    zoom: 1,
    centerX: image.width / 2,
    centerY: image.height / 2,
  };
}

export function getCropAspectRatio(
  aspect: CropAspect,
  image: ImageSize,
): number {
  return aspect === "original"
    ? image.width / image.height
    : FIXED_RATIOS[aspect];
}

export function getCropRect(
  image: ImageSize,
  aspect: CropAspect,
  state: CropState,
): CropRect {
  const clampedState = clampCropState(image, aspect, state);
  const size = getCropSize(image, aspect, clampedState.zoom);

  return {
    x: clampedState.centerX - size.width / 2,
    y: clampedState.centerY - size.height / 2,
    ...size,
  };
}

export function clampCropState(
  image: ImageSize,
  aspect: CropAspect,
  state: CropState,
): CropState {
  const zoom = clamp(state.zoom, 1, getMaxCropZoom(image, aspect));
  const size = getCropSize(image, aspect, zoom);

  return {
    zoom,
    centerX: clamp(state.centerX, size.width / 2, image.width - size.width / 2),
    centerY: clamp(
      state.centerY,
      size.height / 2,
      image.height - size.height / 2,
    ),
  };
}

export function fitAspectWithin(
  container: ImageSize,
  aspectRatio: number,
): ImageSize {
  return container.width / container.height > aspectRatio
    ? { width: container.height * aspectRatio, height: container.height }
    : { width: container.width, height: container.width / aspectRatio };
}

export function getPreviewPlacement(
  image: ImageSize,
  frame: ImageSize,
  rect: CropRect,
): CropRect {
  const scale = Math.max(frame.width / rect.width, frame.height / rect.height);

  return {
    x: rect.x === 0 ? 0 : -rect.x * scale,
    y: rect.y === 0 ? 0 : -rect.y * scale,
    width: image.width * scale,
    height: image.height * scale,
  };
}

export function getCropOutputSize(
  rect: CropRect,
  maxDimension = 1920,
): ImageSize {
  const scale = Math.min(1, maxDimension / Math.max(rect.width, rect.height));

  return {
    width: Math.round(rect.width * scale),
    height: Math.round(rect.height * scale),
  };
}

export function isUntouchedOriginal(
  aspect: CropAspect,
  state: CropState,
): boolean {
  return aspect === "original" && state.zoom === 1;
}

export function panCropState(
  image: ImageSize,
  aspect: CropAspect,
  state: CropState,
  screenDelta: CropPoint,
  previewScale: number,
): CropState {
  return clampCropState(image, aspect, {
    ...state,
    centerX: state.centerX - screenDelta.x / previewScale,
    centerY: state.centerY - screenDelta.y / previewScale,
  });
}

export function zoomCropStateAtPoint(
  image: ImageSize,
  aspect: CropAspect,
  state: CropState,
  nextZoom: number,
  framePoint: CropPoint,
): CropState {
  const currentRect = getCropRect(image, aspect, state);
  const zoom = clamp(nextZoom, 1, getMaxCropZoom(image, aspect));
  const nextSize = getCropSize(image, aspect, zoom);
  const sourcePoint = {
    x: currentRect.x + currentRect.width * framePoint.x,
    y: currentRect.y + currentRect.height * framePoint.y,
  };

  return clampCropState(image, aspect, {
    zoom,
    centerX: sourcePoint.x + nextSize.width * (0.5 - framePoint.x),
    centerY: sourcePoint.y + nextSize.height * (0.5 - framePoint.y),
  });
}

export function replaceCroppableFiles(
  selectedFiles: File[],
  croppedImages: File[],
): File[] {
  const croppableCount = selectedFiles.filter(isCroppableFile).length;

  if (croppedImages.length !== croppableCount) {
    throw new Error("Cropped image count must match croppable file count.");
  }

  let cropIndex = 0;
  return selectedFiles.map((file) =>
    isCroppableFile(file) ? croppedImages[cropIndex++] : file,
  );
}

export function setCropAspectForAll(
  images: ImageSize[],
  drafts: CropDraft[],
  aspect: CropAspect,
): CropDraft[] {
  if (images.length !== drafts.length) {
    throw new Error("Image and crop draft counts must match.");
  }

  return drafts.map((draft, index) => ({
    aspect,
    state: clampCropState(images[index], aspect, draft.state),
  }));
}

function getCropSize(
  image: ImageSize,
  aspect: CropAspect,
  zoom: number,
): ImageSize {
  const size = fitAspectWithin(image, getCropAspectRatio(aspect, image));

  return { width: size.width / zoom, height: size.height / zoom };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isCroppableFile(file: File): boolean {
  return file.type === "image/jpeg" || file.type === "image/png";
}
