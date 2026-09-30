import test from "node:test";
import assert from "node:assert/strict";
import { DECISION_ENGINE_VERSION, evaluateDecision } from "../shared/decision-engine.js";

test("canonical decision returns weighted factors and version", () => {
  const decision = evaluateDecision({
    planned: 1000, available: 1400, remaining: 400, gap: 0,
    emergency: 100, reserve: 100, comfort: "Balanced",
    hasIncome: true, hasDates: true, returnWithZero: true
  });
  assert.equal(decision.version, DECISION_ENGINE_VERSION);
  assert.equal(decision.verdict, "READY");
  assert.equal(decision.scoreFactors.length, 4);
  assert.equal(decision.scoreFactors.reduce((sum, factor) => sum + factor.weight, 0), 100);
});

test("missing costs are blocked and readiness cannot look healthy", () => {
  const decision = evaluateDecision({ planned: 0, available: 5000, hasIncome: true, hasDates: true });
  assert.equal(decision.verdict, "BLOCKED");
  assert.equal(decision.reasonCode, "MISSING_TRIP_COSTS");
  assert.ok(decision.readiness <= 35);
});

test("covered plan with less than 8 percent left is canonically tight", () => {
  const decision = evaluateDecision({ planned: 4710, available: 4770, remaining: 60, gap: 0, emergency: 100, hasIncome: true, hasDates: true });
  assert.equal(decision.verdict, "TIGHT");
  assert.equal(decision.reasonCode, "COVERED_BUT_THIN_BUFFER");
});

test("rate uncertainty blocks the verdict without changing money inputs", () => {
  const decision = evaluateDecision({ planned: 1000, available: 1500, remaining: 500, gap: 0, rateUnsure: true, hasIncome: true, hasDates: true });
  assert.equal(decision.verdict, "BLOCKED");
  assert.equal(decision.reasonCode, "EXCHANGE_RATE_UNCONFIRMED");
  assert.equal(decision.available, 1500);
});
