'use strict';

const zlib = require('zlib');

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function header(size, fields) {
  const buf = Buffer.alloc(size);
  for (const [offset, bytes, value] of fields) {
    if (bytes === 4) buf.writeUInt32LE(value, offset);
    else buf.writeUInt16LE(value, offset);
  }
  return buf;
}

function zip(files, deflate = true) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const body = deflate ? zlib.deflateRawSync(data) : data;
    const nameBuf = Buffer.from(name, 'utf8');
    const shared = [[2, 2, 0x800], [4, 2, deflate ? 8 : 0], [10, 4, crc32(data)], [14, 4, body.length], [18, 4, data.length], [22, 2, nameBuf.length]];
    const at = (base) => shared.map(([o, bytes, value]) => [o + base, bytes, value]);
    const local = header(30, [[0, 4, 0x04034b50], [4, 2, 20], ...at(4)]);
    const central = header(46, [[0, 4, 0x02014b50], [4, 2, 20], [6, 2, 20], ...at(6), [42, 4, offset]]);
    locals.push(local, nameBuf, body);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + body.length;
  }
  const directory = Buffer.concat(centrals);
  const count = Object.keys(files).length;
  const end = header(22, [[0, 4, 0x06054b50], [8, 2, count], [10, 2, count], [12, 4, directory.length], [16, 4, offset]]);
  return Buffer.concat([...locals, directory, end]);
}

module.exports = { zip };
