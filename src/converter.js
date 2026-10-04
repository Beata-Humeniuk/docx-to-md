'use strict';

// WordprocessingML → document model. The model is Markdown-agnostic: blocks
// (paragraphs, tables, table-of-contents markers) holding inline nodes with
// normalized formatting. Rendering lives in markdown.js.
//
// Inline nodes:
//   { t: 'text', text, fmt }        fmt keys: b i s u sup sub mark code ins del
//   { t: 'break' }
//   { t: 'link', href | anchor, children }
//   { t: 'image', file | src, alt }
//   { t: 'anchor', name }            a bookmark
//   { t: 'note', kind: 'footnote' | 'endnote' | 'comment', id }

const posix = require('path').posix;
const { elements, child, attr, val, textOf, descendants } = require('./xml');
const { loadStyles, applyRunProps } = require('./styles');
const { loadNumbering, indentOf } = require('./numbering');

const FMT_KEYS = ['b', 'i', 's', 'u', 'sup', 'sub', 'mark', 'code', 'ins', 'del'];

// Private-use code points Word writes for Symbol/Wingdings bullets and marks.
const SYMBOLS = {
  0xf0b7: '•', 0xf0a7: '▪', 0xf06e: '■', 0xf071: '❑', 0xf076: '❖', 0xf0d8: '➢',
  0xf0fc: '✓', 0xf0fb: '✗', 0xf0fe: '☑', 0xf0a8: '◆', 0xf0e0: '→', 0xf0e8: '➔', 0xf0f0: '⇨',
  0xf06c: '●', 0xf0a1: '○', 0xf0b0: '°', 0xf0b1: '±', 0xf0b4: '×', 0xf0b8: '÷', 0xf0ae: '→',
};

const VECTOR_IMAGE = /\.(emf|wmf|emz|wmz)$/i;

function cleanFmt(fmt) {
  const out = {};
  for (const k of FMT_KEYS) if (fmt[k]) out[k] = true;
  return out;
}

function sameFmt(a, b) {
  for (const k of FMT_KEYS) if (!!a[k] !== !!b[k]) return false;
  return true;
}

// Parses the arguments of a field instruction: quoted strings and bare words.
function fieldArgs(instr) {
  const out = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m;
  while ((m = re.exec(instr))) out.push(m[1] !== undefined ? { q: m[1] } : { w: m[2] });
  return out;
}

function switchValue(args, name) {
  for (let i = 0; i < args.length; i++) {
    if (args[i].w && args[i].w.toLowerCase() === name) {
      const next = args[i + 1];
      if (next && (next.q !== undefined || (next.w && !next.w.startsWith('\\')))) return next.q !== undefined ? next.q : next.w;
      return '';
    }
  }
  return null;
}

function analyzeField(instr) {
  const args = fieldArgs(instr.trim());
  const head = args.length ? (args[0].w || args[0].q || '').toUpperCase() : '';
  const first = args[1] && !(args[1].w && args[1].w.startsWith('\\')) ? (args[1].q !== undefined ? args[1].q : args[1].w) : null;
  switch (head) {
    case 'TOC': {
      // \c and \a build a list of captions (figures, tables), not of headings:
      // Word's own result is kept, with page numbers dropped.
      if (switchValue(args, '\\c') !== null || switchValue(args, '\\a') !== null || switchValue(args, '\\f') !== null) {
        return { kind: 'plain' };
      }
      const range = switchValue(args, '\\o');
      let from = 1;
      let to = 9;
      const m = range && /^(\d)\s*-\s*(\d)$/.exec(range.trim());
      if (m) { from = Number(m[1]); to = Number(m[2]); }
      return { kind: 'toc', from, to };
    }
    case 'HYPERLINK': {
      const anchor = switchValue(args, '\\l');
      if (first) return { kind: 'link', href: first, anchor: anchor || null };
      if (anchor) return { kind: 'link', anchor };
      return { kind: 'plain' };
    }
    case 'REF':
      return first ? { kind: 'link', anchor: first } : { kind: 'plain' };
    case 'PAGEREF':
    case 'PAGE':
    case 'NUMPAGES':
    case 'SECTIONPAGES':
      return { kind: 'suppress' };
    default:
      return { kind: 'plain' };
  }
}

class Converter {
  constructor(pkg, options = {}) {
    this.pkg = pkg;
    this.options = Object.assign({ trackedChanges: 'accept', comments: 'footnotes' }, options);
    const stylesPart = pkg.relByType(pkg.main, '/styles');
    const numberingPart = pkg.relByType(pkg.main, '/numbering');
    this.styles = loadStyles(stylesPart && pkg.xml(stylesPart));
    this.numbering = loadNumbering(numberingPart && pkg.xml(numberingPart), this.styles);
    this.fields = [];
    this.pendingBookmarks = [];
    this.tocOpen = false;
    this.images = [];
    this.imageByTarget = new Map();
    this.imageNames = new Set();
    this.warnings = new Map();
    this.noteRefs = [];
    this.notes = new Map();
  }

  warn(code) {
    this.warnings.set(code, (this.warnings.get(code) || 0) + 1);
  }

  convert() {
    const doc = this.pkg.xml(this.pkg.main);
    const body = child(doc, 'w:body');
    const blocks = [];
    this.part = this.pkg.main;
    this.body(body, blocks);
    this.flushBookmarks(blocks);
    this.convertNotes();
    return {
      blocks,
      notes: this.notes,
      images: this.images,
      warnings: Array.from(this.warnings, ([code, count]) => ({ code, count })),
    };
  }

  // --- block level ---------------------------------------------------------

  body(node, blocks) {
    for (const el of elements(node)) {
      switch (el.name) {
        case 'w:p': this.paragraph(el, blocks); break;
        case 'w:tbl': this.tocOpen = false; blocks.push(this.table(el)); break;
        case 'w:sdt': this.body(child(el, 'w:sdtContent'), blocks); break;
        case 'w:customXml':
        case 'w:ins':
        case 'w:moveTo':
          this.body(el, blocks); break;
        case 'w:del':
        case 'w:moveFrom':
          if (this.options.trackedChanges !== 'accept') this.body(el, blocks); break;
        case 'w:bookmarkStart': {
          const name = attr(el, 'w:name');
          if (name && name !== '_GoBack') this.pendingBookmarks.push(name);
          break;
        }
        case 'mc:AlternateContent': this.body(child(el, 'mc:Choice') || child(el, 'mc:Fallback'), blocks); break;
        case 'w:altChunk': this.warn('altChunk'); break;
        default: break;
      }
    }
  }

  flushBookmarks(blocks) {
    if (!this.pendingBookmarks.length) return;
    blocks.push({ type: 'paragraph', inlines: this.pendingBookmarks.map((name) => ({ t: 'anchor', name })) });
    this.pendingBookmarks = [];
  }

  newContext() {
    const root = [];
    return { root, stack: [root], change: null, textboxes: [] };
  }

  paragraph(p, blocks) {
    const pPr = child(p, 'w:pPr');
    const info = this.styles.paragraphInfo(val(pPr, 'w:pStyle'));
    const ctx = this.newContext();
    for (const name of this.pendingBookmarks) ctx.root.push({ t: 'anchor', name });
    this.pendingBookmarks = [];
    this.pendingToc = null;
    this.inlines(elements(p).filter((e) => e.name !== 'w:pPr'), ctx, info.runFormat);
    const pendingToc = this.pendingToc;
    this.pendingToc = null;

    // A paragraph whose mark is a tracked deletion merges into the next one;
    // it keeps its content but does not start a numbered item of its own.
    const markDeleted = !!child(child(pPr, 'w:rPr'), 'w:del') && this.options.trackedChanges === 'accept';

    const hasContent = ctx.root.some((n) => n.t !== 'anchor' && (n.t !== 'text' || n.text.trim() !== ''));
    const block = { type: 'paragraph', inlines: ctx.root };

    if (info.tocEntry && !pendingToc) {
      // Static TOC entries (the field is gone, only its styled lines are left).
      if (!this.tocOpen) blocks.push({ type: 'toc', from: 1, to: 9 });
      this.tocOpen = true;
      this.textboxes(ctx, blocks);
      return;
    }

    let heading = info.headingLevel;
    const outline = val(pPr, 'w:outlineLvl');
    if (outline !== null && Number(outline) < 9) heading = Number(outline) + 1;
    if (heading) block.heading = Math.min(heading, 6);
    if (heading && info.title && outline === null) block.title = true;

    const numPr = child(pPr, 'w:numPr');
    let numId = numPr ? val(numPr, 'w:numId') : null;
    let ilvl = numPr ? val(numPr, 'w:ilvl') : null;
    if (numId === null && info.numPr) {
      numId = info.numPr.numId;
      if (ilvl === null) ilvl = info.numPr.ilvl !== null ? info.numPr.ilvl : this.numbering.levelForStyle(numId, info.numPr.styleId);
    }
    if (numId && numId !== '0' && !markDeleted && (hasContent || !heading)) {
      const list = this.numbering.next(numId, Number(ilvl || 0));
      if (list) {
        // Nesting follows what the reader sees — the left indent (paragraph,
        // then list level, then style) — because separate lists such as
        // "List Number" and "List Number 2" all sit on level 0.
        const direct = indentOf(pPr);
        const indent = direct !== null ? direct : list.indent !== null && list.indent !== undefined ? list.indent : info.indent;
        list.depth = indent !== null && indent !== undefined ? indent : list.ilvl * 720;
        block.list = list;
      }
    }

    if (info.tocHeading) block.tocHeading = true;
    else if (info.code) block.code = true;
    else if (info.quote) block.quote = true;
    if (!block.code && !block.heading && hasContent) {
      const texts = [];
      const collect = (nodes) => nodes.forEach((n) => { if (n.t === 'text' && n.text.trim()) texts.push(n); if (n.children) collect(n.children); });
      collect(ctx.root);
      if (texts.length && texts.every((n) => n.fmt.code) && !block.list) block.code = true;
    }

    if (hasContent || ctx.root.length) {
      if (hasContent) this.tocOpen = false;
      blocks.push(block);
    }
    if (pendingToc) {
      blocks.push({ type: 'toc', from: pendingToc.from, to: pendingToc.to });
      this.tocOpen = true;
    }
    this.textboxes(ctx, blocks);
  }

  textboxes(ctx, blocks) {
    for (const box of ctx.textboxes) this.body(box, blocks);
  }

  table(tbl) {
    const rows = [];
    const rowNodes = [];
    const collectRows = (node) => {
      for (const el of elements(node)) {
        if (el.name === 'w:tr') rowNodes.push(el);
        else if (el.name === 'w:sdt') collectRows(child(el, 'w:sdtContent'));
        else if (el.name === 'w:customXml' || el.name === 'w:ins') collectRows(el);
        else if (el.name === 'w:del' && this.options.trackedChanges !== 'accept') collectRows(el);
      }
    };
    collectRows(tbl);
    for (const tr of rowNodes) {
      const trPr = child(tr, 'w:trPr');
      if (this.options.trackedChanges === 'accept' && child(trPr, 'w:del')) continue;
      if (this.options.trackedChanges === 'reject' && child(trPr, 'w:ins')) continue;
      const cells = [];
      const cellNodes = [];
      const collectCells = (node) => {
        for (const el of elements(node)) {
          if (el.name === 'w:tc') cellNodes.push(el);
          else if (el.name === 'w:sdt') collectCells(child(el, 'w:sdtContent'));
          else if (el.name === 'w:customXml') collectCells(el);
        }
      };
      collectCells(tr);
      for (const tc of cellNodes) {
        const tcPr = child(tc, 'w:tcPr');
        const vMergeNode = child(tcPr, 'w:vMerge');
        const vMerge = vMergeNode ? (attr(vMergeNode, 'w:val') === 'restart' ? 'restart' : 'continue') : null;
        const blocks = [];
        const saved = this.tocOpen;
        this.body(tc, blocks);
        this.flushBookmarks(blocks);
        this.tocOpen = saved;
        cells.push({ blocks, span: Math.max(1, Number(val(tcPr, 'w:gridSpan') || 1)), vMerge });
      }
      rows.push({
        cells,
        header: !!child(trPr, 'w:tblHeader') && attr(child(trPr, 'w:tblHeader'), 'w:val') !== '0',
        before: Number(val(trPr, 'w:gridBefore') || 0),
        after: Number(val(trPr, 'w:gridAfter') || 0),
      });
    }
    return { type: 'table', rows };
  }

  // --- inline level --------------------------------------------------------

  top(ctx) {
    return ctx.stack[ctx.stack.length - 1];
  }

  suppressed() {
    return this.fields.some((f) => f.phase === 'instr' || (f.suppress && f.phase === 'result'));
  }

  pushText(ctx, text, fmt) {
    if (!text) return;
    const arr = this.top(ctx);
    const last = arr[arr.length - 1];
    if (last && last.t === 'text' && sameFmt(last.fmt, fmt)) last.text += text;
    else arr.push({ t: 'text', text, fmt });
  }

  push(ctx, node) {
    this.top(ctx).push(node);
  }

  inlines(nodes, ctx, base) {
    for (const el of nodes) {
      switch (el.name) {
        case 'w:r': this.run(el, ctx, base); break;
        case 'w:hyperlink': this.hyperlink(el, ctx, base); break;
        case 'w:ins':
        case 'w:moveTo':
          this.withChange(ctx, 'ins', () => this.inlines(elements(el), ctx, base)); break;
        case 'w:del':
        case 'w:moveFrom':
          this.withChange(ctx, 'del', () => this.inlines(elements(el), ctx, base)); break;
        case 'w:smartTag':
        case 'w:customXml':
        case 'w:dir':
        case 'w:bdo':
          this.inlines(elements(el), ctx, base); break;
        case 'w:sdt': this.inlines(elements(child(el, 'w:sdtContent')), ctx, base); break;
        case 'w:fldSimple': this.simpleField(el, ctx, base); break;
        case 'w:bookmarkStart': {
          const name = attr(el, 'w:name');
          if (name && name !== '_GoBack' && !this.suppressed()) this.push(ctx, { t: 'anchor', name });
          break;
        }
        case 'm:oMath':
        case 'm:oMathPara':
          if (!this.suppressed()) this.math(el, ctx, base); break;
        case 'mc:AlternateContent': this.inlines(elements(child(el, 'mc:Choice') || child(el, 'mc:Fallback')), ctx, base); break;
        default: break;
      }
    }
  }

  withChange(ctx, change, fn) {
    const saved = ctx.change;
    ctx.change = change;
    fn();
    ctx.change = saved;
  }

  // Whether text under the current tracked change is shown, and how.
  changeFmt(ctx, fmt) {
    const mode = this.options.trackedChanges;
    if (ctx.change === 'ins') {
      if (mode === 'reject') return null;
      if (mode === 'markup') return Object.assign({}, fmt, { ins: true });
    } else if (ctx.change === 'del') {
      if (mode === 'accept') return null;
      if (mode === 'markup') return Object.assign({}, fmt, { del: true });
    }
    return fmt;
  }

  runFormat(rPr, base) {
    const fmt = this.styles.characterFormat(val(rPr, 'w:rStyle'), base);
    applyRunProps(fmt, rPr);
    return fmt;
  }

  run(r, ctx, base) {
    const rPr = child(r, 'w:rPr');
    const full = this.runFormat(rPr, base);
    const hidden = !!full.vanish;
    const fmt = this.changeFmt(ctx, cleanFmt(full));
    for (const el of elements(r)) {
      switch (el.name) {
        case 'w:fldChar': this.fieldChar(attr(el, 'w:fldCharType'), ctx); continue;
        case 'w:instrText': {
          const f = this.fields[this.fields.length - 1];
          if (f && f.phase === 'instr') f.instr += textOf(el);
          continue;
        }
        default: break;
      }
      if (hidden || !fmt || this.suppressed()) continue;
      switch (el.name) {
        case 'w:t': this.pushText(ctx, textOf(el), fmt); break;
        case 'w:delText': if (ctx.change === 'del') this.pushText(ctx, textOf(el), fmt); break;
        case 'w:tab':
        case 'w:ptab':
          this.pushText(ctx, '\t', fmt); break;
        case 'w:br':
          if (!attr(el, 'w:type') || attr(el, 'w:type') === 'textWrapping') this.push(ctx, { t: 'break' });
          break;
        case 'w:cr': this.push(ctx, { t: 'break' }); break;
        case 'w:noBreakHyphen': this.pushText(ctx, '-', fmt); break;
        case 'w:sym': {
          const code = parseInt(attr(el, 'w:char') || '', 16);
          if (Number.isFinite(code)) this.pushText(ctx, SYMBOLS[code] || SYMBOLS[code | 0xf000] || (code < 0xe000 || code > 0xf8ff ? String.fromCodePoint(code) : ''), fmt);
          break;
        }
        case 'w:drawing':
        case 'w:pict':
        case 'w:object':
        case 'mc:AlternateContent':
          this.graphic(el, ctx); break;
        case 'w:footnoteReference': this.noteRef(ctx, 'footnote', attr(el, 'w:id')); break;
        case 'w:endnoteReference': this.noteRef(ctx, 'endnote', attr(el, 'w:id')); break;
        case 'w:commentReference':
          if (this.options.comments !== 'omit') this.noteRef(ctx, 'comment', attr(el, 'w:id'));
          break;
        default: break;
      }
    }
  }

  hyperlink(el, ctx, base) {
    if (this.suppressed()) { this.inlines(elements(el), ctx, base); return; }
    const rid = attr(el, 'r:id');
    const rel = rid ? this.pkg.rels(this.part).get(rid) : null;
    const link = { t: 'link', children: [] };
    if (rel) link.href = rel.target + (attr(el, 'w:anchor') ? '#' + attr(el, 'w:anchor') : '');
    else if (attr(el, 'w:anchor')) link.anchor = attr(el, 'w:anchor');
    this.push(ctx, link);
    ctx.stack.push(link.children);
    this.inlines(elements(el), ctx, base);
    if (this.top(ctx) === link.children) ctx.stack.pop();
  }

  simpleField(el, ctx, base) {
    this.fieldChar('begin', ctx);
    this.fields[this.fields.length - 1].instr = attr(el, 'w:instr') || '';
    this.fieldChar('separate', ctx);
    this.inlines(elements(el), ctx, base);
    this.fieldChar('end', ctx);
  }

  fieldChar(type, ctx) {
    if (type === 'begin') {
      this.fields.push({ instr: '', phase: 'instr' });
      return;
    }
    const f = this.fields[this.fields.length - 1];
    if (!f) return;
    if (type === 'separate') {
      if (f.phase !== 'instr') return;
      const outer = this.suppressed.call({ fields: this.fields.slice(0, -1) });
      f.phase = 'result';
      Object.assign(f, analyzeField(f.instr));
      if (outer) return;
      if (f.kind === 'toc') {
        f.suppress = true;
        this.pendingToc = { from: f.from, to: f.to };
      } else if (f.kind === 'suppress') {
        f.suppress = true;
      } else if (f.kind === 'link') {
        const link = { t: 'link', children: [] };
        if (f.href) link.href = f.href + (f.anchor ? '#' + f.anchor : '');
        else link.anchor = f.anchor;
        this.push(ctx, link);
        ctx.stack.push(link.children);
        f.link = link;
        f.ctx = ctx;
      }
    } else if (type === 'end') {
      this.fields.pop();
      if (f.phase === 'instr') {
        const a = analyzeField(f.instr);
        if (a.kind === 'toc' && !this.suppressed()) this.pendingToc = { from: a.from, to: a.to };
      }
      if (f.link && f.ctx === ctx && this.top(ctx) === f.link.children) ctx.stack.pop();
    }
  }

  math(el, ctx, base) {
    const text = descendants(el, 'm:t').map(textOf).join('');
    if (text) this.pushText(ctx, text, this.changeFmt(ctx, cleanFmt(base)) || {});
  }

  noteRef(ctx, kind, id) {
    if (id === null) return;
    this.push(ctx, { t: 'note', kind, id });
    this.noteRefs.push({ kind, id });
  }

  graphic(node, ctx) {
    const docPr = descendants(node, 'wp:docPr')[0];
    const alt = (docPr && (attr(docPr, 'descr') || attr(docPr, 'title'))) || '';
    const walk = (el) => {
      for (const c of elements(el)) {
        switch (c.name) {
          case 'mc:AlternateContent': walk(child(c, 'mc:Choice') || child(c, 'mc:Fallback')); break;
          case 'a:blip': this.image(attr(c, 'r:embed') || attr(c, 'r:link'), alt, ctx); break;
          case 'v:imagedata': this.image(attr(c, 'r:id') || attr(c, 'r:pict'), alt || attr(c, 'o:title') || '', ctx); break;
          case 'w:txbxContent': ctx.textboxes.push(c); break;
          case 'c:chart': this.warn('chart'); break;
          case 'dgm:relIds': this.warn('smartArt'); break;
          default: walk(c);
        }
      }
    };
    walk(node.name === 'mc:AlternateContent' ? { children: [child(node, 'mc:Choice') || child(node, 'mc:Fallback')].filter(Boolean) } : node);
  }

  image(rid, alt, ctx) {
    const rel = rid ? this.pkg.rels(this.part).get(rid) : null;
    if (!rel) return;
    if (rel.external) {
      this.push(ctx, { t: 'image', src: rel.target, alt });
      return;
    }
    let file = this.imageByTarget.get(rel.target);
    if (!file) {
      const data = this.pkg.read(rel.target);
      if (!data) return;
      const base = posix.basename(rel.target);
      file = base;
      for (let n = 2; this.imageNames.has(file.toLowerCase()); n++) {
        const ext = posix.extname(base);
        file = base.slice(0, base.length - ext.length) + '-' + n + ext;
      }
      this.imageNames.add(file.toLowerCase());
      this.imageByTarget.set(rel.target, file);
      this.images.push({ file, data });
      if (VECTOR_IMAGE.test(file)) this.warn('vectorImage');
    }
    this.push(ctx, { t: 'image', file, alt });
  }

  // --- notes ---------------------------------------------------------------

  convertNotes() {
    const parts = {
      footnote: { suffix: '/footnotes', element: 'w:footnote' },
      endnote: { suffix: '/endnotes', element: 'w:endnote' },
      comment: { suffix: '/comments', element: 'w:comment' },
    };
    const index = {};
    for (const kind of Object.keys(parts)) {
      const partPath = this.pkg.relByType(this.pkg.main, parts[kind].suffix);
      const root = partPath && this.pkg.xml(partPath);
      const map = new Map();
      for (const el of elements(root)) if (el.name === parts[kind].element) map.set(attr(el, 'w:id'), el);
      index[kind] = { part: partPath, map };
    }
    // Notes can reference further notes (a comment on a footnote); the queue
    // grows while it is being walked.
    for (let i = 0; i < this.noteRefs.length; i++) {
      const { kind, id } = this.noteRefs[i];
      const key = kind + ':' + id;
      if (this.notes.has(key)) continue;
      const src = index[kind];
      const el = src && src.map.get(id);
      if (!el) { this.notes.set(key, { kind, blocks: [] }); continue; }
      const blocks = [];
      const savedPart = this.part;
      this.part = src.part;
      this.fields = [];
      this.body(el, blocks);
      this.flushBookmarks(blocks);
      this.part = savedPart;
      this.notes.set(key, { kind, blocks, author: kind === 'comment' ? attr(el, 'w:author') || '' : null });
    }
  }
}

function convertPackage(pkg, options) {
  return new Converter(pkg, options).convert();
}

module.exports = { convertPackage, analyzeField };
