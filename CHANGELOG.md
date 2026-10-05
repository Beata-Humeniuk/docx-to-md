# Changelog

This file lists user-visible changes to Word to Markdown. The project follows
[Semantic Versioning](https://semver.org/).

## [0.1.1] - 2026-10-05

### Fixed

- Indentation inside table cells is kept: leading spaces and tabs, the
  paragraph's left indent and the nesting level of lists become
  non-breaking spaces, so a column of hierarchical values reads as in Word.


## [0.1.0] - 2026-10-04

### Added

- **Convert to Markdown** for `.docx`, `.docm`, `.dotx` and `.dotm` files, and
  for old `.doc` and `.rtf` files through Word or LibreOffice.
- Headings with their numbers, list numbering as Word shows it, a rebuilt
  table of contents, bookmarks and cross-references, inline formatting,
  quotes and code blocks.
- Tables as GFM, or HTML where cells are merged or nested.
- Footnotes, endnotes and comments as GFM footnotes; tracked changes as
  final text, original text or markup.
- Images extracted next to the Markdown file.
- English and Polish interface.
