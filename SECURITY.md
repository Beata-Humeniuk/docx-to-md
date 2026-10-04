# Security Policy

## Supported versions

Security fixes are released for the latest published version of the
extension. Older versions are not patched separately — please update to the
newest release.

## Reporting a vulnerability

Please use
[GitHub private vulnerability reporting](https://github.com/Beata-Humeniuk/docx-to-md/security/advisories/new)
so the issue is not public before a fix exists. If that is not possible,
open a regular issue **without** the sensitive details and ask for a private
channel.

## What not to post

Word documents often hold internal or personal information. In any report —
public or private — do **not** attach real documents. A minimal
**synthetic** document with made-up content that reproduces the problem is
all that is needed.

## Scope notes

The extension makes no network requests and sends no telemetry. It reads the
documents you choose and writes the Markdown file and images next to them.
For old `.doc` and `.rtf` files it starts Microsoft Word (through
`cscript.exe`) or LibreOffice (`soffice`) locally, with the document opened
read-only; in Restricted Mode the LibreOffice path from workspace settings is
ignored. Anything contradicting that — a network request, a file written
elsewhere, a program started from an untrusted workspace setting — is a
security bug; please report it.
