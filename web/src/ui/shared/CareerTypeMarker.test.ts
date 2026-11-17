import assert from "node:assert/strict";
import { it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CareerTypeMarker } from "./CareerTypeMarker";

it("uses the accent disc for awards and an outline cup for careers", () => {
  const award = renderToStaticMarkup(
    createElement(CareerTypeMarker, { type: "award" }),
  );
  const career = renderToStaticMarkup(
    createElement(CareerTypeMarker, { type: "career" }),
  );

  assert.match(award, /bg-\[var\(--accent\)\]/);
  assert.match(career, /border-\[var\(--border-strong\)\]/);
});
