'use strict';

// The document outline: every top-level heading with the range of blocks it
// owns, so a reader can leave whole sections out of the Markdown. A section
// runs from its heading to the next heading of the same or a higher level,
// so dropping a section drops its subsections with it.

const { plainText, normalizeSpaces } = require('./markdown');

function headingText(block) {
  const label = block.list && block.list.kind !== 'bullet' ? block.list.label + ' ' : '';
  return normalizeSpaces(label + plainText(block.inlines));
}

function outline(model) {
  const sections = [];
  model.blocks.forEach((b, index) => {
    if (b.type === 'paragraph' && b.heading && headingText(b)) {
      sections.push({ index, level: b.heading, text: headingText(b), start: index, end: model.blocks.length });
    }
  });
  sections.forEach((s, i) => {
    const next = sections.slice(i + 1).find((n) => n.level <= s.level);
    if (next) s.end = next.start;
  });
  return sections;
}

// Returns a copy of the model without the given sections (indices into
// outline()); notes and images are kept only where something still refers
// to them.
function withoutSections(model, sections, excluded) {
  const drop = new Set();
  for (const i of excluded) {
    const s = sections[i];
    if (s) for (let k = s.start; k < s.end; k++) drop.add(k);
  }
  const blocks = model.blocks.filter((b, index) => !drop.has(index));
  const used = new Set();
  const visit = (nodes) => nodes.forEach((n) => {
    if (n.t === 'image' && n.file) used.add(n.file);
    if (n.children) visit(n.children);
  });
  const walk = (list) => list.forEach((b) => {
    if (b.type === 'paragraph') visit(b.inlines);
    if (b.type === 'table') b.rows.forEach((r) => r.cells.forEach((c) => walk(c.blocks)));
  });
  walk(blocks);
  for (const note of model.notes.values()) walk(note.blocks);
  return Object.assign({}, model, { blocks, images: model.images.filter((img) => used.has(img.file)) });
}

module.exports = { outline, withoutSections };
