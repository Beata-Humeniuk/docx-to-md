'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { docx, r, p, numbered, styled, STYLES } = require('./support/docx');
const { convertDocx } = require('../src');
const { formatNumber } = require('../src/docx/numberFormat');

const lvl = (ilvl, fmt, text, extra = '') => '<w:lvl w:ilvl="' + ilvl + '"><w:start w:val="1"/><w:numFmt w:val="' + fmt + '"/>' +
  '<w:lvlText w:val="' + text + '"/>' + extra + '<w:pPr><w:ind w:left="' + (720 * (ilvl + 1)) + '" w:hanging="360"/></w:pPr></w:lvl>';
const headingLvl = (ilvl, style, text) => '<w:lvl w:ilvl="' + ilvl + '"><w:start w:val="1"/><w:numFmt w:val="decimal"/>' +
  '<w:pStyle w:val="' + style + '"/><w:lvlText w:val="' + text + '"/></w:lvl>';
const abstract = (id, levels) => '<w:abstractNum w:abstractNumId="' + id + '">' + levels.join('') + '</w:abstractNum>';
const num = (id, abstractId, extra = '') => '<w:num w:numId="' + id + '"><w:abstractNumId w:val="' + abstractId + '"/>' + extra + '</w:num>';

const NUMBERING = [
  abstract(1, [lvl(0, 'decimal', '%1.'), lvl(1, 'lowerLetter', '%2)'), lvl(2, 'lowerRoman', '(%3)')]),
  abstract(2, [lvl(0, 'decimal', '%1.'), lvl(1, 'decimal', '%1.%2.'), lvl(2, 'decimal', '%1.%2.%3.')]),
  abstract(3, [lvl(0, 'bullet', '•'), lvl(1, 'bullet', 'o')]),
  abstract(4, [headingLvl(0, 'Heading1', '%1.'), headingLvl(1, 'Heading2', '%1.%2')]),
  abstract(5, [lvl(0, 'decimal', '§ %1.')]),
  abstract(7, [lvl(0, 'upperRoman', '%1.'), lvl(1, 'decimal', '%1.%2', '<w:isLgl/>')]),
  num(1, 1), num(2, 2), num(3, 3), num(4, 4), num(5, 5),
  num(6, 1, '<w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride>'),
  num(7, 7), num(8, 1),
].join('');

const NUMBERED_STYLES = STYLES
  .replace('<w:outlineLvl w:val="0"/>', '<w:outlineLvl w:val="0"/><w:numPr><w:numId w:val="4"/></w:numPr>')
  .replace('<w:outlineLvl w:val="1"/>', '<w:outlineLvl w:val="1"/><w:numPr><w:ilvl w:val="1"/><w:numId w:val="4"/></w:numPr>');

const md = (body) => convertDocx(docx({ body, numbering: NUMBERING, styles: NUMBERED_STYLES })).markdown;

test('number formats', () => {
  const formats = ['decimal', 'lowerLetter', 'upperLetter', 'lowerRoman', 'upperRoman', 'decimalZero'];
  assert.deepEqual(formats.map((f) => formatNumber(4, f)), ['4', 'd', 'D', 'iv', 'IV', '04']);
  assert.equal(formatNumber(28, 'lowerLetter'), 'bb');
  assert.equal(formatNumber(1994, 'upperRoman'), 'MCMXCIV');
});

test('decimal list with letter and roman sublevels', () => {
  const out = md(numbered(1, 0, r('one')) + numbered(1, 1, r('sub a')) + numbered(1, 1, r('sub b')) +
    numbered(1, 2, r('deep')) + numbered(1, 0, r('two')));
  assert.equal(out, '1. one\n\n   a) sub a\n\n   b) sub b\n\n   (i) deep\n\n2. two\n');
});

test('multi-level numbering is kept verbatim', () => {
  const out = md(numbered(2, 0, r('A')) + numbered(2, 1, r('B')) + numbered(2, 2, r('C')) + numbered(2, 1, r('D')) + numbered(2, 0, r('E')));
  for (const line of ['1. A', '1.1. B', '1.1.1. C', '1.2. D', '2. E']) assert.ok(out.includes(line), line);
});

test('bullets nest by level', () => {
  assert.equal(md(numbered(3, 0, r('x')) + numbered(3, 1, r('y')) + numbered(3, 0, r('z'))), '- x\n  - y\n- z\n');
});

test('headings carry their numbers', () => {
  const out = md(styled('Heading1', r('Intro')) + styled('Heading2', r('Scope')) + styled('Heading2', r('Terms')) + styled('Heading1', r('Body')));
  assert.equal(out, '# 1. Intro\n\n## 1.1 Scope\n\n## 1.2 Terms\n\n# 2. Body\n');
});

test('custom labels stay literal', () => {
  assert.equal(md(numbered(5, 0, r('First')) + numbered(5, 0, r('Second'))), '§ 1. First\n\n§ 2. Second\n');
});

test('lists continue across interruptions and restart on override', () => {
  const out = md(numbered(1, 0, r('a')) + numbered(1, 0, r('b')) + p(r('text')) + numbered(8, 0, r('c')) + numbered(6, 0, r('fresh')));
  assert.ok(out.includes('1. a\n2. b'));
  assert.ok(out.includes('3. c'));
  assert.ok(out.includes('1. fresh'));
});

test('legal numbering turns roman parents into digits', () => {
  const out = md(numbered(7, 0, r('Part')) + numbered(7, 0, r('Part two')) + numbered(7, 1, r('Sub')));
  assert.ok(out.includes('II. Part two'));
  assert.ok(out.includes('2.1 Sub'));
});

test('ordered item after a bullet gets a blank line', () => {
  const out = md(numbered(1, 0, r('one')) + numbered(1, 0, r('two')) + numbered(3, 0, r('dot')) + numbered(1, 0, r('three')));
  assert.ok(out.includes('- dot\n\n3. three'));
});
