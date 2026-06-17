/**
 * @file Safe structured-query DSL for the Query Explorer. Pure module (no
 * Express, no DB): it validates an untrusted query object against a strict
 * field/entity/operator allowlist and compiles it to a fully parameterized
 * SQL statement. User VALUES are never interpolated — every value flows through
 * a `?` placeholder. The only user-influenced tokens that reach the SQL string
 * are column/table names, and those are taken verbatim from the SCHEMA below
 * after an exact-match allowlist lookup (never the raw request string). This is
 * the single source of truth the route layer (server/routes/query.js) compiles
 * against.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

// Operators usable on every field type.
const COMMON_OPS = ["eq", "ne", "gt", "gte", "lt", "lte", "in", "is_null", "is_not_null"];
// `like` is text-only (pattern matching makes no sense on ints).
const TEXT_OPS = [...COMMON_OPS, "like"];

const LIMITS = {
  maxLimit: 1000,
  defaultLimit: 100,
  maxInValues: 100,
  maxFilters: 50,
  maxSort: 10,
  // Keep offset a safe integer so the driver never sees an unsafe-int float.
  maxOffset: Number.MAX_SAFE_INTEGER,
};

// All operators the DSL understands, surfaced via SCHEMA for the client.
const OPERATORS = ["eq", "ne", "gt", "gte", "lt", "lte", "like", "in", "is_null", "is_not_null"];

// Per-entity allowlist: field name == real column name (post-migration columns
// only). `ops` is derived from the field type so a field can never be queried
// with an operator that does not make sense for it.
function fieldsFromTypes(typeMap) {
  const fields = {};
  for (const [name, type] of Object.entries(typeMap)) {
    fields[name] = { type, ops: type === "text" ? TEXT_OPS : COMMON_OPS };
  }
  return fields;
}

const SCHEMA = {
  entities: {
    events: {
      table: "events",
      fields: fieldsFromTypes({
        id: "int",
        session_id: "text",
        agent_id: "text",
        event_type: "text",
        tool_name: "text",
        summary: "text",
        created_at: "datetime",
      }),
    },
    agents: {
      table: "agents",
      fields: fieldsFromTypes({
        id: "text",
        session_id: "text",
        name: "text",
        type: "text",
        subagent_type: "text",
        status: "text",
        task: "text",
        current_tool: "text",
        started_at: "datetime",
        ended_at: "datetime",
        parent_agent_id: "text",
        workflow_run_id: "text",
        workflow_phase: "text",
        updated_at: "datetime",
        awaiting_input_since: "datetime",
      }),
    },
    sessions: {
      table: "sessions",
      fields: fieldsFromTypes({
        id: "text",
        name: "text",
        status: "text",
        cwd: "text",
        model: "text",
        started_at: "datetime",
        ended_at: "datetime",
        updated_at: "datetime",
        transcript_path: "text",
      }),
    },
  },
  operators: OPERATORS,
  limits: LIMITS,
};

const VALUELESS_OPS = new Set(["is_null", "is_not_null"]);
const ALLOWED_TOP_KEYS = new Set(["entity", "filters", "match", "sort", "limit", "offset"]);
const ALLOWED_FILTER_KEYS = new Set(["field", "op", "value"]);
const ALLOWED_SORT_KEYS = new Set(["field", "dir"]);

// Reject any key on `obj` outside `allowed`, mirroring the strict top-level
// check so a smuggled/typo'd key fails loudly instead of being silently ignored.
function checkKeys(obj, allowed, label) {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) return `Unknown key "${key}" in ${label}.`;
  }
  return null;
}

// SQL comparison operator for each DSL op (only those that take a value here).
const SQL_OP = {
  eq: "=",
  ne: "!=",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  like: "LIKE",
};

function err(message) {
  return { ok: false, error: message };
}

// True when `value` matches the column type. datetime is carried as an ISO
// string, so it validates as text (a finite range check would reject valid
// open-ended timestamps and add no safety, since the value is parameterized).
function valueMatchesType(type, value) {
  if (type === "int") return typeof value === "number" && Number.isFinite(value);
  // text + datetime
  return typeof value === "string";
}

/**
 * Validate + normalize an untrusted query object.
 * @param {*} raw The request body.
 * @returns {{ok:true, query:object}|{ok:false, error:string}}
 */
function validateQuery(raw) {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return err("Query must be an object.");
  }

  // Reject unknown top-level keys so typos / smuggled fields fail loudly.
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_TOP_KEYS.has(key)) {
      return err(`Unknown query key "${key}".`);
    }
  }

  const entityName = raw.entity;
  if (
    typeof entityName !== "string" ||
    !Object.prototype.hasOwnProperty.call(SCHEMA.entities, entityName)
  ) {
    return err(`Unknown entity "${entityName}".`);
  }
  const entity = SCHEMA.entities[entityName];

  // ----- filters -----
  if (raw.filters != null && !Array.isArray(raw.filters)) {
    return err("filters must be an array.");
  }
  const rawFilters = raw.filters || [];
  if (rawFilters.length > LIMITS.maxFilters) {
    return err(`Too many filters (max ${LIMITS.maxFilters}).`);
  }
  const filters = [];
  for (let i = 0; i < rawFilters.length; i++) {
    const f = rawFilters[i];
    if (f == null || typeof f !== "object" || Array.isArray(f)) {
      return err(`filters[${i}] must be an object.`);
    }
    const badKey = checkKeys(f, ALLOWED_FILTER_KEYS, `filters[${i}]`);
    if (badKey) return err(badKey);
    const { field, op, value } = f;
    const fieldDef =
      typeof field === "string" && Object.prototype.hasOwnProperty.call(entity.fields, field)
        ? entity.fields[field]
        : null;
    if (!fieldDef) {
      return err(`Unknown field "${field}" for entity "${entityName}".`);
    }
    if (typeof op !== "string" || !OPERATORS.includes(op)) {
      return err(`Unknown operator "${op}".`);
    }
    if (!fieldDef.ops.includes(op)) {
      return err(`Operator "${op}" is not allowed on ${fieldDef.type} field "${field}".`);
    }

    if (VALUELESS_OPS.has(op)) {
      // is_null / is_not_null take no value.
      filters.push({ field, op });
      continue;
    }

    if (op === "in") {
      if (!Array.isArray(value) || value.length === 0) {
        return err(`Operator "in" on "${field}" requires a non-empty array value.`);
      }
      if (value.length > LIMITS.maxInValues) {
        return err(`Operator "in" on "${field}" accepts at most ${LIMITS.maxInValues} values.`);
      }
      for (const v of value) {
        if (!valueMatchesType(fieldDef.type, v)) {
          return err(`A value in the "in" list for "${field}" has the wrong type.`);
        }
      }
      filters.push({ field, op, value: value.slice() });
      continue;
    }

    // Scalar comparison / like operators.
    if (!valueMatchesType(fieldDef.type, value)) {
      return err(
        `Value for "${field}" must be a ${fieldDef.type === "int" ? "number" : "string"}.`
      );
    }
    filters.push({ field, op, value });
  }

  // ----- match -----
  let match = "and";
  if (raw.match != null) {
    if (raw.match !== "and" && raw.match !== "or") {
      return err('match must be "and" or "or".');
    }
    match = raw.match;
  }

  // ----- sort -----
  const sort = [];
  if (raw.sort != null) {
    if (!Array.isArray(raw.sort)) return err("sort must be an array.");
    if (raw.sort.length > LIMITS.maxSort) {
      return err(`Too many sort fields (max ${LIMITS.maxSort}).`);
    }
    for (let i = 0; i < raw.sort.length; i++) {
      const s = raw.sort[i];
      if (s == null || typeof s !== "object" || Array.isArray(s)) {
        return err(`sort[${i}] must be an object.`);
      }
      const badKey = checkKeys(s, ALLOWED_SORT_KEYS, `sort[${i}]`);
      if (badKey) return err(badKey);
      if (
        typeof s.field !== "string" ||
        !Object.prototype.hasOwnProperty.call(entity.fields, s.field)
      ) {
        return err(`Unknown sort field "${s.field}" for entity "${entityName}".`);
      }
      const dir = s.dir == null ? "asc" : s.dir;
      if (dir !== "asc" && dir !== "desc") {
        return err('sort dir must be "asc" or "desc".');
      }
      sort.push({ field: s.field, dir });
    }
  }

  // ----- limit / offset (clamped, never rejected for being out of range) -----
  let limit = LIMITS.defaultLimit;
  if (raw.limit != null) {
    if (typeof raw.limit !== "number" || !Number.isFinite(raw.limit)) {
      return err("limit must be a number.");
    }
    limit = Math.min(Math.max(Math.trunc(raw.limit), 1), LIMITS.maxLimit);
  }

  let offset = 0;
  if (raw.offset != null) {
    if (typeof raw.offset !== "number" || !Number.isFinite(raw.offset)) {
      return err("offset must be a number.");
    }
    offset = Math.min(Math.max(Math.trunc(raw.offset), 0), LIMITS.maxOffset);
  }

  return { ok: true, query: { entity: entityName, filters, match, sort, limit, offset } };
}

/**
 * Compile a validated/normalized query to parameterized SQL.
 * @param {object} query Output of validateQuery().query.
 * @returns {{sql:string, params:Array, countSql:string, countParams:Array, columns:string[]}}
 */
function compile(query) {
  const entity = SCHEMA.entities[query.entity];
  const table = entity.table;
  // SELECT the full allowlisted column set explicitly (never SELECT *).
  const columns = Object.keys(entity.fields);

  const whereClauses = [];
  const whereParams = [];
  for (const f of query.filters) {
    // f.field is an allowlisted key, used verbatim as the column name.
    if (f.op === "is_null") {
      whereClauses.push(`${f.field} IS NULL`);
    } else if (f.op === "is_not_null") {
      whereClauses.push(`${f.field} IS NOT NULL`);
    } else if (f.op === "in") {
      const placeholders = f.value.map(() => "?").join(", ");
      whereClauses.push(`${f.field} IN (${placeholders})`);
      whereParams.push(...f.value);
    } else {
      whereClauses.push(`${f.field} ${SQL_OP[f.op]} ?`);
      whereParams.push(f.value);
    }
  }

  const joiner = query.match === "or" ? " OR " : " AND ";
  const whereSql = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(joiner)}` : "";

  let orderSql = "";
  if (query.sort.length > 0) {
    const parts = query.sort.map((s) => `${s.field} ${s.dir === "desc" ? "DESC" : "ASC"}`);
    orderSql = ` ORDER BY ${parts.join(", ")}`;
  }

  const selectCols = columns.join(", ");
  const sql = `SELECT ${selectCols} FROM ${table}${whereSql}${orderSql} LIMIT ? OFFSET ?`;
  const params = [...whereParams, query.limit, query.offset];

  const countSql = `SELECT COUNT(*) as count FROM ${table}${whereSql}`;
  const countParams = [...whereParams];

  return { sql, params, countSql, countParams, columns };
}

/**
 * Serialize rows to RFC4180 CSV. Fields containing `"`, `,`, CR, or LF are
 * wrapped in double quotes with inner quotes doubled. null/undefined → empty.
 * @param {string[]} columns Column order for the header + cells.
 * @param {object[]} rows
 * @returns {string}
 */
function toCsv(columns, rows) {
  const escape = (value) => {
    if (value == null) return "";
    const s = String(value);
    if (/[",\r\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [columns.map(escape).join(",")];
  for (const row of rows) {
    lines.push(columns.map((col) => escape(row[col])).join(","));
  }
  return lines.join("\r\n");
}

module.exports = { SCHEMA, validateQuery, compile, toCsv };
