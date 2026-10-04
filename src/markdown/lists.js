'use strict';

const { escapeText } = require('./text');

class ListWriter {
  constructor() {
    this.open = [];
    this.last = null;
  }

  reset() {
    this.open = [];
  }

  item(item, lines, chunks) {
    const continues = !!this.last && chunks[chunks.length - 1] === this.last.chunk;
    if (!continues) this.open = [];
    const depth = item.depth !== undefined ? item.depth : item.ilvl * 720;
    let sibling = null;
    while (this.open.length && this.open[this.open.length - 1].depth >= depth) sibling = this.open.pop();
    const parent = this.open[this.open.length - 1];
    const indent = parent ? parent.col : 0;
    const marker = markerOf(item);
    if (item.kind === 'literal') lines[0] = escapeText(item.label) + ' ' + lines[0];
    const col = indent + marker.length;
    const text = lines.map((l, i) => (i === 0 ? ' '.repeat(indent) + marker : ' '.repeat(col)) + l).join('\n');
    const delim = item.kind === 'ordered' ? item.label.slice(-1) : null;
    const chunk = { text, tight: continues && this.canFollow(item, sibling, depth, delim) };
    chunks.push(chunk);
    this.open.push({ depth, col, kind: item.kind, delim });
    this.last = { chunk, kind: item.kind };
  }

  canFollow(item, sibling, depth, delim) {
    if (item.kind === 'literal' || this.last.kind === 'literal') return false;
    if (item.kind === 'bullet' || /^1[.)]$/.test(item.label)) return true;
    return !!sibling && sibling.depth === depth && sibling.kind === 'ordered' && sibling.delim === delim;
  }
}

function markerOf(item) {
  if (item.kind === 'bullet') return '- ';
  return item.kind === 'ordered' ? item.label + ' ' : '';
}

module.exports = { ListWriter };
