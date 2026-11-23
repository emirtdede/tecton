/**
 * Lazily loads the spreadsheet and PDF libraries.
 *
 * `xlsx` (~415 kB) and `jspdf` (~610 kB together with autotable) were imported
 * statically, so Vite emitted them as `modulepreload` chunks: every launch
 * downloaded both even though a user may never export or import a file. Each
 * loader below keeps the resolved module in a module-scoped variable, so the
 * first real use pays the download once and every later call is synchronous.
 *
 * A *failed* load must not be cached: if the promise stayed rejected in the
 * variable, one transient network error would disable Excel/PDF export for the
 * rest of the session, because every later call would receive the same
 * rejected promise without retrying the import.
 */

let xlsxPromise = null;

/**
 * Loads the `xlsx` namespace on first use.
 * @returns {Promise<typeof import('xlsx')>}
 */
export const loadXlsx = () => {
  if (!xlsxPromise) {
    xlsxPromise = import('xlsx').catch((err) => {
      // Drop the cached failure so the user's next click retries the download.
      xlsxPromise = null;
      throw err;
    });
  }
  return xlsxPromise;
};

let jspdfPromise = null;

/**
 * Loads `jspdf` plus `jspdf-autotable` on first use.
 * @returns {Promise<{ jsPDF: any, autoTable: any }>}
 */
export const loadPdf = () => {
  if (!jspdfPromise) {
    jspdfPromise = Promise.all([import('jspdf'), import('jspdf-autotable')])
      .then(([jspdfMod, autoTableMod]) => ({
        jsPDF: jspdfMod.default || jspdfMod.jsPDF || jspdfMod,
        autoTable: autoTableMod.default || autoTableMod
      }))
      .catch((err) => {
        jspdfPromise = null;
        throw err;
      });
  }
  return jspdfPromise;
};
