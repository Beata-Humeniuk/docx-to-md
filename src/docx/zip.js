'use strict';

const zlib = require('zlib');

const END_OF_DIRECTORY = 0x06054b50;
const DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_HEADER = 0x04034b50;
const UTF8_NAMES = 0x800;

function findEndOfDirectory(buf) {
  const min = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === END_OF_DIRECTORY) return i;
  }
  return -1;
}

function inflate(buf, name, method, offset, size) {
  if (buf.readUInt32LE(offset) !== LOCAL_HEADER) throw new Error('corrupt zip entry: ' + name);
  const start = offset + 30 + buf.readUInt16LE(offset + 26) + buf.readUInt16LE(offset + 28);
  const data = buf.subarray(start, start + size);
  if (method === 0) return Buffer.from(data);
  if (method === 8) return zlib.inflateRawSync(data);
  throw new Error('unsupported zip compression method ' + method + ' in ' + name);
}

function readZip(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 22) throw new Error('not a zip archive');
  const end = findEndOfDirectory(buf);
  if (end < 0) throw new Error('not a zip archive');
  const entries = new Map();
  let p = buf.readUInt32LE(end + 16);
  for (let n = buf.readUInt16LE(end + 10); n > 0; n--) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== DIRECTORY_ENTRY) throw new Error('corrupt zip central directory');
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLength = buf.readUInt16LE(p + 28);
    const offset = buf.readUInt32LE(p + 42);
    const encoding = buf.readUInt16LE(p + 8) & UTF8_NAMES ? 'utf8' : 'latin1';
    const name = buf.toString(encoding, p + 46, p + 46 + nameLength);
    p += 46 + nameLength + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
    if (!name.endsWith('/')) entries.set(name, () => inflate(buf, name, method, offset, size));
  }
  return entries;
}

module.exports = { readZip };
