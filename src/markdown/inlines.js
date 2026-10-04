'use strict';

const { MarkWriter, commonFormat, without } = require('./marks');
const { escapeHtml, escapeText, codeSpan, linkDestination, normalizeSpaces, splitEdges } = require('./text');

module.exports = {
  inlines(nodes, env) {
    const w = new MarkWriter(env.html, env.heading ? ['b'] : []);
    for (const n of nodes) {
      if (n.t === 'text') this.textNode(w, n, env);
      else if (n.t === 'break') w.write(env.heading ? ' ' : env.html || env.table ? '<br>' : '\\\n');
      else if (n.t === 'link') this.linkNode(w, n, env);
      else if (n.t === 'image') w.write(this.imageNode(n, env));
      else if (n.t === 'anchor') w.write(this.anchorNode(n, env));
      else if (n.t === 'note') w.write(this.noteRef(n, env));
    }
    return w.finish();
  },

  textNode(w, n, env) {
    const text = n.text.replace(/\t/g, ' ');
    if (!text.trim()) { w.write(env.html ? escapeHtml(text) : text); return; }
    const rest = w.format(n.fmt, text);
    if (!n.fmt.code) { w.write(env.html ? escapeHtml(rest) : escapeText(rest, env.table)); return; }
    const { lead, core, trail } = splitEdges(rest);
    w.write(lead + (env.html ? '<code>' + escapeHtml(core) + '</code>' : codeSpan(core)) + trail);
  },

  linkNode(w, n, env) {
    const common = without(commonFormat(n.children), ['u']);
    const strip = ['u', ...Object.keys(common)];
    const children = n.children.map((c) => (c.t === 'text' ? Object.assign({}, c, { fmt: without(c.fmt, strip) }) : c));
    const inner = this.inlines(children, env);
    if (!inner.trim()) return;
    const target = n.href || '#' + this.anchorId(n.anchor || '');
    const { lead, core, trail } = splitEdges(w.format(common, inner));
    const link = env.html ? '<a href="' + escapeHtml(target) + '">' + core + '</a>' : '[' + core + '](' + linkDestination(target) + ')';
    w.write(lead + link + trail);
  },

  imageNode(n, env) {
    const src = n.file ? this.options.imageDir + '/' + n.file : n.src;
    if (env.html) return '<img src="' + escapeHtml(encodeURI(src)) + '" alt="' + escapeHtml(n.alt || '') + '">';
    return '![' + escapeText(normalizeSpaces(n.alt || ''), env.table) + '](' + linkDestination(src) + ')';
  },

  anchorNode(n, env) {
    if (env.heading || this.bookmarkTarget.has(n.name)) return '';
    if (!this.referenced.has(n.name) && n.name.startsWith('_')) return '';
    return '<a id="' + escapeHtml(n.name) + '"></a>';
  },
};
