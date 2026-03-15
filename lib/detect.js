'use strict';

// JSON shape auto-detection
// Determines the best chart type for a given dataset

/**
 * Check if a value is a finite number.
 * @param {*} v
 * @returns {boolean}
 */
function isNum(v) {
  return typeof v === 'number' && isFinite(v);
}

/**
 * Check if an object looks like a time-value pair.
 * Accepts { t, v }, { time, value }, { timestamp, value }, { x, y }
 * @param {object} obj
 * @returns {boolean}
 */
function isTimeSeries(obj) {
  if (!obj || typeof obj !== 'object') return false;
  var hasTime = ('t' in obj) || ('time' in obj) || ('timestamp' in obj) || ('x' in obj);
  var hasValue = ('v' in obj) || ('value' in obj) || ('y' in obj);
  return hasTime && hasValue;
}

/**
 * Extract the time value from a time-series object.
 * @param {object} obj
 * @returns {number|string}
 */
function extractTime(obj) {
  if ('t' in obj) return obj.t;
  if ('time' in obj) return obj.time;
  if ('timestamp' in obj) return obj.timestamp;
  if ('x' in obj) return obj.x;
  return null;
}

/**
 * Extract the numeric value from a time-series object.
 * @param {object} obj
 * @returns {number}
 */
function extractValue(obj) {
  if ('v' in obj) return obj.v;
  if ('value' in obj) return obj.value;
  if ('y' in obj) return obj.y;
  return null;
}

/**
 * Find the first numeric field in an object.
 * @param {object} obj
 * @returns {string|null}
 */
function findNumericField(obj) {
  if (!obj || typeof obj !== 'object') return null;
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    if (isNum(obj[keys[i]])) return keys[i];
  }
  return null;
}

/**
 * Find the first string field in an object that is not the excluded field.
 * @param {object} obj
 * @param {string} excludeField — the numeric value field to skip
 * @returns {string|null}
 */
function findStringField(obj, excludeField) {
  if (!obj || typeof obj !== 'object') return null;
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i] === excludeField) continue;
    if (typeof obj[keys[i]] === 'string') return keys[i];
  }
  return null;
}

/**
 * Detect the shape of the input data and return a descriptor.
 *
 * Returns an object:
 * {
 *   type: 'bar' | 'line' | 'spark' | 'hist',
 *   values: number[],          // extracted numeric values
 *   labels: string[] | null,   // labels for bar chart
 *   times:  any[]   | null,    // time axis for line chart
 *   field:  string  | null     // which field was used
 * }
 *
 * @param {*} data          — parsed JSON input
 * @param {object} opts     — CLI options (type, field)
 * @returns {object}
 */
function detect(data, opts) {
  opts = opts || {};

  // ── Flat array of numbers ────────────────────────────────────────────────
  if (Array.isArray(data) && data.length > 0 && isNum(data[0])) {
    var allNums = data.every(function(v) { return isNum(v); });
    if (allNums) {
      var defaultType = opts.type || (data.length > 60 ? 'hist' : 'spark');
      return {
        type: defaultType,
        values: data,
        labels: null,
        times: null,
        field: null
      };
    }
  }

  // ── Array of objects ─────────────────────────────────────────────────────
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {

    // Time-series: { t, v } or { time, value } etc.
    if (!opts.field && isTimeSeries(data[0])) {
      var tsValues = [];
      var tsTimes = [];
      var valid = true;
      for (var i = 0; i < data.length; i++) {
        var tv = extractValue(data[i]);
        if (!isNum(tv)) { valid = false; break; }
        tsValues.push(tv);
        tsTimes.push(extractTime(data[i]));
      }
      if (valid) {
        return {
          type: opts.type || 'line',
          values: tsValues,
          labels: null,
          times: tsTimes,
          field: null
        };
      }
    }

    // Array of objects with a specified or auto-detected numeric field
    var field = opts.field || findNumericField(data[0]);
    if (field) {
      // Find the first string field in the first object that isn't the value field
      var labelField = findStringField(data[0], field);
      var objValues = [];
      var objLabels = [];
      for (var j = 0; j < data.length; j++) {
        var v = data[j][field];
        if (!isNum(v)) continue;
        objValues.push(v);
        // Use the detected string label field, or fall back to index
        var label = (labelField && data[j][labelField] != null) ? data[j][labelField] : String(j);
        objLabels.push(String(label));
      }
      return {
        type: opts.type || 'bar',
        values: objValues,
        labels: objLabels,
        times: null,
        field: field
      };
    }
  }

  // ── Single number ────────────────────────────────────────────────────────
  if (isNum(data)) {
    return {
      type: opts.type || 'spark',
      values: [data],
      labels: null,
      times: null,
      field: null
    };
  }

  // ── Fallback: try to extract any numbers we can find ────────────────────
  return {
    type: opts.type || 'spark',
    values: [],
    labels: null,
    times: null,
    field: null
  };
}

module.exports = {
  detect: detect,
  isNum: isNum,
  isTimeSeries: isTimeSeries,
  extractTime: extractTime,
  extractValue: extractValue,
  findNumericField: findNumericField,
  findStringField: findStringField
};
