// Allowlist for generic CRUD IPC (defense-in-depth against identifier injection).
// Values are still bound via `?` placeholders; this guards table/column identifiers.

const ALLOWED_TABLES = {
  app_settings: ['id', 'setting_key', 'setting_value', 'description', 'updated_at'],
  work_types: ['id', 'name', 'multiplier', 'is_active', 'is_deleted', 'deleted_at', 'created_at'],
  worker_groups: ['id', 'name', 'is_active', 'is_deleted', 'deleted_at', 'created_at'],
  workers: ['id', 'full_name', 'tc_no', 'phone', 'daily_wage', 'group_id', 'start_date', 'status', 'extra_data', 'project_id', 'tags', 'is_deleted', 'deleted_at', 'created_at', 'isg_bitis_tarihi', 'isg_start_date'],
  timesheets: ['id', 'worker_id', 'work_date', 'work_type_id', 'applied_wage', 'applied_multiplier', 'overtime_hours', 'earned_amount', 'notes', 'project_id', 'tags', 'is_deleted', 'deleted_at', 'created_at'],
  transactions: ['id', 'worker_id', 'trans_date', 'trans_type', 'amount', 'notes', 'linked_cash_id', 'project_id', 'tags', 'is_deleted', 'deleted_at', 'created_at'],
  cash_register: ['id', 'trans_date', 'type', 'amount', 'description', 'project_id', 'tags', 'is_deleted', 'deleted_at', 'created_at'],
  audit_logs: ['id', 'table_name', 'record_id', 'action', 'old_values', 'new_values', 'project_id', 'created_at'],
  projects: ['id', 'name', 'location', 'status', 'sort_order', 'is_deleted', 'deleted_at', 'created_at'],
  production_records: ['id', 'project_id', 'item_name', 'quantity', 'unit', 'notes', 'record_date', 'is_deleted', 'deleted_at', 'created_at'],
  materials: ['id', 'project_id', 'supplier', 'material_type', 'quantity', 'unit', 'receipt_number', 'receipt_date', 'photo_path', 'notes', 'is_deleted', 'deleted_at', 'created_at'],
  daily_journals: ['id', 'project_id', 'journal_date', 'weather_temp', 'weather_desc', 'weather_icon', 'notes', 'worker_count', 'is_deleted', 'deleted_at', 'created_at'],
  quality_reports: ['id', 'project_id', 'title', 'description', 'status', 'photo_path', 'report_date', 'is_deleted', 'deleted_at', 'created_at'],
  subcontractor_ledgers: ['id', 'project_id', 'name', 'service_type', 'phone', 'daily_wage', 'status', 'is_deleted', 'deleted_at', 'created_at', 'isg_start_date', 'isg_expiry_date'],
  subcontractor_transactions: ['id', 'subcontractor_id', 'trans_date', 'type', 'amount', 'description', 'project_id', 'linked_cash_id', 'is_deleted', 'deleted_at', 'created_at'],
  worker_leaves: ['id', 'worker_id', 'project_id', 'start_date', 'end_date', 'type', 'description', 'is_deleted', 'deleted_at', 'created_at'],
  recycle_bin: ['id', 'table_name', 'record_id', 'title', 'project_id', 'deleted_at', 'is_restored', 'restored_at']
};

function isAllowedTable(table) {
  return Object.prototype.hasOwnProperty.call(ALLOWED_TABLES, table);
}

function assertAllowedTable(table) {
  if (!isAllowedTable(table)) {
    const err = new Error('forbidden_table');
    err.code = 'FORBIDDEN_TABLE';
    throw err;
  }
}

function assertAllowedColumns(table, data) {
  assertAllowedTable(table);
  const allowed = ALLOWED_TABLES[table];
  for (const key of Object.keys(data)) {
    if (!allowed.includes(key)) {
      const err = new Error(`forbidden_column:${key}`);
      err.code = 'FORBIDDEN_COLUMN';
      throw err;
    }
  }
}

module.exports = { ALLOWED_TABLES, isAllowedTable, assertAllowedTable, assertAllowedColumns };
