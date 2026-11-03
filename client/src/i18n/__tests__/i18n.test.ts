/**
 * @file i18n.test.ts
 * @description Unit tests for i18n translation resources to ensure correct translations and locale handling in the agent dashboard application.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
/*
 * GENERATED_MAINTAINER_REFERENCE:BEGIN
 *
 * AUTO-GENERATED MAINTAINER REFERENCE — DO NOT EDIT THIS BLOCK BY HAND.
 * It is derived from the current TypeScript AST and repository-area contracts.
 * Regenerate after structural edits so imports, exports, landmarks, and checks stay current.
 *
 * **Module:** client/src/i18n/__tests__/i18n.test.ts
 * **Area:** client test
 * **Responsibility:**
 * Unit tests for i18n translation resources to ensure correct translations and locale handling in
 * the agent dashboard application.
 *
 * ## Architectural boundary
 * - Protects an observable client contract using Vitest and, for UI, Testing Library semantics.
 * - The test should fail for a meaningful production regression, not for harmless implementation
 *   rearrangement.
 * - Mocks isolate unavailable boundaries; they should not replace the behavior that the test claims
 *   to prove.
 *
 * ## Package dependency edges
 * - `i18next` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 * - `vitest` — external package boundary; keep usage within the installed version and the
 *   repository's existing adapter patterns.
 *
 * ## Top-level implementation landmarks
 * - `flattenResource` (variable) — top-level declaration that helps orient code review and focused
 *   test selection.
 * - `interpolationTokens` (variable) — top-level declaration that helps orient code review and
 *   focused test selection.
 *
 * ## Named test contracts
 * - `i18n resources` — executable behavior named by this suite; preserve the observable contract or
 *   update the test with rationale.
 * - `keeps every locale's keys, value types, and interpolation tokens aligned with English` —
 *   executable behavior named by this suite; preserve the observable contract or update the test
 *   with rationale.
 * - `pluralizes task-progress counts in English and Spanish` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `pluralizes the Kanban and Sessions header counts` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `pluralizes the subagent count labels in English` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `ships every first-run hook setup control in each supported locale` — executable behavior named
 *   by this suite; preserve the observable contract or update the test with rationale.
 * - `ships the global provider and session-home settings in every supported locale` — executable
 *   behavior named by this suite; preserve the observable contract or update the test with
 *   rationale.
 * - `should keep Agent terminology untranslated in zh, vi, ko, and es locales` — executable
 *   behavior named by this suite; preserve the observable contract or update the test with
 *   rationale.
 * - `should provide Korean translations for navigation keys` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `should provide Spanish translations across every feature namespace` — executable behavior
 *   named by this suite; preserve the observable contract or update the test with rationale.
 * - `should provide Spanish translations for navigation keys` — executable behavior named by this
 *   suite; preserve the observable contract or update the test with rationale.
 * - `should provide Vietnamese translations for navigation keys` — executable behavior named by
 *   this suite; preserve the observable contract or update the test with rationale.
 * - `should support non-explicit Korean locale tags` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `should support non-explicit Spanish locale tags` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 * - `should support non-explicit Vietnamese locale tags` — executable behavior named by this suite;
 *   preserve the observable contract or update the test with rationale.
 *
 * ## Area invariants
 * - Name the user-visible or contract-level behavior in each test title so failures explain the
 *   regression.
 * - Query rendered UI by role, accessible name, or meaningful text before reaching for
 *   implementation selectors.
 * - Reset mocks, timers, globals, storage, and DOM state so execution order cannot change outcomes.
 * - Await asynchronous rendering and user interactions instead of relying on arbitrary sleeps.
 * - Keep fixtures minimal but structurally realistic, including provider and source fields used by
 *   production branches.
 * - Assert important negative behavior when duplicate events, stale responses, or absent data are
 *   the known risk.
 * - Avoid snapshots for volatile values unless serializers normalize them and review remains
 *   readable.
 * - Exercise keyboard and accessibility behavior for controls whose semantics matter beyond visual
 *   output.
 * - Do not assert internal hook state when the same contract can be observed through rendered
 *   output or callbacks.
 * - When fixing a regression, prove the test fails on the broken implementation before accepting
 *   the fix.
 *
 * ## Change-review checklist
 * - Read the file header and this generated index before changing code; both describe the intended
 *   ownership boundary.
 * - Trace every local import listed here to distinguish data contracts from presentation helpers
 *   and avoid circular dependencies.
 * - Search every exported symbol before changing its signature; callers may live in tests, route
 *   components, desktop code, or MCP wiring.
 * - Keep observable behavior stable unless the task explicitly requests a behavior change and
 *   includes regression coverage.
 * - Prefer the repository's existing helpers and types over parallel abstractions that encode the
 *   same contract twice.
 * - Keep failure behavior explicit: recoverable local failures should degrade visibly without
 *   hiding actionable diagnostics.
 * - Preserve deterministic ordering for lists, maps, serialized values, snapshots, and generated
 *   output where this module participates.
 * - Treat identifiers, API paths, event names, translation keys, and persisted field names as
 *   compatibility surfaces.
 * - Update the truthful file overview when the module's responsibility changes; never let the
 *   header become historical fiction.
 * - Run the narrowest relevant test first, then the area gate, then the full repository
 *   verification before merging.
 *
 * ## Focused validation
 * - Run `npm run test:client` and resolve failures before widening the verification scope.
 * - Run `npm run typecheck:client` and resolve failures before widening the verification scope.
 * - Run `npm run verify` and resolve failures before widening the verification scope.
 *
 * ## Reference maintenance
 * - Regenerate all tracked references with `node scripts/maintain-typescript-docs.ts --write` .
 * - Check this module without writing via
 *   `node scripts/maintain-typescript-docs.ts --check client/src/i18n/__tests__/i18n.test.ts` .
 * - Prove existing-file edits are comments/trivia only with
 *   `node scripts/verify-typescript-comment-only.ts origin/master` .
 * - Review the regenerated diff: generated structure is evidence, not a substitute for
 *   understanding runtime behavior.
 *
 * GENERATED_MAINTAINER_REFERENCE:END
 */

/* =============================================================================
 * TEST_CONTRACT_GUIDE — executable-specification map (documentation only)
 * =============================================================================
 * Path: `client/src/i18n/__tests__/i18n.test.ts`
 *
 * Scope
 * Unit tests for i18n translation resources to ensure correct translations and locale handling in
 * the agent dashboard application.
 *
 * Subjects and collaborators
 * - The suite exercises behavior exposed directly by its package or test environment.
 *
 * Harness and isolation
 * - Vitest supplies suite lifecycle, spies, mocks, and assertions; every case must be
 *   order-independent.
 *
 * Suite groups
 * - `i18n resources`
 *
 * Protected behavior
 * - keeps every locale's keys, value types, and interpolation tokens aligned with English
 * - should provide Vietnamese translations for navigation keys
 * - keeps Agent terminology untranslated in zh, vi, and ko; Spanish UI nouns remain `agente` and
 *   `subagente`, while the `Agent` tool name stays untranslated
 * - should provide Spanish translations for navigation keys
 * - should provide Spanish translations across every feature namespace
 * - should support non-explicit Spanish locale tags
 * - should support non-explicit Vietnamese locale tags
 * - should provide Korean translations for navigation keys
 * - should support non-explicit Korean locale tags
 * - pluralizes the subagent count labels in English
 * - pluralizes the Kanban and Sessions header counts
 * - pluralizes task-progress counts in English and Spanish
 * - ships every first-run hook setup control in each supported locale
 * - ships the global provider and session-home settings in every supported locale
 *
 * Maintenance rules
 * - Keep assertions at observable boundaries: rendered output, public return values, emitted events, or
 *   wire payloads.
 * - When behavior changes intentionally, update the matching case title and this map in the same
 *   review.
 * - Prefer one reason for failure per case; shared setup may remove noise but must not hide the state
 *   under test.
 * - Reset spies, fake timers, storage, and singleton subscriptions so reruns and shuffled execution
 *   remain stable.
 * - Add regression coverage beside the narrowest existing group that expresses the affected user or API
 *   contract.
 * - Keep client fixtures aligned with `lib/types.ts` and server response shapes so mocks do not mask
 *   contract drift.
 *
 * Verification
 * - Run `npm run test:client` and `npm run typecheck:client` after changing this area.
 * - The repository-wide `npm run verify` gate also checks headers, formatting, server tests, and client
 *   tests.
 * ============================================================================= */

import { describe, it, expect } from "vitest";
import i18n from "i18next";

const flattenResource = (
  value: unknown,
  prefix = "",
  result: Record<string, unknown> = {}
): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flattenResource(child, prefix ? `${prefix}.${key}` : key, result);
    }
  } else {
    result[prefix] = value;
  }

  return result;
};

const interpolationTokens = (value: unknown): string[] => {
  if (typeof value !== "string") return [];

  return [...value.matchAll(/{{\s*([^},\s]+)[^}]*}}|%\{\s*([^}\s]+)\s*\}/g)]
    .flatMap((match) => {
      const token = match[1] ?? match[2];
      return token ? [token] : [];
    })
    .sort();
};

describe("i18n resources", () => {
  it("keeps every locale's keys, value types, and interpolation tokens aligned with English", () => {
    const namespaces = Object.keys(i18n.getDataByLanguage("en") ?? {});

    for (const namespace of namespaces) {
      const english = flattenResource(i18n.getResourceBundle("en", namespace));

      for (const language of ["zh", "vi", "ko", "es"]) {
        const locale = flattenResource(i18n.getResourceBundle(language, namespace));

        expect(Object.keys(locale).sort(), `${language}/${namespace} keys`).toEqual(
          Object.keys(english).sort()
        );

        for (const key of Object.keys(english)) {
          expect(typeof locale[key], `${language}/${namespace}:${key} type`).toBe(
            typeof english[key]
          );
          expect(
            interpolationTokens(locale[key]),
            `${language}/${namespace}:${key} interpolation tokens`
          ).toEqual(interpolationTokens(english[key]));
        }
      }
    }
  });

  it("should provide Vietnamese translations for navigation keys", async () => {
    await i18n.changeLanguage("vi");

    expect(i18n.t("nav:dashboard")).toBe("Tổng quan");
    expect(i18n.t("nav:agentBoard")).toBe("Bảng Kanban");
    expect(i18n.t("nav:languageShort.vi")).toBe("VI");
  });

  it("should keep Agent terminology untranslated in zh, vi, ko, and es locales", async () => {
    await i18n.changeLanguage("zh");
    expect(i18n.t("common:agent")).toBe("Agent");
    expect(i18n.t("common:subagent")).toBe("Subagent");

    await i18n.changeLanguage("vi");
    expect(i18n.t("common:agent")).toBe("Agent");
    expect(i18n.t("common:subagent")).toBe("Subagent");

    await i18n.changeLanguage("ko");
    expect(i18n.t("common:agent")).toBe("Agent");
    expect(i18n.t("common:subagent")).toBe("Subagent");

    await i18n.changeLanguage("es");
    expect(i18n.t("common:agent")).toBe("agente");
    expect(i18n.t("common:subagent")).toBe("subagente");
  });

  it("should provide Spanish translations for navigation keys", async () => {
    await i18n.changeLanguage("es");

    expect(i18n.t("nav:dashboard")).toBe("Panel");
    expect(i18n.t("nav:agentBoard")).toBe("Tablero Kanban");
    expect(i18n.t("nav:languageShort.es")).toBe("ES");
  });

  it("should provide Spanish translations across every feature namespace", async () => {
    await i18n.changeLanguage("es");

    expect(i18n.t("common:awaitingReason.session_start.label")).toBe("Esperando una instrucción");
    expect(i18n.t("analytics:total30d")).toBe("Total (30 días)");
    expect(i18n.t("ccConfig:tabs.skills")).toBe("Habilidades");
    expect(i18n.t("run:fields.prompt")).toBe("Instrucción");
    expect(i18n.t("settings:hooks.title")).toBe("Configuración de ganchos");
    expect(i18n.t("workflows:runs.promptLabel")).toBe("Instrucción");
  });

  it("should support non-explicit Spanish locale tags", async () => {
    await i18n.changeLanguage("es-ES");

    expect(i18n.resolvedLanguage?.startsWith("es")).toBe(true);
    expect(i18n.t("nav:dashboard")).toBe("Panel");
  });

  it("should support non-explicit Vietnamese locale tags", async () => {
    await i18n.changeLanguage("vi-VN");

    expect(i18n.resolvedLanguage?.startsWith("vi")).toBe(true);
    expect(i18n.t("nav:dashboard")).toBe("Tổng quan");
  });

  it("should provide Korean translations for navigation keys", async () => {
    await i18n.changeLanguage("ko");

    expect(i18n.t("nav:dashboard")).toBe("대시보드");
    expect(i18n.t("nav:agentBoard")).toBe("칸반 보드");
    expect(i18n.t("nav:languageShort.ko")).toBe("한국어");
  });

  it("should support non-explicit Korean locale tags", async () => {
    await i18n.changeLanguage("ko-KR");

    expect(i18n.resolvedLanguage?.startsWith("ko")).toBe(true);
    expect(i18n.t("nav:dashboard")).toBe("대시보드");
  });

  it("pluralizes the subagent count labels in English", async () => {
    await i18n.changeLanguage("en");
    // The collapsed agent-tree badge (Dashboard) and SessionDetail both render
    // this key with a count. It MUST use i18next plural forms (_one/_other) so
    // "2 subagent" never shows — the flat common:subagent word is not a plural
    // key and rendering it with a count is the bug this guards against.
    expect(i18n.t("common:subagent_label", { count: 1 })).toBe("1 subagent");
    expect(i18n.t("common:subagent_label", { count: 2 })).toBe("2 subagents");
    // The main-agent card subtitle carries its own kanban plural key.
    expect(i18n.t("kanban:session.subagentSummary", { count: 1 })).toBe("1 subagent");
    expect(i18n.t("kanban:session.subagentSummary", { count: 3 })).toBe("3 subagents");
  });

  it("pluralizes the Kanban and Sessions header counts", async () => {
    // KanbanBoard and Sessions render these keys with a count. i18next v4 only
    // resolves _one/_other suffixes; the legacy _plural suffix is ignored, which
    // made every count fall back to the singular text ("2 agent tracked").
    await i18n.changeLanguage("en");
    expect(i18n.t("kanban:agentCount", { count: 1 })).toBe("1 agent tracked");
    expect(i18n.t("kanban:agentCount", { count: 2 })).toBe("2 agents tracked");
    expect(i18n.t("kanban:sessionCount", { count: 2 })).toBe("2 sessions tracked");
    expect(i18n.t("sessions:sessionCount", { count: 1 })).toBe("1 session recorded");
    expect(i18n.t("sessions:sessionCount", { count: 2 })).toBe("2 sessions recorded");

    await i18n.changeLanguage("es");
    expect(i18n.t("kanban:agentCount", { count: 2 })).toBe("2 agentes rastreados");
    expect(i18n.t("sessions:sessionCount", { count: 2 })).toBe("2 sesiones registradas");
  });

  it("pluralizes task-progress counts in English and Spanish", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("sessions:taskProgress.more", { count: 1 })).toBe(
      "+1 more task in Session Detail"
    );
    expect(i18n.t("sessions:taskProgress.more", { count: 2 })).toBe(
      "+2 more tasks in Session Detail"
    );
    expect(i18n.t("sessions:taskProgress.hiddenTasks", { count: 1 })).toBe(
      "1 additional task is not shown."
    );
    expect(i18n.t("sessions:taskProgress.hiddenTasks", { count: 2 })).toBe(
      "2 additional tasks are not shown."
    );

    await i18n.changeLanguage("es");
    expect(i18n.t("sessions:taskProgress.doneCount", { count: 1 })).toBe("1 completada");
    expect(i18n.t("sessions:taskProgress.doneCount", { count: 2 })).toBe("2 completadas");
    expect(i18n.t("sessions:taskProgress.remainingCount", { count: 1 })).toBe("1 pendiente");
    expect(i18n.t("sessions:taskProgress.remainingCount", { count: 2 })).toBe("2 pendientes");
  });

  it("ships every first-run hook setup control in each supported locale", () => {
    const keys = [
      "provider.both.label",
      "provider.both.description",
      "hookGate.kicker",
      "hookGate.title",
      "hookGate.description",
      "hookGate.selectedProviders",
      "hookGate.realTime",
      "hookGate.checking",
      "hookGate.installed",
      "hookGate.existing",
      "hookGate.ready",
      "hookGate.overrideWarning",
      "hookGate.output",
      "hookGate.failure",
      "hookGate.checkFailed",
      "hookGate.preserveNote",
      "hookGate.alreadyInstalled",
      "hookGate.install",
      "hookGate.installing",
      "hookGate.continue",
    ];

    for (const language of ["en", "zh", "vi", "ko", "es"]) {
      for (const key of keys) {
        expect(i18n.getResource(language, "splash", key)).toBeTruthy();
      }
    }
  });

  it("ships the global provider and session-home settings in every supported locale", () => {
    const keys = [
      "display.title",
      "display.claude",
      "display.codex",
      "display.both",
      "display.claudeDescription",
      "display.codexDescription",
      "display.bothDescription",
      "homes.title",
      "codexHome.title",
      "pricing.navClaude",
      "pricing.navGpt",
      "pricing.gpt.title",
      "pricing.gpt.tooltip.title",
      "pricing.gpt.tooltip.howItWorksBody",
      "pricing.gpt.tooltip.apiPricingBody",
    ];

    for (const language of ["en", "zh", "vi", "ko", "es"]) {
      for (const key of keys) {
        expect(i18n.getResource(language, "settings", key)).toBeTruthy();
      }
    }
  });
});
