'use strict';

// Document → Markdown: formatting, headings, TOC, bookmarks and
// cross-references, links, tables, notes, comments, tracked changes, images.

const { check, eq, has, lacks, done } = require('./harness');
const { docx, r, p, styled, HEADING_STYLES } = require('./docx-builder');
const { convertDocx, readDocument, renderDocument } = require('../src/index');

const md = (body, opts = {}, conv = {}) => convertDocx(docx(Object.assign({ body, styles: HEADING_STYLES }, opts)), conv).markdown;

const fld = (instr, result) =>
  '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ' + instr + ' </w:instrText></w:r>' +
  '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' + result + '<w:r><w:fldChar w:fldCharType="end"/></w:r>';
const bm = (id, name, content) => '<w:bookmarkStart w:id="' + id + '" w:name="' + name + '"/>' + content + '<w:bookmarkEnd w:id="' + id + '"/>';

check('inline formatting', () => {
  const out = md(p(r('plain ') + r('bold', '<w:b/>') + r(' ') + r('italic', '<w:i/>') + r(' ') + r('both', '<w:b/><w:i/>') + r(' ') +
    r('under', '<w:u w:val="single"/>') + r(' ') + r('gone', '<w:strike/>') + r(' x') + r('2', '<w:vertAlign w:val="superscript"/>') +
    r(' H') + r('2', '<w:vertAlign w:val="subscript"/>') + r('O ') + r('hl', '<w:highlight w:val="yellow"/>') + r(' ') +
    r('code()', '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>')));
  eq(out, 'plain **bold** *italic **both*** <u>under</u> ~~gone~~ x<sup>2</sup> H<sub>2</sub>O <mark>hl</mark> `code()`\n');
});

check('formatting spanning runs is merged, spaces stay outside the markers', () => {
  eq(md(p(r('a ') + r('bold ', '<w:b/>') + r('and more', '<w:b/>') + r(' tail'))), 'a **bold and more** tail\n');
  eq(md(p(r('x ') + r('bold ', '<w:b/>') + r('b+i', '<w:b/><w:i/>') + r(' y'))), 'x **bold *b+i*** y\n');
});

check('explicit w:val="0" switches formatting off', () => {
  eq(md(p(r('not bold', '<w:b w:val="0"/>'))), 'not bold\n');
});

check('markdown characters in text are escaped', () => {
  eq(md(p(r('2 * 3 = 6, _x_, snake_case, [a](b), <tag>, `tick`'))),
    '2 \\* 3 = 6, \\_x\\_, snake_case, \\[a\\](b), \\<tag>, \\`tick\\`\n');
  eq(md(p(r('# not a heading'))), '\\# not a heading\n');
  eq(md(p(r('1. not a list'))), '1\\. not a list\n');
  eq(md(p(r('- not a bullet'))), '\\- not a bullet\n');
});

check('headings, title and quote', () => {
  const out = md(styled('Title', r('Doc')) + styled('Heading1', r('One')) + styled('Heading2', r('Two', '<w:b/>')) +
    styled('Heading3', r('Three')) + styled('Quote', r('Wise words')));
  eq(out, '# Doc\n\n# One\n\n## Two\n\n### Three\n\n> *Wise words*\n');
});

check('outline level on the paragraph makes a heading', () => {
  eq(md(p(r('Custom'), '<w:outlineLvl w:val="1"/>')), '## Custom\n');
});

check('line breaks', () => {
  eq(md(p(r('a') + '<w:r><w:br/></w:r>' + r('b'))), 'a\\\nb\n');
  eq(md(p(r('a') + '<w:r><w:br w:type="page"/></w:r>' + r('b'))), 'ab\n');
});

check('TOC field becomes links to the headings, the stale result is dropped', () => {
  const body =
    styled('TOCHeading', r('Contents')) +
    p(fld('TOC \\o "1-2" \\h \\z \\u', r('Old entry 1'))) +
    styled('TOC1', r('Old entry 2')) +
    styled('Heading1', r('Intro')) + styled('Heading2', r('Scope')) + styled('Heading3', r('Deep')) +
    styled('Heading1', r('Intro'));
  const out = md(body);
  has(out, '**Contents**\n\n- [Intro](#intro)\n  - [Scope](#scope)\n- [Intro](#intro-1)\n\n# Intro');
  lacks(out, 'Old entry');
  lacks(out, '[Deep]');
});

check('TOC split across paragraphs with field end in a later one', () => {
  const body =
    p('<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> TOC \\o "1-3" </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>' + r('stale 1'), '<w:pStyle w:val="TOC1"/>') +
    styled('TOC1', r('stale 2') + '<w:r><w:fldChar w:fldCharType="end"/></w:r>') +
    p(r('After the TOC')) + styled('Heading1', r('Zażółć gęślą'));
  const out = md(body);
  eq(out, '- [Zażółć gęślą](#zażółć-gęślą)\n\nAfter the TOC\n\n# Zażółć gęślą\n');
});

check('a table of figures keeps the entries Word wrote, without page numbers', () => {
  const body =
    p(fld('TOC \\h \\z \\c "Figure"', '<w:hyperlink w:anchor="_Toc9">' + r('Figure 1 Layout') + r('\t') + fld('PAGEREF _Toc9 \\h', r('4')) + '</w:hyperlink>')) +
    p(bm(9, '_Toc9', r('Figure 1 Layout')));
  eq(md(body), '[Figure 1 Layout](#_Toc9)\n\n<a id="_Toc9"></a>Figure 1 Layout\n');
});

check('a static TOC (styled lines without a field) is regenerated once', () => {
  const out = md(styled('TOC1', r('One 1')) + styled('TOC2', r('Sub 2')) + styled('Heading1', r('One')));
  eq(out, '- [One](#one)\n\n# One\n');
});

check('cross-reference to a heading bookmark links to the heading slug', () => {
  const body = styled('Heading1', bm(1, '_Ref123', r('Requirements'))) +
    p(r('See ') + fld('REF _Ref123 \\h', r('Requirements')) + r(' on page ') + fld('PAGEREF _Ref123 \\h', r('7')) + r('.'));
  eq(md(body), '# Requirements\n\nSee [Requirements](#requirements) on page .\n');
});

check('bookmarks outside headings become anchors; hidden ones only when referenced', () => {
  const body = p(bm(1, 'MyMark', r('Marked text'))) + p(bm(2, '_Hidden', r('hidden target'))) + p(bm(3, '_Unused', r('plain'))) +
    p('<w:hyperlink w:anchor="_Hidden">' + r('jump') + '</w:hyperlink>');
  const out = md(body);
  has(out, '<a id="MyMark"></a>Marked text');
  has(out, '<a id="_Hidden"></a>hidden target');
  has(out, '\n\nplain\n');
  has(out, '[jump](#_Hidden)');
});

check('external hyperlinks, relationship and field forms', () => {
  const out = md(
    p('<w:hyperlink r:id="rIdL1">' + r('site', '<w:rStyle w:val="Hyperlink"/>') + '</w:hyperlink>') +
    p(fld('HYPERLINK "https://example.com/a b"', r('spaced'))) +
    p('<w:fldSimple w:instr=" HYPERLINK &quot;https://example.org&quot; ">' + r('simple') + '</w:fldSimple>') +
    p('<w:hyperlink r:id="rIdL1">' + r('bold link', '<w:b/>') + '</w:hyperlink>'),
    { rels: [{ id: 'rIdL1', type: 'hyperlink', target: 'https://example.com/x?a=1&amp;b=2', external: true }] });
  eq(out,
    '[site](https://example.com/x?a=1&b=2)\n\n' +
    '[spaced](<https://example.com/a b>)\n\n' +
    '[simple](https://example.org)\n\n' +
    '**[bold link](https://example.com/x?a=1&b=2)**\n');
  // Word underlines links through the Hyperlink style; Markdown links need no <u>.
  eq(md(p('<w:hyperlink r:id="rIdL1">' + r('u', '<w:u w:val="single"/>') + '</w:hyperlink>'),
    { rels: [{ id: 'rIdL1', type: 'hyperlink', target: 'https://e.org', external: true }] }), '[u](https://e.org)\n');
});

check('GFM table with header row and pipe escaping', () => {
  const cell = (t) => '<w:tc><w:tcPr/>' + p(r(t)) + '</w:tc>';
  const row = (...c) => '<w:tr>' + c.map(cell).join('') + '</w:tr>';
  const out = md('<w:tbl>' + row('Name', 'Value') + row('a|b', '**') + row('multi', '') + '</w:tbl>');
  eq(out, '| Name | Value |\n| --- | --- |\n| a\\|b | \\*\\* |\n| multi |   |\n');
});

check('cells with several paragraphs and bullets use <br>', () => {
  const out = md('<w:tbl><w:tr><w:tc>' + p(r('H')) + '</w:tc></w:tr><w:tr><w:tc>' + p(r('line 1')) + p(r('line 2')) + '</w:tc></w:tr></w:tbl>');
  has(out, '| line 1<br>line 2 |');
});

check('indentation inside cells is kept as non-breaking spaces', () => {
  const cell = (...paras) => '<w:tc><w:tcPr/>' + paras.join('') + '</w:tc>';
  const body = '<w:tbl><w:tr>' + cell(p(r('H'))) + '</w:tr><w:tr>' + cell(
    p(r('top')),
    p(r('  two spaces')),
    p(r('indented'), '<w:ind w:left="360"/>'),
    p(r('deeper'), '<w:ind w:left="720"/>'),
    p(r('tabbed'), '<w:ind w:left="720"/>').replace('<w:t xml:space="preserve">tabbed', '<w:t xml:space="preserve">\ttabbed')) +
    '</w:tr></w:tbl>';
  const out = md(body);
  has(out, '| top<br>&nbsp;&nbsp;two spaces<br>&nbsp;&nbsp;indented<br>&nbsp;&nbsp;&nbsp;&nbsp;deeper<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;tabbed |');
  const html = md(body, {}, { tables: 'html' });
  has(html, '<td>top<br>&nbsp;&nbsp;two spaces<br>&nbsp;&nbsp;indented<br>');
});

check('nested lists inside cells keep their level', () => {
  const numbering = '<w:abstractNum w:abstractNumId="1">' +
    '<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:pPr><w:ind w:left="360"/></w:pPr></w:lvl>' +
    '<w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="o"/><w:pPr><w:ind w:left="720"/></w:pPr></w:lvl>' +
    '</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>';
  const item = (ilvl, text) => p(r(text), '<w:numPr><w:ilvl w:val="' + ilvl + '"/><w:numId w:val="1"/></w:numPr>');
  const body = '<w:tbl><w:tr><w:tc><w:tcPr/>' + p(r('H')) + '</w:tc></w:tr><w:tr><w:tc><w:tcPr/>' +
    item(0, 'one') + item(1, 'one-a') + item(1, 'one-b') + item(0, 'two') + p(r('plain')) + '</w:tc></w:tr></w:tbl>';
  has(md(body, { numbering }), '| • one<br>&nbsp;&nbsp;• one-a<br>&nbsp;&nbsp;• one-b<br>• two<br>plain |');
});

check('merged cells switch to an HTML table with colspan/rowspan', () => {
  const tc = (t, pr = '') => '<w:tc><w:tcPr>' + pr + '</w:tcPr>' + p(r(t)) + '</w:tc>';
  const body = '<w:tbl>' +
    '<w:tr>' + tc('A') + tc('B') + tc('C') + '</w:tr>' +
    '<w:tr>' + tc('wide', '<w:gridSpan w:val="2"/>') + tc('tall', '<w:vMerge w:val="restart"/>') + '</w:tr>' +
    '<w:tr>' + tc('x & <y>') + tc('**z**') + '<w:tc><w:tcPr><w:vMerge/></w:tcPr>' + p('') + '</w:tc></w:tr>' +
    '</w:tbl>';
  eq(md(body),
    '<table>\n' +
    '<tr><th>A</th><th>B</th><th>C</th></tr>\n' +
    '<tr><td colspan="2">wide</td><td rowspan="2">tall</td></tr>\n' +
    '<tr><td>x &amp; &lt;y&gt;</td><td>**z**</td></tr>\n' +
    '</table>\n');
  const gfm = md(body, {}, { tables: 'gfm' });
  has(gfm, '| wide |   | tall |');
});

check('tables setting html forces HTML with formatting as tags', () => {
  const out = md('<w:tbl><w:tr><w:tc>' + p(r('B', '<w:b/>') + r(' i', '<w:i/>')) + '</w:tc></w:tr></w:tbl>', {}, { tables: 'html' });
  eq(out, '<table>\n<tr><th><strong>B</strong> <em>i</em></th></tr>\n</table>\n');
});

check('footnotes and endnotes become GFM footnotes', () => {
  const footnotes = '<w:footnote w:type="separator" w:id="-1">' + p('<w:r><w:separator/></w:r>') + '</w:footnote>' +
    '<w:footnote w:id="1">' + p('<w:r><w:footnoteRef/></w:r>' + r(' Source: ') + r('ISO', '<w:i/>')) + '</w:footnote>';
  const endnotes = '<w:endnote w:id="1">' + p(r('An endnote.')) + '</w:endnote>';
  const out = md(p(r('Claim') + '<w:r><w:footnoteReference w:id="1"/></w:r>' + r(' more') + '<w:r><w:endnoteReference w:id="1"/></w:r>'),
    { footnotes, endnotes });
  eq(out, 'Claim[^1] more[^2]\n\n[^1]: Source: *ISO*\n\n[^2]: An endnote.\n');
});

check('comments become footnotes with the author, or disappear', () => {
  const comments = '<w:comment w:id="0" w:author="Anna">' + p(r('Check this')) + '</w:comment>';
  const body = p('<w:commentRangeStart w:id="0"/>' + r('Text') + '<w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r>');
  eq(md(body, { comments }), 'Text[^c1]\n\n[^c1]: **Anna:** Check this\n');
  eq(md(body, { comments }, { comments: 'omit' }), 'Text\n');
});

check('tracked changes: accept, reject, markup', () => {
  const body = p(r('Keep ') + '<w:ins w:id="1" w:author="A">' + r('new') + '</w:ins>' +
    '<w:del w:id="2" w:author="A"><w:r><w:delText>old</w:delText></w:r></w:del>' + r(' end'));
  eq(md(body), 'Keep new end\n');
  eq(md(body, {}, { trackedChanges: 'reject' }), 'Keep old end\n');
  eq(md(body, {}, { trackedChanges: 'markup' }), 'Keep <ins>new</ins><del>old</del> end\n');
});

check('hidden text is left out', () => {
  eq(md(p(r('shown') + r(' secret', '<w:vanish/>'))), 'shown\n');
});

check('images are extracted and linked, names deduplicated', () => {
  const drawing = (rid, descr) => '<w:r><w:drawing><wp:inline><wp:docPr id="1" name="Picture 1" descr="' + descr + '"/>' +
    '<a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="' + rid + '"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
  const res = convertDocx(docx({
    body: p(drawing('rIdI1', 'A chart')) + p(drawing('rIdI1', 'again')) + p(drawing('rIdI2', '')),
    rels: [{ id: 'rIdI1', type: 'image', target: 'media/image1.png' }, { id: 'rIdI2', type: 'image', target: 'media/vector.emf' }],
    media: { 'image1.png': Buffer.from([137, 80, 78, 71]), 'vector.emf': Buffer.from([1, 0, 0, 0]) },
  }), { imageDir: 'My doc_images' });
  eq(res.markdown, '![A chart](<My doc_images/image1.png>)\n\n![again](<My doc_images/image1.png>)\n\n![](<My doc_images/vector.emf>)\n');
  eq(res.images.map((i) => i.file).join(','), 'image1.png,vector.emf');
  eq(res.warnings.map((w) => w.code + ':' + w.count).join(','), 'vectorImage:1');
});

check('code: monospace paragraphs form one fenced block', () => {
  const mono = '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>';
  const out = md(p(r('Before')) + p(r('if (a) {', mono)) + p(r('  return *b;', mono)) + p(r('}', mono)) + p(r('After')));
  eq(out, 'Before\n\n```\nif (a) {\n  return *b;\n}\n```\n\nAfter\n');
});

check('content controls, smart tags and text boxes are unwrapped', () => {
  const box = '<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wp:anchor><wp:docPr id="2" name="Text Box"/>' +
    '<a:graphic><a:graphicData><wps:wsp xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:txbx><w:txbxContent>' +
    p(r('In the box')) + '</w:txbxContent></wps:txbx></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></mc:Choice>' +
    '<mc:Fallback><w:pict><w:txbxContent>' + p(r('In the box')) + '</w:txbxContent></w:pict></mc:Fallback></mc:AlternateContent></w:r>';
  const out = md('<w:sdt><w:sdtContent>' + p('<w:smartTag>' + r('Tagged') + '</w:smartTag>' + box) + '</w:sdtContent></w:sdt>');
  eq(out, 'Tagged\n\nIn the box\n');
});

check('symbols from Symbol/Wingdings fonts', () => {
  eq(md(p('<w:r><w:sym w:font="Wingdings" w:char="F0FC"/></w:r>' + r(' done'))), '✓ done\n');
});

check('empty paragraphs vanish, spacing between blocks is one blank line', () => {
  eq(md(p(r('a')) + p('') + p(r('   ')) + p(r('b'))), 'a\n\nb\n');
});

check('sections can be left out, with their subsections, notes and images', () => {
  const drawing = '<w:r><w:drawing><wp:inline><wp:docPr id="1" name="P" descr="pic"/><a:graphic><a:graphicData><pic:pic><pic:blipFill>' +
    '<a:blip r:embed="rIdI1"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
  const footnotes = '<w:footnote w:id="1">' + p(r('note')) + '</w:footnote>';
  const doc = readDocument(docx({
    body: p(r('Preamble')) + styled('Heading1', r('Keep')) + p(r('kept text')) +
      styled('Heading1', r('Drop')) + p(r('dropped') + '<w:r><w:footnoteReference w:id="1"/></w:r>') + styled('Heading2', r('Drop child')) + p(drawing) +
      styled('Heading1', r('Last')) + p(fld('TOC \\o "1-2"', r(''))),
    styles: HEADING_STYLES, footnotes,
    rels: [{ id: 'rIdI1', type: 'image', target: 'media/image1.png' }], media: { 'image1.png': Buffer.from([1]) },
  }));
  eq(doc.sections.map((s) => s.level + ':' + s.text + ':' + s.start + '-' + s.end).join(' '), '1:Keep:1-3 1:Drop:3-7 2:Drop child:5-7 1:Last:7-9');
  const out = renderDocument(doc, { excludeSections: [1] });
  eq(out.markdown, 'Preamble\n\n# Keep\n\nkept text\n\n# Last\n\n- [Keep](#keep)\n- [Last](#last)\n');
  eq(out.images.length, 0);
  eq(renderDocument(doc, {}).images.length, 1);
});

check('an unreadable package is reported as not a docx', () => {
  let code = null;
  try { convertDocx(Buffer.from('PK\u0003\u0004 truncated')); } catch (e) { code = e.code; }
  eq(code, 'NOT_DOCX');
});

done('convert');
