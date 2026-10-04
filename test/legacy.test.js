'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');
const { docx, r, p, styled, STYLES } = require('./support/docx');
const { legacyToDocx } = require('../src/legacy');
const { convertDocx } = require('../src');

function findLibreOffice() {
  for (const exe of ['soffice', 'libreoffice']) {
    try {
      execFileSync(exe, ['--version'], { stdio: 'ignore', timeout: 60000 });
      return exe;
    } catch {
      continue;
    }
  }
  return null;
}

function withTempDir(fn) {
  return async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docx-to-md-test-'));
    try {
      await fn(dir);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
}

test('missing converter is a distinct error', { skip: process.platform === 'win32' }, withTempDir(async (dir) => {
  const src = path.join(dir, 'sample.doc');
  fs.writeFileSync(src, Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  const savedPath = process.env.PATH;
  process.env.PATH = dir;
  try {
    await assert.rejects(legacyToDocx(src, { libreOfficePath: path.join(dir, 'missing', 'soffice') }), (e) => {
      assert.equal(e.code, 'NO_DOC_CONVERTER');
      assert.ok(e.attempts.join('\n').includes('not found'));
      return true;
    });
  } finally {
    process.env.PATH = savedPath;
  }
}));

const soffice = findLibreOffice();

test('.doc converts through LibreOffice', { skip: !soffice && 'LibreOffice not installed' }, withTempDir(async (dir) => {
  const source = path.join(dir, 'round.docx');
  fs.writeFileSync(source, docx({ body: styled('Heading1', r('Rozdział')) + p(r('Treść ') + r('ważna', '<w:b/>')), styles: STYLES }));
  const profile = pathToFileURL(path.join(dir, 'profile')).href;
  execFileSync(soffice, ['-env:UserInstallation=' + profile, '--headless', '--convert-to', 'doc', '--outdir', dir, source], { stdio: 'ignore', timeout: 180000 });
  const markdown = convertDocx(await legacyToDocx(path.join(dir, 'round.doc'))).markdown;
  assert.ok(markdown.includes('# Rozdział'));
  assert.ok(markdown.includes('Treść **ważna**'));
}));
