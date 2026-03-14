'use strict';

// Line chart renderer — plots points across terminal width
// Connects adjacent points with ASCII slope characters

var ansi = require('../ansi');
var scale = require('../scale');

// Characters used to draw the line
var CHARS = {
  dot:       '\u2022', // •  point
  horiz:     '\u2500', // ─  flat
  up:        '/',      //    rising
  down:      '\\',     //    falling
  vert:      '\u2502', // │  vertical
  cross:     '\u253C', // ┼  axis cross
  axisH:     '\u2500', // ─
  axisV:     '\u2502', // │
  corner:    '\u2514', // └
  tickH:     '\u252C', // ┬
  tickV:     '\u251C'  // ├
};

/**
 * Render a line chart.
 *
 * @param {object} opts
 * @param {number[]}  opts.values   — data values
 * @param {any[]}     [opts.times]  — time labels (parallel to values)
 * @param {number}    opts.width    — terminal width
 * @param {string}    [opts.color]  — ANSI color name
 * @param {string}    [opts.title]  — chart title
 * @param {number}    [opts.height] — chart height in rows (default: 12)
 * @returns {string}
 */
function render(opts) {
  var values = opts.values || [];
  var times  = opts.times  || null;
  var width  = opts.width  || 80;
  var color  = opts.color  || 'cyan';
  var title  = opts.title  || null;
  var height = opts.height || 12;

  if (values.length === 0) {
    return ansi.colorize('(no data)', 'dim');
  }

  var minVal = scale.min(values);
  var maxVal = scale.max(values);
  // Give a little padding so points don't sit on the very edge
  var range = maxVal - minVal;
  if (range === 0) range = 1;

  // Y-axis label width
  var yLabelWidth = Math.max(
    scale.formatNum(minVal).length,
    scale.formatNum(maxVal).length
  ) + 1;

  // Available plot width (after y-axis)
  var plotWidth = width - yLabelWidth - 2; // 2 = "│ "
  if (plotWidth < 4) plotWidth = 4;

  // Downsample or map values to plotWidth columns
  var plotValues = values;
  if (values.length > plotWidth) {
    plotValues = downsample(values, plotWidth);
  }

  var cols = plotValues.length;

  // Build a 2D grid: grid[row][col] = char or ' '
  var grid = [];
  for (var r = 0; r < height; r++) {
    var row = [];
    for (var c = 0; c < plotWidth; c++) {
      row.push(' ');
    }
    grid.push(row);
  }

  /**
   * Map a data value to a grid row (0 = top, height-1 = bottom).
   */
  function valueToRow(v) {
    var norm = scale.normalize(v, minVal - range * 0.05, maxVal + range * 0.05);
    var row = Math.round((1 - norm) * (height - 1));
    if (row < 0) row = 0;
    if (row >= height) row = height - 1;
    return row;
  }

  // Plot points and connecting lines
  for (var i = 0; i < cols; i++) {
    var col = Math.floor(i * plotWidth / cols);
    if (col >= plotWidth) col = plotWidth - 1;

    var row = valueToRow(plotValues[i]);

    if (i === 0) {
      grid[row][col] = CHARS.dot;
    } else {
      var prevCol = Math.floor((i - 1) * plotWidth / cols);
      if (prevCol >= plotWidth) prevCol = plotWidth - 1;
      var prevRow = valueToRow(plotValues[i - 1]);

      // Draw the point
      grid[row][col] = CHARS.dot;

      // Connect with slope character
      if (prevRow === row) {
        // Flat — fill horizontal between prevCol+1 and col-1
        for (var fc = prevCol + 1; fc < col; fc++) {
          if (grid[row][fc] === ' ') grid[row][fc] = CHARS.horiz;
        }
      } else {
        // Sloped — draw diagonal connector
        var rowStep = prevRow < row ? 1 : -1;
        var colStep = col > prevCol ? 1 : -1;
        var dr = Math.abs(row - prevRow);
        var dc = Math.abs(col - prevCol);
        var ch = rowStep > 0 ? CHARS.down : CHARS.up;

        if (dc === 0) {
          // Vertical segment
          for (var vr = prevRow + rowStep; vr !== row; vr += rowStep) {
            if (grid[vr][col] === ' ') grid[vr][col] = CHARS.vert;
          }
        } else {
          // Bresenham-like diagonal
          var err = 0;
          var cr = prevRow;
          var cc = prevCol;
          for (var step = 0; step < dc + dr; step++) {
            err += dr;
            if (err * 2 >= dc) {
              cr += rowStep;
              err -= dc;
            } else {
              cc += colStep;
            }
            if (cr !== row || cc !== col) {
              if (cc >= 0 && cc < plotWidth && cr >= 0 && cr < height) {
                if (grid[cr][cc] === ' ') grid[cr][cc] = ch;
              }
            }
          }
        }
      }
    }
  }

  // Render lines
  var lines = [];

  if (title) {
    lines.push(ansi.bold(ansi.colorize(title, color)));
    lines.push('');
  }

  for (var row2 = 0; row2 < height; row2++) {
    // Y-axis label (only at top, middle, bottom)
    var yLabel = '';
    if (row2 === 0) {
      yLabel = scale.formatNum(maxVal);
    } else if (row2 === Math.floor(height / 2)) {
      yLabel = scale.formatNum((minVal + maxVal) / 2);
    } else if (row2 === height - 1) {
      yLabel = scale.formatNum(minVal);
    }
    yLabel = scale.padLeft(yLabel, yLabelWidth);

    var rowStr = '';
    for (var col2 = 0; col2 < plotWidth; col2++) {
      var ch2 = grid[row2][col2];
      if (ch2 !== ' ') {
        rowStr += ansi.colorize(ch2, color);
      } else {
        rowStr += ' ';
      }
    }

    lines.push(ansi.dim(yLabel) + ' ' + CHARS.axisV + rowStr);
  }

  // X axis
  var xAxisLine = scale.padRight('', yLabelWidth) + ' ' + CHARS.corner + repeat(CHARS.axisH, plotWidth);
  lines.push(ansi.dim(xAxisLine));

  // X axis labels (first, middle, last time label)
  if (times && times.length > 0) {
    var t0 = String(times[0]);
    var tMid = String(times[Math.floor(times.length / 2)]);
    var tEnd = String(times[times.length - 1]);
    var xLabels = scale.padRight('', yLabelWidth + 2) +
      t0 +
      scale.padRight('', Math.floor(plotWidth / 2) - t0.length - Math.floor(tMid.length / 2)) +
      tMid +
      scale.padRight('', plotWidth - Math.floor(plotWidth / 2) - Math.ceil(tMid.length / 2) - tEnd.length) +
      tEnd;
    lines.push(ansi.dim(xLabels));
  }

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
