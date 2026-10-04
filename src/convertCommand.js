'use strict';

const vscode = require('vscode');
const path = require('path');
const { convertDocx } = require('./index');
const { legacyToDocx } = require('./legacy');
const { sniff, isWordFile, targetsFor, WORD_EXTENSIONS } = require('./files');
const { settings } = require('./settings');
const { nls, reportWarnings, offerSettings } = require('./messages');

class ShownError extends Error {}

async function exists(uri) {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

async function pickFiles() {
  const picked = await vscode.window.showOpenDialog({
    canSelectMany: true,
    openLabel: nls.t('dialog.openLabel'),
    filters: { [nls.t('dialog.filter')]: WORD_EXTENSIONS.map((e) => e.slice(1)) },
  });
  return picked || [];
}

async function docxBytes(uri, name, options) {
  const bytes = Buffer.from(await vscode.workspace.fs.readFile(uri));
  const kind = sniff(bytes);
  if (kind === 'docx') return bytes;
  if (!kind) throw new ShownError(nls.t('error.notWord', { file: name }));
  if (uri.scheme !== 'file') throw new ShownError(nls.t('error.docNotLocal', { file: name }));
  try {
    return await legacyToDocx(uri.fsPath, { libreOfficePath: options.libreOfficePath });
  } catch (e) {
    if (e.code !== 'NO_DOC_CONVERTER') throw e;
    offerSettings(nls.t('error.noDocConverter', { file: name }), 'docxToMd.libreOfficePath');
    throw Object.assign(e, { reported: true });
  }
}

async function allowOverwrite(mdUri, state) {
  if (state.overwriteAll || !(await exists(mdUri))) return true;
  const overwrite = nls.t('action.overwrite');
  const overwriteAll = nls.t('action.overwriteAll');
  const choices = state.total > 1 ? [overwrite, overwriteAll, nls.t('action.skip')] : [overwrite, nls.t('action.skip')];
  const message = nls.t('prompt.overwrite', { file: path.basename(mdUri.path) });
  const choice = await vscode.window.showWarningMessage(message, { modal: true }, ...choices);
  if (choice === overwriteAll) state.overwriteAll = true;
  return choice === overwrite || choice === overwriteAll;
}

async function writeOutput(uri, targets, result) {
  if (result.images.length) {
    const dir = uri.with({ path: targets.imagesDir });
    await vscode.workspace.fs.createDirectory(dir);
    for (const img of result.images) await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(dir, img.file), img.data);
  }
  const mdUri = uri.with({ path: targets.markdown });
  await vscode.workspace.fs.writeFile(mdUri, Buffer.from(result.markdown, 'utf8'));
  return mdUri;
}

async function convertOne(uri, state) {
  const name = path.basename(uri.path);
  const options = settings();
  const targets = targetsFor(uri.path, options.imagesFolder);
  if (!(await allowOverwrite(uri.with({ path: targets.markdown }), state))) return null;
  const title = nls.t('progress.converting', { file: name });
  const result = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title }, async () =>
    convertDocx(await docxBytes(uri, name, options), Object.assign({ imageDir: targets.imagesLink }, options)));
  const mdUri = await writeOutput(uri, targets, result);
  reportWarnings(name, result.warnings);
  return mdUri;
}

async function showResult(done) {
  if (done.length > 1) {
    const documents = nls.plural('plural.document', done.length);
    vscode.window.showInformationMessage(nls.t('info.converted', { count: done.length, documents }));
    return;
  }
  const open = settings().openAfterConversion;
  if (open === 'editor') await vscode.window.showTextDocument(done[0]);
  else if (open === 'preview') await vscode.commands.executeCommand('markdown.showPreview', done[0]);
  else vscode.window.showInformationMessage(nls.t('info.convertedOne', { file: path.basename(done[0].path) }));
}

async function convert(uri, uris) {
  const selected = Array.isArray(uris) && uris.length ? uris : uri instanceof vscode.Uri ? [uri] : await pickFiles();
  const files = selected.filter((f) => isWordFile(f.path));
  const state = { total: files.length, overwriteAll: false };
  const done = [];
  for (const file of files) {
    try {
      const md = await convertOne(file, state);
      if (md) done.push(md);
    } catch (e) {
      if (e.reported) continue;
      const reason = e instanceof ShownError ? e.message : nls.t('error.failed', { file: path.basename(file.path), reason: e.message });
      vscode.window.showErrorMessage(reason);
    }
  }
  if (done.length) await showResult(done);
}

module.exports = { convert };
