'use strict';

// The package plumbing: ZIP entries (stored and deflated) and the XML parser,
// including namespace prefixes a producer chose differently.

const { check, eq, done } = require('./harness');
const { zip } = require('./docx-builder');
const { readZip } = require('../src/zip');
const { parseXml, child, attr, textOf } = require('../src/xml');

check('stored and deflated entries read back', () => {
  for (const deflate of [false, true]) {
    const entries = readZip(zip({ 'a.txt': 'zażółć', 'dir/b.bin': Buffer.from([0, 1, 2, 255]) }, deflate));
    eq(entries.get('a.txt')().toString('utf8'), 'zażółć');
    eq(Array.from(entries.get('dir/b.bin')()).join(','), '0,1,2,255');
  }
});

check('garbage is not a zip', () => {
  let threw = false;
  try { readZip(Buffer.from('this is not a zip archive at all')); } catch { threw = true; }
  eq(threw, true);
});

check('entities, CDATA and comments', () => {
  const root = parseXml('<?xml version="1.0"?><!-- c --><a x="1 &amp; 2"><b>&lt;x&gt; &#261;&#x107;</b><![CDATA[<raw>]]></a>');
  eq(attr(root, 'x'), '1 & 2');
  eq(textOf(child(root, 'b')), '<x> ąć');
  eq(textOf(root), '<x> ąć<raw>');
});

check('> inside attribute values does not end the tag', () => {
  const root = parseXml('<a t="x > y"><b/></a>');
  eq(attr(root, 't'), 'x > y');
  eq(child(root, 'b') !== null, true);
});

check('foreign prefixes map to the conventional ones', () => {
  const root = parseXml('<ns0:document xmlns:ns0="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><ns0:body><ns0:p ns0:rsidR="1"/></ns0:body></ns0:document>');
  eq(root.name, 'w:document');
  const p = child(child(root, 'w:body'), 'w:p');
  eq(attr(p, 'w:rsidR'), '1');
});

check('default namespace maps too', () => {
  const root = parseXml('<document xmlns="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><body/></document>');
  eq(root.name, 'w:document');
  eq(child(root, 'w:body') !== null, true);
});

done('zip-xml');
