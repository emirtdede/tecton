/**
 * Print/PDF style tokens.
 *
 * CashRegister, WorkerProfile and SubcontractorProfile each build an HTML
 * template that html2canvas rasterises into a PDF. Those templates contained
 * 18 byte-identical inline `style="..."` fragments spread across the three
 * files (one of them 14 times), so a colour or spacing change had to be made
 * by hand in three places and drifted silently. Each fragment is now one token.
 *
 * All values are plain CSS strings, interpolated into the template literals:
 *   `<td style="${pdfStyles.cell}">`
 */
const pdfStyles = {
  companyLogo: "max-width: 150px; max-height: 50px; margin-bottom: 10px; display: block;",
  companyName: "font-size: 14px; font-weight: bold; color: #334155; font-family: inherit;",
  emptyCell: "padding: 20px; text-align: center; color: #64748b; font-family: inherit;",
  headerDivider: "border: 0; border-top: 1px solid #cbd5e1; margin-bottom: 20px;",
  metaLine: "font-size: 11px; color: #64748b; margin-bottom: 4px; font-family: inherit;",
  metaLineTight: "font-size: 11px; color: #64748b; font-family: inherit;",
  reportHeader: "display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;",
  reportTitle: "font-size: 18px; font-weight: bold; color: #6389b9; margin-bottom: 8px; font-family: inherit;",
  signatureCell: "width: 250px; text-align: center; font-family: inherit;",
  signatureLabel: "font-size: 11px; font-weight: 500; color: #334155; font-family: inherit;",
  signatureLine: "border: 0; border-top: 1px solid #94a3b8; margin-bottom: 8px;",
  summaryBox: "flex: 1; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; text-align: center;",
  table: "width: 100%; border-collapse: collapse; font-size: 12px; color: #334155; font-family: inherit;",
  tableCell: "padding: 8px 10px; border: 1px solid #e2e8f0; font-family: inherit;",
  tableHeadCell: "padding: 10px; text-align: left; border: 1px solid #cbd5e1; font-family: inherit;",
  tableHeadCellRight: "padding: 10px; text-align: right; border: 1px solid #cbd5e1; font-family: inherit;",
  tableHeadRow: "background: #1e3a8a; color: #ffffff;",
  tableRow: "border-bottom: 1px solid #e2e8f0;",
};

export default pdfStyles;
