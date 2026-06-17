import React, { useState, useEffect } from 'react';

const ToastManager = ({ sidebarWidth = 0 }) => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleShowToast = (event) => {
      const { message, type = 'info', duration = 4000 } = event.detail;
      const id = Date.now() + Math.random();
      
      setToasts(prev => [...prev, { id, message, type }]);

      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    };

    window.addEventListener('show-toast', handleShowToast);
    return () => window.removeEventListener('show-toast', handleShowToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{
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
    }}>
      {toasts.map(toast => {
        let bg = 'rgba(15, 23, 42, 0.95)';
        let border = '1px solid rgba(255, 255, 255, 0.1)';
        let color = '#fff';
        let icon = 'ℹ️';

        if (toast.type === 'success') {
          bg = 'rgba(16, 185, 129, 0.95)'; // emerald
          border = '1px solid rgba(16, 185, 129, 0.3)';
          icon = '✅';
        } else if (toast.type === 'error') {
          bg = 'rgba(239, 68, 68, 0.95)'; // red
          border = '1px solid rgba(239, 68, 68, 0.3)';
          icon = '⚠️';
        } else if (toast.type === 'warning') {
          bg = 'rgba(245, 158, 11, 0.95)'; // amber
          border = '1px solid rgba(245, 158, 11, 0.3)';
          icon = '⚠️';
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
