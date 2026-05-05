/**
 * @file Tests for the read-only memory browse routes. Covers the disabled-by-
 * default gate, project listing, file listing, file read, traversal/validation
 * rejection, and the CLAUDE.md viewer endpoint.
 *
 * We point CLAUDE_HOME at a tmp dir we populate ourselves so the tests don't
 * depend on the developer's actual ~/.claude state.
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const express = require("express");

// --- Test fixtures ----------------------------------------------------------

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), "memory-test-"));
const PROJECTS_DIR = path.join(TMP_HOME, "projects");
const ENCODED_PROJECT = "-Users-test-Projects-Foo";
const PROJECT_DIR = path.join(PROJECTS_DIR, ENCODED_PROJECT);
const MEMORY_DIR = path.join(PROJECT_DIR, "memory");

fs.mkdirSync(MEMORY_DIR, { recursive: true });
fs.writeFileSync(path.join(MEMORY_DIR, "MEMORY.md"), "# Index\n\n- topic-a");
fs.writeFileSync(path.join(MEMORY_DIR, "topic-a.md"), "# Topic A\n\nbody");
fs.writeFileSync(path.join(TMP_HOME, "CLAUDE.md"), "# user CLAUDE.md\n");

async function withApp(envOverrides, fn) {
  const prev = {};
  for (const [k, v] of Object.entries(envOverrides)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  // Reload route module so it observes the new env.
  delete require.cache[require.resolve("../routes/memory")];
  const router = require("../routes/memory");
  const app = express();
  app.use("/api/memory", router);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// --- Tests ------------------------------------------------------------------

describe("memory routes", () => {
  describe("when ORCHESTRATOR_ENABLED is unset", () => {
    it("returns 404 for every endpoint", async () => {
      await withApp(
        { ORCHESTRATOR_ENABLED: undefined, CLAUDE_HOME: TMP_HOME },
        async (base) => {
          for (const p of [
            "/api/memory/projects",
            `/api/memory/projects/${ENCODED_PROJECT}/files`,
            `/api/memory/projects/${ENCODED_PROJECT}/files/MEMORY.md`,
            "/api/memory/claude-md",
          ]) {
            const res = await fetch(base + p);
            assert.strictEqual(res.status, 404, `expected 404 for ${p}`);
            const body = await res.json();
            assert.strictEqual(body.error, "memory routes disabled");
          }
        }
      );
    });
  });

  describe("when enabled", () => {
    it("lists projects with memory dirs", async () => {
      await withApp(
        { ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: TMP_HOME },
        async (base) => {
          const res = await fetch(`${base}/api/memory/projects`);
          assert.strictEqual(res.status, 200);
          const body = await res.json();
          assert.ok(Array.isArray(body.projects));
          const found = body.projects.find((p) => p.id === ENCODED_PROJECT);
          assert.ok(found, "expected fixture project to be listed");
          assert.strictEqual(found.fileCount, 2);
          assert.ok(found.totalBytes > 0);
          assert.ok(found.decodedPath.startsWith("/Users"));
        }
      );
    });

    it("returns empty list when projects dir is missing", async () => {
      const empty = fs.mkdtempSync(path.join(os.tmpdir(), "memory-empty-"));
      await withApp(
        { ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: empty },
        async (base) => {
          const res = await fetch(`${base}/api/memory/projects`);
          assert.strictEqual(res.status, 200);
          const body = await res.json();
          assert.deepStrictEqual(body.projects, []);
        }
      );
    });

    it("lists memory files for a project", async () => {
      await withApp(
        { ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: TMP_HOME },
        async (base) => {
          const res = await fetch(
            `${base}/api/memory/projects/${ENCODED_PROJECT}/files`
          );
          assert.strictEqual(res.status, 200);
          const body = await res.json();
          assert.strictEqual(body.project, ENCODED_PROJECT);
          assert.strictEqual(body.files.length, 2);
          const names = body.files.map((f) => f.name).sort();
          assert.deepStrictEqual(names, ["MEMORY.md", "topic-a.md"]);
          for (const f of body.files) {
            assert.ok(typeof f.size === "number");
            assert.ok(typeof f.mtime === "number");
          }
        }
      );
    });

    it("reads a specific memory file", async () => {
      await withApp(
        { ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: TMP_HOME },
        async (base) => {
          const res = await fetch(
            `${base}/api/memory/projects/${ENCODED_PROJECT}/files/topic-a.md`
          );
          assert.strictEqual(res.status, 200);
          const body = await res.json();
          assert.strictEqual(body.name, "topic-a.md");
          assert.match(body.content, /Topic A/);
          assert.ok(body.size > 0);
        }
      );
    });

    it("rejects invalid project ids (chars outside allowlist)", async () => {
      await withApp(
        { ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: TMP_HOME },
        async (base) => {
          // The PROJECT_ID_RE allowlist (alnum, _, ., -) blocks slashes,
          // spaces, null bytes, and any other shell/path metacharacters before
          // the value reaches `path.join`. URL "/" / ".." get normalized by
          // the router so we exercise the regex with a literal "$" instead.
          const res = await fetch(
            `${base}/api/memory/projects/${encodeURIComponent("foo$bar")}/files`
          );
          assert.strictEqual(res.status, 400);
          const body = await res.json();
          assert.strictEqual(body.error, "invalid project id");
        }
      );
    });

    it("rejects invalid file names (must end in .md, no slashes)", async () => {
      await withApp(
        { ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: TMP_HOME },
        async (base) => {
          const res = await fetch(
            `${base}/api/memory/projects/${ENCODED_PROJECT}/files/${encodeURIComponent("../../etc/passwd")}`
          );
          assert.strictEqual(res.status, 400);
          const body = await res.json();
          assert.strictEqual(body.error, "invalid file name");
        }
      );
    });

    it("returns 404 when memory file does not exist", async () => {
      await withApp(
        { ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: TMP_HOME },
        async (base) => {
          const res = await fetch(
            `${base}/api/memory/projects/${ENCODED_PROJECT}/files/nope.md`
          );
          assert.strictEqual(res.status, 404);
        }
      );
    });

    it("returns 404 when project has no memory dir", async () => {
      await withApp(
        { ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: TMP_HOME },
        async (base) => {
          // Create a project with no memory dir
          const noMem = "-other-Project";
          fs.mkdirSync(path.join(PROJECTS_DIR, noMem), { recursive: true });
          const res = await fetch(`${base}/api/memory/projects/${noMem}/files`);
          assert.strictEqual(res.status, 404);
        }
      );
    });

    it("serves CLAUDE.md (user-scoped) when present", async () => {
      await withApp(
        { ORCHESTRATOR_ENABLED: "1", CLAUDE_HOME: TMP_HOME },
        async (base) => {
          const res = await fetch(`${base}/api/memory/claude-md`);
          assert.strictEqual(res.status, 200);
          const body = await res.json();
          assert.ok(body.user);
          assert.match(body.user.content, /user CLAUDE.md/);
          // project/projectLocal depend on cwd — just verify the keys exist.
          assert.ok("project" in body);
          assert.ok("projectLocal" in body);
        }
      );
    });
  });
});

// Cleanup tmp dirs at the end of the file.
process.on("exit", () => {
  try {
    fs.rmSync(TMP_HOME, { recursive: true, force: true });
  } catch {
    // best effort
  }
});
