import React, { useState } from 'react';
import { GripVertical, Edit2, Check, X, Trash2 } from 'lucide-react';

const SettingsFinanceTab = ({ t, appSettings, workTypes, workerGroups, fetchData, handleSettingChange, handleSettingBlur, setModalConfig }) => {
  // Form State for new items
  const [newWorkType, setNewWorkType] = useState({ name: '', multiplier: 1.0 });
  const [newGroup, setNewGroup] = useState({ name: '' });

  // Inline editing states
  const [editingWorkTypeId, setEditingWorkTypeId] = useState(null);
  const [editingWorkTypeVal, setEditingWorkTypeVal] = useState({ name: '', multiplier: 1.0 });

  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingGroupVal, setEditingGroupVal] = useState({ name: '' });

  // Drag and drop states
  const [draggedWorkTypeIdx, setDraggedWorkTypeIdx] = useState(null);
  const [dragOverWorkTypeIdx, setDragOverWorkTypeIdx] = useState(null);
  const [draggedGroupIdx, setDraggedGroupIdx] = useState(null);
  const [dragOverGroupIdx, setDragOverGroupIdx] = useState(null);

  // Add new Work Type
  const handleAddWorkType = async (e) => {
    e.preventDefault();
    if (window.api && newWorkType.name) {
      await window.api.db.create('work_types', newWorkType);
      setNewWorkType({ name: '', multiplier: 1.0 });
      fetchData();
    }
  };

  // Delete Work Type
  const handleDeleteWorkType = async (id) => {
    setModalConfig({
      isOpen: true,
      title: t('settings.delete_work_type_title', 'Çalışma Tipini Sil'),
      message: t('settings.delete_work_type_msg', 'Bu çalışma tipini silmek istediğinize emin misiniz? Eski puantajlardaki hesaplamalar veritabanına kaydedildiği için geçmiş verileriniz bozulmayacaktır.'),
      type: 'danger',
      onConfirm: async () => {
        await window.api.db.delete('work_types', id);
        fetchData();
      }
    });
  };

  // Add new Worker Group
  const handleAddGroup = async (e) => {
    e.preventDefault();
    if (window.api && newGroup.name) {
      await window.api.db.create('worker_groups', newGroup);
      setNewGroup({ name: '' });
      fetchData();
    }
  };

  // Delete Worker Group
  const handleDeleteGroup = async (id) => {
    setModalConfig({
      isOpen: true,
      title: t('settings.delete_group_title', 'İşçi Grubunu Sil'),
      message: t('settings.delete_group_msg', 'Bu grubu silmek istediğinize emin misiniz? Gruptaki işçilerin grup atamaları kaldırılacaktır (İşçiler silinmez).'),
      type: 'danger',
      onConfirm: async () => {
        await window.api.db.delete('worker_groups', id);
        fetchData();
      }
    });
  };

  // Reordering & Sorting helpers
  const saveCustomOrder = async (key, orderArray) => {
    if (window.api) {
      const orderString = JSON.stringify(orderArray);
      const existing = appSettings.find(s => s.setting_key === key);
      if (existing) {
        await handleSettingChange(existing.id, key, orderString);
      } else {
        const res = await window.api.db.create('app_settings', {
          setting_key: key,
          setting_value: orderString,
          description: 'Sıralama Düzeni'
        });
        if (res.success) {
          fetchData();
        }
      }
    }
  };

  const getSortedItems = (items, orderKey) => {
    const orderSetting = appSettings.find(s => s.setting_key === orderKey);
    if (!orderSetting || !orderSetting.setting_value) return items;
    try {
      const orderIds = JSON.parse(orderSetting.setting_value);
      return [...items].sort((a, b) => {
        const indexA = orderIds.indexOf(a.id);
        const indexB = orderIds.indexOf(b.id);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    } catch (e) {
      return items;
    }
  };

  const handleMoveItem = async (items, index, direction, orderKey) => {
    const newItems = [...items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;

    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    const newOrderIds = newItems.map(item => item.id);
    await saveCustomOrder(orderKey, newOrderIds);
  };

  // Edit Handlers for Work Types
  const startEditWorkType = (wt) => {
    setEditingWorkTypeId(wt.id);
    setEditingWorkTypeVal({ name: wt.name, multiplier: wt.multiplier });
  };

  const handleSaveWorkTypeEdit = async (id) => {
    if (window.api && editingWorkTypeVal.name) {
      await window.api.db.update('work_types', id, editingWorkTypeVal);
      setEditingWorkTypeId(null);
      fetchData();
    }
  };

  const handleCancelWorkTypeEdit = () => {
    setEditingWorkTypeId(null);
  };

  // Edit Handlers for Groups
  const startEditGroup = (grp) => {
    setEditingGroupId(grp.id);
    setEditingGroupVal({ name: grp.name });
  };

  const handleSaveGroupEdit = async (id) => {
    if (window.api && editingGroupVal.name) {
      await window.api.db.update('worker_groups', id, editingGroupVal);
      setEditingGroupId(null);
      fetchData();
    }
  };

  const handleCancelGroupEdit = () => {
    setEditingGroupId(null);
  };

  const sortedWorkTypes = getSortedItems(workTypes, 'work_types_order');
  const sortedWorkerGroups = getSortedItems(workerGroups, 'worker_groups_order');
  void handleMoveItem;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Standart Çalışma Parametreleri */}
      <div className="glass-card">
        <h3 className="card-title" style={{ marginBottom: '1.25rem' }}>{t('settings.parameters')}</h3>
        {appSettings.map(setting => {
          if (['theme', 'language', 'company_name', 'company_logo', 'custom_currency', 'custom_date_format', 'custom_time_format', 'cloud_sync_folder', 'clean_shutdown'].includes(setting.setting_key) || setting.setting_key.endsWith('_order')) return null;
          return (
            <div key={setting.id} className="form-group">
              <label className="form-label">{t(`settings.keys.${setting.setting_key}`) || setting.description || setting.setting_key}</label>
              <input
                type="text"
                className="form-input"
                value={setting.setting_value}
                onChange={(e) => handleSettingChange(setting.id, setting.setting_key, e.target.value)}
                onBlur={(e) => handleSettingBlur(setting.id, setting.setting_key, e.target.value)}
              />
            </div>
          );
        })}
      </div>

      {/* Çalışma Tipleri */}
      <div className="glass-card">
        <h3 className="card-title" style={{ marginBottom: '1rem' }}>{t('settings.work_types_title', 'Çalışma Tipleri & Çarpanlar')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {sortedWorkTypes.map((wt, idx) => {
            const isEditing = editingWorkTypeId === wt.id;
            return (
              <div
                key={wt.id}
                draggable={!isEditing}
                onDragStart={(e) => {
                  setDraggedWorkTypeIdx(idx);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverWorkTypeIdx !== idx) {
                    setDragOverWorkTypeIdx(idx);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverWorkTypeIdx === idx) {
                    setDragOverWorkTypeIdx(null);
                  }
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  if (draggedWorkTypeIdx === null || draggedWorkTypeIdx === idx) {
                    setDraggedWorkTypeIdx(null);
                    setDragOverWorkTypeIdx(null);
                    return;
                  }
                  const reordered = [...sortedWorkTypes];
                  const item = reordered[draggedWorkTypeIdx];
                  reordered.splice(draggedWorkTypeIdx, 1);
                  reordered.splice(idx, 0, item);
                  const newOrderIds = reordered.map(x => x.id);
                  await saveCustomOrder('work_types_order', newOrderIds);
                  setDraggedWorkTypeIdx(null);
                  setDragOverWorkTypeIdx(null);
                }}
                onDragEnd={() => {
                  setDraggedWorkTypeIdx(null);
                  setDragOverWorkTypeIdx(null);
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: draggedWorkTypeIdx === idx
                    ? 'rgba(99, 102, 241, 0.08)'
                    : 'rgba(255,255,255,0.02)',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  border: draggedWorkTypeIdx === idx
                    ? '1px dashed var(--primary, #6366f1)'
                    : dragOverWorkTypeIdx === idx
                      ? '1px solid var(--primary, #6366f1)'
                      : '1px solid var(--glass-border)',
                  gap: '1rem',
                  cursor: isEditing ? 'default' : 'grab',
                  opacity: draggedWorkTypeIdx === idx ? 0.5 : 1,
                  transform: draggedWorkTypeIdx !== null && dragOverWorkTypeIdx === idx && draggedWorkTypeIdx !== idx
                    ? `scale(1.01) ${draggedWorkTypeIdx < idx ? 'translateY(2px)' : 'translateY(-2px)'}`
                    : 'scale(1) translateY(0)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                {isEditing ? (
                  <div style={{ display: 'flex', gap: '1rem', flex: 1, alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ flex: 2, padding: '0.4rem 0.75rem' }}
                      value={editingWorkTypeVal.name}
                      onChange={e => setEditingWorkTypeVal(prev => ({ ...prev, name: e.target.value }))}
                    />
                    <input
                      type="number"
                      step="0.1"
                      className="form-input"
                      style={{ flex: 1, padding: '0.4rem 0.75rem' }}
                      value={editingWorkTypeVal.multiplier}
                      onChange={e => setEditingWorkTypeVal(prev => ({ ...prev, multiplier: Number(e.target.value) }))}
                    />
                    <button onClick={() => handleSaveWorkTypeEdit(wt.id)} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                      <Check size={14} />
                    </button>
                    <button onClick={handleCancelWorkTypeEdit} className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                      <GripVertical size={16} style={{ color: 'var(--text-muted)', opacity: 0.6, cursor: 'grab', flexShrink: 0 }} />
                      <div>
                        <strong>{wt.name}</strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Çarpan: x{wt.multiplier}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => startEditWorkType(wt)}
                        className="btn"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteWorkType(wt.id)}
                        className="btn btn-danger"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleAddWorkType} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', borderTop: '1px solid var(--glass-border)', paddingTop: '1.25rem' }}>
          <div style={{ flex: 2 }}>
            <label className="form-label">{t('settings.type_name_label', 'Çalışma Tipi Adı')}</label>
            <input
              type="text"
              className="form-input"
              value={newWorkType.name}
              onChange={e => setNewWorkType(prev => ({...prev, name: e.target.value}))}
              required
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="form-label">{t('multiplier', 'Çarpan')}</label>
            <input
              type="number"
              step="0.1"
              className="form-input"
              value={newWorkType.multiplier}
              onChange={e => setNewWorkType(prev => ({...prev, multiplier: Number(e.target.value)}))}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.25rem' }}>{t('settings.add', 'Ekle')}</button>
        </form>
      </div>

      {/* Gruplar */}
      <div className="glass-card">
        <h3 className="card-title" style={{ marginBottom: '1rem' }}>{t('settings.groups_title', 'İşçi Grupları')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {sortedWorkerGroups.map((grp, idx) => {
            const isEditing = editingGroupId === grp.id;
            return (
              <div
                key={grp.id}
                draggable={!isEditing}
                onDragStart={(e) => {
                  setDraggedGroupIdx(idx);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverGroupIdx !== idx) {
                    setDragOverGroupIdx(idx);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverGroupIdx === idx) {
                    setDragOverGroupIdx(null);
                  }
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  if (draggedGroupIdx === null || draggedGroupIdx === idx) {
                    setDraggedGroupIdx(null);
                    setDragOverGroupIdx(null);
                    return;
                  }
                  const reordered = [...sortedWorkerGroups];
                  const item = reordered[draggedGroupIdx];
                  reordered.splice(draggedGroupIdx, 1);
                  reordered.splice(idx, 0, item);
                  const newOrderIds = reordered.map(x => x.id);
                  await saveCustomOrder('worker_groups_order', newOrderIds);
                  setDraggedGroupIdx(null);
                  setDragOverGroupIdx(null);
                }}
                onDragEnd={() => {
                  setDraggedGroupIdx(null);
                  setDragOverGroupIdx(null);
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: draggedGroupIdx === idx
                    ? 'rgba(99, 102, 241, 0.08)'
                    : 'rgba(255,255,255,0.02)',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  border: draggedGroupIdx === idx
                    ? '1px dashed var(--primary, #6366f1)'
                    : dragOverGroupIdx === idx
                      ? '1px solid var(--primary, #6366f1)'
                      : '1px solid var(--glass-border)',
                  gap: '1rem',
                  cursor: isEditing ? 'default' : 'grab',
                  opacity: draggedGroupIdx === idx ? 0.5 : 1,
                  transform: draggedGroupIdx !== null && dragOverGroupIdx === idx && draggedGroupIdx !== idx
                    ? `scale(1.01) ${draggedGroupIdx < idx ? 'translateY(2px)' : 'translateY(-2px)'}`
                    : 'scale(1) translateY(0)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                {isEditing ? (
                  <div style={{ display: 'flex', gap: '1rem', flex: 1, alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ flex: 1, padding: '0.4rem 0.75rem' }}
                      value={editingGroupVal.name}
                      onChange={e => setEditingGroupVal(prev => ({ ...prev, name: e.target.value }))}
                    />
                    <button onClick={() => handleSaveGroupEdit(grp.id)} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                      <Check size={14} />
                    </button>
                    <button onClick={handleCancelGroupEdit} className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                      <GripVertical size={16} style={{ color: 'var(--text-muted)', opacity: 0.6, cursor: 'grab', flexShrink: 0 }} />
                      <strong>{grp.name}</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => startEditGroup(grp)}
                        className="btn"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(grp.id)}
                        className="btn btn-danger"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleAddGroup} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', borderTop: '1px solid var(--glass-border)', paddingTop: '1.25rem' }}>
          <div style={{ flex: 1 }}>
            <label className="form-label">{t('settings.group_name_label', 'Grup Adı')}</label>
            <input
              type="text"
              className="form-input"
              value={newGroup.name}
              onChange={e => setNewGroup(prev => ({...prev, name: e.target.value}))}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.25rem' }}>{t('settings.add', 'Ekle')}</button>
        </form>
      </div>
    </div>
  );
};

export default SettingsFinanceTab;
