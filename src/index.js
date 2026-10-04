'use strict';

// Public entry point: .docx bytes in, Markdown text and extracted images out.

const { openPackage } = require('./package');
const { convertPackage } = require('./converter');
const { renderMarkdown } = require('./markdown');

// options:
//   imageDir        folder the image links point to (relative to the .md)
//   tables          'auto' | 'gfm' | 'html'
//   trackedChanges  'accept' | 'reject' | 'markup'
//   comments        'footnotes' | 'omit'
function convertDocx(buffer, options = {}) {
  const pkg = openPackage(buffer);
  const model = convertPackage(pkg, options);
  const markdown = renderMarkdown(model, options);
  return { markdown, images: model.images, warnings: model.warnings };
}

module.exports = { convertDocx };
