import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from './ui/ConfirmationModal';
import GuideDrawer from './ui/GuideDrawer';
import apiWrite from '../utils/apiWrite';
import { logError } from '../utils/logger';
import PageGuideIcon from './ui/PageGuideIcon';
import Pagination from './ui/Pagination';
import { Check, GripVertical, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react';

const ProjectManagement = ({ onSelectProject, activeProjectId }) => {
  const { t } = useTranslation();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({ name: '', location: '' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null });
  const [helpOpen, setHelpOpen] = useState(false);
  const containerRef = useRef(null);

  // Search & Pagination states
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Drag and Drop States
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Edit Project States
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editFormData, setEditFormData] = useState({ name: '', location: '' });

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage]);

  // Guards against stale responses overwriting newer data after rapid re-fetches.
  const requestIdRef = useRef(0);

  const fetchProjects = async () => {
    if (window.api && window.api.db) {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      try {
        const data = await window.api.db.read('projects');
        if (requestId !== requestIdRef.current) return;
        setProjects(data || []);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        logError('Project list fetch failed:', err);
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: { message: t('projects.load_error', 'Şantiye listesi yüklenemedi.'), type: 'error' }
        }));
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  const fetchProjectsSilent = async () => {
    if (window.api && window.api.db) {
      const requestId = ++requestIdRef.current;
      try {
        const data = await window.api.db.read('projects');
        if (requestId !== requestIdRef.current) return;
        setProjects(data || []);
      } catch (err) {
        // Silent refresh: a failure is reported by the next visible fetch.
        logError('Silent project refresh failed:', err);
      }
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // A drag interrupted by navigation could leave the global cursor class behind.
  useEffect(() => () => {
    document.body.classList.remove('dragging');
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) return;
    if (window.api && window.api.db) {
      const res = await apiWrite(window.api.db.create('projects', {
        name: formData.name,
        location: formData.location,
        status: 'active'
      }));
      if (res && res.success === false) return;
      setFormData({ name: '', location: '' });
      fetchProjects();
    }
  };

  const handleDelete = (id) => {
    setConfirmModal({
      isOpen: true,
      id
    });
  };

  const confirmDelete = async () => {
    if (window.api && window.api.db && confirmModal.id) {
      const res = await apiWrite(window.api.db.delete('projects', confirmModal.id));
      if (res && res.success === false) return;
      if (confirmModal.id === activeProjectId) {
        onSelectProject(null);
      }
      setConfirmModal({ isOpen: false, id: null });
      fetchProjects();
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e, index) => {
    const globalIdx = (currentPage - 1) * itemsPerPage + index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', globalIdx);
    document.body.classList.add('dragging');
    setTimeout(() => {
      setDraggedIndex(globalIdx);
    }, 0);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    const globalIdx = (currentPage - 1) * itemsPerPage + index;
    if (globalIdx !== dragOverIndex) {
      setDragOverIndex(globalIdx);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    document.body.classList.remove('dragging');
  };

  const handleDrop = async (e, index) => {
    e.preventDefault();
    document.body.classList.remove('dragging');
    const targetGlobalIdx = (currentPage - 1) * itemsPerPage + index;
    if (draggedIndex === null || draggedIndex === targetGlobalIdx) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...projects];
    const [draggedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetGlobalIdx, 0, draggedItem);

    // Optimistic state update to make drag-and-drop feel instant
    setProjects(updated);
    setDraggedIndex(null);
    setDragOverIndex(null);

    if (window.api && window.api.db) {
      // Save order silently to avoid page jumping and skeleton loader flashes.
      // One toast per row would be noise; the optimistic order is re-fetched
      // afterwards, so any rejected row is corrected from the DB below.
      // The writes are independent, so they run together instead of one
      // round-trip per project (a 40-project reorder took 40 IPC trips).
      await Promise.all(updated.map((proj, i) =>
        apiWrite(
          window.api.db.update('projects', proj.id, { sort_order: i }),
          { silent: true }
        )
      ));
      await fetchProjectsSilent();
    }
  };

  // Edit Handlers
  const handleStartEdit = (proj) => {
    setEditingProjectId(proj.id);
    setEditFormData({ name: proj.name, location: proj.location || '' });
  };

  const handleCancelEdit = () => {
    setEditingProjectId(null);
    setEditFormData({ name: '', location: '' });
  };

  const handleSaveEdit = async (projId) => {
    if (!editFormData.name.trim()) return;

    if (window.api && window.api.db) {
      const res = await apiWrite(window.api.db.update('projects', projId, {
        name: editFormData.name.trim(),
        location: editFormData.location.trim()
      }));
      if (res && res.success === false) return;
      setEditingProjectId(null);
      setEditFormData({ name: '', location: '' });
      await fetchProjectsSilent();
    }
  };

  // Filter and paginate projects (memoized - ran on every render before).
  const filteredProjects = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return projects.filter(p =>
      p.name.toLowerCase().includes(query) ||
      (p.location && p.location.toLowerCase().includes(query))
    );
  }, [projects, searchQuery]);

  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const paginatedProjects = filteredProjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <>
    <div ref={containerRef} className="glass-card project-panel" style={{ position: 'relative' }}>
      <header className="page-head">
        <div>
          <h1 className="page-head-title">{t('projects.title', 'Şantiyeler')}</h1>
          <p className="page-head-sub">
            {t('projects.subtitle', 'Her şantiye kendi personelini, malzemesini, puantajını ve kasasını ayrı tutar.')}
          </p>
        </div>
        <PageGuideIcon onClick={() => setHelpOpen(true)} />
      </header>

      {/* Add Project Form */}
      <form onSubmit={handleSubmit} className="project-form">
        <div className="form-group" style={{ flex: 2, marginBottom: 0, minWidth: '200px' }}>
          <label className="form-label">{t('projects.name_label', 'Site or project name')}</label>
          <input
            type="text"
            className="form-input"
            placeholder={t('projects.name_ph', 'Ex: Northern motorway viaduct')}
            value={formData.name}
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            required
          />
        </div>
        <div className="form-group" style={{ flex: 1.5, marginBottom: 0, minWidth: '150px' }}>
          <label className="form-label">{t('projects.location_label', 'Location or address')}</label>
          <input
            type="text"
            className="form-input"
            placeholder={t('projects.location_ph', 'Ex: Istanbul / Catalca')}
            value={formData.location}
            onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
          />
        </div>
        <button type="submit" className="btn btn-primary">
          <Plus size={16} /> {t('projects.add_btn', 'Add site')}
        </button>
      </form>

      {/* Search Bar */}
      {projects.length > 0 && (
        <div style={{ marginBottom: '1.5rem', position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            type="text"
            className="form-input"
            placeholder={t('projects.search_placeholder', 'Şantiyelerde ara...')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingRight: '2.5rem', width: '100%' }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '12px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '1rem',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}
              title={t('common.clear', 'Temizle')}
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {/* Projects List */}
      {loading ? (
        <div className="skeleton" style={{ height: '150px', width: '100%' }}></div>
      ) : filteredProjects.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-icon"><MapPin size={22} /></span>
          <strong>{searchQuery ? t('common.no_results', 'No results') : t('projects.empty_title', 'No sites yet')}</strong>
          <span>
            {searchQuery
              ? t('projects.empty_search', 'No site matches that search.')
              : t('projects.empty_state', 'Add your first site with the form above, then start recording people, materials and cash against it.')}
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {paginatedProjects.map((proj, idx) => {
            const isActive = proj.id === activeProjectId;
            const globalIndex = projects.findIndex(p => p.id === proj.id);
            const isDragging = globalIndex === draggedIndex;
            const isDragOver = globalIndex === dragOverIndex;
            const isEditing = proj.id === editingProjectId;
            return (
              <div 
                key={proj.id} 
                className={`site-row${isActive ? ' is-active' : ''}${isDragging ? ' is-dragging' : ''}${isDragOver ? ' is-drag-over' : ''}`}
                draggable={!searchQuery && !isEditing}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, idx)}
                style={{ cursor: !searchQuery && !isEditing ? 'move' : 'default' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                  {!searchQuery && !isEditing && (
                    <span className="site-row-handle" title={t('projects.drag_to_reorder', 'Sürükleyerek yeniden sırala')}>
                      <GripVertical size={15} aria-hidden="true" />
                    </span>
                  )}
                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, paddingRight: '1rem' }} onDragStart={(e) => e.stopPropagation()} draggable={false}>
                      <input 
                        type="text" 
                        className="form-input" 
                        value={editFormData.name} 
                        onChange={e => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                        style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem', width: '100%', maxWidth: '350px', marginBottom: 0 }}
                        required
                        placeholder={t('projects.name_label', 'Şantiye / Proje Adı')}
                      />
                      <input 
                        type="text" 
                        className="form-input" 
                        value={editFormData.location} 
                        onChange={e => setEditFormData(prev => ({ ...prev, location: e.target.value }))}
                        style={{ fontSize: '0.85rem', padding: '0.3rem 0.8rem', width: '100%', maxWidth: '350px', marginBottom: 0 }}
                        placeholder={t('projects.location_label', 'Lokasyon / Adres')}
                      />
                    </div>
                  ) : (
                    <div style={{ minWidth: 0 }}>
                      <h3 className="site-row-title">
                        {proj.name}
                        {isActive && <span className="pill pill-accent">{t('projects.active_workspace', 'Aktif Çalışma Alanı')}</span>}
                      </h3>
                      <p className="site-row-meta">{proj.location || t('projects.location_unspecified', 'Lokasyon belirtilmemiş')}</p>
                    </div>
                  )}
                </div>
                <div className="row-actions" onDragStart={(e) => e.stopPropagation()} draggable={false}>
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveEdit(proj.id);
                        }}
                        draggable={false}
                        onDragStart={(e) => e.stopPropagation()}
                        title={t('common.save', 'Kaydet')}
                        aria-label={t('common.save', 'Kaydet')}
                      >
                        <Check size={15} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelEdit();
                        }}
                        draggable={false}
                        onDragStart={(e) => e.stopPropagation()}
                        title={t('common.cancel', 'Vazgeç')}
                        aria-label={t('common.cancel', 'Vazgeç')}
                      >
                        <X size={15} aria-hidden="true" />
                      </button>
                    </>
                  ) : (
                    <>
                      {!isActive && (
                        <button
                          type="button"
                          className="btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectProject(proj.id);
                          }}
                          draggable={false}
                          onDragStart={(e) => e.stopPropagation()}
                        >
                          {t('projects.select_workspace', 'Çalışma Alanı Seç')}
                        </button>
                      )}
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(proj);
                        }}
                        draggable={false}
                        onDragStart={(e) => e.stopPropagation()}
                        title={t('common.edit', 'Düzenle')}
                        aria-label={t('common.edit', 'Düzenle')}
                      >
                        <Pencil size={15} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="icon-btn is-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(proj.id);
                        }}
                        draggable={false}
                        onDragStart={(e) => e.stopPropagation()}
                        title={t('common.delete', 'Sil')}
                        aria-label={t('common.delete', 'Sil')}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Pagination - shared component (ui/Pagination) */}
          <Pagination variant="sticky" align="center" currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      )}
    </div>

    <ConfirmationModal 
      isOpen={confirmModal.isOpen}
      onClose={() => setConfirmModal({ isOpen: false, id: null })}
      onConfirm={confirmDelete}
      title={t('projects.delete_title', 'Şantiyeyi Sil')}
      message={t('projects.delete_msg', 'Bu şantiyeyi silmek istediğinize emin misiniz? Şantiyeye bağlı veriler doğrudan silinmez ancak listelerden gizlenir.')}
    />

    <GuideDrawer 
      isOpen={helpOpen} 
      onClose={() => setHelpOpen(false)} 
      title={t('guides.site.title', 'Şantiye & Çalışma Alanı Rehberi (5N1K)')} 
      desc="" 
      h1={t('guides.site.q1.title', '1. NE? (Şantiye/Çalışma Alanı Yönetimi Nedir?)')} 
      p1={t('guides.site.q1.desc', 'Projenizin yürütüldüğü fiziki lokasyonları sisteme tanımlayarak verileri şantiye bazlı ayrıştırmanızı sağlayan yönetim panelidir.')} 
      h2={t('guides.site.q2.title', '2. NEREDE? (Şantiye Verileri Nerede Depolanır?)')} 
      p2={t('guides.site.q2.desc', 'Eklenen tüm şantiyeler ve bu şantiyelere bağlı tüm hareketler yerel veritabanında saklanır.')} 
      h3={t('guides.site.q3.title', '3. NE ZAMAN? (Yeni Şantiye Ne Zaman Tanımlanmalıdır?)')} 
      p3={t('guides.site.q3.desc', 'Fiziki olarak yeni bir şantiye sahası açıldığında veya taşeron/personel atamaları yapılmadan önce sisteme girilmelidir.')} 
      h4={t('guides.site.q4.title', '4. NASIL? (Şantiye Nasıl Seçilir, Sıralanır ve Yönetilir?)')} 
      p4={t('guides.site.q4.desc', 'Üstteki formla yeni şantiye ekleyebilir, listeden sürükle-bırak yöntemiyle sırasını değiştirebilir ve \'Çalışma Alanı Seç\' ile o şantiyeyi aktif hale getirebilirsiniz.')} 
      h5={t('guides.site.q5.title', '5. NEDEN? (Neden Şantiye Bazlı Çalışma Alanları Oluşturulmalıdır?)')} 
      p5={t('guides.site.q5.desc', 'Tüm günlük jurnalleri, puantajları, kasa işlemlerini ve malzeme hareketlerini birbirine karıştırmadan, bağımsız raporlayabilmek için şantiye bazlı çalışılır.')} 
      h6={t('guides.site.q6.title', '6. KİM? (Şantiye Listesini Kimler Yönetebilir?)')} 
      p6={t('guides.site.q6.desc', 'Firma sahipleri, genel koordinatörler ve merkez ofis yetkilileri yeni şantiye tanımlayabilir, düzenleyebilir veya silebilir.')} 
    />
    </>
  );
};

export default ProjectManagement;
