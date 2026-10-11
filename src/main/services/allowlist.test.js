const { ALLOWED_TABLES, isAllowedTable, assertAllowedTable, assertAllowedColumns } = require('./allowlist');

describe('allowlist (CRUD identifier guard)', () => {
  it('allows all 17 known tables', () => {
    for (const t of ['workers', 'timesheets', 'transactions', 'cash_register', 'projects']) {
      expect(isAllowedTable(t)).toBe(true);
    }
  });

  it("rejects 'sqlite_master'", () => {
    expect(isAllowedTable('sqlite_master')).toBe(false);
    expect(() => assertAllowedTable('sqlite_master')).toThrow('forbidden_table');
  });

  it('blocks column injection payloads', () => {
    expect(() => assertAllowedColumns('workers', { 'id) VALUES (1); --': 'x' })).toThrow(/forbidden_column/);
  });

  it('blocks unknown columns on valid tables', () => {
    expect(() => assertAllowedColumns('workers', { no_such_col: 1 })).toThrow(/forbidden_column/);
  });

  it('accepts migrated columns (project_id, tags)', () => {
    expect(() => assertAllowedColumns('workers', { project_id: 1, tags: '[]' })).not.toThrow();
    expect(() => assertAllowedColumns('transactions', { project_id: 2 })).not.toThrow();
  });
});
