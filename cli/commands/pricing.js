/**
 * @file ccam pricing commands: the Claude model-pricing rules (list / set /
 * delete / reset, including fast-mode and intro-promo rates), plus the
 * independent OpenAI/Codex (`pricing gpt`) and Cursor (`pricing cursor`)
 * rate cards. `gpt-pricing` is kept as the legacy raw-JSON entry point.
 *
 * The GPT and Cursor PUT routes reset any omitted rate to 0, so flag-based
 * edits read the existing row first and merge onto it — a partial edit can
 * never silently zero the other rates.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

"use strict";

const { c, table, printJson } = require("../lib/ui");
const { isJson, CliError } = require("../lib/runtime");
const { get, put, post, del, enc } = require("../lib/http");
const { requireDb } = require("../lib/offline");
const {
  run,
  listGroup,
  confirm,
  numArg,
  readJsonInput,
  jsonBodyOptions,
} = require("../lib/framework");

const GROUP = "Pricing:";
const PRICING_ONLY = "pricing changes must go through the server (cache invalidation + broadcasts)";

// ── Claude rules ────────────────────────────────────────────────────────────

/** Render pricing rules — shared by the online list and the offline fallback
 *  so both show the full rate surface (standard, fast-mode, intro promo). */
function renderPricingTable(rules) {
  if (isJson()) return printJson({ pricing: rules });
  const fastCol = (p) =>
    (p.fast_input_per_mtok || 0) > 0 ? `$${p.fast_input_per_mtok}/$${p.fast_output_per_mtok}` : "-";
  const introCol = (p) =>
    p.intro_until
      ? `$${p.intro_input_per_mtok}/$${p.intro_output_per_mtok} ≤${p.intro_until}`
      : "-";
  table(
    ["Pattern", "Name", "In/M", "Out/M", "CacheR/M", "CacheW/M", "Fast In/Out", "Intro In/Out"],
    (rules || []).map((p) => [
      p.model_pattern,
      (p.display_name || "").slice(0, 24),
      `$${p.input_per_mtok}`,
      `$${p.output_per_mtok}`,
      `$${p.cache_read_per_mtok}`,
      `$${p.cache_write_per_mtok}`,
      fastCol(p),
      introCol(p),
    ])
  );
}

async function listPricing() {
  const data = await get("/api/pricing");
  renderPricingTable(data.pricing || data.rules || []);
}

function offlinePricing() {
  renderPricingTable(
    requireDb().all("SELECT * FROM model_pricing ORDER BY LENGTH(model_pattern) DESC")
  );
}

async function setPricing({ args, opts }) {
  const pattern = args[0];
  // Partial edits keep the rule's current values: an omitted flag falls back
  // to the existing row, and only a brand-new rule defaults a rate to 0.
  const existing =
    ((await get("/api/pricing")).pricing || []).find((p) => p.model_pattern === pattern) || {};
  const pick = (flag, field) => opts[flag] ?? existing[field] ?? 0;
  const body = {
    model_pattern: pattern,
    display_name: opts.name || existing.display_name || pattern,
    input_per_mtok: pick("input", "input_per_mtok"),
    output_per_mtok: pick("output", "output_per_mtok"),
    cache_read_per_mtok: pick("cacheRead", "cache_read_per_mtok"),
    cache_write_per_mtok: pick("cacheWrite", "cache_write_per_mtok"),
    cache_write_1h_per_mtok: pick("cacheWrite1h", "cache_write_1h_per_mtok"),
    fast_input_per_mtok: pick("fastInput", "fast_input_per_mtok"),
    fast_output_per_mtok: pick("fastOutput", "fast_output_per_mtok"),
  };
  // Same contract for the long-prompt tier: only sent with a --long-* flag, so
  // a plain rate edit keeps the stored tier.
  if (opts.longInput !== undefined || opts.longOutput !== undefined) {
    body.long_input_per_mtok = pick("longInput", "long_input_per_mtok");
    body.long_output_per_mtok = pick("longOutput", "long_output_per_mtok");
  }
  // The intro block is only sent when at least one --intro-* flag is present:
  // per the API contract, a PUT that omits every intro field preserves an
  // existing promo, so a plain rate edit can never clobber one.
  const INTRO = {
    introInput: "intro_input_per_mtok",
    introOutput: "intro_output_per_mtok",
    introCacheRead: "intro_cache_read_per_mtok",
    introCacheWrite: "intro_cache_write_per_mtok",
    introCacheWrite1h: "intro_cache_write_1h_per_mtok",
  };
  const introProvided =
    opts.introUntil !== undefined || Object.keys(INTRO).some((k) => opts[k] !== undefined);
  if (introProvided) {
    for (const [k, field] of Object.entries(INTRO)) body[field] = pick(k, field);
    // A bare --intro-until (no date) clears the promo, mirroring the API;
    // omitting it keeps the current end date.
    body.intro_until =
      typeof opts.introUntil === "string"
        ? opts.introUntil
        : opts.introUntil === true
          ? ""
          : existing.intro_until || "";
  }
  const r = await put("/api/pricing", body);
  if (isJson()) return printJson(r);
  console.log(`${c.green("✔")} Pricing rule saved for ${c.bold(pattern)}`);
}

async function deletePricing({ args }) {
  const r = await del(`/api/pricing/${enc(args[0])}`);
  if (isJson()) return printJson(r);
  console.log(`${c.green("✔")} Pricing rule deleted: ${args[0]}`);
}

async function resetPricing({ opts }) {
  await confirm(opts, {
    prompt: "Reset ALL pricing rules to the shipped defaults (custom rules are replaced)?",
    refusal: "pricing reset requires --yes.",
  });
  const r = await post("/api/settings/reset-pricing");
  if (isJson()) return printJson(r);
  console.log(`${c.green("✔")} Pricing rules reset to defaults`);
}

// ── Secondary rate cards (GPT / Cursor) ─────────────────────────────────────

/**
 * Build a rate-card subgroup (`pricing gpt`, `pricing cursor`). `fields` maps
 * camelCase option attributes to API columns; flags merge onto the existing
 * row so omitted rates keep their current value.
 */
function rateCard(parent, { name, label, route, fields, columns }) {
  const renderCard = (rules) => {
    if (isJson()) return printJson({ pricing: rules });
    table(
      ["Pattern", "Name", ...columns.map(([h]) => h)],
      rules.map((p) => [
        p.model_pattern,
        (p.display_name || "").slice(0, 24),
        ...columns.map(([, f]) => `$${p[f] ?? 0}`),
      ])
    );
  };
  const g = listGroup(parent, name, {
    description: `${label} pricing rules (default: list)`,
    handler: async () => renderCard((await get(route)).pricing || []),
    serverOnly: `${label} pricing is served by the running server`,
  });
  const set = jsonBodyOptions(
    g
      .command("set")
      .description(`Create or update a ${label} pricing rule (flags merge onto the existing row)`)
      .argument("<pattern>", "model pattern (SQL LIKE, e.g. gpt-5%)")
      .option("--name <name>", "display name"),
    "rate fields"
  ).option("-y, --yes", "confirm the write");
  for (const [attr, flag, column] of fields)
    set.option(`--${flag} <usd>`, `${column} ($ per 1M tokens)`, numArg);
  set.action(
    run(
      async ({ args, opts }) => {
        const existing =
          ((await get(route)).pricing || []).find((p) => p.model_pattern === args[0]) || {};
        const body = { ...existing, ...(readJsonInput(opts) || {}) };
        for (const [attr, , column] of fields)
          if (opts[attr] !== undefined) body[column] = opts[attr];
        body.model_pattern = args[0];
        body.display_name = opts.name || body.display_name || args[0];
        await confirm(opts, {
          prompt: `Save ${label} pricing for ${args[0]}?`,
          refusal: `${label} pricing writes require --yes.`,
        });
        const r = await put(route, body);
        if (isJson()) return printJson(r);
        console.log(`${c.green("✔")} ${label} pricing rule saved for ${c.bold(args[0])}`);
      },
      { serverOnly: PRICING_ONLY }
    )
  );
  g.command("delete")
    .alias("rm")
    .description(`Delete a ${label} pricing rule`)
    .argument("<pattern>", "model pattern")
    .option("-y, --yes", "confirm the write")
    .action(
      run(
        async ({ args, opts }) => {
          await confirm(opts, {
            prompt: `Delete ${label} pricing rule ${args[0]}?`,
            refusal: `${label} pricing writes require --yes.`,
          });
          const r = await del(`${route}/${enc(args[0])}`);
          if (isJson()) return printJson(r);
          console.log(`${c.green("✔")} ${label} pricing rule deleted: ${args[0]}`);
        },
        { serverOnly: PRICING_ONLY }
      )
    );
  return g;
}

const GPT_FIELDS = [
  ["input", "input", "short_input_per_mtok"],
  ["cachedInput", "cached-input", "short_cached_input_per_mtok"],
  ["cacheWrite", "cache-write", "short_cache_write_per_mtok"],
  ["output", "output", "short_output_per_mtok"],
  ["longInput", "long-input", "long_input_per_mtok"],
  ["longCachedInput", "long-cached-input", "long_cached_input_per_mtok"],
  ["longCacheWrite", "long-cache-write", "long_cache_write_per_mtok"],
  ["longOutput", "long-output", "long_output_per_mtok"],
  ["fastInput", "fast-input", "fast_input_per_mtok"],
  ["fastCachedInput", "fast-cached-input", "fast_cached_input_per_mtok"],
  ["fastCacheWrite", "fast-cache-write", "fast_cache_write_per_mtok"],
  ["fastOutput", "fast-output", "fast_output_per_mtok"],
];
const CURSOR_FIELDS = [
  ["input", "input", "input_per_mtok"],
  ["cacheWrite", "cache-write", "cache_write_per_mtok"],
  ["cacheRead", "cache-read", "cache_read_per_mtok"],
  ["output", "output", "output_per_mtok"],
];

function register(program) {
  const pricing = listGroup(program, "pricing", {
    group: GROUP,
    description: "Model pricing rules: list, set, delete, reset, gpt, cursor (default: list)",
    handler: listPricing,
    offline: offlinePricing,
  });
  pricing
    .command("set")
    .description("Create or update a Claude pricing rule ($ per 1M tokens)")
    .argument("<pattern>", "model pattern (SQL LIKE, e.g. claude-opus-5%)")
    .option("--name <name>", "display name (default: the pattern)")
    .option("--input <usd>", "input rate", numArg)
    .option("--output <usd>", "output rate", numArg)
    .option("--cache-read <usd>", "cache-read rate", numArg)
    .option("--cache-write <usd>", "5-minute cache-write rate", numArg)
    .option("--cache-write-1h <usd>", "1-hour cache-write rate", numArg)
    .option("--fast-input <usd>", "fast-mode input rate", numArg)
    .option("--fast-output <usd>", "fast-mode output rate", numArg)
    .option("--long-input <usd>", "long-prompt (over the model's limit) input rate", numArg)
    .option("--long-output <usd>", "long-prompt output rate", numArg)
    .option("--intro-input <usd>", "intro-promo input rate", numArg)
    .option("--intro-output <usd>", "intro-promo output rate", numArg)
    .option("--intro-cache-read <usd>", "intro-promo cache-read rate", numArg)
    .option("--intro-cache-write <usd>", "intro-promo cache-write rate", numArg)
    .option("--intro-cache-write-1h <usd>", "intro-promo 1-hour cache-write rate", numArg)
    .option("--intro-until [date]", "intro promo end date YYYY-MM-DD (bare flag clears the promo)")
    .action(run(setPricing, { serverOnly: PRICING_ONLY }));
  pricing
    .command("delete")
    .alias("rm")
    .description("Delete a Claude pricing rule")
    .argument("<pattern>", "model pattern")
    .action(run(deletePricing, { serverOnly: PRICING_ONLY }));
  pricing
    .command("reset")
    .description("Reset Claude pricing rules to the shipped defaults (asks first; --yes skips)")
    .option("-y, --yes", "confirm the reset")
    .action(run(resetPricing, { serverOnly: PRICING_ONLY }));
  rateCard(pricing, {
    name: "gpt",
    label: "OpenAI/Codex",
    route: "/api/pricing/gpt",
    fields: GPT_FIELDS,
    columns: [
      ["In/M", "short_input_per_mtok"],
      ["CachedIn/M", "short_cached_input_per_mtok"],
      ["Out/M", "short_output_per_mtok"],
      ["Long In/M", "long_input_per_mtok"],
      ["Long Out/M", "long_output_per_mtok"],
    ],
  });
  rateCard(pricing, {
    name: "cursor",
    label: "Cursor",
    route: "/api/pricing/cursor",
    fields: CURSOR_FIELDS,
    columns: [
      ["In/M", "input_per_mtok"],
      ["Out/M", "output_per_mtok"],
      ["CacheR/M", "cache_read_per_mtok"],
      ["CacheW/M", "cache_write_per_mtok"],
    ],
  });

  // Legacy raw-JSON entry point for the GPT rate card.
  const gpt = program
    .command("gpt-pricing")
    .helpGroup(GROUP)
    .description("OpenAI/Codex pricing rules as raw JSON (legacy; see `pricing gpt`)")
    .allowExcessArguments();
  gpt.action(
    run(
      async ({ cmd }) => {
        if (cmd.args.length) cmd.unknownCommand();
        printJson(await get("/api/pricing/gpt"));
      },
      { serverOnly: PRICING_ONLY }
    )
  );
  jsonBodyOptions(
    gpt
      .command("set")
      .description("Upsert a GPT rule from --data JSON (requires --yes)")
      .argument("<pattern>", "model pattern")
      .option("--name <name>", "display name"),
    "rate fields"
  )
    .option("-y, --yes", "confirm the write")
    .action(
      run(
        async ({ args, opts }) => {
          if (!opts.yes)
            throw new CliError("gpt-pricing set requires --yes.", {
              code: "CONFIRMATION_REQUIRED",
            });
          const body = {
            ...(readJsonInput(opts) || {}),
            model_pattern: args[0],
            display_name: opts.name || args[0],
          };
          printJson(await put("/api/pricing/gpt", body));
        },
        { serverOnly: PRICING_ONLY }
      )
    );
  gpt
    .command("delete")
    .description("Delete a GPT rule (requires --yes)")
    .argument("<pattern>", "model pattern")
    .option("-y, --yes", "confirm the write")
    .action(
      run(
        async ({ args, opts }) => {
          if (!opts.yes)
            throw new CliError("gpt-pricing delete requires --yes.", {
              code: "CONFIRMATION_REQUIRED",
            });
          const r = await del(`/api/pricing/gpt/${enc(args[0])}`);
          if (isJson()) return printJson(r);
          console.log(`${c.green("✔")} GPT pricing rule deleted: ${args[0]}`);
        },
        { serverOnly: PRICING_ONLY }
      )
    );
}

module.exports = { register };
