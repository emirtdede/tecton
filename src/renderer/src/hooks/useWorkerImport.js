import React, { useState, useRef } from 'react';
import { readWorkersFromExcel } from '../utils/importUtils';

export function useWorkerImport({ t, workers, workerGroups, activeProjectId, onDataChanged }) {
  const [undoAvailable, setUndoAvailable] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const result = await readWorkersFromExcel(file, t);
      if (result.success) {
        if (window.api && window.api.system.createSnapshot) {
          await window.api.system.createSnapshot();
        }

        // Get a mutable local copy of current worker groups and workers
        let localGroups = [...workerGroups];
        let currentWorkersList = [...workers];

        for (const worker of result.data) {
          const { group_name, ...cleanWorker } = worker;
          let resolvedGroupId = null;

          if (group_name) {
            const trimmedName = group_name.trim();
            const lowerName = trimmedName.toLowerCase();
            const matchedGroup = localGroups.find(
              (g) => g.name && g.name.trim().toLowerCase() === lowerName
            );

            if (matchedGroup) {
              resolvedGroupId = matchedGroup.id;
            } else {
              // Create new group in the database
              const createRes = await window.api.db.create('worker_groups', { name: trimmedName });
              if (createRes && createRes.success) {
                resolvedGroupId = createRes.id;
                localGroups.push({ id: createRes.id, name: trimmedName });
              }
            }
          }

          // Check if worker already exists using professional identity matching rules
          const incomingTc = cleanWorker.tc_no ? cleanWorker.tc_no.trim() : '';
          const incomingPhone = cleanWorker.phone ? cleanWorker.phone.replace(/\D/g, '') : '';
          const incomingName = cleanWorker.full_name.trim().toLowerCase();

          const existingWorker = currentWorkersList.find(w => {
            const existingTc = w.tc_no ? w.tc_no.trim() : '';
            const existingPhone = w.phone ? w.phone.replace(/\D/g, '') : '';
            const existingName = w.full_name.trim().toLowerCase();

            // 1. Match by TC No (must be non-empty)
            if (incomingTc && existingTc && incomingTc === existingTc) {
              return true;
            }
            // 2. Match by Phone (must be non-empty)
            if (incomingPhone && existingPhone && incomingPhone === existingPhone) {
              return true;
            }
            // 3. Match by Name if both TC and Phone match or are empty (meaning no conflict)
            if (incomingName === existingName) {
              const tcConflict = incomingTc && existingTc && incomingTc !== existingTc;
              const phoneConflict = incomingPhone && existingPhone && incomingPhone !== existingPhone;
              if (!tcConflict && !phoneConflict) {
                return true;
              }
            }
            return false;
          });

          if (existingWorker) {
            const updateData = {
              full_name: cleanWorker.full_name,
              tc_no: cleanWorker.tc_no || existingWorker.tc_no,
              phone: cleanWorker.phone || existingWorker.phone,
              daily_wage: cleanWorker.daily_wage || existingWorker.daily_wage,
              group_id: resolvedGroupId || existingWorker.group_id,
              start_date: cleanWorker.start_date || existingWorker.start_date,
              status: cleanWorker.status || existingWorker.status,
              tags: cleanWorker.tags, // Overwrite with Excel tags so edits/deletions take effect!
              project_id: activeProjectId, // Bind to active project
              isg_start_date: cleanWorker.isg_start_date || existingWorker.isg_start_date,
              isg_bitis_tarihi: cleanWorker.isg_bitis_tarihi || existingWorker.isg_bitis_tarihi
            };

            await window.api.db.update('workers', existingWorker.id, updateData);

            // Update local list to prevent duplicate matching within the same batch
            const idx = currentWorkersList.findIndex(w => w.id === existingWorker.id);
            if (idx !== -1) {
              currentWorkersList[idx] = { ...existingWorker, ...updateData };
            }
          } else {
            // Create new worker
            const createRes = await window.api.db.create('workers', {
              ...cleanWorker,
              group_id: resolvedGroupId,
              project_id: activeProjectId
            });

            if (createRes && createRes.success) {
              currentWorkersList.push({
                id: createRes.id,
                ...cleanWorker,
                group_id: resolvedGroupId,
                project_id: activeProjectId
              });
            }
          }
        }
        onDataChanged();
        setUndoAvailable(true);
        e.target.value = null; // reset
        setTimeout(() => setUndoAvailable(false), 15000);
      }
    } catch (err) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('common.error_occurred', 'Hata:') + ' ' + err.message, type: 'error' } }));
      e.target.value = null;
    }
  };

  const handleUndoImport = async () => {
    if (window.api && window.api.system.restoreSnapshot) {
      const res = await window.api.system.restoreSnapshot();
      if (res.success) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('dashboard.undo_success', 'İşlem başarıyla geri alındı!'), type: 'success' } }));
        setUndoAvailable(false);
        onDataChanged();
      } else {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('dashboard.undo_error', 'Geri alma başarısız oldu:') + ' ' + res.message, type: 'error' } }));
      }
    }
  };

  return { fileInputRef, undoAvailable, handleFileUpload, handleUndoImport };
}
