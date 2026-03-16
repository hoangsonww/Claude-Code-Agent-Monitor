# Remove Native SQLite Dependency — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `better-sqlite3` (native C++ module requiring Python/build tools) with a compatibility layer over Node.js built-in `node:sqlite`, so `npm install` succeeds on any machine without native compilation tools.

**Architecture:** Create `server/compat-sqlite.js` — a thin wrapper that gives `DatabaseSync` (from `node:sqlite`) the same API as `better-sqlite3`. Move `better-sqlite3` to `optionalDependencies` so it's preferred when prebuilds are available but doesn't block install. The `server/db.js` loader tries `better-sqlite3` first, falls back to the compat wrapper. Update minimum Node version to 22.

**Tech Stack:** Node.js `node:sqlite` (DatabaseSync), existing Express/WS server

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `server/compat-sqlite.js` | **Create** | Wrapper class: DatabaseSync → better-sqlite3 API |
| `server/db.js` | **Modify** (line 1) | Try better-sqlite3, fallback to compat wrapper |
| `scripts/clear-data.js` | **Modify** (line 8) | Same fallback import |
| `package.json` | **Modify** | Move better-sqlite3 to optionalDependencies, bump engines to >=22 |
| `server/__tests__/api.test.js` | **Modify** (lines 952-959) | Fix `db.pragma()` calls to work with both backends |

---

## Chunk 1: Core Implementation

### Task 1: Create `server/compat-sqlite.js`

**Files:**
- Create: `server/compat-sqlite.js`

- [ ] **Step 1: Write the compat wrapper**

The wrapper must bridge these API differences:

| better-sqlite3 | node:sqlite (DatabaseSync) |
|----------------|---------------------------|
| `new Database(path)` | `new DatabaseSync(path)` |
| `db.pragma("key = value")` | `db.exec("PRAGMA key = value")` |
| `db.pragma("key")` → value | `db.prepare("PRAGMA key").get()` → `{key: value}` |
| `db.pragma("key", { simple: true })` → value | same as above, extract single value |
| `db.transaction(fn)` → wrapper fn | manual `BEGIN`/`COMMIT`/`ROLLBACK` |
| `db.prepare(sql)` → stmt with `.run()`, `.get()`, `.all()` | identical API |
| `db.exec(sql)` | identical |
| `db.close()` | identical |

```js
// server/compat-sqlite.js
const { DatabaseSync } = require("node:sqlite");

class Database {
  constructor(filePath) {
    this._db = new DatabaseSync(filePath);
  }

  exec(sql) {
    this._db.exec(sql);
    return this;
  }

  pragma(str, options) {
    if (str.includes("=")) {
      this._db.exec(`PRAGMA ${str}`);
      return undefined;
    }
    const row = this._db.prepare(`PRAGMA ${str}`).get();
    if (!row) return undefined;
    const keys = Object.keys(row);
    if (options?.simple || keys.length === 1) return row[keys[0]];
    return row;
  }

  prepare(sql) {
    return this._db.prepare(sql);
  }

  transaction(fn) {
    const db = this._db;
    const wrapper = (...args) => {
      db.exec("BEGIN");
      try {
        const result = fn(...args);
        db.exec("COMMIT");
        return result;
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    };
    return wrapper;
  }

  close() {
    this._db.close();
  }
}

module.exports = Database;
```

- [ ] **Step 2: Verify the wrapper works standalone**

Run: `node -e "const DB = require('./server/compat-sqlite'); const db = new DB(':memory:'); db.pragma('journal_mode = WAL'); db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)'); const s = db.prepare('INSERT INTO t (v) VALUES (?)'); console.log(s.run('hi')); console.log(db.prepare('SELECT * FROM t').all()); const tx = db.transaction((items) => { for (const i of items) s.run(i); }); tx(['a','b','c']); console.log(db.prepare('SELECT COUNT(*) as c FROM t').get()); db.close(); console.log('OK')"`

Expected: `OK` printed at the end with correct query results.

- [ ] **Step 3: Commit**

```bash
git add server/compat-sqlite.js
git commit -m "feat: add node:sqlite compat wrapper for better-sqlite3 API"
```

---

### Task 2: Update `server/db.js` to use fallback import

**Files:**
- Modify: `server/db.js:1`

- [ ] **Step 1: Replace the import**

Change line 1 from:
```js
const Database = require("better-sqlite3");
```
To:
```js
let Database;
try {
  Database = require("better-sqlite3");
} catch {
  Database = require("./compat-sqlite");
}
```

- [ ] **Step 2: Verify server starts**

Run: `node -e "process.env.DASHBOARD_DB_PATH = require('path').join(require('os').tmpdir(), 'test-fallback-' + Date.now() + '.db'); const { db, stmts } = require('./server/db'); console.log('stmts keys:', Object.keys(stmts).length); stmts.insertSession.run('test-1', 'Test', 'active', null, null, null); console.log(stmts.getSession.get('test-1')); db.close(); console.log('OK')"`

Expected: Prints statement count (39), session row, and `OK`.

- [ ] **Step 3: Commit**

```bash
git add server/db.js
git commit -m "feat: fallback to node:sqlite when better-sqlite3 unavailable"
```

---

### Task 3: Update `scripts/clear-data.js` to use fallback import

**Files:**
- Modify: `scripts/clear-data.js:8`

- [ ] **Step 1: Replace the import**

Change line 8 from:
```js
const Database = require("better-sqlite3");
```
To:
```js
let Database;
try {
  Database = require("better-sqlite3");
} catch {
  Database = require("../server/compat-sqlite");
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/clear-data.js
git commit -m "fix: use fallback sqlite import in clear-data script"
```

---

### Task 4: Update `package.json`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Move better-sqlite3 to optionalDependencies, bump engines**

Move `"better-sqlite3": "^11.7.0"` from `dependencies` to `optionalDependencies`.
Change engines from `"node": ">=18.0.0"` to `"node": ">=22.0.0"`.

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: make better-sqlite3 optional, require Node >= 22"
```

---

### Task 5: Fix test pragma calls

**Files:**
- Modify: `server/__tests__/api.test.js:952-959`

- [ ] **Step 1: Fix pragma calls in Database Integrity tests**

The tests call `db.pragma("journal_mode", { simple: true })` and `db.pragma("foreign_keys", { simple: true })`. The compat wrapper supports `{ simple: true }`, so these should work as-is. However, WAL mode isn't available for in-memory databases (returns "memory"). The test creates a file-based DB via `TEST_DB`, so WAL should work.

No change needed — verify by running tests.

- [ ] **Step 2: Run full test suite**

Run: `node --test server/__tests__/api.test.js`

Expected: All tests pass.

- [ ] **Step 3: Run setup to verify npm install succeeds without Python**

Run: `npm run setup`

Expected: Install succeeds (better-sqlite3 may warn but won't fail since it's optional).

---

### Task 6: Update documentation

**Files:**
- Modify: `SETUP.md` (if it mentions better-sqlite3 or Python requirements)

- [ ] **Step 1: Check and update SETUP.md**

Remove any mentions of Python or build tools as requirements. Note that Node >= 22 is required.

- [ ] **Step 2: Commit all remaining changes**

```bash
git add -A
git commit -m "docs: update setup requirements for native-free SQLite"
```
