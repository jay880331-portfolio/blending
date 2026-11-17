import { it } from "node:test";
import { deepEqual } from "node:assert/strict";
import { adminHeaders, adminMultipartHeaders } from "./adminApi";
it("adds csrf only to mutation requests", () => {
  deepEqual(adminHeaders("GET", "csrf"), {});
  deepEqual(adminHeaders("PATCH", "csrf"), { "X-CSRF-Token": "csrf" });
});

it("uses multipart content type with csrf for uploads", () => {
  deepEqual(adminMultipartHeaders("csrf"), {
    "Content-Type": "multipart/form-data",
    "X-CSRF-Token": "csrf",
  });
});
