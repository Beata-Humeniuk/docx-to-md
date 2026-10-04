'use strict';

const { readDocx } = require('./docx');
const { renderMarkdown } = require('./markdown');

function convertDocx(buffer, options = {}) {
  const model = readDocx(buffer, options);
  return { markdown: renderMarkdown(model, options), images: model.images, warnings: model.warnings };
}

module.exports = { convertDocx };
