/**
 * @file Checks VS Code's dashboard prefix handling.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { it } = require("node:test");
const assert = require("node:assert/strict");
const { basePath } = require("../../vscode-extension/base-url");

it("normalizes root and padded prefixes from the extension host", () => {
  const previous = process.env.DASHBOARD_BASE_URL;
  try {
    for (const [input, expected] of [
      ["", ""],
      ["/", ""],
      [" /dashboard/ ", "/dashboard"],
    ]) {
      process.env.DASHBOARD_BASE_URL = input;
      assert.equal(basePath(), expected);
    }
  } finally {
    if (previous === undefined) delete process.env.DASHBOARD_BASE_URL;
    else process.env.DASHBOARD_BASE_URL = previous;
  }
});
