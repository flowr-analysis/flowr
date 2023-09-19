window.BENCHMARK_DATA = {
  "lastUpdate": 1695162118440,
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
          "id": "a0f052e85cb815b1fd243ab7a01af66aac3e53b2",
          "message": "ci-fix: use single quotes in `run.yaml`",
          "timestamp": "2023-09-19T23:41:56+02:00",
          "tree_id": "1ef3da41d74a2ca4221d4414db4a949d5fe7e8ea",
          "url": "https://github.com/Code-Inspect/flowr/commit/a0f052e85cb815b1fd243ab7a01af66aac3e53b2"
        },
        "date": 1695162118435,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total",
            "value": 10987.2198301,
            "unit": "ms",
            "range": 8301.385996697158,
            "extra": "median: 7461.94ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 2091.59874494,
            "unit": "ms",
            "range": 90.46287655010781,
            "extra": "median: 2057.16ms"
          },
          {
            "name": "Normalize R AST",
            "value": 150.38117431999999,
            "unit": "ms",
            "range": 101.99622646780831,
            "extra": "median: 104.31ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 228.4156648,
            "unit": "ms",
            "range": 393.9030026526239,
            "extra": "median: 61.45ms"
          },
          {
            "name": "Total",
            "value": 11.854464971804362,
            "unit": "ms",
            "range": 20.273045430012047,
            "extra": "median: 9.01ms"
          },
          {
            "name": "Static slicing",
            "value": 11.135948693925833,
            "unit": "ms",
            "range": 20.1684597476426,
            "extra": "median: 8.30ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.7060102975638356,
            "unit": "ms",
            "range": 0.4383458763402564,
            "extra": "median: 0.65ms"
          }
        ]
      }
    ]
  }
}