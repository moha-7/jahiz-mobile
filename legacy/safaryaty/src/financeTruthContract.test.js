import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const backend = readFileSync(new URL("../backend/src/modules/finance/cashflow.engine.ts", import.meta.url), "utf8");
const main = readFileSync(new URL("./main.jsx", import.meta.url), "utf8");

test("backend summary exposes one payment-ledger partition", () => {
  assert.match(backend, /summarizeTrackedOutgoings/);
  assert.match(backend, /stillToPay:/);
  assert.match(backend, /totalTrackedOutgoings:/);
  assert.match(backend, /paymentInvariantDelta:/);
});

test("backend and frontend use indexed one-time occurrence keys", () => {
  assert.match(backend, /const key = `life-\$\{item\.id\}-\$\{index\}`/);
  assert.match(backend, /const key = `cost-\$\{item\.id\}-\$\{index\}`/);
});

test("saved summary hydrates paid and still-to-pay from the same backend summary", () => {
  assert.match(main, /tripCards\.stillToPay/);
  assert.match(main, /totalStillNeededLocal: stillToPayLocal/);
  assert.match(main, /totalTrackedOutgoingsLocal/);
});
