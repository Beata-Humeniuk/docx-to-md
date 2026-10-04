'use strict';

const vscode = require('vscode');

function settings() {
  const config = vscode.workspace.getConfiguration('docxToMd');
  return {
    tables: config.get('tables'),
    trackedChanges: config.get('trackedChanges'),
    comments: config.get('comments'),
    imagesFolder: config.get('imagesFolder'),
    openAfterConversion: config.get('openAfterConversion'),
    libreOfficePath: String(config.get('libreOfficePath') || '').trim(),
  };
}

module.exports = { settings };
