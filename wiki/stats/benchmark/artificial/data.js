window.BENCHMARK_DATA = {
  "lastUpdate": 1695188119964,
  "repoUrl": "https://github.com/Code-Inspect/flowr",
  "entries": {
    "\"artificial\" Benchmark Suite": [
      {
        "commit": {
          "author": {
            "email": "florian.sihler@uni-ulm.de",
            "name": "Florian Sihler",
            "username": "EagleoutIce"
          },
          "committer": {
            "email": "florian.sihler@uni-ulm.de",
            "name": "Florian Sihler",
            "username": "EagleoutIce"
          },
          "distinct": true,
          "id": "a6aa0b7bd3529f24b8515566702b1842c9e506ea",
          "message": "ci: hopefully last time resetting benchmark information",
          "timestamp": "2023-09-20T06:53:54+02:00",
          "tree_id": "1ef3da41d74a2ca4221d4414db4a949d5fe7e8ea",
          "url": "https://github.com/Code-Inspect/flowr/commit/a6aa0b7bd3529f24b8515566702b1842c9e506ea"
        },
        "date": 1695188119956,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total",
            "value": 8374.02154,
            "unit": "ms",
            "range": 5413.395270858299,
            "extra": "median: 6804.42ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 2127.2909089545456,
            "unit": "ms",
            "range": 196.38741859754703,
            "extra": "median: 2070.11ms"
          },
          {
            "name": "Normalize R AST",
            "value": 139.59942127272728,
            "unit": "ms",
            "range": 238.0061707414291,
            "extra": "median: 88.54ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 95.29421572727273,
            "unit": "ms",
            "range": 248.25907197692072,
            "extra": "median: 24.39ms"
          },
          {
            "name": "Total",
            "value": 2.546293691108005,
            "unit": "ms",
            "range": 1.9300781313318667,
            "extra": "median: 2.18ms"
          },
          {
            "name": "Static slicing",
            "value": 1.866034386323446,
            "unit": "ms",
            "range": 1.8226205239062696,
            "extra": "median: 1.45ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.6519941906737653,
            "unit": "ms",
            "range": 0.3589634067651476,
            "extra": "median: 0.58ms"
          }
        ]
      }
    ]
  }
}