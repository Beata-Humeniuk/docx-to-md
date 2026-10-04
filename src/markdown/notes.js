'use strict';

const { escapeHtml, escapeText, escapeLineStart } = require('./text');

const NOTE_INDENT = '\n    ';

module.exports = {
  noteRef(n, env) {
    const key = n.kind + ':' + n.id;
    if (!this.model.notes.get(key)) return '';
    const label = this.noteLabel(key, n.kind);
    if (env.html) return '<sup>' + escapeHtml(label) + '</sup>';
    this.markdownNotes.add(key);
    return '[^' + label + ']';
  },

  noteLabel(key, kind) {
    if (!this.noteLabels.has(key)) {
      const isComment = kind === 'comment';
      const count = this.noteOrder.filter((k) => k.startsWith('comment:') === isComment).length + 1;
      this.noteLabels.set(key, isComment ? 'c' + count : String(count));
      this.noteOrder.push(key);
    }
    return this.noteLabels.get(key);
  },

  noteBody(note) {
    const paragraphs = note.blocks.map((b) => {
      if (b.type === 'table') return this.cellText([b], false);
      const text = b.type === 'paragraph' ? this.inlines(b.inlines, {}).trim() : '';
      return text.split('\n').map(escapeLineStart).join(NOTE_INDENT);
    }).filter(Boolean);
    if (note.kind === 'comment' && note.author) paragraphs[0] = '**' + escapeText(note.author) + ':** ' + (paragraphs[0] || '');
    return paragraphs.join('\n' + NOTE_INDENT) || ' ';
  },

  notesSection() {
    const definitions = [];
    const plain = [];
    for (let i = 0; i < this.noteOrder.length; i++) {
      const key = this.noteOrder[i];
      const label = this.noteLabels.get(key);
      const body = this.noteBody(this.model.notes.get(key));
      if (this.markdownNotes.has(key)) definitions.push('[^' + label + ']: ' + body);
      else plain.push('<sup>' + escapeHtml(label) + '</sup> ' + body);
    }
    return [...definitions, ...plain].join('\n\n');
  },
};
