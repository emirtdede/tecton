import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from './ui/ConfirmationModal';
import GuideDrawer from './ui/GuideDrawer';

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

  const fetchProjects = async () => {
    if (window.api && window.api.db) {
      setLoading(true);
      const data = await window.api.db.read('projects');
      setProjects(data);
      setLoading(false);
    }
  };

  const fetchProjectsSilent = async () => {
    if (window.api && window.api.db) {
      const data = await window.api.db.read('projects');
      setProjects(data);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) return;
    if (window.api && window.api.db) {
      await window.api.db.create('projects', {
        name: formData.name,
        location: formData.location,
        status: 'active'
      });
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
      await window.api.db.delete('projects', confirmModal.id);
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
    setDraggedIndex(globalIdx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', globalIdx);
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
  };

  const handleDrop = async (e, index) => {
    e.preventDefault();
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
      // Save order silently to avoid page jumping and skeleton loader flashes
      for (let i = 0; i < updated.length; i++) {
        await window.api.db.update('projects', updated[i].id, { sort_order: i });
      }
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
      await window.api.db.update('projects', projId, {
        name: editFormData.name.trim(),
        location: editFormData.location.trim()
      });
      setEditingProjectId(null);
      setEditFormData({ name: '', location: '' });
      await fetchProjectsSilent();
    }
  };

  // Filter and paginated projects
  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.location && p.location.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const paginatedProjects = filteredProjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <>
    <div ref={containerRef} className="glass-card" style={{ maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
      <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="card-title" style={{ fontSize: '1.5rem', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🏗️ {t('projects.title', 'Şantiye (Lokasyon) Yönetimi')}
        </h2>
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
      </header>

      {/* Add Project Form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ flex: 2, marginBottom: 0, minWidth: '200px' }}>
          <label className="form-label">{t('projects.name_label', 'Şantiye / Proje Adı')}</label>
          <input 
            type="text" 
            className="form-input" 
            placeholder={t('projects.name_ph', 'Örn: Kuzey Otoyolu Viyadük İnşaatı')} 
            value={formData.name}
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            required
          />
        </div>
        <div className="form-group" style={{ flex: 1.5, marginBottom: 0, minWidth: '150px' }}>
          <label className="form-label">{t('projects.location_label', 'Lokasyon / Adres')}</label>
          <input 
            type="text" 
            className="form-input" 
            placeholder={t('projects.location_ph', 'Örn: İstanbul / Çatalca')} 
            value={formData.location}
            onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
          />
        </div>
        <button type="submit" className="btn btn-primary" style={{ height: '42px' }}>{t('projects.add_btn', 'Proje Ekle')}</button>
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
              ✕
            </button>
          )}
        </div>
      )}

      {/* Projects List */}
      {loading ? (
        <div className="skeleton" style={{ height: '150px', width: '100%' }}></div>
      ) : filteredProjects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          {searchQuery ? t('common.no_results', 'Sonuç bulunamadı.') : t('projects.empty_state', 'Kayıtlı şantiye bulunamadı. Yukarıdaki formdan ilk şantiyenizi ekleyebilirsiniz.')}
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
                className="glass-card" 
                draggable={!searchQuery && !isEditing}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, idx)}
                style={{ 
                  flexDirection: 'row', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  border: isDragging 
                    ? '1px dashed var(--primary)' 
                    : isDragOver 
                    ? '1px solid var(--primary)' 
                    : isActive 
                    ? '1px solid var(--primary)' 
                    : '1px solid var(--glass-border)',
                  background: isDragging
                    ? 'transparent'
                    : isDragOver
                    ? 'rgba(139, 92, 246, 0.1)'
                    : isActive 
                    ? 'rgba(139, 92, 246, 0.05)' 
                    : 'var(--glass-bg)',
                  padding: '1.25rem',
                  opacity: isDragging ? 0.5 : 1,
                  transform: isDragging ? 'scale(0.98)' : 'none',
                  transition: 'all 0.2s ease',
                  cursor: !searchQuery && !isEditing ? 'grab' : 'default'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                  {!searchQuery && !isEditing && (
                    <div 
                      style={{ 
                        color: 'var(--text-muted)', 
                        cursor: 'grab', 
                        fontSize: '1.2rem',
                        userSelect: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0.25rem',
                        opacity: 0.5,
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = 1}
                      onMouseLeave={e => e.currentTarget.style.opacity = 0.5}
                      title={t('projects.drag_to_reorder', 'Sürükleyerek yeniden sırala')}
                    >
                      ⋮⋮
                    </div>
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
                    <div>
                      <h3 className="card-title" style={{ color: isActive ? '#c4b5fd' : '#fff', marginBottom: '0.25rem' }}>
                        {proj.name} {isActive && <span style={{ fontSize: '0.75rem', background: 'var(--primary)', padding: '2px 8px', borderRadius: '10px', marginLeft: '0.5rem', color: '#fff' }}>{t('projects.active_workspace', 'AKTİF ÇALIŞMA ALANI')}</span>}
                      </h3>
                      <p className="card-subtitle" style={{ margin: 0 }}>📍 {proj.location || t('projects.location_unspecified', 'Lokasyon belirtilmemiş')}</p>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }} onDragStart={(e) => e.stopPropagation()} draggable={false}>
                  {isEditing ? (
                    <>
                      <button 
                        className="btn btn-primary" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveEdit(proj.id);
                        }}
                        style={{ width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        draggable={false}
                        onDragStart={(e) => e.stopPropagation()}
                        title={t('common.save', 'Kaydet')}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </button>
                      <button 
                        className="btn" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelEdit();
                        }}
                        style={{ width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)' }}
                        draggable={false}
                        onDragStart={(e) => e.stopPropagation()}
                        title={t('common.cancel', 'Vazgeç')}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </>
                  ) : (
                    <>
                      {!isActive && (
                        <button 
                          className="btn" 
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectProject(proj.id);
                          }}
                          style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem', height: '28px', display: 'flex', alignItems: 'center' }}
                          draggable={false}
                          onDragStart={(e) => e.stopPropagation()}
                        >
                          {t('projects.select_workspace', 'Çalışma Alanı Seç')}
                        </button>
                      )}
                      <button 
                        className="btn" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(proj);
                        }}
                        style={{ width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 255, 255, 0.05)' }}
                        draggable={false}
                        onDragStart={(e) => e.stopPropagation()}
                        title={t('common.edit', 'Düzenle')}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button 
                        className="btn btn-danger" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(proj.id);
                        }}
                        style={{ width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        draggable={false}
                        onDragStart={(e) => e.stopPropagation()}
                        title={t('common.delete', 'Sil')}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{
              position: 'sticky',
              bottom: 0,
              background: 'var(--option-bg, #0f172a)',
              borderTop: '1px solid var(--glass-border)',
              zIndex: 10,
              padding: '1rem',
              marginTop: '1rem',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '1rem',
              backdropFilter: 'blur(10px)',
              borderRadius: '0 0 12px 12px'
            }}>
              <button 
                className="btn" 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
              >
                {t('common.prev', 'Önceki')}
              </button>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {t('common.page_info', 'Sayfa')} {currentPage} / {totalPages}
              </span>
              <button 
                className="btn" 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
              >
                {t('common.next', 'Sonraki')}
              </button>
            </div>
          )}
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
