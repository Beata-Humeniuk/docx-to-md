'use strict';

const { elements, child, attr, val } = require('./xml');

function collect(node, name, wrappers, out = []) {
  for (const el of elements(node)) {
    if (el.name === name) out.push(el);
    else if (el.name === 'w:sdt') collect(child(el, 'w:sdtContent'), name, wrappers, out);
    else if (wrappers.includes(el.name)) collect(el, name, wrappers, out);
  }
  return out;
}

function rowDropped(trPr, mode) {
  return (mode === 'accept' && child(trPr, 'w:del')) || (mode === 'reject' && child(trPr, 'w:ins'));
}

function readCell(reader, tc) {
  const tcPr = child(tc, 'w:tcPr');
  const merge = child(tcPr, 'w:vMerge');
  const tocOpen = reader.tocOpen;
  const blocks = reader.blocks(tc);
  reader.tocOpen = tocOpen;
  return {
    blocks,
    span: Math.max(1, Number(val(tcPr, 'w:gridSpan') || 1)),
    vMerge: merge ? (attr(merge, 'w:val') === 'restart' ? 'restart' : 'continue') : null,
  };
}

function readTable(reader, tbl) {
  const mode = reader.options.trackedChanges;
  const rowWrappers = mode === 'accept' ? ['w:customXml', 'w:ins'] : ['w:customXml', 'w:ins', 'w:del'];
  const rows = [];
  for (const tr of collect(tbl, 'w:tr', rowWrappers)) {
    const trPr = child(tr, 'w:trPr');
    if (rowDropped(trPr, mode)) continue;
    const header = child(trPr, 'w:tblHeader');
    rows.push({
      cells: collect(tr, 'w:tc', ['w:customXml']).map((tc) => readCell(reader, tc)),
      header: !!header && attr(header, 'w:val') !== '0',
      before: Number(val(trPr, 'w:gridBefore') || 0),
      after: Number(val(trPr, 'w:gridAfter') || 0),
    });
  }
  return { type: 'table', rows };
}

module.exports = { readTable };
