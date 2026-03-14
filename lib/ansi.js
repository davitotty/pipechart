'use strict';

// ANSI escape code helpers — color, cursor movement, screen control

var COLORS = {
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',
  bright_red:     '\x1b[91m',
  bright_green:   '\x1b[92m',
  bright_yellow:  '\x1b[93m',
  bright_blue:    '\x1b[94m',
  bright_cyan:    '\x1b[96m',
  bright_white:   '\x1b[97m',
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m'
};

/**
 * Wrap text in an ANSI color code.
 * @param {string} text
 * @param {string} colorName  — key from COLORS, or null/undefined for no color
 * @returns {string}
 */
function colorize(text, colorName) {
  if (!colorName || !COLORS[colorName]) return text;
  return COLORS[colorName] + text + COLORS.reset;
}

/**
 * Bold text.
 * @param {string} text
 * @returns {string}
 */
function bold(text) {
  return COLORS.bold + text + COLORS.reset;
}

/**
 * Dim text.
 * @param {string} text
 * @returns {string}
 */
function dim(text) {
  return COLORS.dim + text + COLORS.reset;
}

/**
 * Move cursor to top-left of screen (for live re-render).
 * @returns {string}
 */
function cursorHome() {
  return '\x1b[H';
}

/**
 * Clear the entire screen.
 * @returns {string}
 */
function clearScreen() {
  return '\x1b[2J';
}

/**
 * Clear from cursor to end of screen.
 * @returns {string}
 */
function clearToEnd() {
  return '\x1b[J';
}

/**
 * Hide the terminal cursor.
 * @returns {string}
 */
function hideCursor() {
  return '\x1b[?25l';
}

/**
 * Show the terminal cursor.
 * @returns {string}
 */
function showCursor() {
  return '\x1b[?25h';
}

/**
 * Move cursor up N lines.
 * @param {number} n
 * @returns {string}
 */
function cursorUp(n) {
  return '\x1b[' + n + 'A';
}

/**
 * Move cursor to beginning of line.
 * @returns {string}
 */
function cursorLineStart() {
  return '\r';
}

/**
 * Erase current line.
 * @returns {string}
 */
function eraseLine() {
  return '\x1b[2K';
}

module.exports = {
  COLORS: COLORS,
  colorize: colorize,
  bold: bold,
  dim: dim,
  cursorHome: cursorHome,
  clearScreen: clearScreen,
  clearToEnd: clearToEnd,
  hideCursor: hideCursor,
  showCursor: showCursor,
  cursorUp: cursorUp,
  cursorLineStart: cursorLineStart,
  eraseLine: eraseLine
};
