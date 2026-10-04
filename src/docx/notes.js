'use strict';

const { elements, attr } = require('./xml');

const NOTE_PARTS = {
  footnote: { suffix: '/footnotes', element: 'w:footnote' },
  endnote: { suffix: '/endnotes', element: 'w:endnote' },
  comment: { suffix: '/comments', element: 'w:comment' },
};

function indexNotes(pkg) {
  const index = {};
  for (const [kind, { suffix, element }] of Object.entries(NOTE_PARTS)) {
    const part = pkg.relByType(pkg.main, suffix);
    const byId = new Map();
    for (const el of elements(part && pkg.xml(part))) if (el.name === element) byId.set(attr(el, 'w:id'), el);
    index[kind] = { part, byId };
  }
  return index;
}

function readNotes(reader) {
  const index = indexNotes(reader.pkg);
  const notes = new Map();
  for (let i = 0; i < reader.noteRefs.length; i++) {
    const { kind, id } = reader.noteRefs[i];
    const key = kind + ':' + id;
    if (notes.has(key)) continue;
    const el = index[kind].byId.get(id);
    if (!el) { notes.set(key, { kind, blocks: [] }); continue; }
    reader.part = index[kind].part;
    reader.fields = [];
    const blocks = reader.blocks(el);
    notes.set(key, { kind, blocks, author: kind === 'comment' ? attr(el, 'w:author') || '' : null });
  }
  reader.part = reader.pkg.main;
  return notes;
}

module.exports = { readNotes };
