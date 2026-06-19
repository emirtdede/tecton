const { setupTestDB } = require('./testDb');
const { readRecord, createRecord, updateRecord, deleteRecord } = require('./crudService');

describe('Generic CRUD Service (Veritabanı İşlemleri)', () => {
  let db;

  beforeEach(async () => {
    db = await setupTestDB();
    // Seed some active and deleted data
    await db.run("INSERT INTO workers (id, full_name, daily_wage, is_deleted) VALUES (1, 'Aktif İşçi', 1000, 0)");
    await db.run("INSERT INTO workers (id, full_name, daily_wage, is_deleted) VALUES (2, 'Silinmiş İşçi', 1000, 1)");
  });

  it('should READ only active (is_deleted = 0) records', async () => {
    const workers = await readRecord(db, 'workers');
    expect(workers.length).toBe(1);
    expect(workers[0].id).toBe(1);
    expect(workers[0].full_name).toBe('Aktif İşçi');
  });

  it('should CREATE record and log to audit_logs', async () => {
    const newData = { full_name: 'Yeni İşçi', daily_wage: 1500 };
    const result = await createRecord(db, 'workers', newData);
    
    expect(result.success).toBe(true);
    expect(result.id).toBe(3); // previous was 1 and 2

    // Verify audit log
    const logs = await db.all('SELECT * FROM audit_logs WHERE table_name = ? AND action = ?', ['workers', 'CREATE']);
    expect(logs.length).toBe(1);
    expect(logs[0].record_id).toBe(3);
    expect(logs[0].old_values).toBeNull();
    expect(JSON.parse(logs[0].new_values).daily_wage).toBe(1500);
  });

  it('should UPDATE record and log old/new values to audit_logs', async () => {
    const updateData = { daily_wage: 2000 };
    const result = await updateRecord(db, 'workers', 1, updateData);
    
    expect(result.success).toBe(true);

    // Verify database is updated
    const worker = await db.get('SELECT * FROM workers WHERE id = 1');
    expect(worker.daily_wage).toBe(2000);

    // Verify audit log
    const logs = await db.all('SELECT * FROM audit_logs WHERE table_name = ? AND action = ?', ['workers', 'UPDATE']);
    expect(logs.length).toBe(1);
    expect(logs[0].record_id).toBe(1);
    expect(JSON.parse(logs[0].old_values).daily_wage).toBe(1000);
    expect(JSON.parse(logs[0].new_values).daily_wage).toBe(2000);
  });

  it('should perform SOFT DELETE and log to audit_logs', async () => {
    const result = await deleteRecord(db, 'workers', 1);
    expect(result.success).toBe(true);

    // Verify database record has is_deleted = 1
    const worker = await db.get('SELECT is_deleted FROM workers WHERE id = 1');
    expect(worker.is_deleted).toBe(1);

    // Verify READ no longer returns it
    const activeWorkers = await readRecord(db, 'workers');
    expect(activeWorkers.length).toBe(0);

    // Verify audit log
    const logs = await db.all('SELECT * FROM audit_logs WHERE table_name = ? AND action = ?', ['workers', 'DELETE']);
    expect(logs.length).toBe(1);
    expect(JSON.parse(logs[0].new_values).is_deleted).toBe(1);
  });

  it('should support CRUD operations on new ERP tables', async () => {
    // 1. Create a project
    const projectRes = await createRecord(db, 'projects', { name: 'Şantiye A', location: 'İstanbul' });
    expect(projectRes.success).toBe(true);
    expect(projectRes.id).toBe(1);

    // 2. Create a material linked to the project
    const materialRes = await createRecord(db, 'materials', {
      project_id: 1,
      supplier: 'Beton A.Ş.',
      material_type: 'C30 Beton',
      quantity: 50,
      unit: 'm3',
      receipt_number: 'IRS-12345',
      receipt_date: '2026-06-11'
    });
    expect(materialRes.success).toBe(true);

    // 3. Read active materials
    const activeMaterials = await readRecord(db, 'materials');
    expect(activeMaterials.length).toBe(1);
    expect(activeMaterials[0].supplier).toBe('Beton A.Ş.');

    // 4. Soft delete the material
    const deleteRes = await deleteRecord(db, 'materials', materialRes.id);
    expect(deleteRes.success).toBe(true);

    const activeMaterialsAfterDelete = await readRecord(db, 'materials');
    expect(activeMaterialsAfterDelete.length).toBe(0);
  });

  it('should log ISG date updates correctly for workers', async () => {
    // We already have worker ID 1 created in beforeEach
    const updateData = { isg_start_date: '2026-06-15', isg_bitis_tarihi: '2026-12-15' };
    const result = await updateRecord(db, 'workers', 1, updateData);
    expect(result.success).toBe(true);

    // Verify audit log
    const logs = await db.all('SELECT * FROM audit_logs WHERE table_name = ? AND action = ? ORDER BY id DESC LIMIT 1', ['workers', 'UPDATE']);
    expect(logs.length).toBe(1);
    
    // We can't easily assert the logger output directly here, but we can verify 
    // the values went into audit_logs properly, triggering the specific log message
    expect(JSON.parse(logs[0].new_values).isg_start_date).toBe('2026-06-15');
    expect(JSON.parse(logs[0].new_values).isg_bitis_tarihi).toBe('2026-12-15');
  });

  it('should log ISG date updates correctly for subcontractor_ledgers', async () => {
    // Create a subcontractor first
    const createRes = await createRecord(db, 'subcontractor_ledgers', { project_id: 1, name: 'Taşeron X', service_type: 'Hafriyat', daily_wage: 1500 });
    expect(createRes.success).toBe(true);

    // Update with ISG dates
    const updateData = { isg_start_date: '2026-06-16', isg_expiry_date: '2027-06-16' };
    const updateRes = await updateRecord(db, 'subcontractor_ledgers', createRes.id, updateData);
    expect(updateRes.success).toBe(true);

    // Verify audit log
    const logs = await db.all('SELECT * FROM audit_logs WHERE table_name = ? AND action = ? ORDER BY id DESC LIMIT 1', ['subcontractor_ledgers', 'UPDATE']);
    expect(logs.length).toBe(1);
    
    expect(JSON.parse(logs[0].new_values).isg_start_date).toBe('2026-06-16');
    expect(JSON.parse(logs[0].new_values).isg_expiry_date).toBe('2027-06-16');
  });

  it('should test CRUD operations and human-readable logs for worker_leaves', async () => {
    // We already have worker ID 1
    const leaveData = { worker_id: 1, start_date: '2026-07-01', end_date: '2026-07-05', type: 'Yıllık İzin' };
    const createRes = await createRecord(db, 'worker_leaves', leaveData);
    expect(createRes.success).toBe(true);

    const logs = await db.all('SELECT * FROM audit_logs WHERE table_name = ? AND action = ? ORDER BY id DESC LIMIT 1', ['worker_leaves', 'CREATE']);
    expect(logs.length).toBe(1);
    expect(JSON.parse(logs[0].new_values).type).toBe('Yıllık İzin');

    const updateRes = await updateRecord(db, 'worker_leaves', createRes.id, { type: 'Ücretli İzin' });
    expect(updateRes.success).toBe(true);
    
    const logsUpdate = await db.all('SELECT * FROM audit_logs WHERE table_name = ? AND action = ? ORDER BY id DESC LIMIT 1', ['worker_leaves', 'UPDATE']);
    expect(JSON.parse(logsUpdate[0].new_values).type).toBe('Ücretli İzin');
  });

  it('should test CRUD operations and human-readable logs for daily_journals', async () => {
    // We already have project ID 1 from previous tests
    const journalData = { project_id: 1, journal_date: '2026-06-18', weather_temp: 28, weather_desc: 'Güneşli', worker_count: 50 };
    const createRes = await createRecord(db, 'daily_journals', journalData);
    expect(createRes.success).toBe(true);

    const logs = await db.all('SELECT * FROM audit_logs WHERE table_name = ? AND action = ? ORDER BY id DESC LIMIT 1', ['daily_journals', 'CREATE']);
    expect(logs.length).toBe(1);
    expect(JSON.parse(logs[0].new_values).weather_temp).toBe(28);
  });

  it('should test CRUD operations and human-readable logs for quality_reports', async () => {
    const reportData = { project_id: 1, title: 'Beton Döküm Hatası', report_date: '2026-06-19' };
    const createRes = await createRecord(db, 'quality_reports', reportData);
    expect(createRes.success).toBe(true);

    const logs = await db.all('SELECT * FROM audit_logs WHERE table_name = ? AND action = ? ORDER BY id DESC LIMIT 1', ['quality_reports', 'CREATE']);
    expect(logs.length).toBe(1);
    expect(JSON.parse(logs[0].new_values).title).toBe('Beton Döküm Hatası');
  });

  it('should test CRUD operations and human-readable logs for production_records', async () => {
    const prodData = { project_id: 1, item_name: 'Duvar Örümü', quantity: 150, unit: 'm2', record_date: '2026-06-20' };
    const createRes = await createRecord(db, 'production_records', prodData);
    expect(createRes.success).toBe(true);

    const logs = await db.all('SELECT * FROM audit_logs WHERE table_name = ? AND action = ? ORDER BY id DESC LIMIT 1', ['production_records', 'CREATE']);
    expect(logs.length).toBe(1);
    expect(JSON.parse(logs[0].new_values).item_name).toBe('Duvar Örümü');
  });

  it('should test CRUD operations and human-readable logs for subcontractor_transactions', async () => {
    // create subcontractor_ledgers ID 2 because ID 1 might be created by previous tests or we can just use ID 1
    const subRes = await createRecord(db, 'subcontractor_ledgers', { project_id: 1, name: 'Alt Taşeron', service_type: 'Boya', daily_wage: 2000 });
    
    const transData = { subcontractor_id: subRes.id, trans_date: '2026-06-21', type: 'odeme', amount: 50000 };
    const createRes = await createRecord(db, 'subcontractor_transactions', transData);
    expect(createRes.success).toBe(true);

    const logs = await db.all('SELECT * FROM audit_logs WHERE table_name = ? AND action = ? ORDER BY id DESC LIMIT 1', ['subcontractor_transactions', 'CREATE']);
    expect(logs.length).toBe(1);
    expect(JSON.parse(logs[0].new_values).amount).toBe(50000);
  });
});
