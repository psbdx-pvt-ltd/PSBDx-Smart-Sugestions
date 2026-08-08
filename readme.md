# PSBDx Smart Suggestions

Better code suggestions for Acode, plus a few handy mini-tools.
Author: **M. Farhan Hamim** — https://psbdx.xyz

## Why

Acode's default autocomplete is basically a keyword/word list. This plugin
plugs into Acode's built-in **LSP (Language Server Protocol)** engine and
registers real language servers, so you get actual type-aware / symbol-aware
completions, hover docs, and diagnostics — the same technology VS Code uses —
for:

- JavaScript / JSX / TypeScript / TSX (`typescript-language-server`)
- HTML (`vscode-html-language-server`)
- CSS / SCSS / LESS (`vscode-css-language-server`)
- JSON (`vscode-json-language-server`)
- Python (`pylsp`)
- PHP (`intelephense`)

The first time you open a matching file, Acode will show an install/enable
prompt for that language server (or you can install it yourself from Acode's
**LSP Servers** panel in Settings). Servers run through Acode's built-in
runtime (Alpine/AXS or Termux, depending on your setup) — no extra
configuration needed beyond confirming the install.

## Mini features

Available from the command palette (search icon / `Ctrl+Shift+P` style
palette):

| Command | What it does |
|---|---|
| **PSBDx: Trim Trailing Whitespace** | Strips trailing spaces/tabs on every line |
| **PSBDx: Duplicate Current Line** | Duplicates the line under the cursor (`Ctrl+Shift+D`) |
| **PSBDx: Toggle Case of Selection** | Flips selected text between UPPER and lower case |
| **PSBDx: Insert Date & Time** | Inserts the current date/time at the cursor |
| **PSBDx: Word & Character Count** | Toast with word/char/line counts (selection or whole file) |
| **PSBDx: Wrap Selection in console.log()** | Quickly wraps the selection for a debug print |
| **PSBDx: Jump to Next TODO / FIXME** | Cycles the cursor to the next `TODO`/`FIXME` in the file |

## Installing this plugin

1. Zip the plugin folder contents (`plugin.json`, `main.js`, `readme.md`,
   `icon.png`, `changelogs.md`) — **the files must be at the root of the
   zip, not inside a subfolder**.
2. In Acode: **Settings → Plugins → Install from device (or "..." menu)**
   and pick the zip. (Or, if you're publishing it, upload the zip to the
   Acode plugin store from https://acode.app.)
3. Open a JS/TS/HTML/CSS/JSON/Python/PHP file and start typing — Acode will
   prompt you to enable/install the matching language server the first time.

## Requirements

- A recent Acode build using the **CodeMirror 6** engine (the plugin checks
  `editorManager.isCodeMirror` and will warn you if you're on an older
  Ace-based build; the mini commands and LSP registration are written for
  the current CodeMirror-based editor API).
- For the language servers themselves: Acode's built-in runtime needs to be
  able to install npm/pip packages (built-in Alpine environment, or Termux
  if that's how your device is set up). This is the same mechanism Acode
  uses for any other LSP-powered plugin.

## Notes for developers

`minVersionCode` in `plugin.json` is set to `1002`. If Acode reports your
version as incompatible, lower that number to match your installed Acode
version code (Settings → About), or remove servers you don't need.

## License

MIT
