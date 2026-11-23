/**
 * Minimal multi-resolution ICO writer.
 *
 * Windows needs `.ico` files for window, taskbar and shortcut icons; it does not
 * accept SVG. An ICO is just a directory of images, and since Vista every entry
 * may be a PNG payload, so no bitmap conversion or native dependency is needed.
 *
 * Reference layout (all little-endian):
 *   ICONDIR        6 bytes  reserved=0, type=1, imageCount
 *   ICONDIRENTRY  16 bytes  width, height, palette, reserved, planes, bpp,
 *                           byteSize, byteOffset
 *   image data     PNG bytes, back to back
 */
const DEFAULT_SIZES = [16, 24, 32, 48, 64, 128, 256];

/**
 * @param {Array<{size:number, png:Buffer}>} images
 * @returns {Buffer} a complete ICO file
 */
function buildIco(images) {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error('buildIco requires at least one image');
  }
  const entries = images
    .map((image) => {
      if (!Buffer.isBuffer(image.png) || image.png.length === 0) {
        throw new Error(`Image for ${image.size}px has no PNG payload`);
      }
      return image;
    })
    .sort((a, b) => a.size - b.size);

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);

  const directory = Buffer.alloc(16 * entries.length);
  let offset = header.length + directory.length;

  entries.forEach((entry, index) => {
    const base = index * 16;
    // 256 is stored as 0: the field is a single byte.
    directory.writeUInt8(entry.size >= 256 ? 0 : entry.size, base);
    directory.writeUInt8(entry.size >= 256 ? 0 : entry.size, base + 1);
    directory.writeUInt8(0, base + 2); // palette colours
    directory.writeUInt8(0, base + 3); // reserved
    directory.writeUInt16LE(1, base + 4); // colour planes
    directory.writeUInt16LE(32, base + 6); // bits per pixel
    directory.writeUInt32LE(entry.png.length, base + 8);
    directory.writeUInt32LE(offset, base + 12);
    offset += entry.png.length;
  });

  return Buffer.concat([header, directory, ...entries.map((entry) => entry.png)]);
}

/** Reads an ICO directory back. Used by tests to prove the file is well formed. */
function readIcoDirectory(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 6) return { valid: false, images: [] };
  const reserved = buffer.readUInt16LE(0);
  const type = buffer.readUInt16LE(2);
  const count = buffer.readUInt16LE(4);
  if (reserved !== 0 || type !== 1) return { valid: false, images: [] };

  const images = [];
  for (let index = 0; index < count; index += 1) {
    const base = 6 + index * 16;
    if (base + 16 > buffer.length) return { valid: false, images: [] };
    const width = buffer.readUInt8(base) || 256;
    const height = buffer.readUInt8(base + 1) || 256;
    const byteSize = buffer.readUInt32LE(base + 8);
    const byteOffset = buffer.readUInt32LE(base + 12);
    if (byteOffset + byteSize > buffer.length) return { valid: false, images: [] };
    const payload = buffer.subarray(byteOffset, byteOffset + byteSize);
    const isPng = payload.length > 8 && payload.readUInt32BE(0) === 0x89504e47;
    images.push({ width, height, byteSize, byteOffset, isPng });
  }
  return { valid: images.every((image) => image.isPng), images };
}

module.exports = { DEFAULT_SIZES, buildIco, readIcoDirectory };
