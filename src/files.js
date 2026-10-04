'use strict';

// Where the output goes and what a file really is. The format is taken from
// the bytes, not the extension: a .doc that is really a .docx (or the other
// way round, or RTF saved under .doc) happens often enough.

const path = require('path').posix;

const WORD_EXTENSIONS = ['.docx', '.docm', '.dotx', '.dotm', '.doc', '.dot', '.rtf'];

// 'docx' (a ZIP package), 'doc' (OLE compound file) or 'rtf'; null otherwise.
function sniff(buf) {
  if (!buf || buf.length < 8) return null;
  if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return 'docx';
  if (buf.readUInt32BE(0) === 0xd0cf11e0 && buf.readUInt32BE(4) === 0xa1b11ae1) return 'doc';
  if (buf.toString('latin1', 0, 5) === '{\\rtf') return 'rtf';
  return null;
}

function isWordFile(file) {
  return WORD_EXTENSIONS.includes(path.extname(file).toLowerCase());
}

// "{name}" in the folder pattern is the document name without extension.
// The folder is relative to the .md; it may not climb out of it.
function targetsFor(source, imagesFolder) {
  const dir = path.dirname(source);
  const name = path.basename(source, path.extname(source));
  let folder = String(imagesFolder || '{name}_images').split('{name}').join(name).replace(/\\/g, '/');
  folder = folder.split('/').filter((s) => s && s !== '.' && s !== '..').join('/') || name + '_images';
  return {
    markdown: path.join(dir, name + '.md'),
    imagesDir: path.join(dir, ...folder.split('/')),
    imagesLink: folder,
  };
}

module.exports = { sniff, isWordFile, targetsFor, WORD_EXTENSIONS };
