#!/usr/bin/env node

/**
 * Clears all sessions, agents, events, and token usage from the database.
 * Useful for removing seed/demo data before using the real dashboard.
 */

let Database;
try {
  Database = require("better-sqlite3");
} catch {
  try {
    Database = require("../server/compat-sqlite");
  } catch {
    console.error(
      "Error: No SQLite backend available. Upgrade to Node.js 22+ or install build tools."
    );
    process.exit(1);
  }
}
const path = require("path");

const DB_PATH = process.env.DASHBOARD_DB_PATH || path.join(__dirname, "..", "data", "dashboard.db");

const db = new Database(DB_PATH);
db.pragma("foreign_keys = OFF");

const counts = {
  token_usage: db.prepare("SELECT COUNT(*) as n FROM token_usage").get()?.n ?? 0,
  events: db.prepare("SELECT COUNT(*) as n FROM events").get()?.n ?? 0,
  agents: db.prepare("SELECT COUNT(*) as n FROM agents").get()?.n ?? 0,
  sessions: db.prepare("SELECT COUNT(*) as n FROM sessions").get()?.n ?? 0,
};

db.exec("DELETE FROM token_usage; DELETE FROM events; DELETE FROM agents; DELETE FROM sessions;");

db.pragma("foreign_keys = ON");
db.close();

console.log("Database cleared:");
console.log(`  Sessions: ${counts.sessions}`);
console.log(`  Agents:   ${counts.agents}`);
console.log(`  Events:   ${counts.events}`);
console.log(`  Tokens:   ${counts.token_usage}`);
console.log("");
console.log("Ready for real Claude Code sessions.");
