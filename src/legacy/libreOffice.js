'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { run } = require('./run');

function libreOfficeCandidates(configured) {
  const out = configured ? [configured] : [];
  if (process.platform === 'win32') {
    for (const base of [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], 'C:\\Program Files']) {
      if (base) out.push(path.join(base, 'LibreOffice', 'program', 'soffice.exe'));
    }
    out.push('soffice.exe');
  } else if (process.platform === 'darwin') {
    out.push('/Applications/LibreOffice.app/Contents/MacOS/soffice', 'soffice');
  } else {
    out.push('soffice', 'libreoffice');
  }
  return [...new Set(out)];
}

async function convertWithLibreOffice(src, dir, exe) {
  const outDir = path.join(dir, 'lo');
  fs.mkdirSync(outDir, { recursive: true });
  const profile = pathToFileURL(path.join(dir, 'profile')).href;
  const output = await run(exe, ['-env:UserInstallation=' + profile, '--headless', '--norestore', '--nologo',
    '--convert-to', 'docx:MS Word 2007 XML', '--outdir', outDir, src]);
  const dst = path.join(outDir, path.parse(src).name + '.docx');
  if (fs.existsSync(dst)) return dst;
  throw new Error(output.split('\n').filter((l) => /error/i.test(l)).join(' ') || 'LibreOffice wrote no output');
}

module.exports = { libreOfficeCandidates, convertWithLibreOffice };
