'use strict';

const { elements, child, attr } = require('./xml');
const { loadStyles } = require('./styles');
const { loadNumbering } = require('./numbering');
const { readParagraph } = require('./paragraph');
const { readTable } = require('./table');
const { readNotes } = require('./notes');

class DocumentReader {
  constructor(pkg, options = {}) {
    this.pkg = pkg;
    this.options = Object.assign({ trackedChanges: 'accept', comments: 'footnotes' }, options);
    this.styles = loadStyles(this.relatedXml('/styles'));
    this.numbering = loadNumbering(this.relatedXml('/numbering'), this.styles);
    this.part = pkg.main;
    this.fields = [];
    this.pendingBookmarks = [];
    this.tocOpen = false;
    this.images = [];
    this.imageByTarget = new Map();
    this.imageNames = new Set();
    this.warnings = new Map();
    this.noteRefs = [];
  }

  relatedXml(suffix) {
    const path = this.pkg.relByType(this.pkg.main, suffix);
    return path && this.pkg.xml(path);
  }

  warn(code) {
    this.warnings.set(code, (this.warnings.get(code) || 0) + 1);
  }

  read() {
    const blocks = this.blocks(child(this.pkg.xml(this.pkg.main), 'w:body'));
    return {
      blocks,
      notes: readNotes(this),
      images: this.images,
      warnings: Array.from(this.warnings, ([code, count]) => ({ code, count })),
    };
  }

  blocks(node) {
    const blocks = [];
    this.body(node, blocks);
    if (this.pendingBookmarks.length) {
      blocks.push({ type: 'paragraph', inlines: this.pendingBookmarks.map((name) => ({ t: 'anchor', name })) });
      this.pendingBookmarks = [];
    }
    return blocks;
  }

  body(node, blocks) {
    const keepDeleted = this.options.trackedChanges !== 'accept';
    for (const el of elements(node)) {
      switch (el.name) {
        case 'w:p': readParagraph(this, el, blocks); break;
        case 'w:tbl': this.tocOpen = false; blocks.push(readTable(this, el)); break;
        case 'w:sdt': this.body(child(el, 'w:sdtContent'), blocks); break;
        case 'w:customXml': case 'w:ins': case 'w:moveTo': this.body(el, blocks); break;
        case 'w:del': case 'w:moveFrom': if (keepDeleted) this.body(el, blocks); break;
        case 'w:bookmarkStart': this.bookmark(attr(el, 'w:name')); break;
        case 'mc:AlternateContent': this.body(child(el, 'mc:Choice') || child(el, 'mc:Fallback'), blocks); break;
        case 'w:altChunk': this.warn('altChunk'); break;
        default: break;
      }
    }
  }

  bookmark(name) {
    if (this.keepsBookmark(name)) this.pendingBookmarks.push(name);
  }

  keepsBookmark(name) {
    return !!name && name !== '_GoBack';
  }
}

Object.assign(DocumentReader.prototype, require('./inlines'), require('./fieldChars'), require('./media'));

function readDocument(pkg, options) {
  return new DocumentReader(pkg, options).read();
}

module.exports = { readDocument };
