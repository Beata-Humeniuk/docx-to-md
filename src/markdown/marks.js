'use strict';

const MARKDOWN = {
  del: ['<del>', '</del>'], ins: ['<ins>', '</ins>'], u: ['<u>', '</u>'], mark: ['<mark>', '</mark>'],
  sup: ['<sup>', '</sup>'], sub: ['<sub>', '</sub>'], s: ['~~', '~~'], b: ['**', '**'], i: ['*', '*'],
};
const HTML = Object.assign({}, MARKDOWN, { s: ['<s>', '</s>'], b: ['<strong>', '</strong>'], i: ['<em>', '</em>'] });
const ORDER = ['del', 'ins', 'u', 'mark', 'sup', 'sub', 's', 'b', 'i'];

class MarkWriter {
  constructor(html, skip) {
    this.marks = html ? HTML : MARKDOWN;
    this.skip = skip || [];
    this.stack = [];
    this.out = '';
  }

  write(text) {
    this.out += text;
  }

  format(fmt, text) {
    const want = new Set(ORDER.filter((m) => fmt[m] && !this.skip.includes(m)));
    this.closeTo(want);
    return this.open(want, text);
  }

  closeTo(keep) {
    const k = this.stack.findIndex((m) => !keep.has(m));
    if (k < 0) return;
    const trailing = /\s+$/.exec(this.out);
    if (trailing) this.out = this.out.slice(0, -trailing[0].length);
    while (this.stack.length > k) this.out += this.marks[this.stack.pop()][1];
    if (trailing) this.out += trailing[0];
  }

  open(want, text) {
    const missing = ORDER.filter((m) => want.has(m) && !this.stack.includes(m));
    if (!missing.length) return text;
    const lead = /^\s+/.exec(text);
    if (lead) { this.out += lead[0]; text = text.slice(lead[0].length); }
    for (const m of missing) { this.out += this.marks[m][0]; this.stack.push(m); }
    return text;
  }

  finish() {
    this.closeTo(new Set());
    return this.out;
  }
}

function commonFormat(nodes) {
  const texts = nodes.filter((n) => n.t === 'text' && n.text.trim());
  const out = {};
  if (texts.length) for (const k of ORDER) if (texts.every((n) => n.fmt[k])) out[k] = true;
  return out;
}

function without(fmt, keys) {
  const out = Object.assign({}, fmt);
  for (const k of keys) delete out[k];
  return out;
}

module.exports = { MarkWriter, commonFormat, without };
