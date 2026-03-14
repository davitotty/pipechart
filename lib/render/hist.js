'use strict';

// Histogram renderer — vertical bars using █ blocks, auto-bins

var ansi = require('../ansi');
var scale = require('../scale');

var FULL_BLOCK  = '\u2588'; // █
var UPPER_HALF  = '\u2580'; // ▀  (top half block, for finer resolution)
var LOWER_HALF  = '\u2584'; // ▄

/**
 * Render a histogram.
 *
 * @param {object} opts
 * @param {number[]}  opts.values   — raw data values (will be binned)
 * @param {number}    opts.width    — terminal width
 * @param {string}    [opts.color]  — ANSI color name
 * @param {string}    [opts.title]  — chart title
 * @param {number}    [opts.height] — chart height in rows (default: 12)
 * @param {number}    [opts.bins]   — number of bins (default: auto)
 * @returns {string}
 */
function render(opts) {
  var values = opts.values || [];
  var width  = opts.width  || 80;
  var color  = opts.color  || 'yellow';
  var title  = opts.title  || null;
  var height = opts.height || 12;

  if (values.length === 0) {
    return ansi.colorize('(no data)', 'dim');
  }

  // Y-axis label width
  var maxCount = 0; // will be set after binning

  // Auto-determine bin count: Sturges' rule, capped to available width
  var yLabelWidth = 5; // placeholder, recalculated below
  var plotWidth = width - yLabelWidth - 2;
  if (plotWidth < 4) plotWidth = 4;

  var binCount = opts.bins || Math.min(
    Math.max(Math.ceil(Math.log2(values.length) + 1), 5),
    plotWidth
  );

  var bins = scale.autoBin(values, binCount);

  // Find max count for scaling
  for (var i = 0; i < bins.length; i++) {
    if (bins[i].count > maxCount) maxCount = bins[i].count;
  }

  // Recalculate y-axis label width based on actual max count
  yLabelWidth = String(maxCount).length + 1;
  plotWidth = width - yLabelWidth - 2;
  if (plotWidth < 4) plotWidth = 4;

  // Each bin gets at least 1 column; distribute evenly
  var colsPerBin = Math.max(1, Math.floor(plotWidth / bins.length));
  // Actual used width
  var usedWidth = colsPerBin * bins.length;

  var lines = [];

  if (title) {
    lines.push(ansi.bold(ansi.colorize(title, color)));
    lines.push('');
  }

  // Build grid row by row (top to bottom)
  for (var row = 0; row < height; row++) {
    // What count value does this row represent?
    // row 0 = top = maxCount, row height-1 = bottom = 0
    var rowThreshold = maxCount * (1 - row / (height - 1));

    // Y-axis label
    var yLabel = '';
    if (row === 0) {
      yLabel = String(maxCount);
    } else if (row === Math.floor(height / 2)) {
      yLabel = String(Math.round(maxCount / 2));
    } else if (row === height - 1) {
      yLabel = '0';
    }
    yLabel = scale.padLeft(yLabel, yLabelWidth);

    var rowStr = '';
    for (var b = 0; b < bins.length; b++) {
      var binHeight = (bins[b].count / maxCount) * height;
      var filledRows = height - Math.ceil(binHeight); // rows from top that are empty

      var cellChar;
      if (row < filledRows) {
        // Empty above the bar
        cellChar = repeat(' ', colsPerBin);
      } else {
        // Filled bar cell
        cellChar = ansi.colorize(repeat(FULL_BLOCK, colsPerBin), color);
      }
      rowStr += cellChar;
    }

    // Pad to usedWidth if needed
    var rawLen = bins.length * colsPerBin;
    if (rawLen < plotWidth) {
      rowStr += repeat(' ', plotWidth - rawLen);
    }

    lines.push(ansi.dim(yLabel) + ' \u2502' + rowStr);
  }

  // Bottom axis
  var axisLine = scale.padRight('', yLabelWidth) + ' \u2514' + repeat('\u2500', usedWidth);
  lines.push(ansi.dim(axisLine));

  // Bin range labels: first bin min and last bin max
  var minVal = scale.min(values);
  var maxVal = scale.max(values);
  var minLabel = scale.formatNum(minVal);
  var maxLabel = scale.formatNum(maxVal);
  var midLabel = scale.formatNum((minVal + maxVal) / 2);

  var labelLine = scale.padRight('', yLabelWidth + 2) +
    minLabel +
    scale.padRight('', Math.floor(usedWidth / 2) - minLabel.length - Math.floor(midLabel.length / 2)) +
    midLabel +
    scale.padRight('', usedWidth - Math.floor(usedWidth / 2) - Math.ceil(midLabel.length / 2) - maxLabel.length) +
    maxLabel;
  lines.push(ansi.dim(labelLine));

  // Count label
  lines.push(ansi.dim(scale.padRight('', yLabelWidth + 2) + 'n=' + values.length + '  bins=' + binCount));

  return lines.join('\n');
}

/**
 * Repeat a character n times.
 * @param {string} ch
 * @param {number} n
 * @returns {string}
 */
function repeat(ch, n) {
  var s = '';
  for (var i = 0; i < n; i++) s += ch;
  return s;
}

module.exports = { render: render };
