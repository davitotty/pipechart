'use strict';

// Normalization and scaling math helpers

/**
 * Find the minimum value in an array of numbers.
 * @param {number[]} values
 * @returns {number}
 */
function min(values) {
  var m = Infinity;
  for (var i = 0; i < values.length; i++) {
    if (values[i] < m) m = values[i];
  }
  return m;
}

/**
 * Find the maximum value in an array of numbers.
 * @param {number[]} values
 * @returns {number}
 */
function max(values) {
  var m = -Infinity;
  for (var i = 0; i < values.length; i++) {
    if (values[i] > m) m = values[i];
  }
  return m;
}

/**
 * Normalize a value from [minVal, maxVal] to [0, 1].
 * Returns 0 if minVal === maxVal (flat line).
 * @param {number} value
 * @param {number} minVal
 * @param {number} maxVal
 * @returns {number}
 */
function normalize(value, minVal, maxVal) {
  if (maxVal === minVal) return 0;
  return (value - minVal) / (maxVal - minVal);
}

/**
 * Scale a normalized value [0,1] to [0, range].
 * @param {number} normalized  — value in [0, 1]
 * @param {number} range       — target integer range (e.g. terminal width)
 * @returns {number}           — integer in [0, range]
 */
function scaleToRange(normalized, range) {
  return Math.round(normalized * range);
}

/**
 * Map a value from [minVal, maxVal] directly to [0, range].
 * @param {number} value
 * @param {number} minVal
 * @param {number} maxVal
 * @param {number} range
 * @returns {number}
 */
function mapToRange(value, minVal, maxVal, range) {
  return scaleToRange(normalize(value, minVal, maxVal), range);
}

/**
 * Compute a "nice" tick step for axis labels.
 * @param {number} range   — the data range (max - min)
 * @param {number} ticks   — desired number of ticks
 * @returns {number}
 */
function niceStep(range, ticks) {
  if (range === 0) return 1;
  var rawStep = range / ticks;
  var magnitude = Math.pow(10, Math.floor(Math.log(rawStep) / Math.LN10));
  var normalized = rawStep / magnitude;
  var nice;
  if (normalized < 1.5) nice = 1;
  else if (normalized < 3) nice = 2;
  else if (normalized < 7) nice = 5;
  else nice = 10;
  return nice * magnitude;
}

/**
 * Format a number for axis display — trim unnecessary decimals.
 * @param {number} value
 * @param {number} [decimals=2]
 * @returns {string}
 */
function formatNum(value, decimals) {
  if (decimals === undefined) decimals = 2;
  if (Number.isInteger(value)) return String(value);
  var s = value.toFixed(decimals);
  // Remove trailing zeros after decimal point
  s = s.replace(/\.?0+$/, '');
  return s;
}

/**
 * Auto-bin an array of numbers into `binCount` histogram bins.
 * Returns an array of { min, max, count } objects.
 * @param {number[]} values
 * @param {number} binCount
 * @returns {Array<{min: number, max: number, count: number}>}
 */
function autoBin(values, binCount) {
  if (!values || values.length === 0) return [];
  var minVal = min(values);
  var maxVal = max(values);
  if (minVal === maxVal) {
    return [{ min: minVal, max: maxVal, count: values.length }];
  }
  var binWidth = (maxVal - minVal) / binCount;
  var bins = [];
  for (var i = 0; i < binCount; i++) {
    bins.push({
      min: minVal + i * binWidth,
      max: minVal + (i + 1) * binWidth,
      count: 0
    });
  }
  for (var j = 0; j < values.length; j++) {
    var v = values[j];
    var idx = Math.floor((v - minVal) / binWidth);
    // Clamp last value into last bin
    if (idx >= binCount) idx = binCount - 1;
    bins[idx].count++;
  }
  return bins;
}

/**
 * Pad a string on the left to a given width.
 * @param {string} s
 * @param {number} width
 * @param {string} [char=' ']
 * @returns {string}
 */
function padLeft(s, width, char) {
  if (char === undefined) char = ' ';
  s = String(s);
  while (s.length < width) s = char + s;
  return s;
}

/**
 * Pad a string on the right to a given width.
 * @param {string} s
 * @param {number} width
 * @param {string} [char=' ']
 * @returns {string}
 */
function padRight(s, width, char) {
  if (char === undefined) char = ' ';
  s = String(s);
  while (s.length < width) s = s + char;
  return s;
}

/**
 * Truncate a string to maxLen, appending '…' if truncated.
 * @param {string} s
 * @param {number} maxLen
 * @returns {string}
 */
function truncate(s, maxLen) {
  s = String(s);
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + '\u2026';
}

module.exports = {
  min: min,
  max: max,
  normalize: normalize,
  scaleToRange: scaleToRange,
  mapToRange: mapToRange,
  niceStep: niceStep,
  formatNum: formatNum,
  autoBin: autoBin,
  padLeft: padLeft,
  padRight: padRight,
  truncate: truncate
};
