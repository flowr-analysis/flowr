window.BENCHMARK_DATA = {
  "lastUpdate": 1755635627822,
  "repoUrl": "https://github.com/flowr-analysis/flowr",
  "entries": {
    "\"artificial\" Benchmark Suite": [
      {
        "commit": {
          "author": {
            "email": "florian.sihler@uni-ulm.de",
            "name": "EagleoutIce",
            "username": "EagleoutIce"
          },
          "committer": {
            "email": "florian.sihler@uni-ulm.de",
            "name": "EagleoutIce",
            "username": "EagleoutIce"
          },
          "distinct": true,
          "id": "78d418ba611903be1dc7ca71a48dbc655265606b",
          "message": "[release:patch] 2.4.2 Backward Compatibility",
          "timestamp": "2025-08-19T22:09:34+02:00",
          "tree_id": "dc49d2cc29eef59f25a0b84c47ab18dbd6424fe1",
          "url": "https://github.com/flowr-analysis/flowr/commit/78d418ba611903be1dc7ca71a48dbc655265606b"
        },
        "date": 1755635627818,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 268.50567368181817,
            "unit": "ms",
            "range": 117.03330631486453,
            "extra": "median: 237.29ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.140772954545454,
            "unit": "ms",
            "range": 35.47556728896352,
            "extra": "median: 8.69ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 81.37103077272727,
            "unit": "ms",
            "range": 190.11351298762443,
            "extra": "median: 36.90ms"
          },
          {
            "name": "Total per-file",
            "value": 899.2883360454545,
            "unit": "ms",
            "range": 1763.069338995556,
            "extra": "median: 361.40ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 9.564266772727274,
            "unit": "ms",
            "range": 20.580998849531596,
            "extra": "median: 3.87ms"
          },
          {
            "name": "Static slicing",
            "value": 0.8974751337703356,
            "unit": "ms",
            "range": 0.5058455904994237,
            "extra": "median: 0.76ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2579666531189168,
            "unit": "ms",
            "range": 0.21633760933155413,
            "extra": "median: 0.13ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.1766034753959718,
            "unit": "ms",
            "range": 0.6686134064854765,
            "extra": "median: 1.09ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 0,
            "unit": "#",
            "extra": "out of 7728 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.7786152155810172,
            "unit": "#",
            "extra": "std: 0.1290160802322939"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7558573293027475,
            "unit": "#",
            "extra": "std: 0.13293775369417085"
          },
          {
            "name": "memory (df-graph)",
            "value": 117.43639026988636,
            "unit": "KiB",
            "range": 300.1098805940028,
            "extra": "median: 34.18"
          }
        ]
      }
    ]
  }
}