import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from './ui/ConfirmationModal';
import GuideDrawer from './ui/GuideDrawer';
import ProjectForm from './ProjectForm';
import ProjectList from './ProjectList';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      </header>

      <ProjectForm t={t} formData={formData} setFormData={setFormData} onSubmit={handleSubmit} />

      <ProjectList
        t={t}
        projects={projects}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        loading={loading}
        filteredProjects={filteredProjects}
        paginatedProjects={paginatedProjects}
        totalPages={totalPages}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        activeProjectId={activeProjectId}
        draggedIndex={draggedIndex}
        dragOverIndex={dragOverIndex}
        editingProjectId={editingProjectId}
        editFormData={editFormData}
        setEditFormData={setEditFormData}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDrop={handleDrop}
        onSelectProject={onSelectProject}
        onStartEdit={handleStartEdit}
        onCancelEdit={handleCancelEdit}
        onSaveEdit={handleSaveEdit}
        onDelete={handleDelete}
      />
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
