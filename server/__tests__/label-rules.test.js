/**
 * @file Pins the deterministic triage rules in `.github/scripts/label-rules.js`.
 * The workflow that applies them runs from the base branch, so these tests are
 * the only place a rules change is proven before it merges: every bucket,
 * precedence order, review signal, and the reconciliation that must never
 * remove a human's label.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const rules = require(path.resolve(__dirname, "..", "..", ".github", "scripts", "label-rules.js"));

/** Shorthand for a changed file with a line count. */
function file(filename, additions = 1, deletions = 0) {
  return { filename, additions, deletions };
}

/** A pull request payload with sensible empty defaults. */
function pr(overrides = {}) {
  return { kind: "pull_request", title: "", body: "", branch: "", files: [], ...overrides };
}

// The options exactly as .github/PULL_REQUEST_TEMPLATE.md words them. Using the
// real text is the point: three of them contain the words "breaking change".
const TYPE_OPTIONS = [
  "Bug fix (non-breaking change that fixes an issue)",
  "New feature (non-breaking change that adds functionality)",
  "Breaking change (fix or feature that would cause existing functionality to not work as expected)",
  "Refactor (no functional changes)",
  "Documentation update",
  "Infrastructure / CI / DevOps",
  "Dependency update",
];

/** The template's "Type of Change" block with the named options ticked. */
function typeOfChange(...checked) {
  const boxes = TYPE_OPTIONS.map(
    (option) => `- [${checked.some((c) => option.startsWith(c)) ? "x" : " "}] ${option}`
  );
  return ["## Type of Change", "", ...boxes, ""].join("\n");
}

describe("label catalogue", () => {
  it("defines a valid color and description for every label", () => {
    for (const [name, definition] of Object.entries(rules.LABELS)) {
      assert.match(definition.color, /^[0-9a-f]{6}$/, `${name} needs a 6-digit hex color`);
      assert.ok(definition.description.length > 0, `${name} needs a description`);
      assert.ok(definition.description.length <= 100, `${name} description is over GitHub's limit`);
    }
  });

  it("only ever proposes labels it can create", () => {
    const computed = rules.computeLabels(
      pr({
        title: "feat!: everything everywhere",
        body: "- [x] New feature\n\nBREAKING CHANGE: yes",
        branch: "feat/all",
        files: [file("server/routes/sessions.js", 700), file("README.md"), file("package.json")],
      })
    );
    for (const label of computed) {
      assert.ok(label in rules.LABELS, `${label} is missing from the catalogue`);
    }
  });

  it("treats exactly the size, area, type, priority and signal names as managed", () => {
    assert.ok(rules.isManaged("size/XL"));
    assert.ok(rules.isManaged("area/server"));
    assert.ok(rules.isManaged("type/fix"));
    assert.ok(rules.isManaged("priority/high"));
    assert.ok(rules.isManaged("needs-tests"));
    // Labels a maintainer applies by hand.
    assert.equal(rules.isManaged("good first issue"), false);
    assert.equal(rules.isManaged("help wanted"), false);
    assert.equal(rules.isManaged("question"), false);
    assert.equal(rules.isManaged("bug"), false);
    assert.equal(rules.isManaged("enhancement"), false);
    assert.equal(rules.isManaged("documentation"), false);
    assert.equal(rules.isManaged("needs-triage"), false);
  });
});

describe("size", () => {
  it("buckets by total changed lines", () => {
    assert.equal(rules.sizeLabel([file("a.js", 4, 5)]), "size/XS");
    assert.equal(rules.sizeLabel([file("a.js", 10, 0)]), "size/S");
    assert.equal(rules.sizeLabel([file("a.js", 40, 9)]), "size/S");
    assert.equal(rules.sizeLabel([file("a.js", 50, 0)]), "size/M");
    assert.equal(rules.sizeLabel([file("a.js", 100, 99)]), "size/M");
    assert.equal(rules.sizeLabel([file("a.js", 200, 0)]), "size/L");
    assert.equal(rules.sizeLabel([file("a.js", 599, 0)]), "size/L");
    assert.equal(rules.sizeLabel([file("a.js", 600, 0)]), "size/XL");
  });

  it("ignores lockfiles, build output, snapshots and generated manifests", () => {
    const generated = [
      file("package-lock.json", 5000),
      file("client/package-lock.json", 5000),
      file("client/dist/assets/index.js", 5000),
      file("client/src/pages/__snapshots__/screens.snap", 5000),
      file("wiki/i18n-content.js", 5000),
      file("plugins/foo/.claude-plugin/plugin.json", 5000),
      file("images/logo.png", 5000),
      file("signatures/version1/cla.json", 5000),
    ];
    assert.equal(rules.significantLines(generated), 0);
    assert.equal(rules.sizeLabel([...generated, file("server/db.js", 3)]), "size/XS");
  });

  it("keeps a version bump small instead of reading as XL", () => {
    // A release moves one version string in many files plus a huge lockfile.
    const releaseFiles = [
      file("package.json", 1, 1),
      file("package-lock.json", 400, 400),
      ...Array.from({ length: 15 }, (_, i) => file(`deployments/kubernetes/${i}.yaml`, 1, 1)),
    ];
    const raw = releaseFiles.reduce((total, f) => total + f.additions + f.deletions, 0);
    assert.equal(raw, 832, "the raw diff really is XL-sized");
    assert.equal(rules.significantLines(releaseFiles), 32);
    assert.equal(rules.sizeLabel(releaseFiles), "size/S");
  });
});

describe("areas", () => {
  it("maps each top-level surface to its area", () => {
    const cases = [
      ["server/routes/sessions.js", "area/server"],
      ["client/src/App.tsx", "area/client"],
      ["mcp/src/index.ts", "area/mcp"],
      ["desktop/main.js", "area/desktop"],
      ["vscode-extension/src/extension.ts", "area/vscode-extension"],
      ["bin/ccam.js", "area/cli"],
      ["statusline/statusline.js", "area/cli"],
      ["plugins/monitor/plugin.json", "area/plugins"],
      ["deployments/helm/values.yaml", "area/deploy"],
      ["monitoring/grafana.json", "area/deploy"],
      ["Dockerfile", "area/deploy"],
      ["docker-compose.yml", "area/deploy"],
      [".github/workflows/ci.yml", "area/ci"],
      [".husky/pre-commit", "area/ci"],
      ["scripts/seed.js", "area/scripts"],
      ["docs/API.md", "area/docs"],
      ["wiki/index.html", "area/docs"],
    ];
    for (const [filename, expected] of cases) {
      assert.deepEqual(rules.areaLabels([file(filename)]), [expected], filename);
    }
  });

  it("routes hook handlers and installers to area/hooks", () => {
    for (const name of [
      "scripts/hook-handler.js",
      "scripts/codex-hook-handler.js",
      "scripts/install-hooks.js",
      "scripts/install-codex-hooks.js",
      "scripts/hook-transport.js",
      "server/routes/hooks.js",
    ]) {
      assert.deepEqual(rules.areaLabels([file(name)]), ["area/hooks"], name);
    }
  });

  it("adds the database and tests areas on top of the primary one", () => {
    assert.deepEqual(rules.areaLabels([file("server/db.js")]).sort(), [
      "area/database",
      "area/server",
    ]);
    assert.deepEqual(rules.areaLabels([file("server/__tests__/db.test.js")]).sort(), [
      "area/server",
      "area/tests",
    ]);
    assert.deepEqual(rules.areaLabels([file("client/src/x.test.tsx")]).sort(), [
      "area/client",
      "area/tests",
    ]);
    assert.deepEqual(rules.areaLabels([file("server/README.md")]).sort(), [
      "area/docs",
      "area/server",
    ]);
  });

  it("never counts one file twice in the same area", () => {
    assert.deepEqual(rules.areaLabels([file("docs/API.md")]), ["area/docs"]);
  });

  it("caps at the busiest areas so a sweeping change stays readable", () => {
    const files = [
      ...Array.from({ length: 5 }, (_, i) => file(`server/lib/${i}.js`)),
      ...Array.from({ length: 4 }, (_, i) => file(`client/src/${i}.tsx`)),
      ...Array.from({ length: 3 }, (_, i) => file(`mcp/src/${i}.ts`)),
      ...Array.from({ length: 2 }, (_, i) => file(`desktop/${i}.js`)),
      file("bin/ccam.js"),
      file("plugins/a/plugin.json"),
      file("deployments/helm/values.yaml"),
    ];
    const areas = rules.areaLabels(files);
    assert.equal(areas.length, rules.MAX_AREAS);
    assert.deepEqual(areas, ["area/server", "area/client", "area/mcp", "area/desktop"]);
  });

  it("breaks ties alphabetically so the same diff always labels the same", () => {
    const files = [file("mcp/src/a.ts"), file("client/src/a.tsx")];
    assert.deepEqual(rules.areaLabels(files), ["area/client", "area/mcp"]);
  });

  it("ranks by meaningful lines, so generated bulk cannot crowd out the real work", () => {
    // A release rewrites one version string across 28 generated plugin
    // manifests; the change itself is a single server module.
    const files = [
      ...Array.from({ length: 28 }, (_, i) =>
        file(`plugins/p${i}/.claude-plugin/plugin.json`, 1, 1)
      ),
      file("server/lib/task-progress.js", 200, 40),
    ];
    assert.equal(rules.areaLabels(files)[0], "area/server");
  });

  it("still labels a purely generated change by what it touched", () => {
    const files = Array.from({ length: 3 }, (_, i) =>
      file(`plugins/p${i}/.claude-plugin/plugin.json`, 1, 1)
    );
    assert.deepEqual(rules.areaLabels(files), ["area/plugins"]);
  });
});

describe("type", () => {
  it("trusts the pull request template checkbox first", () => {
    // Title and branch both say feature; the author's own checkbox wins.
    assert.equal(
      rules.typeLabel({
        title: "feat: add thing",
        body: typeOfChange("Bug fix"),
        branch: "feat/thing",
        files: [],
      }),
      "type/fix"
    );
  });

  it("maps every template checkbox", () => {
    const cases = [
      ["Bug fix", "type/fix"],
      ["New feature", "type/feature"],
      ["Refactor", "type/refactor"],
      ["Documentation update", "type/docs"],
      ["Infrastructure", "type/ci"],
      ["Dependency update", "type/dependencies"],
    ];
    for (const [option, expected] of cases) {
      const body = typeOfChange(option);
      assert.equal(rules.typeLabel({ title: "", body, branch: "", files: [] }), expected, option);
    }
  });

  it("ignores unchecked boxes", () => {
    const body = typeOfChange();
    assert.equal(rules.typeLabel({ title: "", body, branch: "", files: [] }), null);
  });

  it("reads only the Type of Change section, not the Checklist below it", () => {
    // Every Checklist item is ticked on a well-filled template; none of them
    // declares a change type.
    const body = [
      typeOfChange(),
      "## Checklist",
      "",
      "- [x] I have read the contributing guidelines",
      "- [x] I have added/updated tests that prove my fix or feature works",
      "- [x] I have updated documentation where necessary",
      "- [x] My code follows the project's coding standards",
    ].join("\n");
    assert.equal(rules.typeLabel({ title: "Something", body, branch: "x", files: [] }), null);
  });

  it("falls back to the conventional-commit title", () => {
    const cases = [
      ["feat(server): add", "type/feature"],
      ["fix: repair", "type/fix"],
      ["fix(client)!: repair", "type/fix"],
      ["perf: speed up", "type/perf"],
      ["refactor: tidy", "type/refactor"],
      ["docs: explain", "type/docs"],
      ["test(codex): cover", "type/test"],
      ["ci: pin action", "type/ci"],
      ["build: bundle", "type/ci"],
      ["chore(release): v2.1.2", "type/chore"],
      ["deps: bump", "type/dependencies"],
    ];
    for (const [title, expected] of cases) {
      assert.equal(rules.typeLabel({ title, body: "", branch: "", files: [] }), expected, title);
    }
  });

  it("falls back to the branch prefix when the title says nothing", () => {
    assert.equal(
      rules.typeLabel({ title: "Make it faster", body: "", branch: "perf/parse", files: [] }),
      "type/perf"
    );
    assert.equal(
      rules.typeLabel({ title: "Update readme", body: "", branch: "docs/readme", files: [] }),
      "type/docs"
    );
  });

  it("infers from the files when nothing else is stated", () => {
    const infer = (files) => rules.typeLabel({ title: "Update", body: "", branch: "x", files });
    assert.equal(infer([file("README.md"), file("docs/API.md")]), "type/docs");
    assert.equal(infer([file("server/__tests__/a.test.js")]), "type/test");
    assert.equal(infer([file(".github/workflows/ci.yml")]), "type/ci");
    assert.equal(infer([file("package.json"), file("package-lock.json")]), "type/dependencies");
    assert.equal(infer([file("server/db.js")]), null);
  });

  it("does not let generated files defeat the docs inference", () => {
    const files = [file("README.md"), file("wiki/i18n-content.js"), file("package-lock.json")];
    assert.equal(rules.typeLabel({ title: "Update", body: "", branch: "x", files }), "type/docs");
  });

  it("applies at most one type label", () => {
    const labels = rules.computeLabels(
      pr({ title: "feat: add", body: "- [x] Bug fix", branch: "docs/x", files: [file("a.js")] })
    );
    assert.equal(labels.filter((label) => label.startsWith("type/")).length, 1);
  });
});

describe("breaking change", () => {
  it("detects the conventional-commit bang", () => {
    assert.ok(rules.isBreaking({ title: "feat!: drop v1", body: "" }));
    assert.ok(rules.isBreaking({ title: "feat(api)!: drop v1", body: "" }));
    assert.equal(rules.isBreaking({ title: "feat: keep v1", body: "" }), false);
  });

  it("detects the footer and the template checkbox", () => {
    assert.ok(rules.isBreaking({ title: "x", body: "BREAKING CHANGE: the API moved" }));
    assert.ok(rules.isBreaking({ title: "x", body: typeOfChange("Breaking change") }));
    assert.equal(rules.isBreaking({ title: "x", body: typeOfChange() }), false);
  });

  it("does not fire on the template's own 'non-breaking change' wording", () => {
    // "Bug fix (non-breaking change that fixes an issue)" and the New feature
    // option both contain the words "breaking change".
    assert.equal(rules.isBreaking({ title: "fix: x", body: typeOfChange("Bug fix") }), false);
    assert.equal(rules.isBreaking({ title: "feat: x", body: typeOfChange("New feature") }), false);
    assert.equal(
      rules.isBreaking({ title: "fix: x", body: "This is explicitly not a breaking change." }),
      false
    );
  });

  it("keeps the underlying type when the change is also breaking", () => {
    const labels = rules.computeLabels(
      pr({ title: "fix!: correct the shape", files: [file("server/a.js", 3)] })
    );
    assert.ok(labels.includes("type/fix"));
    assert.ok(labels.includes("breaking-change"));
  });
});

describe("release", () => {
  it("needs both the root manifest and a release title", () => {
    const files = [file("package.json"), file("desktop/package.json")];
    assert.ok(rules.isRelease({ title: "chore(release): v2.1.2", files }));
    assert.ok(rules.isRelease({ title: "Release 2.1.2", files }));
    // A dependency bump touches package.json but is not a release.
    assert.equal(rules.isRelease({ title: "deps: bump vite", files }), false);
    // A release title without the manifest is just a mention.
    assert.equal(
      rules.isRelease({ title: "chore(release): v2.1.2", files: [file("README.md")] }),
      false
    );
  });

  it("exempts a release from needs-tests", () => {
    const labels = rules.computeLabels(
      pr({
        title: "chore(release): v2.1.2",
        files: [file("package.json"), file("server/index.js", 1, 1)],
      })
    );
    assert.ok(labels.includes("release"));
    assert.ok(!labels.includes("needs-tests"));
  });
});

describe("dependencies", () => {
  it("flags a manifest-only change", () => {
    assert.ok(rules.isDependencyOnly([file("package.json"), file("package-lock.json")]));
    assert.ok(rules.isDependencyOnly([file("client/package-lock.json")]));
    assert.equal(rules.isDependencyOnly([file("package.json"), file("server/db.js")]), false);
    assert.equal(rules.isDependencyOnly([]), false);
  });
});

describe("needs-tests", () => {
  const withTests = (files, extra = {}) =>
    rules.needsTests({ files, type: null, release: false, ...extra });

  it("flags product source that arrives without a test", () => {
    assert.ok(withTests([file("server/routes/sessions.js")]));
    assert.ok(withTests([file("client/src/pages/Sessions.tsx")]));
    assert.ok(withTests([file("mcp/src/tools.ts")]));
    assert.ok(withTests([file("scripts/hook-handler.js")]));
    assert.ok(withTests([file("bin/ccam.js")]));
  });

  it("stays quiet when a test changed alongside", () => {
    assert.equal(
      withTests([file("server/routes/sessions.js"), file("server/__tests__/sessions.test.js")]),
      false
    );
    assert.equal(withTests([file("client/src/App.tsx"), file("client/src/App.test.tsx")]), false);
  });

  it("exempts docs, CI, dependency and test-only changes", () => {
    const files = [file("server/routes/sessions.js")];
    assert.equal(withTests(files, { type: "type/docs" }), false);
    assert.equal(withTests(files, { type: "type/ci" }), false);
    assert.equal(withTests(files, { type: "type/dependencies" }), false);
    assert.equal(withTests(files, { type: "type/test" }), false);
    assert.equal(withTests(files, { release: true }), false);
  });

  it("does not flag documentation or configuration on its own", () => {
    assert.equal(withTests([file("README.md"), file("docs/API.md")]), false);
    assert.equal(withTests([file(".github/workflows/ci.yml")]), false);
    assert.equal(withTests([file("openapi.yaml")]), false);
  });
});

describe("i18n", () => {
  it("flags any localized surface", () => {
    assert.ok(rules.touchesI18n([file("README-CN.md")]));
    assert.ok(rules.touchesI18n([file("client/src/i18n/locales/es/common.json")]));
    assert.ok(rules.touchesI18n([file("wiki/i18n-content.js")]));
    assert.equal(rules.touchesI18n([file("README.md")]), false);
  });

  it("asks for parity when the English README moves without its mirrors", () => {
    assert.ok(rules.needsI18nParity([file("README.md")]));
    assert.ok(rules.needsI18nParity([file("README.md"), file("README-CN.md")]));
    assert.equal(
      rules.needsI18nParity([
        file("README.md"),
        file("README-CN.md"),
        file("README-VN.md"),
        file("README-KO.md"),
        file("README-ES.md"),
      ]),
      false
    );
  });

  it("asks for parity when one locale bundle moves without the rest", () => {
    const locale = (code) => file(`client/src/i18n/locales/${code}/common.json`);
    assert.ok(rules.needsI18nParity([locale("en")]));
    assert.ok(rules.needsI18nParity([locale("en"), locale("es")]));
    assert.equal(
      rules.needsI18nParity([locale("en"), locale("es"), locale("ko"), locale("vi"), locale("zh")]),
      false
    );
  });

  it("does not ask for parity from a translation-only fix", () => {
    assert.equal(rules.needsI18nParity([file("README-CN.md")]), false);
  });
});

describe("issues", () => {
  const bugBody = [
    "### What happened?",
    "",
    "It broke.",
    "",
    "### Area",
    "",
    "Database / SQLite",
    "",
    "### Node version",
    "",
    "24",
  ].join("\n");

  it("reads the area dropdown", () => {
    assert.deepEqual(rules.computeLabels({ kind: "issue", body: bugBody }), ["area/database"]);
  });

  it("maps every area option the forms offer", () => {
    const expected = {
      "Server / API": "area/server",
      "Client / UI": "area/client",
      "WebSocket / Real-time": "area/server",
      "Hook Integration": "area/hooks",
      "Sessions / Agents": "area/server",
      "Analytics / Tokens": "area/server",
      "Settings / Pricing": "area/server",
      "Database / SQLite": "area/database",
      "Docker / Deployment": "area/deploy",
    };
    for (const [option, label] of Object.entries(expected)) {
      const body = `### Area\n\n${option}\n`;
      assert.deepEqual(rules.computeLabels({ kind: "issue", body }), [label], option);
    }
  });

  it("reads the feature form's priority dropdown", () => {
    const body = [
      "### Area",
      "",
      "Client / UI",
      "",
      "### How important is this to you?",
      "",
      "Blocking — I can't use the app without this",
    ].join("\n");
    assert.deepEqual(rules.computeLabels({ kind: "issue", body }), [
      "area/client",
      "priority/high",
    ]);
  });

  it("maps the remaining priority options", () => {
    const body = (answer) => `### How important is this to you?\n\n${answer}\n`;
    assert.deepEqual(rules.computeLabels({ kind: "issue", body: body("Nice to have") }), [
      "priority/low",
    ]);
    assert.deepEqual(
      rules.computeLabels({
        kind: "issue",
        body: body("Would significantly improve my workflow"),
      }),
      ["priority/medium"]
    );
  });

  it("labels nothing for Other, a blank answer, or a free-form issue", () => {
    assert.deepEqual(rules.computeLabels({ kind: "issue", body: "### Area\n\nOther\n" }), []);
    assert.deepEqual(
      rules.computeLabels({ kind: "issue", body: "### Area\n\n_No response_\n" }),
      []
    );
    assert.deepEqual(rules.computeLabels({ kind: "issue", body: "just a plain issue" }), []);
    assert.deepEqual(rules.computeLabels({ kind: "issue", body: "" }), []);
  });

  it("never puts a size or type label on an issue", () => {
    const labels = rules.computeLabels({
      kind: "issue",
      title: "fix: something",
      body: bugBody,
    });
    assert.ok(!labels.some((label) => label.startsWith("size/") || label.startsWith("type/")));
  });
});

describe("reconcile", () => {
  it("adds what is missing and removes only stale managed labels", () => {
    const { add, remove } = rules.reconcile(
      ["size/S", "area/server", "needs-tests", "good first issue", "help wanted"],
      ["size/L", "area/server", "type/fix"]
    );
    assert.deepEqual(add, ["size/L", "type/fix"]);
    assert.deepEqual(remove.sort(), ["needs-tests", "size/S"]);
  });

  it("never removes a label a human applied", () => {
    const current = [
      "bug",
      "documentation",
      "enhancement",
      "good first issue",
      "help wanted",
      "question",
      "needs-triage",
    ];
    const { add, remove } = rules.reconcile(current, ["size/XS"]);
    assert.deepEqual(add, ["size/XS"]);
    assert.deepEqual(remove, []);
  });

  it("is a no-op when the labels already match", () => {
    const labels = ["size/M", "area/server", "type/fix"];
    assert.deepEqual(rules.reconcile(labels, labels), { add: [], remove: [] });
  });

  it("drops every managed label when nothing applies", () => {
    const { remove } = rules.reconcile(["size/M", "priority/high", "release"], []);
    assert.deepEqual(remove.sort(), ["priority/high", "release", "size/M"]);
  });
});

describe("end to end", () => {
  it("labels a focused server bug fix", () => {
    assert.deepEqual(
      rules.computeLabels(
        pr({
          title: "fix(server): stop double-counting tokens",
          branch: "fix/token-double-count",
          files: [
            file("server/lib/tokens.js", 12, 4),
            file("server/__tests__/tokens.test.js", 30, 0),
          ],
        })
      ),
      ["area/server", "area/tests", "size/S", "type/fix"]
    );
  });

  it("labels a docs-only translation sweep", () => {
    assert.deepEqual(
      rules.computeLabels(
        pr({
          title: "docs: document the new env var",
          branch: "docs/env",
          files: [
            file("README.md", 2, 1),
            file("README-CN.md", 2, 1),
            file("README-VN.md", 2, 1),
            file("README-KO.md", 2, 1),
            file("README-ES.md", 2, 1),
          ],
        })
      ),
      ["area/docs", "i18n", "size/S", "type/docs"]
    );
  });

  it("flags an English-only README edit for parity", () => {
    const labels = rules.computeLabels(
      pr({ title: "docs: tweak", branch: "docs/tweak", files: [file("README.md", 2, 1)] })
    );
    assert.ok(labels.includes("needs-i18n-parity"));
  });

  it("labels a large untested refactor", () => {
    const labels = rules.computeLabels(
      pr({
        title: "refactor(client): restructure the dashboard",
        branch: "refactor/dashboard",
        files: Array.from({ length: 12 }, (_, i) => file(`client/src/pages/${i}.tsx`, 60, 20)),
      })
    );
    assert.deepEqual(labels, ["area/client", "needs-tests", "size/XL", "type/refactor"]);
  });

  it("labels this repository's own release pull request shape", () => {
    const labels = rules.computeLabels(
      pr({
        title: "chore(release): v2.1.2",
        body: typeOfChange("Bug fix"),
        branch: "chore/release-v2.1.2",
        files: [
          file("package.json", 1, 1),
          file("package-lock.json", 2, 2),
          file("desktop/package.json", 1, 1),
          file("openapi.yaml", 1, 1),
          ...Array.from({ length: 15 }, (_, i) => file(`deployments/kubernetes/${i}.yaml`, 1, 1)),
          file("server/db.js", 20, 6),
          file("server/__tests__/release-version-consistency.test.js", 4, 0),
        ],
      })
    );
    assert.ok(labels.includes("release"));
    assert.ok(labels.includes("type/fix"));
    assert.ok(labels.includes("size/M"));
    assert.ok(!labels.includes("needs-tests"));
    assert.ok(!labels.includes("dependencies"));
    // The regression that made this test worth writing.
    assert.ok(!labels.includes("breaking-change"));
  });
});
