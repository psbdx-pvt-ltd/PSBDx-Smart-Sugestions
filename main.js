/**
 * PSBDx Smart Suggestions
 * Author: M. Farhan Hamim (https://psbdx.xyz)
 *
 * What this plugin does
 * ----------------------
 * 1. Registers real Language Servers (via Acode's built-in LSP API) for
 *    JS/TS, HTML, CSS/SCSS/LESS, JSON and Python so Acode gets proper,
 *    context-aware IntelliSense (real symbol/type-aware completions,
 *    hover info, diagnostics) instead of the default keyword/word list
 *    suggestions.
 * 2. Adds a handful of "mini features" as commands (available from the
 *    command palette and, optionally, quick-tools) to speed up everyday
 *    editing: trim trailing whitespace, duplicate line, toggle case,
 *    insert date/time, word & character count, and jump-to-next TODO.
 *
 * No bundler is required to install/run this file as-is (plain browser
 * JS, no `import` statements) but you're free to run it through the
 * official acode-plugin build pipeline if you want to add more assets.
 */

(function () {
  "use strict";

  var PLUGIN_ID = "com.psbdx.smartsuggestions";
  var COMMAND_PREFIX = "psbdx.";
  var registeredCommands = [];
  var registeredLspServerIds = [];

  function say(msg, ms) {
    try {
      if (typeof toast === "function") {
        toast(msg, ms || 2500);
      } else if (window.acode && acode.require) {
        acode.require("toast")(msg, ms || 2500);
      }
    } catch (e) {
      console.log("[PSBDx]", msg);
    }
  }

  // ---------------------------------------------------------------------
  // 1. Smarter suggestions via real Language Servers
  // ---------------------------------------------------------------------
  function registerLspServers() {
    var lsp;
    try {
      lsp = acode.require("lsp");
    } catch (e) {
      console.error("[PSBDx] LSP API not available on this Acode build:", e);
      return;
    }
    if (!lsp) {
      say("PSBDx: LSP API not found. Update Acode to enable smart suggestions.", 4000);
      return;
    }

    var definitions = [
      {
        id: "psbdx-typescript",
        label: "PSBDx JS/TS IntelliSense",
        languages: ["javascript", "javascriptreact", "typescript", "typescriptreact", "jsx", "tsx"],
        useWorkspaceFolders: true,
        command: "typescript-language-server",
        args: ["--stdio"],
        checkCommand: "command -v typescript-language-server",
        installer: lsp.installers.npm({
          executable: "typescript-language-server",
          packages: ["typescript", "typescript-language-server"],
        }),
        initializationOptions: { provideFormatter: true },
      },
      {
        id: "psbdx-html",
        label: "PSBDx HTML IntelliSense",
        languages: ["html"],
        command: "vscode-html-language-server",
        args: ["--stdio"],
        checkCommand: "command -v vscode-html-language-server",
        installer: lsp.installers.npm({
          executable: "vscode-html-language-server",
          packages: ["vscode-langservers-extracted"],
        }),
      },
      {
        id: "psbdx-css",
        label: "PSBDx CSS/SCSS/LESS IntelliSense",
        languages: ["css", "scss", "less"],
        command: "vscode-css-language-server",
        args: ["--stdio"],
        checkCommand: "command -v vscode-css-language-server",
        installer: lsp.installers.npm({
          executable: "vscode-css-language-server",
          packages: ["vscode-langservers-extracted"],
        }),
      },
      {
        id: "psbdx-json",
        label: "PSBDx JSON IntelliSense",
        languages: ["json", "jsonc"],
        command: "vscode-json-language-server",
        args: ["--stdio"],
        checkCommand: "command -v vscode-json-language-server",
        installer: lsp.installers.npm({
          executable: "vscode-json-language-server",
          packages: ["vscode-langservers-extracted"],
        }),
      },
      {
        id: "psbdx-python",
        label: "PSBDx Python IntelliSense",
        languages: ["python"],
        command: "pylsp",
        args: [],
        checkCommand: "command -v pylsp",
        installer: lsp.installers.pip({
          executable: "pylsp",
          packages: ["python-lsp-server[all]"],
        }),
      },
      {
        id: "psbdx-php",
        label: "PSBDx PHP IntelliSense",
        languages: ["php"],
        command: "intelephense",
        args: ["--stdio"],
        checkCommand: "command -v intelephense",
        installer: lsp.installers.npm({
          executable: "intelephense",
          packages: ["intelephense"],
        }),
      },
    ];

    definitions.forEach(function (def) {
      try {
        var server = lsp.defineServer(def);
        lsp.upsert(server);
        registeredLspServerIds.push(def.id);
      } catch (e) {
        console.error("[PSBDx] Failed to register LSP server:", def.id, e);
      }
    });

    say("PSBDx: Smart suggestion servers registered. Install missing servers from Acode's LSP panel if prompted.", 4000);
  }

  function unregisterLspServers() {
    try {
      var lsp = acode.require("lsp");
      if (!lsp) return;
      registeredLspServerIds.forEach(function (id) {
        try {
          lsp.servers.unregister(id);
        } catch (e) {
          /* ignore */
        }
      });
    } catch (e) {
      /* ignore */
    }
    registeredLspServerIds = [];
  }

  // ---------------------------------------------------------------------
  // 2. Mini productivity commands
  // ---------------------------------------------------------------------
  function getView() {
    return window.editorManager && editorManager.editor;
  }

  function addCmd(commands, def) {
    var full = Object.assign({}, def, { name: COMMAND_PREFIX + def.name });
    commands.addCommand(full);
    registeredCommands.push(full.name);
  }

  function registerMiniFeatures() {
    var commands = acode.require("commands");

    addCmd(commands, {
      name: "trimTrailingWhitespace",
      description: "PSBDx: Trim Trailing Whitespace",
      exec: function () {
        var view = getView();
        if (!view) return true;
        var doc = view.state.doc;
        var changes = [];
        for (var i = 1; i <= doc.lines; i++) {
          var line = doc.line(i);
          var trimmed = line.text.replace(/[ \t]+$/, "");
          if (trimmed.length !== line.text.length) {
            changes.push({ from: line.from + trimmed.length, to: line.to, insert: "" });
          }
        }
        if (changes.length) {
          view.dispatch({ changes: changes });
          say("PSBDx: Trimmed trailing whitespace on " + changes.length + " line(s)");
        } else {
          say("PSBDx: No trailing whitespace found");
        }
        return true;
      },
    });

    addCmd(commands, {
      name: "duplicateLine",
      description: "PSBDx: Duplicate Current Line",
      bindKey: { win: "Ctrl-Shift-D", mac: "Command-Shift-D" },
      exec: function () {
        var view = getView();
        if (!view) return true;
        var pos = view.state.selection.main.head;
        var line = view.state.doc.lineAt(pos);
        var offsetInLine = pos - line.from;
        view.dispatch({
          changes: { from: line.to, insert: "\n" + line.text },
          selection: { anchor: line.to + 1 + offsetInLine },
        });
        return true;
      },
    });

    addCmd(commands, {
      name: "toggleCase",
      description: "PSBDx: Toggle Case of Selection",
      exec: function () {
        var view = getView();
        if (!view) return true;
        var sel = view.state.selection.main;
        if (sel.empty) {
          say("PSBDx: Select some text first");
          return true;
        }
        var text = view.state.sliceDoc(sel.from, sel.to);
        var isUpper = text === text.toUpperCase();
        var next = isUpper ? text.toLowerCase() : text.toUpperCase();
        view.dispatch({
          changes: { from: sel.from, to: sel.to, insert: next },
          selection: { anchor: sel.from, head: sel.from + next.length },
        });
        return true;
      },
    });

    addCmd(commands, {
      name: "insertDateTime",
      description: "PSBDx: Insert Date & Time",
      exec: function () {
        var view = getView();
        if (!view) return true;
        var pos = view.state.selection.main.head;
        var str = new Date().toLocaleString();
        view.dispatch({
          changes: { from: pos, insert: str },
          selection: { anchor: pos + str.length },
        });
        return true;
      },
    });

    addCmd(commands, {
      name: "wordCount",
      description: "PSBDx: Word & Character Count",
      exec: function () {
        var view = getView();
        if (!view) return true;
        var sel = view.state.selection.main;
        var text = sel.empty ? view.state.doc.toString() : view.state.sliceDoc(sel.from, sel.to);
        var words = (text.match(/\S+/g) || []).length;
        var chars = text.length;
        var lines = text.split("\n").length;
        say(
          "PSBDx: " + words + " words, " + chars + " chars, " + lines + " lines" +
          (sel.empty ? " (whole file)" : " (selection)"),
          3500
        );
        return true;
      },
    });

    addCmd(commands, {
      name: "wrapConsoleLog",
      description: "PSBDx: Wrap Selection in console.log()",
      exec: function () {
        var view = getView();
        if (!view) return true;
        var sel = view.state.selection.main;
        var text = sel.empty ? "" : view.state.sliceDoc(sel.from, sel.to);
        var insertText = "console.log(" + text + ");";
        view.dispatch({ changes: { from: sel.from, to: sel.to, insert: insertText } });
        return true;
      },
    });

    addCmd(commands, {
      name: "jumpToTodo",
      description: "PSBDx: Jump to Next TODO / FIXME",
      exec: function () {
        var view = getView();
        if (!view) return true;
        var text = view.state.doc.toString();
        var re = /\b(TODO|FIXME)\b/g;
        var matches = [];
        var m;
        while ((m = re.exec(text))) matches.push(m.index);
        if (!matches.length) {
          say("PSBDx: No TODO/FIXME found in this file");
          return true;
        }
        var pos = view.state.selection.main.head;
        var target = matches.filter(function (i) { return i > pos; })[0];
        if (target === undefined) target = matches[0];
        view.dispatch({ selection: { anchor: target }, scrollIntoView: true });
        say("PSBDx: " + matches.length + " TODO/FIXME found in this file");
        return true;
      },
    });
  }

  function unregisterMiniFeatures() {
    try {
      var commands = acode.require("commands");
      registeredCommands.forEach(function (name) {
        try {
          commands.removeCommand(name);
        } catch (e) {
          /* ignore */
        }
      });
    } catch (e) {
      /* ignore */
    }
    registeredCommands = [];
  }

  // ---------------------------------------------------------------------
  // Plugin lifecycle
  // ---------------------------------------------------------------------
  if (window.acode) {
    acode.setPluginInit(PLUGIN_ID, function (baseUrl, $page, cache) {
      if (!(window.editorManager && editorManager.isCodeMirror)) {
        say("PSBDx: this Acode build doesn't use the CodeMirror engine yet — update Acode for full smart-suggestion support.", 4500);
      }
      registerLspServers();
      registerMiniFeatures();
    });

    acode.setPluginUnmount(PLUGIN_ID, function () {
      unregisterLspServers();
      unregisterMiniFeatures();
    });
  }
})();
