import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  batchUploadFiles,
  MAX_UPLOAD_FILE_SIZE,
  MAX_UPLOAD_IMAGE_SIZE,
  UPLOAD_FILE_SIZE_ERROR_MESSAGE,
  UPLOAD_IMAGE_SIZE_ERROR_MESSAGE,
  uploadErrorMessage,
  uploadImages,
  uploadPartnerAttachments,
} from "./uploadApi";

describe("batchUploadFiles", () => {
  it("splits image uploads into single-file requests while preserving order", () => {
    assert.deepEqual(batchUploadFiles(["a", "b", "c"]), [["a"], ["b"], ["c"]]);
  });
});

describe("uploadImages", () => {
  it("rejects oversized images before sending the upload request", async () => {
    const file = new File(
      [new Uint8Array(MAX_UPLOAD_IMAGE_SIZE + 1)],
      "large.jpg",
      {
        type: "image/jpeg",
      },
    );

    await assert.rejects(
      () => uploadImages([file], "community/b-talk"),
      new Error(UPLOAD_IMAGE_SIZE_ERROR_MESSAGE),
    );
  });
});

describe("uploadPartnerAttachments", () => {
  it("rejects oversized attachments before sending the upload request", async () => {
    const file = new File(
      [new Uint8Array(MAX_UPLOAD_FILE_SIZE + 1)],
      "large.pdf",
      {
        type: "application/pdf",
      },
    );

    await assert.rejects(
      () => uploadPartnerAttachments([file], "partner/promotions"),
      new Error(UPLOAD_FILE_SIZE_ERROR_MESSAGE),
    );
  });
});

describe("uploadErrorMessage", () => {
  it("maps payload-too-large responses to the image size message", () => {
    assert.equal(
      uploadErrorMessage(
        { isAxiosError: true, response: { status: 413 } },
        "fallback",
      ),
      UPLOAD_IMAGE_SIZE_ERROR_MESSAGE,
    );
  });

  it("maps payload-too-large responses to a custom size message", () => {
    assert.equal(
      uploadErrorMessage(
        { isAxiosError: true, response: { status: 413 } },
        "fallback",
        UPLOAD_FILE_SIZE_ERROR_MESSAGE,
      ),
      UPLOAD_FILE_SIZE_ERROR_MESSAGE,
    );
  });
});
