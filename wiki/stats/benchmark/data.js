window.BENCHMARK_DATA = {
  "lastUpdate": 1755635629941,
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
    ],
    "\"social-science\" Benchmark Suite": [
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
        "date": 1755635628601,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 247.51687363999997,
            "unit": "ms",
            "range": 45.8180531173997,
            "extra": "median: 225.64ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.3220113,
            "unit": "ms",
            "range": 13.962072240284348,
            "extra": "median: 10.34ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 92.93348498,
            "unit": "ms",
            "range": 86.35825351955896,
            "extra": "median: 45.67ms"
          },
          {
            "name": "Total per-file",
            "value": 2254.18911494,
            "unit": "ms",
            "range": 3651.7374375826316,
            "extra": "median: 524.52ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 9.91366574,
            "unit": "ms",
            "range": 8.729540246495763,
            "extra": "median: 6.79ms"
          },
          {
            "name": "Static slicing",
            "value": 4.71526179595657,
            "unit": "ms",
            "range": 13.830293445856125,
            "extra": "median: 0.93ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.25705859754825566,
            "unit": "ms",
            "range": 0.1526516341937826,
            "extra": "median: 0.18ms"
          },
          {
            "name": "Total per-slice",
            "value": 4.97975007304028,
            "unit": "ms",
            "range": 13.861671623291565,
            "extra": "median: 1.34ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 0,
            "unit": "#",
            "extra": "out of 12710 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8768012916318573,
            "unit": "#",
            "extra": "std: 0.10660041417571828"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8218378334783742,
            "unit": "#",
            "extra": "std: 0.15263676219268849"
          },
          {
            "name": "memory (df-graph)",
            "value": 108.77921875,
            "unit": "KiB",
            "range": 119.21180415572344,
            "extra": "median: 54.17"
          }
        ]
      }
    ],
    "\"artificial\" Benchmark Suite (tree-sitter)": [
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
        "date": 1755635629189,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 13.234871318181819,
            "unit": "ms",
            "range": 15.906212537551879,
            "extra": "median: 9.50ms"
          },
          {
            "name": "Normalize R AST",
            "value": 14.655486772727274,
            "unit": "ms",
            "range": 18.02811385865022,
            "extra": "median: 11.23ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 74.78826454545455,
            "unit": "ms",
            "range": 163.49539317366907,
            "extra": "median: 37.71ms"
          },
          {
            "name": "Total per-file",
            "value": 591.3358250909091,
            "unit": "ms",
            "range": 1464.0145902447775,
            "extra": "median: 163.49ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.652507318181819,
            "unit": "ms",
            "range": 18.45889485214842,
            "extra": "median: 3.35ms"
          },
          {
            "name": "Static slicing",
            "value": 0.8418940762889352,
            "unit": "ms",
            "range": 0.4526808559517294,
            "extra": "median: 0.76ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.23678856710116278,
            "unit": "ms",
            "range": 0.19671530996603812,
            "extra": "median: 0.11ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.0937339188067203,
            "unit": "ms",
            "range": 0.6110670062922082,
            "extra": "median: 0.90ms"
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
    ],
    "\"social-science\" Benchmark Suite (tree-sitter)": [
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
        "date": 1755635629938,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 18.87205386,
            "unit": "ms",
            "range": 11.581854027985871,
            "extra": "median: 13.50ms"
          },
          {
            "name": "Normalize R AST",
            "value": 20.47603518,
            "unit": "ms",
            "range": 11.653849607974601,
            "extra": "median: 17.33ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 93.42642322,
            "unit": "ms",
            "range": 86.41767470706063,
            "extra": "median: 48.51ms"
          },
          {
            "name": "Total per-file",
            "value": 2021.54095356,
            "unit": "ms",
            "range": 3592.1334034012093,
            "extra": "median: 346.62ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.080163220000001,
            "unit": "ms",
            "range": 8.812972502827723,
            "extra": "median: 7.49ms"
          },
          {
            "name": "Static slicing",
            "value": 4.654700345746523,
            "unit": "ms",
            "range": 13.5614399589836,
            "extra": "median: 0.89ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.24906836896688875,
            "unit": "ms",
            "range": 0.14635063024821027,
            "extra": "median: 0.15ms"
          },
          {
            "name": "Total per-slice",
            "value": 4.911276458324224,
            "unit": "ms",
            "range": 13.592321792324645,
            "extra": "median: 1.18ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 0,
            "unit": "#",
            "extra": "out of 12710 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8760636188102862,
            "unit": "#",
            "extra": "std: 0.1071843874046504"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8218888563337355,
            "unit": "#",
            "extra": "std: 0.152841619600717"
          },
          {
            "name": "memory (df-graph)",
            "value": 108.782265625,
            "unit": "KiB",
            "range": 119.20992997206397,
            "extra": "median: 54.17"
          }
        ]
      }
    ]
  }
}