'use strict';

// Builds .docx packages in memory for the tests: a tiny ZIP writer plus the
// minimum OOXML scaffolding around the given parts.

const zlib = require('zlib');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// files: { name: Buffer|string }; deflate: compress entries (method 8).
function zip(files, deflate = true) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const body = deflate ? zlib.deflateRawSync(data) : data;
    const nameBuf = Buffer.from(name, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(deflate ? 8 : 0, 10);
    central.writeUInt32LE(crc32(data), 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, body);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" ' +
  'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" ' +
  'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"';

const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';

function part(root, inner) {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:' + root + ' ' + NS + '>' + inner + '</w:' + root + '>';
}

// opts: { body, styles, numbering, footnotes, comments, rels: [{id, type, target, external}], media: {name: Buffer} }
function docx(opts) {
  const rels = [];
  const files = {};
  const add = (id, type, target, external) => rels.push(
    '<Relationship Id="' + id + '" Type="' + REL + type + '" Target="' + target + '"' + (external ? ' TargetMode="External"' : '') + '/>');
  if (opts.styles) { files['word/styles.xml'] = part('styles', opts.styles); add('rIdStyles', 'styles', 'styles.xml'); }
  if (opts.numbering) { files['word/numbering.xml'] = part('numbering', opts.numbering); add('rIdNum', 'numbering', 'numbering.xml'); }
  if (opts.footnotes) { files['word/footnotes.xml'] = part('footnotes', opts.footnotes); add('rIdFn', 'footnotes', 'footnotes.xml'); }
  if (opts.endnotes) { files['word/endnotes.xml'] = part('endnotes', opts.endnotes); add('rIdEn', 'endnotes', 'endnotes.xml'); }
  if (opts.comments) { files['word/comments.xml'] = part('comments', opts.comments); add('rIdCm', 'comments', 'comments.xml'); }
  for (const r of opts.rels || []) add(r.id, r.type, r.target, r.external);
  for (const [name, data] of Object.entries(opts.media || {})) files['word/media/' + name] = data;
  const ct = (part, type) => '<Override PartName="/word/' + part + '.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.' + type + '+xml"/>';
  files['[Content_Types].xml'] = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>' +
    ct('document', 'document.main') + (opts.styles ? ct('styles', 'styles') : '') + (opts.numbering ? ct('numbering', 'numbering') : '') +
    (opts.footnotes ? ct('footnotes', 'footnotes') : '') + (opts.endnotes ? ct('endnotes', 'endnotes') : '') +
    (opts.comments ? ct('comments', 'comments') : '') + '</Types>';
  files['_rels/.rels'] = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="' + REL + 'officeDocument" Target="word/document.xml"/></Relationships>';
  files['word/document.xml'] = part('document', '<w:body>' + opts.body + '<w:sectPr/></w:body>');
  files['word/_rels/document.xml.rels'] = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels.join('') + '</Relationships>';
  return zip(files, opts.deflate !== false);
}

// Shorthands for body XML.
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const r = (text, rPr = '') => '<w:r>' + (rPr ? '<w:rPr>' + rPr + '</w:rPr>' : '') + '<w:t xml:space="preserve">' + esc(text) + '</w:t></w:r>';
const p = (content, pPr = '') => '<w:p>' + (pPr ? '<w:pPr>' + pPr + '</w:pPr>' : '') + content + '</w:p>';
const styled = (style, content, extra = '') => p(content, '<w:pStyle w:val="' + style + '"/>' + extra);
const numbered = (numId, ilvl, content, style) => p(content, (style ? '<w:pStyle w:val="' + style + '"/>' : '') +
  '<w:numPr><w:ilvl w:val="' + ilvl + '"/><w:numId w:val="' + numId + '"/></w:numPr>');

// Standard heading styles, like Word's own styles.xml.
const HEADING_STYLES =
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
  [1, 2, 3].map((n) => '<w:style w:type="paragraph" w:styleId="Heading' + n + '"><w:name w:val="heading ' + n + '"/>' +
    '<w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="' + (n - 1) + '"/></w:pPr><w:rPr><w:b/></w:rPr></w:style>').join('') +
  '<w:style w:type="paragraph" w:styleId="TOCHeading"><w:name w:val="TOC Heading"/><w:basedOn w:val="Heading1"/></w:style>' +
  '<w:style w:type="paragraph" w:styleId="TOC1"><w:name w:val="toc 1"/></w:style>' +
  '<w:style w:type="paragraph" w:styleId="TOC2"><w:name w:val="toc 2"/></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:rPr><w:i/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/></w:style>';

module.exports = { zip, docx, r, p, styled, numbered, esc, HEADING_STYLES };
