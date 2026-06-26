#!/usr/bin/env node
/**
 * @file Regenerates the repo-root `openapi.yaml` from the single source of
 * truth — `createOpenApiSpec()` in `server/openapi.js`. The JSON spec served at
 * `/api/openapi.json` and this committed YAML mirror are therefore always in
 * sync: run `npm run openapi:yaml` after any spec change. Never hand-edit
 * `openapi.yaml`.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { createOpenApiSpec } = require("../server/openapi");

const OUT = path.join(__dirname, "..", "openapi.yaml");

function main() {
  const spec = createOpenApiSpec();
  const body = yaml.dump(spec, {
    lineWidth: -1, // don't wrap long strings (keeps descriptions/examples intact)
    noRefs: true, // inline any shared object references for a portable document
    sortKeys: false, // preserve authored key order
  });
  const header =
    "# DO NOT EDIT BY HAND. Generated from server/openapi.js via `npm run openapi:yaml`.\n" +
    "# This YAML mirrors the live spec served at GET /api/openapi.json.\n";
  fs.writeFileSync(OUT, header + body, "utf8");
  const stat = fs.statSync(OUT);
  const pathCount = Object.keys(spec.paths || {}).length;
  console.log(`Wrote ${OUT} (${pathCount} paths, ${stat.size} bytes).`);
}

main();
