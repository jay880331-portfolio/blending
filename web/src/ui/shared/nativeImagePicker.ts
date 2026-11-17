"use client";

import type { NativePickedImageAsset } from "@blending/bridge";
import { isNativeBridgeAvailable, nativeBridge } from "@/bridge/nativeBridge";

export const isNativeImagePickerAvailable = () => isNativeBridgeAvailable();

export async function pickNativeImageFiles(selectionLimit: number) {
  if (!isNativeImagePickerAvailable() || selectionLimit <= 0) {
    return null;
  }

  const result = await nativeBridge.pickImages({ selectionLimit });

  if (result.canceled) {
    return [];
  }

  return result.assets.map(assetToFile).filter((file) => file !== null);
}

function assetToFile(asset: NativePickedImageAsset) {
  if (!asset.base64) {
    return null;
  }

  const mimeType = asset.mimeType ?? "image/jpeg";
  const bytes = base64ToBytes(asset.base64);
  const fileName =
    asset.fileName ?? `image-${crypto.randomUUID()}.${extensionFor(mimeType)}`;

  return new File([bytes], fileName, {
    type: mimeType,
    lastModified: Date.now(),
  });
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function extensionFor(mimeType: string) {
  return mimeType.includes("png") ? "png" : "jpg";
}
