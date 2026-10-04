'use strict';

// The OOXML package around a Word document: parts by (case-insensitive)
// name and relationships resolved to part paths or external targets.

const path = require('path').posix;
const { readZip } = require('./zip');
const { parseXml, childrenNamed, attr } = require('./xml');

function openPackage(buffer) {
  let zip;
  try {
    zip = readZip(buffer);
  } catch (e) {
    const err = new Error('not a .docx package: ' + e.message);
    err.code = 'NOT_DOCX';
    throw err;
  }
  const names = new Map();
  for (const k of zip.keys()) names.set(k.toLowerCase(), k);

  const normalize = (p) => path.normalize(p.replace(/\\/g, '/')).replace(/^\/+/, '');
  const read = (p) => {
    const key = names.get(normalize(p).toLowerCase());
    return key ? zip.get(key)() : null;
  };
  const xml = (p) => {
    const buf = read(p);
    return buf ? parseXml(buf) : null;
  };

  const relsCache = new Map();
  // Map<id, { type, target, external }> for the given part.
  function rels(partPath) {
    const part = partPath ? normalize(partPath) : '';
    if (relsCache.has(part)) return relsCache.get(part);
    const dir = part ? path.dirname(part) : '';
    const relsPath = part ? (dir === '.' ? '' : dir + '/') + '_rels/' + path.basename(part) + '.rels' : '_rels/.rels';
    const map = new Map();
    const root = xml(relsPath);
    for (const r of childrenNamed(root, 'rel:Relationship').concat(childrenNamed(root, 'Relationship'))) {
      const target = attr(r, 'Target') || '';
      const external = attr(r, 'TargetMode') === 'External';
      map.set(attr(r, 'Id'), {
        type: attr(r, 'Type') || '',
        external,
        target: external ? target : target.startsWith('/') ? normalize(target) : normalize(path.join(dir, target)),
      });
    }
    relsCache.set(part, map);
    return map;
  }

  function relByType(partPath, suffix) {
    for (const r of rels(partPath).values()) if (r.type.endsWith(suffix) && !r.external) return r.target;
    return null;
  }

  const main = relByType('', '/officeDocument') || 'word/document.xml';
  if (!read(main)) {
    const err = new Error('not a Word document: ' + main + ' is missing');
    err.code = 'NOT_DOCX';
    throw err;
  }

  return { read, xml, rels, relByType, main };
}

module.exports = { openPackage };
