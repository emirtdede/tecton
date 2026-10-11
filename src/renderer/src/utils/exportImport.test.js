// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { exportToExcel, exportToCSV, exportToJSON, exportToText, exportToMarkdown } from './exportUtils';
import { readWorkersFromExcel } from './importUtils';

const t = (k, f) => f || k;

// jsdom/Node Blob impls differ: force a stub so createObjectURL never touches internals.
URL.createObjectURL = () => 'blob:fake';
URL.revokeObjectURL = () => {};
globalThis.alert = () => {};

function clickStub() {
  const clicks = [];
  const orig = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { clicks.push(this.href); };
  return { clicks, restore: () => { HTMLAnchorElement.prototype.click = orig; } };
}

describe('exportUtils', () => {
  it('exportToExcel writes a real xlsx file', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const target = path.resolve('Rapor.xlsx');
    try { fs.unlinkSync(target); } catch (_) {}
    exportToExcel([{ a: 1 }], 'Rapor');
    expect(fs.existsSync(target)).toBe(true);
    expect(fs.statSync(target).size).toBeGreaterThan(0);
    fs.unlinkSync(target);
  });

  it('exportToCSV builds csv content', () => {
    const { clicks, restore } = clickStub();
    exportToCSV([{ a: 1, b: 'x' }], 'R');
    expect(clicks.length).toBe(1);
    restore();
  });

  it('exportToJSON triggers download', () => {
    const { clicks, restore } = clickStub();
    exportToJSON([{ a: 1 }], 'R');
    expect(clicks.length).toBe(1);
    restore();
  });

  it('exportToText and exportToMarkdown handle lines', () => {
    const { restore } = clickStub();
    expect(() => exportToText(['a', 'b'], 'T')).not.toThrow();
    expect(() => exportToMarkdown(['# h'], 'M')).not.toThrow();
    restore();
  });

  it('empty data does not crash', () => {
    const { restore } = clickStub();
    expect(() => exportToExcel([], 'B')).not.toThrow();
    expect(() => exportToCSV([], 'B')).not.toThrow();
    restore();
  });
});

describe('readWorkersFromExcel', () => {
  function makeFile(rows) {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = { SheetNames: ['S1'], Sheets: { S1: ws } };
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const bytes = new Uint8Array(buf);
    return new File([bytes], 'w.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  it('parses valid rows', async () => {
    const file = makeFile([{ 'Ad Soyad': 'Ali Veli', 'Telefon': '555', 'Günlük Yevmiye (TL)': 1000 }]);
    const res = await readWorkersFromExcel(file, t);
    expect(res.success).toBe(true);
    expect(res.data.length).toBe(1);
    expect(res.data[0].full_name).toBe('Ali Veli');
  });

  it('rejects invalid TC with error lines', async () => {
    const file = makeFile([{ 'Ad Soyad': 'Ali', 'TC Kimlik No': '123' }]);
    await expect(readWorkersFromExcel(file, t)).rejects.toMatchObject({ success: false });
  });

  it('skips nameless rows with error', async () => {
    const file = makeFile([{ 'Telefon': '555' }]);
    await expect(readWorkersFromExcel(file, t)).rejects.toMatchObject({ success: false });
  });
});
