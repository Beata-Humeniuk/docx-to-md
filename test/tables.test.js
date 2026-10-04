'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { r, p } = require('./support/docx');
const { md } = require('./support/convert');

const cell = (text, tcPr = '') => '<w:tc><w:tcPr>' + tcPr + '</w:tcPr>' + p(r(text)) + '</w:tc>';
const row = (...cells) => '<w:tr>' + cells.join('') + '</w:tr>';
const table = (...rows) => '<w:tbl>' + rows.join('') + '</w:tbl>';

const MERGED = table(
  row(cell('A'), cell('B'), cell('C')),
  row(cell('wide', '<w:gridSpan w:val="2"/>'), cell('tall', '<w:vMerge w:val="restart"/>')),
  row(cell('x & <y>'), cell('**z**'), '<w:tc><w:tcPr><w:vMerge/></w:tcPr>' + p('') + '</w:tc>'));

test('GFM table with header row and escaped pipes', () => {
  const out = md(table(row(cell('Name'), cell('Value')), row(cell('a|b'), cell('**')), row(cell('multi'), cell(''))));
  assert.equal(out, '| Name | Value |\n| --- | --- |\n| a\\|b | \\*\\* |\n| multi |   |\n');
});

test('paragraphs in a cell are joined with <br>', () => {
  const out = md(table(row(cell('H')), row('<w:tc>' + p(r('line 1')) + p(r('line 2')) + '</w:tc>')));
  assert.ok(out.includes('| line 1<br>line 2 |'));
});

test('merged cells become an HTML table', () => {
  assert.equal(md(MERGED),
    '<table>\n<tr><th>A</th><th>B</th><th>C</th></tr>\n' +
    '<tr><td colspan="2">wide</td><td rowspan="2">tall</td></tr>\n' +
    '<tr><td>x &amp; &lt;y&gt;</td><td>**z**</td></tr>\n</table>\n');
  assert.ok(md(MERGED, {}, { tables: 'gfm' }).includes('| wide |   | tall |'));
});

test('tables: html writes formatting as tags', () => {
  const out = md(table(row('<w:tc>' + p(r('B', '<w:b/>') + r(' i', '<w:i/>')) + '</w:tc>')), {}, { tables: 'html' });
  assert.equal(out, '<table>\n<tr><th><strong>B</strong> <em>i</em></th></tr>\n</table>\n');
});
