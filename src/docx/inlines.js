'use strict';

const { elements, child, attr, val, textOf, descendants } = require('./xml');
const { applyRunProps, cleanFormat, sameFormat } = require('./runFormat');
const { symbolText } = require('./symbols');

const WRAPPERS = ['w:smartTag', 'w:customXml', 'w:dir', 'w:bdo'];
const GRAPHICS = ['w:drawing', 'w:pict', 'w:object', 'mc:AlternateContent'];
const NOTE_KINDS = { 'w:footnoteReference': 'footnote', 'w:endnoteReference': 'endnote', 'w:commentReference': 'comment' };

module.exports = {
  newContext() {
    const root = [];
    return { root, stack: [root], change: null, textboxes: [] };
  },

  textboxes(ctx, blocks) {
    for (const box of ctx.textboxes) this.body(box, blocks);
  },

  top(ctx) {
    return ctx.stack[ctx.stack.length - 1];
  },

  push(ctx, node) {
    this.top(ctx).push(node);
  },

  pushText(ctx, text, fmt) {
    if (!text) return;
    const nodes = this.top(ctx);
    const last = nodes[nodes.length - 1];
    if (last && last.t === 'text' && sameFormat(last.fmt, fmt)) last.text += text;
    else nodes.push({ t: 'text', text, fmt });
  },

  inlines(nodes, ctx, base) {
    for (const el of nodes) {
      if (WRAPPERS.includes(el.name)) { this.inlines(elements(el), ctx, base); continue; }
      switch (el.name) {
        case 'w:r': this.run(el, ctx, base); break;
        case 'w:hyperlink': this.hyperlink(el, ctx, base); break;
        case 'w:ins': case 'w:moveTo': this.withChange(ctx, 'ins', () => this.inlines(elements(el), ctx, base)); break;
        case 'w:del': case 'w:moveFrom': this.withChange(ctx, 'del', () => this.inlines(elements(el), ctx, base)); break;
        case 'w:sdt': this.inlines(elements(child(el, 'w:sdtContent')), ctx, base); break;
        case 'w:fldSimple': this.simpleField(el, ctx, base); break;
        case 'w:bookmarkStart': this.inlineBookmark(attr(el, 'w:name'), ctx); break;
        case 'm:oMath': case 'm:oMathPara': if (!this.suppressed()) this.math(el, ctx, base); break;
        case 'mc:AlternateContent': this.inlines(elements(child(el, 'mc:Choice') || child(el, 'mc:Fallback')), ctx, base); break;
        default: break;
      }
    }
  },

  inlineBookmark(name, ctx) {
    if (this.keepsBookmark(name) && !this.suppressed()) this.push(ctx, { t: 'anchor', name });
  },

  withChange(ctx, change, fn) {
    const saved = ctx.change;
    ctx.change = change;
    fn();
    ctx.change = saved;
  },

  changeFormat(ctx, fmt) {
    const mode = this.options.trackedChanges;
    if (ctx.change === 'ins' && mode === 'reject') return null;
    if (ctx.change === 'del' && mode === 'accept') return null;
    if (ctx.change && mode === 'markup') return Object.assign({}, fmt, { [ctx.change]: true });
    return fmt;
  },

  run(r, ctx, base) {
    const rPr = child(r, 'w:rPr');
    const full = applyRunProps(this.styles.characterFormat(val(rPr, 'w:rStyle'), base), rPr);
    const fmt = this.changeFormat(ctx, cleanFormat(full));
    for (const el of elements(r)) {
      if (el.name === 'w:fldChar') this.fieldChar(attr(el, 'w:fldCharType'), ctx);
      else if (el.name === 'w:instrText') this.instruction(textOf(el));
      else if (!full.vanish && fmt && !this.suppressed()) this.runChild(el, ctx, fmt);
    }
  },

  runChild(el, ctx, fmt) {
    if (GRAPHICS.includes(el.name)) { this.graphic(el, ctx); return; }
    if (NOTE_KINDS[el.name]) { this.noteRef(ctx, NOTE_KINDS[el.name], attr(el, 'w:id')); return; }
    switch (el.name) {
      case 'w:t': this.pushText(ctx, textOf(el), fmt); break;
      case 'w:delText': if (ctx.change === 'del') this.pushText(ctx, textOf(el), fmt); break;
      case 'w:tab': case 'w:ptab': this.pushText(ctx, '\t', fmt); break;
      case 'w:br': if (!attr(el, 'w:type') || attr(el, 'w:type') === 'textWrapping') this.push(ctx, { t: 'break' }); break;
      case 'w:cr': this.push(ctx, { t: 'break' }); break;
      case 'w:noBreakHyphen': this.pushText(ctx, '-', fmt); break;
      case 'w:sym': this.pushText(ctx, symbolText(attr(el, 'w:char')), fmt); break;
      default: break;
    }
  },

  hyperlink(el, ctx, base) {
    if (this.suppressed()) { this.inlines(elements(el), ctx, base); return; }
    const rid = attr(el, 'r:id');
    const rel = rid ? this.pkg.rels(this.part).get(rid) : null;
    const anchor = attr(el, 'w:anchor');
    const node = this.openLink(ctx, rel ? { href: rel.target + (anchor ? '#' + anchor : '') } : anchor ? { anchor } : {});
    this.inlines(elements(el), ctx, base);
    this.closeLink(ctx, node);
  },

  openLink(ctx, target) {
    const node = Object.assign({ t: 'link', children: [] }, target);
    this.push(ctx, node);
    ctx.stack.push(node.children);
    return node;
  },

  closeLink(ctx, node) {
    if (this.top(ctx) === node.children) ctx.stack.pop();
  },

  math(el, ctx, base) {
    const text = descendants(el, 'm:t').map(textOf).join('');
    if (text) this.pushText(ctx, text, this.changeFormat(ctx, cleanFormat(base)) || {});
  },

  noteRef(ctx, kind, id) {
    if (id === null || (kind === 'comment' && this.options.comments === 'omit')) return;
    this.push(ctx, { t: 'note', kind, id });
    this.noteRefs.push({ kind, id });
  },
};
