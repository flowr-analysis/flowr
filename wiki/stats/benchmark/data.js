window.BENCHMARK_DATA = {
  "lastUpdate": 1695255188383,
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
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "20612c4734312e5bbd8963132eb9d25802d2f8a8",
          "message": "Fine tune benchmark plots with new colors, labels, and more (#338)\n\n* ci: cycle colors\r\n\r\n* ci: show commit message name start in benchmarks as well\r\n\r\n* ci-fix: npm script `performance-test` should be able to read arguments :D\r\n\r\n* ci, typo: fix wrong name for uploading of benchmark results\r\n\r\n* ci-fix: add `--` to separatae arguments in `qa.yaml`\r\n\r\n* ci: reset current benchmark data",
          "timestamp": "2023-09-21T01:44:43+02:00",
          "tree_id": "9f4b37285d7d1eb59c97e553f8fd0766c9bb1b06",
          "url": "https://github.com/Code-Inspect/flowr/commit/20612c4734312e5bbd8963132eb9d25802d2f8a8"
        },
        "date": 1695255188267,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 8259.250394318182,
            "unit": "ms",
            "range": 4968.250512363158,
            "extra": "median: 6847.55ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 2117.869953409091,
            "unit": "ms",
            "range": 206.30641574206575,
            "extra": "median: 2061.32ms"
          },
          {
            "name": "Normalize R AST",
            "value": 130.60619313636363,
            "unit": "ms",
            "range": 224.83856303552116,
            "extra": "median: 83.93ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 89.47369154545454,
            "unit": "ms",
            "range": 233.7696346539724,
            "extra": "median: 24.78ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.3299490711368147,
            "unit": "ms",
            "range": 1.788027577151099,
            "extra": "median: 2.02ms"
          },
          {
            "name": "Static slicing",
            "value": 1.6894677939608982,
            "unit": "ms",
            "range": 1.6793862825524892,
            "extra": "median: 1.33ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.6158474940073386,
            "unit": "ms",
            "range": 0.3802273110956727,
            "extra": "median: 0.55ms"
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
            "value": 0.7329390759026896,
            "unit": "#",
            "extra": "std: 0.1494698363920617"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.720988345209971,
            "unit": "#",
            "extra": "std: 0.13987413604166843"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "florian.sihler@uni-ulm.de",
            "name": "Florian Sihler",
            "username": "EagleoutIce"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "20612c4734312e5bbd8963132eb9d25802d2f8a8",
          "message": "Fine tune benchmark plots with new colors, labels, and more (#338)\n\n* ci: cycle colors\r\n\r\n* ci: show commit message name start in benchmarks as well\r\n\r\n* ci-fix: npm script `performance-test` should be able to read arguments :D\r\n\r\n* ci, typo: fix wrong name for uploading of benchmark results\r\n\r\n* ci-fix: add `--` to separatae arguments in `qa.yaml`\r\n\r\n* ci: reset current benchmark data",
          "timestamp": "2023-09-21T01:44:43+02:00",
          "tree_id": "9f4b37285d7d1eb59c97e553f8fd0766c9bb1b06",
          "url": "https://github.com/Code-Inspect/flowr/commit/20612c4734312e5bbd8963132eb9d25802d2f8a8"
        },
        "date": 1695255188267,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 8259.250394318182,
            "unit": "ms",
            "range": 4968.250512363158,
            "extra": "median: 6847.55ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 2117.869953409091,
            "unit": "ms",
            "range": 206.30641574206575,
            "extra": "median: 2061.32ms"
          },
          {
            "name": "Normalize R AST",
            "value": 130.60619313636363,
            "unit": "ms",
            "range": 224.83856303552116,
            "extra": "median: 83.93ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 89.47369154545454,
            "unit": "ms",
            "range": 233.7696346539724,
            "extra": "median: 24.78ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.3299490711368147,
            "unit": "ms",
            "range": 1.788027577151099,
            "extra": "median: 2.02ms"
          },
          {
            "name": "Static slicing",
            "value": 1.6894677939608982,
            "unit": "ms",
            "range": 1.6793862825524892,
            "extra": "median: 1.33ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.6158474940073386,
            "unit": "ms",
            "range": 0.3802273110956727,
            "extra": "median: 0.55ms"
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
            "value": 0.7329390759026896,
            "unit": "#",
            "extra": "std: 0.1494698363920617"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.720988345209971,
            "unit": "#",
            "extra": "std: 0.13987413604166843"
          }
        ]
      }
    ]
  }
}