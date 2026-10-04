'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { zip } = require('./support/zip');
const { readZip } = require('../src/docx/zip');
const { parseXml, child, attr, textOf } = require('../src/docx/xml');

test('stored and deflated entries', () => {
  for (const deflate of [false, true]) {
    const entries = readZip(zip({ 'a.txt': 'zażółć', 'dir/b.bin': Buffer.from([0, 1, 2, 255]) }, deflate));
    assert.equal(entries.get('a.txt')().toString('utf8'), 'zażółć');
    assert.deepEqual([...entries.get('dir/b.bin')()], [0, 1, 2, 255]);
  }
});

test('garbage is not a zip', () => {
  assert.throws(() => readZip(Buffer.from('this is not a zip archive at all')));
});

test('entities, CDATA and comments', () => {
  const root = parseXml('<?xml version="1.0"?><!-- c --><a x="1 &amp; 2"><b>&lt;x&gt; &#261;&#x107;</b><![CDATA[<raw>]]></a>');
  assert.equal(attr(root, 'x'), '1 & 2');
  assert.equal(textOf(child(root, 'b')), '<x> ąć');
  assert.equal(textOf(root), '<x> ąć<raw>');
});

test('> inside attribute values', () => {
  const root = parseXml('<a t="x > y"><b/></a>');
  assert.equal(attr(root, 't'), 'x > y');
  assert.ok(child(root, 'b'));
});

test('namespace prefixes are normalized', () => {
  const main = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const prefixed = parseXml('<ns0:document xmlns:ns0="' + main + '"><ns0:body><ns0:p ns0:rsidR="1"/></ns0:body></ns0:document>');
  assert.equal(prefixed.name, 'w:document');
  assert.equal(attr(child(child(prefixed, 'w:body'), 'w:p'), 'w:rsidR'), '1');
  const unprefixed = parseXml('<document xmlns="' + main + '"><body/></document>');
  assert.equal(unprefixed.name, 'w:document');
  assert.ok(child(unprefixed, 'w:body'));
});
