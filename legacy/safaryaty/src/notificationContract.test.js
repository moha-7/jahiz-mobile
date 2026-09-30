import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main = readFileSync(new URL("./main.jsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./styles/safaryaty.css", import.meta.url), "utf8");

test("app uses one notification center instead of ad-hoc toast timers", () => {
  assert.match(main, /useNotificationCenter/);
  assert.match(main, /NotificationHost/);
  assert.doesNotMatch(main, /setToast/);
  assert.doesNotMatch(main, /setTimeout\([^\n]*notification/i);
});

test("payment success exposes an immediate undo action", () => {
  assert.match(main, /notifyUndo\("Marked paid\."/);
  assert.match(main, /actionLabel:"Undo"/);
  assert.match(main, /onAction:\(\)=>undoPaid\(paymentId\)/);
});

test("deep-link navigation relies on visual focus rather than redundant toast", () => {
  const start = main.indexOf("const followCoachAction");
  const end = main.indexOf("const queueTripSync", start);
  const block = main.slice(start, end);
  assert.doesNotMatch(block, /notify[A-Z]/);
  assert.match(block, /scrollIntoView/);
});

test("normal-user notification copy does not expose backend implementation details", () => {
  const calls = [...main.matchAll(/notify(?:Success|Info|Warning|Error|Undo)\(([^\n]+)/g)].map(match => match[1]).join("\n");
  assert.doesNotMatch(calls, /backend sync|finance snapshot|paymentmark|ratebook|fx service/i);
});

test("notification UI has semantic types, actions, dismiss and focus states", () => {
  assert.match(css, /\.notificationToast\.success/);
  assert.match(css, /\.notificationToast\.warning/);
  assert.match(css, /\.notificationToast\.error/);
  assert.match(css, /\.notificationToast\.undo/);
  assert.match(css, /\.notificationToastAction:focus-visible/);
  assert.match(css, /\.notificationToastClose:focus-visible/);
});
