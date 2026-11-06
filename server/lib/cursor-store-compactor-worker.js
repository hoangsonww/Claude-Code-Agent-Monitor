/**
 * @file Worker entry point for bounded legacy Cursor native-store migration.
 * Keeps retry state inside one isolated process thread while the serving and
 * hook-ingestion event loop remains responsive.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const { parentPort } = require("node:worker_threads");
const { compactLegacyCursorStoresSync } = require("./cursor-store-transcript");

parentPort.on("message", ({ id, options }) => {
  let result;
  try {
    result = compactLegacyCursorStoresSync(options);
  } catch {
    result = { scanned: 0, compacted: 0, remaining: 0, failed: true };
  }
  parentPort.postMessage({ id, result });
});
