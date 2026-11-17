import sharp from "sharp";

type PreparedImage = {
  buffer: Buffer;
  name: string;
  size: number;
  contentType: "image/webp";
};

const WEBP_QUALITY = 82;
const MAX_IMAGE_DIMENSION = 1920;

function webpFileName(name: string) {
  const withoutExtension = name.replace(/\.[^.]+$/, "");
  return `${withoutExtension || "image"}.webp`;
}

export async function prepareImageForUpload(
  file: File,
): Promise<PreparedImage> {
  const source = Buffer.from(await file.arrayBuffer());
  const buffer = await sharp(source)
    .rotate()
    .resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  return {
    buffer,
    name: webpFileName(file.name),
    size: buffer.length,
    contentType: "image/webp",
  };
}
