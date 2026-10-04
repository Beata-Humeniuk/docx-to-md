'use strict';

const vscode = require('vscode');
const { forLanguage } = require('./i18n');

const nls = forLanguage(vscode.env && vscode.env.language);

const LOST = { chart: 'plural.chart', smartArt: 'plural.smartArt', altChunk: 'plural.embeddedDocument' };

function reportWarnings(file, warnings) {
  const lost = warnings.filter((w) => LOST[w.code]).map((w) => w.count + ' ' + nls.plural(LOST[w.code], w.count));
  if (lost.length) vscode.window.showWarningMessage(nls.t('warn.lossy', { file, items: lost.join(', ') }));
  const vector = warnings.find((w) => w.code === 'vectorImage');
  if (vector) {
    const images = nls.plural('plural.image', vector.count);
    vscode.window.showWarningMessage(nls.t('warn.vectorImages', { file, count: vector.count, images }));
  }
}

async function offerSettings(message, setting) {
  const open = nls.t('action.openSettings');
  if (await vscode.window.showErrorMessage(message, open) === open) {
    await vscode.commands.executeCommand('workbench.action.openSettings', setting);
  }
}

module.exports = { nls, reportWarnings, offerSettings };
