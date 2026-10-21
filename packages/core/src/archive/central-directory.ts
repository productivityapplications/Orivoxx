export interface CentralDirectoryEntry {
  flags: number;
  compression: number;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  externalAttributes: number;
  versionMadeBy: number;
}

export type CentralDirectoryScan =
  | { ok: true; entries: CentralDirectoryEntry[] }
  | { ok: false; code: "invalid_zip" | "invalid_entry_metadata" | "entry_count_exceeded" };

const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP64_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06064b50;
const ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIGNATURE = 0x07064b50;
const CENTRAL_DIRECTORY_HEADER_SIGNATURE = 0x02014b50;
const ZIP64_SENTINEL_16 = 0xffff;
const ZIP64_SENTINEL_32 = 0xffffffff;

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;

    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    table[index] = value >>> 0;
  }

  return table;
})();

function readUint16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) |
      ((bytes[offset + 1] ?? 0) << 8) |
      ((bytes[offset + 2] ?? 0) << 16) |
      ((bytes[offset + 3] ?? 0) << 24)) >>>
    0
  );
}

function readUint64(bytes: Uint8Array, offset: number): number | null {
  const low = readUint32(bytes, offset);
  const high = readUint32(bytes, offset + 4);
  const value = high * 0x1_0000_0000 + low;

  return Number.isSafeInteger(value) ? value : null;
}

function findEndOfCentralDirectoryOffset(bytes: Uint8Array): number {
  if (bytes.length < 22) {
    return -1;
  }

  const minimumOffset = Math.max(0, bytes.length - 65_557);

  for (let offset = bytes.length - 22; offset >= minimumOffset; offset -= 1) {
    if (readUint32(bytes, offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return offset;
    }
  }

  return -1;
}

interface CentralDirectoryLocation {
  entryCount: number;
  offset: number;
}

function locateCentralDirectory(bytes: Uint8Array): CentralDirectoryLocation | null {
  const endOffset = findEndOfCentralDirectoryOffset(bytes);

  if (endOffset < 0 || endOffset + 22 > bytes.length) {
    return null;
  }

  let entryCount = readUint16(bytes, endOffset + 10);
  let offset = readUint32(bytes, endOffset + 16);

  const locatorOffset = endOffset - 20;
  const hasZip64Locator =
    locatorOffset >= 0 &&
    readUint32(bytes, locatorOffset) === ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR_SIGNATURE;

  if (entryCount === ZIP64_SENTINEL_16 || offset === ZIP64_SENTINEL_32) {
    if (!hasZip64Locator) {
      return null;
    }

    const zip64EndOffset = readUint64(bytes, locatorOffset + 8);

    if (
      zip64EndOffset === null ||
      zip64EndOffset + 56 > bytes.length ||
      readUint32(bytes, zip64EndOffset) !== ZIP64_END_OF_CENTRAL_DIRECTORY_SIGNATURE
    ) {
      return null;
    }

    const zip64EntryCount = readUint64(bytes, zip64EndOffset + 32);
    const zip64Offset = readUint64(bytes, zip64EndOffset + 48);

    if (zip64EntryCount === null || zip64Offset === null) {
      return null;
    }

    entryCount = zip64EntryCount;
    offset = zip64Offset;
  }

  return { entryCount, offset };
}

export function scanCentralDirectory(
  bytes: Uint8Array,
  maxEntryCount: number,
): CentralDirectoryScan {
  const location = locateCentralDirectory(bytes);

  if (location === null) {
    return { ok: false, code: "invalid_zip" };
  }

  if (location.entryCount > maxEntryCount) {
    return { ok: false, code: "entry_count_exceeded" };
  }

  const entries: CentralDirectoryEntry[] = [];
  let offset = location.offset;

  for (let index = 0; index < location.entryCount; index += 1) {
    if (offset + 46 > bytes.length || readUint32(bytes, offset) !== CENTRAL_DIRECTORY_HEADER_SIGNATURE) {
      return { ok: false, code: "invalid_entry_metadata" };
    }

    const fileNameLength = readUint16(bytes, offset + 28);
    const extraFieldLength = readUint16(bytes, offset + 30);
    const commentLength = readUint16(bytes, offset + 32);
    const nextOffset = offset + 46 + fileNameLength + extraFieldLength + commentLength;

    if (nextOffset > bytes.length) {
      return { ok: false, code: "invalid_entry_metadata" };
    }

    entries.push({
      versionMadeBy: readUint16(bytes, offset + 4),
      flags: readUint16(bytes, offset + 8),
      compression: readUint16(bytes, offset + 10),
      crc32: readUint32(bytes, offset + 16),
      compressedSize: readUint32(bytes, offset + 20),
      uncompressedSize: readUint32(bytes, offset + 24),
      externalAttributes: readUint32(bytes, offset + 38),
    });

    offset = nextOffset;
  }

  return { ok: true, entries };
}

export function isSymlinkEntry(entry: CentralDirectoryEntry): boolean {
  const hostSystem = entry.versionMadeBy >>> 8;

  if (hostSystem !== 3 && hostSystem !== 19) {
    return false;
  }

  const unixFileType = (entry.externalAttributes >>> 16) & 0o170000;

  return unixFileType === 0o120000;
}

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  for (let index = 0; index < bytes.length; index += 1) {
    const tableIndex = (crc ^ (bytes[index] ?? 0)) & 0xff;
    crc = (CRC32_TABLE[tableIndex] ?? 0) ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}
