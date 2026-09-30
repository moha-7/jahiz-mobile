import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./styles/safaryaty.css", import.meta.url), "utf8");

test("fixed-size families keep shared tokens while editable grids use natural height", () => {
  assert.match(css, /--sf-card-radius:22px/);
  assert.match(css, /--sf-control-height:44px/);
  assert.match(css, /\.dashboardKpis>\.kpi/);
  assert.match(css, /\.purposeGrid>\.purposeCard/);
  assert.match(css, /\.smartGrid,[\s\S]*grid-auto-rows:auto!important/);
});

test("modal shells share design tokens with content-appropriate variants", () => {
  assert.match(css, /--sf-modal-wizard-width:1180px/);
  assert.match(css, /--sf-modal-wizard-height:780px/);
  assert.match(css, /--sf-modal-compact-width:940px/);
  assert.match(css, /\.modal-wizard\{/);
  assert.match(css, /\.modal-compact,/);
});

test("mobile modal shells fill the viewport consistently", () => {
  assert.match(css, /width:100vw!important/);
  assert.match(css, /height:100dvh!important/);
  assert.match(css, /border-radius:0!important/);
});
