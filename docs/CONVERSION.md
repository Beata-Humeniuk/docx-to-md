# Conversion

## Lists

| Word label | Markdown |
|---|---|
| `1.` `1)` | Ordered list |
| Bullet | `-` list |
| `a)` `(iv)` `IV.` `1.2.3.` `§ 5.` | Label kept as text |

Nesting follows the indentation shown in Word.

## Table of contents

The table of contents is rebuilt from the headings as a list of links. The
`\o` range of the field sets the heading levels. Page numbers are removed.

A table of figures keeps its entries and links them to the captions.

## Links and bookmarks

| Word | Markdown |
|---|---|
| Hyperlink | `[text](url)` |
| Bookmark | `<a id="name"></a>` |
| Bookmark on a heading | Heading anchor |
| Cross-reference | `[text](#anchor)` |

Heading anchors match the VS Code preview and GitHub.

## Tables

| `docxToMd.tables` | Result |
|---|---|
| `auto` | GFM; HTML for merged or nested cells |
| `gfm` | Always GFM; merged cells become empty |
| `html` | Always HTML |

## Notes and changes

- Footnotes and endnotes: `[^1]`
- Comments: `[^c1]` with the author
- Tracked changes: final text, original text, or `<ins>`/`<del>`

## Images

Images are saved in the images folder and linked with their alt text.
EMF and WMF images are saved but most Markdown previews cannot show them.

## Not converted

Charts, SmartArt, headers, footers, hidden text and page breaks.

## `.doc` and `.rtf`

1. Microsoft Word on Windows, through `cscript`.
2. LibreOffice, from `docxToMd.libreOfficePath`, the default install location
   or `PATH`.

The format is detected from the file content.
