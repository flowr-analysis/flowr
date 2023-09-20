window.BENCHMARK_DATA = {
  "lastUpdate": 1695192558624,
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
          "id": "432f75ed2c1e3e0864dd263206cdaa13ec19c735",
          "message": "Merge branch '323-add-performance-test-graphs-links-to-wiki'",
          "timestamp": "2023-09-20T08:05:35+02:00",
          "tree_id": "878ada5bed4a3fd6a6c601ec4925eb47165ae456",
          "url": "https://github.com/Code-Inspect/flowr/commit/432f75ed2c1e3e0864dd263206cdaa13ec19c735"
        },
        "date": 1695192558619,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total",
            "value": 9740.826079045453,
            "unit": "ms",
            "range": 6379.2671276971305,
            "extra": "median: 7851.59ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 2476.227175909091,
            "unit": "ms",
            "range": 245.22005270198002,
            "extra": "median: 2407.20ms"
          },
          {
            "name": "Normalize R AST",
            "value": 159.5154825,
            "unit": "ms",
            "range": 273.4450994022523,
            "extra": "median: 110.80ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 106.05176872727273,
            "unit": "ms",
            "range": 274.43582033094197,
            "extra": "median: 28.36ms"
          },
          {
            "name": "Total",
            "value": 2.9075675902772016,
            "unit": "ms",
            "range": 2.2481856251156023,
            "extra": "median: 2.47ms"
          },
          {
            "name": "Static slicing",
            "value": 2.0941779089547006,
            "unit": "ms",
            "range": 2.126403874107742,
            "extra": "median: 1.59ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.7861346036761229,
            "unit": "ms",
            "range": 0.4383635898533413,
            "extra": "median: 0.69ms"
          }
        ]
      }
    ]
  }
}