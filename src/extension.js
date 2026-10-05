'use strict';

const vscode = require('vscode');
const path = require('path');
const { forLanguage } = require('./nls');
const { readDocument, renderDocument } = require('./index');
const { docToDocx } = require('./docConversion');
const { sniff, isWordFile, targetsFor, WORD_EXTENSIONS } = require('./files');

const nls = forLanguage(vscode.env && vscode.env.language);

function config() {
  return vscode.workspace.getConfiguration('docxToMd');
}

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

// Bytes of the document as .docx — old .doc and RTF go through Word or
// LibreOffice first.
async function docxBytes(uri, name) {
  const bytes = Buffer.from(await vscode.workspace.fs.readFile(uri));
  const kind = sniff(bytes);
  if (kind === 'docx') return bytes;
  if (!kind) throw Object.assign(new Error(nls.t('error.notWord', { file: name })), { shown: true });
  if (uri.scheme !== 'file') throw Object.assign(new Error(nls.t('error.docNotLocal', { file: name })), { shown: true });
  try {
    return await docToDocx(uri.fsPath, { libreOfficePath: String(config().get('libreOfficePath') || '').trim() });
  } catch (e) {
    if (e.code !== 'NO_DOC_CONVERTER') throw e;
    const open = nls.t('action.openSettings');
    vscode.window.showErrorMessage(nls.t('error.noDocConverter', { file: name }), open).then((choice) => {
      if (choice === open) vscode.commands.executeCommand('workbench.action.openSettings', 'docxToMd.libreOfficePath');
    });
    throw Object.assign(e, { shown: true, reported: true });
  }
}

function reportWarnings(name, warnings) {
  const lost = [];
  for (const w of warnings) {
    if (w.code === 'chart') lost.push(w.count + ' ' + nls.plural('plural.chart', w.count));
    else if (w.code === 'smartArt') lost.push(w.count + ' ' + nls.plural('plural.smartArt', w.count));
    else if (w.code === 'altChunk') lost.push(w.count + ' ' + nls.plural('plural.embeddedDocument', w.count));
  }
  if (lost.length) vscode.window.showWarningMessage(nls.t('warn.lossy', { file: name, items: lost.join(', ') }));
  const vector = warnings.find((w) => w.code === 'vectorImage');
  if (vector) {
    vscode.window.showWarningMessage(nls.t('warn.vectorImages', {
      file: name, count: vector.count, images: nls.plural('plural.image', vector.count),
    }));
  }
}

// Every section starts checked; unchecking one leaves out its subsections
// too. Returns the indices to exclude, or null when the picker was dismissed.
async function pickSections(sections, name) {
  const items = sections.map((s, index) => ({
    label: '\u2003'.repeat(s.level - 1) + s.text,
    description: 'H' + s.level,
    picked: true,
    index,
  }));
  const picked = await vscode.window.showQuickPick(items, {
    canPickMany: true,
    title: nls.t('pick.sectionsTitle', { file: name }),
    placeHolder: nls.t('pick.sectionsPlaceholder'),
  });
  if (!picked) return null;
  const kept = new Set(picked.map((i) => i.index));
  return items.map((i) => i.index).filter((i) => !kept.has(i));
}

async function convertOne(uri, state) {
  const name = path.basename(uri.path);
  const targets = targetsFor(uri.path, config().get('imagesFolder'));
  const mdUri = uri.with({ path: targets.markdown });
  const mdName = path.basename(targets.markdown);

  if (!state.overwriteAll && await exists(mdUri)) {
    const choices = [nls.t('action.overwrite')];
    if (state.total > 1) choices.push(nls.t('action.overwriteAll'));
    choices.push(nls.t('action.skip'));
    const choice = await vscode.window.showWarningMessage(nls.t('prompt.overwrite', { file: mdName }), { modal: true }, ...choices);
    if (choice === nls.t('action.overwriteAll')) state.overwriteAll = true;
    else if (choice !== nls.t('action.overwrite')) return null;
  }

  const settings = config();
  const options = {
    imageDir: targets.imagesLink,
    tables: settings.get('tables'),
    trackedChanges: settings.get('trackedChanges'),
    comments: settings.get('comments'),
  };
  const progress = { location: vscode.ProgressLocation.Notification, title: nls.t('progress.converting', { file: name }) };
  const doc = await vscode.window.withProgress(progress, async () => readDocument(await docxBytes(uri, name), options));
  if (settings.get('chooseSections') && doc.sections.length > 1) {
    const excluded = await pickSections(doc.sections, name);
    if (!excluded) return null;
    options.excludeSections = excluded;
  }
  const result = await vscode.window.withProgress(progress, async () => renderDocument(doc, options));

  if (result.images.length) {
    const dirUri = uri.with({ path: targets.imagesDir });
    await vscode.workspace.fs.createDirectory(dirUri);
    for (const img of result.images) {
      await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(dirUri, img.file), img.data);
    }
  }
  await vscode.workspace.fs.writeFile(mdUri, Buffer.from(result.markdown, 'utf8'));
  reportWarnings(name, result.warnings);
  return mdUri;
}

async function convert(uri, uris) {
  let files = Array.isArray(uris) && uris.length ? uris : uri instanceof vscode.Uri ? [uri] : await pickFiles();
  files = files.filter((f) => isWordFile(f.path));
  if (!files.length) return;
  const state = { total: files.length, overwriteAll: false };
  const done = [];
  for (const file of files) {
    try {
      const md = await convertOne(file, state);
      if (md) done.push(md);
    } catch (e) {
      if (e.reported) continue;
      const name = path.basename(file.path);
      vscode.window.showErrorMessage(e.shown ? e.message : nls.t('error.failed', { file: name, reason: e.message }));
    }
  }
  if (!done.length) return;
  const open = config().get('openAfterConversion');
  if (done.length === 1) {
    if (open === 'editor') await vscode.window.showTextDocument(done[0]);
    else if (open === 'preview') await vscode.commands.executeCommand('markdown.showPreview', done[0]);
    else vscode.window.showInformationMessage(nls.t('info.convertedOne', { file: path.basename(done[0].path) }));
  } else {
    vscode.window.showInformationMessage(nls.t('info.converted', {
      count: done.length, documents: nls.plural('plural.document', done.length),
    }));
  }
}

function activate(context) {
  context.subscriptions.push(vscode.commands.registerCommand('docxToMd.convert', convert));
}

function deactivate() {}

module.exports = { activate, deactivate };
