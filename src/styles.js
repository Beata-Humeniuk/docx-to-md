'use strict';

// Style sheet (styles.xml): inheritance chains resolved into what the
// converter needs — heading level, list numbering, run formatting and the
// few paragraph roles that change the Markdown shape (quote, code, TOC).

const { child, childrenNamed, attr, val } = require('./xml');

const MONOSPACE = /courier|consolas|mono|menlo|monaco|lucida console|lucida sans typewriter|source code|fira code|inconsolata|fixedsys/i;

// Built-in style names are stored in English in styles.xml ("heading 1"),
// but documents produced by localized tools sometimes carry translated names.
const HEADING_NAME = /^(heading|nagłówek|naglowek|überschrift|titre|encabezado|título|titolo|kop)\s*([1-9])$/i;
const HEADING_ID = /^(heading|nag[łl]?[oó]?wek|berschrift|titre|encabezado|kop)([1-9])$/i;
const TOC_ENTRY = /^(toc|spis treści|spis tresci|verzeichnis|tdm|tabla de contenido)\s*([1-9])$/i;
const TOC_ENTRY_ID = /^(toc|spistreci|spistresci|verzeichnis)([1-9])$/i;
const TOC_HEADING = /^(toc heading|tocheading|nagłówek spisu treści|nag[łl]?[oó]?wekspisutre[śs]?ci|inhaltsverzeichnisüberschrift)$/i;
const QUOTE = /quote|cytat|zitat|citation|cita/i;
const CODE = /(^|[\s_-])(code|source|kod|preformatted|plain text|zwykły tekst|macro text|quelltext)([\s_-]|$)|^html ?preformatted$|^code/i;
const TITLE = /^(title|tytuł|tytul|titel|titre|título)$/i;

// A toggle property like <w:b/> or <w:b w:val="0"/>.
function toggle(node) {
  if (!node) return undefined;
  const v = attr(node, 'w:val');
  return !(v === '0' || v === 'false' || v === 'off' || v === 'none');
}

// Folds one w:rPr element into a formatting record (later wins).
function applyRunProps(fmt, rPr) {
  if (!rPr) return fmt;
  const set = (key, v) => { if (v !== undefined) fmt[key] = v; };
  set('b', toggle(child(rPr, 'w:b')));
  set('i', toggle(child(rPr, 'w:i')));
  const strike = toggle(child(rPr, 'w:strike'));
  const dstrike = toggle(child(rPr, 'w:dstrike'));
  if (strike !== undefined || dstrike !== undefined) fmt.s = !!(strike || dstrike);
  const u = child(rPr, 'w:u');
  if (u) fmt.u = attr(u, 'w:val') !== 'none';
  const va = val(rPr, 'w:vertAlign');
  if (va) {
    fmt.sup = va === 'superscript';
    fmt.sub = va === 'subscript';
  }
  const hl = val(rPr, 'w:highlight');
  if (hl) fmt.mark = hl !== 'none';
  set('vanish', toggle(child(rPr, 'w:vanish')));
  const fonts = child(rPr, 'w:rFonts');
  if (fonts) {
    const face = attr(fonts, 'w:ascii') || attr(fonts, 'w:hAnsi') || attr(fonts, 'w:cs');
    if (face) fmt.code = MONOSPACE.test(face);
  }
  return fmt;
}

function loadStyles(root) {
  const byId = new Map();
  let defaultParagraph = null;
  let defaultCharacter = null;
  let docDefaultsRPr = null;
  if (root) {
    const dd = child(root, 'w:docDefaults');
    docDefaultsRPr = child(child(dd, 'w:rPrDefault'), 'w:rPr');
    for (const s of childrenNamed(root, 'w:style')) {
      const id = attr(s, 'w:styleId');
      if (!id) continue;
      const type = attr(s, 'w:type') || 'paragraph';
      const style = {
        id,
        type,
        name: val(s, 'w:name') || id,
        basedOn: val(s, 'w:basedOn'),
        link: val(s, 'w:link'),
        pPr: child(s, 'w:pPr'),
        rPr: child(s, 'w:rPr'),
      };
      byId.set(type + ':' + id, style);
      const isDefault = toggle(child(s, 'w:default')) || attr(s, 'w:default') === '1' || attr(s, 'w:default') === 'true';
      if (isDefault && type === 'paragraph') defaultParagraph = id;
      if (isDefault && type === 'character') defaultCharacter = id;
    }
  }

  const get = (type, id) => (id ? byId.get(type + ':' + id) || null : null);

  // Derived-first chain: [style, parent, grandparent, ...].
  function chain(type, id) {
    const out = [];
    const seen = new Set();
    let s = get(type, id);
    while (s && !seen.has(s.id)) {
      seen.add(s.id);
      out.push(s);
      s = get(type, s.basedOn);
    }
    return out;
  }

  const paraCache = new Map();

  function paragraphInfo(id) {
    const key = id || defaultParagraph || '';
    if (paraCache.has(key)) return paraCache.get(key);
    const styles = chain('paragraph', key);
    const own = styles[0] || null;
    const info = {
      id: own ? own.id : null,
      name: own ? own.name : '',
      headingLevel: 0,
      title: false,
      numPr: null,
      indent: null,
      tocEntry: 0,
      tocHeading: false,
      quote: false,
      code: false,
      runFormat: {},
    };
    const match = (s, nameRe, idRe) => nameRe.exec(s.name) || (idRe && idRe.exec(s.id));

    // Roles are decided by the nearest style in the chain that has one; the
    // TOC heading goes first because it is normally based on "heading 1".
    for (const s of styles) {
      if (TOC_HEADING.test(s.name) || TOC_HEADING.test(s.id)) { info.tocHeading = true; break; }
      const toc = match(s, TOC_ENTRY, TOC_ENTRY_ID);
      if (toc) { info.tocEntry = Number(toc[2]); break; }
      const h = match(s, HEADING_NAME, HEADING_ID);
      if (h) { info.headingLevel = Number(h[2]); break; }
      if (TITLE.test(s.name) || TITLE.test(s.id)) { info.headingLevel = 1; info.title = true; break; }
      const outline = val(s.pPr, 'w:outlineLvl');
      if (outline !== null && Number(outline) < 9) { info.headingLevel = Number(outline) + 1; break; }
    }
    info.quote = !info.headingLevel && styles.some((s) => QUOTE.test(s.name));
    info.code = !info.headingLevel && styles.some((s) => CODE.test(s.name) || CODE.test(s.id));

    for (const s of styles) {
      const numPr = child(s.pPr, 'w:numPr');
      if (numPr) {
        info.numPr = { numId: val(numPr, 'w:numId'), ilvl: val(numPr, 'w:ilvl'), styleId: s.id };
        break;
      }
    }

    for (const s of styles) {
      const ind = child(s.pPr, 'w:ind');
      const v = ind && (attr(ind, 'w:left') !== null ? attr(ind, 'w:left') : attr(ind, 'w:start'));
      if (v !== null && v !== undefined) { info.indent = Number(v); break; }
    }

    const fmt = applyRunProps({}, docDefaultsRPr);
    for (const s of styles.slice().reverse()) applyRunProps(fmt, s.rPr);
    info.runFormat = fmt;
    paraCache.set(key, info);
    return info;
  }

  function characterFormat(id, base) {
    const fmt = Object.assign({}, base);
    const styles = chain('character', id || defaultCharacter);
    for (const s of styles.slice().reverse()) applyRunProps(fmt, s.rPr);
    if (styles.some((s) => /^(html ?code|code|kod|source ?code|inline ?code|verbatim)/i.test(s.name))) fmt.code = true;
    return fmt;
  }

  function numberingStyleNumId(id) {
    for (const s of chain('numbering', id)) {
      const numPr = child(s.pPr, 'w:numPr');
      const numId = val(numPr, 'w:numId');
      if (numId) return numId;
    }
    return null;
  }

  return { paragraphInfo, characterFormat, numberingStyleNumId };
}

module.exports = { loadStyles, applyRunProps, MONOSPACE };
