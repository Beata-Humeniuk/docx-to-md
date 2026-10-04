'use strict';

const { zip } = require('./zip');

const OOXML = 'http://schemas.openxmlformats.org/';
const NAMESPACES = {
  w: 'wordprocessingml/2006/main',
  r: 'officeDocument/2006/relationships',
  wp: 'drawingml/2006/wordprocessingDrawing',
  a: 'drawingml/2006/main',
  pic: 'drawingml/2006/picture',
  mc: 'markup-compatibility/2006',
  m: 'officeDocument/2006/math',
};
const XMLNS = Object.entries(NAMESPACES).map(([p, uri]) => 'xmlns:' + p + '="' + OOXML + uri + '"').join(' ');
const REL = OOXML + 'officeDocument/2006/relationships/';
const PARTS = ['styles', 'numbering', 'footnotes', 'endnotes', 'comments'];

const part = (root, inner) => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:' + root + ' ' + XMLNS + '>' + inner + '</w:' + root + '>';
const relationship = ({ id, type, target, external }) =>
  '<Relationship Id="' + id + '" Type="' + REL + type + '" Target="' + target + '"' + (external ? ' TargetMode="External"' : '') + '/>';
const relationships = (items) =>
  '<?xml version="1.0"?><Relationships xmlns="' + OOXML + 'package/2006/relationships">' + items.map(relationship).join('') + '</Relationships>';
const override = (name, type) =>
  '<Override PartName="/word/' + name + '.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.' + type + '+xml"/>';

function contentTypes(parts) {
  return '<?xml version="1.0"?><Types xmlns="' + OOXML + 'package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>' +
    override('document', 'document.main') + parts.map((name) => override(name, name)).join('') + '</Types>';
}

function docx(opts) {
  const parts = PARTS.filter((name) => opts[name]);
  const files = {
    '[Content_Types].xml': contentTypes(parts),
    '_rels/.rels': relationships([{ id: 'rId1', type: 'officeDocument', target: 'word/document.xml' }]),
    'word/document.xml': part('document', '<w:body>' + opts.body + '<w:sectPr/></w:body>'),
    'word/_rels/document.xml.rels': relationships([
      ...parts.map((name) => ({ id: 'rId_' + name, type: name, target: name + '.xml' })),
      ...(opts.rels || []),
    ]),
  };
  for (const name of parts) files['word/' + name + '.xml'] = part(name, opts[name]);
  for (const [name, data] of Object.entries(opts.media || {})) files['word/media/' + name] = data;
  return zip(files);
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const r = (text, rPr = '') => '<w:r>' + (rPr ? '<w:rPr>' + rPr + '</w:rPr>' : '') + '<w:t xml:space="preserve">' + esc(text) + '</w:t></w:r>';
const p = (content, pPr = '') => '<w:p>' + (pPr ? '<w:pPr>' + pPr + '</w:pPr>' : '') + content + '</w:p>';
const styled = (style, content) => p(content, '<w:pStyle w:val="' + style + '"/>');
const numbered = (numId, ilvl, content) => p(content, '<w:numPr><w:ilvl w:val="' + ilvl + '"/><w:numId w:val="' + numId + '"/></w:numPr>');
const field = (instruction, result) =>
  '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ' + instruction + ' </w:instrText></w:r>' +
  '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' + result + '<w:r><w:fldChar w:fldCharType="end"/></w:r>';
const bookmark = (id, name, content) => '<w:bookmarkStart w:id="' + id + '" w:name="' + name + '"/>' + content + '<w:bookmarkEnd w:id="' + id + '"/>';

const style = (id, name, inner = '') => '<w:style w:type="paragraph" w:styleId="' + id + '"><w:name w:val="' + name + '"/>' + inner + '</w:style>';
const heading = (n) => style('Heading' + n, 'heading ' + n, '<w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="' + (n - 1) + '"/></w:pPr><w:rPr><w:b/></w:rPr>');

const STYLES = '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
  [1, 2, 3].map(heading).join('') +
  style('TOCHeading', 'TOC Heading', '<w:basedOn w:val="Heading1"/>') +
  style('TOC1', 'toc 1') + style('TOC2', 'toc 2') +
  style('Quote', 'Quote', '<w:rPr><w:i/></w:rPr>') +
  style('Title', 'Title');

module.exports = { docx, r, p, styled, numbered, field, bookmark, STYLES };
