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

    autoInstallAll(lsp, { silent: true });
    watchForAutoInstall(lsp);

    say("PSBDx: Smart suggestion servers registered. Installing in background where possible.", 4000);
  }

  // Best-effort auto-install. Acode's public plugin API does not (yet)
  // document one universal "install now" call for structured-installer
  // LSP servers, so this tries several known trigger shapes defensively
  // and always makes sure each server is `enabled`, which is what makes
  // Acode install/prompt automatically the moment a matching file opens
  // (no digging through Settings needed).
  function attemptAutoInstall(lsp, id) {
    try {
      if (lsp.servers && typeof lsp.servers.update === "function") {
        lsp.servers.update(id, function (current) {
          return Object.assign({}, current, { enabled: true });
        });
      }
    } catch (e) {
      /* ignore */
    }

    var server = null;
    try {
      server = lsp.servers && lsp.servers.get && lsp.servers.get(id);
    } catch (e) {
      /* ignore */
    }

    var triggers = [
      function () { return typeof lsp.installServer === "function" && lsp.installServer(id); },
      function () { return lsp.servers && typeof lsp.servers.install === "function" && lsp.servers.install(id); },
      function () { return server && typeof server.install === "function" && server.install(); },
      function () { return lsp.clientManager && typeof lsp.clientManager.install === "function" && lsp.clientManager.install(id); },
    ];

    for (var i = 0; i < triggers.length; i++) {
      try {
        if (triggers[i]()) return true;
      } catch (e) {
        /* try next shape */
      }
    }
    return false;
  }

  function autoInstallAll(lsp, opts) {
    var results = { attempted: 0, triggered: 0 };
    registeredLspServerIds.forEach(function (id) {
      results.attempted++;
      if (attemptAutoInstall(lsp, id)) results.triggered++;
    });
    if (!(opts && opts.silent)) {
      say(
        "PSBDx: tried auto-install on " + results.attempted + " server(s)" +
        (results.triggered ? (", " + results.triggered + " triggered directly") : "") +
        ". Still-missing servers will prompt when you open a matching file.",
        4500
      );
    }
    return results;
  }

  // Opening a matching file is the one guaranteed automatic install path
  // Acode exposes today, so we hook into it as a fallback on top of the
  // best-effort direct triggers above.
  function watchForAutoInstall(lsp) {
    if (!(window.editorManager && editorManager.on)) return;
    editorManager.on("switch-file", function () {
      registeredLspServerIds.forEach(function (id) {
        attemptAutoInstall(lsp, id);
      });
    });
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
  // 2. Plain-text \u2192 code (type a description, get real code)
  // ---------------------------------------------------------------------
  var EXT_LANG_MAP = {
    js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
    ts: "typescript", tsx: "typescript",
    py: "python",
    java: "java",
    c: "c", h: "c",
    cpp: "cpp", cc: "cpp", cxx: "cpp", hpp: "cpp",
    html: "html", htm: "html",
    css: "css", scss: "css", less: "css",
    php: "php",
  };

  function detectLanguage() {
    try {
      var file = window.editorManager && editorManager.activeFile;
      var name = (file && (file.filename || file.name)) || "";
      var ext = (name.split(".").pop() || "").toLowerCase();
      return EXT_LANG_MAP[ext] || "javascript";
    } catch (e) {
      return "javascript";
    }
  }

  function extractName(text, fallback) {
    var m = text.match(/(?:call(?:ed)?|named)\s+([a-zA-Z_$][\w$]*)/i);
    return m ? m[1] : fallback;
  }

  // Each template function receives (text, name) and returns a code string.
  // Languages not defined for a given intent fall back to a plain comment.
  var TEMPLATES = {
    helloWorld: {
      javascript: function () { return 'console.log("Hello, World!");'; },
      typescript: function () { return 'console.log("Hello, World!");'; },
      python: function () { return 'print("Hello, World!")'; },
      java: function () { return 'System.out.println("Hello, World!");'; },
      c: function () { return '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}'; },
      cpp: function () { return '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}'; },
      php: function () { return '<?php\necho "Hello, World!";'; },
      html: function () { return '<!doctype html>\n<html>\n<head><title>Hello</title></head>\n<body>Hello, World!</body>\n</html>'; },
    },
    forLoop: {
      javascript: function () { return 'for (let i = 0; i < 10; i++) {\n    console.log(i);\n}'; },
      typescript: function () { return 'for (let i = 0; i < 10; i++) {\n    console.log(i);\n}'; },
      python: function () { return 'for i in range(10):\n    print(i)'; },
      java: function () { return 'for (int i = 0; i < 10; i++) {\n    System.out.println(i);\n}'; },
      c: function () { return 'for (int i = 0; i < 10; i++) {\n    printf("%d\\n", i);\n}'; },
      cpp: function () { return 'for (int i = 0; i < 10; i++) {\n    std::cout << i << std::endl;\n}'; },
      php: function () { return 'for ($i = 0; $i < 10; $i++) {\n    echo $i . PHP_EOL;\n}'; },
    },
    whileLoop: {
      javascript: function () { return 'let i = 0;\nwhile (i < 10) {\n    console.log(i);\n    i++;\n}'; },
      typescript: function () { return 'let i = 0;\nwhile (i < 10) {\n    console.log(i);\n    i++;\n}'; },
      python: function () { return 'i = 0\nwhile i < 10:\n    print(i)\n    i += 1'; },
      java: function () { return 'int i = 0;\nwhile (i < 10) {\n    System.out.println(i);\n    i++;\n}'; },
      c: function () { return 'int i = 0;\nwhile (i < 10) {\n    printf("%d\\n", i);\n    i++;\n}'; },
      cpp: function () { return 'int i = 0;\nwhile (i < 10) {\n    std::cout << i << std::endl;\n    i++;\n}'; },
      php: function () { return '$i = 0;\nwhile ($i < 10) {\n    echo $i . PHP_EOL;\n    $i++;\n}'; },
    },
    arrowFunction: {
      javascript: function (t, n) { return 'const ' + n + ' = (' + guessParams(t) + ') => {\n    \n};'; },
      typescript: function (t, n) { return 'const ' + n + ' = (' + guessParams(t) + '): void => {\n    \n};'; },
    },
    func: {
      javascript: function (t, n) { return 'function ' + n + '(' + guessParams(t) + ') {\n    \n}'; },
      typescript: function (t, n) { return 'function ' + n + '(' + guessParams(t) + '): void {\n    \n}'; },
      python: function (t, n) { return 'def ' + n + '(' + guessParams(t) + '):\n    pass'; },
      java: function (t, n) { return 'public void ' + n + '(' + guessParams(t) + ') {\n    \n}'; },
      c: function (t, n) { return 'void ' + n + '(' + guessParams(t) + ') {\n    \n}'; },
      cpp: function (t, n) { return 'void ' + n + '(' + guessParams(t) + ') {\n    \n}'; },
      php: function (t, n) { return 'function ' + n + '(' + guessParams(t) + ') {\n    \n}'; },
    },
    ifElse: {
      javascript: function () { return 'if (condition) {\n    \n} else {\n    \n}'; },
      typescript: function () { return 'if (condition) {\n    \n} else {\n    \n}'; },
      python: function () { return 'if condition:\n    pass\nelse:\n    pass'; },
      java: function () { return 'if (condition) {\n    \n} else {\n    \n}'; },
      c: function () { return 'if (condition) {\n    \n} else {\n    \n}'; },
      cpp: function () { return 'if (condition) {\n    \n} else {\n    \n}'; },
      php: function () { return 'if ($condition) {\n    \n} else {\n    \n}'; },
    },
    tryCatch: {
      javascript: function () { return 'try {\n    \n} catch (error) {\n    console.error(error);\n}'; },
      typescript: function () { return 'try {\n    \n} catch (error) {\n    console.error(error);\n}'; },
      python: function () { return 'try:\n    pass\nexcept Exception as e:\n    print(e)'; },
      java: function () { return 'try {\n    \n} catch (Exception e) {\n    e.printStackTrace();\n}'; },
      cpp: function () { return 'try {\n    \n} catch (const std::exception& e) {\n    std::cerr << e.what() << std::endl;\n}'; },
      php: function () { return 'try {\n    \n} catch (Exception $e) {\n    echo $e->getMessage();\n}'; },
    },
    classDef: {
      javascript: function (t, n) { return 'class ' + n + ' {\n    constructor() {\n        \n    }\n}'; },
      typescript: function (t, n) { return 'class ' + n + ' {\n    constructor() {\n        \n    }\n}'; },
      python: function (t, n) { return 'class ' + n + ':\n    def __init__(self):\n        pass'; },
      java: function (t, n) { return 'public class ' + n + ' {\n    public ' + n + '() {\n        \n    }\n}'; },
      cpp: function (t, n) { return 'class ' + n + ' {\npublic:\n    ' + n + '() {\n        \n    }\n};'; },
      php: function (t, n) { return 'class ' + n + ' {\n    public function __construct() {\n        \n    }\n}'; },
    },
    readFile: {
      javascript: function () { return "const fs = require('fs');\nconst data = fs.readFileSync('file.txt', 'utf8');\nconsole.log(data);"; },
      typescript: function () { return "import fs from 'fs';\nconst data = fs.readFileSync('file.txt', 'utf8');\nconsole.log(data);"; },
      python: function () { return "with open('file.txt', 'r') as f:\n    data = f.read()\n    print(data)"; },
      java: function () { return 'String content = new String(Files.readAllBytes(Paths.get("file.txt")));\nSystem.out.println(content);'; },
      php: function () { return '$data = file_get_contents("file.txt");\necho $data;'; },
    },
    httpRequest: {
      javascript: function () { return "fetch('https://api.example.com/data')\n    .then(res => res.json())\n    .then(data => console.log(data))\n    .catch(err => console.error(err));"; },
      typescript: function () { return "fetch('https://api.example.com/data')\n    .then((res) => res.json())\n    .then((data) => console.log(data))\n    .catch((err) => console.error(err));"; },
      python: function () { return "import requests\n\nresponse = requests.get('https://api.example.com/data')\nprint(response.json())"; },
      java: function () { return 'HttpClient client = HttpClient.newHttpClient();\nHttpRequest request = HttpRequest.newBuilder()\n    .uri(URI.create("https://api.example.com/data"))\n    .build();\nHttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());\nSystem.out.println(response.body());'; },
      php: function () { return '$response = file_get_contents("https://api.example.com/data");\necho $response;'; },
    },
    sortArray: {
      javascript: function () { return 'const sorted = [...arr].sort((a, b) => a - b);'; },
      typescript: function () { return 'const sorted = [...arr].sort((a, b) => a - b);'; },
      python: function () { return 'sorted_list = sorted(arr)'; },
      java: function () { return 'Arrays.sort(arr);'; },
      cpp: function () { return 'std::sort(arr.begin(), arr.end());'; },
      php: function () { return 'sort($arr);'; },
    },
    reverseString: {
      javascript: function () { return 'const reversed = str.split("").reverse().join("");'; },
      typescript: function () { return 'const reversed = str.split("").reverse().join("");'; },
      python: function () { return 'reversed_str = s[::-1]'; },
      java: function () { return 'String reversed = new StringBuilder(s).reverse().toString();'; },
      cpp: function () { return 'std::reverse(s.begin(), s.end());'; },
      php: function () { return '$reversed = strrev($s);'; },
    },
    sumArray: {
      javascript: function () { return 'const sum = arr.reduce((total, n) => total + n, 0);'; },
      typescript: function () { return 'const sum = arr.reduce((total, n) => total + n, 0);'; },
      python: function () { return 'total = sum(arr)'; },
      java: function () { return 'int sum = Arrays.stream(arr).sum();'; },
      cpp: function () { return 'int sum = std::accumulate(arr.begin(), arr.end(), 0);'; },
      php: function () { return '$sum = array_sum($arr);'; },
    },
    fibonacci: {
      javascript: function () { return 'function fibonacci(n) {\n    if (n <= 1) return n;\n    return fibonacci(n - 1) + fibonacci(n - 2);\n}'; },
      typescript: function () { return 'function fibonacci(n: number): number {\n    if (n <= 1) return n;\n    return fibonacci(n - 1) + fibonacci(n - 2);\n}'; },
      python: function () { return 'def fibonacci(n):\n    if n <= 1:\n        return n\n    return fibonacci(n - 1) + fibonacci(n - 2)'; },
      java: function () { return 'static int fibonacci(int n) {\n    if (n <= 1) return n;\n    return fibonacci(n - 1) + fibonacci(n - 2);\n}'; },
      cpp: function () { return 'int fibonacci(int n) {\n    if (n <= 1) return n;\n    return fibonacci(n - 1) + fibonacci(n - 2);\n}'; },
    },
    swap: {
      javascript: function () { return '[a, b] = [b, a];'; },
      typescript: function () { return '[a, b] = [b, a];'; },
      python: function () { return 'a, b = b, a'; },
      java: function () { return 'int temp = a;\na = b;\nb = temp;'; },
      c: function () { return 'int temp = a;\na = b;\nb = temp;'; },
      cpp: function () { return 'std::swap(a, b);'; },
      php: function () { return '[$a, $b] = [$b, $a];'; },
    },
    randomNumber: {
      javascript: function () { return 'const randomNum = Math.floor(Math.random() * 100);'; },
      typescript: function () { return 'const randomNum = Math.floor(Math.random() * 100);'; },
      python: function () { return 'import random\nrandom_num = random.randint(0, 100)'; },
      java: function () { return 'int randomNum = new Random().nextInt(100);'; },
      c: function () { return 'int randomNum = rand() % 100;'; },
      cpp: function () { return 'int randomNum = rand() % 100;'; },
      php: function () { return '$randomNum = rand(0, 100);'; },
    },
    currentDate: {
      javascript: function () { return 'const now = new Date();\nconsole.log(now.toLocaleString());'; },
      typescript: function () { return 'const now: Date = new Date();\nconsole.log(now.toLocaleString());'; },
      python: function () { return 'from datetime import datetime\nnow = datetime.now()\nprint(now)'; },
      java: function () { return 'LocalDateTime now = LocalDateTime.now();\nSystem.out.println(now);'; },
      php: function () { return 'echo date("Y-m-d H:i:s");'; },
    },
    mainFunction: {
      python: function () { return 'def main():\n    pass\n\n\nif __name__ == "__main__":\n    main()'; },
      java: function (t, n) { return 'public class Main {\n    public static void main(String[] args) {\n        \n    }\n}'; },
      c: function () { return 'int main() {\n    \n    return 0;\n}'; },
      cpp: function () { return 'int main() {\n    \n    return 0;\n}'; },
    },
    arrayInit: {
      javascript: function () { return 'const arr = [1, 2, 3, 4, 5];'; },
      typescript: function () { return 'const arr: number[] = [1, 2, 3, 4, 5];'; },
      python: function () { return 'arr = [1, 2, 3, 4, 5]'; },
      java: function () { return 'int[] arr = {1, 2, 3, 4, 5};'; },
      c: function () { return 'int arr[] = {1, 2, 3, 4, 5};'; },
      cpp: function () { return 'std::vector<int> arr = {1, 2, 3, 4, 5};'; },
      php: function () { return '$arr = [1, 2, 3, 4, 5];'; },
    },
    dictInit: {
      javascript: function () { return 'const obj = {\n    key: "value",\n};'; },
      typescript: function () { return 'const obj: Record<string, string> = {\n    key: "value",\n};'; },
      python: function () { return 'd = {"key": "value"}'; },
      java: function () { return 'Map<String, String> map = new HashMap<>();\nmap.put("key", "value");'; },
      cpp: function () { return 'std::map<std::string, std::string> m;\nm["key"] = "value";'; },
      php: function () { return '$map = ["key" => "value"];'; },
    },
    importStatement: {
      javascript: function () { return "import { something } from './module.js';"; },
      typescript: function () { return "import { something } from './module';"; },
      python: function () { return 'import module_name'; },
      java: function () { return 'import java.util.List;'; },
      cpp: function () { return '#include <iostream>'; },
      php: function () { return "require_once 'file.php';"; },
    },
    htmlBoilerplate: {
      html: function () { return '<!doctype html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Document</title>\n</head>\n<body>\n    \n</body>\n</html>'; },
    },
    cssFlexCenter: {
      css: function () { return '.container {\n    display: flex;\n    align-items: center;\n    justify-content: center;\n}'; },
    },
  };

  function guessParams(text) {
    var m = text.match(/with\s+params?\s+([a-zA-Z0-9_,\s]+)/i);
    if (m) return m[1].split(",").map(function (p) { return p.trim(); }).filter(Boolean).join(", ");
    return "";
  }

  var PHRASE_PATTERNS = [
    { intent: "helloWorld", test: /hello\s*,?\s*world/i },
    { intent: "arrowFunction", test: /\barrow\s*function\b/i },
    { intent: "whileLoop", test: /\bwhile\s*loop\b/i },
    { intent: "forLoop", test: /\bfor\s*loop\b|\biterate\b|\bloop\s+\d+\s+times\b/i },
    { intent: "tryCatch", test: /\btry\s*catch\b|\berror\s*handling\b/i },
    { intent: "ifElse", test: /\bif\s*else\b|\bconditional\b/i },
    { intent: "mainFunction", test: /\bmain\s*function\b|\bentry\s*point\b/i },
    { intent: "htmlBoilerplate", test: /\bhtml\s*(boilerplate|template|page|skeleton)\b/i },
    { intent: "cssFlexCenter", test: /\bflex(box)?\s*center\b|\bcenter\b.*\bflex\b/i },
    { intent: "fibonacci", test: /\bfibonacci\b/i },
    { intent: "swap", test: /\bswap\b/i },
    { intent: "randomNumber", test: /\brandom\s*number\b/i },
    { intent: "currentDate", test: /\bcurrent\s*date\b|\btoday'?s?\s*date\b|\bnow\b/i },
    { intent: "reverseString", test: /\breverse\b.*\bstring\b/i },
    { intent: "sortArray", test: /\bsort\b.*\b(array|list)\b/i },
    { intent: "sumArray", test: /\bsum\b.*\b(array|list)\b|\btotal\b.*\b(array|list)\b/i },
    { intent: "readFile", test: /\bread\s*file\b|\bopen\s*file\b/i },
    { intent: "httpRequest", test: /\bfetch\b|\bhttp\s*request\b|\bapi\s*call\b/i },
    { intent: "dictInit", test: /\bdictionary\b|\bhash\s*map\b|\bmap\b|\bobject\b/i },
    { intent: "classDef", test: /\bclass\b/i },
    { intent: "func", test: /\bfunction\b/i },
    { intent: "arrayInit", test: /\barray\b|\blist\b/i },
    { intent: "importStatement", test: /\bimport\b/i },
  ];

  function expandPhraseToCode(text, lang) {
    var normalized = text.toLowerCase();
    for (var i = 0; i < PHRASE_PATTERNS.length; i++) {
      var pattern = PHRASE_PATTERNS[i];
      if (pattern.test.test(normalized)) {
        var templateSet = TEMPLATES[pattern.intent];
        var build = templateSet && (templateSet[lang] || (lang === "typescript" && templateSet.javascript) || (lang === "cpp" && templateSet.c));
        if (!build) return null;
        var name = extractName(text, "myFunction");
        return build(text, name);
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // 3. Mini productivity commands
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
      name: "installAllServers",
      description: "PSBDx: Install All Suggestion Servers",
      exec: function () {
        try {
          var lsp = acode.require("lsp");
          if (!lsp) {
            say("PSBDx: LSP API not available on this Acode build");
            return true;
          }
          autoInstallAll(lsp, { silent: false });
        } catch (e) {
          say("PSBDx: couldn't reach the LSP API — try Settings → LSP Servers instead");
        }
        return true;
      },
    });

    addCmd(commands, {
      name: "textToCode",
      description: "PSBDx: Smart Text \u2192 Code (expand current line)",
      bindKey: { win: "Ctrl-Enter", mac: "Command-Enter" },
      exec: function () {
        var view = getView();
        if (!view) return true;
        var pos = view.state.selection.main.head;
        var line = view.state.doc.lineAt(pos);
        var raw = line.text.trim();
        if (!raw) {
          say('PSBDx: type a plain description first, e.g. "for loop" or "fetch api", then run this command');
          return true;
        }
        var lang = detectLanguage();
        var snippet = expandPhraseToCode(raw, lang);
        if (!snippet) {
          say('PSBDx: no match for "' + raw + '". Try: hello world, for loop, while loop, function, arrow function, class, if else, try catch, fetch api, read file, sort array, reverse string, sum array, fibonacci, swap, random number, current date, main function, dictionary, import, html boilerplate, flex center', 5000);
          return true;
        }
        var indent = (line.text.match(/^[ \t]*/) || [""])[0];
        var body = snippet.split("\n").map(function (l, i) {
          return i === 0 ? l : indent + l;
        }).join("\n");
        var insertText = indent + body;
        view.dispatch({
          changes: { from: line.from, to: line.to, insert: insertText },
          selection: { anchor: line.from + insertText.length },
        });
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
