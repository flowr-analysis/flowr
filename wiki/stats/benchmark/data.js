window.BENCHMARK_DATA = {
  "lastUpdate": 1755680552250,
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
          "id": "242f9494a180fd2720caa0b621124fd62c198c3d",
          "message": "[release:patch] 2.4.3 Linting Rule: Useless Loop",
          "timestamp": "2025-08-20T10:35:54+02:00",
          "tree_id": "d338e8d592713002ea619a18cf40d4629d04c249",
          "url": "https://github.com/flowr-analysis/flowr/commit/242f9494a180fd2720caa0b621124fd62c198c3d"
        },
        "date": 1755680551440,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 251.65881722727272,
            "unit": "ms",
            "range": 110.27742743435931,
            "extra": "median: 223.05ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.410486363636362,
            "unit": "ms",
            "range": 31.787039929734448,
            "extra": "median: 8.15ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 73.21607131818182,
            "unit": "ms",
            "range": 168.87646072912534,
            "extra": "median: 34.27ms"
          },
          {
            "name": "Total per-file",
            "value": 816.8521356818181,
            "unit": "ms",
            "range": 1582.252064283022,
            "extra": "median: 351.19ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.26263190909091,
            "unit": "ms",
            "range": 18.243377650151164,
            "extra": "median: 3.33ms"
          },
          {
            "name": "Static slicing",
            "value": 0.8324468376677581,
            "unit": "ms",
            "range": 0.4606965160224342,
            "extra": "median: 0.75ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2301987262715928,
            "unit": "ms",
            "range": 0.18160619668400593,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.0833885613290593,
            "unit": "ms",
            "range": 0.6069179931897416,
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
          "id": "242f9494a180fd2720caa0b621124fd62c198c3d",
          "message": "[release:patch] 2.4.3 Linting Rule: Useless Loop",
          "timestamp": "2025-08-20T10:35:54+02:00",
          "tree_id": "d338e8d592713002ea619a18cf40d4629d04c249",
          "url": "https://github.com/flowr-analysis/flowr/commit/242f9494a180fd2720caa0b621124fd62c198c3d"
        },
        "date": 1755680552247,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 248.17092014,
            "unit": "ms",
            "range": 44.94094970677657,
            "extra": "median: 229.15ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.66104096,
            "unit": "ms",
            "range": 14.208753064740465,
            "extra": "median: 10.51ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 94.15012264,
            "unit": "ms",
            "range": 88.1951452613464,
            "extra": "median: 48.19ms"
          },
          {
            "name": "Total per-file",
            "value": 2266.57562476,
            "unit": "ms",
            "range": 3670.4196501353517,
            "extra": "median: 520.05ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.14085444,
            "unit": "ms",
            "range": 9.133720541100073,
            "extra": "median: 7.13ms"
          },
          {
            "name": "Static slicing",
            "value": 4.727785622782091,
            "unit": "ms",
            "range": 13.763051831466983,
            "extra": "median: 0.90ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.25966323892863513,
            "unit": "ms",
            "range": 0.15575510507707485,
            "extra": "median: 0.15ms"
          },
          {
            "name": "Total per-slice",
            "value": 4.994989948478297,
            "unit": "ms",
            "range": 13.795669916034557,
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
            "value": 108.779140625,
            "unit": "KiB",
            "range": 119.2118522615022,
            "extra": "median: 54.17"
          }
        ]
      }
    ]
  }
}