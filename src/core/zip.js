/**
 * A minimal ZIP writer — store method only, no compression.
 *
 * This exists so the extension can produce .xlsx files and multi-file
 * downloads without shipping a compression library. Everything we put in a zip
 * is either already-compressed media (where deflate buys nothing) or small XML
 * (where it buys a few KB), so "stored" is the right trade for ~120 lines and
 * zero dependencies.
 *
 * Refs: PKWARE APPNOTE.TXT sections 4.3.7 (local header), 4.3.12 (central
 * directory) and 4.3.16 (end of central directory).
 */

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
const VERSION = 20; // 2.0 — the floor for the store method

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let bit = 0; bit < 8; bit++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Date/time in the DOS format the zip headers use. */
function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function toBytes(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new TextEncoder().encode(String(data));
}

/**
 * Build a zip from `[{ name, data }]`, where data is a string, Uint8Array or
 * ArrayBuffer.
 *
 * @returns {Blob}
 */
export function makeZip(entries, { date = new Date() } = {}) {
  const { time: dosTime, date: dosDate } = dosDateTime(date);
  const encoder = new TextEncoder();

  const chunks = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const body = toBytes(entry.data);
    const crc = crc32(body);

    // UTF-8 name flag (bit 11). Without it, non-ASCII filenames decode as
    // CP437 in some extractors.
    const flags = 0x0800;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, LOCAL_SIG, true);
    local.setUint16(4, VERSION, true);
    local.setUint16(6, flags, true);
    local.setUint16(8, 0, true); // method: store
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, body.length, true); // compressed size
    local.setUint32(22, body.length, true); // uncompressed size
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true); // extra field length

    chunks.push(new Uint8Array(local.buffer), nameBytes, body);

    const entryHeader = new DataView(new ArrayBuffer(46));
    entryHeader.setUint32(0, CENTRAL_SIG, true);
    entryHeader.setUint16(4, VERSION, true); // version made by
    entryHeader.setUint16(6, VERSION, true); // version needed
    entryHeader.setUint16(8, flags, true);
    entryHeader.setUint16(10, 0, true); // method: store
    entryHeader.setUint16(12, dosTime, true);
    entryHeader.setUint16(14, dosDate, true);
    entryHeader.setUint32(16, crc, true);
    entryHeader.setUint32(20, body.length, true);
    entryHeader.setUint32(24, body.length, true);
    entryHeader.setUint16(28, nameBytes.length, true);
    entryHeader.setUint16(30, 0, true); // extra
    entryHeader.setUint16(32, 0, true); // comment
    entryHeader.setUint16(34, 0, true); // disk number
    entryHeader.setUint16(36, 0, true); // internal attrs
    entryHeader.setUint32(38, 0, true); // external attrs
    entryHeader.setUint32(42, offset, true);

    central.push(new Uint8Array(entryHeader.buffer), nameBytes);
    offset += 30 + nameBytes.length + body.length;
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);

  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, EOCD_SIG, true);
  eocd.setUint16(4, 0, true); // this disk
  eocd.setUint16(6, 0, true); // disk with central dir
  eocd.setUint16(8, entries.length, true);
  eocd.setUint16(10, entries.length, true);
  eocd.setUint32(12, centralSize, true);
  eocd.setUint32(16, offset, true);
  eocd.setUint16(20, 0, true); // comment length

  return new Blob([...chunks, ...central, new Uint8Array(eocd.buffer)], {
    type: "application/zip",
  });
}
