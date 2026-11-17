import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAdminListQuery } from "./adminListQuery";

describe("parseAdminListQuery", () => {
  it("normalizes page and rejects unknown sort fields", () => {
    assert.deepEqual(
      parseAdminListQuery(new URLSearchParams("page=2&pageSize=50&sort=name"), [
        "name",
      ]),
      {
        page: 2,
        pageSize: 50,
        sort: "name",
        direction: "desc",
        q: undefined,
        status: undefined,
        from: undefined,
        to: undefined,
      },
    );
    assert.throws(
      () => parseAdminListQuery(new URLSearchParams("sort=$where"), ["name"]),
      /정렬 기준/,
    );
  });

  it("applies defaults and normalizes optional filters", () => {
    assert.deepEqual(
      parseAdminListQuery(
        new URLSearchParams(
          "direction=asc&q=%20coffee%20&status=active&from=2026-01-01&to=2026-01-31",
        ),
        [],
      ),
      {
        page: 1,
        pageSize: 20,
        sort: undefined,
        direction: "asc",
        q: "coffee",
        status: "active",
        from: "2026-01-01",
        to: "2026-01-31",
      },
    );
  });

  it("rejects invalid pages and unsupported page sizes", () => {
    assert.throws(
      () => parseAdminListQuery(new URLSearchParams("page=0"), []),
      /페이지를/,
    );
    assert.throws(
      () => parseAdminListQuery(new URLSearchParams("page=1.5"), []),
      /페이지를/,
    );
    assert.throws(
      () => parseAdminListQuery(new URLSearchParams("pageSize=25"), []),
      /페이지 크기/,
    );
  });
});
