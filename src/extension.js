'use strict';

const vscode = require('vscode');
const { convert } = require('./convertCommand');

function activate(context) {
  context.subscriptions.push(vscode.commands.registerCommand('docxToMd.convert', convert));
}

function deactivate() {}

module.exports = { activate, deactivate };
