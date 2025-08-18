window.BENCHMARK_DATA = {
  "lastUpdate": 1755519421854,
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
          "id": "6861d92ca7eed15ab47a237a9981ada168adf133",
          "message": "[release:patch] 2.4.1 Localized Config, Support for File Modes",
          "timestamp": "2025-08-18T13:40:09+02:00",
          "tree_id": "98a6643a733244c5396f5a3e2a505b2c540e6b26",
          "url": "https://github.com/flowr-analysis/flowr/commit/6861d92ca7eed15ab47a237a9981ada168adf133"
        },
        "date": 1755519421848,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 245.555343,
            "unit": "ms",
            "range": 101.78616599791114,
            "extra": "median: 220.26ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.36984490909091,
            "unit": "ms",
            "range": 31.701526502207095,
            "extra": "median: 8.41ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 74.43365936363637,
            "unit": "ms",
            "range": 174.82560336227573,
            "extra": "median: 35.95ms"
          },
          {
            "name": "Total per-file",
            "value": 801.3089717727272,
            "unit": "ms",
            "range": 1544.1618477532065,
            "extra": "median: 344.01ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.332021909090908,
            "unit": "ms",
            "range": 17.450618654140687,
            "extra": "median: 3.71ms"
          },
          {
            "name": "Static slicing",
            "value": 0.8274729293932889,
            "unit": "ms",
            "range": 0.45594928295493975,
            "extra": "median: 0.74ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2298815339458485,
            "unit": "ms",
            "range": 0.17814710702166056,
            "extra": "median: 0.11ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.0774737237178453,
            "unit": "ms",
            "range": 0.5989162523667947,
            "extra": "median: 1.00ms"
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