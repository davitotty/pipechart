# pipechart

> Zero-dependency CLI tool that pipes JSON to real-time ASCII charts in the terminal.

[![npm version](https://img.shields.io/npm/v/pipechart.svg)](https://www.npmjs.com/package/pipechart)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js >= 12](https://img.shields.io/badge/node-%3E%3D12-brightgreen.svg)](https://nodejs.org)

---

## Install

```bash
npm install -g pipechart
```

Or run without installing:

```bash
npx pipechart --help
```

---

## Usage

```
echo '<json>' | pipechart [options]
cat data.json  | pipechart [options]
tail -f stream | pipechart --live [options]
```

### Options

| Flag | Short | Description |
|------|-------|-------------|
| `--type <bar\|line\|spark\|hist>` | `-t` | Force chart type (auto-detected if omitted) |
| `--color <name>` | `-c` | Chart color: `red`, `green`, `blue`, `yellow`, `cyan`, `white` |
| `--width <n>` | `-w` | Override terminal width (default: `process.stdout.columns`) |
| `--height <n>` | | Chart height in rows for line/hist (default: `12`) |
| `--title <text>` | | Print a title above the chart |
| `--field <key>` | `-f` | Which numeric field to use from objects |
| `--live` | `-l` | Streaming / live mode — reads NDJSON continuously |
| `--spark` | `-s` | Force single-line sparkline output |
| `--help` | `-h` | Show help |
| `--version` | `-v` | Show version |

---

## Examples

### 1. Sparkline — flat array of numbers

```bash
echo '[3,1,4,1,5,9,2,6,5,3,5]' | pipechart
```

```
▃▁▄▁▅█▂▅▅▃▅  1 – 9
```

### 2. Bar chart — array of objects

```bash
echo '[
  {"name":"Alpha","value":42},
  {"name":"Beta","value":87},
  {"name":"Gamma","value":23},
  {"name":"Delta","value":65}
]' | pipechart --type bar --color green
```

```
Alpha │ ████████████████████████████                            42
Beta  │ ███████████████████████████████████████████████████████ 87
Gamma │ ████████████████                                        23
Delta │ ████████████████████████████████████████████            65
      └────────────────────────────────────────────────────────────
       0                                                        87
```

### 3. Line chart — time-series `{t, v}` objects

```bash
echo '[
  {"t":1,"v":10},{"t":2,"v":25},{"t":3,"v":18},
  {"t":4,"v":40},{"t":5,"v":35},{"t":6,"v":55},
  {"t":7,"v":48},{"t":8,"v":70}
]' | pipechart --type line --color cyan --title "Server Latency (ms)"
```

```
Server Latency (ms)

 70 │                                                   //   •
    │                                                  //
    │                                      //         //
    │                                    /// •\\\    //
    │                                  ///      \\\\\•
    │                      //         //
 40 │                    /// •────────•/
    │      //          ///
    │    /// •\\\     //
    │  ///      \\\\\•/
    │ //
 10 │•/
    └─────────────────────────────────────────────────────────────
     1                               5                           8
```

### 4. Histogram — distribution of values

```bash
echo '[2,5,8,3,7,1,9,4,6,2,5,8,3,7,1,9,4,6,5,5,5,6,7,8,3,2,1,4,9,6]' \
  | pipechart --type hist --color yellow --title "Value Distribution"
```

```
Value Distribution

 9 │                  ███████████
   │                  ███████████
   │                  ███████████
   │                  ███████████
   │███████████        ███████████           ███████████
   │███████████        ███████████           ███████████
 5 │███████████        ███████████           ███████████
   │███████████        ███████████           ███████████
   │███████████████████████████████████████████████████████████████
   │███████████████████████████████████████████████████████████████
   │███████████████████████████████████████████████████████████████
 0 │███████████████████████████████████████████████████████████████
   └──────────────────────────────────────────────────────────────
    1                                5                           9
    n=30  bins=6
```

### 5. Live streaming mode

```bash
# Pipe a stream of NDJSON numbers — re-renders in place
tail -f /var/log/metrics.jsonl | pipechart --live --type line --color green

# Simulate a live stream with a shell loop
while true; do
  echo $RANDOM
  sleep 0.5
done | pipechart --live --type spark
```

### 6. Use a specific field from objects

```bash
echo '[
  {"host":"web-1","cpu":72.3},
  {"host":"web-2","cpu":45.1},
  {"host":"db-1","cpu":88.9}
]' | pipechart --type bar --field cpu --color red
```

```
web-1 │ ████████████████████████████████████████████████████    72.3
web-2 │ ████████████████████████████████                        45.1
db-1  │ ████████████████████████████████████████████████████████ 88.9
      └────────────────────────────────────────────────────────────
       0                                                        88.9
```

### 7. Pipe from `jq`

```bash
curl -s https://api.example.com/metrics \
  | jq '[.data[] | .response_time]' \
  | pipechart --type hist --color cyan --title "Response Times"
```

---

## JSON Shape Auto-Detection

pipechart automatically picks the best chart type based on your data:

| Input shape | Default chart |
|-------------|---------------|
| `[1, 2, 3, ...]` — flat numbers, ≤ 60 items | **sparkline** |
| `[1, 2, 3, ...]` — flat numbers, > 60 items | **histogram** |
| `[{"t":…,"v":…}, …]` — time-value pairs | **line chart** |
| `[{"name":…,"value":…}, …]` — labeled objects | **bar chart** |

Override with `--type bar|line|spark|hist`.

---

## Why pipechart?

- **Zero dependencies** — pure Node.js, nothing to audit, nothing to break.
- **Works over SSH** — renders in any terminal that supports ANSI codes (virtually all of them).
- **Works on legacy hardware** — Node.js 12+ is all you need; no native addons, no compilation.
- **Composable** — plays nicely with `jq`, `curl`, `tail -f`, `watch`, and any Unix pipeline.
- **Instant** — no startup overhead, no network calls, no config files.
- **Readable source** — ~600 lines of plain ES5-compatible JavaScript; easy to audit and fork.

---

## Package Structure

```
pipechart/
├── bin/
│   └── pipechart.js      # CLI entrypoint (shebang)
├── lib/
│   ├── detect.js         # JSON shape detection
│   ├── render/
│   │   ├── bar.js        # Horizontal bar chart
│   │   ├── line.js       # Line chart with ASCII connectors
│   │   ├── spark.js      # Single-line sparkline
│   │   └── hist.js       # Vertical histogram
│   ├── ansi.js           # Color + cursor ANSI helpers
│   └── scale.js          # Normalization + scaling math
├── package.json
└── README.md
```

---

## License

Apache 2.0
