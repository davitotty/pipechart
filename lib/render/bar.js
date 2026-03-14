'use strict';

// Horizontal bar chart renderer

var ansi = require('../ansi');
var scale = require('../scale');

var BAR_CHAR = '\u2588'; // █
var HALF_BAR = '\u258C'; // ▌

/**
 * Render a horizontal bar chart.
 *
 * @param {object} opts
 * @param {number[]}  opts.values   — data values
 * @param {string[]}  opts.labels   — bar labels (parallel to values)
 * @param {number}    opts.width    — total terminal width
 * @param {string}    [opts.color]  — ANSI color name
 * @param {string}    [opts.title]  — chart title
 * @returns {string}  — multi-line string ready to print
 */
function render(opts) {
  var values = opts.values || [];
  var labels = opts.labels || [];
  var width  = opts.width  || 80;
  var color  = opts.color  || 'cyan';
  var title  = opts.title  || null;

  if (values.length === 0) {
    return ansi.colorize('(no data)', 'dim');
  }

  var lines = [];

  // Title
  if (title) {
    lines.push(ansi.bold(ansi.colorize(title, color)));
    lines.push('');
  }

  var minVal = scale.min(values);
  var maxVal = scale.max(values);

  // Determine label column width
  var maxLabelLen = 0;
  for (var i = 0; i < values.length; i++) {
    var lbl = labels[i] !== undefined ? String(labels[i]) : String(i);
    if (lbl.length > maxLabelLen) maxLabelLen = lbl.length;
  }
  // Cap label width at 20 chars
  var labelWidth = Math.min(maxLabelLen, 20);

  // Value suffix width: " 12345.67"
  var maxValStr = scale.formatNum(maxVal);
  var valWidth = maxValStr.length + 1; // +1 for space

  // Available bar width
  var barAreaWidth = width - labelWidth - valWidth - 3; // 3 = " │ "
  if (barAreaWidth < 4) barAreaWidth = 4;

  // Axis info
  var axisMin = Math.min(0, minVal);
  var axisMax = maxVal;
  if (axisMax === axisMin) axisMax = axisMin + 1;

  // Zero line position (for negative values)
  var zeroPos = scale.mapToRange(0, axisMin, axisMax, barAreaWidth);

  for (var j = 0; j < values.length; j++) {
    var val = values[j];
    var label = labels[j] !== undefined ? String(labels[j]) : String(j);
    label = scale.truncate(label, labelWidth);
    label = scale.padRight(label, labelWidth);

    var barLen = scale.mapToRange(Math.max(val, 0), axisMin, axisMax, barAreaWidth);
    var negLen = val < 0 ? scale.mapToRange(Math.abs(val), 0, axisMax - axisMin, barAreaWidth) : 0;

    var bar;
    if (val >= 0) {
      // Positive bar: spaces up to zero, then bar
      var prefix = zeroPos > 0 ? scale.padRight('', zeroPos) : '';
      bar = prefix + ansi.colorize(repeat(BAR_CHAR, barLen), color);
    } else {
      // Negative bar: spaces, then bar going left, then zero marker
      var negBar = ansi.colorize(repeat(BAR_CHAR, negLen), 'red');
      var afterNeg = scale.padRight('', zeroPos - negLen);
      bar = afterNeg + negBar;
    }

    // Pad bar area to full width
    var rawBarLen = (val >= 0 ? zeroPos + barLen : zeroPos) ;
    var padding = barAreaWidth - rawBarLen;
    if (padding < 0) padding = 0;
    bar = bar + scale.padRight('', padding);

    var valStr = scale.padLeft(scale.formatNum(val), valWidth);

    lines.push(
      ansi.dim(label) + ' \u2502 ' + bar + ansi.dim(valStr)
    );
  }

  // Bottom axis
  var axisLine = scale.padRight('', labelWidth) + ' \u2514' + repeat('\u2500', barAreaWidth + 1);
  lines.push(ansi.dim(axisLine));

  // Axis labels: min and max
  var minLabel = scale.formatNum(axisMin);
  var maxLabel = scale.formatNum(axisMax);
  var axisLabels = scale.padRight('', labelWidth + 2) +
    minLabel +
    scale.padRight('', barAreaWidth - minLabel.length - maxLabel.length) +
    maxLabel;
  lines.push(ansi.dim(axisLabels));

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
