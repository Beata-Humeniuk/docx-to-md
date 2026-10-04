'use strict';

const { ListWriter } = require('./lists');
const { escapeText, escapeLineStart, codeBlock, codeText, normalizeSpaces } = require('./text');

module.exports = {
  blocks(blocks, chunks) {
    const lists = new ListWriter();
    let code = null;
    const flushCode = () => {
      if (code) chunks.push({ text: codeBlock(code.join('\n')) });
      code = null;
    };
    for (const b of blocks) {
      if (!b.code) flushCode();
      if (b.type === 'paragraph' && !b.code && !b.heading) { this.paragraph(b, chunks, lists); continue; }
      lists.reset();
      if (b.type === 'table') chunks.push({ text: this.table(b) });
      else if (b.code) code = (code || []).concat(codeText(b.inlines));
      else this.pushText(chunks, b.type === 'toc' ? this.toc(b) : this.heading(b));
    }
    flushCode();
  },

  pushText(chunks, text) {
    if (text) chunks.push({ text });
  },

  heading(b) {
    const label = b.list && b.list.kind !== 'bullet' ? escapeText(b.list.label) + ' ' : '';
    const text = (label + normalizeSpaces(this.inlines(b.inlines, { heading: true }))).trim();
    if (!text) return '';
    return '#'.repeat(b.heading) + ' ' + text.replace(/#$/, '\\#');
  },

  paragraph(b, chunks, lists) {
    const text = this.inlines(b.inlines, {}).replace(/^(\s|\\\n)+|(\s|\\\n)+$/g, '');
    if (!text) return;
    if (b.tocHeading) {
      lists.reset();
      chunks.push({ text: '**' + normalizeSpaces(this.inlines(b.inlines, { heading: true })) + '**' });
      return;
    }
    const lines = text.split('\n').map((l) => escapeLineStart(l.replace(/^[ \t]+/, '')));
    if (b.list && b.list.kind !== 'none') { lists.item(b.list, lines, chunks); return; }
    lists.reset();
    chunks.push({ text: lines.map((l) => (b.quote ? '> ' + l : l)).join('\n') });
  },

  toc(b) {
    const items = this.anchors.headings.filter((h) => h.level >= b.from && h.level <= b.to);
    if (!items.length) return '';
    const min = Math.min(...items.map((h) => h.level));
    return items.map((h) => '  '.repeat(h.level - min) + '- [' + escapeText(h.text) + '](#' + h.slug + ')').join('\n');
  },
};
