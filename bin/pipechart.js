#!/usr/bin/env node
'use strict';

/**
 * pipechart — zero-dependency CLI tool that pipes JSON to real-time ASCII charts
 *
 * Usage:
 *   echo '[1,2,3,4,5]' | pipechart
 *   cat data.json | pipechart --type bar --color green
 *   tail -f metrics.jsonl | pipechart --live --type line
 */

var readline = require('readline');
var detect   = require('../lib/detect');
var ansi     = require('../lib/ansi');
var bar      = require('../lib/render/bar');
var line     = require('../lib/render/line');
var spark    = require('../lib/render/spark');
var hist     = require('../lib/render/hist');

// ── Parse CLI arguments ──────────────────────────────────────────────────────

var args = process.argv.slice(2);

/**
 * Parse a simple --flag [value] argument list.
 * Flags without a following value are treated as booleans.
 * @param {string[]} argv
 * @returns {object}
 */
function parseArgs(argv) {
  var opts = {};
  var i = 0;
  while (i < argv.length) {
    var arg = argv[i];
    if (arg.slice(0, 2) === '--') {
      var key = arg.slice(2);
      var next = argv[i + 1];
      if (next !== undefined && next.slice(0, 2) !== '--') {
        opts[key] = next;
        i += 2;
      } else {
        opts[key] = true;
        i += 1;
      }
    } else if (arg.slice(0, 1) === '-' && arg.length === 2) {
      var shortKey = arg.slice(1);
      var shortNext = argv[i + 1];
      if (shortNext !== undefined && shortNext.slice(0, 1) !== '-') {
        opts[shortKey] = shortNext;
        i += 2;
      } else {
        opts[shortKey] = true;
        i += 1;
      }
    } else {
      i += 1;
    }
  }
  return opts;
}

var opts = parseArgs(args);

// Show help
if (opts.help || opts.h) {
  printHelp();
  process.exit(0);
}

// Show version
if (opts.version || opts.v) {
  try {
    var pkg = require('../package.json');
    process.stdout.write(pkg.version + '\n');
  } catch (e) {
    process.stdout.write('1.0.0\n');
  }
  process.exit(0);
}

var LIVE_MODE  = !!(opts.live || opts.l);
var FORCE_TYPE = opts.type || opts.t || null;
var COLOR      = opts.color || opts.c || 'cyan';
var WIDTH      = parseInt(opts.width || opts.w, 10) || process.stdout.columns || 80;
var TITLE      = opts.title || null;
var FIELD      = opts.field || opts.f || null;
var SPARK_MODE = !!(opts.spark || opts.s);
var HEIGHT     = parseInt(opts.height, 10) || 12;

if (SPARK_MODE && !FORCE_TYPE) FORCE_TYPE = 'spark';

// ── Rendering ────────────────────────────────────────────────────────────────

/**
 * Dispatch to the correct renderer based on detected/forced type.
 * @param {object} descriptor — from detect.detect()
 * @returns {string}
 */
function renderChart(descriptor) {
  var type = descriptor.type;
  var renderOpts = {
    values: descriptor.values,
    labels: descriptor.labels,
    times:  descriptor.times,
    width:  WIDTH,
    color:  COLOR,
    title:  TITLE,
    height: HEIGHT
  };

  switch (type) {
    case 'bar':   return bar.render(renderOpts);
    case 'line':  return line.render(renderOpts);
    case 'spark': return spark.render(renderOpts);
    case 'hist':  return hist.render(renderOpts);
    default:      return spark.render(renderOpts);
  }
}

// ── Live streaming mode ──────────────────────────────────────────────────────

if (LIVE_MODE) {
  runLiveMode();
} else {
  runBatchMode();
}

// ── Batch mode: read all stdin, parse, render once ───────────────────────────

function runBatchMode() {
  var chunks = [];

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', function(chunk) {
    chunks.push(chunk);
  });

  process.stdin.on('end', function() {
    var raw = chunks.join('');
    raw = raw.trim();

    if (!raw) {
      process.stderr.write('pipechart: no input received. Pipe JSON data to stdin.\n');
      printHelp();
      process.exit(1);
    }

    // Try to parse as a single JSON value first
    var data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      // Try newline-delimited JSON (NDJSON) — collect all valid lines
      var lines = raw.split('\n');
      var collected = [];
      for (var i = 0; i < lines.length; i++) {
        var l = lines[i].trim();
        if (!l) continue;
        try {
          var parsed = JSON.parse(l);
          collected.push(parsed);
        } catch (e2) {
          // Skip malformed lines gracefully
        }
      }
      if (collected.length === 0) {
        process.stderr.write('pipechart: could not parse input as JSON.\n');
        process.exit(1);
      }
      data = collected;
    }

    var descriptor = detect.detect(data, { type: FORCE_TYPE, field: FIELD });

    if (descriptor.values.length === 0) {
      process.stderr.write('pipechart: no numeric values found in input.\n');
      process.exit(1);
    }

    var output = renderChart(descriptor);
    process.stdout.write(output + '\n');
  });

  process.stdin.on('error', function(err) {
    process.stderr.write('pipechart: stdin error: ' + err.message + '\n');
    process.exit(1);
  });
}

// ── Live mode: read NDJSON lines, re-render in place ─────────────────────────

function runLiveMode() {
  var buffer = [];
  var lastLineCount = 0;
  var firstRender = true;

  // Hide cursor for cleaner live output
  process.stdout.write(ansi.hideCursor());

  // Restore cursor on exit
  function cleanup() {
    process.stdout.write(ansi.showCursor());
    process.stdout.write('\n');
  }
  process.on('exit', cleanup);
  process.on('SIGINT', function() {
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', function() {
    cleanup();
    process.exit(0);
  });

  var rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity
  });

  rl.on('line', function(rawLine) {
    rawLine = rawLine.trim();
    if (!rawLine) return;

    var parsed;
    try {
      parsed = JSON.parse(rawLine);
    } catch (e) {
      // Skip malformed lines — don't crash
      return;
    }

    // Accumulate data points
    // If the line is an array, replace the buffer (useful for watch-style streams)
    // If it's a scalar/object, push it
    if (Array.isArray(parsed)) {
      buffer = parsed;
    } else {
      buffer.push(parsed);
    }

    // Keep buffer bounded to avoid unbounded memory growth
    var maxBuffer = WIDTH * 4;
    if (buffer.length > maxBuffer) {
      buffer = buffer.slice(buffer.length - maxBuffer);
    }

    var descriptor = detect.detect(buffer, { type: FORCE_TYPE, field: FIELD });
    if (descriptor.values.length === 0) return;

    var output = renderChart(descriptor);
    var outputLines = output.split('\n');
    var lineCount = outputLines.length;

    if (!firstRender) {
      // Move cursor up to overwrite previous render
      process.stdout.write(ansi.cursorUp(lastLineCount));
    }

    // Clear and rewrite each line
    for (var i = 0; i < lineCount; i++) {
      process.stdout.write(ansi.eraseLine() + outputLines[i] + '\n');
    }

    // If new render is shorter, clear leftover lines
    if (!firstRender && lineCount < lastLineCount) {
      for (var j = lineCount; j < lastLineCount; j++) {
        process.stdout.write(ansi.eraseLine() + '\n');
      }
      process.stdout.write(ansi.cursorUp(lastLineCount - lineCount));
    }

    lastLineCount = lineCount;
    firstRender = false;
  });

  rl.on('close', function() {
    // stdin closed — stay alive showing last render
  });

  rl.on('error', function(err) {
    process.stderr.write('pipechart: readline error: ' + err.message + '\n');
  });
}

// ── Help text ─────────────────────────────────────────────────────────────────

function printHelp() {
  var help = [
    '',
    ansi.bold(ansi.colorize('pipechart', 'cyan')) + ansi.dim(' — zero-dependency JSON → ASCII charts'),
    '',
    ansi.bold('USAGE'),
    '  echo \'[1,2,3,4,5]\' | pipechart [options]',
    '  cat data.json     | pipechart --type bar --color green',
    '  tail -f log.jsonl | pipechart --live --type line',
    '',
    ansi.bold('OPTIONS'),
    '  --type,   -t  <bar|line|spark|hist>   Force chart type',
    '  --color,  -c  <color>                 Chart color (red|green|blue|yellow|cyan|white)',
    '  --width,  -w  <n>                     Override terminal width',
    '  --height      <n>                     Chart height in rows (default: 12)',
    '  --title       <text>                  Print a title above the chart',
    '  --field,  -f  <key>                   Which field to use from objects',
    '  --live,   -l                          Streaming / live mode (NDJSON)',
    '  --spark,  -s                          Force single-line sparkline output',
    '  --help,   -h                          Show this help',
    '  --version,-v                          Show version',
    '',
    ansi.bold('EXAMPLES'),
    '  echo \'[3,1,4,1,5,9,2,6]\' | pipechart',
    '  echo \'[3,1,4,1,5,9,2,6]\' | pipechart --type hist --color yellow',
    '  echo \'[{"name":"A","val":10},{"name":"B","val":20}]\' | pipechart --type bar --field val',
    '  echo \'[{"t":1,"v":3},{"t":2,"v":7}]\' | pipechart --type line',
    '  tail -f metrics.jsonl | pipechart --live --type spark',
    ''
  ].join('\n');
  process.stdout.write(help);
}
