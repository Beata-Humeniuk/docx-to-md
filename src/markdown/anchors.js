'use strict';

const { normalizeSpaces, plainText, slugify } = require('./text');

function headingText(block) {
  const label = block.list && block.list.kind !== 'bullet' ? block.list.label + ' ' : '';
  return normalizeSpaces(label + plainText(block.inlines));
}

function forEachNode(nodes, fn) {
  for (const n of nodes) {
    fn(n);
    if (n.children) forEachNode(n.children, fn);
  }
}

function forEachParagraph(blocks, fn, topLevel = true) {
  for (const b of blocks) {
    if (b.type === 'paragraph') fn(b, topLevel);
    if (b.type === 'table') for (const row of b.rows) for (const cell of row.cells) forEachParagraph(cell.blocks, fn, false);
  }
}

function collectAnchors(model) {
  const headings = [];
  const bookmarkTarget = new Map();
  const referenced = new Set();
  const used = new Map();

  const visit = (b, topLevel) => {
    forEachNode(b.inlines, (n) => { if (n.t === 'link' && n.anchor) referenced.add(n.anchor); });
    const text = b.heading && topLevel ? headingText(b) : '';
    if (!text) return;
    const base = slugify(text);
    const count = used.get(base) || 0;
    used.set(base, count + 1);
    b.slug = count ? base + '-' + count : base;
    if (!b.title) headings.push({ level: b.heading, text, slug: b.slug });
    forEachNode(b.inlines, (n) => { if (n.t === 'anchor') bookmarkTarget.set(n.name, b.slug); });
  };

  forEachParagraph(model.blocks, visit);
  for (const note of model.notes.values()) forEachParagraph(note.blocks, visit, false);
  return { headings, bookmarkTarget, referenced };
}

module.exports = { collectAnchors };
