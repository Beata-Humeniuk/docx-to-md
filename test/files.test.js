'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { sniff, isWordFile, targetsFor } = require('../src/files');

test('format comes from the bytes', () => {
  assert.equal(sniff(Buffer.from('PK\u0003\u0004rest-of-it', 'latin1')), 'docx');
  assert.equal(sniff(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0])), 'doc');
  assert.equal(sniff(Buffer.from('{\\rtf1\\ansi')), 'rtf');
  assert.equal(sniff(Buffer.from('plain text file')), null);
  assert.equal(sniff(Buffer.from('PK')), null);
});

test('word extensions', () => {
  assert.ok(['a.docx', 'b.DOC', 'c.rtf', 'd.dotx'].every(isWordFile));
  assert.ok(!isWordFile('e.md') && !isWordFile('f.pdf'));
});

test('output sits next to the document', () => {
  assert.deepEqual(targetsFor('/c:/Docs/Spec v2.docx'), {
    markdown: '/c:/Docs/Spec v2.md',
    imagesDir: '/c:/Docs/Spec v2_images',
    imagesLink: 'Spec v2_images',
  });
});

test('images folder stays inside the document folder', () => {
  const t = targetsFor('/w/doc.docx', '../{name}/./img');
  assert.equal(t.imagesDir, '/w/doc/img');
  assert.equal(t.imagesLink, 'doc/img');
  assert.equal(targetsFor('/w/doc.docx', '..').imagesLink, 'doc_images');
});
