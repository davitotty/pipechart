'use strict';

// Sparkline renderer — single-line inline chart using Unicode block chars

var ansi = require('../ansi');
var scale = require('../scale');

// Unicode block elements from lowest to highest
var SPARKS = [
  '\u2581', // ▁  1/8
  '\u2582', // ▂  2/8
  '\u2583', // ▃  3/8
  '\u2584', // ▄  4/8
  '\u2585', // ▅  5/8
  '\u2586', // ▆  6/8
  '\u2587', // ▇  7/8
  '\u2588'  // █  8/8
];

/**
 * Convert a single normalized value [0,1] to a spark character.
 * @param {number} normalized — value in [0, 1]
 * @returns {string}
 */
function toSparkChar(normalized) {
  var idx = Math.round(normalized * (SPARKS.length - 1));
  if (idx < 0) idx = 0;
  if (idx >= SPARKS.length) idx = SPARKS.length - 1;
  return SPARKS[idx];
}

/**
 * Render a sparkline.
 *
 * @param {object} opts
 * @param {number[]}  opts.values   — data values
 * @param {number}    opts.width    — max terminal width (chars)
 * @param {string}    [opts.color]  — ANSI color name
 * @param {string}    [opts.title]  — optional title prefix
 * @returns {string}  — single line (or title + line)
 */
function render(opts) {
  var values = opts.values || [];
  var width  = opts.width  || 80;
  var color  = opts.color  || 'green';
  var title  = opts.title  || null;

  if (values.length === 0) {
    return ansi.colorize('(no data)', 'dim');
  }

  var minVal = scale.min(values);
  var maxVal = scale.max(values);

  // If we have more values than width, downsample by averaging buckets
  var displayValues = values;
  if (values.length > width) {
    displayValues = downsample(values, width);
  }

  var spark = '';
  for (var i = 0; i < displayValues.length; i++) {
    var norm = scale.normalize(displayValues[i], minVal, maxVal);
    spark += toSparkChar(norm);
  }

  var colored = ansi.colorize(spark, color);

  var minStr = ansi.dim(scale.formatNum(minVal));
  var maxStr = ansi.dim(scale.formatNum(maxVal));

  var lines = [];
  if (title) {
    lines.push(ansi.bold(ansi.colorize(title, color)));
  }
  lines.push(colored + '  ' + minStr + ' \u2013 ' + maxStr);

  return lines.join('\n');
}

/**
 * Downsample an array to targetLen by averaging buckets.
 * @param {number[]} values
 * @param {number} targetLen
 * @returns {number[]}
 */
function downsample(values, targetLen) {
  var result = [];
  var bucketSize = values.length / targetLen;
  for (var i = 0; i < targetLen; i++) {
    var start = Math.floor(i * bucketSize);
    var end   = Math.floor((i + 1) * bucketSize);
    if (end > values.length) end = values.length;
    var sum = 0;
    for (var j = start; j < end; j++) sum += values[j];
    result.push(sum / (end - start));
  }
  return result;
}

module.exports = { render: render, toSparkChar: toSparkChar, downsample: downsample };
