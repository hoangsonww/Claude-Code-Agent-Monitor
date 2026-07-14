/**
 * @file highlight.ts
 * @description Lightweight, dependency-free syntax highlighter used by the conversation
 * viewer. Tokenizes a string of source code into a flat list of {type, text} tokens for
 * a handful of languages commonly seen in Claude Code transcripts (js/ts, python, json,
 * bash, html, css, sql, yaml, diff). Output is consumed by CodeBlock.tsx which renders
 * each token as a span with a colour class.
 *
 * The goal is "good enough to scan", not full lexical correctness - we accept the
 * occasional mis-tokenization in favour of small bundle size and zero deps.
 *
 * ## Why a hand-rolled highlighter?
 * Full-featured highlighters (Prism, highlight.js, Shiki) each pull in tens to hundreds
 * of kilobytes and a grammar loader. The dashboard only ever renders short code fences
 * pasted into a transcript, so absolute lexical fidelity is unnecessary; a compact,
 * synchronous, allocation-light tokenizer keeps the bundle small and avoids async grammar
 * loading on first paint. Mis-tokenizations (e.g. a JS label mistaken for a property) are
 * acceptable because the reader still gets legible, colour-cued code.
 *
 * ## Pipeline / data flow
 * `CodeBlock.tsx` -> {@link highlight}(source, lang) -> {@link Token}[] -> one <span> per
 * token whose className comes from {@link tokenClass}. The language tag on the fence is
 * first funnelled through {@link canonicalLang} to collapse aliases (jsx/mjs -> "js",
 * yml -> "yaml", …) down to the ten canonical keys this module actually implements.
 *
 * ## Two tokenizer families
 * 1. Rule-driven scanners (JS/TS, Python, JSON, shell, CSS, SQL) share {@link tokenizeWith},
 *    a tiny engine that walks the source left-to-right and, at each cursor position, tries
 *    an ordered list of sticky (`/y`) regex {@link Rule}s. The first rule that matches at
 *    the cursor wins; unmatched characters accrete into "plain" tokens. Because identifier
 *    and keyword shapes overlap, these scanners first tag every identifier as "keyword" and
 *    then run a post-pass ({@link refineIdentifiers} for JS/Python, inline loops for shell
 *    and SQL) that re-classifies each word into keyword/builtin/boolean/plain using the
 *    per-language word sets below.
 * 2. Hand-written scanners (HTML, YAML, diff) bypass {@link tokenizeWith} because their
 *    structure is line- or multi-group-oriented rather than a flat token stream: HTML needs
 *    grouped tag/attribute matches, while YAML and diff are line-prefix driven.
 *
 * ## Ordering matters
 * Within every {@link Rule} list the order encodes precedence: comments and strings come
 * first so that keyword/number/operator patterns can never "reach into" a comment or a
 * quoted literal. Likewise the JSON scanner lists the key-string rule (a string followed by
 * `:`) before the plain value-string rule so object keys get their own colour.
 *
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

// ---------------------------------------------------------------------------
// Core token model
//
// Everything downstream (the tokenizers, the refinement passes, CodeBlock.tsx)
// speaks in terms of these three shapes: the closed set of colour categories
// ({@link TokenType}), the (type, text) pair a scan emits ({@link Token}), and
// the sticky-regex rule the shared engine consumes ({@link Rule}).
// ---------------------------------------------------------------------------

/** Syntax category assigned to a {@link Token}. Not every tokenizer emits
 *  every type - e.g. "tag"/"attr" are HTML-only, "diff-*" are diff-only,
 *  "variable" is shell-only. {@link tokenClass} maps each to a colour class. */
export type TokenType =
  // Shared across (almost) every language.
  | "plain" // uncoloured text: whitespace, unmatched chars, disabled languages
  | "comment" // `//`, `#`, `/* */`, `--`, `<!-- -->` depending on language
  | "string" // quoted literals (and HTML attribute values)
  | "number" // integer / float / hex / binary / octal / unit-suffixed literals
  | "keyword" // reserved words (see the per-language *_KEYWORDS sets)
  | "builtin" // well-known globals / commands (see the *_BUILTINS sets)
  | "function" // an identifier immediately followed by `(` (a call/def site)
  | "operator" // `=>`, `===`, `&&`, arithmetic/comparison/bitwise operators
  | "punctuation" // brackets, braces, commas, semicolons, colons, dots
  | "property" // object/JSON keys and YAML keys; CSS property names
  // Language-specific categories (only emitted by the tokenizer named).
  | "tag" // HTML element names; CSS selectors
  | "attr" // HTML attribute names
  | "variable" // shell variable expansions (`$foo`, `${bar}`, `$?`)
  | "boolean" // literal constants: true/false/null/None/undefined/…
  | "diff-add" // a unified-diff added line (`+…`)
  | "diff-del" // a unified-diff removed line (`-…`)
  | "diff-meta"; // a unified-diff header line (`@@`, `+++`, `---`, `diff …`)

/** One lexical unit produced by {@link highlight} - a run of source text
 *  tagged with the colour category it should render as. A whole highlighted
 *  code block is simply an ordered `Token[]`; concatenating every `text` in
 *  order always reproduces the original `source` byte-for-byte (the tokenizers
 *  never drop or rewrite characters, only classify them). */
export interface Token {
  /** Which colour category this run of text belongs to. */
  type: TokenType;
  /** The exact source substring this token covers (never normalized). */
  text: string;
}

/** One entry in a per-language tokenizer's ordered rule list: match `pattern`
 *  (a sticky `/y` regex) at the cursor and, if it wins, tag the match `type`.
 *  The sticky flag is essential - it lets {@link tokenizeWith} anchor each
 *  attempt to the current cursor via `pattern.lastIndex` instead of scanning
 *  forward, so a rule only ever matches text that starts exactly at the cursor. */
interface Rule {
  /** The category to tag the matched text with when this rule wins. */
  type: TokenType;
  /** A sticky (`/y`) regex; must be able to match starting at `lastIndex`. */
  pattern: RegExp;
}

// ===========================================================================
// Per-language word sets
//
// The rule-driven scanners can't tell a reserved word from an ordinary
// identifier with a regex alone (both look like `[a-zA-Z_$][\w$]*`), so each
// language tags every bare identifier as "keyword" during the scan and then a
// post-pass consults these Sets to reclassify it:
//   - in *_KEYWORDS  -> stays "keyword" (reserved word)
//   - in *_BUILTINS  -> becomes "builtin" (well-known global / command)
//   - in *_LITERALS  -> becomes "boolean" (true/false/null-style constant)
//   - otherwise      -> demoted to "plain" (a user-defined name)
// Membership tests are O(1) `Set.has`, and case-sensitive except for SQL (whose
// set lives inside {@link tokenizeSQL} and is matched case-insensitively).
// ===========================================================================

/** JavaScript/TypeScript reserved words (incl. TS-only ones like `interface`,
 *  `type`, `enum`, `readonly`, `declare`, `abstract`, `override`). Words here
 *  render as "keyword". Note `type`/`interface`/`namespace` are contextual in
 *  real TS but are always coloured as keywords here for simplicity. */
const JS_KEYWORDS = new Set([
  "const",
  "let",
  "var",
  "function",
  "return",
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "break",
  "continue",
  "default",
  "class",
  "extends",
  "super",
  "this",
  "new",
  "delete",
  "typeof",
  "instanceof",
  "in",
  "of",
  "void",
  "yield",
  "async",
  "await",
  "import",
  "export",
  "from",
  "as",
  "try",
  "catch",
  "finally",
  "throw",
  "static",
  "public",
  "private",
  "protected",
  "readonly",
  "interface",
  "type",
  "enum",
  "implements",
  "namespace",
  "declare",
  "abstract",
  "override",
]);

/** Well-known JS/TS globals and Node.js ambient names. Words here render as
 *  "builtin" (a distinct colour from keywords) so calls like `JSON.parse` or
 *  `console.log` read at a glance. Not exhaustive - just the common ones seen
 *  in transcripts; anything missing simply falls through to "plain". */
const JS_BUILTINS = new Set([
  "console",
  "window",
  "document",
  "globalThis",
  "process",
  "Math",
  "JSON",
  "Object",
  "Array",
  "String",
  "Number",
  "Boolean",
  "Date",
  "RegExp",
  "Map",
  "Set",
  "Promise",
  "Symbol",
  "Error",
  "Buffer",
  "require",
  "module",
  "exports",
  "__dirname",
  "__filename",
]);

/** JS/TS literal constants. These are coloured "boolean" (which shares the
 *  orange number colour) rather than "keyword" so they visually group with the
 *  values they are, not the control-flow words. */
const JS_LITERALS = new Set(["true", "false", "null", "undefined", "NaN", "Infinity"]);

/** Python reserved words. Includes `self`/`cls` (conventionally the first
 *  parameter of methods) so they colour like keywords even though they are
 *  technically ordinary identifiers in the language grammar. */
const PY_KEYWORDS = new Set([
  "def",
  "class",
  "if",
  "elif",
  "else",
  "for",
  "while",
  "break",
  "continue",
  "return",
  "yield",
  "import",
  "from",
  "as",
  "pass",
  "raise",
  "try",
  "except",
  "finally",
  "with",
  "lambda",
  "global",
  "nonlocal",
  "in",
  "is",
  "not",
  "and",
  "or",
  "async",
  "await",
  "self",
  "cls",
]);

/** Python built-in functions/types (the subset commonly seen). `Exception` is
 *  included as a representative built-in exception. Rendered as "builtin". */
const PY_BUILTINS = new Set([
  "print",
  "len",
  "range",
  "str",
  "int",
  "float",
  "list",
  "dict",
  "set",
  "tuple",
  "bool",
  "isinstance",
  "type",
  "open",
  "input",
  "enumerate",
  "zip",
  "map",
  "filter",
  "sorted",
  "reversed",
  "abs",
  "min",
  "max",
  "sum",
  "any",
  "all",
  "Exception",
]);

/** Python literal constants. Case matters - these are capitalized, unlike the
 *  lowercase JS literals - so `true` in Python source stays "plain". */
const PY_LITERALS = new Set(["True", "False", "None"]);

/** Shell/bash control-flow and declaration words. Rendered as "keyword". The
 *  shell scanner deliberately keeps this list separate from {@link SH_BUILTINS}
 *  so that structural words (`if`/`fi`/`for`/`done`) colour differently from
 *  the commands you actually invoke. */
const SH_KEYWORDS = new Set([
  "if",
  "then",
  "else",
  "elif",
  "fi",
  "for",
  "in",
  "do",
  "done",
  "while",
  "until",
  "case",
  "esac",
  "function",
  "return",
  "exit",
  "export",
  "local",
  "readonly",
  "declare",
  "set",
  "unset",
  "source",
]);

/** Common shell commands and coreutils/dev tools (git, npm, node, curl, …).
 *  A word here renders as "builtin". In {@link tokenizeShell} an identifier is
 *  only checked against this set when it was tagged "keyword" or "function"
 *  (i.e. a bare command word), so `grep` used as a command highlights but a
 *  variable that happens to be named `grep` would not (it is a "variable"). */
const SH_BUILTINS = new Set([
  "echo",
  "cd",
  "ls",
  "cat",
  "grep",
  "sed",
  "awk",
  "find",
  "rm",
  "mv",
  "cp",
  "mkdir",
  "touch",
  "chmod",
  "chown",
  "kill",
  "ps",
  "git",
  "npm",
  "node",
  "python",
  "python3",
  "pip",
  "curl",
  "wget",
  "ssh",
  "scp",
  "tar",
  "zip",
  "unzip",
  "head",
  "tail",
  "wc",
  "sort",
  "uniq",
  "xargs",
  "tee",
]);

// ===========================================================================
// Shared scanning engine
// ===========================================================================

/**
 * Escapes regex metacharacters so `s` can be embedded in a `RegExp` literally.
 * @param s Arbitrary text that may contain characters special to a regex.
 * @returns `s` with every one of `. * + ? ^ $ { } ( ) | [ ] \` backslash-escaped,
 *   so `new RegExp(escapeRegex(s))` matches `s` verbatim. `$&` in the replacement
 *   is the matched metacharacter itself.
 * @example escapeRegex("a.b(c)") // => "a\\.b\\(c\\)"
 * @remarks Currently only re-exported (as {@link _escapeRegex}) for consumers/tests;
 *   the built-in tokenizers use literal regexes and don't call it.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The heart of every rule-driven tokenizer: walk `source` left-to-right and, at
 * each cursor position, try the `rules` in order until one matches exactly at
 * the cursor. This is a classic "maximal-munch by priority" lexer - priority is
 * the array order, munch length is whatever the winning regex consumed.
 *
 * @param source Raw source text to scan.
 * @param rules Ordered rule list; earlier rules win ties, so put comments and
 *   strings first and the greedy identifier/number rules last.
 * @returns A gap-free `Token[]` whose concatenated `text` equals `source`.
 *
 * @remarks
 * - Each rule's `pattern` must carry the sticky flag (`/y`). Setting
 *   `pattern.lastIndex = i` and calling `exec` then only matches if the pattern
 *   starts at `i`; the extra `m.index === i` guard is belt-and-braces in case a
 *   non-sticky regex ever sneaks in.
 * - Any character matched by no rule becomes (or extends) a "plain" token. We
 *   append single unmatched chars one at a time but coalesce consecutive ones
 *   into the previous "plain" token, which keeps the token array short (fewer
 *   React spans) without changing the rendered output.
 */
function tokenizeWith(source: string, rules: Rule[]): Token[] {
  const tokens: Token[] = [];
  let i = 0; // current scan cursor (byte index into `source`)
  while (i < source.length) {
    let matched = false;
    for (const rule of rules) {
      // Anchor this rule's sticky regex to the cursor so it can only match here.
      rule.pattern.lastIndex = i;
      const m = rule.pattern.exec(source);
      if (m && m.index === i) {
        tokens.push({ type: rule.type, text: m[0] });
        i += m[0].length; // advance past the whole matched run
        matched = true;
        break; // first rule wins; don't let later rules re-match the same text
      }
    }
    if (!matched) {
      // Append a single plain char; merge with previous plain token to keep the array small.
      const ch = source[i]!;
      const last = tokens[tokens.length - 1];
      if (last && last.type === "plain") last.text += ch;
      else tokens.push({ type: "plain", text: ch });
      i += 1;
    }
  }
  return tokens;
}

// ===========================================================================
// Per-language tokenizers
//
// Each `tokenizeX` builds an ordered {@link Rule} list and (for the rule-driven
// ones) feeds it to {@link tokenizeWith}. Rule order is precedence: comments and
// strings must precede the identifier/number/operator rules so those greedy
// patterns can't reach into a comment or a quoted literal. Identifier-heavy
// languages then run a refinement pass to split the catch-all "keyword" tag.
// ===========================================================================

/**
 * Tokenizer for JavaScript/TypeScript ("js"/"ts" canonical languages).
 * @param source JS/TS source text.
 * @returns Tokens with identifiers already refined into keyword/builtin/boolean/plain.
 * @remarks Rule order (first match wins):
 *   1. comment  - `//` to EOL, or `/* … *\/` (non-greedy, spans newlines).
 *   2. string   - double / single (no raw newline) or backtick template (may span
 *      lines); template interpolations are not parsed, they stay inside the string.
 *   3. number   - hex `0x…`, binary `0b…`, octal `0o…`, or decimal with optional
 *      fraction and exponent; `\b…\b` keeps it from eating into an identifier.
 *   4. function - an identifier immediately followed by `(` via lookahead `(?=\s*\()`;
 *      this fires before the keyword rule so call sites colour as calls.
 *   5. keyword  - any remaining identifier (refined afterwards).
 *   6. operator - multi-char forms first (`=>`,`===`,`??`,`...`) so they aren't split
 *      into single-char operators, then the single-char class.
 *   7. punctuation - brackets/braces/parens/semicolon/comma/dot.
 */
function tokenizeJS(source: string): Token[] {
  const rules: Rule[] = [
    // Line (`// …`) or block (`/* … */`, non-greedy across newlines) comments.
    { type: "comment", pattern: /\/\/[^\n]*|\/\*[\s\S]*?\*\//y },
    // Double, single (both newline-terminated) or backtick template literals.
    { type: "string", pattern: /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/y },
    {
      // Hex / binary / octal / decimal (optional fraction + exponent), word-bounded.
      type: "number",
      pattern: /\b(?:0[xX][0-9a-fA-F]+|0[bB][01]+|0[oO][0-7]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/y,
    },
    // Identifier directly before `(` -> a call/definition site.
    { type: "function", pattern: /\b[a-zA-Z_$][\w$]*(?=\s*\()/y },
    // Any other identifier; refineIdentifiers() reclassifies it below.
    { type: "keyword", pattern: /\b[a-zA-Z_$][\w$]*\b/y },
    // Multi-char operators are listed before the single-char class so they win.
    { type: "operator", pattern: /=>|===|!==|==|!=|<=|>=|&&|\|\||\?\?|\.\.\.|[+\-*/%=<>!&|^~?:]/y },
    { type: "punctuation", pattern: /[{}[\]();,.]/y },
  ];
  // post-process the keyword rule: split into keyword/builtin/boolean/plain
  return refineIdentifiers(tokenizeWith(source, rules), JS_KEYWORDS, JS_BUILTINS, JS_LITERALS);
}

/**
 * Tokenizer for Python source ("python" canonical language).
 * @param source Python source text.
 * @returns Tokens with identifiers refined via {@link PY_KEYWORDS}/{@link PY_BUILTINS}/
 *   {@link PY_LITERALS}.
 * @remarks Differences from the JS scanner:
 *   - Comments are `#`-to-EOL only (no block comments in Python).
 *   - The string rule lists triple-quoted `"""…"""` / `'''…'''` *before* the single-line
 *     quotes so a docstring is consumed whole rather than as an empty `""` then text.
 *     f/r/b string prefixes are not modelled, so the prefix letter tokenizes separately.
 *   - Operators include Python-specific `**` (power), `//` (floor div) and `->` (return
 *     annotation), again longest-first so they don't split.
 */
function tokenizePython(source: string): Token[] {
  const rules: Rule[] = [
    { type: "comment", pattern: /#[^\n]*/y },
    {
      // Triple-quoted (docstrings) first, then ordinary single-line strings.
      type: "string",
      pattern: /"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/y,
    },
    { type: "number", pattern: /\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/y },
    { type: "function", pattern: /\b[a-zA-Z_][\w]*(?=\s*\()/y },
    { type: "keyword", pattern: /\b[a-zA-Z_][\w]*\b/y },
    // `**`/`//`/`<<`/`>>`/`->` before single-char operators.
    { type: "operator", pattern: /\*\*|\/\/|<<|>>|<=|>=|==|!=|->|[+\-*/%=<>!&|^~]/y },
    { type: "punctuation", pattern: /[{}[\]():,.]/y },
  ];
  return refineIdentifiers(tokenizeWith(source, rules), PY_KEYWORDS, PY_BUILTINS, PY_LITERALS);
}

/**
 * Tokenizer for JSON/JSONC ("json" canonical language). Object keys are
 * re-tagged "property" (see below) instead of "string" for a distinct colour.
 * @param source JSON (or JSON-with-comments) source text.
 * @returns Tokens where string keys are "property" and string values stay "string".
 * @remarks
 * - There is no comment rule, so JSONC `//`/`/* *\/` comments tokenize as plain
 *   punctuation/text rather than as comments - acceptable for scanning.
 * - `true`/`false`/`null` are tagged "boolean" directly by their own rule (no
 *   identifier rule exists here, unlike JS/Python).
 * - The two string rules look identical except the first requires a trailing `:`
 *   lookahead; that fast-paths keys on a compact single line, but the following
 *   loop is what robustly re-tags keys even when whitespace separates the string
 *   and the colon (e.g. pretty-printed JSON). It scans forward past whitespace-only
 *   "plain" tokens and, if the next meaningful token is a `:`, promotes the string
 *   to "property".
 */
function tokenizeJSON(source: string): Token[] {
  const rules: Rule[] = [
    { type: "string", pattern: /"(?:\\.|[^"\\])*"(?=\s*:)/y }, // key
    { type: "string", pattern: /"(?:\\.|[^"\\])*"/y }, // value string
    { type: "number", pattern: /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/y },
    { type: "boolean", pattern: /\b(?:true|false|null)\b/y },
    { type: "punctuation", pattern: /[{}[\],:]/y },
  ];
  // Mark "key" strings (those followed by `:`) as `property` instead of `string`
  const tokens = tokenizeWith(source, rules);
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i]!.type === "string") {
      // Look ahead through whitespace plain tokens
      for (let j = i + 1; j < tokens.length; j++) {
        const t = tokens[j]!;
        // Skip pure-whitespace gaps (indentation/newlines between key and colon).
        if (t.type === "plain" && /^\s*$/.test(t.text)) continue;
        // First non-whitespace token is a colon => this string was an object key.
        if (t.type === "punctuation" && t.text === ":") {
          tokens[i]!.type = "property";
        }
        break; // stop at the first meaningful token either way
      }
    }
  }
  return tokens;
}

/**
 * Tokenizer for shell scripts ("bash" canonical language, covers sh/zsh/console).
 * @param source Shell source text.
 * @returns Tokens with command words split into keyword/builtin/plain.
 * @remarks
 * - Single-quoted strings are literal (`'[^']*'` - no escape processing, matching
 *   POSIX semantics); double-quoted strings honour `\.` escapes.
 * - The variable rule matches `${…}` (braced), `$name` (word), and the special
 *   one-char parameters `$# $? $@ $* $$`.
 * - Two identifier rules exist: "function" for a word followed by whitespace (the
 *   typical command-in-command-position shape) and "keyword" for any other bareword.
 * - The refinement loop only touches words tagged "keyword"/"function": a shell
 *   keyword stays "keyword", a known command becomes "builtin", and any leftover
 *   "keyword" (an unknown bareword) is demoted to "plain". A leftover "function"
 *   (unknown word in command position) is intentionally left as "function".
 */
function tokenizeShell(source: string): Token[] {
  const rules: Rule[] = [
    { type: "comment", pattern: /#[^\n]*/y },
    // Double-quoted (with escapes) or single-quoted (fully literal) strings.
    { type: "string", pattern: /"(?:\\.|[^"\\])*"|'[^']*'/y },
    // `${braced}`, `$word`, or special params `$# $? $@ $* $$`.
    { type: "variable", pattern: /\$\{[^}]+\}|\$\w+|\$[#?@*$]/y },
    { type: "number", pattern: /\b\d+\b/y },
    // Word followed by whitespace -> command position (tentatively "function").
    { type: "function", pattern: /\b[a-zA-Z_][\w-]*(?=\s)/y },
    { type: "keyword", pattern: /\b[a-zA-Z_][\w-]*\b/y },
    // `&&`/`||`/`>>`/`<<` before the single-char pipe/redirect/background chars.
    { type: "operator", pattern: /&&|\|\||>>|<<|[|&;<>=!]/y },
    { type: "punctuation", pattern: /[(){}[\];]/y },
  ];
  const tokens = tokenizeWith(source, rules);
  // refine: distinguish keywords vs builtins vs commands
  for (const t of tokens) {
    if (t.type === "keyword" || t.type === "function") {
      // A shell keyword stays a keyword; a known command becomes a builtin; any
      // other leftover "keyword" (an unknown bareword) is demoted to "plain".
      // An unknown word already tagged "function" keeps that tag (no branch here).
      if (SH_KEYWORDS.has(t.text)) t.type = "keyword";
      else if (SH_BUILTINS.has(t.text)) t.type = "builtin";
      else if (t.type === "keyword") t.type = "plain";
    }
  }
  return tokens;
}

/**
 * Tokenizer for HTML/XML/SVG ("html" canonical language). Uses one regex
 * scan (not the shared `Rule[]` engine) since tags/attrs need multi-group
 * matches; delegates attribute parsing to {@link tokenizeHTMLAttrs}.
 * @param source HTML/XML/SVG source text.
 * @returns Tokens: comments whole, tag delimiters as "punctuation", element
 *   names as "tag", attributes via {@link tokenizeHTMLAttrs}, and text nodes as "plain".
 * @remarks The single global (`/g`) regex alternates over four shapes, and the
 *   capture-group index tells us which one fired:
 *   - `m[1]` `<!-- … -->` comment (non-greedy, may span lines).
 *   - `m[2]` opening `<` or closing `</` delimiter; `m[3]` the element name;
 *     `m[4]` the raw attribute-list substring (parsed separately); `m[5]` the
 *     closing `>` or self-closing `/>`.
 *   - `m[6]` a run of text between tags (everything up to the next `<`).
 *   Because it is a plain `/g` scan we simply advance via `re.exec` in a loop;
 *   `lastIndex` is managed by the engine rather than by us as in {@link tokenizeWith}.
 */
function tokenizeHTML(source: string): Token[] {
  const tokens: Token[] = [];
  // Alternation: (1) comment | (2..5) a tag with grouped delimiters/name/attrs | (6) text.
  const re =
    /(<!--[\s\S]*?-->)|(<\/?)([a-zA-Z][\w-]*)((?:\s+[a-zA-Z_:][\w:.-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?>)|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) != null) {
    if (m[1]) tokens.push({ type: "comment", text: m[1] });
    else if (m[2]) {
      // A tag: emit the `<`/`</`, the element name, its attributes, then `>`/`/>`.
      tokens.push({ type: "punctuation", text: m[2] });
      tokens.push({ type: "tag", text: m[3]! });
      if (m[4]) tokens.push(...tokenizeHTMLAttrs(m[4]));
      tokens.push({ type: "punctuation", text: m[5]! });
    } else if (m[6]) tokens.push({ type: "plain", text: m[6] }); // text node
  }
  return tokens;
}

/**
 * Tokenizes one HTML tag's attribute-list substring (name=value pairs) for
 * {@link tokenizeHTML}.
 * @param src The `m[4]` capture from {@link tokenizeHTML} - the whitespace-led run
 *   of `name`, `name=value`, or bare `name` attributes between the tag name and `>`.
 * @returns A flat token list preserving the leading whitespace of each attribute as
 *   "plain", the attribute name as "attr", the `=` (with any surrounding spaces) as
 *   "operator", and the value (quoted or unquoted) as "string".
 * @remarks Groups `m[3]` (the `=`) and `m[4]` (the value) are optional, so this also
 *   handles valueless boolean attributes like `<input disabled>`.
 */
function tokenizeHTMLAttrs(src: string): Token[] {
  const tokens: Token[] = [];
  // Per attribute: leading space(s), name, optional `=`, optional quoted/bare value.
  const re = /(\s+)([a-zA-Z_:][\w:.-]*)(\s*=\s*)?("[^"]*"|'[^']*'|[^\s>]+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) != null) {
    tokens.push({ type: "plain", text: m[1]! }); // separating whitespace
    tokens.push({ type: "attr", text: m[2]! }); // attribute name
    if (m[3]) tokens.push({ type: "operator", text: m[3] }); // the `=`
    if (m[4]) tokens.push({ type: "string", text: m[4] }); // attribute value
  }
  return tokens;
}

/**
 * Tokenizer for CSS ("css" canonical language, covers scss/less too).
 * @param source CSS/SCSS/LESS source text.
 * @returns Tokens: comments, strings, numbers (with an optional unit baked in),
 *   property names, selectors, and punctuation.
 * @remarks
 * - CSS has only block comments (`/* … *\/`), no line comments.
 * - The number rule optionally absorbs a trailing unit (`px em rem % vh vw s ms deg`),
 *   so `12px` is one "number" token rather than a number plus an identifier.
 * - A word followed by `:` is a "property" (declaration name); any other word - with
 *   an optional leading `.`/`#` - is treated as a selector and tagged "tag". Property
 *   must precede the selector rule so `color:` colours as a property, not a selector.
 */
function tokenizeCSS(source: string): Token[] {
  const rules: Rule[] = [
    { type: "comment", pattern: /\/\*[\s\S]*?\*\//y },
    { type: "string", pattern: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y },
    // Signed decimal with an optional CSS unit suffix.
    { type: "number", pattern: /-?\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|ms|deg)?\b/y },
    { type: "property", pattern: /[a-zA-Z-]+(?=\s*:)/y }, // declaration name before `:`
    { type: "tag", pattern: /[.#]?[a-zA-Z_][\w-]*/y }, // `.class` / `#id` / element selector
    { type: "punctuation", pattern: /[{}();:,]/y },
  ];
  return tokenizeWith(source, rules);
}

/**
 * Tokenizer for SQL ("sql" canonical language). Unlike the other tokenizers,
 * the keyword set is local (`KW`) rather than a module-level constant, since
 * SQL is the only language whose reserved words are checked case-insensitively.
 * @param source SQL source text.
 * @returns Tokens where recognized reserved words (any case) are "keyword" and every
 *   other bareword is demoted to "plain" (table/column/alias names).
 * @remarks
 * - Comments are `-- to EOL` or `/* … *\/`.
 * - Strings are single-quoted with SQL's doubled-quote escape (`''` inside a string),
 *   captured by `'(?:''|[^'])*'`.
 * - The scan tags every bareword "keyword", then the refinement loop lowercases each
 *   and drops any not in `KW` down to "plain" - this is why `SELECT`, `select` and
 *   `Select` all highlight identically.
 */
function tokenizeSQL(source: string): Token[] {
  // Lowercased reserved words; membership is tested against `text.toLowerCase()`.
  const KW = new Set([
    "select",
    "from",
    "where",
    "and",
    "or",
    "not",
    "in",
    "is",
    "null",
    "as",
    "join",
    "left",
    "right",
    "inner",
    "outer",
    "on",
    "group",
    "by",
    "order",
    "having",
    "limit",
    "offset",
    "insert",
    "into",
    "values",
    "update",
    "set",
    "delete",
    "create",
    "table",
    "drop",
    "alter",
    "add",
    "primary",
    "key",
    "foreign",
    "references",
    "index",
    "unique",
    "with",
    "case",
    "when",
    "then",
    "else",
    "end",
    "distinct",
    "union",
    "all",
    "exists",
    "between",
    "like",
  ]);
  const rules: Rule[] = [
    { type: "comment", pattern: /--[^\n]*|\/\*[\s\S]*?\*\//y }, // `-- line` or `/* block */`
    { type: "string", pattern: /'(?:''|[^'])*'/y }, // single-quoted, `''` = literal quote
    { type: "number", pattern: /\b\d+(?:\.\d+)?\b/y },
    { type: "keyword", pattern: /\b[a-zA-Z_][\w]*\b/y }, // every bareword (refined below)
    { type: "operator", pattern: /<>|<=|>=|!=|[=<>+\-*/]/y }, // `<>` (not-equal) longest-first
    { type: "punctuation", pattern: /[(),;.]/y },
  ];
  const tokens = tokenizeWith(source, rules);
  for (const t of tokens) {
    if (t.type === "keyword") {
      // Case-insensitive check: anything not a reserved word is an identifier.
      if (!KW.has(t.text.toLowerCase())) t.type = "plain";
    }
  }
  return tokens;
}

/**
 * Tokenizer for YAML ("yaml" canonical language). Line-based rather than
 * regex-rule-based: each line is matched once against a `key: value` pattern
 * and the value is sniffed for string/number/boolean shape.
 * @param source YAML source text.
 * @returns Tokens with newlines re-inserted between lines as "plain" separators.
 * @remarks
 * - Newlines are stripped by `split("\n")` and re-emitted as an explicit "\n" plain
 *   token before every line except the first, so concatenating the output still
 *   reproduces `source` exactly (including a trailing newline as a final empty line).
 * - A whole-line comment (first non-space char is `#`) is emitted verbatim. Inline
 *   `# …` trailing comments are not split out - they land in the value's "plain".
 * - The key regex allows an optional leading list dash (`- key: value`). The value
 *   `rest` is then shape-sniffed in priority order: quoted -> "string", numeric ->
 *   "number", `true/false/null/~` -> "boolean", otherwise "plain" (bare scalar, flow
 *   collection, anchor, etc.). Only fully-matching values are recolored; a value with
 *   trailing content stays "plain".
 * - Lines that don't look like `key:` (list items, block scalars, blank lines) are
 *   emitted as a single "plain" token.
 */
function tokenizeYAML(source: string): Token[] {
  const tokens: Token[] = [];
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (i > 0) tokens.push({ type: "plain", text: "\n" }); // re-insert the split newline
    if (line.trim().startsWith("#")) {
      tokens.push({ type: "comment", text: line }); // whole-line comment
      continue;
    }
    // Capture: [1] indent (+ optional list dash), [2] key, [3] `:`, [4] the value tail.
    const m = line.match(/^(\s*-?\s*)([a-zA-Z_][\w-]*)(\s*:)(.*)$/);
    if (m) {
      tokens.push({ type: "plain", text: m[1]! }); // leading whitespace / `-`
      tokens.push({ type: "property", text: m[2]! }); // the key
      tokens.push({ type: "punctuation", text: m[3]! }); // the colon
      const rest = m[4]!;
      // Sniff the value's scalar type (each test requires the value to fill `rest`).
      if (/^\s*("[^"]*"|'[^']*')\s*$/.test(rest)) {
        tokens.push({ type: "string", text: rest });
      } else if (/^\s*-?\d+(\.\d+)?\s*$/.test(rest)) {
        tokens.push({ type: "number", text: rest });
      } else if (/^\s*(true|false|null|~)\s*$/.test(rest)) {
        tokens.push({ type: "boolean", text: rest }); // `~` is YAML's null shorthand
      } else {
        tokens.push({ type: "plain", text: rest }); // bare scalar / mapping / list value
      }
    } else {
      tokens.push({ type: "plain", text: line }); // not a `key:` line
    }
  }
  return tokens;
}

/**
 * Tokenizer for unified diffs ("diff" canonical language, covers .patch
 * too). Purely line-prefix-based: `+`/`-`/`@@`/`+++`/`---`/`diff `.
 * @param source Unified-diff / patch text.
 * @returns One token per line (plus re-inserted "\n" separators), each coloured by prefix.
 * @remarks Classification is by first characters, checked in this order so the
 *   3-char file headers `+++`/`---` are recognized as "diff-meta" *before* the
 *   single-char `+`/`-` add/remove tests could mislabel them:
 *   - `+++` / `---` / `@@` / `diff ` -> "diff-meta" (hunk & file headers)
 *   - `+` -> "diff-add" (added line, green background via {@link tokenClass})
 *   - `-` -> "diff-del" (removed line, red background)
 *   - anything else -> "plain" (unchanged context line)
 *   Newlines are re-emitted between lines exactly as in {@link tokenizeYAML}.
 */
function tokenizeDiff(source: string): Token[] {
  const tokens: Token[] = [];
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (i > 0) tokens.push({ type: "plain", text: "\n" }); // re-insert the split newline
    if (
      // File/hunk headers first so `+++`/`---` don't fall into the +/- cases below.
      line.startsWith("+++") ||
      line.startsWith("---") ||
      line.startsWith("@@") ||
      line.startsWith("diff ")
    ) {
      tokens.push({ type: "diff-meta", text: line });
    } else if (line.startsWith("+")) {
      tokens.push({ type: "diff-add", text: line }); // added line
    } else if (line.startsWith("-")) {
      tokens.push({ type: "diff-del", text: line }); // removed line
    } else {
      tokens.push({ type: "plain", text: line }); // unchanged context line
    }
  }
  return tokens;
}

// ===========================================================================
// Identifier refinement + public API
// ===========================================================================

/**
 * Post-processes a token stream's generic "keyword" tokens (emitted by the
 * identifier-matching rule shared across JS/Python) into their final type:
 * "keyword" if actually reserved, "builtin" for known globals, "boolean" for
 * literal constants (true/false/null/…), or "plain" for ordinary identifiers.
 * @param tokens Token stream from {@link tokenizeWith} (mutated in place).
 * @param keywords Reserved-word set for the language (e.g. {@link JS_KEYWORDS}).
 * @param builtins Known-global set (e.g. {@link JS_BUILTINS}).
 * @param literals Literal-constant set (e.g. {@link JS_LITERALS}).
 * @returns The same `tokens` array (returned for chaining convenience).
 * @remarks Case-sensitive membership tests, checked keyword -> builtin -> literal
 *   -> plain. Only tokens currently typed "keyword" are considered, so tokens the
 *   scanner already classified (strings, numbers, "function" call sites, …) are
 *   untouched - e.g. `Math` in `Math(x)` stays "function", not "builtin".
 */
function refineIdentifiers(
  tokens: Token[],
  keywords: Set<string>,
  builtins: Set<string>,
  literals: Set<string>
): Token[] {
  for (const t of tokens) {
    if (t.type === "keyword") {
      // Priority chain: genuine reserved word -> known global/type -> literal
      // constant (true/false/null/…) -> otherwise a user-defined identifier.
      if (keywords.has(t.text)) t.type = "keyword";
      else if (builtins.has(t.text)) t.type = "builtin";
      else if (literals.has(t.text)) t.type = "boolean";
      else t.type = "plain";
    }
  }
  return tokens;
}

/**
 * Normalize a user-supplied lang tag (fenced-code-block language, e.g. from a
 * transcript's ```jsx block) to one of this module's canonical keys.
 * @param lang Raw language tag, case-insensitive (e.g. "JS", "py", "yml").
 * @returns A canonical key ("js", "ts", "python", "json", "bash", "html",
 *   "css", "sql", "yaml", "diff"), or the lowercased input itself (or "plain"
 *   if empty) when it doesn't match any known alias.
 */
export function canonicalLang(lang: string): string {
  const l = lang.toLowerCase().trim(); // normalize case/whitespace before matching
  if (l === "js" || l === "jsx" || l === "javascript" || l === "mjs" || l === "cjs") return "js";
  if (l === "ts" || l === "tsx" || l === "typescript") return "ts";
  if (l === "py" || l === "python") return "python";
  if (l === "json" || l === "jsonc") return "json";
  if (l === "sh" || l === "bash" || l === "zsh" || l === "shell" || l === "console") return "bash";
  if (l === "html" || l === "xml" || l === "svg") return "html";
  if (l === "css" || l === "scss" || l === "less") return "css";
  if (l === "sql") return "sql";
  if (l === "yaml" || l === "yml") return "yaml";
  if (l === "diff" || l === "patch") return "diff";
  // Unknown tag: return it lowercased (so `highlight`'s switch falls through to a
  // single "plain" token), or "plain" when the tag was empty/whitespace-only.
  return l || "plain";
}

/**
 * Tokenize source code for the given language. This is the module's main
 * entry point, consumed by CodeBlock.tsx to render each token as a coloured
 * span (via {@link tokenClass}).
 * @param source Raw source text to tokenize.
 * @param lang Language tag, normalized internally via {@link canonicalLang}.
 * @returns An ordered list of {@link Token}s. Falls back to a single "plain"
 *   token wrapping the entire source for languages with no dedicated tokenizer.
 */
export function highlight(source: string, lang: string): Token[] {
  const canon = canonicalLang(lang); // collapse aliases to a canonical key
  switch (canon) {
    case "js":
    case "ts": // JS and TS share one tokenizer (JS_KEYWORDS already covers TS words)
      return tokenizeJS(source);
    case "python":
      return tokenizePython(source);
    case "json":
      return tokenizeJSON(source);
    case "bash":
      return tokenizeShell(source);
    case "html":
      return tokenizeHTML(source);
    case "css":
      return tokenizeCSS(source);
    case "sql":
      return tokenizeSQL(source);
    case "yaml":
      return tokenizeYAML(source);
    case "diff":
      return tokenizeDiff(source);
    default:
      // Unknown/unsupported language: emit the source unhighlighted as one token.
      return [{ type: "plain", text: source }];
  }
}

/**
 * Map a token type to a Tailwind colour class for rendering.
 * @param type A {@link TokenType} produced by {@link highlight}.
 * @returns Tailwind utility classes (text colour, and a background tint for
 *   diff add/remove lines); falls back to a neutral gray for "plain"/unknown.
 */
export function tokenClass(type: TokenType): string {
  switch (type) {
    case "comment":
      return "text-gray-500 italic"; // muted + italic to recede visually
    case "string":
      return "text-emerald-300"; // green, shared with diff-add text
    case "number":
      return "text-orange-300"; // orange, shared with boolean literals
    case "keyword":
      return "text-violet-300"; // violet, shared with diff-meta headers
    case "builtin":
      return "text-sky-300";
    case "function":
      return "text-yellow-200"; // yellow, shared with HTML attr names
    case "operator":
      return "text-pink-300";
    case "punctuation":
      return "text-gray-400"; // slightly brighter than comments, dimmer than plain
    case "property":
      return "text-cyan-300";
    case "tag":
      return "text-rose-300";
    case "attr":
      return "text-yellow-200"; // matches "function" colour by design
    case "variable":
      return "text-amber-300";
    case "boolean":
      return "text-orange-300"; // literals grouped with numbers by colour
    case "diff-add":
      return "text-emerald-300 bg-emerald-500/10"; // green text + faint green row tint
    case "diff-del":
      return "text-red-300 bg-red-500/10"; // red text + faint red row tint
    case "diff-meta":
      return "text-violet-300";
    case "plain":
    default:
      return "text-gray-200"; // default body text colour
  }
}

// Re-export for convenience (e.g. so tests/consumers can build patterns from
// user input); the built-in tokenizers themselves never call escapeRegex.
export { escapeRegex as _escapeRegex };
