import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { enqueueNotification } from "./notifications.js";

export function useNotificationCenter() {
  const [queue, setQueue] = useState([]);
  const timerRef = useRef(null);
  const current = queue[0] || null;

  const notify = useCallback((input) => {
    setQueue((items) => enqueueNotification(items, input));
  }, []);

  const dismiss = useCallback((id) => {
    setQueue((items) => id ? items.filter((item) => item.id !== id) : items.slice(1));
  }, []);

  const clear = useCallback(() => setQueue([]), []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!current || current.duration <= 0) return undefined;
    timerRef.current = setTimeout(() => dismiss(current.id), current.duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current, dismiss]);

  return useMemo(() => ({ current, queue, notify, dismiss, clear }), [current, queue, notify, dismiss, clear]);
}
