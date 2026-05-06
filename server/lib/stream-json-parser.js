/**
 * @file Newline-delimited JSON line buffer. Reassembles chunked stdout into
 * discrete JSON objects (one per line). Robust to partial writes; malformed
 * lines do not throw.
 */

function createLineParser(onObject, onError) {
  let buf = "";
  return {
    push(chunk) {
      buf += chunk;
      let idx;
      while ((idx = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        if (!line.trim()) continue;
        try {
          onObject(JSON.parse(line));
        } catch (err) {
          if (onError) onError(err, line);
        }
      }
    },
    flush() {
      if (!buf.trim()) {
        buf = "";
        return;
      }
      try {
        onObject(JSON.parse(buf));
      } catch (err) {
        if (onError) onError(err, buf);
      }
      buf = "";
    },
  };
}

module.exports = { createLineParser };
