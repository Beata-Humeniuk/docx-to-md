'use strict';

const { layoutTable } = require('./grid');
const { escapeHtml, escapeText, codeSpan, codeText } = require('./text');

const someCell = (rows, test) => rows.some((r) => r.cells.some(test));
const shown = (cells) => cells.filter((c) => c.vMerge !== 'continue');

module.exports = {
  table(table) {
    const { rows, width } = layoutTable(table);
    if (!rows.length || !width || !someCell(rows, (c) => this.cellText(c.blocks, false))) return '';
    const merged = someCell(rows, (c) => c.span > 1 || c.rowspan > 1);
    const nested = someCell(rows, (c) => c.blocks.some((b) => b.type === 'table'));
    const mode = this.options.tables;
    if (mode === 'html' || (mode === 'auto' && (merged || nested))) return this.htmlTable(rows);
    return this.gfmTable(rows, width);
  },

  cellText(blocks, html) {
    return blocks.map((b) => (b.type === 'table' ? this.nestedTable(b, html) : this.cellParagraph(b, html)))
      .filter(Boolean).join('<br>');
  },

  nestedTable(table, html) {
    if (html) return this.htmlTable(layoutTable(table).rows);
    return this.cellText(table.rows.flatMap((r) => r.cells.flatMap((c) => c.blocks)), false);
  },

  cellParagraph(b, html) {
    if (b.type !== 'paragraph') return '';
    let text = this.inlines(b.inlines, html ? { html: true } : { table: true }).trim();
    if (!text) return '';
    if (b.code && !html) text = codeSpan(codeText(b.inlines).replace(/\n/g, ' '));
    if (b.heading) text = html ? '<strong>' + text + '</strong>' : '**' + text + '**';
    if (b.list && b.list.kind === 'bullet') text = '• ' + text;
    else if (b.list && b.list.kind !== 'none') text = (html ? escapeHtml(b.list.label) : escapeText(b.list.label, true)) + ' ' + text;
    return text.replace(/\n/g, html ? '<br>\n' : ' ');
  },

  gfmTable(rows, width) {
    const lines = rows.map((row) => {
      const cells = new Array(width).fill('');
      for (const c of shown(row.cells)) cells[c.col] = this.cellText(c.blocks, false);
      return '| ' + cells.map((c) => c || ' ').join(' | ') + ' |';
    });
    lines.splice(1, 0, '|' + ' --- |'.repeat(width));
    return lines.join('\n');
  },

  htmlTable(rows) {
    const flagged = rows.some((r) => r.header);
    const lines = rows.map((row, i) => {
      const tag = (flagged ? row.header : i === 0) ? 'th' : 'td';
      return '<tr>' + shown(row.cells).map((c) => {
        const span = (c.span > 1 ? ' colspan="' + c.span + '"' : '') + (c.rowspan > 1 ? ' rowspan="' + c.rowspan + '"' : '');
        return '<' + tag + span + '>' + this.cellText(c.blocks, true) + '</' + tag + '>';
      }).join('') + '</tr>';
    });
    return ['<table>', ...lines, '</table>'].join('\n');
  },
};
