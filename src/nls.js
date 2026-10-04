'use strict';

// UI message catalog. English is the base every unset key falls back to;
// Polish is a full translation. The language follows the editor's display
// language (vscode.env.language). The Markdown written from a document keeps
// the document's own words and is not translated.

// Plural keys hold arrays: English [one, many], Polish [one, few, many].
const EN = {
  'action.overwrite': 'Overwrite',
  'action.overwriteAll': 'Overwrite all',
  'action.skip': 'Skip',
  'action.openSettings': 'Open settings',

  'dialog.openLabel': 'Convert to Markdown',
  'dialog.filter': 'Word documents',

  'prompt.overwrite': '{file} already exists. Overwrite it?',

  'progress.converting': 'Converting {file} to Markdown…',

  'info.convertedOne': 'Saved {file}.',
  'info.converted': 'Converted {count} {documents} to Markdown.',

  'warn.lossy': '{file}: not carried over — {items}.',
  'warn.vectorImages': '{file}: {count} {images} in EMF/WMF format — saved next to the Markdown, but Markdown previews cannot display that format.',

  'error.notWord': '{file} is not a Word document (.docx or .doc).',
  'error.failed': 'Could not convert {file}: {reason}',
  'error.docNotLocal': '{file} is not on this computer’s disk. Old .doc files are read by Word or LibreOffice, which need a local file.',
  'error.noDocConverter': 'Cannot read the old .doc format of {file}: that needs Microsoft Word (Windows) or LibreOffice, and neither could be started. Install LibreOffice or point docxToMd.libreOfficePath at soffice — or open the file in Word and save it as .docx.',

  'plural.document': ['document', 'documents'],
  'plural.image': ['image', 'images'],
  'plural.chart': ['chart', 'charts'],
  'plural.smartArt': ['SmartArt graphic', 'SmartArt graphics'],
  'plural.embeddedDocument': ['embedded document', 'embedded documents'],
};

const PL = {
  'action.overwrite': 'Nadpisz',
  'action.overwriteAll': 'Nadpisz wszystkie',
  'action.skip': 'Pomiń',
  'action.openSettings': 'Otwórz ustawienia',

  'dialog.openLabel': 'Konwertuj do Markdown',
  'dialog.filter': 'Dokumenty Worda',

  'prompt.overwrite': '{file} już istnieje. Nadpisać?',

  'progress.converting': 'Konwertuję {file} do Markdown…',

  'info.convertedOne': 'Zapisano {file}.',
  'info.converted': 'Skonwertowano do Markdown: {count} {documents}.',

  'warn.lossy': '{file}: nie przeniesiono — {items}.',
  'warn.vectorImages': '{file}: {count} {images} w formacie EMF/WMF — zapisane obok pliku Markdown, ale podgląd Markdown tego formatu nie wyświetla.',

  'error.notWord': '{file} nie jest dokumentem Worda (.docx ani .doc).',
  'error.failed': 'Nie udało się skonwertować {file}: {reason}',
  'error.docNotLocal': '{file} nie leży na dysku tego komputera. Stare pliki .doc czyta Word albo LibreOffice, a one potrzebują pliku lokalnego.',
  'error.noDocConverter': 'Nie mogę odczytać starego formatu .doc pliku {file}: do tego potrzebny jest Microsoft Word (Windows) albo LibreOffice, a żadnego z nich nie udało się uruchomić. Zainstaluj LibreOffice albo wskaż soffice w docxToMd.libreOfficePath — albo otwórz plik w Wordzie i zapisz jako .docx.',

  'plural.document': ['dokument', 'dokumenty', 'dokumentów'],
  'plural.image': ['obraz', 'obrazy', 'obrazów'],
  'plural.chart': ['wykres', 'wykresy', 'wykresów'],
  'plural.smartArt': ['grafika SmartArt', 'grafiki SmartArt', 'grafik SmartArt'],
  'plural.embeddedDocument': ['osadzony dokument', 'osadzone dokumenty', 'osadzonych dokumentów'],
};

const TRANSLATIONS = { pl: PL };

// 'pl-PL' → 'pl'; anything unknown falls back to the English base.
function baseLanguage(tag) {
  return String(tag || 'en').toLowerCase().split(/[-_]/)[0];
}

const PLURAL_RULES = {
  en: (n) => (n === 1 ? 0 : 1),
  pl: (n) => {
    if (n === 1) return 0;
    const d = n % 10;
    const h = n % 100;
    return d >= 2 && d <= 4 && (h < 12 || h > 14) ? 1 : 2;
  },
};

function forLanguage(tag) {
  const lang = baseLanguage(tag);
  const table = TRANSLATIONS[lang] || {};
  const rule = PLURAL_RULES[lang] || PLURAL_RULES.en;

  const lookup = (key) => {
    const value = table[key];
    if (typeof value === 'string' && value !== '') return value;
    if (Array.isArray(value) && value.length) return value;
    return EN[key];
  };

  const t = (key, params) => {
    const text = lookup(key);
    if (typeof text !== 'string') return key;
    return text.replace(/\{(\w+)\}/g, (whole, name) =>
      params && name in params ? String(params[name]) : whole);
  };

  const plural = (key, n) => {
    const forms = lookup(key);
    if (!Array.isArray(forms) || !forms.length) return typeof forms === 'string' ? forms : key;
    return forms[Math.min(rule(n), forms.length - 1)];
  };

  return { lang: PLURAL_RULES[lang] ? lang : 'en', t, plural };
}

module.exports = { forLanguage, baseLanguage, EN, TRANSLATIONS };
