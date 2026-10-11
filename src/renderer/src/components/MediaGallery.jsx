import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import LightboxModal from './ui/LightboxModal';
import GuideDrawer from './ui/GuideDrawer';
import { formatDate, trLower } from '../utils/formatUtils';
import MediaFilters from './MediaFilters';
import MediaViews from './MediaViews';

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
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  const handleStartDateChange = (val) => {
    setFilterStartDate(val);
    if (val && filterEndDate && new Date(val) > new Date(filterEndDate)) {
      setFilterEndDate(val);
    }
  };

  const handleEndDateChange = (val) => {
    setFilterEndDate(val);
    if (val && filterStartDate && new Date(filterStartDate) > new Date(val)) {
      setFilterStartDate(val);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, filterType, filterPhoto, filterStartDate, filterEndDate, activeProjectId]);

  // Filter and Sort logic
  const filteredItems = mediaItems.filter(item => {
    const formattedDate = formatDate(item.date, i18n.language);
    const query = trLower(searchQuery);
    const matchesSearch = !searchQuery ||
      trLower(item.title).includes(query) ||
      trLower(item.typeLabel).includes(query) ||
      trLower(formattedDate).includes(query);

    const matchesType = !filterType ||
      (filterType === 'material' && item.id.startsWith('material_')) ||
      (filterType === 'report' && item.id.startsWith('report_'));

    const matchesPhoto = !filterPhoto ||
      (filterPhoto === 'yes' && !!item.base64) ||
      (filterPhoto === 'no' && !item.base64);

    let matchesDate = true;
    if (filterStartDate) matchesDate = matchesDate && item.date >= filterStartDate;
    if (filterEndDate) matchesDate = matchesDate && item.date <= filterEndDate;

    return matchesSearch && matchesType && matchesPhoto && matchesDate;
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
        <h2>📷 {t('nav.media', 'Medya Galerisi')}</h2>
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
              opacity: 'var(--guide-icon-opacity, 0.4)', filter: 'var(--guide-icon-filter, none)',
              transition: 'opacity 0.25s ease-in-out',
              fontSize: '1.6rem',
              userSelect: 'none',
              padding: '0.25rem'
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = 'var(--guide-icon-opacity-hover, 1)'}
            onMouseLeave={e => e.currentTarget.style.opacity = 'var(--guide-icon-opacity, 0.4)'}
            title={t('common.page_guide', 'Sayfa Kılavuzu')}
          >
            💡
          </span>
        </div>
        <p className="card-subtitle active-project-subtitle" style={{ marginBottom: '0.75rem' }}>{t('common.active_project', 'Aktif Şantiye:')} <span style={{ color: 'var(--primary)', fontWeight: '600' }}>{activeProject?.name}</span></p>

        <MediaFilters
          t={t}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterStartDate={filterStartDate}
          onStartDateChange={handleStartDateChange}
          filterEndDate={filterEndDate}
          onEndDateChange={handleEndDateChange}
          sortBy={sortBy}
          setSortBy={setSortBy}
          filterType={filterType}
          setFilterType={setFilterType}
          filterPhoto={filterPhoto}
          setFilterPhoto={setFilterPhoto}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />

        <MediaViews
          t={t}
          i18n={i18n}
          loading={loading}
          viewMode={viewMode}
          paginatedItems={paginatedItems}
          totalItems={totalItems}
          totalPages={totalPages}
          validCurrentPage={validCurrentPage}
          setCurrentPage={setCurrentPage}
          onSelectImage={setSelectedImage}
        />
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
