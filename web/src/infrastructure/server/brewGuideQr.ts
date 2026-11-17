import {
  BarcodeFormat,
  type BitMatrix,
  EncodeHintType,
  QRCodeWriter,
} from "@zxing/library";

export function encodeQrBitMatrix(value: string): BitMatrix {
  const writer = new QRCodeWriter();
  const hints = new Map<EncodeHintType, unknown>();
  hints.set(EncodeHintType.MARGIN, 1);
  return writer.encode(value, BarcodeFormat.QR_CODE, 0, 0, hints);
}

export function bitMatrixToSvg(
  matrix: BitMatrix,
  {
    fg = "#000000", // --fg
    bg = "#ffffff", // --surface
    size = 120,
  }: { fg?: string; bg?: string; size?: number } = {},
): string {
  const width = matrix.getWidth();
  const height = matrix.getHeight();
  const paths: string[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (matrix.get(x, y)) {
        paths.push(`M${x},${y}h1v1h-1z`);
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges"><rect width="${width}" height="${height}" fill="${bg}"/><path d="${paths.join("")}" fill="${fg}"/></svg>`;
}

export function generateQrSvgDataUrl(
  value: string,
  options?: { fg?: string; bg?: string; size?: number },
): string {
  const svg = bitMatrixToSvg(encodeQrBitMatrix(value), options);
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}
