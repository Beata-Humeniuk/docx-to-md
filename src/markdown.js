'use strict';

// Document model → Markdown (CommonMark + GFM tables, strikethrough and
// footnotes). Where Markdown has no construct for what Word shows —
// underline, highlight, sub/superscript, merged table cells — inline HTML
// is used, which GitHub, VS Code and most renderers display.

const MD_MARKS = {
  del: ['<del>', '</del>'], ins: ['<ins>', '</ins>'], u: ['<u>', '</u>'], mark: ['<mark>', '</mark>'],
  sup: ['<sup>', '</sup>'], sub: ['<sub>', '</sub>'], s: ['~~', '~~'], b: ['**', '**'], i: ['*', '*'],
};
const HTML_MARKS = {
  del: ['<del>', '</del>'], ins: ['<ins>', '</ins>'], u: ['<u>', '</u>'], mark: ['<mark>', '</mark>'],
  sup: ['<sup>', '</sup>'], sub: ['<sub>', '</sub>'], s: ['<s>', '</s>'], b: ['<strong>', '</strong>'], i: ['<em>', '</em>'],
};
// Outermost first; code is always innermost and handled separately.
const ORDER = ['del', 'ins', 'u', 'mark', 'sup', 'sub', 's', 'b', 'i'];

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeText(s, inTable) {
  let out = s
    .replace(/[\\`*[\]~]/g, '\\$&')
    .replace(/<(?=[A-Za-z/!?])/g, '\\<')
    .replace(/&(?=#?[A-Za-z0-9]+;)/g, '\\&')
    .replace(/_/g, (m, i, str) => (/[\p{L}\p{N}]/u.test(str[i - 1] || '') && /[\p{L}\p{N}]/u.test(str[i + 1] || '') ? m : '\\_'));
  if (inTable) out = out.replace(/\|/g, '\\|');
  return out;
}

// Characters that would start a block construct at the beginning of a line.
function escapeLineStart(line) {
  return line
    .replace(/^(#{1,6})(?=\s|$)/, '\\$1')
    .replace(/^>/, '\\>')
    .replace(/^([-+])(?=\s|$)/, '\\$1')
    .replace(/^(\d{1,9})([.)])(?=\s|$)/, '$1\\$2')
    .replace(/^(=+|-+)\s*$/, '\\$1');
}

function codeSpan(text) {
  const runs = text.match(/`+/g) || [];
  const fence = '`'.repeat(runs.reduce((m, r) => Math.max(m, r.length), 0) + 1);
  const pad = /^`|`$/.test(text) || /^ .* $/.test(text) ? ' ' : '';
  return fence + pad + text + pad + fence;
}

function plainText(nodes) {
  let out = '';
  for (const n of nodes) {
    if (n.t === 'text') out += n.text;
    else if (n.t === 'break') out += ' ';
    else if (n.t === 'link') out += plainText(n.children);
  }
  return out;
}

// GitHub-style heading slug (the same as VS Code's Markdown preview, as long
// as the heading text has no repeated spaces — which normalization ensures).
function slugify(text) {
  return text.trim().toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
    .replace(/ /g, '-');
}

function normalizeSpaces(s) {
  return s.replace(/[\t  ]+/g, ' ').trim();
}

class Renderer {
  constructor(model, options = {}) {
    this.model = model;
    this.options = Object.assign({ tables: 'auto', imageDir: 'images' }, options);
    this.noteNumbers = new Map();
    this.noteOrder = [];
    this.mdNotes = new Set();
    this.prepare();
  }

  // Headings, their slugs and the bookmarks that live on them; which
  // bookmarks are link targets.
  prepare() {
    this.headings = [];
    this.bookmarkTarget = new Map();
    this.referenced = new Set();
    const used = new Map();
    const visitInlines = (nodes) => {
      for (const n of nodes) {
        if (n.t === 'link') {
          if (n.anchor) this.referenced.add(n.anchor);
          visitInlines(n.children);
        }
      }
    };
    const visit = (blocks, topLevel) => {
      for (const b of blocks) {
        if (b.type === 'table') {
          for (const row of b.rows) for (const cell of row.cells) visit(cell.blocks, false);
          continue;
        }
        if (b.type !== 'paragraph') continue;
        visitInlines(b.inlines);
        if (b.heading && topLevel) {
          const text = normalizeSpaces((b.list && b.list.kind !== 'bullet' ? b.list.label + ' ' : '') + plainText(b.inlines));
          if (!text) continue;
          let slug = slugify(text);
          const n = used.get(slug) || 0;
          used.set(slug, n + 1);
          if (n) slug += '-' + n;
          b.slug = slug;
          if (!b.title) this.headings.push({ level: b.heading, text, slug });
          const mark = (nodes) => nodes.forEach((x) => {
            if (x.t === 'anchor') this.bookmarkTarget.set(x.name, slug);
            if (x.children) mark(x.children);
          });
          mark(b.inlines);
        }
      }
    };
    visit(this.model.blocks, true);
    for (const note of this.model.notes.values()) visit(note.blocks, false);
  }

  anchorId(name) {
    return this.bookmarkTarget.get(name) || name;
  }

  noteLabel(n) {
    const key = n.kind + ':' + n.id;
    if (!this.noteNumbers.has(key)) {
      const count = this.noteOrder.filter((k) => k.startsWith('comment:') === (n.kind === 'comment')).length + 1;
      this.noteNumbers.set(key, n.kind === 'comment' ? 'c' + count : String(count));
      this.noteOrder.push(key);
    }
    return this.noteNumbers.get(key);
  }

  // --- inline --------------------------------------------------------------

  // env: { html, table, heading }
  inlines(nodes, env) {
    const marks = env.html ? HTML_MARKS : MD_MARKS;
    const stack = [];
    let out = '';

    const closeTo = (keep) => {
      let k = stack.findIndex((m) => !keep.has(m));
      if (k < 0) return;
      const trailing = /\s+$/.exec(out);
      if (trailing) out = out.slice(0, -trailing[0].length);
      while (stack.length > k) out += marks[stack.pop()][1];
      if (trailing) out += trailing[0];
    };
    const openFor = (want, text) => {
      const missing = ORDER.filter((m) => want.has(m) && !stack.includes(m));
      if (!missing.length) return text;
      const lead = /^\s+/.exec(text);
      if (lead) { out += lead[0]; text = text.slice(lead[0].length); }
      for (const m of missing) { out += marks[m][0]; stack.push(m); }
      return text;
    };
    const setFormat = (fmt, text) => {
      const want = new Set(ORDER.filter((m) => fmt[m] && !(env.heading && m === 'b')));
      closeTo(want);
      return openFor(want, text);
    };

    for (const n of nodes) {
      if (n.t === 'text') {
        let text = n.text.replace(/\t/g, ' ');
        if (!text.trim()) { out += env.html ? escapeHtml(text) : text; continue; }
        text = setFormat(n.fmt, text);
        if (n.fmt.code) {
          const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
          out += m[1] + (env.html ? '<code>' + escapeHtml(m[2]) + '</code>' : codeSpan(m[2])) + m[3];
        } else {
          out += env.html ? escapeHtml(text) : escapeText(text, env.table);
        }
      } else if (n.t === 'break') {
        out += env.heading ? ' ' : env.html || env.table ? '<br>' : '\\\n';
      } else if (n.t === 'link') {
        // Underline is how Word draws every link; Markdown links carry it anyway.
        const common = without(commonFormat(n.children), { u: true });
        const inner = this.inlines(n.children.map((c) => (c.t === 'text' ? Object.assign({}, c, { fmt: without(c.fmt, Object.assign({ u: true }, common)) }) : c)), env);
        if (!inner.trim()) continue;
        const target = n.href ? n.href : '#' + this.anchorId(n.anchor || '');
        const edges = /^(\s*)([\s\S]*?)(\s*)$/.exec(setFormat(common, inner));
        out += edges[1];
        if (env.html) out += '<a href="' + escapeHtml(target) + '">' + edges[2] + '</a>';
        else out += '[' + edges[2] + '](' + linkDestination(target) + ')';
        out += edges[3];
      } else if (n.t === 'image') {
        const src = n.file ? this.options.imageDir + '/' + n.file : n.src;
        if (env.html) out += '<img src="' + escapeHtml(encodeURI(src)) + '" alt="' + escapeHtml(n.alt || '') + '">';
        else out += '![' + escapeText(normalizeSpaces(n.alt || ''), env.table) + '](' + linkDestination(src) + ')';
      } else if (n.t === 'anchor') {
        if (env.heading || env.toc) continue;
        if (this.bookmarkTarget.has(n.name)) continue;
        if (!this.referenced.has(n.name) && n.name.startsWith('_')) continue;
        out += '<a id="' + escapeHtml(n.name) + '"></a>';
      } else if (n.t === 'note') {
        const note = this.model.notes.get(n.kind + ':' + n.id);
        if (!note) continue;
        const label = this.noteLabel(n);
        if (env.html) {
          out += '<sup>' + escapeHtml(label) + '</sup>';
        } else {
          this.mdNotes.add(n.kind + ':' + n.id);
          out += '[^' + label + ']';
        }
      }
    }
    closeTo(new Set());
    return out;
  }

  // --- blocks --------------------------------------------------------------

  render() {
    const chunks = [];
    this.blocks(this.model.blocks, chunks);
    let md = joinChunks(chunks);
    const notes = this.renderNotes();
    if (notes) md += (md ? '\n\n' : '') + notes;
    return md.trim() + '\n';
  }

  // Each chunk is { text, tight } — tight chunks join the previous one with a
  // single newline (consecutive list items), others with a blank line.
  blocks(blocks, chunks) {
    let list = [];
    let codeLines = null;
    const flushCode = () => {
      if (!codeLines) return;
      const body = codeLines.join('\n');
      const longest = (body.match(/^`{3,}/gm) || []).reduce((m, r) => Math.max(m, r.length), 2);
      const fence = '`'.repeat(longest + 1);
      chunks.push({ text: fence + '\n' + body + '\n' + fence });
      codeLines = null;
    };

    for (const b of blocks) {
      if (b.type !== 'paragraph' || !b.code) flushCode();
      if (b.type === 'table') {
        list = [];
        chunks.push({ text: this.table(b) });
        continue;
      }
      if (b.type === 'toc') {
        list = [];
        const toc = this.toc(b);
        if (toc) chunks.push({ text: toc });
        continue;
      }
      if (b.code) {
        list = [];
        codeLines = codeLines || [];
        codeLines.push(codeText(b.inlines));
        continue;
      }
      if (b.heading) {
        list = [];
        let text = normalizeSpaces(this.inlines(b.inlines, { heading: true }));
        const label = b.list && b.list.kind !== 'bullet' ? escapeText(b.list.label) + ' ' : '';
        text = (label + text).trim();
        if (!text) continue;
        if (/#$/.test(text)) text = text.slice(0, -1) + '\\#';
        chunks.push({ text: '#'.repeat(b.heading) + ' ' + text });
        continue;
      }

      let text = this.inlines(b.inlines, {}).replace(/^(\s|\\\n)+|(\s|\\\n)+$/g, '');
      if (!text) continue;
      const lines = text.split('\n').map((l) => escapeLineStart(l.replace(/^[ \t]+/, '')));

      if (b.tocHeading) {
        list = [];
        chunks.push({ text: '**' + normalizeSpaces(this.inlines(b.inlines, { heading: true })) + '**' });
        continue;
      }
      if (b.list && b.list.kind !== 'none') {
        const item = b.list;
        const depth = item.depth !== undefined ? item.depth : item.ilvl * 720;
        const continues = !!this.lastItem && chunks.length && chunks[chunks.length - 1] === this.lastItem.chunk;
        if (!continues) list = [];
        let sibling = null;
        while (list.length && list[list.length - 1].depth >= depth) sibling = list.pop();
        const parent = list[list.length - 1];
        const indent = parent ? parent.col : 0;
        const pad = ' '.repeat(indent);
        let marker = '';
        let col = indent;
        if (item.kind === 'bullet') { marker = '- '; col = indent + 2; }
        else if (item.kind === 'ordered') { marker = item.label + ' '; col = indent + marker.length; }
        else { lines[0] = escapeText(item.label) + ' ' + lines[0]; }
        const contPad = ' '.repeat(col);
        const body = lines.map((l, i) => (i === 0 ? pad + marker + l : contPad + l)).join('\n');
        // Markdown only lets an item follow the previous line directly when it
        // cannot be read as a continuation of it: bullets always, an ordered
        // item when it continues its sibling's list or starts at 1.
        const delim = item.kind === 'ordered' ? item.label.slice(-1) : null;
        const tight = continues && item.kind !== 'literal' && this.lastItem.kind !== 'literal' && (
          item.kind === 'bullet' ||
          /^1[.)]$/.test(item.label) ||
          (!!sibling && sibling.depth === depth && sibling.kind === 'ordered' && sibling.delim === delim));
        const chunk = { text: body, tight };
        chunks.push(chunk);
        list.push({ depth, col, kind: item.kind, delim });
        this.lastItem = { chunk, kind: item.kind };
        continue;
      }

      list = [];
      if (b.quote) chunks.push({ text: lines.map((l) => '> ' + l).join('\n') });
      else chunks.push({ text: lines.join('\n') });
    }
    flushCode();
  }

  toc(b) {
    const items = this.headings.filter((h) => h.level >= b.from && h.level <= b.to);
    if (!items.length) return '';
    const min = Math.min(...items.map((h) => h.level));
    return items.map((h) => '  '.repeat(h.level - min) + '- [' + escapeText(h.text) + '](#' + h.slug + ')').join('\n');
  }

  // --- tables --------------------------------------------------------------

  // Rows laid out on the table grid: each cell knows its column, and merged
  // cells know their row and column span.
  grid(table) {
    const rows = table.rows.map((row) => {
      let col = row.before;
      const cells = row.cells.map((cell) => {
        const c = Object.assign({ col, rowspan: 1 }, cell);
        col += cell.span;
        return c;
      });
      return { cells, header: row.header, width: col + row.after };
    });
    const width = rows.reduce((m, r) => Math.max(m, r.width), 0);
    for (let r = 0; r < rows.length; r++) {
      for (const cell of rows[r].cells) {
        if (cell.vMerge !== 'restart') continue;
        for (let k = r + 1; k < rows.length; k++) {
          const below = rows[k].cells.find((c) => c.col === cell.col);
          if (!below || below.vMerge !== 'continue') break;
          cell.rowspan++;
        }
      }
    }
    return { rows, width };
  }

  table(table) {
    const { rows, width } = this.grid(table);
    if (!rows.length || !width) return '';
    // Empty tables are layout scaffolding with nothing to read.
    if (!rows.some((r) => r.cells.some((c) => this.cellText(c.blocks, false)))) return '';
    const merged = rows.some((r) => r.cells.some((c) => c.span > 1 || c.rowspan > 1));
    const nested = rows.some((r) => r.cells.some((c) => c.blocks.some((b) => b.type === 'table')));
    const mode = this.options.tables;
    if (mode === 'html' || (mode === 'auto' && (merged || nested))) return this.htmlTable(rows);
    return this.gfmTable(rows, width);
  }

  // A cell has no block structure in Markdown, so indentation is kept as
  // non-breaking spaces: the paragraph's left indent (one step per 360
  // twips), a list item's nesting, and the spaces the text itself starts with.
  cellText(blocks, html) {
    const parts = [];
    const lists = [];
    for (const b of blocks) {
      if (b.type === 'table') {
        const { rows } = this.grid(b);
        parts.push(html ? this.htmlTable(rows) : this.cellText([].concat(...b.rows.map((r) => [].concat(...r.cells.map((c) => c.blocks)))), false));
        continue;
      }
      if (b.type !== 'paragraph') continue;
      const lead = /^[ \u00a0\t]*/.exec(plainText(b.inlines))[0].replace(/\t/g, '    ').length;
      let text = this.inlines(b.inlines, html ? { html: true } : { table: true }).trim();
      if (!text) continue;
      if (b.code && !html) text = codeSpan(codeText(b.inlines).replace(/\n/g, ' '));
      if (b.heading) text = html ? '<strong>' + text + '</strong>' : '**' + text + '**';
      let steps = 0;
      if (b.list && b.list.kind !== 'none') {
        const depth = b.list.depth !== undefined ? b.list.depth : 0;
        while (lists.length && lists[lists.length - 1] >= depth) lists.pop();
        steps = lists.length;
        lists.push(depth);
        const label = b.list.kind === 'bullet' ? '•' : html ? escapeHtml(b.list.label) : escapeText(b.list.label, true);
        text = label + ' ' + text;
      } else {
        lists.length = 0;
        steps = Math.max(0, Math.round((b.indent || 0) / 360));
      }
      const pad = '&nbsp;'.repeat(steps * 2 + lead);
      parts.push(pad + text.replace(/\n/g, html ? '<br>\n' : ' '));
    }
    return parts.join('<br>');
  }

  gfmTable(rows, width) {
    const lines = rows.map((row) => {
      const cells = new Array(width).fill('');
      for (const c of row.cells) if (c.vMerge !== 'continue') cells[c.col] = this.cellText(c.blocks, false);
      return '| ' + cells.map((c) => c || ' ').join(' | ') + ' |';
    });
    lines.splice(1, 0, '|' + ' --- |'.repeat(width));
    return lines.join('\n');
  }

  htmlTable(rows) {
    const headerRows = rows.some((r) => r.header) ? rows.map((r) => r.header) : rows.map((r, i) => i === 0);
    const out = ['<table>'];
    rows.forEach((row, i) => {
      const tag = headerRows[i] ? 'th' : 'td';
      const cells = row.cells.filter((c) => c.vMerge !== 'continue').map((c) => {
        const attrs = (c.span > 1 ? ' colspan="' + c.span + '"' : '') + (c.rowspan > 1 ? ' rowspan="' + c.rowspan + '"' : '');
        return '<' + tag + attrs + '>' + this.cellText(c.blocks, true) + '</' + tag + '>';
      });
      out.push('<tr>' + cells.join('') + '</tr>');
    });
    out.push('</table>');
    return out.join('\n');
  }

  // --- notes ---------------------------------------------------------------

  renderNotes() {
    const defs = [];
    const plain = [];
    // Rendering a note can reference more notes; the order list grows.
    for (let i = 0; i < this.noteOrder.length; i++) {
      const key = this.noteOrder[i];
      const note = this.model.notes.get(key);
      const label = this.noteNumbers.get(key);
      const paras = [];
      for (const b of note.blocks) {
        if (b.type === 'table') { paras.push(this.cellText([b], false)); continue; }
        if (b.type !== 'paragraph') continue;
        const t = this.inlines(b.inlines, {}).trim();
        if (t) paras.push(t.split('\n').map(escapeLineStart).join('\n    '));
      }
      if (note.kind === 'comment' && note.author) paras[0] = '**' + escapeText(note.author) + ':** ' + (paras[0] || '');
      const body = paras.join('\n\n    ') || ' ';
      if (this.mdNotes.has(key)) defs.push('[^' + label + ']: ' + body);
      else plain.push('<sup>' + escapeHtml(label) + '</sup> ' + body);
    }
    return defs.concat(plain).join('\n\n');
  }
}

function codeText(nodes) {
  let out = '';
  for (const n of nodes) {
    if (n.t === 'text') out += n.text;
    else if (n.t === 'break') out += '\n';
    else if (n.t === 'link') out += codeText(n.children);
  }
  return out;
}

function commonFormat(nodes) {
  const texts = nodes.filter((n) => n.t === 'text' && n.text.trim());
  if (!texts.length) return {};
  const out = {};
  for (const k of ORDER) if (texts.every((n) => n.fmt[k])) out[k] = true;
  return out;
}

function without(fmt, common) {
  const out = Object.assign({}, fmt);
  for (const k of Object.keys(common)) delete out[k];
  return out;
}

function linkDestination(url) {
  if (/[\s()<>]/.test(url)) return '<' + url.replace(/[<>]/g, (c) => encodeURIComponent(c)) + '>';
  return url;
}

function joinChunks(chunks) {
  let out = '';
  chunks.forEach((c, i) => {
    if (!c.text) return;
    out += (i === 0 || !out ? '' : c.tight ? '\n' : '\n\n') + c.text;
  });
  return out;
}

function renderMarkdown(model, options) {
  return new Renderer(model, options).render();
}

module.exports = { renderMarkdown, slugify, escapeText, escapeLineStart, plainText, normalizeSpaces };
