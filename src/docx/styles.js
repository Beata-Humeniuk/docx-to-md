'use strict';

const { child, childrenNamed, attr, val } = require('./xml');
const { toggle, applyRunProps } = require('./runFormat');
const { indentOf } = require('./indent');
const NAMES = require('./styleNames');

function readStyles(root) {
  const byId = new Map();
  const defaults = {};
  for (const s of childrenNamed(root, 'w:style')) {
    const id = attr(s, 'w:styleId');
    if (!id) continue;
    const type = attr(s, 'w:type') || 'paragraph';
    byId.set(type + ':' + id, {
      id,
      name: val(s, 'w:name') || id,
      basedOn: val(s, 'w:basedOn'),
      pPr: child(s, 'w:pPr'),
      rPr: child(s, 'w:rPr'),
    });
    if (toggle(child(s, 'w:default')) || ['1', 'true'].includes(attr(s, 'w:default'))) defaults[type] = id;
  }
  return { byId, defaults };
}

function role(styles) {
  const matches = (s, nameRe, idRe) => nameRe.exec(s.name) || idRe.exec(s.id);
  for (const s of styles) {
    if (NAMES.TOC_HEADING.test(s.name) || NAMES.TOC_HEADING.test(s.id)) return { tocHeading: true };
    const toc = matches(s, NAMES.TOC_ENTRY_NAME, NAMES.TOC_ENTRY_ID);
    if (toc) return { tocEntry: Number(toc[2]) };
    const heading = matches(s, NAMES.HEADING_NAME, NAMES.HEADING_ID);
    if (heading) return { headingLevel: Number(heading[2]) };
    if (NAMES.TITLE.test(s.name) || NAMES.TITLE.test(s.id)) return { headingLevel: 1, title: true };
    const outline = val(s.pPr, 'w:outlineLvl');
    if (outline !== null && Number(outline) < 9) return { headingLevel: Number(outline) + 1 };
  }
  return {};
}

function firstNumPr(styles) {
  for (const s of styles) {
    const numPr = child(s.pPr, 'w:numPr');
    if (numPr) return { numId: val(numPr, 'w:numId'), ilvl: val(numPr, 'w:ilvl'), styleId: s.id };
  }
  return null;
}

function firstIndent(styles) {
  for (const s of styles) {
    const indent = indentOf(s.pPr);
    if (indent !== null) return indent;
  }
  return null;
}

function loadStyles(root) {
  const { byId, defaults } = readStyles(root);
  const defaultRunProps = child(child(child(root, 'w:docDefaults'), 'w:rPrDefault'), 'w:rPr');
  const get = (type, id) => (id && byId.get(type + ':' + id)) || null;

  function chain(type, id) {
    const out = [];
    for (let s = get(type, id); s && !out.includes(s); s = get(type, s.basedOn)) out.push(s);
    return out;
  }

  const cache = new Map();
  function paragraphInfo(id) {
    const key = id || defaults.paragraph || '';
    if (cache.has(key)) return cache.get(key);
    const styles = chain('paragraph', key);
    const info = Object.assign({ headingLevel: 0, title: false, tocEntry: 0, tocHeading: false }, role(styles));
    info.quote = !info.headingLevel && styles.some((s) => NAMES.QUOTE.test(s.name));
    info.code = !info.headingLevel && styles.some((s) => NAMES.CODE.test(s.name) || NAMES.CODE.test(s.id));
    info.numPr = firstNumPr(styles);
    info.indent = firstIndent(styles);
    info.runFormat = styles.reduceRight((fmt, s) => applyRunProps(fmt, s.rPr), applyRunProps({}, defaultRunProps));
    cache.set(key, info);
    return info;
  }

  function characterFormat(id, base) {
    const styles = chain('character', id || defaults.character);
    const fmt = styles.reduceRight((f, s) => applyRunProps(f, s.rPr), Object.assign({}, base));
    if (styles.some((s) => NAMES.CODE_CHARACTER.test(s.name))) fmt.code = true;
    return fmt;
  }

  function numberingStyleNumId(id) {
    for (const s of chain('numbering', id)) {
      const numId = val(child(s.pPr, 'w:numPr'), 'w:numId');
      if (numId) return numId;
    }
    return null;
  }

  return { paragraphInfo, characterFormat, numberingStyleNumId };
}

module.exports = { loadStyles };
