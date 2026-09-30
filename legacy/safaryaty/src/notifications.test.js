import test from "node:test";
import assert from "node:assert/strict";
import { enqueueNotification, normalizeNotification, notificationIcon, NOTIFICATION_TYPES } from "./notifications.js";

test("notification types receive predictable durations and icons", () => {
  const success = normalizeNotification({ type:"success", title:"Saved" }, 100);
  const error = normalizeNotification({ type:"error", title:"Failed" }, 101);
  const undo = normalizeNotification({ type:"undo", title:"Marked paid", actionLabel:"Undo", onAction:()=>{} }, 102);
  assert.equal(success.duration, 2400);
  assert.equal(error.duration, 6000);
  assert.equal(undo.duration, 5000);
  assert.equal(notificationIcon(NOTIFICATION_TYPES.SUCCESS), "check2-circle");
  assert.equal(notificationIcon(NOTIFICATION_TYPES.ERROR), "x-octagon");
  assert.equal(notificationIcon(NOTIFICATION_TYPES.UNDO), "arrow-counterclockwise");
});

test("duplicate notifications collapse instead of stacking", () => {
  const first = enqueueNotification([], { type:"error", title:"Couldn’t save", dedupeKey:"save-error" }, 1000);
  const second = enqueueNotification(first, { type:"error", title:"Couldn’t save", dedupeKey:"save-error" }, 1600);
  assert.equal(second.length, 1);
  assert.equal(second[0].count, 2);
  assert.equal(second[0].createdAt, 1600);
});

test("notifications outside the dedupe window remain separate", () => {
  const first = enqueueNotification([], { type:"info", title:"One", dedupeKey:"same" }, 1000);
  const second = enqueueNotification(first, { type:"info", title:"Two", dedupeKey:"same" }, 4000);
  assert.equal(second.length, 2);
});

test("queue is bounded and text is compact", () => {
  let queue = [];
  for (let index = 0; index < 7; index += 1) queue = enqueueNotification(queue, { title:`Message ${index}`, dedupeKey:`m-${index}` }, 1000 + index, { maxQueue:4 });
  assert.equal(queue.length, 4);
  const long = normalizeNotification({ title:"x".repeat(100), detail:"y".repeat(220) });
  assert.ok(long.title.length <= 72);
  assert.ok(long.detail.length <= 150);
});

test("persistent notifications do not auto-dismiss", () => {
  const item = normalizeNotification({ type:"warning", title:"Review", persistent:true });
  assert.equal(item.duration, 0);
});
