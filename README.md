# Word to Markdown

Converts Word documents (`.docx`, `.doc`, `.rtf`) to Markdown in VS Code.

## Usage

Right-click a Word file in the Explorer and choose **Convert to Markdown**, or
run **Word to Markdown: Convert to Markdown** from the Command Palette.

The result is saved as `<name>.md` next to the document. Images go to
`<name>_images/`.

## What is kept

- Headings and their numbering
- Numbered and bulleted lists, including labels such as `a)`, `1.2.3.` or `§ 5.`
- Table of contents, as links to headings
- Bookmarks, cross-references and hyperlinks
- Bold, italic, strikethrough, underline, highlight, superscript, subscript, code
- Tables, including merged cells
- Footnotes, endnotes and comments
- Tracked changes
- Images

Charts and SmartArt are not converted. Details: [docs/CONVERSION.md](docs/CONVERSION.md).

## `.doc` and `.rtf`

These formats are first converted to `.docx` with Microsoft Word (Windows) or
LibreOffice. One of them must be installed.

## Settings

| Setting | Default | Description |
|---|---|---|
| `docxToMd.tables` | `auto` | `auto`, `gfm` or `html` |
| `docxToMd.trackedChanges` | `accept` | `accept`, `reject` or `markup` |
| `docxToMd.comments` | `footnotes` | `footnotes` or `omit` |
| `docxToMd.imagesFolder` | `{name}_images` | Image folder next to the Markdown file |
| `docxToMd.openAfterConversion` | `editor` | `editor`, `preview` or `none` |
| `docxToMd.libreOfficePath` | *(empty)* | Path to `soffice` |

## Development

```bash
npm install
npm test
npm run package
```
