'use strict';

const { collectAnchors } = require('./anchors');

class MarkdownRenderer {
  constructor(model, options = {}) {
    this.model = model;
    this.options = Object.assign({ tables: 'auto', imageDir: 'images' }, options);
    this.anchors = collectAnchors(model);
    this.bookmarkTarget = this.anchors.bookmarkTarget;
    this.referenced = this.anchors.referenced;
    this.noteLabels = new Map();
    this.noteOrder = [];
    this.markdownNotes = new Set();
  }

  anchorId(name) {
    return this.bookmarkTarget.get(name) || name;
  }

  render() {
    const chunks = [];
    this.blocks(this.model.blocks, chunks);
    const body = chunks.reduce((out, c) => (!c.text ? out : out + (out ? (c.tight ? '\n' : '\n\n') : '') + c.text), '');
    const notes = this.notesSection();
    return (notes ? body + (body ? '\n\n' : '') + notes : body).trim() + '\n';
  }
}

Object.assign(MarkdownRenderer.prototype,
  require('./inlines'), require('./blocks'), require('./tables'), require('./notes'));

function renderMarkdown(model, options) {
  return new MarkdownRenderer(model, options).render();
}

module.exports = { renderMarkdown };
