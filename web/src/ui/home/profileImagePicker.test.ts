import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectProfileImage } from "./profileImagePicker";

const file = { name: "avatar.jpg" } as File;

describe("selectProfileImage", () => {
  it("uses the native picker and returns only its first selected file", async () => {
    let fallbackOpened = false;
    let requestedLimit: number | undefined;

    const result = await selectProfileImage({
      isNativePickerAvailable: () => true,
      pickNativeImageFiles: async (limit) => {
        requestedLimit = limit;
        return [file, { name: "ignored.jpg" } as File];
      },
      openFallback: () => {
        fallbackOpened = true;
      },
    });

    assert.equal(result, file);
    assert.equal(requestedLimit, 1);
    assert.equal(fallbackOpened, false);
  });

  it("opens the HTML input fallback when the native picker is unavailable", async () => {
    let nativePickerCalled = false;
    let fallbackOpened = false;

    const result = await selectProfileImage({
      isNativePickerAvailable: () => false,
      pickNativeImageFiles: async () => {
        nativePickerCalled = true;
        return [file];
      },
      openFallback: () => {
        fallbackOpened = true;
      },
    });

    assert.equal(result, null);
    assert.equal(nativePickerCalled, false);
    assert.equal(fallbackOpened, true);
  });

  it("returns null without opening the fallback when native selection is cancelled", async () => {
    for (const cancelledFiles of [null, []] as Array<File[] | null>) {
      let fallbackOpened = false;

      const result = await selectProfileImage({
        isNativePickerAvailable: () => true,
        pickNativeImageFiles: async () => cancelledFiles,
        openFallback: () => {
          fallbackOpened = true;
        },
      });

      assert.equal(result, null);
      assert.equal(fallbackOpened, false);
    }
  });
});
