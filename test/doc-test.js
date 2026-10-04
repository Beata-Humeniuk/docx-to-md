'use strict';

// Old .doc files go through LibreOffice (or Word on Windows). Without either
// the error says so; with LibreOffice installed, a real .doc round-trips.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { check, eq, has, done } = require('./harness');
const { docx, r, p, styled, HEADING_STYLES } = require('./docx-builder');
const { docToDocx } = require('../src/docConversion');
const { convertDocx } = require('../src/index');

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'docx-to-md-test-'));
  try {
    const src = path.join(tmp, 'sample.doc');
    fs.writeFileSync(src, Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));

    if (process.platform !== 'win32') {
      const savedPath = process.env.PATH;
      process.env.PATH = tmp;
      let error = null;
      try {
        await docToDocx(src, { libreOfficePath: path.join(tmp, 'missing', 'soffice') });
      } catch (e) {
        error = e;
      } finally {
        process.env.PATH = savedPath;
      }
      check('no converter available is a distinct error', () => {
        eq(error && error.code, 'NO_DOC_CONVERTER');
        has(error.attempts.join('\n'), 'not found');
      });
    }

    let soffice = null;
    for (const exe of ['soffice', 'libreoffice']) {
      try { execFileSync(exe, ['--version'], { stdio: 'ignore', timeout: 60000 }); soffice = exe; break; } catch { /* not installed */ }
    }
    if (!soffice) {
      console.log('doc: LibreOffice not installed — round trip skipped');
    } else {
      const source = path.join(tmp, 'round.docx');
      fs.writeFileSync(source, docx({ body: styled('Heading1', r('Rozdział')) + p(r('Treść ') + r('ważna', '<w:b/>')), styles: HEADING_STYLES }));
      const profile = require('url').pathToFileURL(path.join(tmp, 'profile')).href;
      execFileSync(soffice, ['-env:UserInstallation=' + profile, '--headless', '--convert-to', 'doc', '--outdir', tmp, source], { stdio: 'ignore', timeout: 180000 });
      const bytes = await docToDocx(path.join(tmp, 'round.doc'), {});
      const md = convertDocx(bytes).markdown;
      check('a .doc converts through LibreOffice', () => {
        has(md, '# Rozdział');
        has(md, 'Treść **ważna**');
      });
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  done('doc');
}

main().catch((e) => { console.error(e); process.exit(1); });
