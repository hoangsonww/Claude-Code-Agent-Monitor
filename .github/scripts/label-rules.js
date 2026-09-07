/**
 * @file Deterministic labeling rules for issues and pull requests. Given only a
 * title, body, branch name and changed-file list, it derives the size, area,
 * type and review-signal labels the auto-triage workflow applies, and computes
 * the add/remove reconciliation that keeps those labels true as a pull request
 * evolves — without ever touching a label a human applied. Pure and free of
 * network or filesystem access so `server/__tests__/label-rules.test.js` can
 * pin every rule.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

// Every label this module can apply, with the color and description used when
// the label does not exist in the repository yet. Names outside this catalogue
// are never added, and only names matching MANAGED_PREFIXES or MANAGED_LABELS
// are ever removed — `good first issue`, `help wanted`, `pinned`, and anything
// else a maintainer applies by hand survive every re-run.
const LABELS = {
  "size/XS": { color: "c2e0c6", description: "Under 10 meaningful lines changed" },
  "size/S": { color: "bfe5bf", description: "Under 50 meaningful lines changed" },
  "size/M": { color: "fef2c0", description: "Under 200 meaningful lines changed" },
  "size/L": { color: "f9d0c4", description: "Under 600 meaningful lines changed" },
  "size/XL": { color: "e99695", description: "600+ meaningful lines changed — consider splitting" },

  "area/server": {
    color: "1d76db",
    description: "Express API, routes, hooks ingestion, websocket",
  },
  "area/client": { color: "1d76db", description: "React + Vite dashboard UI" },
  "area/mcp": { color: "1d76db", description: "Local MCP server and its tools" },
  "area/desktop": { color: "1d76db", description: "Electron desktop app" },
  "area/vscode-extension": { color: "1d76db", description: "VS Code extension" },
  "area/cli": { color: "1d76db", description: "ccam CLI and statusline" },
  "area/scripts": {
    color: "1d76db",
    description: "Installer, import, seed and maintenance scripts",
  },
  "area/hooks": { color: "1d76db", description: "Claude/Codex hook handlers and installers" },
  "area/database": { color: "1d76db", description: "SQLite schema and data access" },
  "area/plugins": { color: "1d76db", description: "Bundled Claude/Codex plugin manifests" },
  "area/deploy": {
    color: "1d76db",
    description: "Docker, Compose, Helm, Kubernetes, Terraform, monitoring",
  },
  "area/ci": { color: "1d76db", description: "GitHub Actions, hooks, and repo tooling" },
  "area/docs": { color: "1d76db", description: "READMEs, docs/, and the wiki" },
  "area/tests": { color: "1d76db", description: "Test suites" },

  "type/feature": { color: "5319e7", description: "Adds new capability" },
  "type/fix": { color: "5319e7", description: "Fixes broken behavior" },
  "type/refactor": { color: "5319e7", description: "Restructures code without changing behavior" },
  "type/perf": { color: "5319e7", description: "Improves performance or resource use" },
  "type/docs": { color: "5319e7", description: "Documentation only" },
  "type/test": { color: "5319e7", description: "Tests only" },
  "type/ci": { color: "5319e7", description: "CI, build, or infrastructure" },
  "type/chore": { color: "5319e7", description: "Maintenance with no product change" },
  "type/dependencies": { color: "5319e7", description: "Dependency updates" },

  "priority/high": { color: "b60205", description: "Reporter is blocked without it" },
  "priority/medium": {
    color: "fbca04",
    description: "Would significantly improve the reporter's workflow",
  },
  "priority/low": { color: "0e8a16", description: "Nice to have" },

  "breaking-change": { color: "b60205", description: "Requires a major bump and a migration note" },
  release: {
    color: "0052cc",
    description: "Version bump across the synchronized release surfaces",
  },
  dependencies: { color: "0366d6", description: "Only dependency manifests or lockfiles changed" },
  "needs-tests": {
    color: "d93f0b",
    description: "Source changed with no accompanying test change",
  },
  i18n: { color: "006b75", description: "Touches localized content" },
  "needs-i18n-parity": {
    color: "d93f0b",
    description: "A localized surface changed without its siblings",
  },
};

// Namespaces this module owns end to end: a stale member of one of these is
// removed when it no longer applies (an S pull request that grows into an L
// loses `size/S`). Everything else on the issue is left exactly as it is.
const MANAGED_PREFIXES = ["size/", "area/", "type/", "priority/"];
const MANAGED_LABELS = [
  "breaking-change",
  "dependencies",
  "i18n",
  "needs-i18n-parity",
  "needs-tests",
  "release",
];

// At most this many areas are applied. A release touches nearly every
// directory; listing twelve areas there says less than the top few do.
const MAX_AREAS = 4;

// Lines in these files say nothing about how much work a change took:
// lockfiles, build output, generated manifests, snapshots and binary assets.
// Excluding them keeps a version bump or a dependency refresh from reading XL.
const GENERATED_PATTERNS = [
  /(^|\/)package-lock\.json$/,
  /(^|\/)(dist|build|out)\//,
  /(^|\/)__snapshots__\//,
  /^wiki\/i18n-content\.js$/,
  /(^|\/)\.(claude|codex)-plugin\//,
  /^(images|fonts)\//,
  /^signatures\//,
];

// Ascending upper bounds; the first bucket a change fits into wins.
const SIZE_BUCKETS = [
  [10, "size/XS"],
  [50, "size/S"],
  [200, "size/M"],
  [600, "size/L"],
  [Infinity, "size/XL"],
];

// First match wins for a file's primary area.
const AREA_PATTERNS = [
  [/^scripts\/[a-z-]*hooks?[-.]/, "area/hooks"],
  [/^server\/routes\/hooks\.js$/, "area/hooks"],
  [/^server\//, "area/server"],
  [/^client\//, "area/client"],
  [/^mcp\//, "area/mcp"],
  [/^desktop\//, "area/desktop"],
  [/^vscode-extension\//, "area/vscode-extension"],
  [/^(bin|statusline)\//, "area/cli"],
  [/^plugins\//, "area/plugins"],
  [/^(deployments|monitoring)\/|^Dockerfile|^docker-compose/, "area/deploy"],
  [/^(\.github|\.husky|\.claude)\//, "area/ci"],
  [/^scripts\//, "area/scripts"],
  [/^(docs|wiki)\/|\.md$/, "area/docs"],
];

// Applied on top of the primary area, so `server/db.js` is both server and
// database and `server/__tests__/x.test.js` is both server and tests.
const AREA_EXTRA_PATTERNS = [
  [/\.md$/, "area/docs"],
  [/(^|\/)__tests__\/|\.test\.[cm]?[jt]sx?$/, "area/tests"],
  [/^server\/db\.js$|^docs\/DATABASE\.md$/, "area/database"],
];

// The repository's PULL_REQUEST_TEMPLATE "Type of Change" checkboxes. The
// distinctive substring of each option maps to the label it implies; the
// breaking-change box sets the flag rather than the type, so a breaking fix
// still reads as a fix.
const TYPE_CHECKBOXES = [
  ["new feature", "type/feature"],
  ["bug fix", "type/fix"],
  ["refactor", "type/refactor"],
  ["infrastructure", "type/ci"],
  ["dependency update", "type/dependencies"],
  ["documentation update", "type/docs"],
];

// Conventional-commit prefixes, as used by this repository's own history.
const TYPE_BY_CONVENTIONAL_PREFIX = {
  feat: "type/feature",
  feature: "type/feature",
  fix: "type/fix",
  hotfix: "type/fix",
  bugfix: "type/fix",
  perf: "type/perf",
  refactor: "type/refactor",
  style: "type/refactor",
  docs: "type/docs",
  doc: "type/docs",
  test: "type/test",
  tests: "type/test",
  ci: "type/ci",
  build: "type/ci",
  infra: "type/ci",
  deps: "type/dependencies",
  dependencies: "type/dependencies",
  chore: "type/chore",
  revert: "type/chore",
  release: "type/chore",
};

// Issue-form "Area" dropdown options mapped onto the same area namespace the
// path rules produce, so an issue and the pull request that closes it land in
// the same bucket.
const ISSUE_AREA_OPTIONS = [
  ["server / api", "area/server"],
  ["client / ui", "area/client"],
  ["websocket / real-time", "area/server"],
  ["hook integration", "area/hooks"],
  ["sessions / agents", "area/server"],
  ["analytics / tokens", "area/server"],
  ["settings / pricing", "area/server"],
  ["database / sqlite", "area/database"],
  ["docker / deployment", "area/deploy"],
];

// Issue-form priority dropdown, matched on a distinctive prefix so the option's
// punctuation (an em dash) cannot break the mapping.
const ISSUE_PRIORITY_OPTIONS = [
  ["blocking", "priority/high"],
  ["would significantly improve", "priority/medium"],
  ["nice to have", "priority/low"],
];

// The English README is the source of truth; each of these must move with it.
const README_MIRRORS = ["README-CN.md", "README-VN.md", "README-KO.md", "README-ES.md"];
const LOCALE_DIRECTORIES = ["en", "es", "ko", "vi", "zh"];

// Source a reviewer would expect a test to accompany.
const PRODUCT_SOURCE_PATTERNS = [
  /^server\/.*\.[cm]?js$/,
  /^client\/src\/.*\.[jt]sx?$/,
  /^mcp\/src\/.*\.ts$/,
  /^scripts\/.*\.[cm]?js$/,
  /^bin\/.*\.[cm]?js$/,
];

const TEST_PATTERN = /(^|\/)__tests__\/|\.test\.[cm]?[jt]sx?$/;
const DEPENDENCY_MANIFEST_PATTERN = /(^|\/)package(-lock)?\.json$/;

function matchesAny(patterns, value) {
  return patterns.some((pattern) => pattern.test(value));
}

function isGenerated(filename) {
  return matchesAny(GENERATED_PATTERNS, filename);
}

/**
 * Lines that reflect authored work: everything except generated, vendored and
 * binary files.
 */
function significantLines(files) {
  return files
    .filter((file) => !isGenerated(file.filename))
    .reduce((total, file) => total + (file.additions || 0) + (file.deletions || 0), 0);
}

function sizeLabel(files) {
  const lines = significantLines(files);
  const [, label] = SIZE_BUCKETS.find(([limit]) => lines < limit);
  return label;
}

/**
 * Areas ranked by the meaningful lines changed in each, then by file count,
 * then alphabetically — so the same diff always yields the same labels.
 *
 * Ranking by lines rather than by file count matters on a sweeping change: a
 * release bump rewrites one version string across dozens of generated plugin
 * manifests, and counting files would let that mechanical bulk claim every
 * slot ahead of the directory the change actually lives in.
 */
function areaLabels(files) {
  const stats = new Map();
  const bump = (area, lines) => {
    const current = stats.get(area) || { lines: 0, count: 0 };
    stats.set(area, { lines: current.lines + lines, count: current.count + 1 });
  };
  for (const file of files) {
    const lines = isGenerated(file.filename) ? 0 : (file.additions || 0) + (file.deletions || 0);
    const primary = AREA_PATTERNS.find(([pattern]) => pattern.test(file.filename));
    if (primary) bump(primary[1], lines);
    for (const [pattern, area] of AREA_EXTRA_PATTERNS) {
      if (pattern.test(file.filename) && (!primary || primary[1] !== area)) bump(area, lines);
    }
  }
  return [...stats.entries()]
    .sort((a, b) => b[1].lines - a[1].lines || b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .slice(0, MAX_AREAS)
    .map(([area]) => area);
}

/**
 * Reads a GitHub issue-form answer: the text between an `### Heading` and the
 * next heading. Returns "" when the section is absent or left blank.
 */
function sectionValue(body, heading) {
  const pattern = new RegExp(
    `^#{1,6}\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`,
    "im"
  );
  const match = pattern.exec(body || "");
  if (!match) return "";
  const rest = body.slice(match.index + match[0].length);
  const next = /^#{1,6}\s+\S/m.exec(rest);
  return (next ? rest.slice(0, next.index) : rest).trim();
}

/** Checked boxes of a markdown task list, lowercased. */
function checkedBoxes(body) {
  return (body || "")
    .split("\n")
    .filter((line) => /^\s*[-*]\s*\[[xX]\]/.test(line))
    .map((line) => line.replace(/^\s*[-*]\s*\[[xX]\]\s*/, "").toLowerCase());
}

/**
 * Checked boxes of the template's "Type of Change" section only. Scoping this
 * matters: the Checklist further down the same template is also a task list,
 * and reading both would let "I have updated documentation…" masquerade as a
 * declared change type.
 */
function typeCheckboxes(body) {
  const section = sectionValue(body, "Type of Change");
  return section ? checkedBoxes(section) : [];
}

/** The `type(scope)!:` prefix of a conventional-commit style title. */
function conventionalPrefix(title) {
  const match = /^\s*([a-z]+)\s*(\([^)]*\))?\s*(!?)\s*:/i.exec(title || "");
  if (!match) return null;
  return { type: match[1].toLowerCase(), breaking: match[3] === "!" };
}

/** The `feat/`, `fix/`, `chore/` … segment of a branch name. */
function branchPrefix(branch) {
  const match = /^([a-z]+)\//i.exec(branch || "");
  return match ? match[1].toLowerCase() : null;
}

/**
 * One type label, by descending trust: the author's own checkbox, then the
 * conventional-commit title, then the branch name, then what the files imply.
 */
function typeLabel({ title, body, branch, files }) {
  const checked = typeCheckboxes(body);
  for (const [needle, label] of TYPE_CHECKBOXES) {
    if (checked.some((box) => box.startsWith(needle))) return label;
  }
  const prefix = conventionalPrefix(title);
  if (prefix && TYPE_BY_CONVENTIONAL_PREFIX[prefix.type]) {
    return TYPE_BY_CONVENTIONAL_PREFIX[prefix.type];
  }
  const branchType = branchPrefix(branch);
  if (branchType && TYPE_BY_CONVENTIONAL_PREFIX[branchType]) {
    return TYPE_BY_CONVENTIONAL_PREFIX[branchType];
  }
  const authored = files.filter((file) => !isGenerated(file.filename));
  if (!authored.length) return null;
  const every = (pattern) => authored.every((file) => pattern.test(file.filename));
  if (every(/\.md$|^(docs|wiki)\//)) return "type/docs";
  if (every(TEST_PATTERN)) return "type/test";
  if (every(/^(\.github|\.husky)\//)) return "type/ci";
  if (every(DEPENDENCY_MANIFEST_PATTERN)) return "type/dependencies";
  return null;
}

function isBreaking({ title, body }) {
  const prefix = conventionalPrefix(title);
  if (prefix && prefix.breaking) return true;
  // The Conventional Commits footer, which always carries a colon. Requiring it
  // keeps prose ("this is not a breaking change") from tripping the flag.
  if (/(^|\n)\s*BREAKING[ -]CHANGE\s*:/.test(body || "")) return true;
  // `startsWith`, never `includes`: the template's own "Bug fix (non-breaking
  // change that fixes an issue)" option contains the words "breaking change".
  return typeCheckboxes(body).some((box) => box.startsWith("breaking change"));
}

/**
 * A release pull request: the root manifest moves and the title names the
 * release. Both halves are required so an ordinary dependency bump that edits
 * package.json is not mistaken for one.
 */
function isRelease({ title, files }) {
  const touchesManifest = files.some((file) => file.filename === "package.json");
  const named = /^\s*(chore\s*\(\s*release\s*\)|release)\s*:/i.test(title || "");
  const versioned = /\bv?\d+\.\d+\.\d+\b/.test(title || "");
  return touchesManifest && (named || versioned);
}

function isDependencyOnly(files) {
  const authored = files.filter((file) => !isGenerated(file.filename));
  const considered = authored.length ? authored : files;
  return (
    considered.length > 0 && considered.every((f) => DEPENDENCY_MANIFEST_PATTERN.test(f.filename))
  );
}

/**
 * Source changed with no test alongside it. Documentation, CI, dependency and
 * release changes are exempt — they are not expected to carry tests.
 */
function needsTests({ files, type, release }) {
  if (release) return false;
  if (["type/docs", "type/ci", "type/dependencies", "type/test"].includes(type)) return false;
  const names = files.map((file) => file.filename);
  if (names.some((name) => TEST_PATTERN.test(name))) return false;
  return names.some(
    (name) => !TEST_PATTERN.test(name) && matchesAny(PRODUCT_SOURCE_PATTERNS, name)
  );
}

function touchesI18n(files) {
  return files.some(
    (file) =>
      README_MIRRORS.includes(file.filename) ||
      file.filename.startsWith("client/src/i18n/") ||
      file.filename === "wiki/i18n-content.js"
  );
}

/**
 * A localized surface moved without its siblings: the English README without
 * all four mirrors, or one locale bundle without the rest. Both are literal
 * file-set comparisons, never a guess about the content of the change.
 */
function needsI18nParity(files) {
  const names = new Set(files.map((file) => file.filename));
  if (names.has("README.md") && !README_MIRRORS.every((mirror) => names.has(mirror))) return true;
  const touchedLocales = LOCALE_DIRECTORIES.filter((locale) =>
    [...names].some((name) => name.startsWith(`client/src/i18n/locales/${locale}/`))
  );
  return touchedLocales.length > 0 && touchedLocales.length < LOCALE_DIRECTORIES.length;
}

function issueLabels({ body }) {
  const labels = [];
  const area = sectionValue(body, "Area").toLowerCase();
  const areaMatch = ISSUE_AREA_OPTIONS.find(([option]) => area.startsWith(option));
  if (areaMatch) labels.push(areaMatch[1]);
  const priority = sectionValue(body, "How important is this to you?").toLowerCase();
  const priorityMatch = ISSUE_PRIORITY_OPTIONS.find(([option]) => priority.startsWith(option));
  if (priorityMatch) labels.push(priorityMatch[1]);
  return labels;
}

/**
 * The full desired label set for one issue or pull request.
 *
 * @param {object} input
 * @param {"issue"|"pull_request"} input.kind
 * @param {string} [input.title]
 * @param {string} [input.body]
 * @param {string} [input.branch] head branch, pull requests only
 * @param {Array<{filename: string, additions?: number, deletions?: number}>} [input.files]
 * @returns {string[]} label names, sorted, all present in LABELS
 */
function computeLabels({ kind, title = "", body = "", branch = "", files = [] }) {
  if (kind === "issue") return issueLabels({ body }).sort();

  const labels = [sizeLabel(files), ...areaLabels(files)];
  const type = typeLabel({ title, body, branch, files });
  if (type) labels.push(type);
  const release = isRelease({ title, files });
  if (release) labels.push("release");
  if (isBreaking({ title, body })) labels.push("breaking-change");
  if (isDependencyOnly(files)) labels.push("dependencies");
  if (needsTests({ files, type, release })) labels.push("needs-tests");
  if (touchesI18n(files)) labels.push("i18n");
  if (needsI18nParity(files)) labels.push("needs-i18n-parity");

  return [...new Set(labels)].filter((label) => label in LABELS).sort();
}

function isManaged(label) {
  return (
    MANAGED_PREFIXES.some((prefix) => label.startsWith(prefix)) || MANAGED_LABELS.includes(label)
  );
}

/**
 * What to change on an issue that already carries `current` labels: add the
 * desired labels it lacks, and drop only managed labels that no longer apply.
 * Labels outside the managed namespaces are never returned for removal.
 *
 * @returns {{add: string[], remove: string[]}}
 */
function reconcile(current, desired) {
  const currentSet = new Set(current);
  const desiredSet = new Set(desired);
  return {
    add: desired.filter((label) => !currentSet.has(label)),
    remove: current.filter((label) => isManaged(label) && !desiredSet.has(label)),
  };
}

module.exports = {
  LABELS,
  MANAGED_PREFIXES,
  MANAGED_LABELS,
  MAX_AREAS,
  computeLabels,
  reconcile,
  isManaged,
  // Exported for focused tests of the individual rules.
  significantLines,
  sizeLabel,
  areaLabels,
  typeLabel,
  isBreaking,
  isRelease,
  isDependencyOnly,
  needsTests,
  touchesI18n,
  needsI18nParity,
  sectionValue,
};
