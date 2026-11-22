import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A single transient inline message (e.g. "Fotoğraf yüklendi").
 *
 * Was duplicated in MaterialManagement and QualityReports, where each copy
 * carried its own timer ref, its own unmount cleanup and its own 3s timeout.
 * Centralised so the "no setState after unmount" and "a new message replaces
 * the previous one instead of stacking" guarantees cannot drift apart.
 *
 * @param {number} duration how long the message stays visible (ms)
 * @returns {{ message: string, show: (msg: string) => void, clear: () => void }}
 */
export default function useTransientMessage(duration = 3000) {
  const [message, setMessage] = useState('');
  const timerRef = useRef(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setMessage('');
  }, []);

  const show = useCallback(
    (msg) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setMessage(msg);
      timerRef.current = setTimeout(() => {
        setMessage('');
        timerRef.current = null;
      }, duration);
    },
    [duration]
  );

  return { message, show, clear };
}
