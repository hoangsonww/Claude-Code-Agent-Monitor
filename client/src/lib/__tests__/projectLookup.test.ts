/**
 * @file projectLookup.test.ts
 * @description Unit tests for the extracted cwd→project join
 * (`client/src/lib/projectLookup.ts`) — not yet built as of this test's
 * authoring; see `supporting/red-evidence.md`. Covers `buildCwdProjectIndex`/
 * `projectForSession` directly, plus the MANDATORY [DERIVED-DUAL-VIEW]
 * frozen-reference regression case: a comment-dated, verbatim-copied
 * snapshot of `KanbanBoard.tsx`'s pre-extraction inline join (as it exists at
 * this effort's base commit `50a2800`), proving the new, extracted join
 * resolves every fixture session to the same project the old inline logic
 * did — including an unmapped cwd, a zero-`paths` project, and a
 * trailing-slash cwd. Per build-task-list.md Tasks 11/12/14: this file must
 * be authored BEFORE `KanbanBoard.tsx`'s refactor lands, so the frozen
 * reference is captured pre-refactor, not reconstructed from memory
 * afterward. If the regression case ever fails once `projectLookup.ts`
 * exists, the extraction changed Kanban's real behavior — fix
 * `projectLookup.ts` to match this frozen reference, do not edit the
 * reference to match `projectLookup.ts`.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect } from "vitest";
import { buildCwdProjectIndex, projectForSession } from "../projectLookup";
import type { Project, Session } from "../types";

// ── Fixture builders ────────────────────────────────────────────────────────

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj",
    name: "Project",
    paths: [],
    session_count: 0,
    active_count: 0,
    last_activity: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  } as Project;
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "sess",
    name: null,
    status: "active",
    cwd: null,
    model: null,
    started_at: "2026-06-10T10:00:00.000Z",
    ended_at: null,
    metadata: null,
    ...overrides,
  } as Session;
}

// ── FROZEN REFERENCE — do not "fix" to match projectLookup.ts ──────────────
// Verbatim copy of KanbanBoard.tsx's pre-extraction inline cwd→project join,
// as it exists at this effort's base commit 50a2800 (client/src/pages/
// KanbanBoard.tsx ~494-502 for the forward `sessionsByCwd` join, ~707-712 for
// each project's mapped-cwds derivation used to build the Projects view's
// per-column session list), dated 2026-07-29 — captured BEFORE Task 12's
// projectLookup.ts extraction lands. Per build-task-list.md's stop-and-report
// trigger: if this ever needs to change to keep passing, the extraction
// changed Kanban's real behavior; fix projectLookup.ts to match THIS
// reference, do not edit this reference to match projectLookup.ts.

// KanbanBoard.tsx ~494-502 (`sessionsByCwd`) — forward join, cwd -> sessions:
function oldSessionsByCwd(sessions: Session[]): Map<string, Session[]> {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    if (!s.cwd) continue;
    if (!map.has(s.cwd)) map.set(s.cwd, []);
    map.get(s.cwd)?.push(s);
  }
  return map;
}

// KanbanBoard.tsx ~707-712 (`projectColumns`) — each project's mapped cwds,
// flat-mapped against the forward join above to get that project's sessions:
function oldProjectSessions(project: Project, sessionsByCwd: Map<string, Session[]>): Session[] {
  const cwds = project.paths.map((p) => p.cwd);
  return cwds.flatMap((cwd) => sessionsByCwd.get(cwd) || []);
}

/** The OLD way to answer "which project owns this session" — reconstructed
 *  from the two verbatim snippets above. The actual pre-extraction code never
 *  poses the question this directly (the Projects view iterates PROJECTS,
 *  building each one's session list — it never asks "which project owns
 *  session X"), so this inverts it: find the project whose (old-logic)
 *  session list contains this exact session. */
function oldWay(
  session: Session,
  projects: Project[],
  allSessions: Session[]
): Project | undefined {
  const sessionsByCwd = oldSessionsByCwd(allSessions);
  return projects.find((p) =>
    oldProjectSessions(p, sessionsByCwd).some((s) => s.id === session.id)
  );
}

// ── Shared regression fixture: ≥5 sessions / ≥3 projects, including one
// unmapped cwd, one zero-`paths` project, and one trailing-slash cwd ────────

const projA = makeProject({ id: "projA", name: "A", paths: [{ id: 1, cwd: "/repo/a" }] });
const projB = makeProject({ id: "projB", name: "B", paths: [{ id: 2, cwd: "/repo/b" }] });
const projC = makeProject({ id: "projC", name: "C (zero paths)", paths: [] });
const projects = [projA, projB, projC];

const sMappedA = makeSession({ id: "s-mapped-a", cwd: "/repo/a" });
const sMappedB = makeSession({ id: "s-mapped-b", cwd: "/repo/b" });
const sUnmapped = makeSession({ id: "s-unmapped", cwd: "/repo/nowhere" });
// Trailing slash: a DIFFERENT string from "/repo/a" — exact string equality
// only, no path normalization, and both old and new logic must agree on that.
const sTrailingSlash = makeSession({ id: "s-trailing-slash", cwd: "/repo/a/" });
const sNoCwd = makeSession({ id: "s-no-cwd", cwd: null });
const fixtureSessions = [sMappedA, sMappedB, sUnmapped, sTrailingSlash, sNoCwd];

describe("regression: matches KanbanBoard's pre-extraction inline join (MANDATORY [DERIVED-DUAL-VIEW])", () => {
  for (const session of fixtureSessions) {
    it(`session "${session.id}" resolves to the same project via projectForSession as via the old inline join`, () => {
      const oldProject = oldWay(session, projects, fixtureSessions);
      const index = buildCwdProjectIndex(projects);
      const newProject = projectForSession(session, index);
      expect(newProject?.id).toBe(oldProject?.id);
    });
  }
});

// ── Direct unit coverage ─────────────────────────────────────────────────────

describe("buildCwdProjectIndex", () => {
  it("maps every mapped cwd to its owning project, reference-equal (not a copy)", () => {
    const index = buildCwdProjectIndex(projects);
    expect(index.get("/repo/a")).toBe(projA);
    expect(index.get("/repo/b")).toBe(projB);
  });

  it("an unmapped cwd is absent from the map entirely (not present with an undefined value)", () => {
    const index = buildCwdProjectIndex(projects);
    expect(index.has("/repo/nowhere")).toBe(false);
    expect(index.get("/repo/nowhere")).toBeUndefined();
  });

  it("a zero-paths project does not throw and contributes no entries", () => {
    expect(() => buildCwdProjectIndex([projC])).not.toThrow();
    const index = buildCwdProjectIndex([projC]);
    expect(index.size).toBe(0);
  });
});

describe("projectForSession", () => {
  it("resolves the owning project for a mapped cwd", () => {
    const index = buildCwdProjectIndex(projects);
    expect(projectForSession(sMappedA, index)?.id).toBe("projA");
  });

  it("returns undefined for a null cwd", () => {
    const index = buildCwdProjectIndex(projects);
    expect(projectForSession(sNoCwd, index)).toBeUndefined();
  });

  it("returns undefined for an unmapped cwd", () => {
    const index = buildCwdProjectIndex(projects);
    expect(projectForSession(sUnmapped, index)).toBeUndefined();
  });

  it("treats a trailing-slash cwd as distinct from its non-slashed counterpart (no path normalization)", () => {
    const index = buildCwdProjectIndex(projects);
    expect(projectForSession(sTrailingSlash, index)).toBeUndefined();
  });
});
