export const NOTIFICATION_SYSTEM_VERSION = "4.29.48";

export const NOTIFICATION_TYPES = Object.freeze({
  SUCCESS: "success",
  INFO: "info",
  WARNING: "warning",
  ERROR: "error",
  UNDO: "undo",
});

const defaults = {
  success: { duration: 2400 },
  info: { duration: 3000 },
  warning: { duration: 4200 },
  error: { duration: 6000 },
  undo: { duration: 5000 },
};

const clampText = (value, max) => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
};

export function normalizeNotification(input, now = Date.now()) {
  const raw = typeof input === "string" ? { title: input } : (input || {});
  const type = defaults[raw.type] ? raw.type : NOTIFICATION_TYPES.INFO;
  const title = clampText(raw.title || "Update", 72);
  const detail = clampText(raw.detail || "", 150);
  const actionLabel = clampText(raw.actionLabel || "", 28);
  const dedupeKey = String(raw.dedupeKey || `${type}:${title}:${detail}`).toLowerCase();
  const duration = raw.persistent ? 0 : Math.max(0, Number(raw.duration ?? defaults[type].duration));
  return {
    id: raw.id || `notice-${now}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    detail,
    actionLabel,
    onAction: typeof raw.onAction === "function" ? raw.onAction : null,
    dedupeKey,
    duration,
    createdAt: now,
    count: Math.max(1, Number(raw.count || 1)),
  };
}

export function enqueueNotification(queue, input, now = Date.now(), options = {}) {
  const maxQueue = Math.max(1, Number(options.maxQueue || 4));
  const dedupeWindow = Math.max(0, Number(options.dedupeWindow || 1800));
  const next = normalizeNotification(input, now);
  const current = Array.isArray(queue) ? queue : [];
  const duplicateIndex = current.findIndex((item) => item.dedupeKey === next.dedupeKey && now - item.createdAt <= dedupeWindow);
  if (duplicateIndex >= 0) {
    return current.map((item, index) => index === duplicateIndex
      ? { ...item, createdAt: now, count: item.count + 1, duration: next.duration, onAction: next.onAction || item.onAction, actionLabel: next.actionLabel || item.actionLabel }
      : item);
  }
  return [...current, next].slice(-maxQueue);
}

export function notificationIcon(type) {
  if (type === NOTIFICATION_TYPES.SUCCESS) return "check2-circle";
  if (type === NOTIFICATION_TYPES.WARNING) return "exclamation-triangle";
  if (type === NOTIFICATION_TYPES.ERROR) return "x-octagon";
  if (type === NOTIFICATION_TYPES.UNDO) return "arrow-counterclockwise";
  return "info-circle";
}
