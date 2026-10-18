/**
 * @file Runs real database initialization on both SQLite backends to verify
 * legacy Codex tool markers are cleared without rewriting already-cleared
 * history on subsequent starts or changing event identities and counts.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const child = String.raw`
  const assert = require('node:assert/strict');
  const Module = require('node:module');
  const backend = process.argv[2];
  if (backend === 'compat') {
    const load = Module._load;
    Module._load = function(name, ...args) {
      if (name === 'better-sqlite3') throw new Error('fixture: force builtin SQLite');
      return load.call(this, name, ...args);
    };
  }
  const file = process.argv[1];
  const initialize = () => {
    delete require.cache[require.resolve(file)];
    return require(file).db;
  };
  let db = initialize();
  const expectedDriver = backend === 'native' ? require('better-sqlite3') : require(process.argv[3]);
  assert(db instanceof expectedDriver);
  db.exec("INSERT INTO sessions(id,name) VALUES('fixture','fixture')");
  const insert = db.prepare('INSERT INTO events(session_id,event_type,tool_name,summary) VALUES(?,?,?,?)');
  for (const type of ['codex_exec_command_end','codex_mcp_tool_call_end','codex_web_search_end']) {
    insert.run('fixture',type,type === 'codex_web_search_end' ? '' : 'legacy-tool','preserved');
    insert.run('fixture',type,null,'already-cleared');
  }
  insert.run('fixture','ToolUse','real-tool','unrelated');
  const identity = () => db.prepare('SELECT id,session_id,event_type,summary,data,created_at FROM events ORDER BY id').all();
  const before = identity();
  db.exec('CREATE TABLE fixture_marker_updates(id INTEGER,old_tool TEXT,new_tool TEXT);\
    CREATE TRIGGER fixture_marker_update AFTER UPDATE OF tool_name ON events BEGIN\
      INSERT INTO fixture_marker_updates VALUES(NEW.id,OLD.tool_name,NEW.tool_name); END;');
  db.close();
  for (let start = 0; start < 2; start++) {
    db = initialize();
    assert.deepEqual(identity(),before);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fixture_marker_updates').get().n,3);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM fixture_marker_updates WHERE old_tool IS NULL OR new_tool IS NOT NULL').get().n,0);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM events WHERE event_type != 'ToolUse' AND tool_name IS NOT NULL").get().n,0);
    assert.equal(db.prepare("SELECT tool_name FROM events WHERE event_type='ToolUse'").get().tool_name,'real-tool');
    const counter = require(process.argv[4]);
    assert.equal(counter.trustedGlobalEventCount(db),7);
    assert.equal(db.prepare("SELECT total FROM monitor_session_event_counts WHERE session_id='fixture'").get().total,7);
    db.close();
  }
  console.log(JSON.stringify({backend,initializations:3,marker_updates:3,events:7}));
`;

for (const backend of ["native", "compat"])
  it(`${backend}: startup clears only remaining legacy tool markers`, (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ccam-tool-marker-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const result = spawnSync(
      process.execPath,
      [
        "-e",
        child,
        path.resolve(__dirname, "../db.js"),
        backend,
        path.resolve(__dirname, "../compat-sqlite.js"),
        path.resolve(__dirname, "../lib/global-event-count.js"),
      ],
      {
        cwd: path.resolve(__dirname, "../.."),
        env: {
          ...process.env,
          CLAUDE_HOME: path.join(root, "claude"),
          DASHBOARD_DATA_DIR: path.join(root, "data"),
          DASHBOARD_DB_PATH: path.join(root, "fixture.db"),
        },
        encoding: "utf8",
        timeout: 15000,
      }
    );
    assert.ifError(result.error);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /"marker_updates":3/);
  });
