'use strict';

const { elements, child, val } = require('./xml');
const { indentOf } = require('./indent');

const INDENT_PER_LEVEL = 720;

function hasContent(nodes) {
  return nodes.some((n) => n.t !== 'anchor' && (n.t !== 'text' || n.text.trim() !== ''));
}

function headingLevel(pPr, info) {
  const outline = val(pPr, 'w:outlineLvl');
  if (outline !== null && Number(outline) < 9) return { level: Number(outline) + 1, title: false };
  return { level: info.headingLevel, title: info.title };
}

function numbering(pPr, info, reader) {
  const numPr = child(pPr, 'w:numPr');
  const numId = numPr ? val(numPr, 'w:numId') : null;
  if (numId !== null || !info.numPr) return { numId, ilvl: numPr ? val(numPr, 'w:ilvl') : null };
  const own = numPr ? val(numPr, 'w:ilvl') : null;
  const ilvl = own !== null ? own
    : info.numPr.ilvl !== null ? info.numPr.ilvl
      : reader.numbering.levelForStyle(info.numPr.numId, info.numPr.styleId);
  return { numId: info.numPr.numId, ilvl };
}

function listItem(reader, pPr, info) {
  const { numId, ilvl } = numbering(pPr, info, reader);
  const item = numId && numId !== '0' && reader.numbering.next(numId, Number(ilvl || 0));
  if (!item) return null;
  const indent = [indentOf(pPr), item.indent, info.indent].find((v) => v !== null && v !== undefined);
  item.depth = indent !== undefined ? indent : item.ilvl * INDENT_PER_LEVEL;
  return item;
}

function allMonospace(nodes) {
  const texts = [];
  const collect = (list) => list.forEach((n) => {
    if (n.t === 'text' && n.text.trim()) texts.push(n);
    if (n.children) collect(n.children);
  });
  collect(nodes);
  return texts.length > 0 && texts.every((n) => n.fmt.code);
}

function readInlines(reader, p, info) {
  const ctx = reader.newContext();
  for (const name of reader.pendingBookmarks) ctx.root.push({ t: 'anchor', name });
  reader.pendingBookmarks = [];
  reader.pendingToc = null;
  reader.inlines(elements(p).filter((e) => e.name !== 'w:pPr'), ctx, info.runFormat);
  const toc = reader.pendingToc;
  reader.pendingToc = null;
  return { ctx, toc };
}

function readParagraph(reader, p, blocks) {
  const pPr = child(p, 'w:pPr');
  const info = reader.styles.paragraphInfo(val(pPr, 'w:pStyle'));
  const { ctx, toc } = readInlines(reader, p, info);
  const content = hasContent(ctx.root);

  if (info.tocEntry && !toc) {
    if (!reader.tocOpen) blocks.push({ type: 'toc', from: 1, to: 9 });
    reader.tocOpen = true;
    reader.textboxes(ctx, blocks);
    return;
  }

  const block = { type: 'paragraph', inlines: ctx.root };
  const heading = headingLevel(pPr, info);
  if (heading.level) block.heading = Math.min(heading.level, 6);
  if (heading.level && heading.title) block.title = true;

  const markDeleted = !!child(child(pPr, 'w:rPr'), 'w:del') && reader.options.trackedChanges === 'accept';
  const list = !markDeleted && (content || !heading.level) ? listItem(reader, pPr, info) : null;
  if (list) block.list = list;

  if (info.tocHeading) block.tocHeading = true;
  else if (info.code) block.code = true;
  else if (info.quote) block.quote = true;
  if (!block.code && !block.heading && !block.list && content && allMonospace(ctx.root)) block.code = true;

  if (ctx.root.length) {
    if (content) reader.tocOpen = false;
    blocks.push(block);
  }
  if (toc) {
    blocks.push({ type: 'toc', from: toc.from, to: toc.to });
    reader.tocOpen = true;
  }
  reader.textboxes(ctx, blocks);
}

module.exports = { readParagraph };
