window.BENCHMARK_DATA = {
  "lastUpdate": 1695162118095,
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
          "id": "a0f052e85cb815b1fd243ab7a01af66aac3e53b2",
          "message": "ci-fix: use single quotes in `run.yaml`",
          "timestamp": "2023-09-19T23:41:56+02:00",
          "tree_id": "1ef3da41d74a2ca4221d4414db4a949d5fe7e8ea",
          "url": "https://github.com/Code-Inspect/flowr/commit/a0f052e85cb815b1fd243ab7a01af66aac3e53b2"
        },
        "date": 1695162118089,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total",
            "value": 8606.325498227272,
            "unit": "ms",
            "range": 5538.9269283881595,
            "extra": "median: 6996.49ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 2185.7191407727273,
            "unit": "ms",
            "range": 207.5345558603458,
            "extra": "median: 2122.26ms"
          },
          {
            "name": "Normalize R AST",
            "value": 134.86450027272727,
            "unit": "ms",
            "range": 231.325839175534,
            "extra": "median: 94.22ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 90.73783745454546,
            "unit": "ms",
            "range": 234.14602903471263,
            "extra": "median: 21.97ms"
          },
          {
            "name": "Total",
            "value": 2.4552734313598927,
            "unit": "ms",
            "range": 1.8387787850645576,
            "extra": "median: 2.12ms"
          },
          {
            "name": "Static slicing",
            "value": 1.763690301006577,
            "unit": "ms",
            "range": 1.7150638692364821,
            "extra": "median: 1.39ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.6682289080893169,
            "unit": "ms",
            "range": 0.38852453172298224,
            "extra": "median: 0.60ms"
          }
        ]
      }
    ]
  }
}