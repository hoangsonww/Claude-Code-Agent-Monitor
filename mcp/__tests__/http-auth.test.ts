/**
 * @file http-auth.test.ts
 * @description Verifies MCP HTTP transport bearer-token matching without
 * starting a network listener.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isHttpRequestAuthorized } from "../src/transports/http-server.js";

describe("MCP HTTP authentication", () => {
  it("is disabled when no token is configured", () => {
    assert.equal(isHttpRequestAuthorized({}, undefined), true);
  });

  it("accepts bearer and x-mcp-token credentials", () => {
    assert.equal(
      isHttpRequestAuthorized({ authorization: "Bearer mcp-secret" }, "mcp-secret"),
      true
    );
    assert.equal(isHttpRequestAuthorized({ "x-mcp-token": "mcp-secret" }, "mcp-secret"), true);
  });

  it("rejects missing or invalid credentials", () => {
    assert.equal(isHttpRequestAuthorized({}, "mcp-secret"), false);
    assert.equal(isHttpRequestAuthorized({ authorization: "Bearer wrong" }, "mcp-secret"), false);
  });
});
