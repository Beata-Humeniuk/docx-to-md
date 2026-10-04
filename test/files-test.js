'use strict';

// Output locations and format sniffing.

const { check, eq, done } = require('./harness');
const { sniff, isWordFile, targetsFor } = require('../src/files');

check('format comes from the bytes', () => {
  eq(sniff(Buffer.from('PK\u0003\u0004rest-of-it', 'latin1')), 'docx');
  eq(sniff(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0])), 'doc');
  eq(sniff(Buffer.from('{\\rtf1\\ansi')), 'rtf');
  eq(sniff(Buffer.from('plain text file')), null);
  eq(sniff(Buffer.from('PK')), null);
});

check('word extensions', () => {
  eq(['a.docx', 'b.DOC', 'c.rtf', 'd.dotx'].every(isWordFile), true);
  eq(isWordFile('e.md') || isWordFile('f.pdf'), false);
});

check('markdown and images sit next to the document', () => {
  const t = targetsFor('/c:/Docs/Spec v2.docx');
  eq(t.markdown, '/c:/Docs/Spec v2.md');
  eq(t.imagesDir, '/c:/Docs/Spec v2_images');
  eq(t.imagesLink, 'Spec v2_images');
});

check('images folder pattern cannot climb out of the folder', () => {
  const t = targetsFor('/w/doc.docx', '../{name}/./img');
  eq(t.imagesDir, '/w/doc/img');
  eq(t.imagesLink, 'doc/img');
  eq(targetsFor('/w/doc.docx', '..').imagesLink, 'doc_images');
});

done('files');
