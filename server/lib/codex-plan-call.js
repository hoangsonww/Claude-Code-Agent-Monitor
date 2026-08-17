/**
 * @file Locates executable `tools.update_plan(...)` calls inside Codex unified
 * exec wrappers while ignoring matching text in strings and comments.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const MARKER = "tools.update_plan";

function skipQuoted(source, index, quote) {
  index++;
  while (index < source.length) {
    const character = source[index++];
    if (character === "\\") index++;
    else if (character === quote) break;
  }
  return index;
}

function updatePlanArgumentIndexes(source) {
  if (typeof source !== "string" || !source.includes(MARKER)) return [];
  const indexes = [];
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    if (character === '"' || character === "'" || character === "`") {
      index = skipQuoted(source, index, character);
      continue;
    }
    if (character === "/" && source[index + 1] === "/") {
      const newline = source.indexOf("\n", index + 2);
      index = newline < 0 ? source.length : newline + 1;
      continue;
    }
    if (character === "/" && source[index + 1] === "*") {
      const close = source.indexOf("*/", index + 2);
      index = close < 0 ? source.length : close + 2;
      continue;
    }
    if (source.startsWith(MARKER, index) && !/[A-Za-z0-9_$]/.test(source[index - 1] || "")) {
      let argumentIndex = index + MARKER.length;
      while (/\s/.test(source[argumentIndex] || "")) argumentIndex++;
      if (source[argumentIndex] === "(") indexes.push(argumentIndex + 1);
      index = argumentIndex + 1;
      continue;
    }
    index++;
  }
  return indexes;
}

module.exports = { updatePlanArgumentIndexes };
