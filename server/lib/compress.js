/**
 * @file compress.js
 * @description Dependency-free gzip for the dashboard: hashed client assets are compressed once
 * and kept in memory (they are immutable per URL), and larger JSON API responses are gzipped on the
 * fly. Matters most for phones reaching the dashboard over a tunnel (e.g. Tailscale), where the
 * ~2.5 MB uncompressed bundle and event payloads of several hundred KB were the slow part.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

/** Only these asset types benefit from gzip (images, fonts and media are already compressed). */
const COMPRESSIBLE = /\.(?:js|mjs|css|svg|json|map|html|txt)$/i;
/** Skip JSON bodies smaller than this; the gzip header would cost more than it saves. */
const MIN_JSON_BYTES = 2048;
/** Upper bound for the in-memory asset cache. */
const MAX_CACHE_BYTES = 64 * 1024 * 1024;

/** True when the client advertises gzip support. */
function acceptsGzip(req) {
  return /\bgzip\b/i.test(String(req.headers["accept-encoding"] || ""));
}

/**
 * Serve gzipped copies of files under `<clientDist>/assets/`. Unknown files, non-compressible
 * types and clients without gzip fall through to `express.static`.
 *
 * @param {string} clientDist - Absolute path of the built client.
 * @returns {import("express").RequestHandler} Middleware to mount on `/assets`.
 */
function gzipAssets(clientDist) {
  const dir = path.join(clientDist, "assets");
  /** @type {Map<string, Buffer>} */
  const cache = new Map();
  let cachedBytes = 0;
  return function gzipAssetsMiddleware(req, res, next) {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (!acceptsGzip(req)) return next();
    const name = path.basename(decodeURIComponent(req.path || ""));
    if (!name || !COMPRESSIBLE.test(name)) return next();
    const file = path.join(dir, name);
    let body = cache.get(file);
    if (!body) {
      let raw;
      try {
        raw = fs.readFileSync(file);
      } catch {
        return next();
      }
      body = zlib.gzipSync(raw, { level: 9 });
      if (cachedBytes + body.length <= MAX_CACHE_BYTES) {
        cache.set(file, body);
        cachedBytes += body.length;
      }
    }
    res.setHeader("Content-Encoding", "gzip");
    res.setHeader("Vary", "Accept-Encoding");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Content-Length", String(body.length));
    res.type(path.extname(name));
    if (req.method === "HEAD") return res.end();
    return res.end(body);
  };
}

/**
 * Gzip `res.json` bodies above {@link MIN_JSON_BYTES} for clients that accept gzip.
 *
 * @returns {import("express").RequestHandler} Middleware to mount on `/api`.
 */
function gzipJson() {
  return function gzipJsonMiddleware(req, res, next) {
    if (!acceptsGzip(req)) return next();
    const original = res.json.bind(res);
    res.json = (body) => {
      let text;
      try {
        text = JSON.stringify(body);
      } catch {
        return original(body);
      }
      if (text === undefined || text.length < MIN_JSON_BYTES || res.headersSent) {
        return original(body);
      }
      const gz = zlib.gzipSync(text);
      if (!res.getHeader("Content-Type")) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
      }
      res.setHeader("Content-Encoding", "gzip");
      res.setHeader("Vary", "Accept-Encoding");
      res.setHeader("Content-Length", String(gz.length));
      return res.end(gz);
    };
    next();
  };
}

module.exports = { gzipAssets, gzipJson, acceptsGzip };
