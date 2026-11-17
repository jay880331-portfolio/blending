import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clampCropState,
  createCropState,
  fitAspectWithin,
  getCropAspectRatio,
  getCropOutputSize,
  getCropRect,
  getMaxCropZoom,
  getPreviewPlacement,
  isUntouchedOriginal,
  MAX_CROP_ZOOM,
  panCropState,
  replaceCroppableFiles,
  setCropAspectForAll,
  zoomCropStateAtPoint,
} from "./imageCrop";

const image = { width: 4000, height: 3000 };

describe("image crop geometry", () => {
  it("fits square and portrait crops inside the source image", () => {
    assert.deepEqual(getCropRect(image, "square", createCropState(image)), {
      x: 500,
      y: 0,
      width: 3000,
      height: 3000,
    });
    assert.deepEqual(getCropRect(image, "portrait", createCropState(image)), {
      x: 800,
      y: 0,
      width: 2400,
      height: 3000,
    });
  });

  it("zooms a crop around its focal center", () => {
    assert.deepEqual(
      getCropRect(image, "square", { zoom: 2, centerX: 2000, centerY: 1500 }),
      { x: 1250, y: 750, width: 1500, height: 1500 },
    );
  });

  it("uses the specified landscape ratio", () => {
    assert.ok(
      Math.abs(getCropAspectRatio("landscape", image) - 1.91) < Number.EPSILON,
    );
  });

  it("clamps focal centers to every crop edge", () => {
    assert.deepEqual(
      clampCropState(image, "square", { zoom: 2, centerX: 0, centerY: 1500 }),
      { zoom: 2, centerX: 750, centerY: 1500 },
    );
    assert.deepEqual(
      clampCropState(image, "square", {
        zoom: 2,
        centerX: 4000,
        centerY: 1500,
      }),
      { zoom: 2, centerX: 3250, centerY: 1500 },
    );
    assert.deepEqual(
      clampCropState(image, "square", { zoom: 2, centerX: 2000, centerY: 0 }),
      { zoom: 2, centerX: 2000, centerY: 750 },
    );
    assert.deepEqual(
      clampCropState(image, "square", {
        zoom: 2,
        centerX: 2000,
        centerY: 3000,
      }),
      { zoom: 2, centerX: 2000, centerY: 2250 },
    );
  });

  it("fits portrait and landscape frames within a container", () => {
    const container = { width: 1000, height: 600 };

    assert.deepEqual(fitAspectWithin(container, 4 / 5), {
      width: 480,
      height: 600,
    });
    assert.deepEqual(fitAspectWithin(container, 1.91), {
      width: 1000,
      height: 1000 / 1.91,
    });
  });

  it("places the source image behind the preview frame", () => {
    assert.deepEqual(
      getPreviewPlacement(
        image,
        { width: 600, height: 600 },
        { x: 500, y: 0, width: 3000, height: 3000 },
      ),
      { x: -100, y: 0, width: 800, height: 600 },
    );
  });

  it("limits crop output to the default maximum dimension", () => {
    assert.deepEqual(
      getCropOutputSize({ x: 0, y: 0, width: 3000, height: 1500 }),
      { width: 1920, height: 960 },
    );
  });

  it("recognizes an untouched original crop", () => {
    assert.equal(
      isUntouchedOriginal("original", {
        zoom: 1,
        centerX: 2000,
        centerY: 1500,
      }),
      true,
    );
  });

  it("exports the maximum crop zoom", () => {
    assert.equal(MAX_CROP_ZOOM, 4);
  });

  it("pans the focal center in source pixels and clamps it", () => {
    const state = createCropState(image);

    assert.deepEqual(state, { zoom: 1, centerX: 2000, centerY: 1500 });
    assert.deepEqual(
      panCropState(image, "square", state, { x: 100, y: 0 }, 0.5),
      { zoom: 1, centerX: 1800, centerY: 1500 },
    );
  });

  it("keeps the source point under a frame position while zooming", () => {
    const zoomed = zoomCropStateAtPoint(
      image,
      "square",
      createCropState(image),
      2,
      { x: 0.25, y: 0.5 },
    );

    assert.equal(getCropRect(image, "square", zoomed).x, 875);
  });

  it("replaces only croppable files in their selected positions", () => {
    const jpegFile = { type: "image/jpeg" } as File;
    const pdfFile = { type: "application/pdf" } as File;
    const pngFile = { type: "image/png" } as File;
    const croppedJpeg = { type: "image/jpeg" } as File;
    const croppedPng = { type: "image/png" } as File;

    assert.deepEqual(
      replaceCroppableFiles(
        [jpegFile, pdfFile, pngFile],
        [croppedJpeg, croppedPng],
      ),
      [croppedJpeg, pdfFile, croppedPng],
    );
    assert.throws(
      () => replaceCroppableFiles([jpegFile, pdfFile, pngFile], [croppedJpeg]),
      /cropped image count/i,
    );
  });

  it("applies a fixed ratio to every draft while preserving each focal state", () => {
    assert.deepEqual(
      setCropAspectForAll(
        [
          { width: 4000, height: 3000 },
          { width: 3000, height: 4000 },
        ],
        [
          { aspect: "original", state: { zoom: 2, centerX: 0, centerY: 0 } },
          {
            aspect: "landscape",
            state: { zoom: 3, centerX: 1500, centerY: 3700 },
          },
        ],
        "square",
      ),
      [
        { aspect: "square", state: { zoom: 2, centerX: 750, centerY: 750 } },
        { aspect: "square", state: { zoom: 3, centerX: 1500, centerY: 3500 } },
      ],
    );
  });

  it("limits zoom so the crop never falls below the minimum size", () => {
    assert.equal(getMaxCropZoom({ width: 4000, height: 3000 }, "original"), 4);
    assert.equal(getMaxCropZoom({ width: 1280, height: 960 }, "original"), 1.5);
    assert.equal(getMaxCropZoom({ width: 600, height: 400 }, "square"), 1);
    assert.equal(
      getCropRect({ width: 1280, height: 960 }, "original", {
        zoom: 4,
        centerX: 640,
        centerY: 480,
      }).height,
      640,
    );
  });
});
