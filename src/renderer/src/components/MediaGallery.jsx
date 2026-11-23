import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import LightboxModal from './ui/LightboxModal';
import NoProjectNotice from './ui/NoProjectNotice';
import GuideDrawer from './ui/GuideDrawer';
import { formatDate, trLower } from '../utils/formatUtils';
import { logError } from '../utils/logger';
import CustomDatePicker from './ui/CustomDatePicker';
import PageGuideIcon from './ui/PageGuideIcon';
import { clampRangeForStart, clampRangeForEnd } from '../utils/dateRangeUtils';
import Pagination from './ui/Pagination';
import { LayoutGrid, List, Eye, X } from 'lucide-react';


const MediaGallery = ({ activeProjectId, projects = [] }) => {
  const { t, i18n } = useTranslation();
  const [mediaItems, setMediaItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' is default
  const [currentPage, setCurrentPage] = useState(1);
  // relativePath -> data URL | null. Populated only for the visible page.
  const [photoCache, setPhotoCache] = useState({});
  const inFlightPhotosRef = useRef(new Set());

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [filterType, setFilterType] = useState(''); // '' | 'material' | 'report'
  const [filterPhoto, setFilterPhoto] = useState(''); // '' | 'yes' | 'no'
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const activeProject = projects.find(p => p.id === activeProjectId);

  // Guards against out-of-order async results: when the user switches projects
  // quickly, a slow response for the old project must not overwrite the new one.
  const requestIdRef = useRef(0);

  const fetchMedia = async () => {
    if (!activeProjectId) {
      setMediaItems([]);
      setLoading(false);
      return;
    }
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      if (!window.api || !window.api.db) return;
      const [materials, reports] = await Promise.all([
        window.api.db.read('materials', { project_id: activeProjectId }),
        window.api.db.read('quality_reports', { project_id: activeProjectId })
      ]);

      // A newer fetch started while we were waiting - drop this result.
      if (requestId !== requestIdRef.current) return;

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

      // Photos are NOT read here: a project with a few hundred receipts would
      // hold every full-size image as a base64 string in state (tens of MB).
      // The visible page loads its own thumbnails in the effect below.
      setMediaItems(items);
    } catch (err) {
      // Without this the spinner never stopped and the rejection surfaced as an
      // unhandled promise rejection in the renderer.
      if (requestId !== requestIdRef.current) return;
      logError('Media gallery fetch failed:', err);
      setMediaItems([]);
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: t('media.load_error', 'Medya galerisi yüklenemedi.'), type: 'error' }
      }));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
    return () => {
      // Invalidate any in-flight response when the project changes/unmounts.
      requestIdRef.current += 1;
    };
  }, [activeProjectId, t]);

  const handleStartDateChange = (val) => {
    const [start, end] = clampRangeForStart(val, filterEndDate);
    setFilterStartDate(start);
    setFilterEndDate(end);
  };

  const handleEndDateChange = (val) => {
    const [start, end] = clampRangeForEnd(val, filterStartDate);
    setFilterStartDate(start);
    setFilterEndDate(end);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, filterType, filterPhoto, filterStartDate, filterEndDate, activeProjectId]);

  // Filter, sort and paginate media items.
  // Memoized: the filter chain + sort previously re-ran on every render
  // (including each base64 photo batch load).
  const sortedItems = useMemo(() => {
    const query = trLower(searchQuery);
    const filtered = mediaItems.filter(item => {
      const formattedDate = formatDate(item.date, i18n.language);
      const matchesSearch = !searchQuery ||
        trLower(item.title).includes(query) ||
        trLower(item.typeLabel).includes(query) ||
        trLower(formattedDate).includes(query);

      const matchesType = !filterType ||
        (filterType === 'material' && item.id.startsWith('material_')) ||
        (filterType === 'report' && item.id.startsWith('report_'));

      const matchesPhoto = !filterPhoto ||
        (filterPhoto === 'yes' && !!item.photo_path) ||
        (filterPhoto === 'no' && !item.photo_path);

      let matchesDate = true;
      if (filterStartDate) matchesDate = matchesDate && item.date >= filterStartDate;
      if (filterEndDate) matchesDate = matchesDate && item.date <= filterEndDate;

      return matchesSearch && matchesType && matchesPhoto && matchesDate;
    });

    return filtered.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      if (sortBy === 'date_desc') {
        return dateB - dateA;
      } else if (sortBy === 'date_asc') {
        return dateA - dateB;
      }
      return 0;
    });
  }, [mediaItems, searchQuery, filterType, filterPhoto, filterStartDate, filterEndDate, sortBy, i18n.language]);

  // Pagination logic
  const itemsPerPage = viewMode === 'list' ? 7 : 12;
  const totalItems = sortedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * itemsPerPage;
  const paginatedItems = sortedItems.slice(startIndex, startIndex + itemsPerPage);

  // Key the loader on the visible photo set, not on `photoCache` (adding the
  // cache to the deps would re-trigger the effect that fills it).
  const visiblePhotoKey = paginatedItems.map(item => item.photo_path || '').join('|');

  useEffect(() => {
    if (!window.api?.media) return undefined;
    let cancelled = false;
    // Photos already cached (or in flight) are skipped, so revisiting a page or
    // paginating back and forth never re-reads the same file.
    const pending = paginatedItems
      .map(item => item.photo_path)
      .filter((relativePath, index, list) =>
        relativePath &&
        !photoCache[relativePath] &&
        !inFlightPhotosRef.current.has(relativePath) &&
        list.indexOf(relativePath) === index
      );

    if (pending.length === 0) return undefined;

    pending.forEach(relativePath => inFlightPhotosRef.current.add(relativePath));

    Promise.all(pending.map(async (relativePath) => {
      let dataUrl = null;
      try {
        const res = await window.api.media.readPhoto({ relativePath });
        dataUrl = res && res.success ? res.base64 : null;
      } catch (err) {
        logError('Media thumbnail read failed:', err);
      } finally {
        inFlightPhotosRef.current.delete(relativePath);
      }
      return [relativePath, dataUrl];
    })).then((entries) => {
      if (cancelled) return;
      setPhotoCache(prev => {
        const next = { ...prev };
        for (const [relativePath, dataUrl] of entries) next[relativePath] = dataUrl;
        return next;
      });
    });

    return () => { cancelled = true; };
    // `paginatedItems`/`photoCache` are intentionally read without being deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePhotoKey]);

  const getPhoto = (item) => (item.photo_path ? photoCache[item.photo_path] : null);

  if (!activeProjectId) {
    return <NoProjectNotice titleKey="nav.media" titleFallback="Media gallery" />;
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-head-title">{t('media.gallery_title', 'Şantiye Medya Galerisi')}</h1>
          <p className="card-subtitle active-project-subtitle">
            {t('common.active_project', 'Aktif Şantiye:')} <strong>{activeProject?.name}</strong>
          </p>
        </div>
        <PageGuideIcon onClick={() => setHelpOpen(true)} />
      </header>

      <div className="glass-card" style={{ padding: '1.25rem', marginTop: '1rem' }}>
        {/* Unified Search & Filters Toolbar Container */}
        <div style={{ 
          background: 'var(--surface-subtle)', 
          border: '1px solid var(--glass-border)', 
          borderRadius: '12px', 
          padding: '0.75rem 1rem', 
          marginBottom: '0.25rem',
          display: 'flex', 
          gap: '1rem', 
          alignItems: 'flex-end', 
          flexWrap: 'wrap' 
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '2 1 200px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('common.search', 'Arama')}</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input 
                type="text"
                className="form-input"
                placeholder={t('media.search_placeholder', 'Başlık, içerik türü veya tarihe göre ara...')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingRight: '2.5rem', width: '100%', marginBottom: 0 }}
              />
              {searchQuery && (
                <button 
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={t('common.clear', 'Temizle')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '1.1rem',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 120px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('common.start_date', 'Başlangıç Tarihi')}</label>
            <CustomDatePicker
              value={filterStartDate}
              onChange={e => handleStartDateChange(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 120px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('common.end_date', 'Bitiş Tarihi')}</label>
            <CustomDatePicker
              value={filterEndDate}
              onChange={e => handleEndDateChange(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 130px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('filters.sort', 'Sıralama')}</label>
            <select 
              className="form-input"
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{ width: '100%', marginBottom: 0, padding: '6px 12px', flexShrink: 0 }}
            >
              <option value="date_desc">{t('filters.newest', 'Yeniden Eskiye')}</option>
              <option value="date_asc">{t('filters.oldest', 'Eskiden Yeniye')}</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 120px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('filters.type', 'Türü')}</label>
            <select 
              className="form-input"
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              style={{ width: '100%', marginBottom: 0, padding: '6px 12px', flexShrink: 0 }}
            >
              <option value="">{t('filters.all_types', 'Tüm Türler')}</option>
              <option value="material">{t('filters.delivery_note', 'İrsaliye / Fiş')}</option>
              <option value="report">{t('filters.quality_report', 'Kalite Tutanak')}</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 120px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('filters.photo_status', 'Görsel Durumu')}</label>
            <select 
              className="form-input"
              value={filterPhoto}
              onChange={e => setFilterPhoto(e.target.value)}
              style={{ width: '100%', marginBottom: 0, padding: '6px 12px', flexShrink: 0 }}
            >
              <option value="">{t('common.all', 'Tümü')}</option>
              <option value="yes">{t('filters.with_photo', 'Fotoğraflı')}</option>
              <option value="no">{t('filters.without_photo', 'Fotoğrafsız')}</option>
            </select>
          </div>

          {/* View Mode Toggle Switcher */}
          <div className="segmented segmented-icons" role="group" aria-label={t('media.view_mode', 'View mode')}>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title={t('media.view_list', 'Liste Görünümü')}
              aria-label={t('media.view_list', 'Liste Görünümü')}
              aria-pressed={viewMode === 'list'}
              className={`segmented-item ${viewMode === 'list' ? 'active' : ''}`}
            >
              <List size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('gallery')}
              title={t('media.view_grid', 'Galeri Görünümü')}
              aria-label={t('media.view_grid', 'Galeri Görünümü')}
              aria-pressed={viewMode === 'gallery'}
              className={`segmented-item ${viewMode === 'gallery' ? 'active' : ''}`}
            >
              <LayoutGrid size={16} aria-hidden="true" />
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
          <div className="fin-table-container" style={{ marginTop: '0.1rem' }}>
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
                {paginatedItems.map(item => {
                  const photo = getPhoto(item);
                  return (
                  <tr key={item.id}>
                    <td>
                      {photo ? (
                        <img 
                          src={photo} 
                          alt={item.title} 
                          style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer', border: '1px solid var(--glass-border)' }} 
                          onClick={() => setSelectedImage(photo)}
                        />
                      ) : (
                        <div style={{ 
                          width: '45px', 
                          height: '45px', 
                          borderRadius: '6px', 
                          background: 'var(--surface-subtle)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          color: 'var(--text-muted)',
                          fontSize: '1.2rem',
                          border: '1px dashed var(--surface-hover)'
                        }}>
                          
                        </div>
                      )}
                    </td>
                    <td style={{ fontWeight: '500' }}>
                      {item.title}
                    </td>
                    <td>
                      <span className={`pill ${item.type === 'report' ? 'pill-danger' : 'pill-success'}`}>
                        {item.typeLabel}
                      </span>
                    </td>
                    <td>
                       {formatDate(item.date, i18n.language)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {photo ? (
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => setSelectedImage(photo)}
                          title={t('common.view', 'Görüntüle')}
                          aria-label={t('common.view', 'Görüntüle')}
                        >
                          <Eye size={15} aria-hidden="true" />
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>-</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Gallery/Grid View */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.5rem' }}>
            {paginatedItems.map(item => {
              const photo = getPhoto(item);
              return (
              <div 
                key={item.id} 
                className="glass-card" 
                style={{ 
                  padding: '0.5rem', 
                  overflow: 'hidden', 
                  cursor: photo ? 'pointer' : 'default',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onClick={() => photo && setSelectedImage(photo)}
              >
                {photo ? (
                  <img 
                    src={photo} 
                    alt={item.title} 
                    style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px' }} 
                  />
                ) : (
                  <div style={{ 
                    width: '100%', 
                    height: '140px', 
                    borderRadius: '8px', 
                    background: 'var(--surface-subtle)', 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: 'var(--text-muted)',
                    fontSize: '2rem',
                    border: '1px dashed var(--surface-hover)'
                  }}>
                    
                    <span style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>{t('media.no_image', 'Görsel Yok')}</span>
                  </div>
                )}
                <div style={{ padding: '0.5rem 0.25rem 0.25rem 0.25rem' }}>
                  <span className={`pill ${item.type === 'report' ? 'pill-danger' : 'pill-success'}`}>
                    {item.typeLabel}
                  </span>
                  <h4 style={{ fontSize: '0.85rem', margin: '0.5rem 0 0.25rem 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                    {item.title}
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}> {formatDate(item.date, i18n.language)}</span>
                </div>
              </div>
              );
            })}
          </div>
        )}

        {/* Pagination - shared component (ui/Pagination) */}
        <Pagination currentPage={validCurrentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalRecords={totalItems} />
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
