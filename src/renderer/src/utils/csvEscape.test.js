import { describe, it, expect } from 'vitest';
import { escapeCsvCell, escapeCsvRows, rowsToCsv } from './csvEscape';

describe('escapeCsvCell - CSV formula injection', () => {
  it('neutralises every spreadsheet formula prefix', () => {
    expect(escapeCsvCell('=HYPERLINK("http://evil","click")')).toBe('\'=HYPERLINK("http://evil","click")');
    expect(escapeCsvCell('+2+3')).toBe("'+2+3");
    expect(escapeCsvCell('-1+cmd|\' /C calc\'!A0')).toBe("'-1+cmd|' /C calc'!A0");
    expect(escapeCsvCell('@SUM(A1:A9)')).toBe("'@SUM(A1:A9)");
    expect(escapeCsvCell('\t=1+1')).toBe("'\t=1+1");
    expect(escapeCsvCell('\r=1+1')).toBe("'\r=1+1");
  });

  it('keeps real numbers as numbers (negative balances stay numeric)', () => {
    expect(escapeCsvCell('-1250.50')).toBe('-1250.50');
    expect(escapeCsvCell('-1250,50')).toBe('-1250,50');
    expect(escapeCsvCell('+42')).toBe('+42');
    expect(escapeCsvCell('-1')).toBe('-1');
  });

  it('leaves ordinary text untouched', () => {
    expect(escapeCsvCell('Ahmet Yılmaz')).toBe('Ahmet Yılmaz');
    expect(escapeCsvCell('a=b')).toBe('a=b');
    expect(escapeCsvCell("O'Brien")).toBe("O'Brien");
    expect(escapeCsvCell('')).toBe('');
  });

  it('does not touch non-string values', () => {
    expect(escapeCsvCell(-1250.5)).toBe(-1250.5);
    expect(escapeCsvCell(0)).toBe(0);
    expect(escapeCsvCell(null)).toBe(null);
    expect(escapeCsvCell(undefined)).toBe(undefined);
    expect(escapeCsvCell(true)).toBe(true);
  });

  it('escapes every field of every row, keeping structure', () => {
    const rows = [
      { name: '=1+1', balance: '-99.90', note: 'normal' },
      { name: 'Mehmet', balance: 42, note: '@cmd' },
    ];
    const out = escapeCsvRows(rows);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ name: "'=1+1", balance: '-99.90', note: 'normal' });
    expect(out[1]).toEqual({ name: 'Mehmet', balance: 42, note: "'@cmd" });
  });

  it('passes non-object rows through untouched', () => {
    expect(escapeCsvRows(['=1+1', null])).toEqual(['=1+1', null]);
  });
});

describe('rowsToCsv - RFC 4180 serialisation', () => {
  it('writes a header row and one line per record', () => {
    const csv = rowsToCsv([
      { name: 'Ahmet', balance: 100 },
      { name: 'Mehmet', balance: -50 },
    ]);
    expect(csv).toBe('name,balance\nAhmet,100\nMehmet,-50');
  });

  it('quotes fields containing a comma, a quote or a newline', () => {
    const csv = rowsToCsv([{ note: 'a,b', quote: 'he said "hi"', multi: 'l1\nl2' }]);
    expect(csv).toBe('note,quote,multi\n"a,b","he said ""hi""","l1\nl2"');
  });

  it('uses the union of keys so a late column is not dropped', () => {
    const csv = rowsToCsv([{ a: 1 }, { a: 2, b: 3 }]);
    expect(csv).toBe('a,b\n1,\n2,3');
  });

  it('renders missing values as empty cells', () => {
    expect(rowsToCsv([{ a: null, b: undefined, c: 0 }])).toBe('a,b,c\n,,0');
  });

  it('keeps formula injection neutralised', () => {
    const csv = rowsToCsv([{ name: '=1+1' }]);
    expect(csv).toBe("name\n'=1+1");
  });

  it('returns an empty string for no rows', () => {
    expect(rowsToCsv([])).toBe('');
    expect(rowsToCsv(null)).toBe('');
    expect(rowsToCsv([{}, {}])).toBe('');
  });
});
