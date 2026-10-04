'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { r, p, styled, field, bookmark } = require('./support/docx');
const { md } = require('./support/convert');

const SITE = { rels: [{ id: 'rIdL1', type: 'hyperlink', target: 'https://example.com/x?a=1&amp;b=2', external: true }] };

test('table of contents is rebuilt from headings', () => {
  const body = styled('TOCHeading', r('Contents')) +
    p(field('TOC \\o "1-2" \\h \\z \\u', r('Old entry 1'))) + styled('TOC1', r('Old entry 2')) +
    styled('Heading1', r('Intro')) + styled('Heading2', r('Scope')) + styled('Heading3', r('Deep')) + styled('Heading1', r('Intro'));
  const out = md(body);
  assert.ok(out.includes('**Contents**\n\n- [Intro](#intro)\n  - [Scope](#scope)\n- [Intro](#intro-1)\n\n# Intro'));
  assert.ok(!out.includes('Old entry'));
  assert.ok(!out.includes('[Deep]'));
});

test('table of contents spanning paragraphs', () => {
  const begin = '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> TOC \\o "1-3" </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>';
  const body = p(begin + r('stale 1'), '<w:pStyle w:val="TOC1"/>') +
    styled('TOC1', r('stale 2') + '<w:r><w:fldChar w:fldCharType="end"/></w:r>') +
    p(r('After the TOC')) + styled('Heading1', r('Zażółć gęślą'));
  assert.equal(md(body), '- [Zażółć gęślą](#zażółć-gęślą)\n\nAfter the TOC\n\n# Zażółć gęślą\n');
});

test('table of figures keeps its entries without page numbers', () => {
  const entry = '<w:hyperlink w:anchor="_Toc9">' + r('Figure 1 Layout') + r('\t') + field('PAGEREF _Toc9 \\h', r('4')) + '</w:hyperlink>';
  const body = p(field('TOC \\h \\z \\c "Figure"', entry)) + p(bookmark(9, '_Toc9', r('Figure 1 Layout')));
  assert.equal(md(body), '[Figure 1 Layout](#_Toc9)\n\n<a id="_Toc9"></a>Figure 1 Layout\n');
});

test('static table of contents lines are replaced once', () => {
  assert.equal(md(styled('TOC1', r('One 1')) + styled('TOC2', r('Sub 2')) + styled('Heading1', r('One'))), '- [One](#one)\n\n# One\n');
});

test('cross-reference to a heading links to its anchor', () => {
  const body = styled('Heading1', bookmark(1, '_Ref123', r('Requirements'))) +
    p(r('See ') + field('REF _Ref123 \\h', r('Requirements')) + r(' on page ') + field('PAGEREF _Ref123 \\h', r('7')) + r('.'));
  assert.equal(md(body), '# Requirements\n\nSee [Requirements](#requirements) on page .\n');
});

test('bookmarks become anchors, hidden ones only when referenced', () => {
  const out = md(p(bookmark(1, 'MyMark', r('Marked text'))) + p(bookmark(2, '_Hidden', r('hidden target'))) +
    p(bookmark(3, '_Unused', r('plain'))) + p('<w:hyperlink w:anchor="_Hidden">' + r('jump') + '</w:hyperlink>'));
  assert.ok(out.includes('<a id="MyMark"></a>Marked text'));
  assert.ok(out.includes('<a id="_Hidden"></a>hidden target'));
  assert.ok(out.includes('\n\nplain\n'));
  assert.ok(out.includes('[jump](#_Hidden)'));
});

test('external hyperlinks', () => {
  const out = md(
    p('<w:hyperlink r:id="rIdL1">' + r('site', '<w:rStyle w:val="Hyperlink"/>') + '</w:hyperlink>') +
    p(field('HYPERLINK "https://example.com/a b"', r('spaced'))) +
    p('<w:fldSimple w:instr=" HYPERLINK &quot;https://example.org&quot; ">' + r('simple') + '</w:fldSimple>') +
    p('<w:hyperlink r:id="rIdL1">' + r('bold link', '<w:b/>') + '</w:hyperlink>') +
    p('<w:hyperlink r:id="rIdL1">' + r('u', '<w:u w:val="single"/>') + '</w:hyperlink>'), SITE);
  assert.equal(out,
    '[site](https://example.com/x?a=1&b=2)\n\n[spaced](<https://example.com/a b>)\n\n[simple](https://example.org)\n\n' +
    '**[bold link](https://example.com/x?a=1&b=2)**\n\n[u](https://example.com/x?a=1&b=2)\n');
});
