/**
 * Compatibility wrapper around Node.js built-in node:sqlite (DatabaseSync).
 * Provides a better-sqlite3-compatible API so the rest of the codebase
 * works without the native module.
 *
 * Available on Node.js >= 22.5.0 (node:sqlite is experimental).
 * On older Node versions, require() will throw and the caller should
 * handle the error (e.g. show an informative message).
 *
 * @file This module exports a Database class that wraps node:sqlite's DatabaseSync to provide a better-sqlite3-like API.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");

class Database {
  constructor(filePath, options = {}) {
    // Honor the better-sqlite3 open options callers rely on; without options
    // the connection opens exactly as before. Like better-sqlite3, the name is
    // trimmed, and an in-memory (":memory:") or temporary ("") database has no
    // file to require.
    const name = typeof filePath === "string" ? filePath.trim() : filePath;
    const anonymous = name === "" || name === ":memory:";
    if (options.fileMustExist && !anonymous && !fs.existsSync(name)) {
      const error = new Error(`unable to open database file: ${name}`);
      error.code = "SQLITE_CANTOPEN";
      throw error;
    }
    this._db = options.readonly
      ? new DatabaseSync(name, { readOnly: true })
      : new DatabaseSync(name);
    // query_only refuses writes on this connection even if a runtime ignored
    // the readOnly open flag, so read-only never degrades to read-write.
    if (options.readonly) this._db.exec("PRAGMA query_only = ON");
    this._savepointSequence = 0;
  }

  // Unknown state stays unknown so transaction-sensitive readers fail closed.
  get inTransaction() {
    const state = this._db.isTransaction;
    return typeof state === "boolean" ? state : undefined;
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
      const nested = this.inTransaction;
      if (nested === undefined) throw new Error("SQLite transaction state is unavailable");
      const savepoint = `ccam_compat_${++this._savepointSequence}`;
      db.exec(nested ? `SAVEPOINT ${savepoint}` : "BEGIN");
      try {
        const result = fn(...args);
        db.exec(nested ? `RELEASE ${savepoint}` : "COMMIT");
        return result;
      } catch (err) {
        if (db.isTransaction) {
          if (nested) {
            db.exec(`ROLLBACK TO ${savepoint}`);
            db.exec(`RELEASE ${savepoint}`);
          } else {
            db.exec("ROLLBACK");
          }
        }
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
