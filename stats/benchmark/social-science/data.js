window.BENCHMARK_DATA = {
  "lastUpdate": 1695192558863,
  "repoUrl": "https://github.com/Code-Inspect/flowr",
  "entries": {
    "\"social-science\" Benchmark Suite": [
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
          "id": "432f75ed2c1e3e0864dd263206cdaa13ec19c735",
          "message": "Merge branch '323-add-performance-test-graphs-links-to-wiki'",
          "timestamp": "2023-09-20T08:05:35+02:00",
          "tree_id": "878ada5bed4a3fd6a6c601ec4925eb47165ae456",
          "url": "https://github.com/Code-Inspect/flowr/commit/432f75ed2c1e3e0864dd263206cdaa13ec19c735"
        },
        "date": 1695192558858,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total",
            "value": 12476.79996844,
            "unit": "ms",
            "range": 9469.394379910362,
            "extra": "median: 8516.37ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 2350.9760601999997,
            "unit": "ms",
            "range": 112.41707838335942,
            "extra": "median: 2318.78ms"
          },
          {
            "name": "Normalize R AST",
            "value": 177.03667131999998,
            "unit": "ms",
            "range": 116.07461709126586,
            "extra": "median: 129.96ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 266.03693524,
            "unit": "ms",
            "range": 457.5111503602542,
            "extra": "median: 74.08ms"
          },
          {
            "name": "Total",
            "value": 13.544869881247552,
            "unit": "ms",
            "range": 23.036454686661965,
            "extra": "median: 10.26ms"
          },
          {
            "name": "Static slicing",
            "value": 12.820640692817955,
            "unit": "ms",
            "range": 22.93681366716631,
            "extra": "median: 9.54ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.7094097343878699,
            "unit": "ms",
            "range": 0.41651317097176177,
            "extra": "median: 0.62ms"
          }
        ]
      }
    ]
  }
}