# Word to Markdown

Convert Word documents to Markdown in VS Code — keeping the structure of the
document, not just its text: headings, list numbering exactly as Word shows
it, the table of contents, bookmarks and cross-references, tables with merged
cells, footnotes, comments, tracked changes and images.

**Works offline.** The extension makes no network requests and sends no
telemetry. `.docx` files are read by the extension itself; old `.doc` files are
opened by Word or LibreOffice on your computer.

## Convert a document

- In the Explorer, right-click a `.docx`, `.doc` or `.rtf` file (or several)
  and choose **Convert to Markdown**.
- Or run **Word to Markdown: Convert to Markdown** from the Command Palette
  and pick the files.

`<name>.md` is written next to the document, and its images go to
`<name>_images/`. If the Markdown file already exists, the extension asks
before overwriting it.

A document with headings first shows its outline as a list of checkboxes:
uncheck the sections you do not want in the Markdown. A section goes
together with its subsections; the table of contents, footnotes and images
follow what was kept. `docxToMd.chooseSections` turns the list off.

## What is kept

| In Word | In Markdown |
|---|---|
| Headings (Heading 1–9, outline levels, Title) | `#` … `######`, with their numbers (`# 1. Introduction`, `## 1.2 Scope`) |
| Numbered lists `1.` / `1)` | ordered lists starting at the same number |
| Other numbering: `a)`, `(iv)`, `IV.`, `1.2.3.`, `§ 5.` | the label exactly as Word shows it |
| Bulleted and multi-level lists | nested `-` lists, following the indent you see in Word |
| Table of contents | rebuilt as links to the headings |
| Bookmarks, cross-references, internal links | anchors and `[text](#anchor)` links |
| Bold, italic, strikethrough | `**…**`, `*…*`, `~~…~~` |
| Underline, highlight, superscript, subscript | `<u>`, `<mark>`, `<sup>`, `<sub>` |
| Monospaced text, code styles, quotes | `` `code` ``, fenced code blocks, `> quotes` |
| Tables | GFM tables; HTML tables where cells are merged or nested |
| Footnotes, endnotes, comments | GFM footnotes (`[^1]`, comments as `[^c1]` with the author) |
| Tracked changes | final text, original text, or both marked up |
| Images | files in `<name>_images/`, linked with Word's alt text |

Charts and SmartArt graphics have no Markdown equivalent; the extension tells
you how many were left out. See [Conversion details](docs/CONVERSION.md) for
the full list, the table of contents, tables and old `.doc` files.

## Settings

| Setting | Default | Purpose |
|---|---|---|
| `docxToMd.tables` | `auto` | `auto` uses GFM tables and HTML only for merged or nested cells; `gfm` or `html` forces one format. |
| `docxToMd.trackedChanges` | `accept` | `accept` keeps the final text, `reject` the original, `markup` both with `<ins>`/`<del>`. |
| `docxToMd.comments` | `footnotes` | Comments as footnotes with the author, or `omit`. |
| `docxToMd.chooseSections` | `true` | Show the outline as checkboxes before converting. |
| `docxToMd.imagesFolder` | `{name}_images` | Image folder next to the Markdown file; `{name}` is the document name. |
| `docxToMd.openAfterConversion` | `editor` | After converting one document: `editor`, `preview` or `none`. |
| `docxToMd.libreOfficePath` | *(empty)* | Path to LibreOffice's `soffice`, used for `.doc` files when Word is not available. |

The interface follows the editor's language (English and Polish).
Restricted Mode is supported; there the LibreOffice path from workspace
settings is ignored.
