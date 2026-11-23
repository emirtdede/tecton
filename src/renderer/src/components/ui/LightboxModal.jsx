import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useModalA11y from '../../hooks/useModalA11y';

const LightboxModal = ({ isOpen, imageSrc, onClose }) => {
  const { t } = useTranslation();
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const imageRef = useRef(null);
  const overlayRef = useRef(null);
  const { dialogProps, containerRef } = useModalA11y({
    isOpen: isOpen && !!imageSrc,
    onClose,
    label: t('common.lightbox_view', 'Büyütülmüş görsel')
  });

  // React attaches wheel listeners passively at the root, so e.preventDefault()
  // in an onWheel prop was ignored and the page scrolled behind the lightbox.
  // A native listener with { passive: false } is the only way to stop it.
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setScale(prev => Math.min(prev + 0.25, 4));
    } else {
      setScale(prev => Math.max(prev - 0.25, 0.5));
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !imageSrc) return undefined;
    const node = overlayRef.current;
    if (!node) return undefined;
    node.addEventListener('wheel', handleWheel, { passive: false });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      node.removeEventListener('wheel', handleWheel);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, imageSrc, handleWheel]);

  // Reset zoom & drag when image changes or modal closes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [imageSrc, isOpen]);

  if (!isOpen || !imageSrc) return null;

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div 
      className="drawer-overlay" 
      style={{ 
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backdropFilter: 'blur(16px)',
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        userSelect: 'none'
      }} 
      onClick={onClose}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div 
        ref={containerRef}
        {...dialogProps}
        style={{ outline: 'none', display: 'contents' }}
      >
        <div 
          style={{ 
            position: 'absolute',
            top: '1.5rem',
            right: '1.5rem',
            display: 'flex',
            gap: '0.75rem',
            zIndex: 10000
          }}
          onClick={e => e.stopPropagation()}
        >
          <button type="button" className="btn btn-primary" aria-label={t('common.zoom_in', 'Yakınlaştır')} title={t('common.zoom_in', 'Yakınlaştır')} onClick={handleZoomIn} style={{ width: '40px', height: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', fontWeight: 'bold' }}>+</button>
          <button type="button" className="btn btn-primary" aria-label={t('common.zoom_out', 'Uzaklaştır')} title={t('common.zoom_out', 'Uzaklaştır')} onClick={handleZoomOut} style={{ width: '40px', height: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', fontWeight: 'bold' }}>-</button>
          <button type="button" className="btn" onClick={handleReset} style={{ height: '40px', fontSize: '0.85rem' }}>{t('common.reset', 'Sıfırla')}</button>
          <button type="button" className="btn btn-danger" aria-label={t('common.close', 'Kapat')} title={t('common.close', 'Kapat')} onClick={onClose} style={{ width: '40px', height: '40px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
        </div>

        <div 
          style={{ 
            position: 'relative',
            maxWidth: '90%',
            maxHeight: '90vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden'
          }}
          onClick={e => e.stopPropagation()}
          onWheel={handleWheel}
        >
          <img 
            ref={imageRef}
            src={imageSrc} 
            alt={t('common.lightbox_view', 'Büyütülmüş görsel')} 
            onMouseDown={handleMouseDown}
            style={{ 
              maxWidth: '100%', 
              maxHeight: '85vh', 
              objectFit: 'contain', 
              borderRadius: '8px', 
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              cursor: isDragging ? 'grabbing' : 'grab',
              transition: isDragging ? 'none' : 'transform 0.15s ease-out',
              transformOrigin: 'center center'
            }} 
          />
        </div>
      </div>
    </div>
  );
};

export default LightboxModal;
