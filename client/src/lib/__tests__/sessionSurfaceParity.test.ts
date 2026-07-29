/**
 * @file sessionSurfaceParity.test.ts
 * @description MANDATORY [DERIVED-DUAL-VIEW] standing cross-consumer guard
 * (this pattern's 4th occurrence: Focus Calendar-only ship →
 * `focus-report-fidelity` fix → Focus Calendar's 3rd-consumer parity test →
 * now WIP as the 4th consumer of the `Session`/`isSessionAwaitingInput`/
 * cwd→project surface). Not yet satisfiable as of this test's authoring,
 * since neither `wipQueue.ts` nor `projectLookup.ts` exist — see
 * `supporting/red-evidence.md`.
 *
 * One shared ≥8-session fixture (covering every non-primary AND every
 * primary `AwaitingReason`, derived from `AWAITING_REASON_CONFIG` rather than
 * hand-typed, plus a plain active non-awaiting session and a session whose
 * cwd maps to no project) proves two things per session:
 *
 *  (a) WIP's awaiting-bucket boolean matches a frozen, comment-dated copy of
 *      KanbanBoard.tsx's own primary-awaiting-reason-aware bucketing
 *      (`isSessionEffectivelyWaiting`). `wipQueue.ts` exposes no raw
 *      "is this session in the awaiting bucket" boolean (only
 *      `isWipMember`/`sortWipQueue`/`assignToColumns` per
 *      technical-plan.md's change set) — `sortWipQueue`'s ORDERING is the
 *      only observable signal, so this probes it directly: a fixture session
 *      is pitted against a sentinel session whose project priority is
 *      deliberately superior (a very large negative number) to any real
 *      priority. A session genuinely in the awaiting bucket always outranks
 *      ANY non-awaiting session regardless of priority, so it beats the
 *      sentinel; a session NOT in the awaiting bucket (not waiting, or
 *      carved out by a primary reason) can never beat the sentinel's
 *      artificially-superior priority. This is a documented ASSUMPTION about
 *      how to observe wipQueue.ts's behavior without a new export — if the
 *      implementer instead exposes a direct boolean (e.g. an
 *      `isQueueAwaiting` export), this probe technique may be simplified,
 *      but the assertion it stands in for must still hold.
 *
 *  (b) `projectLookup.projectForSession` resolves to the same project id a
 *      frozen, comment-dated copy of KanbanBoard.tsx's pre-extraction inline
 *      join resolves to (same technique as projectLookup.test.ts's own
 *      regression case, duplicated here intentionally so this file's parity
 *      check doesn't depend on another test file's internals) — plus a
 *      non-vacuity check (at least one resolved project defined, at least
 *      one undefined) so this assertion can't pass trivially on an
 *      all-undefined fixture bug.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it, expect } from "vitest";
import { sortWipQueue } from "../wipQueue";
import { buildCwdProjectIndex, projectForSession } from "../projectLookup";
import { isSessionAwaitingInput, normalizeAwaitingReason, AWAITING_REASON_CONFIG } from "../types";
import type { AwaitingReason, Project, Session } from "../types";

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

// ── FROZEN REFERENCE — Kanban's own bucketing predicate (verbatim, dated) ───
// Copy of KanbanBoard.tsx's `isPrimaryAwaitingReason`/
// `isSessionEffectivelyWaiting` (~508-542 at this effort's base commit
// 50a2800), dated 2026-07-29. Do not "fix" this to match wipQueue.ts — if it
// ever needs to change, wipQueue.ts (not this reference) has drifted from
// Kanban's real bucketing.
function kanbanIsPrimaryAwaitingReason(reasonRaw: string | null | undefined): boolean {
  const reason = normalizeAwaitingReason(reasonRaw);
  return !!reason && AWAITING_REASON_CONFIG[reason].primary === true;
}
function kanbanIsSessionEffectivelyWaiting(s: Session): boolean {
  return isSessionAwaitingInput(s) && !kanbanIsPrimaryAwaitingReason(s.awaiting_reason);
}

// ── FROZEN REFERENCE — Kanban's own cwd→project join (verbatim, dated) ─────
// Same frozen reference as projectLookup.test.ts's `oldWay` (KanbanBoard.tsx
// ~494-502 / ~707-712 at commit 50a2800), duplicated here intentionally so
// this file's parity check doesn't depend on another test file's internals.
function oldSessionsByCwd(sessions: Session[]): Map<string, Session[]> {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    if (!s.cwd) continue;
    if (!map.has(s.cwd)) map.set(s.cwd, []);
    map.get(s.cwd)?.push(s);
  }
  return map;
}
function oldProjectSessions(project: Project, sessionsByCwd: Map<string, Session[]>): Session[] {
  const cwds = project.paths.map((p) => p.cwd);
  return cwds.flatMap((cwd) => sessionsByCwd.get(cwd) || []);
}
function oldWayProjectForSession(
  session: Session,
  projects: Project[],
  allSessions: Session[]
): Project | undefined {
  const sessionsByCwd = oldSessionsByCwd(allSessions);
  return projects.find((p) =>
    oldProjectSessions(p, sessionsByCwd).some((s) => s.id === session.id)
  );
}

// ── WIP-side awaiting-bucket probe (see @file comment for why) ─────────────

const PROBE_CWD = "__sessionSurfaceParity_probe_cwd__";

function probeIsWipAwaiting(session: Session, projectIndex: Map<string, Project>): boolean {
  const probeProject = makeProject({
    id: "__probe_project__",
    paths: [{ id: -1, cwd: PROBE_CWD }],
    // Deliberately far better (more negative) than any real fixture
    // priority — see @file comment for why this makes the probe a clean
    // binary signal.
    priority: -1_000_000,
  } as Partial<Project>);
  const probeSession = makeSession({ id: "__probe_session__", cwd: PROBE_CWD });
  const mergedIndex = new Map(projectIndex);
  mergedIndex.set(PROBE_CWD, probeProject);

  const sorted = sortWipQueue([session, probeSession], mergedIndex);
  return sorted[0]?.id === session.id;
}

// ── Shared ≥8-session fixture: every AwaitingReason (non-primary + primary,
// derived from AWAITING_REASON_CONFIG) + a plain active session + a
// no-project session ─────────────────────────────────────────────────────

const ALL_REASONS = Object.keys(AWAITING_REASON_CONFIG) as AwaitingReason[];

const sharedProject = makeProject({
  id: "proj-shared",
  name: "Shared",
  paths: [{ id: 1, cwd: "/repo/shared" }],
});
const projects = [sharedProject];

function reasonSession(reason: AwaitingReason): Session {
  return makeSession({
    id: `reason-${reason}`,
    cwd: "/repo/shared",
    awaiting_input_since: "2026-06-10T10:05:00.000Z",
    awaiting_reason: reason,
  } as Partial<Session>);
}

const plainActive = makeSession({ id: "plain-active", cwd: "/repo/shared" });
const noProjectSession = makeSession({ id: "no-project", cwd: "/repo/unmapped-nowhere" });

const fixtureSessions: Session[] = [
  ...ALL_REASONS.map(reasonSession),
  plainActive,
  noProjectSession,
];

describe("fixture sanity", () => {
  it("the shared fixture has at least 8 sessions and covers every AwaitingReason", () => {
    expect(fixtureSessions.length).toBeGreaterThanOrEqual(8);
    expect(ALL_REASONS.length).toBeGreaterThan(0);
  });
});

describe("[DERIVED-DUAL-VIEW] cross-consumer parity (a): awaiting-bucket partition", () => {
  const index = buildCwdProjectIndex(projects);
  for (const session of fixtureSessions) {
    it(`session "${session.id}" (reason=${session.awaiting_reason ?? "none"}) — WIP's awaiting bucket matches Kanban's`, () => {
      const kanban = kanbanIsSessionEffectivelyWaiting(session);
      const wip = probeIsWipAwaiting(session, index);
      expect(
        wip,
        `session ${session.id} (reason=${session.awaiting_reason ?? "none"}): wip=${wip} kanban=${kanban}`
      ).toBe(kanban);
    });
  }
});

describe("[DERIVED-DUAL-VIEW] cross-consumer parity (b): project resolution", () => {
  const index = buildCwdProjectIndex(projects);
  for (const session of fixtureSessions) {
    it(`session "${session.id}" resolves to the same project WIP and Kanban's own join both agree on`, () => {
      const kanbanProject = oldWayProjectForSession(session, projects, fixtureSessions);
      const wipProject = projectForSession(session, index);
      expect(
        wipProject?.id,
        `session ${session.id}: wip=${wipProject?.id} kanban=${kanbanProject?.id}`
      ).toBe(kanbanProject?.id);
    });
  }

  it("non-vacuity: at least one fixture session resolves to a defined project and at least one resolves to undefined", () => {
    const resolved = fixtureSessions.map((s) => projectForSession(s, index));
    expect(resolved.some((p) => p !== undefined)).toBe(true);
    expect(resolved.some((p) => p === undefined)).toBe(true);
  });
});
