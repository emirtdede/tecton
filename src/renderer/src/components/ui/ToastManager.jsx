import { useState, useEffect, useRef } from 'react';

const ToastManager = ({ sidebarWidth = 0 }) => {
  const [toasts, setToasts] = useState([]);
  // Track timers so they can be cleared on unmount (avoids state updates on an
  // unmounted component and dangling timers).
  const timersRef = useRef(new Set());

  useEffect(() => {
    const handleShowToast = (event) => {
      const { message, type = 'info', duration = 4000 } = event.detail || {};
      if (!message) return;
      const id = Date.now() + Math.random();

      setToasts(prev => [...prev, { id, message, type }]);

      const timer = setTimeout(() => {
        timersRef.current.delete(timer);
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
      timersRef.current.add(timer);
    };

    window.addEventListener('show-toast', handleShowToast);
    return () => {
      window.removeEventListener('show-toast', handleShowToast);
      for (const timer of timersRef.current) clearTimeout(timer);
      timersRef.current.clear();
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      // Toasts are the only channel for success/error feedback, but had no live
      // region: a screen-reader user performed an action and heard nothing.
      // `polite` for informational messages; errors escalate to `assertive`
      // through aria-live on the individual toast below.
      role="status"
      aria-live="polite"
      aria-atomic="false"
      style={{
        position: 'fixed',
        top: '20px',
        left: `calc(50% + ${sidebarWidth / 2}px)`,
        transform: 'translateX(-50%)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        pointerEvents: 'none',
        transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      {toasts.map(toast => {
        let bg = 'rgba(15, 23, 42, 0.95)';
        let border = '1px solid rgba(255, 255, 255, 0.1)';
        let color = '#fff';
        let icon = 'ℹ';

        if (toast.type === 'success') {
          bg = 'rgba(16, 185, 129, 0.95)'; // emerald
          border = '1px solid rgba(16, 185, 129, 0.3)';
          icon = '';
        } else if (toast.type === 'error') {
          bg = 'rgba(239, 68, 68, 0.95)'; // red
          border = '1px solid rgba(239, 68, 68, 0.3)';
          icon = '';
        } else if (toast.type === 'warning') {
          bg = 'rgba(245, 158, 11, 0.95)'; // amber
          border = '1px solid rgba(245, 158, 11, 0.3)';
          icon = '';
        }

        return (
          <div key={toast.id} style={{
            background: bg,
            color: color,
            padding: '0.75rem 1.5rem',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: border,
            fontWeight: '600',
            fontSize: '0.9rem',
            animation: 'fadeInDown 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <span>{icon}</span>
            <span>{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
};

export default ToastManager;
