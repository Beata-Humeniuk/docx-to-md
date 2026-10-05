'use strict';

// Public entry point: .docx bytes in, Markdown text and extracted images out.

const { openPackage } = require('./package');
const { convertPackage } = require('./converter');
const { renderMarkdown } = require('./markdown');
const { outline, withoutSections } = require('./sections');

// options:
//   imageDir        folder the image links point to (relative to the .md)
//   tables          'auto' | 'gfm' | 'html'
//   trackedChanges  'accept' | 'reject' | 'markup'
//   comments        'footnotes' | 'omit'
//   excludeSections indices from readDocument().sections to leave out
function convertDocx(buffer, options = {}) {
  return renderDocument(readDocument(buffer, options), options);
}

// Two-step form: read first, show the outline, then render what was kept.
function readDocument(buffer, options = {}) {
  const model = convertPackage(openPackage(buffer), options);
  return { model, sections: outline(model) };
}

function renderDocument(doc, options = {}) {
  const excluded = options.excludeSections || [];
  const model = excluded.length ? withoutSections(doc.model, doc.sections, excluded) : doc.model;
  const markdown = renderMarkdown(model, options);
  return { markdown, images: model.images, warnings: model.warnings };
}

module.exports = { convertDocx, readDocument, renderDocument };
