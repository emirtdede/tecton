// Table-driven coverage for crudService.generateHumanMessage branches.
// Every allowlisted table goes through CREATE (+bulk) / UPDATE / DELETE in
// both 'tr' and 'en' so all human-message variants execute against a real
// :memory: DB. Asserts only success (message text is a side channel).

const { setupTestDB } = require('./testDb');
const {
  readRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  createBulkRecord,
} = require('./crudService');

const TABLES = {
  workers: {
    create: { full_name: 'Matris Isci', daily_wage: 1000 },
    update: { daily_wage: 1100 },
  },
  worker_groups: {
    create: { name: 'Matris Grup' },
    update: { name: 'Matris Grup 2' },
  },
  timesheets: {
    create: { worker_id: 1, work_date: '2026-01-05', applied_wage: 1000, applied_multiplier: 1, earned_amount: 1000 },
    update: { earned_amount: 1200, work_date: '2026-01-06' },
  },
  transactions: {
    create: { worker_id: 1, trans_date: '2026-01-05', amount: 250 },
    update: { amount: 300 },
  },
  cash_register: {
    create: { trans_date: '2026-01-05', type: 'Nakit Girisi', amount: 5000 },
    update: { amount: 5500 },
  },
  work_types: {
    create: { name: 'Matris Tip', multiplier: 1.25 },
    update: { multiplier: 1.5 },
  },
  app_settings: {
    create: (lang) => ({ setting_key: `matris_${lang}`, setting_value: '1' }),
    update: { setting_value: '2' },
  },
  projects: {
    create: { name: 'Matris Santiye', location: 'Ankara' },
    update: { name: 'Matris Santiye 2', location: 'Istanbul' },
  },
  production_records: {
    create: { project_id: 1, item_name: 'Duvar', quantity: 10, unit: 'm2', record_date: '2026-01-05' },
    update: { quantity: 12, unit: 'm3', item_name: 'Kolon' },
  },
  materials: {
    create: { project_id: 1, supplier: 'Tedarikci', material_type: 'Cimento', quantity: 5, unit: 'ton', receipt_date: '2026-01-05' },
    update: { quantity: 6, supplier: 'Tedarikci 2', material_type: 'Demir', unit: 'kg' },
  },
  daily_journals: {
    create: { project_id: 1, journal_date: '2026-01-05', weather_temp: 12, weather_desc: 'Yagmurlu' },
    update: { journal_date: '2026-01-06' },
  },
  quality_reports: {
    create: { project_id: 1, title: 'Rapor', report_date: '2026-01-05', status: 'open' },
    update: { title: 'Rapor 2', status: 'closed' },
  },
  subcontractor_ledgers: {
    create: { project_id: 1, name: 'Taseron', service_type: 'Boya', daily_wage: 2000 },
    update: { name: 'Taseron 2', service_type: 'Siva' },
  },
  subcontractor_transactions: {
    create: { subcontractor_id: 1, trans_date: '2026-01-05', type: 'odeme', amount: 4000 },
    update: { type: 'avans', amount: 1000 },
  },
  worker_leaves: {
    create: { worker_id: 1, start_date: '2026-02-01', end_date: '2026-02-03', type: 'Yillik' },
    update: { type: 'Ucretsiz' },
  },
  audit_logs: {
    create: { table_name: 'workers', record_id: 1, action: 'NOTE' },
    update: { action: 'NOTE2' },
  },
};

async function runMatrix(db, lang) {
  // Seed FK targets used by matrix payloads.
  await createRecord(db, 'workers', { full_name: `Seed ${lang}`, daily_wage: 1000 }).catch(() => {});
  await createRecord(db, 'projects', { name: `Seed ${lang}` }).catch(() => {});
  const ledger = await createRecord(db, 'subcontractor_ledgers', {
    project_id: 1,
    name: `Seed ${lang}`,
    service_type: 'Kaba',
    daily_wage: 1000,
  }).catch(() => null);

  for (const [table, spec] of Object.entries(TABLES)) {
    const payload = typeof spec.create === 'function' ? spec.create(lang) : { ...spec.create };
    if (table === 'subcontractor_transactions' && ledger) {
      payload.subcontractor_id = ledger.id;
    }
    const created = await createRecord(db, table, payload);
    expect(created.success).toBe(true);

    const updated = await updateRecord(db, table, created.id ?? 1, spec.update);
    expect(updated.success).toBe(true);

    const rows = await readRecord(db, table);
    expect(Array.isArray(rows)).toBe(true);

    const targetId = created.id ?? (rows[0] && rows[0].id);
    if (targetId !== undefined) {
      const deleted = await deleteRecord(db, table, targetId);
      expect(deleted.success).toBe(true);
    }
  }

  // CREATE_BULK without an explicit log message (default-message branch).
  const bulk = await createBulkRecord(db, 'workers', [{ full_name: `Bulk ${lang}`, daily_wage: 500 }]);
  expect(bulk.success).toBe(true);
}

describe('crudService human-message matrix', () => {
  it('covers all tables in Turkish', async () => {
    const db = await setupTestDB();
    await runMatrix(db, 'tr');
    await db.close();
  });

  it('covers all tables in English (incl. project rename variants)', async () => {
    const db = await setupTestDB();
    await db.run("INSERT INTO app_settings (setting_key, setting_value) VALUES ('language', 'en')");
    await runMatrix(db, 'en');

    // Project UPDATE location-clearing variant (newLoc '' branch).
    const p = await createRecord(db, 'projects', { name: 'Loc', location: 'X' });
    expect((await updateRecord(db, 'projects', p.id, { location: '' })).success).toBe(true);
    // Worker ISG + subcontractor ISG message variants.
    const w = await createRecord(db, 'workers', { full_name: 'Isg', daily_wage: 1 });
    expect(
      (await updateRecord(db, 'workers', w.id, { isg_start_date: '2026-01-01', isg_bitis_tarihi: '2026-02-01' })).success
    ).toBe(true);
    const s = await createRecord(db, 'subcontractor_ledgers', {
      project_id: 1,
      name: 'IsgT',
      service_type: 'T',
      daily_wage: 1,
    });
    expect(
      (await updateRecord(db, 'subcontractor_ledgers', s.id, { isg_start_date: '2026-01-01', isg_expiry_date: '2027-01-01' }))
        .success
    ).toBe(true);
    await db.close();
  });
});
