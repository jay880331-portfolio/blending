import { getCropOutputSize, type CropRect } from "./imageCrop";

export async function cropImageFile(
  file: File,
  rect: CropRect,
  maxDimension = 1920,
): Promise<File> {
  const url = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const value = new window.Image();
      value.onload = () => resolve(value);
      value.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
      value.src = url;
    });
    const output = getCropOutputSize(rect, maxDimension);
    const canvas = document.createElement("canvas");
    canvas.width = output.width;
    canvas.height = output.height;
    const context = canvas.getContext("2d");

    if (!context) throw new Error("이미지 변환에 실패했습니다.");

    const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
    context.drawImage(
      image,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      0,
      0,
      output.width,
      output.height,
    );
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("이미지 변환에 실패했습니다.")),
        mimeType,
        mimeType === "image/jpeg" ? 0.9 : undefined,
      ),
    );

    return new File([blob], file.name, {
      type: mimeType,
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
