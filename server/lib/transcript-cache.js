/**
 * @file TranscriptCache class for efficient extraction of token usage and compaction data from JSONL transcript files, with stat-based caching and incremental reads to handle append-only growth without re-reading the entire file. Also extracts API error entries and turn duration system messages for enhanced analytics.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const fs = require("fs");

const MAX_CACHE_ENTRIES = 200;

class TranscriptCache {
  constructor(maxEntries = MAX_CACHE_ENTRIES) {
    this._cache = new Map();
    this._maxEntries = maxEntries;
  }

  /**
   * Extract token usage and compaction data from a JSONL transcript file.
   * Uses stat-based caching with incremental reads for append-only growth.
   * Returns null if file doesn't exist or has no data.
   */
  extract(transcriptPath) {
    if (!transcriptPath) return null;
    try {
      let stat;
      try {
        stat = fs.statSync(transcriptPath);
      } catch {
        return null;
      }
      const key = transcriptPath;
      const cached = this._cache.get(key);

      // Cache hit: file unchanged (same mtime + size)
      if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
        return cached.result;
      }

      // File shrunk or first read → full re-read
      if (!cached || stat.size < cached.bytesRead) {
        const result = this._fullRead(transcriptPath);
        this._set(key, {
          mtimeMs: stat.mtimeMs,
          size: stat.size,
          bytesRead: stat.size,
          tokensByModel: result ? this._cloneTokens(result.tokensByModel) : null,
          compaction: result ? this._cloneCompaction(result.compaction) : null,
          errors: result?.errors ? [...result.errors] : null,
          turnDurations: result?.turnDurations ? [...result.turnDurations] : null,
          thinkingBlockCount: result?.thinkingBlockCount || 0,
          usageExtras: result ? this._cloneUsageExtras(result.usageExtras) : null,
          result,
        });
        return result;
      }

      // File grew → incremental read from last position
      if (stat.size > cached.bytesRead) {
        const newContent = this._readFrom(transcriptPath, cached.bytesRead, stat.size);
        if (newContent) {
          const incremental = this._parseContent(newContent);
          const merged = this._merge(cached, incremental);
          const hasTokens = Object.keys(merged.tokensByModel).length > 0;
          const hasTurnDurations = merged.turnDurations && merged.turnDurations.length > 0;
          const hasUsageExtras =
            merged.usageExtras &&
            (merged.usageExtras.service_tiers.length > 0 ||
              merged.usageExtras.speeds.length > 0 ||
              merged.usageExtras.inference_geos.length > 0);
          const result = {
            tokensByModel: hasTokens ? merged.tokensByModel : null,
            compaction: merged.compaction,
            errors: merged.errors,
            turnDurations: hasTurnDurations ? merged.turnDurations : null,
            thinkingBlockCount: merged.thinkingBlockCount || 0,
            usageExtras: hasUsageExtras ? merged.usageExtras : null,
          };
          if (
            !result.tokensByModel &&
            !result.compaction &&
            !result.errors &&
            !result.turnDurations &&
            !result.thinkingBlockCount &&
            !result.usageExtras
          ) {
            this._set(key, {
              mtimeMs: stat.mtimeMs,
              size: stat.size,
              bytesRead: stat.size,
              tokensByModel: null,
              compaction: null,
              errors: null,
              turnDurations: null,
              thinkingBlockCount: 0,
              usageExtras: null,
              result: null,
            });
            return null;
          }
          this._set(key, {
            mtimeMs: stat.mtimeMs,
            size: stat.size,
            bytesRead: stat.size,
            tokensByModel: this._cloneTokens(result.tokensByModel),
            compaction: this._cloneCompaction(result.compaction),
            errors: result.errors ? [...result.errors] : null,
            turnDurations: result.turnDurations ? [...result.turnDurations] : null,
            thinkingBlockCount: result.thinkingBlockCount || 0,
            usageExtras: this._cloneUsageExtras(result.usageExtras),
            result,
          });
          return result;
        }

        // Only whitespace/newlines appended
        this._set(key, {
          ...cached,
          mtimeMs: stat.mtimeMs,
          size: stat.size,
          bytesRead: stat.size,
        });
        return cached.result;
      }

      // Same size, different mtime — content may have been rewritten (compaction)
      const result = this._fullRead(transcriptPath);
      this._set(key, {
        mtimeMs: stat.mtimeMs,
        size: stat.size,
        bytesRead: stat.size,
        tokensByModel: result ? this._cloneTokens(result.tokensByModel) : null,
        compaction: result ? this._cloneCompaction(result.compaction) : null,
        errors: result?.errors ? [...result.errors] : null,
        turnDurations: result?.turnDurations ? [...result.turnDurations] : null,
        thinkingBlockCount: result?.thinkingBlockCount || 0,
        usageExtras: result ? this._cloneUsageExtras(result.usageExtras) : null,
        result,
      });
      return result;
    } catch {
      return null;
    }
  }

  /**
   * Extract only compaction entries from a JSONL file.
   * Replacement for findCompactionsInFile — uses the same cache, no duplicate reads.
   */
  extractCompactions(transcriptPath) {
    const result = this.extract(transcriptPath);
    if (!result || !result.compaction) return [];
    return result.compaction.entries.map((e) => ({ ...e }));
  }

  _fullRead(filePath) {
    const content = fs.readFileSync(filePath, "utf8");
    return this._parseContent(content);
  }

  _readFrom(filePath, offset, totalSize) {
    const len = totalSize - offset;
    if (len <= 0) return null;
    const buf = Buffer.alloc(len);
    const fd = fs.openSync(filePath, "r");
    let bytesRead;
    try {
      bytesRead = fs.readSync(fd, buf, 0, len, offset);
    } finally {
      fs.closeSync(fd);
    }
    // If file was truncated between stat and read, only use actual bytes read
    const usable = bytesRead < len ? buf.subarray(0, bytesRead) : buf;
    return usable.toString("utf8");
  }

  _parseContent(content) {
    const tokensByModel = {};
    let compaction = null;
    const errors = [];
    const turnDurations = [];
    let thinkingBlockCount = 0;
    const usageExtras = { service_tiers: new Set(), speeds: new Set(), inference_geos: new Set() };

    for (const line of content.split("\n")) {
      if (!line) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.isCompactSummary) {
          if (!compaction) compaction = { count: 0, entries: [] };
          compaction.count++;
          compaction.entries.push({
            uuid: entry.uuid || null,
            timestamp: entry.timestamp || null,
          });
        }

        // Turn duration tracking (system entries with subtype "turn_duration")
        if (entry.type === "system" && entry.subtype === "turn_duration" && entry.durationMs) {
          const turnTs = entry.timestamp
            ? typeof entry.timestamp === "number"
              ? new Date(entry.timestamp).toISOString()
              : entry.timestamp
            : null;
          turnDurations.push({ durationMs: entry.durationMs, timestamp: turnTs });
        }

        // Detect API errors in transcript: error responses from Claude API
        // (quota limits, rate limits, overloaded, auth errors, etc.)
        const msg = entry.message || entry;
        if (msg.type === "error" && msg.error) {
          errors.push({
            type: msg.error.type || "unknown_error",
            message: msg.error.message || "Unknown API error",
            timestamp: entry.timestamp || null,
          });
          continue;
        }

        // Detect isApiErrorMessage entries (quota limits, rate limits, etc.)
        if (entry.isApiErrorMessage) {
          const errContent = Array.isArray(entry.message?.content) ? entry.message.content : [];
          const errText = errContent[0]?.text ? errContent[0].text.slice(0, 500) : "Unknown error";
          errors.push({
            type: entry.error || "unknown_error",
            message: errText,
            timestamp: entry.timestamp || null,
          });
          continue;
        }

        const model = msg.model;
        if (!model || model === "<synthetic>" || !msg.usage) continue;
        if (!tokensByModel[model]) {
          tokensByModel[model] = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
        }
        tokensByModel[model].input += msg.usage.input_tokens || 0;
        tokensByModel[model].output += msg.usage.output_tokens || 0;
        tokensByModel[model].cacheRead += msg.usage.cache_read_input_tokens || 0;
        tokensByModel[model].cacheWrite += msg.usage.cache_creation_input_tokens || 0;

        // Track usage extras (service_tier, speed, inference_geo)
        if (msg.usage.service_tier) usageExtras.service_tiers.add(msg.usage.service_tier);
        if (msg.usage.speed) usageExtras.speeds.add(msg.usage.speed);
        if (msg.usage.inference_geo && msg.usage.inference_geo !== "not_available") {
          usageExtras.inference_geos.add(msg.usage.inference_geo);
        }

        // Count thinking blocks in assistant message content
        const msgContent = msg.content || [];
        if (Array.isArray(msgContent)) {
          for (const block of msgContent) {
            if (block.type === "thinking") thinkingBlockCount++;
          }
        }
      } catch {
        continue;
      }
    }
    const hasTokens = Object.keys(tokensByModel).length > 0;
    const hasErrors = errors.length > 0;
    const hasTurnDurations = turnDurations.length > 0;
    const hasUsageExtras =
      usageExtras.service_tiers.size > 0 ||
      usageExtras.speeds.size > 0 ||
      usageExtras.inference_geos.size > 0;
    if (
      !hasTokens &&
      !compaction &&
      !hasErrors &&
      !hasTurnDurations &&
      !thinkingBlockCount &&
      !hasUsageExtras
    )
      return null;

    const serializedExtras = hasUsageExtras
      ? {
          service_tiers: [...usageExtras.service_tiers],
          speeds: [...usageExtras.speeds],
          inference_geos: [...usageExtras.inference_geos],
        }
      : null;

    return {
      tokensByModel: hasTokens ? tokensByModel : null,
      compaction,
      errors: hasErrors ? errors : null,
      turnDurations: hasTurnDurations ? turnDurations : null,
      thinkingBlockCount,
      usageExtras: serializedExtras,
    };
  }

  _merge(cached, incremental) {
    const tokensByModel = cached.tokensByModel ? this._cloneTokens(cached.tokensByModel) : {};
    if (incremental && incremental.tokensByModel) {
      for (const [model, tokens] of Object.entries(incremental.tokensByModel)) {
        if (!tokensByModel[model]) {
          tokensByModel[model] = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
        }
        tokensByModel[model].input += tokens.input;
        tokensByModel[model].output += tokens.output;
        tokensByModel[model].cacheRead += tokens.cacheRead;
        tokensByModel[model].cacheWrite += tokens.cacheWrite;
      }
    }

    let compaction = cached.compaction ? this._cloneCompaction(cached.compaction) : null;
    if (incremental && incremental.compaction) {
      if (!compaction) compaction = { count: 0, entries: [] };
      compaction.count += incremental.compaction.count;
      compaction.entries.push(...incremental.compaction.entries);
    }

    let errors = cached.errors ? [...cached.errors] : null;
    if (incremental && incremental.errors) {
      if (!errors) errors = [];
      errors.push(...incremental.errors);
    }

    let turnDurations = cached.turnDurations ? [...cached.turnDurations] : null;
    if (incremental && incremental.turnDurations) {
      if (!turnDurations) turnDurations = [];
      turnDurations.push(...incremental.turnDurations);
    }

    const thinkingBlockCount =
      (cached.thinkingBlockCount || 0) + (incremental?.thinkingBlockCount || 0);

    let usageExtras = cached.usageExtras ? this._cloneUsageExtras(cached.usageExtras) : null;
    if (incremental && incremental.usageExtras) {
      if (!usageExtras) {
        usageExtras = { service_tiers: [], speeds: [], inference_geos: [] };
      }
      // Merge and deduplicate
      const merged = {
        service_tiers: new Set([
          ...usageExtras.service_tiers,
          ...incremental.usageExtras.service_tiers,
        ]),
        speeds: new Set([...usageExtras.speeds, ...incremental.usageExtras.speeds]),
        inference_geos: new Set([
          ...usageExtras.inference_geos,
          ...incremental.usageExtras.inference_geos,
        ]),
      };
      usageExtras = {
        service_tiers: [...merged.service_tiers],
        speeds: [...merged.speeds],
        inference_geos: [...merged.inference_geos],
      };
    }

    return { tokensByModel, compaction, errors, turnDurations, thinkingBlockCount, usageExtras };
  }

  _cloneTokens(tokensByModel) {
    if (!tokensByModel) return null;
    const clone = {};
    for (const [model, t] of Object.entries(tokensByModel)) {
      clone[model] = { ...t };
    }
    return clone;
  }

  _cloneCompaction(compaction) {
    if (!compaction) return null;
    return { count: compaction.count, entries: compaction.entries.map((e) => ({ ...e })) };
  }

  _cloneUsageExtras(extras) {
    if (!extras) return null;
    return {
      service_tiers: [...(extras.service_tiers || [])],
      speeds: [...(extras.speeds || [])],
      inference_geos: [...(extras.inference_geos || [])],
    };
  }

  /** Set cache entry with LRU eviction when at capacity */
  _set(key, entry) {
    // Delete first so re-insertion moves key to end of Map iteration order
    this._cache.delete(key);
    this._cache.set(key, entry);
    // Evict oldest entries (first in Map iteration order) if over limit
    while (this._cache.size > this._maxEntries) {
      const oldest = this._cache.keys().next().value;
      this._cache.delete(oldest);
    }
  }

  /** Number of entries currently cached */
  get size() {
    return this._cache.size;
  }

  /** Remove a specific path from cache */
  invalidate(transcriptPath) {
    this._cache.delete(transcriptPath);
  }

  /** Clear all cached entries */
  clear() {
    this._cache.clear();
  }

  /** Return cache stats for diagnostics */
  stats() {
    return {
      entries: this._cache.size,
      paths: [...this._cache.keys()],
    };
  }
}

module.exports = TranscriptCache;
