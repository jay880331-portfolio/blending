import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canShowMapMessageAction } from "./locationPermission";

describe("canShowMapMessageAction", () => {
  it("shows the message action for baristas even when the map API did not precompute permission", () => {
    assert.equal(
      canShowMapMessageAction({
        serverAllowed: false,
        viewerRole: "barista",
        isOwnProfile: false,
      }),
      true,
    );
  });

  it("does not show the message action for enthusiasts or own profiles", () => {
    assert.equal(
      canShowMapMessageAction({
        serverAllowed: false,
        viewerRole: "enthusiast",
        isOwnProfile: false,
      }),
      false,
    );
    assert.equal(
      canShowMapMessageAction({
        serverAllowed: true,
        viewerRole: "barista",
        isOwnProfile: true,
      }),
      false,
    );
  });
});
