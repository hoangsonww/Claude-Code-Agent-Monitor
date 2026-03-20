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
          const result = {
            tokensByModel: hasTokens ? merged.tokensByModel : null,
            compaction: merged.compaction,
          };
          if (!result.tokensByModel && !result.compaction) {
            this._set(key, {
              mtimeMs: stat.mtimeMs,
              size: stat.size,
              bytesRead: stat.size,
              tokensByModel: null,
              compaction: null,
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
        const msg = entry.message || entry;
        const model = msg.model;
        if (!model || model === "<synthetic>" || !msg.usage) continue;
        if (!tokensByModel[model]) {
          tokensByModel[model] = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
        }
        tokensByModel[model].input += msg.usage.input_tokens || 0;
        tokensByModel[model].output += msg.usage.output_tokens || 0;
        tokensByModel[model].cacheRead += msg.usage.cache_read_input_tokens || 0;
        tokensByModel[model].cacheWrite += msg.usage.cache_creation_input_tokens || 0;
      } catch {
        continue;
      }
    }
    const hasTokens = Object.keys(tokensByModel).length > 0;
    if (!hasTokens && !compaction) return null;
    return { tokensByModel: hasTokens ? tokensByModel : null, compaction };
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

    return { tokensByModel, compaction };
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
