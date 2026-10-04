'use strict';

const path = require('path').posix;

const WORD_EXTENSIONS = ['.docx', '.docm', '.dotx', '.dotm', '.doc', '.dot', '.rtf'];

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

function imagesFolder(pattern, name) {
  const folder = String(pattern || '{name}_images').split('{name}').join(name).replace(/\\/g, '/');
  return folder.split('/').filter((s) => s && s !== '.' && s !== '..').join('/') || name + '_images';
}

function targetsFor(source, pattern) {
  const dir = path.dirname(source);
  const name = path.basename(source, path.extname(source));
  const folder = imagesFolder(pattern, name);
  return {
    markdown: path.join(dir, name + '.md'),
    imagesDir: path.join(dir, ...folder.split('/')),
    imagesLink: folder,
  };
}

module.exports = { sniff, isWordFile, targetsFor, WORD_EXTENSIONS };
