'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { docx, r, p } = require('./support/docx');
const { md } = require('./support/convert');
const { convertDocx } = require('../src');

const drawing = (rid, descr) => '<w:r><w:drawing><wp:inline><wp:docPr id="1" name="Picture 1" descr="' + descr + '"/>' +
  '<a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="' + rid + '"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';

test('images are extracted and linked once', () => {
  const res = convertDocx(docx({
    body: p(drawing('rIdI1', 'A chart')) + p(drawing('rIdI1', 'again')) + p(drawing('rIdI2', '')),
    rels: [{ id: 'rIdI1', type: 'image', target: 'media/image1.png' }, { id: 'rIdI2', type: 'image', target: 'media/vector.emf' }],
    media: { 'image1.png': Buffer.from([137, 80, 78, 71]), 'vector.emf': Buffer.from([1, 0, 0, 0]) },
  }), { imageDir: 'My doc_images' });
  assert.equal(res.markdown, '![A chart](<My doc_images/image1.png>)\n\n![again](<My doc_images/image1.png>)\n\n![](<My doc_images/vector.emf>)\n');
  assert.deepEqual(res.images.map((i) => i.file), ['image1.png', 'vector.emf']);
  assert.deepEqual(res.warnings, [{ code: 'vectorImage', count: 1 }]);
});

test('content controls, smart tags and text boxes are unwrapped', () => {
  const content = '<w:txbxContent>' + p(r('In the box')) + '</w:txbxContent>';
  const box = '<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wp:anchor><wp:docPr id="2" name="Text Box"/>' +
    '<a:graphic><a:graphicData><wps:wsp xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:txbx>' +
    content + '</wps:txbx></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></mc:Choice>' +
    '<mc:Fallback><w:pict>' + content + '</w:pict></mc:Fallback></mc:AlternateContent></w:r>';
  assert.equal(md('<w:sdt><w:sdtContent>' + p('<w:smartTag>' + r('Tagged') + '</w:smartTag>' + box) + '</w:sdtContent></w:sdt>'), 'Tagged\n\nIn the box\n');
});

test('an unreadable package is not a docx', () => {
  assert.throws(() => convertDocx(Buffer.from('PK\u0003\u0004 truncated')), { code: 'NOT_DOCX' });
});
