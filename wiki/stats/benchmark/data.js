window.BENCHMARK_DATA = {
  "lastUpdate": 1695282677153,
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
      },
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
          "id": "89b3e36c8d362f4c841830bc78a39fe17b375027",
          "message": "ci-fix: remove `comment-always` from the `github-action-benchmark` action as it seems to simply duplicate the commit",
          "timestamp": "2023-09-21T07:25:25+02:00",
          "tree_id": "6335e8da9c2187d2a440388c40a1b8b022d8a429",
          "url": "https://github.com/Code-Inspect/flowr/commit/89b3e36c8d362f4c841830bc78a39fe17b375027"
        },
        "date": 1695275825503,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 7643.598797772727,
            "unit": "ms",
            "range": 4672.180717292113,
            "extra": "median: 6283.39ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 1950.7826282272727,
            "unit": "ms",
            "range": 181.21346309768163,
            "extra": "median: 1894.59ms"
          },
          {
            "name": "Normalize R AST",
            "value": 123.43655113636365,
            "unit": "ms",
            "range": 208.31544897169914,
            "extra": "median: 88.70ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 79.20538540909091,
            "unit": "ms",
            "range": 202.11401371887737,
            "extra": "median: 20.75ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.2619200407518827,
            "unit": "ms",
            "range": 1.8408493295930126,
            "extra": "median: 1.94ms"
          },
          {
            "name": "Static slicing",
            "value": 1.66149032726466,
            "unit": "ms",
            "range": 1.749796677838569,
            "extra": "median: 1.30ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.5784065275371335,
            "unit": "ms",
            "range": 0.30873223169526165,
            "extra": "median: 0.52ms"
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
            "email": "florian.sihler@uni-ulm.de",
            "name": "Florian Sihler",
            "username": "EagleoutIce"
          },
          "distinct": true,
          "id": "05f243e420d0a81a6884f1a65a2003b16af6ef7c",
          "message": "ci-fix: remove summary from the social-science graph to avoid double commit",
          "timestamp": "2023-09-21T09:21:19+02:00",
          "tree_id": "d487002e9ec254edd9cc4b596b0dce914d8cfbbd",
          "url": "https://github.com/Code-Inspect/flowr/commit/05f243e420d0a81a6884f1a65a2003b16af6ef7c"
        },
        "date": 1695282675607,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 7701.254288318182,
            "unit": "ms",
            "range": 4843.336805037895,
            "extra": "median: 6334.48ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 1980.7100336363637,
            "unit": "ms",
            "range": 204.27661173616985,
            "extra": "median: 1917.22ms"
          },
          {
            "name": "Normalize R AST",
            "value": 127.08206213636365,
            "unit": "ms",
            "range": 214.68286944769946,
            "extra": "median: 83.04ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 87.14668454545455,
            "unit": "ms",
            "range": 224.1970949583956,
            "extra": "median: 24.26ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.2628835272066796,
            "unit": "ms",
            "range": 1.6405512494599805,
            "extra": "median: 1.97ms"
          },
          {
            "name": "Static slicing",
            "value": 1.6512188329232425,
            "unit": "ms",
            "range": 1.5427139827025,
            "extra": "median: 1.32ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.5902010767995785,
            "unit": "ms",
            "range": 0.29831853381451173,
            "extra": "median: 0.53ms"
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
    ],
    "\"social-science\" Benchmark Suite": [
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
        "date": 1695255188618,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 10924.603258219999,
            "unit": "ms",
            "range": 8162.605362097769,
            "extra": "median: 7633.67ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 2088.2099376,
            "unit": "ms",
            "range": 95.54303478866264,
            "extra": "median: 2068.94ms"
          },
          {
            "name": "Normalize R AST",
            "value": 149.64170438,
            "unit": "ms",
            "range": 98.76134983441513,
            "extra": "median: 111.52ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 226.55017604,
            "unit": "ms",
            "range": 388.9695823485092,
            "extra": "median: 61.86ms"
          },
          {
            "name": "Total per-slice",
            "value": 11.635431291893523,
            "unit": "ms",
            "range": 19.87223607979893,
            "extra": "median: 8.83ms"
          },
          {
            "name": "Static slicing",
            "value": 10.975662455647656,
            "unit": "ms",
            "range": 19.77659599605963,
            "extra": "median: 8.17ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.6472877066595938,
            "unit": "ms",
            "range": 0.4622639696255693,
            "extra": "median: 0.57ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 9,
            "unit": "#",
            "extra": "out of 11160 slices"
          },
          {
            "name": "times hit threshold",
            "value": 967,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8973961730207582,
            "unit": "#",
            "extra": "std: 0.08572960788217562"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8564460343281113,
            "unit": "#",
            "extra": "std: 0.11535970153362557"
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
        "date": 1695255188618,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 10924.603258219999,
            "unit": "ms",
            "range": 8162.605362097769,
            "extra": "median: 7633.67ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 2088.2099376,
            "unit": "ms",
            "range": 95.54303478866264,
            "extra": "median: 2068.94ms"
          },
          {
            "name": "Normalize R AST",
            "value": 149.64170438,
            "unit": "ms",
            "range": 98.76134983441513,
            "extra": "median: 111.52ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 226.55017604,
            "unit": "ms",
            "range": 388.9695823485092,
            "extra": "median: 61.86ms"
          },
          {
            "name": "Total per-slice",
            "value": 11.635431291893523,
            "unit": "ms",
            "range": 19.87223607979893,
            "extra": "median: 8.83ms"
          },
          {
            "name": "Static slicing",
            "value": 10.975662455647656,
            "unit": "ms",
            "range": 19.77659599605963,
            "extra": "median: 8.17ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.6472877066595938,
            "unit": "ms",
            "range": 0.4622639696255693,
            "extra": "median: 0.57ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 9,
            "unit": "#",
            "extra": "out of 11160 slices"
          },
          {
            "name": "times hit threshold",
            "value": 967,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8973961730207582,
            "unit": "#",
            "extra": "std: 0.08572960788217562"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8564460343281113,
            "unit": "#",
            "extra": "std: 0.11535970153362557"
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
            "email": "florian.sihler@uni-ulm.de",
            "name": "Florian Sihler",
            "username": "EagleoutIce"
          },
          "distinct": true,
          "id": "89b3e36c8d362f4c841830bc78a39fe17b375027",
          "message": "ci-fix: remove `comment-always` from the `github-action-benchmark` action as it seems to simply duplicate the commit",
          "timestamp": "2023-09-21T07:25:25+02:00",
          "tree_id": "6335e8da9c2187d2a440388c40a1b8b022d8a429",
          "url": "https://github.com/Code-Inspect/flowr/commit/89b3e36c8d362f4c841830bc78a39fe17b375027"
        },
        "date": 1695275827810,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 12382.0425562,
            "unit": "ms",
            "range": 10937.210881769275,
            "extra": "median: 8074.07ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 2181.0724276799997,
            "unit": "ms",
            "range": 169.2241920134575,
            "extra": "median: 2155.55ms"
          },
          {
            "name": "Normalize R AST",
            "value": 162.70584725999998,
            "unit": "ms",
            "range": 104.48717867354124,
            "extra": "median: 120.60ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 265.36491906,
            "unit": "ms",
            "range": 457.034519299341,
            "extra": "median: 72.62ms"
          },
          {
            "name": "Total per-slice",
            "value": 14.216319260016254,
            "unit": "ms",
            "range": 28.825399895907974,
            "extra": "median: 10.45ms"
          },
          {
            "name": "Static slicing",
            "value": 13.477150563559666,
            "unit": "ms",
            "range": 28.641109807359253,
            "extra": "median: 9.70ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.7238279706295041,
            "unit": "ms",
            "range": 0.6926346534572857,
            "extra": "median: 0.61ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 9,
            "unit": "#",
            "extra": "out of 11160 slices"
          },
          {
            "name": "times hit threshold",
            "value": 967,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8973961730207582,
            "unit": "#",
            "extra": "std: 0.08572960788217562"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8564460343281113,
            "unit": "#",
            "extra": "std: 0.11535970153362557"
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
            "email": "florian.sihler@uni-ulm.de",
            "name": "Florian Sihler",
            "username": "EagleoutIce"
          },
          "distinct": true,
          "id": "89b3e36c8d362f4c841830bc78a39fe17b375027",
          "message": "ci-fix: remove `comment-always` from the `github-action-benchmark` action as it seems to simply duplicate the commit",
          "timestamp": "2023-09-21T07:25:25+02:00",
          "tree_id": "6335e8da9c2187d2a440388c40a1b8b022d8a429",
          "url": "https://github.com/Code-Inspect/flowr/commit/89b3e36c8d362f4c841830bc78a39fe17b375027"
        },
        "date": 1695275827810,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 12382.0425562,
            "unit": "ms",
            "range": 10937.210881769275,
            "extra": "median: 8074.07ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 2181.0724276799997,
            "unit": "ms",
            "range": 169.2241920134575,
            "extra": "median: 2155.55ms"
          },
          {
            "name": "Normalize R AST",
            "value": 162.70584725999998,
            "unit": "ms",
            "range": 104.48717867354124,
            "extra": "median: 120.60ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 265.36491906,
            "unit": "ms",
            "range": 457.034519299341,
            "extra": "median: 72.62ms"
          },
          {
            "name": "Total per-slice",
            "value": 14.216319260016254,
            "unit": "ms",
            "range": 28.825399895907974,
            "extra": "median: 10.45ms"
          },
          {
            "name": "Static slicing",
            "value": 13.477150563559666,
            "unit": "ms",
            "range": 28.641109807359253,
            "extra": "median: 9.70ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.7238279706295041,
            "unit": "ms",
            "range": 0.6926346534572857,
            "extra": "median: 0.61ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 9,
            "unit": "#",
            "extra": "out of 11160 slices"
          },
          {
            "name": "times hit threshold",
            "value": 967,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8973961730207582,
            "unit": "#",
            "extra": "std: 0.08572960788217562"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8564460343281113,
            "unit": "#",
            "extra": "std: 0.11535970153362557"
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
            "email": "florian.sihler@uni-ulm.de",
            "name": "Florian Sihler",
            "username": "EagleoutIce"
          },
          "distinct": true,
          "id": "05f243e420d0a81a6884f1a65a2003b16af6ef7c",
          "message": "ci-fix: remove summary from the social-science graph to avoid double commit",
          "timestamp": "2023-09-21T09:21:19+02:00",
          "tree_id": "d487002e9ec254edd9cc4b596b0dce914d8cfbbd",
          "url": "https://github.com/Code-Inspect/flowr/commit/05f243e420d0a81a6884f1a65a2003b16af6ef7c"
        },
        "date": 1695282677149,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 11012.934499219999,
            "unit": "ms",
            "range": 8356.980219831254,
            "extra": "median: 7434.43ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 2090.76284344,
            "unit": "ms",
            "range": 91.0682061646811,
            "extra": "median: 2043.19ms"
          },
          {
            "name": "Normalize R AST",
            "value": 150.86555514,
            "unit": "ms",
            "range": 100.12550139790709,
            "extra": "median: 103.17ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 228.37952908000003,
            "unit": "ms",
            "range": 396.6866418975469,
            "extra": "median: 63.59ms"
          },
          {
            "name": "Total per-slice",
            "value": 11.926297788198108,
            "unit": "ms",
            "range": 20.457314239322763,
            "extra": "median: 9.05ms"
          },
          {
            "name": "Static slicing",
            "value": 11.225140506427664,
            "unit": "ms",
            "range": 20.372524836317524,
            "extra": "median: 8.35ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.6870837834334134,
            "unit": "ms",
            "range": 0.4210237808698608,
            "extra": "median: 0.62ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 9,
            "unit": "#",
            "extra": "out of 11160 slices"
          },
          {
            "name": "times hit threshold",
            "value": 967,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8973961730207582,
            "unit": "#",
            "extra": "std: 0.08572960788217562"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8564460343281113,
            "unit": "#",
            "extra": "std: 0.11535970153362557"
          }
        ]
      }
    ]
  }
}