/**
 * @file Forces the production DB to use node:sqlite for import portability checks.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const Module = require("node:module");
const path = require("node:path");
const target = path.resolve(__dirname, "../../db.js");
const original = Module._load;
Module._load = function (request, parent, ...args) {
  if (request === "better-sqlite3" && parent?.filename === target) {
    const error = new Error("Forced optional-native absence for import acceptance");
    error.code = "MODULE_NOT_FOUND";
    throw error;
  }
  return original.call(this, request, parent, ...args);
};
