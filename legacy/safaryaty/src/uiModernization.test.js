import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./styles/safaryaty.css", import.meta.url), "utf8");
const main = readFileSync(new URL("./main.jsx", import.meta.url), "utf8");

test("modern UI system includes accessible focus and interaction states", () => {
  assert.match(css, /v4\.29\.44 — finance truth UI \+ modern interaction system/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /\.actionChoice:hover/);
  assert.match(css, /\.dashboardKpis \.kpi/);
});

test("primary deep action and full plan editor remain visually distinct", () => {
  assert.match(main, /Recommended fix/);
  assert.match(main, /Full plan editor/);
  assert.match(css, /\.primaryChoice/);
  assert.match(css, /\.fullPlanChoice/);
});

test("user notifications avoid backend implementation language", () => {
  assert.doesNotMatch(main, /notify(?:Success|Info|Warning|Error|Undo)\([^\n]*backend sync/i);
  assert.doesNotMatch(main, /notify(?:Success|Info|Warning|Error|Undo)\([^\n]*FX service/i);
  assert.match(main, /notifyUndo\("Marked paid\."/);
  assert.match(main, /notifySuccess\("Payment restored\."\)/);
});
