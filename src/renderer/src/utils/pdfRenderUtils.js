import html2canvas from 'html2canvas';
import { logError } from './logger';

const PAGE_WIDTH_PX = 800;

/**
 * Creates the off-screen A4 container every PDF export renders into.
 * Shared by CashRegister, WorkerProfile and SubcontractorProfile, which used to
 * carry three byte-identical copies of this style block.
 */
export function createPdfContainer() {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = `${PAGE_WIDTH_PX}px`;
  container.style.background = '#ffffff';
  container.style.color = '#1e293b';
  container.style.fontFamily = "'Inter', 'Noto Sans', 'Arial', sans-serif";
  container.style.padding = '40px';
  return container;
}

/**
 * Rasterises one already-populated container onto the current PDF page.
 * @param {import('jspdf').jsPDF} pdf
 * @param {HTMLElement} container
 * @param {{ imgWidth?: number, position?: number, addPage?: boolean }} [opts]
 */
export async function renderContainerToPdfPage(pdf, container, opts = {}) {
  const { imgWidth = 190, position = 15, addPage = false } = opts;

  document.body.appendChild(container);
  try {
    // Custom/Google fonts must be resolved before rasterising, otherwise the
    // snapshot can fall back to a default face.
    await document.fonts.ready;

    const canvas = await html2canvas(container, {
      scale: 2.5,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/jpeg', 1.0);
    // A zero-width canvas (empty/hidden container) would make imgHeight
    // Infinity or NaN and corrupt every following page of the PDF.
    const imgHeight = canvas.width > 0
      ? (canvas.height * imgWidth) / canvas.width
      : 0;
    if (imgHeight > 0) {
      pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight);
    } else {
      logError('renderContainerToPdfPage: canvas has zero width; page left blank.');
    }

    if (addPage) pdf.addPage();
  } finally {
    // Never leak the container, even if html2canvas throws.
    if (container.parentNode) container.parentNode.removeChild(container);
  }
}
