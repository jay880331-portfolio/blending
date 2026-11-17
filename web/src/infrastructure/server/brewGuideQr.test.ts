import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BinaryBitmap,
  HybridBinarizer,
  QRCodeReader,
  RGBLuminanceSource,
} from "@zxing/library";
import {
  bitMatrixToSvg,
  encodeQrBitMatrix,
  generateQrSvgDataUrl,
} from "./brewGuideQr";

describe("brewGuideQr", () => {
  it("encodes URL to BitMatrix, converts to SVG, and decodes back to the exact URL", () => {
    const url = "https://blending.kr/showroom/store-123";
    const matrix = encodeQrBitMatrix(url);
    const svg = bitMatrixToSvg(matrix, {
      fg: "#000000",
      bg: "#ffffff",
      size: 120,
    });

    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.ok(svg.includes('<path d="M'));

    const dataUrl = generateQrSvgDataUrl(url);
    assert.ok(dataUrl.startsWith("data:image/svg+xml;base64,"));

    // Round-trip decode from BitMatrix pixels
    const scale = 4;
    const width = matrix.getWidth() * scale;
    const height = matrix.getHeight() * scale;
    const luminances = new Uint8ClampedArray(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const isSet = matrix.get(Math.floor(x / scale), Math.floor(y / scale));
        luminances[y * width + x] = isSet ? 0 : 255;
      }
    }
    const source = new RGBLuminanceSource(luminances, width, height);
    const bitmap = new BinaryBitmap(new HybridBinarizer(source));
    const decoded = new QRCodeReader().decode(bitmap);
    assert.equal(decoded.getText(), url);
  });
});
