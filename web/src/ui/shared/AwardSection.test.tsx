import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CareerItem } from "@/domain/member/types";
import { AwardSection } from "./AwardSection";

const career: CareerItem = {
  id: "career-1",
  type: "career",
  year: "2025",
  period: "2025 ~ 현재",
  title: "수석 바리스타",
  organization: "카페 스테이",
};

const awards: CareerItem[] = [
  {
    id: "award-1",
    type: "award",
    year: "2024",
    period: "2024",
    title: "바리스타 대회 우승",
    organization: "블렌딩 바리스타 챔피언십",
    detail: "파이널 라운드 1위",
  },
  {
    id: "award-2",
    type: "award",
    year: "2022",
    period: "2022",
    title: "라떼아트 베스트 데모",
    organization: "서울 커피 교육 협회",
  },
];

describe("AwardSection", () => {
  it("shows the restored empty state and owner-only add link", () => {
    const html = renderToStaticMarkup(
      createElement(AwardSection, {
        careers: [career],
        addHref: "/home/career/edit?type=award",
      }),
    );

    assert.match(html, /수상 내역/);
    assert.match(html, /0건/);
    assert.match(html, /등록된 수상이 없습니다\./);
    assert.match(html, /href="\/home\/career\/edit\?type=award"/);
    assert.match(html, /\+ 추가/);
    assert.doesNotMatch(html, /수상 등록하기/);
    assert.doesNotMatch(html, /수석 바리스타/);
    assert.match(html, /border-dashed border-\[var\(--border-strong\)\]/);
  });

  it("hides the add link for a non-owner profile", () => {
    const html = renderToStaticMarkup(
      createElement(AwardSection, { careers: [] }),
    );

    assert.match(html, /등록된 수상이 없습니다\./);
    assert.doesNotMatch(html, /\+ 추가/);
    assert.doesNotMatch(html, /href="\/home\/career\/edit/);
  });

  it("renders the restored award card with the stored fields", () => {
    const html = renderToStaticMarkup(
      createElement(AwardSection, { careers: [awards[0]] }),
    );

    assert.match(html, /수상 내역/);
    assert.match(html, /1건/);
    assert.match(html, /바리스타 대회 우승/);
    assert.match(html, /블렌딩 바리스타 챔피언십/);
    assert.match(html, /파이널 라운드 1위/);
    assert.match(html, /2024/);
    assert.match(html, /border-l-\[3px\] border-l-\[var\(--fg\)\]/);
    assert.match(html, /text-\[var\(--info\)\]/);
    assert.match(
      html,
      /bg-\[color-mix\(in_srgb,var\(--danger\)_12%,transparent\)\] text-\[var\(--danger\)\]/,
    );
    assert.doesNotMatch(html, /\+ 추가/);
    assert.doesNotMatch(html, /등록된 수상이 없습니다\./);
  });

  it("sorts awards newest first without mutating the input array", () => {
    const input = [awards[1]!, career, awards[0]!];
    const originalOrder = input.map((item) => item.id);
    const html = renderToStaticMarkup(
      createElement(AwardSection, {
        careers: input,
        addHref: "/home/career/edit?type=award",
      }),
    );

    assert.match(html, /2건/);
    assert.ok(
      html.indexOf("바리스타 대회 우승") < html.indexOf("라떼아트 베스트 데모"),
    );
    assert.doesNotMatch(html, /수석 바리스타/);
    assert.match(html, /\+ 추가/);
    assert.deepEqual(
      input.map((item) => item.id),
      originalOrder,
    );
  });

  it("falls back to period and description when fields are missing", () => {
    const html = renderToStaticMarkup(
      createElement(AwardSection, {
        careers: [
          {
            id: "award-fallback",
            type: "award",
            year: "",
            period: "2021.05",
            title: "베스트 데모",
            description: "설명으로 보완한 상세",
          },
        ],
      }),
    );

    assert.match(html, /2021\.05/);
    assert.match(html, /설명으로 보완한 상세/);
  });
});
