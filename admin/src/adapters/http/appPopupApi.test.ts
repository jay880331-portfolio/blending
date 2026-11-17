import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import type { AdminAppPopupInput } from "@blending/admin-contracts";
import { useAdminSessionStore } from "../../store/adminSessionStore";
import { adminApi } from "./adminApi";
import { createAppPopup, deleteAppPopup, updateAppPopup } from "./appPopupApi";

const input = {
  adminTitle: "공지",
  imageUrl: "https://example.com/popup.png",
  imageAlt: "공지 팝업",
  href: null,
  placements: ["home"],
  priority: 1,
  startsAt: "2026-08-20T00:00:00.000Z",
  endsAt: "2026-08-21T00:00:00.000Z",
  enabled: true,
} satisfies AdminAppPopupInput;

test("creates app popups with the popup request envelope", async (t) => {
  const post = t.mock.method(adminApi, "post", () =>
    Promise.resolve({ data: undefined } as never),
  );

  await createAppPopup(input);

  deepEqual(post.mock.calls[0]?.arguments[1], { popup: input });
});

test("updates app popups with the popup request envelope", async (t) => {
  const put = t.mock.method(adminApi, "put", () =>
    Promise.resolve({ data: undefined } as never),
  );

  await updateAppPopup("popup-id", input);

  deepEqual(put.mock.calls[0]?.arguments[1], { popup: input });
});

test("deletes app popups through the admin API boundary", async (t) => {
  useAdminSessionStore.setState({ csrfToken: "csrf-token" });
  t.after(() => useAdminSessionStore.setState({ csrfToken: null }));
  const deleted = { id: "popup-id" };
  const remove = t.mock.method(adminApi, "delete", () =>
    Promise.resolve({ data: deleted } as never),
  );

  const result = await deleteAppPopup("popup-id");

  equal(remove.mock.calls[0]?.arguments[0], "/api/admin/popups/popup-id");
  deepEqual(remove.mock.calls[0]?.arguments[1], {
    headers: { "X-CSRF-Token": "csrf-token" },
  });
  deepEqual(result, deleted);
});
