# Changelog

## 1.1.0
- Redesigned README with banner, badges and a proper feature breakdown.
- Added best-effort auto-install for all registered LSP servers (background attempt on load + on file switch), plus a manual "PSBDx: Install All Suggestion Servers" command.
- Added "PSBDx: Smart Text → Code" — type a plain-English description on a line and expand it into real, language-aware code with `Ctrl+Enter`.
- Added `repository` field pointing to https://github.com/psbdx-pvt-ltd/PSBDx-Smart-Sugestions.

## 1.0.0
- Initial release.
- Registers LSP servers for JS/TS/JSX/TSX, HTML, CSS/SCSS/LESS, JSON, Python and PHP for smarter, IntelliSense-style code suggestions.
- Adds mini commands: trim trailing whitespace, duplicate line, toggle case, insert date/time, word & character count, wrap in console.log, jump to next TODO/FIXME.
