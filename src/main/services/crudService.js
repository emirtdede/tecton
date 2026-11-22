const logger = require('../logger');
const { withTransaction } = require('../database/transaction');
const { cashTypeLabel } = require('./cashTypes');
const { ledgerTypeLabel } = require('./ledgerTypes');

// Allowlist of tables and their writable columns. Anything not listed is rejected,
// which prevents arbitrary table/column access from the renderer (SQL injection surface).
const TABLE_COLUMNS = {
  app_settings: ['setting_key', 'setting_value', 'description'],
  work_types: ['name', 'multiplier', 'is_active'],
  worker_groups: ['name', 'is_active'],
  workers: ['full_name', 'tc_no', 'phone', 'daily_wage', 'group_id', 'start_date', 'status', 'extra_data', 'project_id', 'isg_start_date', 'isg_bitis_tarihi', 'tags'],
  timesheets: ['worker_id', 'work_date', 'work_type_id', 'applied_wage', 'applied_multiplier', 'overtime_hours', 'earned_amount', 'notes', 'project_id', 'tags'],
  transactions: ['worker_id', 'trans_date', 'trans_type', 'amount', 'notes', 'linked_cash_id', 'project_id', 'tags'],
  cash_register: ['trans_date', 'type', 'amount', 'description', 'project_id', 'tags'],
  projects: ['name', 'location', 'status', 'sort_order'],
  production_records: ['project_id', 'item_name', 'quantity', 'unit', 'notes', 'record_date'],
  materials: ['project_id', 'supplier', 'material_type', 'quantity', 'unit', 'receipt_number', 'receipt_date', 'photo_path', 'notes', 'tags'],
  daily_journals: ['project_id', 'journal_date', 'weather_temp', 'weather_desc', 'weather_icon', 'notes', 'worker_count'],
  quality_reports: ['project_id', 'title', 'description', 'status', 'photo_path', 'report_date', 'tags'],
  subcontractor_ledgers: ['project_id', 'name', 'service_type', 'phone', 'daily_wage', 'status', 'isg_start_date', 'isg_expiry_date', 'tags'],
  subcontractor_transactions: ['subcontractor_id', 'trans_date', 'type', 'amount', 'description', 'project_id', 'linked_cash_id', 'tags'],
  worker_leaves: ['worker_id', 'project_id', 'start_date', 'end_date', 'type', 'description'],
  audit_logs: []
};

const READABLE_TABLES = new Set(Object.keys(TABLE_COLUMNS));

function assertTable(table) {
  if (!READABLE_TABLES.has(table)) {
    throw new Error(`Geçersiz tablo adı: ${table}`);
  }
}

function isKnownTable(table) {
  return READABLE_TABLES.has(table);
}

function assertColumn(table, column) {
  const columns = TABLE_COLUMNS[table] || [];
  if (column !== 'id' && column !== 'is_deleted' && !columns.includes(column)) {
    throw new Error(`Geçersiz kolon adı: ${table}.${column}`);
  }
}


function generateHumanMessage(table_name, action, old_values, new_values, lang = 'tr') {
  const isTr = lang === 'tr';

  const tMap = isTr ? {
    'workers': 'Personel',
    'worker_groups': 'Grup',
    'timesheets': 'Puantaj',
    'transactions': 'Avans/İşlem',
    'cash_register': 'Kasa İşlemi',
    'work_types': 'Çalışma Tipi',
    'app_settings': 'Sistem Ayarı',
    'projects': 'Şantiye',
    'production_records': 'İmalat/Metraj',
    'materials': 'Malzeme/İrsaliye',
    'daily_journals': 'Günlük Jurnal',
    'quality_reports': 'Kalite Tutanak',
    'subcontractor_ledgers': 'Taşeron Cari',
    'subcontractor_transactions': 'Taşeron İşlemi',
    'worker_leaves': 'Personel İzni'
  } : {
    'workers': 'Personnel',
    'worker_groups': 'Group',
    'timesheets': 'Timesheet',
    'transactions': 'Transaction/Advance',
    'cash_register': 'Cash Entry',
    'work_types': 'Work Type',
    'app_settings': 'System Setting',
    'projects': 'Project',
    'production_records': 'Production Record',
    'materials': 'Material Receipt',
    'daily_journals': 'Daily Journal',
    'quality_reports': 'Quality Report',
    'subcontractor_ledgers': 'Subcontractor Ledger',
    'subcontractor_transactions': 'Subcontractor Transaction',
    'worker_leaves': 'Personnel Leave'
  };

  const tName = tMap[table_name] || table_name;
  
  if (action === 'CREATE') {
    if (table_name === 'workers') return isTr ? `Yeni personel eklendi: ${new_values.full_name}` : `New personnel added: ${new_values.full_name}`;
    if (table_name === 'transactions') return isTr ? `Yeni avans/işlem eklendi. Tutar: ${new_values.amount} TL` : `New transaction/advance added. Amount: ${new_values.amount} TL`;
    if (table_name === 'cash_register') return isTr ? `Kasaya yeni işlem girildi. Tutar: ${new_values.amount} TL (${cashTypeLabel(new_values.type, true)})` : `New cash entry added. Amount: ${new_values.amount} TL (${cashTypeLabel(new_values.type, false)})`;
    if (table_name === 'timesheets') return isTr ? `Yeni puantaj girildi. Tarih: ${new_values.work_date}, Tutar: ${new_values.earned_amount} TL` : `New timesheet entry added. Date: ${new_values.work_date}, Earned: ${new_values.earned_amount} TL`;
    if (table_name === 'projects') return isTr ? `Yeni şantiye eklendi: ${new_values.name}${new_values.location ? ' (' + new_values.location + ')' : ''}` : `New project added: ${new_values.name}${new_values.location ? ' (' + new_values.location + ')' : ''}`;
    if (table_name === 'production_records') return isTr ? `Yeni imalat kaydı eklendi: ${new_values.item_name} - ${new_values.quantity} ${new_values.unit}` : `New production record added: ${new_values.item_name} - ${new_values.quantity} ${new_values.unit}`;
    if (table_name === 'materials') return isTr ? `Yeni malzeme girişi yapıldı: ${new_values.supplier} - ${new_values.material_type} (${new_values.quantity} ${new_values.unit})` : `New material receipt added: ${new_values.supplier} - ${new_values.material_type} (${new_values.quantity} ${new_values.unit})`;
    if (table_name === 'daily_journals') return isTr ? `Günlük jurnal oluşturuldu. Tarih: ${new_values.journal_date}, Sıcaklık: ${new_values.weather_temp || 0}°C (${new_values.weather_desc || ''})` : `Daily journal created. Date: ${new_values.journal_date}, Temperature: ${new_values.weather_temp || 0}°C (${new_values.weather_desc || ''})`;
    if (table_name === 'quality_reports') return isTr ? `Yeni kalite tutanağı eklendi: ${new_values.title} (Durum: ${new_values.status})` : `New quality report added: ${new_values.title} (Status: ${new_values.status})`;
    if (table_name === 'subcontractor_ledgers') return isTr ? `Yeni taşeron eklendi: ${new_values.name} (${new_values.service_type})` : `New subcontractor added: ${new_values.name} (${new_values.service_type})`;
    if (table_name === 'subcontractor_transactions') return isTr ? `Yeni taşeron işlemi eklendi (${ledgerTypeLabel(new_values.type, true)}). Tutar: ${new_values.amount} TL` : `New subcontractor transaction added (${ledgerTypeLabel(new_values.type, false)}). Amount: ${new_values.amount} TL`;
    if (table_name === 'worker_groups') return isTr ? `Yeni personel grubu eklendi: ${new_values.name}` : `New personnel group added: ${new_values.name}`;
    if (table_name === 'worker_leaves') return isTr ? `Yeni personel izni eklendi: ${new_values.start_date} / ${new_values.end_date} (${new_values.type})` : `New personnel leave added: ${new_values.start_date} / ${new_values.end_date} (${new_values.type})`;
    return isTr ? `Sisteme yeni bir ${tName} kaydı eklendi.` : `New ${tName} record added to system.`;
  }
  
  if (action === 'CREATE_BULK') {
    return new_values.logMessage || (isTr ? `Sisteme toplu ${tName} kaydı eklendi.` : `Bulk ${tName} records added to system.`);
  }
  
  if (action === 'UPDATE') {
    if (table_name === 'workers') {
      const name = new_values.full_name || (old_values && old_values.full_name) || (isTr ? 'Personel' : 'Personnel');
      // ISG Date Update Detection
      if (new_values.isg_bitis_tarihi !== undefined || new_values.isg_start_date !== undefined) {
        const isgEnd = new_values.isg_bitis_tarihi || (old_values && old_values.isg_bitis_tarihi) || '-';
        const isgStart = new_values.isg_start_date || (old_values && old_values.isg_start_date) || '-';
        return isTr 
          ? `${name} adlı personelin İSG tarihleri güncellendi. Başlangıç: ${isgStart}, Bitiş: ${isgEnd}` 
          : `OHS dates updated for ${name}. Start: ${isgStart}, End: ${isgEnd}`;
      }
      return isTr ? `${name} bilgileri güncellendi.` : `Personnel details updated: ${name}`;
    }
    if (table_name === 'app_settings') return isTr ? `Sistem ayarı güncellendi. Yeni Değer: ${new_values.setting_value}` : `System setting updated. New Value: ${new_values.setting_value}`;
    if (table_name === 'projects') {
      const oldName = old_values ? old_values.name : '';
      const oldLoc = old_values && old_values.location ? ` (${old_values.location})` : '';
      const newName = new_values.name || oldName;
      const newLoc = new_values.location !== undefined ? (new_values.location ? ` (${new_values.location})` : '') : oldLoc;
      return isTr 
        ? `Şantiye güncellendi: ${oldName}${oldLoc} -> ${newName}${newLoc}`
        : `Project updated: ${oldName}${oldLoc} -> ${newName}${newLoc}`;
    }
    if (table_name === 'production_records') {
      const name = new_values.item_name || (old_values && old_values.item_name) || '';
      const qty = new_values.quantity !== undefined ? new_values.quantity : (old_values ? old_values.quantity : '');
      const unit = new_values.unit || (old_values && old_values.unit) || '';
      return isTr
        ? `İmalat kaydı güncellendi: ${name} (${qty} ${unit})`
        : `Production record updated: ${name} (${qty} ${unit})`;
    }
    if (table_name === 'materials') {
      const supplier = new_values.supplier || (old_values && old_values.supplier) || '';
      const mType = new_values.material_type || (old_values && old_values.material_type) || '';
      const qty = new_values.quantity !== undefined ? new_values.quantity : (old_values ? old_values.quantity : '');
      const unit = new_values.unit || (old_values && old_values.unit) || '';
      return isTr
        ? `Malzeme girişi güncellendi: ${supplier} - ${mType} (${qty} ${unit})`
        : `Material receipt updated: ${supplier} - ${mType} (${qty} ${unit})`;
    }
    if (table_name === 'daily_journals') {
      const date = new_values.journal_date || (old_values && old_values.journal_date) || '';
      return isTr ? `Günlük jurnal güncellendi. Tarih: ${date}` : `Daily journal updated. Date: ${date}`;
    }
    if (table_name === 'quality_reports') {
      const title = new_values.title || (old_values && old_values.title) || '';
      const status = new_values.status || (old_values && old_values.status) || '';
      return isTr
        ? `Kalite tutanağı güncellendi: ${title} (Durum: ${status})`
        : `Quality report updated: ${title} (Status: ${status})`;
    }
    if (table_name === 'subcontractor_ledgers') {
      const name = new_values.name || (old_values && old_values.name) || '';
      const type = new_values.service_type || (old_values && old_values.service_type) || '';
      // ISG Date Update Detection
      if (new_values.isg_expiry_date !== undefined || new_values.isg_start_date !== undefined) {
        const isgEnd = new_values.isg_expiry_date || (old_values && old_values.isg_expiry_date) || '-';
        const isgStart = new_values.isg_start_date || (old_values && old_values.isg_start_date) || '-';
        return isTr 
          ? `${name} adlı taşeronun İSG tarihleri güncellendi. Başlangıç: ${isgStart}, Bitiş: ${isgEnd}` 
          : `OHS dates updated for subcontractor ${name}. Start: ${isgStart}, End: ${isgEnd}`;
      }
      return isTr
        ? `Taşeron bilgileri güncellendi: ${name} (${type})`
        : `Subcontractor details updated: ${name} (${type})`;
    }
    if (table_name === 'subcontractor_transactions') {
      const type = new_values.type || (old_values && old_values.type) || '';
      const amount = new_values.amount !== undefined ? new_values.amount : (old_values ? old_values.amount : 0);
      return isTr
        ? `Taşeron işlemi güncellendi (${ledgerTypeLabel(type, true)}). Tutar: ${amount} TL`
        : `Subcontractor transaction updated (${ledgerTypeLabel(type, false)}). Amount: ${amount} TL`;
    }
    if (table_name === 'worker_groups') {
      const oldName = old_values ? old_values.name : '';
      const newName = new_values.name || oldName;
      return isTr
        ? `Personel grubu güncellendi: ${oldName} -> ${newName}`
        : `Personnel group updated: ${oldName} -> ${newName}`;
    }
    if (table_name === 'timesheets') {
      const date = new_values.work_date || (old_values && old_values.work_date) || '';
      const earned = new_values.earned_amount !== undefined ? new_values.earned_amount : (old_values ? old_values.earned_amount : 0);
      return isTr
        ? `Puantaj güncellendi. Tarih: ${date}, Tutar: ${earned} TL`
        : `Timesheet updated. Date: ${date}, Amount: ${earned} TL`;
    }
    if (table_name === 'worker_leaves') {
      const type = new_values.type || (old_values && old_values.type) || '';
      return isTr ? `Personel izni güncellendi (${type}).` : `Personnel leave updated (${type}).`;
    }
    return isTr ? `Bir ${tName} kaydı güncellendi.` : `A ${tName} record was updated.`;
  }
  
  if (action === 'DELETE') {
    if (table_name === 'workers') return isTr ? `${old_values.full_name} isimli personel silindi.` : `Personnel deleted: ${old_values.full_name}`;
    if (table_name === 'transactions') return isTr ? `Bir avans/işlem iptal edildi. Tutar: ${old_values.amount} TL` : `Transaction/advance cancelled. Amount: ${old_values.amount} TL`;
    if (table_name === 'cash_register') return isTr ? `Kasadan bir işlem iptal edildi. Tutar: ${old_values.amount} TL (${old_values.type})` : `Cash entry cancelled. Amount: ${old_values.amount} TL (${old_values.type})`;
    if (table_name === 'timesheets') return isTr ? `${old_values.work_date} tarihli puantaj iptal edildi. Tutar: ${old_values.earned_amount} TL` : `Timesheet cancelled for date ${old_values.work_date}. Amount: ${old_values.earned_amount} TL`;
    if (table_name === 'projects') return isTr ? `Şantiye silindi: ${old_values.name}${old_values.location ? ' (' + old_values.location + ')' : ''}` : `Project deleted: ${old_values.name}${old_values.location ? ' (' + old_values.location + ')' : ''}`;
    if (table_name === 'production_records') return isTr ? `İmalat kaydı silindi: ${old_values.item_name} - ${old_values.quantity} ${old_values.unit}` : `Production record deleted: ${old_values.item_name} - ${old_values.quantity} ${old_values.unit}`;
    if (table_name === 'materials') return isTr ? `Malzeme girişi silindi: ${old_values.supplier} - ${old_values.material_type} (${old_values.quantity} ${old_values.unit})` : `Material receipt deleted: ${old_values.supplier} - ${old_values.material_type} (${old_values.quantity} ${old_values.unit})`;
    if (table_name === 'daily_journals') return isTr ? `Günlük jurnal silindi. Tarih: ${old_values.journal_date}` : `Daily journal deleted. Date: ${old_values.journal_date}`;
    if (table_name === 'quality_reports') return isTr ? `Kalite tutanağı silindi: ${old_values.title}` : `Quality report deleted: ${old_values.title}`;
    if (table_name === 'subcontractor_ledgers') return isTr ? `Taşeron silindi: ${old_values.name}` : `Subcontractor deleted: ${old_values.name}`;
    if (table_name === 'subcontractor_transactions') return isTr ? `Taşeron işlemi silindi (${old_values.type}). Tutar: ${old_values.amount} TL` : `Subcontractor transaction deleted (${old_values.type}). Amount: ${old_values.amount} TL`;
    if (table_name === 'worker_groups') return isTr ? `Personel grubu silindi: ${old_values.name}` : `Personnel group deleted: ${old_values.name}`;
    if (table_name === 'worker_leaves') return isTr ? `Personel izni silindi: ${old_values.start_date} - ${old_values.end_date} (${old_values.type})` : `Personnel leave deleted: ${old_values.start_date} - ${old_values.end_date} (${old_values.type})`;
    return isTr ? `Bir ${tName} kaydı silindi.` : `A ${tName} record was deleted.`;
  }
  return isTr ? `${action} işlemi gerçekleşti (${tName}).` : `${action} operation completed on (${tName}).`;
}

async function logAudit(db, table_name, record_id, action, old_values = null, new_values = null) {
  try {
    let project_id = null;
    if (table_name === 'projects') {
      project_id = record_id;
    } else if (new_values && new_values.project_id) {
      project_id = new_values.project_id;
    } else if (old_values && old_values.project_id) {
      project_id = old_values.project_id;
    } else {
      const tablesWithProject = [
        'workers', 'timesheets', 'transactions', 'cash_register',
        'production_records', 'materials', 'daily_journals',
        'quality_reports', 'subcontractor_ledgers',
        'subcontractor_transactions', 'worker_leaves'
      ];
      if (tablesWithProject.includes(table_name) && record_id) {
        try {
          const row = await db.get(`SELECT project_id FROM ${table_name} WHERE id = ?`, [record_id]);
          if (row && row.project_id) {
            project_id = row.project_id;
          }
        } catch (err) {
          // ignore
        }
      }
    }

    await db.run(
      'INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, project_id) VALUES (?, ?, ?, ?, ?, ?)',
      [
        table_name, 
        record_id, 
        action, 
        old_values ? JSON.stringify(old_values) : null, 
        new_values ? JSON.stringify(new_values) : null,
        project_id
      ]
    );

    let lang = 'tr';
    try {
      const langSetting = await db.get("SELECT setting_value FROM app_settings WHERE setting_key = 'language'");
      if (langSetting && langSetting.setting_value) {
        lang = langSetting.setting_value;
      }
    } catch (dbErr) {
      logger.error('Failed to get language setting from DB:', dbErr);
    }

    let projectNameStr = '';
    if (project_id) {
      try {
        const proj = await db.get('SELECT name FROM projects WHERE id = ?', [project_id]);
        if (proj && proj.name) {
          projectNameStr = proj.name;
        }
      } catch (err) {
        // ignore
      }
    }
    const isTr = lang === 'tr';
    const projLabel = isTr ? 'Şantiye' : 'Project';
    const projPart = projectNameStr ? ` [${projLabel}: ${projectNameStr}]` : '';

    const humanMsg = generateHumanMessage(table_name, action, old_values, new_values, lang);
    logger.info(`[DB ${action}] [${table_name}]${projPart} ${humanMsg}`);

  } catch (e) {
    logger.error('Audit log error:', e);
    logger.error(`[DB ERROR] Audit log failed: ${e.message}`);
  }
}

async function readRecord(db, table, conditions = {}) {
  assertTable(table);
  // Tables that do NOT have is_deleted column
  const tablesWithoutSoftDelete = ['app_settings', 'audit_logs'];
  const hasSoftDelete = !tablesWithoutSoftDelete.includes(table);

  let query = `SELECT * FROM ${table}`;
  const params = [];

  if (hasSoftDelete) {
    query += ' WHERE is_deleted = 0';
  }

  for (const [key, value] of Object.entries(conditions)) {
    assertColumn(table, key);
    query += hasSoftDelete || params.length > 0 ? ' AND ' : ' WHERE ';
    query += `${key} = ?`;
    params.push(value);
  }

  // Add default ordering
  if (table === 'workers') query += ' ORDER BY full_name ASC';
  else if (table === 'projects') query += ' ORDER BY sort_order ASC, id DESC';
  else query += ' ORDER BY id DESC';

  const rows = await db.all(query, params);
  return rows;
}

async function createRecord(db, table, data) {
  assertTable(table);
  const keys = Object.keys(data);
  // An empty payload would produce `INSERT INTO t () VALUES ()` (syntax error).
  if (keys.length === 0) {
    return { success: false, message: 'Eklenecek alan yok.', messageKey: 'errors.no_fields_to_insert' };
  }
  keys.forEach(k => assertColumn(table, k));
  const values = Object.values(data);
  const placeholders = keys.map(() => '?').join(', ');
  
  const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
  const result = await db.run(query, values);
  
  await logAudit(db, table, result.lastID, 'CREATE', null, data);
  
  return { success: true, id: result.lastID, message: 'Kayıt başarıyla eklendi.', messageKey: 'errors.record_added' };
}

async function updateRecord(db, table, id, data) {
  assertTable(table);
  const keys = Object.keys(data);
  // An empty payload would produce `UPDATE t SET  WHERE id = ?` (syntax error),
  // so treat it as a no-op instead of letting SQLite throw.
  if (keys.length === 0) {
    return { success: true, message: 'Güncellenecek alan yok.', messageKey: 'errors.no_fields_to_update' };
  }
  keys.forEach(k => assertColumn(table, k));

  // Get old record for audit
  const oldRecord = await db.get(`SELECT * FROM ${table} WHERE id = ?`, [id]);

  const values = Object.values(data);
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  
  const query = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
  await db.run(query, [...values, id]);
  
  await logAudit(db, table, id, 'UPDATE', oldRecord, data);
  
  return { success: true, message: 'Kayıt başarıyla güncellendi.', messageKey: 'errors.record_updated' };
}

async function deleteRecord(db, table, id) {
  assertTable(table);
  // Get old record for audit
  const oldRecord = await db.get(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  
  // Tables that do NOT have is_deleted column
  const tablesWithoutSoftDelete = ['app_settings', 'audit_logs'];
  const hasSoftDelete = !tablesWithoutSoftDelete.includes(table);

  // A project delete touches up to 12 tables. Without a transaction a failure in
  // the middle (lock, disk error, FK rejection) left the project hidden while
  // some children stayed visible - their rows then kept counting in every total
  // while the UI no longer showed the project they belong to.
  try {
    await withTransaction(db, async () => {
      if (hasSoftDelete) {
        const query = `UPDATE ${table} SET is_deleted = 1, deleted_at = datetime('now', 'localtime') WHERE id = ?`;
        await db.run(query, [id]);

        // Cascade delete related records if a project is soft-deleted.
        // Every table carrying project_id must be listed, otherwise the child rows
        // stay visible (and keep counting in totals) after the project is gone.
        if (table === 'projects') {
          const childTables = [
            'workers', 'timesheets', 'transactions', 'cash_register',
            'production_records', 'materials', 'daily_journals',
            'quality_reports', 'subcontractor_ledgers',
            'subcontractor_transactions', 'worker_leaves'
          ];
          for (const t of childTables) {
            await db.run(`UPDATE ${t} SET is_deleted = 1, deleted_at = datetime('now', 'localtime') WHERE project_id = ? AND is_deleted = 0`, [id]);
          }
        }

        await logAudit(db, table, id, 'DELETE', oldRecord, { is_deleted: 1 });
      } else {
        const query = `DELETE FROM ${table} WHERE id = ?`;
        await db.run(query, [id]);
        await logAudit(db, table, id, 'DELETE', oldRecord, null);
      }
    });
  } catch (error) {
    logger.error(`Delete error in ${table} (id ${id}):`, error);
    throw error;
  }

  return { success: true, message: 'Kayıt başarıyla silindi.', messageKey: 'errors.record_deleted' };
}

async function createBulkRecord(db, table, dataList, logMessage) {
  assertTable(table);
  if (!Array.isArray(dataList) || dataList.length === 0) {
    return { success: false, message: 'Veri listesi boş.', messageKey: 'errors.data_list_empty' };
  }

  try {
    await withTransaction(db, async () => {
      const firstItem = dataList[0];
      if (!firstItem || typeof firstItem !== 'object' || Array.isArray(firstItem)) {
        throw new Error(`Bulk insert expects objects, got ${typeof firstItem}`);
      }
      const keys = Object.keys(firstItem);
      if (keys.length === 0) {
        throw new Error(`Bulk insert row for ${table} has no columns`);
      }
      // Same allowlist check as createRecord: keys are interpolated into the
      // INSERT statement, so they must be validated or a crafted payload can
      // inject SQL through the column list.
      keys.forEach(k => assertColumn(table, k));
      const placeholders = keys.map(() => '?').join(', ');
      const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
      const expectedKeySet = new Set(keys);

      for (const item of dataList) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          throw new Error(`Bulk insert row for ${table} is not an object`);
        }
        // Every row must use the SAME key set as the prepared statement.
        // Comparing only counts let {a:1,b:2} and {b:3,c:4} through, writing
        // the second row's values into the first row's columns (silent
        // corruption of whatever column order SQLite resolved).
        const rowKeys = Object.keys(item);
        const sameKeys =
          rowKeys.length === keys.length &&
          rowKeys.every(k => expectedKeySet.has(k));
        if (!sameKeys) {
          throw new Error(
            `Bulk insert row mismatch in ${table}: expected columns [${keys.join(', ')}], got [${rowKeys.join(', ')}]`
          );
        }
        const values = keys.map(k => item[k]);
        await db.run(query, values);
      }

      // Single audit log for the bulk operation (inside the transaction so a
      // failure here rolls the inserted rows back too).
      const projectId = firstItem.project_id || null;
      await logAudit(db, table, null, 'CREATE_BULK', null, {
        logMessage,
        project_id: projectId,
        record_count: dataList.length
      });
    });

    return { success: true, message: 'Toplu kayıtlar başarıyla eklendi.', messageKey: 'errors.bulk_added' };
  } catch (error) {
    logger.error(`Bulk create error in ${table}:`, error);
    throw error;
  }
}

module.exports = {
  readRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  createBulkRecord,
  isKnownTable
};
