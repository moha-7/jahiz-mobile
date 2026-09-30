import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main = readFileSync(new URL("./main.jsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles/safaryaty.css", import.meta.url), "utf8");

test("editable manager grids use natural-height rows", () => {
  assert.match(css, /v4\.29\.47 — compact layout correction \+ currency deep links/);
  assert.match(css, /\.smartGrid,[\s\S]*grid-auto-rows:auto!important/);
  assert.match(css, /\.smartGrid>\.destinationCurrencyNotice,[\s\S]*grid-column:1\/-1!important/);
  assert.match(css, /\.smartGrid>\.smart\{[\s\S]*height:auto!important/);
});

test("trip-cost currency notice and suggestions open the canonical currency setup", () => {
  assert.match(main, /DestinationCurrencyNotice trip=\{trip\} onOpenCurrencySetup=\{onOpenCurrencySetup\}/);
  assert.match(main, /className="suggestionCurrencyLink" onClick=\{onOpenCurrencySetup\}/);
  assert.match(main, /const openCurrencySetup = \(\) => \{/);
  assert.match(main, /setWizardNavigation\(\{ target:"currency", step:1, stamp:Date\.now\(\) \}\)/);
});

test("currency deep link opens, focuses, and collapses after a successful edit", () => {
  assert.match(main, /data-currency-setup="true"/);
  assert.match(main, /setCurrencyOpen\(true\)/);
  assert.match(main, /scrollIntoView\(\{ behavior:"smooth", block:"center" \}\)/);
  assert.match(main, /setCurrencyOpen\(false\); setCurrencyFocused\(false\)/);
});

test("modal variants use content-appropriate shared shells", () => {
  assert.match(main, /<Modal size="wizard"/);
  assert.match(main, /<Modal size="compact"/);
  assert.match(css, /\.modal-wizard\{/);
  assert.match(css, /\.modal-compact,/);
  assert.match(css, /--sf-modal-wizard-height:780px/);
});
