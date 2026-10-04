'use strict';

const path = require('path').posix;
const { readZip } = require('./zip');
const { parseXml, childrenNamed, attr } = require('./xml');

function notDocx(message) {
  return Object.assign(new Error(message), { code: 'NOT_DOCX' });
}

const normalize = (p) => path.normalize(p.replace(/\\/g, '/')).replace(/^\/+/, '');

function relsPathOf(part) {
  if (!part) return '_rels/.rels';
  const dir = path.dirname(part);
  return (dir === '.' ? '' : dir + '/') + '_rels/' + path.basename(part) + '.rels';
}

function openPackage(buffer) {
  let zip;
  try {
    zip = readZip(buffer);
  } catch (e) {
    throw notDocx('not a .docx package: ' + e.message);
  }
  const names = new Map([...zip.keys()].map((k) => [k.toLowerCase(), k]));
  const read = (p) => {
    const key = names.get(normalize(p).toLowerCase());
    return key ? zip.get(key)() : null;
  };
  const xml = (p) => {
    const buf = read(p);
    return buf ? parseXml(buf) : null;
  };

  const cache = new Map();
  function rels(partPath) {
    const part = partPath ? normalize(partPath) : '';
    if (!cache.has(part)) cache.set(part, readRels(xml(relsPathOf(part)), part ? path.dirname(part) : ''));
    return cache.get(part);
  }

  function relByType(partPath, suffix) {
    for (const r of rels(partPath).values()) if (r.type.endsWith(suffix) && !r.external) return r.target;
    return null;
  }

  const main = relByType('', '/officeDocument') || 'word/document.xml';
  if (!read(main)) throw notDocx('not a Word document: ' + main + ' is missing');
  return { read, xml, rels, relByType, main };
}

function readRels(root, dir) {
  const map = new Map();
  for (const r of [...childrenNamed(root, 'rel:Relationship'), ...childrenNamed(root, 'Relationship')]) {
    const target = attr(r, 'Target') || '';
    const external = attr(r, 'TargetMode') === 'External';
    map.set(attr(r, 'Id'), {
      type: attr(r, 'Type') || '',
      external,
      target: external ? target : normalize(target.startsWith('/') ? target : path.join(dir, target)),
    });
  }
  return map;
}

module.exports = { openPackage };
