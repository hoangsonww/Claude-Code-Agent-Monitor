/**
 * @file colors.ts
 * @description Provides utility functions for applying ANSI color codes to text in the terminal. This module defines a set of functions for styling text with various colors and modifiers such as bold, italic, underline, and strikethrough. It also includes support for 256-color mode and a function to strip ANSI codes from text. The color functions are designed to be composable, allowing for easy combination of styles. The module checks for color support in the terminal environment and gracefully degrades if colors are not supported.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const isColorSupported =
  process.env.FORCE_COLOR !== "0" &&
  process.env.NO_COLOR === undefined &&
  (process.env.FORCE_COLOR !== undefined || (process.stdout.isTTY ?? false));

function wrap(open: string, close: string): (text: string) => string {
  if (!isColorSupported) return (text) => text;
  return (text) => `\x1b[${open}m${text}\x1b[${close}m`;
}

// Modifiers
export const bold = wrap("1", "22");
export const dim = wrap("2", "22");
export const italic = wrap("3", "23");
export const underline = wrap("4", "24");
export const strikethrough = wrap("9", "29");

// Foreground colors
export const black = wrap("30", "39");
export const red = wrap("31", "39");
export const green = wrap("32", "39");
export const yellow = wrap("33", "39");
export const blue = wrap("34", "39");
export const magenta = wrap("35", "39");
export const cyan = wrap("36", "39");
export const white = wrap("37", "39");
export const gray = wrap("90", "39");

// Bright foreground colors
export const brightRed = wrap("91", "39");
export const brightGreen = wrap("92", "39");
export const brightYellow = wrap("93", "39");
export const brightBlue = wrap("94", "39");
export const brightMagenta = wrap("95", "39");
export const brightCyan = wrap("96", "39");
export const brightWhite = wrap("97", "39");

// Background colors
export const bgRed = wrap("41", "49");
export const bgGreen = wrap("42", "49");
export const bgYellow = wrap("43", "49");
export const bgBlue = wrap("44", "49");
export const bgMagenta = wrap("45", "49");
export const bgCyan = wrap("46", "49");
export const bgWhite = wrap("47", "49");
export const bgGray = wrap("100", "49");

// 256-color support
export function fg256(code: number): (text: string) => string {
  if (!isColorSupported) return (text) => text;
  return (text) => `\x1b[38;5;${code}m${text}\x1b[39m`;
}

export function bg256(code: number): (text: string) => string {
  if (!isColorSupported) return (text) => text;
  return (text) => `\x1b[48;5;${code}m${text}\x1b[49m`;
}

// Utility
export const reset = isColorSupported ? "\x1b[0m" : "";

export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

// Composable styles
export const success = (t: string) => bold(green(t));
export const error = (t: string) => bold(red(t));
export const warn = (t: string) => bold(yellow(t));
export const info = (t: string) => bold(cyan(t));
export const muted = (t: string) => dim(gray(t));
export const highlight = (t: string) => bold(brightMagenta(t));
export const label = (t: string) => bold(brightWhite(t));
export const accent = (t: string) => bold(brightCyan(t));
