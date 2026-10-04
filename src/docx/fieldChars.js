'use strict';

const { elements, attr } = require('./xml');
const { analyzeField } = require('./fields');

function anySuppressing(fields) {
  return fields.some((f) => f.phase === 'instr' || (f.suppress && f.phase === 'result'));
}

module.exports = {
  suppressed() {
    return anySuppressing(this.fields);
  },

  instruction(text) {
    const field = this.fields[this.fields.length - 1];
    if (field && field.phase === 'instr') field.instr += text;
  },

  simpleField(el, ctx, base) {
    this.fieldChar('begin', ctx);
    this.instruction(attr(el, 'w:instr') || '');
    this.fieldChar('separate', ctx);
    this.inlines(elements(el), ctx, base);
    this.fieldChar('end', ctx);
  },

  fieldChar(type, ctx) {
    if (type === 'begin') this.fields.push({ instr: '', phase: 'instr' });
    else if (type === 'separate') this.fieldResult(ctx);
    else if (type === 'end') this.fieldEnd(ctx);
  },

  fieldResult(ctx) {
    const field = this.fields[this.fields.length - 1];
    if (!field || field.phase !== 'instr') return;
    const outerSuppressed = anySuppressing(this.fields.slice(0, -1));
    field.phase = 'result';
    Object.assign(field, analyzeField(field.instr));
    if (outerSuppressed) return;
    if (field.kind === 'toc') this.pendingToc = { from: field.from, to: field.to };
    if (field.kind === 'toc' || field.kind === 'suppress') field.suppress = true;
    if (field.kind === 'link') {
      field.link = this.openLink(ctx, field.href ? { href: field.href + (field.anchor ? '#' + field.anchor : '') } : { anchor: field.anchor });
      field.ctx = ctx;
    }
  },

  fieldEnd(ctx) {
    const field = this.fields.pop();
    if (!field) return;
    if (field.phase === 'instr') {
      const result = analyzeField(field.instr);
      if (result.kind === 'toc' && !this.suppressed()) this.pendingToc = { from: result.from, to: result.to };
    }
    if (field.link && field.ctx === ctx) this.closeLink(ctx, field.link);
  },
};
