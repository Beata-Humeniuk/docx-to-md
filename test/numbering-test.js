'use strict';

// Numbering replay: the labels Word shows, list nesting and restarts.

const { check, eq, has, done } = require('./harness');
const { docx, r, numbered, styled, HEADING_STYLES } = require('./docx-builder');
const { convertDocx } = require('../src/index');
const { formatNumber } = require('../src/numbering');

const lvl = (ilvl, fmt, text, extra = '') => '<w:lvl w:ilvl="' + ilvl + '"><w:start w:val="1"/><w:numFmt w:val="' + fmt + '"/>' +
  '<w:lvlText w:val="' + text + '"/>' + extra + '<w:pPr><w:ind w:left="' + (720 * (ilvl + 1)) + '" w:hanging="360"/></w:pPr></w:lvl>';

const NUMBERING =
  '<w:abstractNum w:abstractNumId="1">' + lvl(0, 'decimal', '%1.') + lvl(1, 'lowerLetter', '%2)') + lvl(2, 'lowerRoman', '(%3)') + '</w:abstractNum>' +
  '<w:abstractNum w:abstractNumId="2">' + lvl(0, 'decimal', '%1.') + lvl(1, 'decimal', '%1.%2.') + lvl(2, 'decimal', '%1.%2.%3.') + '</w:abstractNum>' +
  '<w:abstractNum w:abstractNumId="3">' + lvl(0, 'bullet', '•') + lvl(1, 'bullet', 'o') + '</w:abstractNum>' +
  '<w:abstractNum w:abstractNumId="4">' +
    '<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:pStyle w:val="Heading1"/><w:lvlText w:val="%1."/></w:lvl>' +
    '<w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:pStyle w:val="Heading2"/><w:lvlText w:val="%1.%2"/></w:lvl>' +
  '</w:abstractNum>' +
  '<w:abstractNum w:abstractNumId="5">' + lvl(0, 'decimal', '§ %1.') + '</w:abstractNum>' +
  '<w:abstractNum w:abstractNumId="7">' + lvl(0, 'upperRoman', '%1.') + lvl(1, 'decimal', '%1.%2', '<w:isLgl/>') + '</w:abstractNum>' +
  '<w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>' +
  '<w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num>' +
  '<w:num w:numId="3"><w:abstractNumId w:val="3"/></w:num>' +
  '<w:num w:numId="4"><w:abstractNumId w:val="4"/></w:num>' +
  '<w:num w:numId="5"><w:abstractNumId w:val="5"/></w:num>' +
  '<w:num w:numId="6"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>' +
  '<w:num w:numId="7"><w:abstractNumId w:val="7"/></w:num>' +
  '<w:num w:numId="8"><w:abstractNumId w:val="1"/></w:num>';

const STYLES = HEADING_STYLES.replace('<w:outlineLvl w:val="0"/>', '<w:outlineLvl w:val="0"/><w:numPr><w:numId w:val="4"/></w:numPr>')
  .replace('<w:outlineLvl w:val="1"/>', '<w:outlineLvl w:val="1"/><w:numPr><w:ilvl w:val="1"/><w:numId w:val="4"/></w:numPr>');

const md = (body) => convertDocx(docx({ body, numbering: NUMBERING, styles: STYLES })).markdown;

check('number formats', () => {
  eq(['decimal', 'lowerLetter', 'upperLetter', 'lowerRoman', 'upperRoman', 'decimalZero'].map((f) => formatNumber(4, f)).join(' '), '4 d D iv IV 04');
  eq(formatNumber(28, 'lowerLetter'), 'bb');
  eq(formatNumber(1994, 'upperRoman'), 'MCMXCIV');
});

check('decimal list with letter and roman sublevels', () => {
  const out = md(
    numbered(1, 0, r('one')) + numbered(1, 1, r('sub a')) + numbered(1, 1, r('sub b')) +
    numbered(1, 2, r('deep')) + numbered(1, 0, r('two')));
  eq(out,
    '1. one\n\n' +
    '   a) sub a\n\n' +
    '   b) sub b\n\n' +
    '   (i) deep\n\n' +
    '2. two\n');
});

check('multi-level legal numbering is kept verbatim', () => {
  const out = md(numbered(2, 0, r('A')) + numbered(2, 1, r('B')) + numbered(2, 2, r('C')) + numbered(2, 1, r('D')) + numbered(2, 0, r('E')));
  has(out, '1. A');
  has(out, '1.1. B');
  has(out, '1.1.1. C');
  has(out, '1.2. D');
  has(out, '2. E');
});

check('bullets nest by level', () => {
  eq(md(numbered(3, 0, r('x')) + numbered(3, 1, r('y')) + numbered(3, 0, r('z'))), '- x\n  - y\n- z\n');
});

check('headings carry their numbers', () => {
  const out = md(styled('Heading1', r('Intro')) + styled('Heading2', r('Scope')) + styled('Heading2', r('Terms')) + styled('Heading1', r('Body')));
  eq(out, '# 1. Intro\n\n## 1.1 Scope\n\n## 1.2 Terms\n\n# 2. Body\n');
});

check('paragraph-sign labels stay literal', () => {
  const out = md(numbered(5, 0, r('First')) + numbered(5, 0, r('Second')));
  eq(out, '§ 1. First\n\n§ 2. Second\n');
});

check('a list continues across interruptions and restarts on override', () => {
  const out = md(numbered(1, 0, r('a')) + numbered(1, 0, r('b')) + '<w:p><w:r><w:t>text</w:t></w:r></w:p>' +
    numbered(8, 0, r('c')) + numbered(6, 0, r('fresh')));
  has(out, '1. a\n2. b');
  has(out, '3. c');
  has(out, '1. fresh');
});

check('isLgl turns roman parents into decimals', () => {
  const out = md(numbered(7, 0, r('Part')) + numbered(7, 0, r('Part two')) + numbered(7, 1, r('Sub')));
  has(out, 'II. Part two');
  has(out, '2.1 Sub');
});

check('an ordered item not starting at 1 after a bullet gets a blank line', () => {
  const out = md(numbered(1, 0, r('one')) + numbered(1, 0, r('two')) + numbered(3, 0, r('dot')) + numbered(1, 0, r('three')));
  has(out, '- dot\n\n3. three');
});

done('numbering');
