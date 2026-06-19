import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import LightboxModal from './ui/LightboxModal';
import GuideDrawer from './ui/GuideDrawer';
import { formatDate } from '../utils/formatUtils';

const MediaGallery = ({ activeProjectId, projects = [] }) => {
  const { t, i18n } = useTranslation();
  const [mediaItems, setMediaItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' is default
  const [currentPage, setCurrentPage] = useState(1);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [filterType, setFilterType] = useState(''); // '' | 'material' | 'report'
  const [filterPhoto, setFilterPhoto] = useState(''); // '' | 'yes' | 'no'

  const activeProject = projects.find(p => p.id === activeProjectId);

  const fetchMedia = async () => {
    if (!activeProjectId) return;
    setLoading(true);
    if (window.api && window.api.db) {
      const materials = await window.api.db.read('materials', { project_id: activeProjectId });
      const reports = await window.api.db.read('quality_reports', { project_id: activeProjectId });

      const items = [];

      // Process materials
      for (const m of materials) {
        items.push({
          id: `material_${m.id}`,
          type: 'material',
          typeLabel: t('filters.delivery_note', 'İrsaliye / Fiş'),
          title: `${m.supplier} - ${m.material_type}`,
          date: m.receipt_date,
          photo_path: m.photo_path || null
        });
      }

      // Process quality reports
      for (const r of reports) {
        items.push({
          id: `report_${r.id}`,
          type: 'report',
          typeLabel: t('filters.quality_report', 'Kalite Tutanak'),
          title: r.title,
          date: r.report_date,
          photo_path: r.photo_path || null
        });
      }

      // Read base64 content for each (only if it has photo_path)
      const resolvedItems = [];
      for (const item of items) {
        if (item.photo_path) {
          const res = await window.api.media.readPhoto({ relativePath: item.photo_path });
          if (res.success) {
            resolvedItems.push({
              ...item,
              base64: res.base64
            });
          } else {
            resolvedItems.push({
              ...item,
              base64: null
            });
          }
        } else {
          resolvedItems.push({
            ...item,
            base64: null
          });
        }
      }

      setMediaItems(resolvedItems);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, [activeProjectId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, filterType, filterPhoto, activeProjectId]);

  // Filter and Sort logic
  const filteredItems = mediaItems.filter(item => {
    const matchesSearch = !searchQuery || 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.typeLabel.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = !filterType || 
      (filterType === 'material' && item.id.startsWith('material_')) ||
      (filterType === 'report' && item.id.startsWith('report_'));
      
    const matchesPhoto = !filterPhoto ||
      (filterPhoto === 'yes' && !!item.base64) ||
      (filterPhoto === 'no' && !item.base64);

    return matchesSearch && matchesType && matchesPhoto;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    if (sortBy === 'date_desc') {
      return dateB - dateA;
    } else if (sortBy === 'date_asc') {
      return dateA - dateB;
    }
    return 0;
  });

  // Pagination logic
  const itemsPerPage = viewMode === 'list' ? 7 : 12;
  const totalItems = sortedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * itemsPerPage;
  const paginatedItems = sortedItems.slice(startIndex, startIndex + itemsPerPage);

  if (!activeProjectId) {
    return (
      <div className="glass-card text-center" style={{ padding: '3rem' }}>
        <h2>{t('nav.media', 'Medya Galerisi')}</h2>
        <p className="text-muted" style={{ marginTop: '1rem' }}>{t('common.select_project_msg', 'Lütfen sol menüden veya Şantiye Yönetimi sayfasından aktif bir şantiye seçin.')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
          <h2 className="card-title" style={{ fontSize: '1.5rem', marginBottom: 0 }}>{t('media.gallery_title', '📷 Şantiye Medya Galerisi')}</h2>
          <span 
            onClick={() => setHelpOpen(true)}
            style={{ 
              cursor: 'pointer', 
              opacity: 0.4, 
              transition: 'opacity 0.25s ease-in-out', 
              fontSize: '1.6rem',
              userSelect: 'none',
              padding: '0.25rem'
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = 1}
            onMouseLeave={e => e.currentTarget.style.opacity = 0.4}
            title={t('common.page_guide', 'Sayfa Kılavuzu')}
          >
            💡
          </span>
        </div>
        <p className="card-subtitle" style={{ marginBottom: '0.75rem' }}>{t('common.active_project', 'Aktif Şantiye:')} <span style={{ color: 'var(--primary)', fontWeight: '600' }}>{activeProject?.name}</span></p>

        {/* Unified Search & Filters Toolbar Container */}
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.02)', 
          border: '1px solid var(--glass-border)', 
          borderRadius: '12px', 
          padding: '0.5rem 1rem', 
          marginBottom: '0.75rem',
          display: 'flex', 
          gap: '1rem', 
          alignItems: 'center', 
          flexWrap: 'wrap' 
        }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '150px', display: 'flex', alignItems: 'center' }}>
            <input 
              type="text"
              className="form-input"
              placeholder={t('dashboard.search', 'Arama...')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingRight: '2.5rem', width: '100%', marginBottom: 0 }}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                  padding: '4px'
                }}
              >
                ✕
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{t('filters.sort', 'Sıralama:')}</label>
            <select 
              className="form-input"
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{ width: '160px', marginBottom: 0, padding: '6px 12px', flexShrink: 0 }}
            >
              <option value="date_desc">{t('filters.newest', 'Yeniden Eskiye')}</option>
              <option value="date_asc">{t('filters.oldest', 'Eskiden Yeniye')}</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{t('filters.type', 'Türü:')}</label>
            <select 
              className="form-input"
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              style={{ width: '140px', marginBottom: 0, padding: '6px 12px', flexShrink: 0 }}
            >
              <option value="">{t('filters.all_types', 'Tüm Türler')}</option>
              <option value="material">{t('filters.delivery_note', 'İrsaliye / Fiş')}</option>
              <option value="report">{t('filters.quality_report', 'Kalite Tutanak')}</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{t('filters.photo_status', 'Görsel Durumu:')}</label>
            <select 
              className="form-input"
              value={filterPhoto}
              onChange={e => setFilterPhoto(e.target.value)}
              style={{ width: '140px', marginBottom: 0, padding: '6px 12px', flexShrink: 0 }}
            >
              <option value="">{t('common.all', 'Tümü')}</option>
              <option value="yes">{t('filters.with_photo', 'Fotoğraflı')}</option>
              <option value="no">{t('filters.without_photo', 'Fotoğrafsız')}</option>
            </select>
          </div>

          {/* View Mode Toggle Switcher */}
          <div style={{ 
            display: 'flex', 
            gap: '0.25rem', 
            background: 'rgba(255, 255, 255, 0.05)', 
            padding: '4px', 
            borderRadius: '10px', 
            border: '1px solid var(--glass-border)',
            flexShrink: 0,
            marginLeft: 'auto'
          }}>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title={t('media.view_list', 'Liste Görünümü')}
              style={{
                background: viewMode === 'list' ? 'var(--primary)' : 'transparent',
                border: 'none',
                color: viewMode === 'list' ? '#fff' : 'var(--text-muted)',
                padding: '7px 10px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease-in-out'
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('gallery')}
              title={t('media.view_grid', 'Galeri Görünümü')}
              style={{
                background: viewMode === 'gallery' ? 'var(--primary)' : 'transparent',
                border: 'none',
                color: viewMode === 'gallery' ? '#fff' : 'var(--text-muted)',
                padding: '7px 10px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease-in-out'
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
            {[1, 2, 3, 4].map(n => <div key={n} className="skeleton" style={{ height: '180px', borderRadius: '12px' }}></div>)}
          </div>
        ) : paginatedItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', border: '1px dashed var(--glass-border)', borderRadius: '12px' }}>
            {t('empty.media', 'Arama kriterlerine uygun medya kaydı bulunamadı.')}
          </div>
        ) : viewMode === 'list' ? (
          /* List View (Table layout) */
          <div className="fin-table-container">
            <table className="fin-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>{t('common.photo', 'Görsel')}</th>
                  <th>{t('common.title', 'Başlık')}</th>
                  <th>{t('media.item_type', 'İçerik Türü')}</th>
                  <th>{t('common.date', 'Tarih')}</th>
                  <th style={{ width: '80px', textAlign: 'right' }}>{t('subcontractor.table_action', 'İşlem')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map(item => (
                  <tr key={item.id}>
                    <td>
                      {item.base64 ? (
                        <img 
                          src={item.base64} 
                          alt={item.title} 
                          style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer', border: '1px solid var(--glass-border)' }} 
                          onClick={() => setSelectedImage(item.base64)}
                        />
                      ) : (
                        <div style={{ 
                          width: '45px', 
                          height: '45px', 
                          borderRadius: '6px', 
                          background: 'rgba(255, 255, 255, 0.03)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          color: 'var(--text-muted)',
                          fontSize: '1.2rem',
                          border: '1px dashed rgba(255, 255, 255, 0.08)'
                        }}>
                          📄
                        </div>
                      )}
                    </td>
                    <td style={{ fontWeight: '500' }}>
                      {item.title}
                    </td>
                    <td>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: '700', 
                        color: item.type === 'report' ? 'var(--danger)' : 'var(--success)',
                        background: item.type === 'report' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        textTransform: 'uppercase'
                      }}>
                        {item.typeLabel}
                      </span>
                    </td>
                    <td>
                      📅 {formatDate(item.date, i18n.language)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {item.base64 ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ width: '28px', height: '28px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 'auto' }}
                          onClick={() => setSelectedImage(item.base64)}
                          title={t('common.view', 'Görüntüle')}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Gallery/Grid View */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.5rem' }}>
            {paginatedItems.map(item => (
              <div 
                key={item.id} 
                className="glass-card" 
                style={{ 
                  padding: '0.5rem', 
                  overflow: 'hidden', 
                  cursor: item.base64 ? 'pointer' : 'default',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onClick={() => item.base64 && setSelectedImage(item.base64)}
              >
                {item.base64 ? (
                  <img 
                    src={item.base64} 
                    alt={item.title} 
                    style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px' }} 
                  />
                ) : (
                  <div style={{ 
                    width: '100%', 
                    height: '140px', 
                    borderRadius: '8px', 
                    background: 'rgba(255, 255, 255, 0.03)', 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: 'var(--text-muted)',
                    fontSize: '2rem',
                    border: '1px dashed rgba(255, 255, 255, 0.08)'
                  }}>
                    📄
                    <span style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>{t('media.no_image', 'Görsel Yok')}</span>
                  </div>
                )}
                <div style={{ padding: '0.5rem 0.25rem 0.25rem 0.25rem' }}>
                  <span style={{ 
                    fontSize: '0.7rem', 
                    fontWeight: '700', 
                    color: item.type === 'report' ? 'var(--danger)' : 'var(--success)',
                    background: item.type === 'report' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    textTransform: 'uppercase'
                  }}>
                    {item.typeLabel}
                  </span>
                  <h4 style={{ fontSize: '0.85rem', margin: '0.5rem 0 0.25rem 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#fff' }}>
                    {item.title}
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>📅 {formatDate(item.date, i18n.language)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Premium Pagination Controls */}
        {!loading && totalItems > 0 && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginTop: '1rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--glass-border)'
          }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {t('common.page', 'Sayfa')} {validCurrentPage} / {totalPages} ({totalItems} {t('common.records', 'Kayıt')})
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={validCurrentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                style={{ padding: '6px 14px', fontSize: '0.85rem', cursor: validCurrentPage === 1 ? 'not-allowed' : 'pointer' }}
              >
                {t('common.prev', 'Önceki')}
              </button>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {t('common.page', 'Sayfa')} {validCurrentPage} / {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={validCurrentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                style={{ padding: '6px 14px', fontSize: '0.85rem', cursor: validCurrentPage === totalPages ? 'not-allowed' : 'pointer' }}
              >
                {t('common.next_short', 'Sonraki')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox / Fullscreen Image Viewer Modal */}
      <LightboxModal 
        isOpen={!!selectedImage} 
        imageSrc={selectedImage} 
        onClose={() => setSelectedImage(null)} 
      />

      <GuideDrawer 
        isOpen={helpOpen} 
        onClose={() => setHelpOpen(false)} 
        title={t('guides.media.title')} 
        desc="" 
        h1={t('guides.media.q1.title')} 
        p1={t('guides.media.q1.desc')} 
        h2={t('guides.media.q2.title')} 
        p2={t('guides.media.q2.desc')} 
        h3={t('guides.media.q3.title')} 
        p3={t('guides.media.q3.desc')} 
        h4={t('guides.media.q4.title')} 
        p4={t('guides.media.q4.desc')} 
        h5={t('guides.media.q5.title')} 
        p5={t('guides.media.q5.desc')} 
        h6={t('guides.media.q6.title')} 
        p6={t('guides.media.q6.desc')} 
      />
    </>
  );
};

export default MediaGallery;
