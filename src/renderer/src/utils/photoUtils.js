import { compressImage } from './imageCompressor';

/**
 * Shared photo helpers.
 *
 * MaterialManagement and QualityReports both implement the exact same photo
 * flow (read a stored photo as base64, compress + persist a local file). The
 * duplication was byte-for-byte identical, so it lives here now.
 */

/**
 * Reads a stored photo as a base64 data URL.
 * Returns `null` when there is no path, the API is unavailable, or the read
 * failed - callers simply skip the preview update in that case.
 */
export const readPhotoAsBase64 = async (relativePath) => {
  if (!relativePath || !window.api?.media?.readPhoto) return null;
  try {
    const res = await window.api.media.readPhoto({ relativePath });
    return res && res.success ? res.base64 : null;
  } catch {
    return null;
  }
};

/**
 * Compresses a `File` and persists it for a project.
 * Resolves to `{ success, relativePath, message, base64 }`, where `base64` is
 * the compressed data URL so the caller can show an instant preview without a
 * second IPC round-trip.
 */
export const savePhotoFromFile = async (file, projectId) => {
  const base64 = await compressImage(file);
  if (!window.api?.media?.savePhotoBase64) {
    return { success: false, message: 'unsupported' };
  }
  const res = await window.api.media.savePhotoBase64({
    projectId,
    base64Data: base64,
  });
  return { ...res, base64 };
};
