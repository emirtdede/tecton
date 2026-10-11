import React from 'react';

const ProjectList = ({ t, projects, searchQuery, setSearchQuery, loading, filteredProjects, paginatedProjects, totalPages, currentPage, setCurrentPage, activeProjectId, draggedIndex, dragOverIndex, editingProjectId, editFormData, setEditFormData, onDragStart, onDragOver, onDragEnd, onDrop, onSelectProject, onStartEdit, onCancelEdit, onSaveEdit, onDelete }) => {
  return (
    <>
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
                onDragStart={(e) => onDragStart(e, idx)}
                onDragOver={(e) => onDragOver(e, idx)}
                onDragEnd={onDragEnd}
                onDrop={(e) => onDrop(e, idx)}
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
                  cursor: !searchQuery && !isEditing ? 'move' : 'default'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                  {!searchQuery && !isEditing && (
                    <div
                      className="project-drag-handle"
                      style={{
                        color: 'var(--text-muted)',
                        cursor: 'move',
                        fontSize: '1.2rem',
                        userSelect: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0.25rem',
                        opacity: 0.5,
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = 'var(--guide-icon-opacity-hover, 1)'}
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
                      <h3 className="card-title" style={{ color: isActive ? 'var(--accent)' : 'var(--text-main)', marginBottom: '0.25rem' }}>
                        {proj.name} {isActive && <span style={{ fontSize: '0.75rem', background: 'var(--accent)', padding: '2px 8px', borderRadius: '10px', marginLeft: '0.5rem', color: 'var(--accent-text)' }}>{t('projects.active_workspace', 'AKTİF ÇALIŞMA ALANI')}</span>}
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
                          onSaveEdit(proj.id);
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
                          onCancelEdit();
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
                          onStartEdit(proj);
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
                          onDelete(proj.id);
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
    </>
  );
};

export default ProjectList;
