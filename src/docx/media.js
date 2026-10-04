'use strict';

const path = require('path').posix;
const { elements, child, attr, descendants } = require('./xml');

const VECTOR_IMAGE = /\.(emf|wmf|emz|wmz)$/i;

function chosenBranch(node) {
  return child(node, 'mc:Choice') || child(node, 'mc:Fallback');
}

function altText(node) {
  const docPr = descendants(node, 'wp:docPr')[0];
  return (docPr && (attr(docPr, 'descr') || attr(docPr, 'title'))) || '';
}

function uniqueName(base, taken) {
  const ext = path.extname(base);
  let name = base;
  for (let n = 2; taken.has(name.toLowerCase()); n++) name = base.slice(0, base.length - ext.length) + '-' + n + ext;
  return name;
}

module.exports = {
  graphic(node, ctx) {
    const alt = altText(node);
    const walk = (el) => {
      for (const c of elements(el)) {
        switch (c.name) {
          case 'mc:AlternateContent': walk(chosenBranch(c)); break;
          case 'a:blip': this.image(attr(c, 'r:embed') || attr(c, 'r:link'), alt, ctx); break;
          case 'v:imagedata': this.image(attr(c, 'r:id') || attr(c, 'r:pict'), alt || attr(c, 'o:title') || '', ctx); break;
          case 'w:txbxContent': ctx.textboxes.push(c); break;
          case 'c:chart': this.warn('chart'); break;
          case 'dgm:relIds': this.warn('smartArt'); break;
          default: walk(c);
        }
      }
    };
    walk(node.name === 'mc:AlternateContent' ? { children: [chosenBranch(node)].filter(Boolean) } : node);
  },

  image(rid, alt, ctx) {
    const rel = rid ? this.pkg.rels(this.part).get(rid) : null;
    if (!rel) return;
    if (rel.external) { this.push(ctx, { t: 'image', src: rel.target, alt }); return; }
    const file = this.imageByTarget.get(rel.target) || this.extractImage(rel.target);
    if (file) this.push(ctx, { t: 'image', file, alt });
  },

  extractImage(target) {
    const data = this.pkg.read(target);
    if (!data) return null;
    const file = uniqueName(path.basename(target), this.imageNames);
    this.imageNames.add(file.toLowerCase());
    this.imageByTarget.set(target, file);
    this.images.push({ file, data });
    if (VECTOR_IMAGE.test(file)) this.warn('vectorImage');
    return file;
  },
};
