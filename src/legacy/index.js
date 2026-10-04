'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { convertWithWord } = require('./word');
const { libreOfficeCandidates, convertWithLibreOffice } = require('./libreOffice');

function converters(options) {
  const list = [];
  if (process.platform === 'win32' && options.useWord !== false) list.push({ name: 'Word', convert: convertWithWord });
  for (const exe of libreOfficeCandidates(options.libreOfficePath)) {
    if (path.isAbsolute(exe) && !fs.existsSync(exe)) continue;
    list.push({ name: 'LibreOffice', exe, convert: (src, dir) => convertWithLibreOffice(src, dir, exe) });
  }
  return list;
}

async function legacyToDocx(src, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docx-to-md-'));
  const attempts = [];
  let failure = null;
  try {
    for (const c of converters(options)) {
      try {
        return fs.readFileSync(await c.convert(src, dir));
      } catch (e) {
        const missing = e.code === 'ENOENT';
        const reason = missing && c.exe ? 'not found' : e.stderr || e.message;
        attempts.push(c.name + (c.exe ? ' (' + c.exe + ')' : '') + ': ' + reason);
        if (missing) continue;
        failure = failure || c.name + ': ' + (e.stderr || e.message);
        if (c.exe) break;
      }
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  if (failure) throw new Error(failure);
  throw Object.assign(new Error('no program to read .doc files: ' + attempts.join('; ')), { code: 'NO_DOC_CONVERTER', attempts });
}

module.exports = { legacyToDocx };
