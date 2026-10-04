'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { r, p, styled } = require('./support/docx');
const { md } = require('./support/convert');

const MONO = '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>';

test('inline formatting', () => {
  const out = md(p(r('plain ') + r('bold', '<w:b/>') + r(' ') + r('italic', '<w:i/>') + r(' ') + r('both', '<w:b/><w:i/>') + r(' ') +
    r('under', '<w:u w:val="single"/>') + r(' ') + r('gone', '<w:strike/>') + r(' x') + r('2', '<w:vertAlign w:val="superscript"/>') +
    r(' H') + r('2', '<w:vertAlign w:val="subscript"/>') + r('O ') + r('hl', '<w:highlight w:val="yellow"/>') + r(' ') +
    r('code()', '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>')));
  assert.equal(out, 'plain **bold** *italic **both*** <u>under</u> ~~gone~~ x<sup>2</sup> H<sub>2</sub>O <mark>hl</mark> `code()`\n');
});

test('formatting across runs is merged and spaces stay outside markers', () => {
  assert.equal(md(p(r('a ') + r('bold ', '<w:b/>') + r('and more', '<w:b/>') + r(' tail'))), 'a **bold and more** tail\n');
  assert.equal(md(p(r('x ') + r('bold ', '<w:b/>') + r('b+i', '<w:b/><w:i/>') + r(' y'))), 'x **bold *b+i*** y\n');
});

test('w:val="0" switches formatting off', () => {
  assert.equal(md(p(r('not bold', '<w:b w:val="0"/>'))), 'not bold\n');
});

test('markdown characters are escaped', () => {
  assert.equal(md(p(r('2 * 3 = 6, _x_, snake_case, [a](b), <tag>, `tick`'))),
    '2 \\* 3 = 6, \\_x\\_, snake_case, \\[a\\](b), \\<tag>, \\`tick\\`\n');
  assert.equal(md(p(r('# not a heading'))), '\\# not a heading\n');
  assert.equal(md(p(r('1. not a list'))), '1\\. not a list\n');
  assert.equal(md(p(r('- not a bullet'))), '\\- not a bullet\n');
});

test('headings, title and quote', () => {
  const out = md(styled('Title', r('Doc')) + styled('Heading1', r('One')) + styled('Heading2', r('Two', '<w:b/>')) +
    styled('Heading3', r('Three')) + styled('Quote', r('Wise words')));
  assert.equal(out, '# Doc\n\n# One\n\n## Two\n\n### Three\n\n> *Wise words*\n');
});

test('outline level makes a heading', () => {
  assert.equal(md(p(r('Custom'), '<w:outlineLvl w:val="1"/>')), '## Custom\n');
});

test('line and page breaks', () => {
  assert.equal(md(p(r('a') + '<w:r><w:br/></w:r>' + r('b'))), 'a\\\nb\n');
  assert.equal(md(p(r('a') + '<w:r><w:br w:type="page"/></w:r>' + r('b'))), 'ab\n');
});

test('monospaced paragraphs form one code block', () => {
  const out = md(p(r('Before')) + p(r('if (a) {', MONO)) + p(r('  return *b;', MONO)) + p(r('}', MONO)) + p(r('After')));
  assert.equal(out, 'Before\n\n```\nif (a) {\n  return *b;\n}\n```\n\nAfter\n');
});

test('hidden text is left out', () => {
  assert.equal(md(p(r('shown') + r(' secret', '<w:vanish/>'))), 'shown\n');
});

test('symbol characters', () => {
  assert.equal(md(p('<w:r><w:sym w:font="Wingdings" w:char="F0FC"/></w:r>' + r(' done'))), '✓ done\n');
});

test('empty paragraphs vanish', () => {
  assert.equal(md(p(r('a')) + p('') + p(r('   ')) + p(r('b'))), 'a\n\nb\n');
});
