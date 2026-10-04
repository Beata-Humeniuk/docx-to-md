# Conversion details

This guide explains how Word constructs map to Markdown and where Markdown
sets the limits.

## Numbering

Numbering is replayed the way Word computes it: a list continues across
interruptions, restarts where the document restarts it, and legal numbering
turns Roman parent levels into digits (`II.` → `2.1`).

Markdown only knows the labels `1.` and `1)`, so only those become ordered
lists. Every other label — `a)`, `(iv)`, `IV.`, `1.2.3.`, `§ 5.`, `Chapter 3` —
is written as text at the start of the paragraph, exactly as Word shows it,
so no number is lost or changed to `1.`.

Lists nest by the indent you see in Word, not by the list level stored in the
file. Word's "List Number 2" is a separate list on level 0, yet it is shown
indented under "List Number", and the Markdown follows what you see.

Numbered headings keep their number in the heading text.

## Table of contents

A table of contents field is rebuilt from the document's headings as a list
of links, limited to the levels the field names (`\o "1-3"`). The result
stored in the file is skipped: it may be out of date and it carries page
numbers, which mean nothing in Markdown. The heading anchors are the ones the
VS Code Markdown preview and GitHub use (`## 1.2 Scope` → `#12-scope`), so
the links work in both.

A table of figures or tables keeps the entries Word wrote, without page
numbers; each entry links to its caption.

Lines styled as table of contents entries without a field are replaced by one
rebuilt table of contents.

## Bookmarks and cross-references

- A bookmark on a heading becomes that heading's anchor.
- Other bookmarks become `<a id="name"></a>`. Word's hidden bookmarks
  (`_Toc…`, `_Ref…`) get one only when something links to them.
- Cross-references (`REF` fields) and internal links become `[text](#anchor)`.
- Page references and page numbers are dropped.

## Tables

With `docxToMd.tables` set to `auto`, tables become GFM tables, with the
first row as the header. Paragraphs within a cell are joined with `<br>`.

A table with merged cells, or with a table inside a cell, becomes an HTML table
with `colspan` and `rowspan`, because GFM cannot express either. Markdown is
not processed inside HTML, so formatting there is written as tags and a
footnote reference as `<sup>1</sup>`.

Tables whose cells are all empty are omitted.

## Notes, comments and tracked changes

Footnotes and endnotes become GFM footnotes numbered in order of appearance.
Comments become footnotes labelled `c1`, `c2`… and start with the author's
name; `docxToMd.comments: omit` leaves them out.

Tracked changes follow `docxToMd.trackedChanges`: the text after accepting
all changes, the text before them, or both, marked with `<ins>` and `<del>`.

## Images

Embedded images are saved to the images folder under their names in the
document and linked with Word's alt text. Linked (external) images keep their
address. Images in old VML markup and the previews of embedded objects are
included too.

EMF and WMF images are saved, but Markdown previews cannot display them; the
extension says so after the conversion.

## Left out

- Charts and SmartArt graphics (counted in a message after the conversion).
- Hidden text, page headers and footers, page and section breaks.
- Equations are kept as plain text.

## Old `.doc` files

The binary Word 97–2003 format cannot be read reliably without Word, so a
`.doc` (or `.rtf`) file is first converted to `.docx` by a program that reads
it, then converted like any `.docx`:

1. **Microsoft Word** on Windows, run in the background through Windows
   Script Host (`cscript`, JScript) with the document opened read-only. A
   Word instance that already had documents open is left running.
2. **LibreOffice** (`soffice --headless`) with a separate profile, so an open
   LibreOffice is not disturbed. It is looked up in
   `docxToMd.libreOfficePath`, the standard install locations, and `PATH`.

If neither is available, the message says what to do; you can also open the
file in Word and save it as `.docx`.

The format is detected from the file's content, not its extension: a `.doc`
that is really a `.docx` goes straight to the converter.
