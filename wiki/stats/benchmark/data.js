window.BENCHMARK_DATA = {
  "lastUpdate": 1740298491392,
  "repoUrl": "https://github.com/flowr-analysis/flowr",
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
          "message": "Fine tune benchmark plots with new colors, labels, and more (#338)\n\n* ci: cycle colors\r\n\r\n* ci: show commit message name start in benchmarks as well\r\n\r\n* ci-fix: npm script `performance-test` should be able to read arguments :D\r\n\r\n* ci, typo: fix wrong name for uploading of benchmark results\r\n\r\n* ci-fix: add `--` to separatae arguments in `qa.yaml`\r\n\r\n* ci: reset current benchmark data (Release v1.1.4)",
          "timestamp": "2023-09-21T01:44:43+02:00",
          "tree_id": "9f4b37285d7d1eb59c97e553f8fd0766c9bb1b06",
          "url": "https://github.com/flowr-analysis/flowr/commit/20612c4734312e5bbd8963132eb9d25802d2f8a8"
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
          "message": "Fine tune benchmark plots with new colors, labels, and more (#338)\n\n* ci: cycle colors\r\n\r\n* ci: show commit message name start in benchmarks as well\r\n\r\n* ci-fix: npm script `performance-test` should be able to read arguments :D\r\n\r\n* ci, typo: fix wrong name for uploading of benchmark results\r\n\r\n* ci-fix: add `--` to separatae arguments in `qa.yaml`\r\n\r\n* ci: reset current benchmark data (Release v1.1.4)",
          "timestamp": "2023-09-21T01:44:43+02:00",
          "tree_id": "9f4b37285d7d1eb59c97e553f8fd0766c9bb1b06",
          "url": "https://github.com/flowr-analysis/flowr/commit/20612c4734312e5bbd8963132eb9d25802d2f8a8"
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
          "message": "ci-fix: remove `comment-always` from the `github-action-benchmark` action as it seems to simply duplicate the commit (Release v1.1.4)",
          "timestamp": "2023-09-21T07:25:25+02:00",
          "tree_id": "6335e8da9c2187d2a440388c40a1b8b022d8a429",
          "url": "https://github.com/flowr-analysis/flowr/commit/89b3e36c8d362f4c841830bc78a39fe17b375027"
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
          "message": "ci-fix: remove summary from the social-science graph to avoid double commit (Release v1.1.4)",
          "timestamp": "2023-09-21T09:21:19+02:00",
          "tree_id": "d487002e9ec254edd9cc4b596b0dce914d8cfbbd",
          "url": "https://github.com/flowr-analysis/flowr/commit/05f243e420d0a81a6884f1a65a2003b16af6ef7c"
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
          "id": "127bc834a15a16930038f25587b54cb1422c9df4",
          "message": "Merge benchmark commits into one (#340)\n\nci, refactor: merge benchmark commits into one (Release v1.1.4)",
          "timestamp": "2023-09-21T12:24:40+02:00",
          "tree_id": "180c8b31c7e6d78169d1bd2523ee0a42008906da",
          "url": "https://github.com/flowr-analysis/flowr/commit/127bc834a15a16930038f25587b54cb1422c9df4"
        },
        "date": 1695293611928,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 7936.898981,
            "unit": "ms",
            "range": 4882.770877200135,
            "extra": "median: 6535.60ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 2033.6461868636363,
            "unit": "ms",
            "range": 196.32852061783728,
            "extra": "median: 1970.69ms"
          },
          {
            "name": "Normalize R AST",
            "value": 128.13887368181818,
            "unit": "ms",
            "range": 217.49327814433346,
            "extra": "median: 82.63ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 88.38316054545454,
            "unit": "ms",
            "range": 228.24481123443803,
            "extra": "median: 25.40ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.3599499137395474,
            "unit": "ms",
            "range": 1.9323431536368794,
            "extra": "median: 2.01ms"
          },
          {
            "name": "Static slicing",
            "value": 1.7389910657246048,
            "unit": "ms",
            "range": 1.8413471961461345,
            "extra": "median: 1.35ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.5987547678283729,
            "unit": "ms",
            "range": 0.3109401041906286,
            "extra": "median: 0.54ms"
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
          "id": "0fda4c49cd9e2b2191a1b15c137cd78cb08f52aa",
          "message": "[release:patch] Update xmldom Dependency and Benchmarking Support (Release v1.1.5)",
          "timestamp": "2023-09-24T14:13:29+02:00",
          "tree_id": "4ecc81b2e690ba8ac4f1912756542fa125261a27",
          "url": "https://github.com/flowr-analysis/flowr/commit/0fda4c49cd9e2b2191a1b15c137cd78cb08f52aa"
        },
        "date": 1695559897555,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 7649.1946755,
            "unit": "ms",
            "range": 4652.495107303273,
            "extra": "median: 6285.91ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 1963.4770063636363,
            "unit": "ms",
            "range": 186.957771516333,
            "extra": "median: 1887.73ms"
          },
          {
            "name": "Normalize R AST",
            "value": 124.184728,
            "unit": "ms",
            "range": 212.20536424279288,
            "extra": "median: 80.36ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 78.81278186363636,
            "unit": "ms",
            "range": 201.33742715454252,
            "extra": "median: 22.32ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.26305677172671,
            "unit": "ms",
            "range": 1.7384018182555752,
            "extra": "median: 1.96ms"
          },
          {
            "name": "Static slicing",
            "value": 1.6681850654249957,
            "unit": "ms",
            "range": 1.6413282759277712,
            "extra": "median: 1.31ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.5734224558631944,
            "unit": "ms",
            "range": 0.30043278522070765,
            "extra": "median: 0.51ms"
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
          "id": "77159de13994c94d1a86ebf0db70c0a01067d372",
          "message": "[release:patch] CFG, N-Quads export (Release v1.1.6)",
          "timestamp": "2023-10-10T11:16:02+02:00",
          "tree_id": "4760f5664753b99fdb69e3d5675ba0cef3cf1140",
          "url": "https://github.com/flowr-analysis/flowr/commit/77159de13994c94d1a86ebf0db70c0a01067d372"
        },
        "date": 1696931418749,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 4960.836150363636,
            "unit": "ms",
            "range": 6482.0988719721245,
            "extra": "median: 3052.97ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 112.15266804545455,
            "unit": "ms",
            "range": 221.01947121880636,
            "extra": "median: 55.12ms"
          },
          {
            "name": "Normalize R AST",
            "value": 158.9432460909091,
            "unit": "ms",
            "range": 277.454183675945,
            "extra": "median: 109.80ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 107.0013843181818,
            "unit": "ms",
            "range": 282.12362511959634,
            "extra": "median: 28.77ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.7611302354682308,
            "unit": "ms",
            "range": 2.115801393637501,
            "extra": "median: 2.42ms"
          },
          {
            "name": "Static slicing",
            "value": 1.9756198511738667,
            "unit": "ms",
            "range": 1.9789741654051405,
            "extra": "median: 1.59ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.7625824303663716,
            "unit": "ms",
            "range": 0.42406440624519987,
            "extra": "median: 0.67ms"
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
          "id": "a13ba7d57c8f8ca264630109c56e1906e21c2066",
          "message": "[release:minor] Feature Extraction and CFG Export (Release v1.2.0)",
          "timestamp": "2023-10-15T08:56:06+02:00",
          "tree_id": "89e99a6cb66c08dc2c808dd798df9e888c88931c",
          "url": "https://github.com/flowr-analysis/flowr/commit/a13ba7d57c8f8ca264630109c56e1906e21c2066"
        },
        "date": 1697355093950,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 5136.292062545455,
            "unit": "ms",
            "range": 6659.167699804035,
            "extra": "median: 3182.83ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 124.09828127272726,
            "unit": "ms",
            "range": 243.70782214857047,
            "extra": "median: 67.59ms"
          },
          {
            "name": "Normalize R AST",
            "value": 160.2237915909091,
            "unit": "ms",
            "range": 278.6105978575149,
            "extra": "median: 101.78ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 108.43437586363636,
            "unit": "ms",
            "range": 284.0057832037362,
            "extra": "median: 27.79ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.8182434778758196,
            "unit": "ms",
            "range": 2.051447335915778,
            "extra": "median: 2.46ms"
          },
          {
            "name": "Static slicing",
            "value": 1.9806726576978653,
            "unit": "ms",
            "range": 1.8433455256061702,
            "extra": "median: 1.62ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.8126920856475652,
            "unit": "ms",
            "range": 0.6147197597624667,
            "extra": "median: 0.70ms"
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
          "id": "1e9911dfb7b57bba9af2fbc21bb25b7b8a769b63",
          "message": "[release:patch] More Robust Server (Release v1.2.1)",
          "timestamp": "2023-10-18T14:31:58+02:00",
          "tree_id": "c4d6e9b11aa00ac6785f02ca584364bfdf5b52ab",
          "url": "https://github.com/flowr-analysis/flowr/commit/1e9911dfb7b57bba9af2fbc21bb25b7b8a769b63"
        },
        "date": 1697634673188,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 5224.464815863636,
            "unit": "ms",
            "range": 7092.487714397081,
            "extra": "median: 3051.57ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 116.95115622727273,
            "unit": "ms",
            "range": 243.53206402067616,
            "extra": "median: 51.76ms"
          },
          {
            "name": "Normalize R AST",
            "value": 160.7872227272727,
            "unit": "ms",
            "range": 271.38935329251126,
            "extra": "median: 107.26ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 110.0293535909091,
            "unit": "ms",
            "range": 285.52436127668494,
            "extra": "median: 28.34ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.9764448142291404,
            "unit": "ms",
            "range": 2.325561478272478,
            "extra": "median: 2.58ms"
          },
          {
            "name": "Static slicing",
            "value": 2.1260829411880016,
            "unit": "ms",
            "range": 2.185475853997074,
            "extra": "median: 1.68ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.8235981809008505,
            "unit": "ms",
            "range": 0.4789098297658495,
            "extra": "median: 0.74ms"
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
          "id": "ef6b5bc18f7145ba61f75b43ed973d5f961ce670",
          "message": "[release:patch] Include character counts in meta statistics (Release v1.3.1)",
          "timestamp": "2023-11-02T13:39:16+01:00",
          "tree_id": "48744a8fc8d41b2b0740b8b7b4ccf7b4ca9c388c",
          "url": "https://github.com/flowr-analysis/flowr/commit/ef6b5bc18f7145ba61f75b43ed973d5f961ce670"
        },
        "date": 1698930897537,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 3238.0027303636366,
            "unit": "ms",
            "range": 3851.6861391590023,
            "extra": "median: 2102.96ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 67.72076345454545,
            "unit": "ms",
            "range": 135.07026993115434,
            "extra": "median: 33.10ms"
          },
          {
            "name": "Normalize R AST",
            "value": 99.12328140909091,
            "unit": "ms",
            "range": 157.33731741020588,
            "extra": "median: 67.98ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 65.55846731818183,
            "unit": "ms",
            "range": 169.27520217727005,
            "extra": "median: 17.37ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.8734386729647032,
            "unit": "ms",
            "range": 1.3424235755626424,
            "extra": "median: 1.64ms"
          },
          {
            "name": "Static slicing",
            "value": 1.3930558979239522,
            "unit": "ms",
            "range": 1.2493040262670454,
            "extra": "median: 1.13ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.46342775577268414,
            "unit": "ms",
            "range": 0.23858650666759953,
            "extra": "median: 0.42ms"
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
          "id": "266b087710648b96b1779436aee32a0c47ac80cd",
          "message": "[release:patch] Robustness against encoding errors (Release v1.3.2)",
          "timestamp": "2023-11-03T20:54:13+01:00",
          "tree_id": "c245f343a8ef43765a4f36f2aad48763dc77d6b3",
          "url": "https://github.com/flowr-analysis/flowr/commit/266b087710648b96b1779436aee32a0c47ac80cd"
        },
        "date": 1699043092723,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 3179.838332181818,
            "unit": "ms",
            "range": 3672.286438980555,
            "extra": "median: 2088.33ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 67.57201345454546,
            "unit": "ms",
            "range": 135.00742353958452,
            "extra": "median: 32.55ms"
          },
          {
            "name": "Normalize R AST",
            "value": 92.62022559090909,
            "unit": "ms",
            "range": 152.11002159362633,
            "extra": "median: 64.46ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 65.08133054545455,
            "unit": "ms",
            "range": 166.00596407178642,
            "extra": "median: 19.44ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.8579071164832888,
            "unit": "ms",
            "range": 1.2960021301432842,
            "extra": "median: 1.63ms"
          },
          {
            "name": "Static slicing",
            "value": 1.3913231260599883,
            "unit": "ms",
            "range": 1.2140789790282374,
            "extra": "median: 1.13ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.44898673756392055,
            "unit": "ms",
            "range": 0.21332097434246836,
            "extra": "median: 0.41ms"
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
          "id": "243959c2f01ddf928c85ee4905105307971ad19b",
          "message": "[release:patch] Robustify Quad Export Against Cyclic Structures (Release v1.3.3)",
          "timestamp": "2023-11-10T18:59:51+01:00",
          "tree_id": "8e5af22f7b39483e95e62308330a5e9e002ba57a",
          "url": "https://github.com/flowr-analysis/flowr/commit/243959c2f01ddf928c85ee4905105307971ad19b"
        },
        "date": 1699640652120,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 3190.570812409091,
            "unit": "ms",
            "range": 3747.790963743062,
            "extra": "median: 2088.22ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 68.74045054545455,
            "unit": "ms",
            "range": 132.55959690808635,
            "extra": "median: 33.81ms"
          },
          {
            "name": "Normalize R AST",
            "value": 96.19992009090909,
            "unit": "ms",
            "range": 156.15063334620123,
            "extra": "median: 67.94ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 66.09041786363636,
            "unit": "ms",
            "range": 169.92667998599904,
            "extra": "median: 17.49ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.8411702253695927,
            "unit": "ms",
            "range": 1.267065280512554,
            "extra": "median: 1.64ms"
          },
          {
            "name": "Static slicing",
            "value": 1.3684034386686694,
            "unit": "ms",
            "range": 1.1799623517395228,
            "extra": "median: 1.13ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.4553098527401606,
            "unit": "ms",
            "range": 0.2299566392692304,
            "extra": "median: 0.41ms"
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
          "id": "c209d78300f23960363beb046efd2b07a0a5531d",
          "message": "[release:patch] Allow Strings as Names for Function Call Arguments (Release v1.3.4)",
          "timestamp": "2023-11-22T13:22:53+01:00",
          "tree_id": "a052c400e622d7062e4ff675a07f088883eaccee",
          "url": "https://github.com/flowr-analysis/flowr/commit/c209d78300f23960363beb046efd2b07a0a5531d"
        },
        "date": 1700657318626,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 3354.2152301363635,
            "unit": "ms",
            "range": 3860.1297956846133,
            "extra": "median: 2189.09ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 71.48860922727273,
            "unit": "ms",
            "range": 136.54310977165716,
            "extra": "median: 35.79ms"
          },
          {
            "name": "Normalize R AST",
            "value": 95.79139172727274,
            "unit": "ms",
            "range": 152.52195436786488,
            "extra": "median: 64.57ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 66.23299468181818,
            "unit": "ms",
            "range": 170.60548403093352,
            "extra": "median: 19.23ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.8581676256634037,
            "unit": "ms",
            "range": 1.2492897864296644,
            "extra": "median: 1.64ms"
          },
          {
            "name": "Static slicing",
            "value": 1.372047543536089,
            "unit": "ms",
            "range": 1.1480006540491348,
            "extra": "median: 1.13ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.46882655148163743,
            "unit": "ms",
            "range": 0.2603715463019149,
            "extra": "median: 0.41ms"
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
            "name": "EagleoutIce",
            "username": "EagleoutIce"
          },
          "committer": {
            "email": "florian.sihler@uni-ulm.de",
            "name": "EagleoutIce",
            "username": "EagleoutIce"
          },
          "distinct": true,
          "id": "7cef37c8fb8e93c1e22647fa0efed2c1ddcf21a9",
          "message": "[release:patch] Quads With Repeated Edge Types (Release v1.3.5)",
          "timestamp": "2023-12-08T15:24:04+01:00",
          "tree_id": "e7a3ab3994be6ef3dfd8e8b13a4957bbfe0242b5",
          "url": "https://github.com/flowr-analysis/flowr/commit/7cef37c8fb8e93c1e22647fa0efed2c1ddcf21a9"
        },
        "date": 1702046952548,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 3914.897785181818,
            "unit": "ms",
            "range": 5561.047944408685,
            "extra": "median: 2246.12ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 79.23541877272727,
            "unit": "ms",
            "range": 156.85010382325788,
            "extra": "median: 38.27ms"
          },
          {
            "name": "Normalize R AST",
            "value": 99.36930672727273,
            "unit": "ms",
            "range": 160.20652435903554,
            "extra": "median: 68.56ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 69.87000995454545,
            "unit": "ms",
            "range": 181.50457342713372,
            "extra": "median: 17.65ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.0929919935168906,
            "unit": "ms",
            "range": 1.3580169345320046,
            "extra": "median: 1.90ms"
          },
          {
            "name": "Static slicing",
            "value": 1.418837559285864,
            "unit": "ms",
            "range": 1.2078497990535682,
            "extra": "median: 1.16ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.654821339733212,
            "unit": "ms",
            "range": 0.40929627079838377,
            "extra": "median: 0.64ms"
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
          "id": "5d9e4d36fce917d72f382c8cc441ce576baf18a6",
          "message": "[release:patch] Using Next in RDF Quads (Release v1.3.6)",
          "timestamp": "2023-12-13T13:59:30+01:00",
          "tree_id": "c9aa3c29b811c7d73cc287b2a5f9e89f06951cd9",
          "url": "https://github.com/flowr-analysis/flowr/commit/5d9e4d36fce917d72f382c8cc441ce576baf18a6"
        },
        "date": 1702473792545,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 3277.835952,
            "unit": "ms",
            "range": 3650.0375295266645,
            "extra": "median: 2193.31ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 68.49444895454545,
            "unit": "ms",
            "range": 132.01593297444168,
            "extra": "median: 35.37ms"
          },
          {
            "name": "Normalize R AST",
            "value": 95.374054,
            "unit": "ms",
            "range": 152.9260288537938,
            "extra": "median: 68.68ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 65.96892504545454,
            "unit": "ms",
            "range": 170.63963367521657,
            "extra": "median: 17.31ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.849766443616379,
            "unit": "ms",
            "range": 1.2946515240101566,
            "extra": "median: 1.65ms"
          },
          {
            "name": "Static slicing",
            "value": 1.3827639315335498,
            "unit": "ms",
            "range": 1.209711488412065,
            "extra": "median: 1.14ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.44947423548591825,
            "unit": "ms",
            "range": 0.2084265687331651,
            "extra": "median: 0.41ms"
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
            "name": "EagleoutIce",
            "username": "EagleoutIce"
          },
          "committer": {
            "email": "florian.sihler@uni-ulm.de",
            "name": "EagleoutIce",
            "username": "EagleoutIce"
          },
          "distinct": true,
          "id": "c148955f1c3a57e08545baa6a94b58c9124b4613",
          "message": "[release:patch] Demo File for Presentations (Release v1.3.7)",
          "timestamp": "2024-01-04T09:31:14+01:00",
          "tree_id": "952d243e0eef028eb0fc52f25ccac831253d9f17",
          "url": "https://github.com/flowr-analysis/flowr/commit/c148955f1c3a57e08545baa6a94b58c9124b4613"
        },
        "date": 1704358481170,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 3538.5974304545457,
            "unit": "ms",
            "range": 4581.372160627646,
            "extra": "median: 2184.55ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 77.82700472727274,
            "unit": "ms",
            "range": 149.40207734835903,
            "extra": "median: 39.09ms"
          },
          {
            "name": "Normalize R AST",
            "value": 98.53393954545454,
            "unit": "ms",
            "range": 158.74254778960403,
            "extra": "median: 72.29ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 67.4761410909091,
            "unit": "ms",
            "range": 174.11690488775295,
            "extra": "median: 17.18ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.002858174188422,
            "unit": "ms",
            "range": 1.4075505647469286,
            "extra": "median: 1.73ms"
          },
          {
            "name": "Static slicing",
            "value": 1.4466165340773975,
            "unit": "ms",
            "range": 1.2822227155581158,
            "extra": "median: 1.14ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.535649854171506,
            "unit": "ms",
            "range": 0.31471901439260436,
            "extra": "median: 0.48ms"
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
            "name": "EagleoutIce",
            "username": "EagleoutIce"
          },
          "committer": {
            "email": "florian.sihler@uni-ulm.de",
            "name": "EagleoutIce",
            "username": "EagleoutIce"
          },
          "distinct": true,
          "id": "4b9d841139c45af7a2e50de57bf454b4d98dcd34",
          "message": "[release:patch] Publish NPM to own namespace (Release v1.3.12)",
          "timestamp": "2024-01-04T16:44:38+01:00",
          "tree_id": "3af219dac7ab8e8aeff5ce9aaec1f1b45f9d32bb",
          "url": "https://github.com/flowr-analysis/flowr/commit/4b9d841139c45af7a2e50de57bf454b4d98dcd34"
        },
        "date": 1704384536144,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 3749.7315675454547,
            "unit": "ms",
            "range": 4970.104297624152,
            "extra": "median: 2282.58ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 77.88396722727273,
            "unit": "ms",
            "range": 149.02292336751995,
            "extra": "median: 39.78ms"
          },
          {
            "name": "Normalize R AST",
            "value": 97.90443504545455,
            "unit": "ms",
            "range": 157.1612919108991,
            "extra": "median: 69.84ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 68.1648949090909,
            "unit": "ms",
            "range": 175.39243709432557,
            "extra": "median: 17.83ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.0183527784925235,
            "unit": "ms",
            "range": 1.3819952574905736,
            "extra": "median: 1.80ms"
          },
          {
            "name": "Static slicing",
            "value": 1.4458811451862046,
            "unit": "ms",
            "range": 1.241781458745927,
            "extra": "median: 1.18ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.5536129872832918,
            "unit": "ms",
            "range": 0.3606792109242279,
            "extra": "median: 0.50ms"
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
            "name": "EagleoutIce",
            "username": "EagleoutIce"
          },
          "committer": {
            "email": "florian.sihler@uni-ulm.de",
            "name": "EagleoutIce",
            "username": "EagleoutIce"
          },
          "distinct": true,
          "id": "2e17bd230fd0762e103508098f5fb1fa3d565d46",
          "message": "[release:patch] Update NPM Package Dependencies (Release v1.3.13)",
          "timestamp": "2024-01-13T14:09:36+01:00",
          "tree_id": "81a22dece7b6bc2454b2f78cc3dd742fa9b690fa",
          "url": "https://github.com/flowr-analysis/flowr/commit/2e17bd230fd0762e103508098f5fb1fa3d565d46"
        },
        "date": 1705152647474,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 3174.886931590909,
            "unit": "ms",
            "range": 4133.82989376954,
            "extra": "median: 1922.24ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 73.759667,
            "unit": "ms",
            "range": 159.73313158842387,
            "extra": "median: 30.94ms"
          },
          {
            "name": "Normalize R AST",
            "value": 97.24624554545454,
            "unit": "ms",
            "range": 157.4974378518514,
            "extra": "median: 73.06ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 66.34398486363636,
            "unit": "ms",
            "range": 170.59395619673015,
            "extra": "median: 17.03ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.9209680083249427,
            "unit": "ms",
            "range": 1.3225392322151348,
            "extra": "median: 1.69ms"
          },
          {
            "name": "Static slicing",
            "value": 1.4057747356611319,
            "unit": "ms",
            "range": 1.2018529713715655,
            "extra": "median: 1.15ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.49751458799773607,
            "unit": "ms",
            "range": 0.2877398660633804,
            "extra": "median: 0.44ms"
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
          "id": "816c844036b361042c26d2af07b4d092e66b46fb",
          "message": "[release:patch] Drop readlines/promises Dependency (Release v1.3.14)",
          "timestamp": "2024-01-15T23:29:47+01:00",
          "tree_id": "2383d566e88ea2e0dbe60dd73f7d7b92b3093407",
          "url": "https://github.com/flowr-analysis/flowr/commit/816c844036b361042c26d2af07b4d092e66b46fb"
        },
        "date": 1705359154980,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 2967.1418025454545,
            "unit": "ms",
            "range": 3618.949366683997,
            "extra": "median: 1927.64ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 69.06575931818182,
            "unit": "ms",
            "range": 145.0290465282857,
            "extra": "median: 30.99ms"
          },
          {
            "name": "Normalize R AST",
            "value": 95.2519069090909,
            "unit": "ms",
            "range": 153.1479590068876,
            "extra": "median: 67.97ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 64.6035405,
            "unit": "ms",
            "range": 167.23909055295272,
            "extra": "median: 16.84ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.8720710902829922,
            "unit": "ms",
            "range": 1.3532400635998951,
            "extra": "median: 1.63ms"
          },
          {
            "name": "Static slicing",
            "value": 1.4122959211773074,
            "unit": "ms",
            "range": 1.281855192577784,
            "extra": "median: 1.13ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.442741380921788,
            "unit": "ms",
            "range": 0.19367073211054742,
            "extra": "median: 0.40ms"
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
            "name": "EagleoutIce",
            "username": "EagleoutIce"
          },
          "committer": {
            "email": "florian.sihler@uni-ulm.de",
            "name": "EagleoutIce",
            "username": "EagleoutIce"
          },
          "distinct": true,
          "id": "d69018e52ccd36d2a4c6749a259bc7347a5c8a5d",
          "message": "[release:patch] npm for WebSocket Server (Release v1.4.1)",
          "timestamp": "2024-01-31T15:39:17+01:00",
          "tree_id": "e208ae0ae2bb451ea46ccc05df594033cd4f95bc",
          "url": "https://github.com/flowr-analysis/flowr/commit/d69018e52ccd36d2a4c6749a259bc7347a5c8a5d"
        },
        "date": 1706713170342,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 1511.494083,
            "unit": "ms",
            "range": 3708.3225553463017,
            "extra": "median: 450.67ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 64.46248863636363,
            "unit": "ms",
            "range": 125.66414120100016,
            "extra": "median: 34.34ms"
          },
          {
            "name": "Normalize R AST",
            "value": 94.99519236363636,
            "unit": "ms",
            "range": 152.9376581920758,
            "extra": "median: 66.70ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 65.2556795909091,
            "unit": "ms",
            "range": 167.18441854609554,
            "extra": "median: 17.49ms"
          },
          {
            "name": "Run abstract interpretation",
            "value": 0.03478995454545455,
            "unit": "ms",
            "range": 0.01086253065474186,
            "extra": "median: 0.03ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.8724288794806876,
            "unit": "ms",
            "range": 1.3873679811565907,
            "extra": "median: 1.62ms"
          },
          {
            "name": "Static slicing",
            "value": 1.4074784311593942,
            "unit": "ms",
            "range": 1.3118563756339259,
            "extra": "median: 1.13ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.4524929302663976,
            "unit": "ms",
            "range": 0.22636683004337768,
            "extra": "median: 0.41ms"
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
          "id": "78da42c867266e8832933ba9bcd2e1bc3951d5f9",
          "message": "[release:patch] Dropping xmlparsedata, Benchmark Re-Runs, and Repl Fixes (Release v1.4.2)",
          "timestamp": "2024-03-17T22:21:47+01:00",
          "tree_id": "3f3bb3107a47ce4ffee7f569cb902e0c641dbe60",
          "url": "https://github.com/flowr-analysis/flowr/commit/78da42c867266e8832933ba9bcd2e1bc3951d5f9"
        },
        "date": 1710711451253,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 328.7877424545454,
            "unit": "ms",
            "range": 0,
            "extra": "median: 328.79ms"
          },
          {
            "name": "Normalize R AST",
            "value": 34.82602604545455,
            "unit": "ms",
            "range": 0,
            "extra": "median: 34.83ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 72.140976,
            "unit": "ms",
            "range": 0,
            "extra": "median: 72.14ms"
          },
          {
            "name": "Total per-file",
            "value": 1761.6346178636363,
            "unit": "ms",
            "range": 0,
            "extra": "median: 1761.63ms"
          },
          {
            "name": "Static slicing",
            "value": 1.4568277437917196,
            "unit": "ms",
            "range": 1.2805075743767247,
            "extra": "median: 1.13ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.5308818860863364,
            "unit": "ms",
            "range": 0.3540321314721033,
            "extra": "median: 0.46ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.0031037886510674,
            "unit": "ms",
            "range": 1.3820450513044555,
            "extra": "median: 1.70ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 0,
            "unit": "#",
            "extra": "out of 4158 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.7329390759026897,
            "unit": "#",
            "extra": "std: 0.1494698363920617"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7209834969577295,
            "unit": "#",
            "extra": "std: 0.13987450018862865"
          }
        ]
      },
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
          "id": "1e5ddeb7a95d9191d401a3c3bacce978d16b0075",
          "message": "[release:patch] Completed Declutter of flowr (Release v1.5.2)",
          "timestamp": "2024-04-05T17:19:28+02:00",
          "tree_id": "b3d73e6ef022921d7e9367296525a7389e976aa4",
          "url": "https://github.com/flowr-analysis/flowr/commit/1e5ddeb7a95d9191d401a3c3bacce978d16b0075"
        },
        "date": 1712331738240,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 305.50355490909095,
            "unit": "ms",
            "range": 0,
            "extra": "median: 305.50ms"
          },
          {
            "name": "Normalize R AST",
            "value": 33.04192136363636,
            "unit": "ms",
            "range": 0,
            "extra": "median: 33.04ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 66.58585145454545,
            "unit": "ms",
            "range": 0,
            "extra": "median: 66.59ms"
          },
          {
            "name": "Total per-file",
            "value": 1512.547620909091,
            "unit": "ms",
            "range": 0,
            "extra": "median: 1512.55ms"
          },
          {
            "name": "Static slicing",
            "value": 1.3817132831241319,
            "unit": "ms",
            "range": 1.27303105869458,
            "extra": "median: 1.06ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.45135141022522257,
            "unit": "ms",
            "range": 0.25927254974160097,
            "extra": "median: 0.40ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.8475447304133532,
            "unit": "ms",
            "range": 1.3326721674469058,
            "extra": "median: 1.56ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 0,
            "unit": "#",
            "extra": "out of 4158 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.7329390759026897,
            "unit": "#",
            "extra": "std: 0.1494698363920617"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7209834969577295,
            "unit": "#",
            "extra": "std: 0.13987450018862865"
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
          "id": "0e655150b7b2a4064640d9f4d1da8292c2ddc1c0",
          "message": "[release:major] Dataflow v2 (Release v2.0.0)",
          "timestamp": "2024-05-11T23:33:15+02:00",
          "tree_id": "076a1a4d0811c48b8d5b1772f553266db1b1df6f",
          "url": "https://github.com/flowr-analysis/flowr/commit/0e655150b7b2a4064640d9f4d1da8292c2ddc1c0"
        },
        "date": 1715463946683,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 235.21229777272728,
            "unit": "ms",
            "range": 0,
            "extra": "median: 235.21ms"
          },
          {
            "name": "Normalize R AST",
            "value": 30.70538895454545,
            "unit": "ms",
            "range": 0,
            "extra": "median: 30.71ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 58.51934586363637,
            "unit": "ms",
            "range": 0,
            "extra": "median: 58.52ms"
          },
          {
            "name": "Total per-file",
            "value": 1267.127549909091,
            "unit": "ms",
            "range": 0,
            "extra": "median: 1267.13ms"
          },
          {
            "name": "Static slicing",
            "value": 1.2580934025460149,
            "unit": "ms",
            "range": 1.1143940902862803,
            "extra": "median: 1.01ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.407624891592941,
            "unit": "ms",
            "range": 0.22100071767486737,
            "extra": "median: 0.36ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.6835994406474528,
            "unit": "ms",
            "range": 1.1688190169423094,
            "extra": "median: 1.48ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 0,
            "unit": "#",
            "extra": "out of 4158 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.797431685913541,
            "unit": "#",
            "extra": "std: 0.13787531016355367"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7740577588998524,
            "unit": "#",
            "extra": "std: 0.14093764179320997"
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
          "id": "eddce744a32324cab8a47397de625e142cb26a91",
          "message": "[release:patch] Drop `node:` prefix from dependencies (Release v2.0.1)",
          "timestamp": "2024-05-12T00:38:09+02:00",
          "tree_id": "f33b1f4a06829b8f849c4229bf9855e38270193d",
          "url": "https://github.com/flowr-analysis/flowr/commit/eddce744a32324cab8a47397de625e142cb26a91"
        },
        "date": 1715467766937,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 282.3815673181818,
            "unit": "ms",
            "range": 0,
            "extra": "median: 282.38ms"
          },
          {
            "name": "Normalize R AST",
            "value": 36.45953090909091,
            "unit": "ms",
            "range": 0,
            "extra": "median: 36.46ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 66.17186054545455,
            "unit": "ms",
            "range": 0,
            "extra": "median: 66.17ms"
          },
          {
            "name": "Total per-file",
            "value": 1557.712024590909,
            "unit": "ms",
            "range": 0,
            "extra": "median: 1557.71ms"
          },
          {
            "name": "Static slicing",
            "value": 1.4160048835200516,
            "unit": "ms",
            "range": 1.1715105189277293,
            "extra": "median: 1.15ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.48975330853571625,
            "unit": "ms",
            "range": 0.2799126163528146,
            "extra": "median: 0.43ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.9280102618968917,
            "unit": "ms",
            "range": 1.2491682419110006,
            "extra": "median: 1.68ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 0,
            "unit": "#",
            "extra": "out of 4158 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.797431685913541,
            "unit": "#",
            "extra": "std: 0.13787531016355367"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7740577588998524,
            "unit": "#",
            "extra": "std: 0.14093764179320997"
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
          "id": "d22453ad5b876eaffda4b7595db678f8e426493b",
          "message": "[release:patch] Fixing Control-Flow, Markdown-Exports, and Handling of Unnamed Closures (Release v2.0.2)",
          "timestamp": "2024-05-28T17:35:51+02:00",
          "tree_id": "0f59a79dfa984998f6ebf263b3656546a6088458",
          "url": "https://github.com/flowr-analysis/flowr/commit/d22453ad5b876eaffda4b7595db678f8e426493b"
        },
        "date": 1716911262506,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 243.05429936363637,
            "unit": "ms",
            "range": 0,
            "extra": "median: 213.96ms"
          },
          {
            "name": "Normalize R AST",
            "value": 32.13724890909091,
            "unit": "ms",
            "range": 0,
            "extra": "median: 16.43ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 58.000780727272726,
            "unit": "ms",
            "range": 0,
            "extra": "median: 24.19ms"
          },
          {
            "name": "Total per-file",
            "value": 1316.1662891363637,
            "unit": "ms",
            "range": 0,
            "extra": "median: 345.35ms"
          },
          {
            "name": "Static slicing",
            "value": 1.2440452530761172,
            "unit": "ms",
            "range": 1.046316928010988,
            "extra": "median: 0.77ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.4163136129101463,
            "unit": "ms",
            "range": 0.24489407898378365,
            "extra": "median: 0.13ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.678792450315851,
            "unit": "ms",
            "range": 1.1147291519637863,
            "extra": "median: 1.17ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 0,
            "unit": "#",
            "extra": "out of 4158 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.797431685913541,
            "unit": "#",
            "extra": "std: 0.13787531016355367"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7740577588998524,
            "unit": "#",
            "extra": "std: 0.14093764179320997"
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
          "id": "7462f093ba274f5b5a43541dff95acfb36b44133",
          "message": "[release:patch] Fine-Grained Benchmarks (Release v2.0.3)",
          "timestamp": "2024-06-02T01:28:31+02:00",
          "tree_id": "4fe2a786a66b2863b953662c0179d11e7fce64dc",
          "url": "https://github.com/flowr-analysis/flowr/commit/7462f093ba274f5b5a43541dff95acfb36b44133"
        },
        "date": 1717285174183,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 234.41972163636362,
            "unit": "ms",
            "range": 97.27166118178434,
            "extra": "median: 208.78ms"
          },
          {
            "name": "Normalize R AST",
            "value": 30.027115772727274,
            "unit": "ms",
            "range": 58.28173052586799,
            "extra": "median: 15.64ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 55.866367272727274,
            "unit": "ms",
            "range": 138.90983642084723,
            "extra": "median: 21.67ms"
          },
          {
            "name": "Total per-file",
            "value": 1248.7169384545455,
            "unit": "ms",
            "range": 3052.3762629636217,
            "extra": "median: 346.25ms"
          },
          {
            "name": "Static slicing",
            "value": 1.1751928704708625,
            "unit": "ms",
            "range": 1.0091837399183359,
            "extra": "median: 0.77ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.3994546148749048,
            "unit": "ms",
            "range": 0.22259446751951628,
            "extra": "median: 0.12ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.591721012897473,
            "unit": "ms",
            "range": 1.0744783904568622,
            "extra": "median: 1.04ms"
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
            "value": 0.797431685913541,
            "unit": "#",
            "extra": "std: 0.13787531016355367"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7740577588998524,
            "unit": "#",
            "extra": "std: 0.14093764179320997"
          },
          {
            "name": "memory (df-graph)",
            "value": 172.16313032670453,
            "unit": "KiB",
            "range": 409.35367998975613,
            "extra": "median: 53.29"
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
          "id": "f52a2e4651cfb3a8a8abc910d5736243f7c4dd0c",
          "message": "[release:patch] Fix: Supply ref for Benchmark Reports (Release v2.0.4)",
          "timestamp": "2024-06-02T12:20:41+02:00",
          "tree_id": "c4eb733ab79584ed9a08bf5b99902613beeb4eaa",
          "url": "https://github.com/flowr-analysis/flowr/commit/f52a2e4651cfb3a8a8abc910d5736243f7c4dd0c"
        },
        "date": 1717324355376,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 237.2369454090909,
            "unit": "ms",
            "range": 98.27764993168732,
            "extra": "median: 209.66ms"
          },
          {
            "name": "Normalize R AST",
            "value": 30.876232,
            "unit": "ms",
            "range": 59.34689801429226,
            "extra": "median: 16.09ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 55.985342227272724,
            "unit": "ms",
            "range": 137.7950291916745,
            "extra": "median: 21.57ms"
          },
          {
            "name": "Total per-file",
            "value": 1247.872942,
            "unit": "ms",
            "range": 3012.5588327856576,
            "extra": "median: 343.81ms"
          },
          {
            "name": "Static slicing",
            "value": 1.163045994222165,
            "unit": "ms",
            "range": 1.0209555523597966,
            "extra": "median: 0.77ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.39925948234168757,
            "unit": "ms",
            "range": 0.22407270900258372,
            "extra": "median: 0.13ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.578287565205892,
            "unit": "ms",
            "range": 1.0814554509192003,
            "extra": "median: 0.94ms"
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
            "value": 0.797431685913541,
            "unit": "#",
            "extra": "std: 0.13787531016355367"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7740577588998524,
            "unit": "#",
            "extra": "std: 0.14093764179320997"
          },
          {
            "name": "memory (df-graph)",
            "value": 172.16313032670453,
            "unit": "KiB",
            "range": 409.35367998975613,
            "extra": "median: 53.29"
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
          "id": "fb3aeb716a5945a820d37df8341ea431a5fcd462",
          "message": "[release:patch] Support for R 3.6.0 (Release v2.0.5)",
          "timestamp": "2024-06-02T16:05:52+02:00",
          "tree_id": "49c7c72a37e1403900352f0acbcc48ce3fe3680d",
          "url": "https://github.com/flowr-analysis/flowr/commit/fb3aeb716a5945a820d37df8341ea431a5fcd462"
        },
        "date": 1717337861178,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 240.9154517727273,
            "unit": "ms",
            "range": 103.09324865123189,
            "extra": "median: 214.81ms"
          },
          {
            "name": "Normalize R AST",
            "value": 32.32502363636364,
            "unit": "ms",
            "range": 62.91706473687664,
            "extra": "median: 16.06ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 57.280171,
            "unit": "ms",
            "range": 140.84117428895135,
            "extra": "median: 21.91ms"
          },
          {
            "name": "Total per-file",
            "value": 1293.4059648636362,
            "unit": "ms",
            "range": 3167.9941370213974,
            "extra": "median: 350.77ms"
          },
          {
            "name": "Static slicing",
            "value": 1.162629573700267,
            "unit": "ms",
            "range": 0.9860513874001618,
            "extra": "median: 0.74ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.41378788628895097,
            "unit": "ms",
            "range": 0.24843923643937205,
            "extra": "median: 0.12ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.593534663372232,
            "unit": "ms",
            "range": 1.062514004997539,
            "extra": "median: 1.01ms"
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
            "value": 0.797431685913541,
            "unit": "#",
            "extra": "std: 0.13787531016355367"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7740577588998524,
            "unit": "#",
            "extra": "std: 0.14093764179320997"
          },
          {
            "name": "memory (df-graph)",
            "value": 172.16313032670453,
            "unit": "KiB",
            "range": 409.35367998975613,
            "extra": "median: 53.29"
          }
        ]
      },
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
          "id": "575f504c26d43c968abb9c9fabf7e99b6cbf371e",
          "message": "[release:patch] Fix: Expression-Lists in Binary-Operators and Comment-Only Files (Release v2.0.6)",
          "timestamp": "2024-06-03T11:28:44+02:00",
          "tree_id": "1c00ff329c711b6c9af0a386c677ecef5dfd7410",
          "url": "https://github.com/flowr-analysis/flowr/commit/575f504c26d43c968abb9c9fabf7e99b6cbf371e"
        },
        "date": 1717407621867,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 236.68668686363637,
            "unit": "ms",
            "range": 103.73806052905451,
            "extra": "median: 208.80ms"
          },
          {
            "name": "Normalize R AST",
            "value": 31.29017854545455,
            "unit": "ms",
            "range": 61.166975559996914,
            "extra": "median: 16.69ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 56.164807,
            "unit": "ms",
            "range": 140.40023523937458,
            "extra": "median: 21.44ms"
          },
          {
            "name": "Total per-file",
            "value": 1275.5219,
            "unit": "ms",
            "range": 3124.9879170423906,
            "extra": "median: 340.84ms"
          },
          {
            "name": "Static slicing",
            "value": 1.1596426647712272,
            "unit": "ms",
            "range": 1.068907680014959,
            "extra": "median: 0.74ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.4080416237133483,
            "unit": "ms",
            "range": 0.23399056792118017,
            "extra": "median: 0.12ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.5840272139102147,
            "unit": "ms",
            "range": 1.1313206216592695,
            "extra": "median: 0.98ms"
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
            "value": 0.797431685913541,
            "unit": "#",
            "extra": "std: 0.13787531016355367"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7740577588998524,
            "unit": "#",
            "extra": "std: 0.14093764179320997"
          },
          {
            "name": "memory (df-graph)",
            "value": 172.16313032670453,
            "unit": "KiB",
            "range": 409.35367998975613,
            "extra": "median: 53.29"
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
          "id": "39dfc7cdf4c4761a03a4a4e255fe8c8ec1d8e9d0",
          "message": "[release:patch] More Built-Ins and Sample-Benchmarks (Release v2.0.7)",
          "timestamp": "2024-06-03T23:49:38+02:00",
          "tree_id": "cecee91a74d6ca26a55782eb4d9ccaf3ddcb0242",
          "url": "https://github.com/flowr-analysis/flowr/commit/39dfc7cdf4c4761a03a4a4e255fe8c8ec1d8e9d0"
        },
        "date": 1717452066684,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 242.99292672727273,
            "unit": "ms",
            "range": 104.90170078947651,
            "extra": "median: 215.82ms"
          },
          {
            "name": "Normalize R AST",
            "value": 31.669674,
            "unit": "ms",
            "range": 60.89661949663196,
            "extra": "median: 16.67ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 56.19145359090909,
            "unit": "ms",
            "range": 139.09332035888937,
            "extra": "median: 21.65ms"
          },
          {
            "name": "Total per-file",
            "value": 1293.3501588636364,
            "unit": "ms",
            "range": 3168.2924728183134,
            "extra": "median: 356.65ms"
          },
          {
            "name": "Static slicing",
            "value": 1.1705306007612786,
            "unit": "ms",
            "range": 0.981656748133071,
            "extra": "median: 0.78ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.4110313258840522,
            "unit": "ms",
            "range": 0.24394073913588787,
            "extra": "median: 0.12ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.5999207675810365,
            "unit": "ms",
            "range": 1.0599737567997427,
            "extra": "median: 1.02ms"
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
            "value": 0.7974469447714406,
            "unit": "#",
            "extra": "std: 0.137866619804194"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.774073695901592,
            "unit": "#",
            "extra": "std: 0.14092814050818442"
          },
          {
            "name": "memory (df-graph)",
            "value": 174.7940340909091,
            "unit": "KiB",
            "range": 417.33807446849215,
            "extra": "median: 53.29"
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
          "id": "c919f62d01807eca7e54a00e415bad56a46e9311",
          "message": "[release:patch] Reduce Dataflow Memory-Print (Release v2.0.8)",
          "timestamp": "2024-06-04T14:41:02+02:00",
          "tree_id": "bbb9834a895cbcd96b15d03ea473dce0bbca5e62",
          "url": "https://github.com/flowr-analysis/flowr/commit/c919f62d01807eca7e54a00e415bad56a46e9311"
        },
        "date": 1717505552027,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 238.8422665,
            "unit": "ms",
            "range": 100.36542442978394,
            "extra": "median: 212.38ms"
          },
          {
            "name": "Normalize R AST",
            "value": 31.483756772727272,
            "unit": "ms",
            "range": 61.76510267487319,
            "extra": "median: 15.75ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 56.44745127272727,
            "unit": "ms",
            "range": 139.82495087699667,
            "extra": "median: 21.65ms"
          },
          {
            "name": "Total per-file",
            "value": 1271.1114238181817,
            "unit": "ms",
            "range": 3087.0669050474426,
            "extra": "median: 345.29ms"
          },
          {
            "name": "Static slicing",
            "value": 1.2020123265030156,
            "unit": "ms",
            "range": 1.1211635564324134,
            "extra": "median: 0.76ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.4129428068869898,
            "unit": "ms",
            "range": 0.22972322292335046,
            "extra": "median: 0.13ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.6328556957834646,
            "unit": "ms",
            "range": 1.1753183659101543,
            "extra": "median: 1.04ms"
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
            "value": 0.7974469447714406,
            "unit": "#",
            "extra": "std: 0.137866619804194"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.774073695901592,
            "unit": "#",
            "extra": "std: 0.14092814050818442"
          },
          {
            "name": "memory (df-graph)",
            "value": 148.06165660511363,
            "unit": "KiB",
            "range": 360.76422840085473,
            "extra": "median: 45.40"
          }
        ]
      },
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
          "id": "f700458cef613440be51006076707eddda8ee1dc",
          "message": "[release:patch] Fix: File-Specific Benchmarks, Shorter Server Messages, Smaller Environments (Release v2.0.9)",
          "timestamp": "2024-06-12T14:15:47+02:00",
          "tree_id": "be2b0649d99fd34f81dfd6033b134f98ecd037f9",
          "url": "https://github.com/flowr-analysis/flowr/commit/f700458cef613440be51006076707eddda8ee1dc"
        },
        "date": 1718195269468,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 239.9579850909091,
            "unit": "ms",
            "range": 102.3143591043493,
            "extra": "median: 210.43ms"
          },
          {
            "name": "Normalize R AST",
            "value": 31.789413181818183,
            "unit": "ms",
            "range": 61.15919220046793,
            "extra": "median: 16.58ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 55.55642781818182,
            "unit": "ms",
            "range": 135.35958507480117,
            "extra": "median: 21.59ms"
          },
          {
            "name": "Total per-file",
            "value": 1266.3716643636362,
            "unit": "ms",
            "range": 3080.0372273611424,
            "extra": "median: 349.85ms"
          },
          {
            "name": "Static slicing",
            "value": 1.1759470126089957,
            "unit": "ms",
            "range": 1.026657605427425,
            "extra": "median: 0.78ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.4129902969511291,
            "unit": "ms",
            "range": 0.26192146241091074,
            "extra": "median: 0.12ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.606727659534164,
            "unit": "ms",
            "range": 1.0891507696308096,
            "extra": "median: 1.08ms"
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
            "value": 0.7974469447714406,
            "unit": "#",
            "extra": "std: 0.137866619804194"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.774073695901592,
            "unit": "#",
            "extra": "std: 0.14092814050818442"
          },
          {
            "name": "memory (df-graph)",
            "value": 147.58589311079547,
            "unit": "KiB",
            "range": 359.2574768951678,
            "extra": "median: 45.39"
          }
        ]
      },
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
          "id": "5b3ed9d7e79cfa406a8a9145190f66b72202c8e4",
          "message": "[release:patch] Fix: Correctly print CDs in mermaid (Release v2.0.10)",
          "timestamp": "2024-06-25T09:57:48+02:00",
          "tree_id": "5bdc6eeff97fccbed9fa85a43ad37df03483e839",
          "url": "https://github.com/flowr-analysis/flowr/commit/5b3ed9d7e79cfa406a8a9145190f66b72202c8e4"
        },
        "date": 1719303026409,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 239.78362031818182,
            "unit": "ms",
            "range": 101.71215351954449,
            "extra": "median: 210.27ms"
          },
          {
            "name": "Normalize R AST",
            "value": 31.126457727272726,
            "unit": "ms",
            "range": 60.59364235765207,
            "extra": "median: 16.07ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 57.31573868181818,
            "unit": "ms",
            "range": 143.97508076081658,
            "extra": "median: 21.74ms"
          },
          {
            "name": "Total per-file",
            "value": 1272.543320590909,
            "unit": "ms",
            "range": 3093.2003834604784,
            "extra": "median: 366.94ms"
          },
          {
            "name": "Static slicing",
            "value": 1.1706521036126456,
            "unit": "ms",
            "range": 1.0185054293350448,
            "extra": "median: 0.74ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.41664238454733316,
            "unit": "ms",
            "range": 0.2535032314593369,
            "extra": "median: 0.13ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.605898785152831,
            "unit": "ms",
            "range": 1.0896979662103579,
            "extra": "median: 1.13ms"
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
            "value": 0.7974469447714406,
            "unit": "#",
            "extra": "std: 0.137866619804194"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.774073695901592,
            "unit": "#",
            "extra": "std: 0.14092814050818442"
          },
          {
            "name": "memory (df-graph)",
            "value": 147.58589311079547,
            "unit": "KiB",
            "range": 359.2574768951678,
            "extra": "median: 45.39"
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
          "id": "d16b9a2cd653d7276b7f9f60e143773eab5f488d",
          "message": "[release:patch] Fix: undefined parse in repl (Release v2.0.11)",
          "timestamp": "2024-06-27T04:05:32+02:00",
          "tree_id": "ebcf13e298ffdcddc68023ca2e2e871f3494200a",
          "url": "https://github.com/flowr-analysis/flowr/commit/d16b9a2cd653d7276b7f9f60e143773eab5f488d"
        },
        "date": 1719454714800,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 241.68802936363636,
            "unit": "ms",
            "range": 102.8761180575731,
            "extra": "median: 213.23ms"
          },
          {
            "name": "Normalize R AST",
            "value": 31.739752136363638,
            "unit": "ms",
            "range": 62.50756200538419,
            "extra": "median: 15.57ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 53.60407036363637,
            "unit": "ms",
            "range": 129.65284550123417,
            "extra": "median: 21.99ms"
          },
          {
            "name": "Total per-file",
            "value": 1269.491520090909,
            "unit": "ms",
            "range": 3081.8881842692626,
            "extra": "median: 350.36ms"
          },
          {
            "name": "Static slicing",
            "value": 1.1992957765588008,
            "unit": "ms",
            "range": 1.0956190505793448,
            "extra": "median: 0.77ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.40823540912587025,
            "unit": "ms",
            "range": 0.23279531342826934,
            "extra": "median: 0.14ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.6255373838885934,
            "unit": "ms",
            "range": 1.1638162453002103,
            "extra": "median: 1.05ms"
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
            "value": 0.7974469447714406,
            "unit": "#",
            "extra": "std: 0.137866619804194"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.774073695901592,
            "unit": "#",
            "extra": "std: 0.14092814050818442"
          },
          {
            "name": "memory (df-graph)",
            "value": 147.58589311079547,
            "unit": "KiB",
            "range": 359.2574768951678,
            "extra": "median: 45.39"
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
          "id": "4fb2496898322ccc8fcf217f590bb8341aeaffbd",
          "message": "[release:patch] Link Closures in Unknown Calls (Release v2.0.16)",
          "timestamp": "2024-08-28T20:12:41+02:00",
          "tree_id": "5931659ac2cd2e713c4ce2f761c19194ea694468",
          "url": "https://github.com/flowr-analysis/flowr/commit/4fb2496898322ccc8fcf217f590bb8341aeaffbd"
        },
        "date": 1724869647417,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 238.1723235909091,
            "unit": "ms",
            "range": 96.71402866840735,
            "extra": "median: 212.44ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.4989345,
            "unit": "ms",
            "range": 33.57276767882534,
            "extra": "median: 11.26ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 38.792485772727275,
            "unit": "ms",
            "range": 84.2875165952748,
            "extra": "median: 16.95ms"
          },
          {
            "name": "Total per-file",
            "value": 799.2110945,
            "unit": "ms",
            "range": 1544.5301502222158,
            "extra": "median: 338.24ms"
          },
          {
            "name": "Static slicing",
            "value": 1.1726790800999163,
            "unit": "ms",
            "range": 1.0086901141796194,
            "extra": "median: 0.85ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.24335608198030453,
            "unit": "ms",
            "range": 0.18573862888815007,
            "extra": "median: 0.11ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.4331761674751269,
            "unit": "ms",
            "range": 1.0536924338527542,
            "extra": "median: 1.02ms"
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
            "value": 0.786663222057468,
            "unit": "#",
            "extra": "std: 0.12678208728393123"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.763664433957929,
            "unit": "#",
            "extra": "std: 0.13097477405278138"
          },
          {
            "name": "memory (df-graph)",
            "value": 147.66770241477272,
            "unit": "KiB",
            "range": 359.55136525995476,
            "extra": "median: 45.40"
          }
        ]
      },
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
          "id": "f7dd663f0b3028ec6b64733ed182c4a3c3cc29f7",
          "message": "[release:patch] Forcing Arguments, Improved Side-Effect Detection, and Lineage Command (Release v2.0.17)",
          "timestamp": "2024-08-30T16:22:32+02:00",
          "tree_id": "05ba0ba302b72ac649936ad42e3780fe5aa4be40",
          "url": "https://github.com/flowr-analysis/flowr/commit/f7dd663f0b3028ec6b64733ed182c4a3c3cc29f7"
        },
        "date": 1725028630747,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 238.5188252272727,
            "unit": "ms",
            "range": 100.22506468361182,
            "extra": "median: 210.68ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.296409454545454,
            "unit": "ms",
            "range": 33.092243108777645,
            "extra": "median: 10.90ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 36.9739589090909,
            "unit": "ms",
            "range": 77.82386121660545,
            "extra": "median: 16.22ms"
          },
          {
            "name": "Total per-file",
            "value": 776.2117469545454,
            "unit": "ms",
            "range": 1469.1651040608185,
            "extra": "median: 322.67ms"
          },
          {
            "name": "Static slicing",
            "value": 1.1872604452349385,
            "unit": "ms",
            "range": 0.9948751822483859,
            "extra": "median: 0.75ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2468089451648185,
            "unit": "ms",
            "range": 0.1946140644840204,
            "extra": "median: 0.11ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.4516484087621992,
            "unit": "ms",
            "range": 1.0470370397968392,
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
            "value": 0.7869724682442361,
            "unit": "#",
            "extra": "std: 0.12680303581817906"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7640044233283717,
            "unit": "#",
            "extra": "std: 0.130992786008264"
          },
          {
            "name": "memory (df-graph)",
            "value": 147.58589311079547,
            "unit": "KiB",
            "range": 359.2574768951678,
            "extra": "median: 45.40"
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
          "id": "f36fe912b408ebc8f8f524b31347e297fb15cea7",
          "message": "[release:patch] Support Side Effects by Loads, Table Assignments, and *Apply (Release v2.0.18)",
          "timestamp": "2024-08-31T20:52:30+02:00",
          "tree_id": "837af1424ca334760308cee914c63b35dd901833",
          "url": "https://github.com/flowr-analysis/flowr/commit/f36fe912b408ebc8f8f524b31347e297fb15cea7"
        },
        "date": 1725131263901,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 242.2558602727273,
            "unit": "ms",
            "range": 101.30712273815813,
            "extra": "median: 213.58ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.704137181818183,
            "unit": "ms",
            "range": 33.862207975405106,
            "extra": "median: 10.99ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 37.6853974090909,
            "unit": "ms",
            "range": 81.72829646102795,
            "extra": "median: 16.61ms"
          },
          {
            "name": "Total per-file",
            "value": 813.1600831363636,
            "unit": "ms",
            "range": 1429.262798826243,
            "extra": "median: 367.96ms"
          },
          {
            "name": "Static slicing",
            "value": 2.202781625378791,
            "unit": "ms",
            "range": 1.436416162719779,
            "extra": "median: 0.80ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.24868468110120015,
            "unit": "ms",
            "range": 0.2318084566267017,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.467194116777099,
            "unit": "ms",
            "range": 1.5088211712027446,
            "extra": "median: 1.06ms"
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
            "value": 0.7869724682442361,
            "unit": "#",
            "extra": "std: 0.12680303581817906"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7640044233283717,
            "unit": "#",
            "extra": "std: 0.130992786008264"
          },
          {
            "name": "memory (df-graph)",
            "value": 147.58589311079547,
            "unit": "KiB",
            "range": 359.2574768951678,
            "extra": "median: 45.40"
          }
        ]
      },
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
          "id": "2ba4d77877fe53239f726a488ec64a2875a2d054",
          "message": "[release:patch] Fix: Use of Replacement Functions in Function Definitions (Release v2.0.19)",
          "timestamp": "2024-09-03T22:40:53+02:00",
          "tree_id": "484c952218196a6640f5665649fadc168fcefb30",
          "url": "https://github.com/flowr-analysis/flowr/commit/2ba4d77877fe53239f726a488ec64a2875a2d054"
        },
        "date": 1725397131201,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 234.1387735909091,
            "unit": "ms",
            "range": 95.70717517929441,
            "extra": "median: 209.69ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.71587190909091,
            "unit": "ms",
            "range": 34.16826339270419,
            "extra": "median: 11.18ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 37.632453727272726,
            "unit": "ms",
            "range": 80.25944650490707,
            "extra": "median: 16.66ms"
          },
          {
            "name": "Total per-file",
            "value": 793.4031634545455,
            "unit": "ms",
            "range": 1405.318772592594,
            "extra": "median: 361.08ms"
          },
          {
            "name": "Static slicing",
            "value": 2.1778708430615645,
            "unit": "ms",
            "range": 1.2107167287047964,
            "extra": "median: 0.75ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2263642556384633,
            "unit": "ms",
            "range": 0.18405690719686232,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.4207134978896474,
            "unit": "ms",
            "range": 1.2838157423981884,
            "extra": "median: 1.01ms"
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
            "value": 0.7869724682442361,
            "unit": "#",
            "extra": "std: 0.12680303581817906"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7640044233283717,
            "unit": "#",
            "extra": "std: 0.130992786008264"
          },
          {
            "name": "memory (df-graph)",
            "value": 147.58589311079547,
            "unit": "KiB",
            "range": 359.2574768951678,
            "extra": "median: 45.40"
          }
        ]
      },
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
          "id": "d6d97d3fea33e517ba14715d9fc2fbf476969926",
          "message": "[release:patch] Fix: Overshadow Built-Ins in Loops (Release v2.0.20)",
          "timestamp": "2024-09-09T10:17:42+02:00",
          "tree_id": "39481f7becc3c958ae8d9195b92f08ed9e6ef7c4",
          "url": "https://github.com/flowr-analysis/flowr/commit/d6d97d3fea33e517ba14715d9fc2fbf476969926"
        },
        "date": 1725871132651,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 237.1307347272727,
            "unit": "ms",
            "range": 99.33189983148677,
            "extra": "median: 209.74ms"
          },
          {
            "name": "Normalize R AST",
            "value": 20.22688240909091,
            "unit": "ms",
            "range": 34.81944475834837,
            "extra": "median: 10.74ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 38.76148281818182,
            "unit": "ms",
            "range": 83.37589845299341,
            "extra": "median: 16.29ms"
          },
          {
            "name": "Total per-file",
            "value": 805.4951149545454,
            "unit": "ms",
            "range": 1418.989224836618,
            "extra": "median: 361.73ms"
          },
          {
            "name": "Static slicing",
            "value": 2.2549209922472833,
            "unit": "ms",
            "range": 1.3467440237997401,
            "extra": "median: 0.74ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.22440795860531199,
            "unit": "ms",
            "range": 0.17245303864543157,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.4968072479681567,
            "unit": "ms",
            "range": 1.402430824638579,
            "extra": "median: 1.10ms"
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
            "value": 0.7869360165281424,
            "unit": "#",
            "extra": "std: 0.12681559080835017"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7639690077689504,
            "unit": "#",
            "extra": "std: 0.13100359353752966"
          },
          {
            "name": "memory (df-graph)",
            "value": 147.42458274147728,
            "unit": "KiB",
            "range": 358.6827375397903,
            "extra": "median: 45.40"
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
          "id": "5ec575519531bc0853fc1f7388ea53bfe5536b16",
          "message": "[release:patch] Fix `mapply`, Nested Data-Frame-Assignments, and CD Nestings (Release v2.0.21)",
          "timestamp": "2024-09-10T00:41:42+02:00",
          "tree_id": "2d2319307093dbe8d76aafd3e03eea3f5f6e26a7",
          "url": "https://github.com/flowr-analysis/flowr/commit/5ec575519531bc0853fc1f7388ea53bfe5536b16"
        },
        "date": 1725922987381,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 233.2907186818182,
            "unit": "ms",
            "range": 97.45110804111708,
            "extra": "median: 208.15ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.917075136363636,
            "unit": "ms",
            "range": 34.5158156737535,
            "extra": "median: 11.17ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 37.43015868181818,
            "unit": "ms",
            "range": 79.35445410536298,
            "extra": "median: 16.28ms"
          },
          {
            "name": "Total per-file",
            "value": 799.1242539545455,
            "unit": "ms",
            "range": 1405.241136246055,
            "extra": "median: 361.86ms"
          },
          {
            "name": "Static slicing",
            "value": 2.2835471638828966,
            "unit": "ms",
            "range": 1.2756604468344452,
            "extra": "median: 0.77ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.22306814497873728,
            "unit": "ms",
            "range": 0.17216824146737347,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.5225635539266658,
            "unit": "ms",
            "range": 1.328507146779839,
            "extra": "median: 1.03ms"
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
            "value": 0.7869360165281424,
            "unit": "#",
            "extra": "std: 0.12681559080835017"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7639690077689504,
            "unit": "#",
            "extra": "std: 0.13100359353752966"
          },
          {
            "name": "memory (df-graph)",
            "value": 147.42458274147728,
            "unit": "KiB",
            "range": 358.6827375397903,
            "extra": "median: 45.40"
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
          "id": "69a5fc86cba0257f9dd4afb87153a86912635ac2",
          "message": "[release:patch] Fix `par` and Memory-Increase for Docker (Release v2.0.22)",
          "timestamp": "2024-09-12T15:57:15+02:00",
          "tree_id": "fa75f21d466253de387fd2050d5217dbea78ca34",
          "url": "https://github.com/flowr-analysis/flowr/commit/69a5fc86cba0257f9dd4afb87153a86912635ac2"
        },
        "date": 1726150768904,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 254.0663056818182,
            "unit": "ms",
            "range": 111.00956124859476,
            "extra": "median: 222.63ms"
          },
          {
            "name": "Normalize R AST",
            "value": 21.304006772727273,
            "unit": "ms",
            "range": 37.381897968932314,
            "extra": "median: 12.11ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 40.67071668181818,
            "unit": "ms",
            "range": 86.45291664681547,
            "extra": "median: 16.97ms"
          },
          {
            "name": "Total per-file",
            "value": 872.2856076363636,
            "unit": "ms",
            "range": 1588.4594968913652,
            "extra": "median: 386.93ms"
          },
          {
            "name": "Static slicing",
            "value": 2.2540939123938912,
            "unit": "ms",
            "range": 1.2408759344118971,
            "extra": "median: 0.75ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.24820597687991225,
            "unit": "ms",
            "range": 0.20259172674837386,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.5200681050838227,
            "unit": "ms",
            "range": 1.3153274268350599,
            "extra": "median: 1.05ms"
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
            "value": 0.7869360165281424,
            "unit": "#",
            "extra": "std: 0.12681559080835017"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7639690077689504,
            "unit": "#",
            "extra": "std: 0.13100359353752966"
          },
          {
            "name": "memory (df-graph)",
            "value": 147.42458274147728,
            "unit": "KiB",
            "range": 358.6827375397903,
            "extra": "median: 45.40"
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
          "id": "44c526b4eb30b0cc6cb10bb1a3a056a3f51c9597",
          "message": "[release:patch] Support More Side-Effects (Release v2.0.23)",
          "timestamp": "2024-09-13T03:43:31+02:00",
          "tree_id": "81bd9928fc36ac9ea963c11981ef0ba31d2f22f2",
          "url": "https://github.com/flowr-analysis/flowr/commit/44c526b4eb30b0cc6cb10bb1a3a056a3f51c9597"
        },
        "date": 1726193151579,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 239.42213677272727,
            "unit": "ms",
            "range": 103.82313121172619,
            "extra": "median: 211.98ms"
          },
          {
            "name": "Normalize R AST",
            "value": 20.457404363636364,
            "unit": "ms",
            "range": 36.77082082099273,
            "extra": "median: 11.19ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 38.21900681818182,
            "unit": "ms",
            "range": 81.34971002482807,
            "extra": "median: 16.60ms"
          },
          {
            "name": "Total per-file",
            "value": 816.8130319090909,
            "unit": "ms",
            "range": 1460.0152060402618,
            "extra": "median: 373.15ms"
          },
          {
            "name": "Static slicing",
            "value": 2.2454117276977246,
            "unit": "ms",
            "range": 1.3672814394953574,
            "extra": "median: 0.83ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.22823695438019298,
            "unit": "ms",
            "range": 0.180587515271109,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.4904620761066987,
            "unit": "ms",
            "range": 1.4311425544325718,
            "extra": "median: 1.07ms"
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
            "value": 0.7869360165281424,
            "unit": "#",
            "extra": "std: 0.12681559080835017"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7639690077689504,
            "unit": "#",
            "extra": "std: 0.13100359353752966"
          },
          {
            "name": "memory (df-graph)",
            "value": 147.42458274147728,
            "unit": "KiB",
            "range": 358.6827375397903,
            "extra": "median: 45.40"
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
          "id": "e97ab14baf2ce8e8dd82634b0ed34e4283364345",
          "message": "[release:patch] Fix: Incorrect Side-Effects for dev.off (Release v2.0.24)",
          "timestamp": "2024-09-13T08:04:48+02:00",
          "tree_id": "bc3bfc5f35a5efb84d34ca16adc94e78635389ed",
          "url": "https://github.com/flowr-analysis/flowr/commit/e97ab14baf2ce8e8dd82634b0ed34e4283364345"
        },
        "date": 1726208806833,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 237.97672204545452,
            "unit": "ms",
            "range": 100.95361539859664,
            "extra": "median: 210.33ms"
          },
          {
            "name": "Normalize R AST",
            "value": 21.414143136363638,
            "unit": "ms",
            "range": 39.56891598363369,
            "extra": "median: 10.78ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 38.950916863636365,
            "unit": "ms",
            "range": 85.69610850964092,
            "extra": "median: 16.54ms"
          },
          {
            "name": "Total per-file",
            "value": 808.1631112727273,
            "unit": "ms",
            "range": 1428.688046281115,
            "extra": "median: 367.18ms"
          },
          {
            "name": "Static slicing",
            "value": 2.228467730535544,
            "unit": "ms",
            "range": 1.3740018187972964,
            "extra": "median: 0.86ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2245747020074741,
            "unit": "ms",
            "range": 0.17586130505481137,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.470040222573707,
            "unit": "ms",
            "range": 1.4254046625840677,
            "extra": "median: 1.10ms"
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
            "value": 0.7869360165281424,
            "unit": "#",
            "extra": "std: 0.12681559080835017"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7639690077689504,
            "unit": "#",
            "extra": "std: 0.13100359353752966"
          },
          {
            "name": "memory (df-graph)",
            "value": 147.42458274147728,
            "unit": "KiB",
            "range": 358.6827375397903,
            "extra": "median: 45.40"
          }
        ]
      },
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
          "id": "9d8b36155cdc051cb13f4f2c93eb42c14394e0a9",
          "message": "[release:patch] Dataflow Graph Deserialization (Release v2.0.25)",
          "timestamp": "2024-09-16T18:33:48+02:00",
          "tree_id": "6d5085f73235cd2a3ed9c137e1d32256f8e84097",
          "url": "https://github.com/flowr-analysis/flowr/commit/9d8b36155cdc051cb13f4f2c93eb42c14394e0a9"
        },
        "date": 1726506369711,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 238.12351204545453,
            "unit": "ms",
            "range": 103.59720843756357,
            "extra": "median: 210.47ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.968034227272728,
            "unit": "ms",
            "range": 34.84298543847825,
            "extra": "median: 11.13ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 38.310942090909094,
            "unit": "ms",
            "range": 82.04448044777155,
            "extra": "median: 16.33ms"
          },
          {
            "name": "Total per-file",
            "value": 811.1703915909092,
            "unit": "ms",
            "range": 1431.4404310276739,
            "extra": "median: 363.42ms"
          },
          {
            "name": "Static slicing",
            "value": 2.258090287874194,
            "unit": "ms",
            "range": 1.2792808105316449,
            "extra": "median: 0.76ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.22489327849282828,
            "unit": "ms",
            "range": 0.17585774592637268,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.4996261233332735,
            "unit": "ms",
            "range": 1.3278746913052974,
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
            "value": 0.7869360165281424,
            "unit": "#",
            "extra": "std: 0.12681559080835017"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7639690077689504,
            "unit": "#",
            "extra": "std: 0.13100359353752966"
          },
          {
            "name": "memory (df-graph)",
            "value": 147.42458274147728,
            "unit": "KiB",
            "range": 358.6827375397903,
            "extra": "median: 45.40"
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
          "id": "87e0d906cf2af0afd4cca69261ecd3b5a9c94cba",
          "message": "[release:patch] Several New Queries (Dataflow, Normalized AST, Id-Map, Clusters, Slice) (Release v2.1.2)",
          "timestamp": "2024-10-12T21:16:01+02:00",
          "tree_id": "7189ce7de02572ec3e2615f5d14feda54c733e31",
          "url": "https://github.com/flowr-analysis/flowr/commit/87e0d906cf2af0afd4cca69261ecd3b5a9c94cba"
        },
        "date": 1728761757648,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 236.1199211818182,
            "unit": "ms",
            "range": 98.66983024776289,
            "extra": "median: 209.64ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.017819681818185,
            "unit": "ms",
            "range": 30.826317957537874,
            "extra": "median: 9.39ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 39.13999777272727,
            "unit": "ms",
            "range": 83.84025914001471,
            "extra": "median: 18.10ms"
          },
          {
            "name": "Total per-file",
            "value": 812.0954968181819,
            "unit": "ms",
            "range": 1454.9698832785984,
            "extra": "median: 354.48ms"
          },
          {
            "name": "Static slicing",
            "value": 2.1591346071288307,
            "unit": "ms",
            "range": 1.3606098316777646,
            "extra": "median: 0.73ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.22943671546843153,
            "unit": "ms",
            "range": 0.1742124327312039,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.4043281804202783,
            "unit": "ms",
            "range": 1.4361374673050025,
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
            "value": 0.7869360165281424,
            "unit": "#",
            "extra": "std: 0.12681559080835017"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7639690077689504,
            "unit": "#",
            "extra": "std: 0.13100359353752966"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.46617542613636,
            "unit": "KiB",
            "range": 244.77619956879823,
            "extra": "median: 24.54"
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
          "id": "96e933e11de9483de54200657c3dbf930f0c657b",
          "message": "[release:patch] Lineage Query (Release v2.1.3)",
          "timestamp": "2024-10-13T11:49:17+02:00",
          "tree_id": "69ef18259b9d63b7cf73755c0c68ed84651cd0fb",
          "url": "https://github.com/flowr-analysis/flowr/commit/96e933e11de9483de54200657c3dbf930f0c657b"
        },
        "date": 1728814104731,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 246.50067822727272,
            "unit": "ms",
            "range": 108.0778534921102,
            "extra": "median: 218.52ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.822801272727272,
            "unit": "ms",
            "range": 32.47501104567212,
            "extra": "median: 8.53ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 40.41399131818182,
            "unit": "ms",
            "range": 86.99830114822697,
            "extra": "median: 17.73ms"
          },
          {
            "name": "Total per-file",
            "value": 829.6500495454545,
            "unit": "ms",
            "range": 1498.0426737610057,
            "extra": "median: 370.87ms"
          },
          {
            "name": "Static slicing",
            "value": 2.0971564864344034,
            "unit": "ms",
            "range": 1.2085738336418979,
            "extra": "median: 0.78ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.24421041798721546,
            "unit": "ms",
            "range": 0.1931884846808244,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.356082671207842,
            "unit": "ms",
            "range": 1.2841644653561477,
            "extra": "median: 1.06ms"
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
            "value": 0.7869360165281424,
            "unit": "#",
            "extra": "std: 0.12681559080835017"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7639690077689504,
            "unit": "#",
            "extra": "std: 0.13100359353752966"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.46617542613636,
            "unit": "KiB",
            "range": 244.77619956879823,
            "extra": "median: 24.54"
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
          "id": "b1b2a4fc1891a2deaf0d8b8ad8a4e68997516598",
          "message": "[release:patch] Dependencies Query (Release v2.1.4)",
          "timestamp": "2024-11-03T19:08:28+01:00",
          "tree_id": "aeeada919a449d740b91787f92776ecd678c9482",
          "url": "https://github.com/flowr-analysis/flowr/commit/b1b2a4fc1891a2deaf0d8b8ad8a4e68997516598"
        },
        "date": 1730658472556,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 235.55314422727272,
            "unit": "ms",
            "range": 96.72403503863565,
            "extra": "median: 210.37ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.58143390909091,
            "unit": "ms",
            "range": 31.74556724684041,
            "extra": "median: 8.58ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 60.37620659090909,
            "unit": "ms",
            "range": 128.80057198423427,
            "extra": "median: 29.60ms"
          },
          {
            "name": "Total per-file",
            "value": 836.2917278181819,
            "unit": "ms",
            "range": 1520.8800616695478,
            "extra": "median: 352.41ms"
          },
          {
            "name": "Static slicing",
            "value": 2.0412247343237886,
            "unit": "ms",
            "range": 1.2114179518839105,
            "extra": "median: 0.81ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.22918887047809808,
            "unit": "ms",
            "range": 0.17190632838553319,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.284079723104182,
            "unit": "ms",
            "range": 1.2742262921798237,
            "extra": "median: 1.02ms"
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
            "value": 0.7869360165281424,
            "unit": "#",
            "extra": "std: 0.12681559080835017"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7639690077689504,
            "unit": "#",
            "extra": "std: 0.13100359353752966"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.46617542613636,
            "unit": "KiB",
            "range": 244.77619956879823,
            "extra": "median: 24.54"
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
          "id": "0d1268dc84fe71880bd570ec306ef25f81b46329",
          "message": "[release:patch] Fix: Dependency Query with Aliases (Release v2.1.5)",
          "timestamp": "2024-11-04T20:00:23+01:00",
          "tree_id": "0f4be08b9ed899e2acb220fce2a76fbe7fe269bc",
          "url": "https://github.com/flowr-analysis/flowr/commit/0d1268dc84fe71880bd570ec306ef25f81b46329"
        },
        "date": 1730748114116,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 237.85305927272728,
            "unit": "ms",
            "range": 97.36861369002281,
            "extra": "median: 209.90ms"
          },
          {
            "name": "Normalize R AST",
            "value": 16.982624772727274,
            "unit": "ms",
            "range": 30.42886266900597,
            "extra": "median: 9.02ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 60.41169277272727,
            "unit": "ms",
            "range": 128.7371176899317,
            "extra": "median: 28.53ms"
          },
          {
            "name": "Total per-file",
            "value": 833.961438,
            "unit": "ms",
            "range": 1514.7315556086162,
            "extra": "median: 369.62ms"
          },
          {
            "name": "Static slicing",
            "value": 2.0461436166648226,
            "unit": "ms",
            "range": 1.2405957027340997,
            "extra": "median: 0.80ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.23572579664556767,
            "unit": "ms",
            "range": 0.19160803373208626,
            "extra": "median: 0.09ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.2952539344461735,
            "unit": "ms",
            "range": 1.3064191460121453,
            "extra": "median: 1.04ms"
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
            "value": 0.7869360165281424,
            "unit": "#",
            "extra": "std: 0.12681559080835017"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7639690077689504,
            "unit": "#",
            "extra": "std: 0.13100359353752966"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.46617542613636,
            "unit": "KiB",
            "range": 244.77619956879823,
            "extra": "median: 24.54"
          }
        ]
      },
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
          "id": "f2c385450bed779acacfd46a3b030ee57c48264c",
          "message": "[release:patch] Include Source-File Information, Vitest, and Documentation (Release v2.1.6)",
          "timestamp": "2024-11-14T17:17:14+01:00",
          "tree_id": "d078189bfab30293d38ae2019d0eb7bd14dd983b",
          "url": "https://github.com/flowr-analysis/flowr/commit/f2c385450bed779acacfd46a3b030ee57c48264c"
        },
        "date": 1731602213345,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 242.511069,
            "unit": "ms",
            "range": 104.25481253884982,
            "extra": "median: 215.01ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.503866272727272,
            "unit": "ms",
            "range": 30.822414076019967,
            "extra": "median: 8.83ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 63.56230831818182,
            "unit": "ms",
            "range": 139.13042218282254,
            "extra": "median: 30.51ms"
          },
          {
            "name": "Total per-file",
            "value": 844.9024829090908,
            "unit": "ms",
            "range": 1524.2742528111726,
            "extra": "median: 373.37ms"
          },
          {
            "name": "Static slicing",
            "value": 2.130097162195859,
            "unit": "ms",
            "range": 1.2374206776403573,
            "extra": "median: 0.73ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.24572113951676444,
            "unit": "ms",
            "range": 0.20266025681679084,
            "extra": "median: 0.09ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.3895427243026623,
            "unit": "ms",
            "range": 1.30652599483124,
            "extra": "median: 1.02ms"
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
            "value": 0.7869360165281424,
            "unit": "#",
            "extra": "std: 0.12681559080835017"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7639690077689504,
            "unit": "#",
            "extra": "std: 0.13100359353752966"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.46617542613636,
            "unit": "KiB",
            "range": 244.77619956879823,
            "extra": "median: 24.54"
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
          "id": "23801137ca7083fd1edfe603a80c8ebf6d2d557a",
          "message": "[release:patch] Fix: Static Slicing For Inverted Caller (Release v2.1.7)",
          "timestamp": "2024-11-17T19:53:11+01:00",
          "tree_id": "60b0536b0e628727fcdc94746a38538f3f6c5896",
          "url": "https://github.com/flowr-analysis/flowr/commit/23801137ca7083fd1edfe603a80c8ebf6d2d557a"
        },
        "date": 1731870835269,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 238.99386745454547,
            "unit": "ms",
            "range": 99.5397110373604,
            "extra": "median: 213.23ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.344255954545453,
            "unit": "ms",
            "range": 30.98539214696861,
            "extra": "median: 8.51ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 60.94850918181818,
            "unit": "ms",
            "range": 127.79646053550617,
            "extra": "median: 28.95ms"
          },
          {
            "name": "Total per-file",
            "value": 839.1842053181819,
            "unit": "ms",
            "range": 1529.9296327924758,
            "extra": "median: 360.01ms"
          },
          {
            "name": "Static slicing",
            "value": 2.0548017594197465,
            "unit": "ms",
            "range": 1.212534826826947,
            "extra": "median: 0.78ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.23833344722067284,
            "unit": "ms",
            "range": 0.18520720238626878,
            "extra": "median: 0.09ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.306734662937843,
            "unit": "ms",
            "range": 1.2769510302954954,
            "extra": "median: 1.02ms"
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
            "value": 0.7869360165281424,
            "unit": "#",
            "extra": "std: 0.12681559080835017"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7639690077689504,
            "unit": "#",
            "extra": "std: 0.13100359353752966"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.46617542613636,
            "unit": "KiB",
            "range": 244.77619956879823,
            "extra": "median: 24.54"
          }
        ]
      },
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
          "id": "db7ac2e228f8144da97c252a2affb26bd9ea4e0b",
          "message": "[release:patch] Improved Dead-Code Detection, Location Restrictions for Call-Context Query, New Visitor (Release v2.1.8)",
          "timestamp": "2024-11-28T13:54:45+01:00",
          "tree_id": "54959f17cb72871023e10232c7b70ca57816b089",
          "url": "https://github.com/flowr-analysis/flowr/commit/db7ac2e228f8144da97c252a2affb26bd9ea4e0b"
        },
        "date": 1732799935154,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 242.24415118181818,
            "unit": "ms",
            "range": 104.26310147093089,
            "extra": "median: 215.43ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.39715159090909,
            "unit": "ms",
            "range": 31.09452227247912,
            "extra": "median: 8.49ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 60.33616290909091,
            "unit": "ms",
            "range": 127.75990956872062,
            "extra": "median: 28.90ms"
          },
          {
            "name": "Total per-file",
            "value": 833.5976102727273,
            "unit": "ms",
            "range": 1502.9439844838432,
            "extra": "median: 367.11ms"
          },
          {
            "name": "Static slicing",
            "value": 2.029558401836784,
            "unit": "ms",
            "range": 1.2081663161038019,
            "extra": "median: 0.73ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.23538053186242114,
            "unit": "ms",
            "range": 0.17968366955783688,
            "extra": "median: 0.09ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.278853130617715,
            "unit": "ms",
            "range": 1.2795408953549086,
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
            "value": 0.7891949660994808,
            "unit": "#",
            "extra": "std: 0.1265547989588566"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7665650684287274,
            "unit": "#",
            "extra": "std: 0.13059911524134268"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.46617542613636,
            "unit": "KiB",
            "range": 244.77619956879823,
            "extra": "median: 24.54"
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
          "id": "2b2a899bb137bbe37158d8b89b5d9ab797377c87",
          "message": "[release:patch] Improved Closure Slicing, DFG docs, and Support for the Car Package (Release v2.1.9)",
          "timestamp": "2024-12-21T19:20:34+01:00",
          "tree_id": "5021a4d182f712192184590249ccca759e5c2361",
          "url": "https://github.com/flowr-analysis/flowr/commit/2b2a899bb137bbe37158d8b89b5d9ab797377c87"
        },
        "date": 1734806435528,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 243.0171155909091,
            "unit": "ms",
            "range": 99.82701749585424,
            "extra": "median: 217.88ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.87491059090909,
            "unit": "ms",
            "range": 33.81842876509269,
            "extra": "median: 9.18ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 66.6961805909091,
            "unit": "ms",
            "range": 139.6821788860312,
            "extra": "median: 35.89ms"
          },
          {
            "name": "Total per-file",
            "value": 848.6318680909092,
            "unit": "ms",
            "range": 1535.0611217188766,
            "extra": "median: 367.27ms"
          },
          {
            "name": "Static slicing",
            "value": 2.0300712232607445,
            "unit": "ms",
            "range": 1.131129311194201,
            "extra": "median: 0.78ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.22998066957514512,
            "unit": "ms",
            "range": 0.1737430444335318,
            "extra": "median: 0.09ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.2737013217579434,
            "unit": "ms",
            "range": 1.2044980277099173,
            "extra": "median: 1.02ms"
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
            "value": 0.7891949660994808,
            "unit": "#",
            "extra": "std: 0.1265547989588566"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7665650684287274,
            "unit": "#",
            "extra": "std: 0.13059911524134268"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.19682173295455,
            "unit": "KiB",
            "range": 244.24808975931026,
            "extra": "median: 24.54"
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
          "id": "193493e9fb030ea261ae5f34cb1637c1dbdc8c0c",
          "message": "[release:patch] First support for pointer analysis (named list arguments with `$`) (Release v2.1.10)",
          "timestamp": "2025-01-05T09:27:15+01:00",
          "tree_id": "0ff91a4015f58348ae7b57e9fcdf0c9beb6e0d66",
          "url": "https://github.com/flowr-analysis/flowr/commit/193493e9fb030ea261ae5f34cb1637c1dbdc8c0c"
        },
        "date": 1736072499763,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 236.3631803181818,
            "unit": "ms",
            "range": 96.3414320076851,
            "extra": "median: 209.82ms"
          },
          {
            "name": "Normalize R AST",
            "value": 16.913317227272728,
            "unit": "ms",
            "range": 29.999587728462018,
            "extra": "median: 8.28ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 65.89893436363637,
            "unit": "ms",
            "range": 142.81728859304584,
            "extra": "median: 34.94ms"
          },
          {
            "name": "Total per-file",
            "value": 838.4056316818181,
            "unit": "ms",
            "range": 1528.5998928788965,
            "extra": "median: 356.40ms"
          },
          {
            "name": "Static slicing",
            "value": 2.0272357895131496,
            "unit": "ms",
            "range": 1.140695509301643,
            "extra": "median: 0.74ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.22794475391580074,
            "unit": "ms",
            "range": 0.17048234005806254,
            "extra": "median: 0.09ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.2687764323735546,
            "unit": "ms",
            "range": 1.2083956198769428,
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
            "value": 0.7891949660994808,
            "unit": "#",
            "extra": "std: 0.1265547989588566"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7665650684287274,
            "unit": "#",
            "extra": "std: 0.13059911524134268"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.19682173295455,
            "unit": "KiB",
            "range": 244.24808975931026,
            "extra": "median: 24.54"
          }
        ]
      },
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
          "id": "541c8774cb7fdf6746f88a6796dbdbd702f05b88",
          "message": "[release:patch] Improved Configuration Retrieve and Config Query (Release v2.1.11)",
          "timestamp": "2025-01-08T14:10:23+01:00",
          "tree_id": "fc705e512f52a0003e3980f292189ef33cd27b88",
          "url": "https://github.com/flowr-analysis/flowr/commit/541c8774cb7fdf6746f88a6796dbdbd702f05b88"
        },
        "date": 1736343766785,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 239.40731418181818,
            "unit": "ms",
            "range": 107.31464771727909,
            "extra": "median: 212.50ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.508376863636364,
            "unit": "ms",
            "range": 31.79377844007773,
            "extra": "median: 8.52ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 66.46472845454545,
            "unit": "ms",
            "range": 145.1016568146713,
            "extra": "median: 33.49ms"
          },
          {
            "name": "Total per-file",
            "value": 839.2208891363637,
            "unit": "ms",
            "range": 1521.900640869443,
            "extra": "median: 359.25ms"
          },
          {
            "name": "Static slicing",
            "value": 2.108340486081401,
            "unit": "ms",
            "range": 1.7921046882048606,
            "extra": "median: 0.78ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.22827425146521693,
            "unit": "ms",
            "range": 0.17998299083862343,
            "extra": "median: 0.09ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.3500009637852575,
            "unit": "ms",
            "range": 1.885960794154002,
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
            "value": 0.7891949660994808,
            "unit": "#",
            "extra": "std: 0.1265547989588566"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7665650684287274,
            "unit": "#",
            "extra": "std: 0.13059911524134268"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.19682173295455,
            "unit": "KiB",
            "range": 244.24808975931026,
            "extra": "median: 24.54"
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
          "id": "7070a1878fcd8538f6608721a8b2fff257baa7b1",
          "message": "[release:patch] Flowr Search API and Query (+wiki improvements) (Release v2.1.12)",
          "timestamp": "2025-01-10T21:26:04+01:00",
          "tree_id": "25127a9bdefc846b50ba6b660e3404755fedacad",
          "url": "https://github.com/flowr-analysis/flowr/commit/7070a1878fcd8538f6608721a8b2fff257baa7b1"
        },
        "date": 1736542054126,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 239.0575427727273,
            "unit": "ms",
            "range": 99.63372465798743,
            "extra": "median: 212.08ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.121448772727273,
            "unit": "ms",
            "range": 30.4243791624962,
            "extra": "median: 8.37ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 65.30868768181818,
            "unit": "ms",
            "range": 141.9282364981722,
            "extra": "median: 32.12ms"
          },
          {
            "name": "Total per-file",
            "value": 836.1695,
            "unit": "ms",
            "range": 1514.6291316477293,
            "extra": "median: 362.66ms"
          },
          {
            "name": "Static slicing",
            "value": 2.081819258236082,
            "unit": "ms",
            "range": 1.1548219535083475,
            "extra": "median: 0.79ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.22920491106910176,
            "unit": "ms",
            "range": 0.1756532514935937,
            "extra": "median: 0.09ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.325278823092017,
            "unit": "ms",
            "range": 1.2346259246168894,
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
            "value": 0.7891949660994808,
            "unit": "#",
            "extra": "std: 0.1265547989588566"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7665650684287274,
            "unit": "#",
            "extra": "std: 0.13059911524134268"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.19682173295455,
            "unit": "KiB",
            "range": 244.24808975931026,
            "extra": "median: 24.54"
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
          "id": "e03f8209a04870aa9fd67af64ef1d5bd138b0162",
          "message": "[release:minor] Tree-Sitter Engine (Release v2.2.0)",
          "timestamp": "2025-01-16T17:07:49+01:00",
          "tree_id": "81d8ed434124b40723bab15b19f8da577a9e0f50",
          "url": "https://github.com/flowr-analysis/flowr/commit/e03f8209a04870aa9fd67af64ef1d5bd138b0162"
        },
        "date": 1737044788701,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 237.340469,
            "unit": "ms",
            "range": 101.25792335270718,
            "extra": "median: 209.99ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.383973,
            "unit": "ms",
            "range": 30.947120736948584,
            "extra": "median: 8.62ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 71.4282535,
            "unit": "ms",
            "range": 162.8219475614431,
            "extra": "median: 34.82ms"
          },
          {
            "name": "Total per-file",
            "value": 832.0706263636364,
            "unit": "ms",
            "range": 1501.1919143307266,
            "extra": "median: 366.04ms"
          },
          {
            "name": "Static slicing",
            "value": 2.093177807165715,
            "unit": "ms",
            "range": 1.1685812688985486,
            "extra": "median: 0.79ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2254111581963545,
            "unit": "ms",
            "range": 0.17260905973029328,
            "extra": "median: 0.09ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.3333621193005474,
            "unit": "ms",
            "range": 1.2387264166132896,
            "extra": "median: 0.99ms"
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
            "value": 0.7891949660994808,
            "unit": "#",
            "extra": "std: 0.1265547989588566"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7665650684287274,
            "unit": "#",
            "extra": "std: 0.13059911524134268"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.19682173295455,
            "unit": "KiB",
            "range": 244.24808975931026,
            "extra": "median: 24.54"
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
          "id": "a877df7af36cbd777d23162a0e1a009e8687de3a",
          "message": "[release:patch] New Happens-Before Query (Release v2.2.1)",
          "timestamp": "2025-01-16T19:36:36+01:00",
          "tree_id": "24f6ef9b2e4fb3189e7f9d9f381c59bf6af84079",
          "url": "https://github.com/flowr-analysis/flowr/commit/a877df7af36cbd777d23162a0e1a009e8687de3a"
        },
        "date": 1737053864013,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 239.49771736363638,
            "unit": "ms",
            "range": 101.48800821636837,
            "extra": "median: 212.03ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.41336081818182,
            "unit": "ms",
            "range": 30.981566426513265,
            "extra": "median: 8.45ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 68.728513,
            "unit": "ms",
            "range": 151.94316854576633,
            "extra": "median: 33.03ms"
          },
          {
            "name": "Total per-file",
            "value": 837.9476761818181,
            "unit": "ms",
            "range": 1510.9729062977526,
            "extra": "median: 363.72ms"
          },
          {
            "name": "Static slicing",
            "value": 2.0034774339582415,
            "unit": "ms",
            "range": 1.1691051705207822,
            "extra": "median: 0.81ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.22634653062782062,
            "unit": "ms",
            "range": 0.168666676054442,
            "extra": "median: 0.09ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.24374443748002,
            "unit": "ms",
            "range": 1.2384172691894533,
            "extra": "median: 0.99ms"
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
            "value": 0.7891949660994808,
            "unit": "#",
            "extra": "std: 0.1265547989588566"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7665650684287274,
            "unit": "#",
            "extra": "std: 0.13059911524134268"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.19682173295455,
            "unit": "KiB",
            "range": 244.24808975931026,
            "extra": "median: 24.54"
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
          "id": "cd1e1d6eda1935ec0c9e27945414a6f0cc9f6f71",
          "message": "[release:patch] 2.2.2 Robustify tree-sitter Integration, Resolve-Value Query",
          "timestamp": "2025-02-03T22:15:59+01:00",
          "tree_id": "7347ee4a2c6dea354a58609e36800157ad442359",
          "url": "https://github.com/flowr-analysis/flowr/commit/cd1e1d6eda1935ec0c9e27945414a6f0cc9f6f71"
        },
        "date": 1738618613699,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 237.9814539090909,
            "unit": "ms",
            "range": 97.95229307447363,
            "extra": "median: 211.42ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.679691863636364,
            "unit": "ms",
            "range": 32.45838405782471,
            "extra": "median: 8.28ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 67.64750154545455,
            "unit": "ms",
            "range": 144.96851788657736,
            "extra": "median: 32.74ms"
          },
          {
            "name": "Total per-file",
            "value": 824.1138274545455,
            "unit": "ms",
            "range": 1489.0660191444429,
            "extra": "median: 351.77ms"
          },
          {
            "name": "Static slicing",
            "value": 1.983710075239989,
            "unit": "ms",
            "range": 1.146505882737373,
            "extra": "median: 0.69ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.21675917744411632,
            "unit": "ms",
            "range": 0.17056847797686397,
            "extra": "median: 0.09ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.214188830776317,
            "unit": "ms",
            "range": 1.215598614938936,
            "extra": "median: 0.98ms"
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
            "value": 0.7891949660994808,
            "unit": "#",
            "extra": "std: 0.1265547989588566"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7665650684287274,
            "unit": "#",
            "extra": "std: 0.13059911524134268"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.19682173295455,
            "unit": "KiB",
            "range": 244.24808975931026,
            "extra": "median: 24.54"
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
          "id": "dbb424a89673eb3ceb9077854f1545a9bdf4116c",
          "message": "[release:patch] 2.2.3 Improved Documentation, Tree-Sitter with Meta-Information, Minor Bug-Fixes",
          "timestamp": "2025-02-12T17:46:46+01:00",
          "tree_id": "5578ec5eba5c03ad576b45205a32a8467fbcc9de",
          "url": "https://github.com/flowr-analysis/flowr/commit/dbb424a89673eb3ceb9077854f1545a9bdf4116c"
        },
        "date": 1739379897884,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 249.37947845454548,
            "unit": "ms",
            "range": 105.30380577481404,
            "extra": "median: 219.62ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.348843454545452,
            "unit": "ms",
            "range": 31.21973689525943,
            "extra": "median: 8.34ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 68.7544235909091,
            "unit": "ms",
            "range": 147.7956392187733,
            "extra": "median: 33.28ms"
          },
          {
            "name": "Total per-file",
            "value": 844.8489032727273,
            "unit": "ms",
            "range": 1524.1418562737547,
            "extra": "median: 375.19ms"
          },
          {
            "name": "Static slicing",
            "value": 2.025172437645931,
            "unit": "ms",
            "range": 1.1355566492030682,
            "extra": "median: 0.82ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.22742158824395448,
            "unit": "ms",
            "range": 0.17405701360267453,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.268788810036184,
            "unit": "ms",
            "range": 1.203718432905737,
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
            "value": 0.7891949660994808,
            "unit": "#",
            "extra": "std: 0.1265547989588566"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7665650684287274,
            "unit": "#",
            "extra": "std: 0.13059911524134268"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.19682173295455,
            "unit": "KiB",
            "range": 244.24808975931026,
            "extra": "median: 24.54"
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
          "id": "0b7d7a153620a982b5749df49e1ec8a64493628e",
          "message": "[release:patch] 2.2.4 Improved Docs and Dependency Query",
          "timestamp": "2025-02-16T21:03:26+01:00",
          "tree_id": "0d08f609af1a3799ace8492817ea2598d782040c",
          "url": "https://github.com/flowr-analysis/flowr/commit/0b7d7a153620a982b5749df49e1ec8a64493628e"
        },
        "date": 1739737370829,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 219.8331397727273,
            "unit": "ms",
            "range": 118.05329030379379,
            "extra": "median: 185.33ms"
          },
          {
            "name": "Normalize R AST",
            "value": 16.608554545454545,
            "unit": "ms",
            "range": 29.589887508891348,
            "extra": "median: 8.31ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 68.30898054545455,
            "unit": "ms",
            "range": 148.86190655727776,
            "extra": "median: 34.89ms"
          },
          {
            "name": "Total per-file",
            "value": 829.8466064090909,
            "unit": "ms",
            "range": 1485.6941694641866,
            "extra": "median: 366.26ms"
          },
          {
            "name": "Static slicing",
            "value": 2.01480248688826,
            "unit": "ms",
            "range": 1.147302731147461,
            "extra": "median: 0.68ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.21641301306338115,
            "unit": "ms",
            "range": 0.16451794080173227,
            "extra": "median: 0.09ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.2452677253390894,
            "unit": "ms",
            "range": 1.2137038707403303,
            "extra": "median: 0.95ms"
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
            "value": 0.7891949660994808,
            "unit": "#",
            "extra": "std: 0.1265547989588566"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7665650684287274,
            "unit": "#",
            "extra": "std: 0.13059911524134268"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.19682173295455,
            "unit": "KiB",
            "range": 244.24808975931026,
            "extra": "median: 24.54"
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
          "id": "835a7fe83c22f74a0ee757f71b8316aaabd188cf",
          "message": "[release:patch] 2.2.5 Fix: Defer path retrieveal for the REPL",
          "timestamp": "2025-02-17T08:58:39+01:00",
          "tree_id": "c96e6d2e89ee124bf63946bf4f3a181acf9ef09f",
          "url": "https://github.com/flowr-analysis/flowr/commit/835a7fe83c22f74a0ee757f71b8316aaabd188cf"
        },
        "date": 1739780248687,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 209.37409827272728,
            "unit": "ms",
            "range": 94.63290085641789,
            "extra": "median: 183.67ms"
          },
          {
            "name": "Normalize R AST",
            "value": 16.344401636363635,
            "unit": "ms",
            "range": 28.587459561237736,
            "extra": "median: 8.31ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 67.45578359090909,
            "unit": "ms",
            "range": 144.6046451065386,
            "extra": "median: 33.38ms"
          },
          {
            "name": "Total per-file",
            "value": 824.1108532727272,
            "unit": "ms",
            "range": 1483.4958306652798,
            "extra": "median: 357.36ms"
          },
          {
            "name": "Static slicing",
            "value": 1.995247312731515,
            "unit": "ms",
            "range": 1.1205003527484028,
            "extra": "median: 0.77ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.21495540928720192,
            "unit": "ms",
            "range": 0.1666900270838738,
            "extra": "median: 0.09ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.2243696918243674,
            "unit": "ms",
            "range": 1.1801273742829579,
            "extra": "median: 0.98ms"
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
            "value": 0.7891949660994808,
            "unit": "#",
            "extra": "std: 0.1265547989588566"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7665650684287274,
            "unit": "#",
            "extra": "std: 0.13059911524134268"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.19682173295455,
            "unit": "KiB",
            "range": 244.24808975931026,
            "extra": "median: 24.54"
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
          "id": "249a580b3ef3ccb312dd441497fbf826284d47ee",
          "message": "[release:patch] 2.2.6 Dependency Query traces Linked Ids",
          "timestamp": "2025-02-19T08:57:38+01:00",
          "tree_id": "ae91cc47ca0ce353491ce3914ba8783351196c48",
          "url": "https://github.com/flowr-analysis/flowr/commit/249a580b3ef3ccb312dd441497fbf826284d47ee"
        },
        "date": 1739952921481,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 239.5717917272727,
            "unit": "ms",
            "range": 99.25672765490988,
            "extra": "median: 213.38ms"
          },
          {
            "name": "Normalize R AST",
            "value": 16.913839545454547,
            "unit": "ms",
            "range": 30.53266299694853,
            "extra": "median: 8.31ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 67.0688765909091,
            "unit": "ms",
            "range": 141.82075712333187,
            "extra": "median: 32.69ms"
          },
          {
            "name": "Total per-file",
            "value": 825.0898038181818,
            "unit": "ms",
            "range": 1490.7424777316862,
            "extra": "median: 369.67ms"
          },
          {
            "name": "Static slicing",
            "value": 1.9774541835620738,
            "unit": "ms",
            "range": 1.1014809470587688,
            "extra": "median: 0.71ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.22957203057593134,
            "unit": "ms",
            "range": 0.18541006355510256,
            "extra": "median: 0.09ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.2209043595167723,
            "unit": "ms",
            "range": 1.174550742786128,
            "extra": "median: 0.98ms"
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
            "value": 0.7891949660994808,
            "unit": "#",
            "extra": "std: 0.1265547989588566"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7665650684287274,
            "unit": "#",
            "extra": "std: 0.13059911524134268"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.19682173295455,
            "unit": "KiB",
            "range": 244.24808975931026,
            "extra": "median: 24.54"
          }
        ]
      },
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
          "id": "cd8033c600da5ca9fa76d76ddbb8a333eebff0de",
          "message": "[release:patch] 2.2.7 Fix: Value-Resolve and Tree-Sitter Logs",
          "timestamp": "2025-02-19T16:15:30+01:00",
          "tree_id": "e99eb6a373e88c700fb1482c8a485fc9f1946343",
          "url": "https://github.com/flowr-analysis/flowr/commit/cd8033c600da5ca9fa76d76ddbb8a333eebff0de"
        },
        "date": 1739979643370,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 240.4908449090909,
            "unit": "ms",
            "range": 104.2186555025718,
            "extra": "median: 214.87ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.40330290909091,
            "unit": "ms",
            "range": 31.903280358730882,
            "extra": "median: 8.26ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 70.5491439090909,
            "unit": "ms",
            "range": 151.89745460371594,
            "extra": "median: 34.44ms"
          },
          {
            "name": "Total per-file",
            "value": 834.2546192727273,
            "unit": "ms",
            "range": 1527.4182497326065,
            "extra": "median: 354.71ms"
          },
          {
            "name": "Static slicing",
            "value": 1.9835765702948638,
            "unit": "ms",
            "range": 1.1833578342819353,
            "extra": "median: 0.69ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.21701183826725529,
            "unit": "ms",
            "range": 0.16985522688907176,
            "extra": "median: 0.09ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.2140898950646153,
            "unit": "ms",
            "range": 1.2446228472681597,
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
            "value": 0.7891949660994808,
            "unit": "#",
            "extra": "std: 0.1265547989588566"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7665650684287274,
            "unit": "#",
            "extra": "std: 0.13059911524134268"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.19682173295455,
            "unit": "KiB",
            "range": 244.24808975931026,
            "extra": "median: 24.54"
          }
        ]
      },
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
          "id": "70a1add623b504582b9e96fccadfac16682ab4f1",
          "message": "[release:patch] 2.2.8 Lax Parsing Mode for Tree-Sitter",
          "timestamp": "2025-02-19T17:56:51+01:00",
          "tree_id": "36fbb1b610643bc6bec61c54a73a2d34e633b122",
          "url": "https://github.com/flowr-analysis/flowr/commit/70a1add623b504582b9e96fccadfac16682ab4f1"
        },
        "date": 1739985543157,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 241.6829881818182,
            "unit": "ms",
            "range": 102.84856490932792,
            "extra": "median: 214.17ms"
          },
          {
            "name": "Normalize R AST",
            "value": 16.864585136363637,
            "unit": "ms",
            "range": 30.142733655820717,
            "extra": "median: 9.13ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 68.28490422727273,
            "unit": "ms",
            "range": 145.6613117739078,
            "extra": "median: 33.74ms"
          },
          {
            "name": "Total per-file",
            "value": 838.5010799545455,
            "unit": "ms",
            "range": 1530.7161571608492,
            "extra": "median: 370.33ms"
          },
          {
            "name": "Static slicing",
            "value": 1.9985383727639714,
            "unit": "ms",
            "range": 1.0738253822840182,
            "extra": "median: 0.68ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2246633132123404,
            "unit": "ms",
            "range": 0.18201806683552973,
            "extra": "median: 0.09ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.2369360351902343,
            "unit": "ms",
            "range": 1.1472386806830255,
            "extra": "median: 1.04ms"
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
            "value": 0.7891949660994808,
            "unit": "#",
            "extra": "std: 0.1265547989588566"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7665650684287274,
            "unit": "#",
            "extra": "std: 0.13059911524134268"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.19682173295455,
            "unit": "KiB",
            "range": 244.24808975931026,
            "extra": "median: 24.54"
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
          "id": "1f84d99fc4fa1162e8f7a348784b1da07c99710f",
          "message": "[release:patch] 2.2.9 Compressable DFG, Flexible Source",
          "timestamp": "2025-02-21T16:25:06+01:00",
          "tree_id": "d9a49f187f2c82214e4ed249b335fca997ba9745",
          "url": "https://github.com/flowr-analysis/flowr/commit/1f84d99fc4fa1162e8f7a348784b1da07c99710f"
        },
        "date": 1740152585530,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 241.31914259090908,
            "unit": "ms",
            "range": 101.86079986586925,
            "extra": "median: 213.80ms"
          },
          {
            "name": "Normalize R AST",
            "value": 16.88860759090909,
            "unit": "ms",
            "range": 30.41255279383582,
            "extra": "median: 8.36ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 67.22630477272726,
            "unit": "ms",
            "range": 146.59487734027687,
            "extra": "median: 33.73ms"
          },
          {
            "name": "Total per-file",
            "value": 828.2721892272727,
            "unit": "ms",
            "range": 1498.8264336916554,
            "extra": "median: 374.46ms"
          },
          {
            "name": "Static slicing",
            "value": 2.078187586255623,
            "unit": "ms",
            "range": 1.2020496484186058,
            "extra": "median: 0.74ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.22255429831206472,
            "unit": "ms",
            "range": 0.18170703397858795,
            "extra": "median: 0.09ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.3145117357052367,
            "unit": "ms",
            "range": 1.302045742399883,
            "extra": "median: 1.03ms"
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
            "value": 0.7891949660994808,
            "unit": "#",
            "extra": "std: 0.1265547989588566"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7665650684287274,
            "unit": "#",
            "extra": "std: 0.13059911524134268"
          },
          {
            "name": "memory (df-graph)",
            "value": 94.41273082386364,
            "unit": "KiB",
            "range": 242.01994311782988,
            "extra": "median: 24.54"
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
          "id": "bf4bbfb7810c7c20c34ad3e6b1f35aeaa138705d",
          "message": "[release:patch] 2.2.10 Fix: Linking Definitions, setNames",
          "timestamp": "2025-02-23T08:56:16+01:00",
          "tree_id": "b69cfbb2aa5171b0c3e7cd54627a4cf7ed8df916",
          "url": "https://github.com/flowr-analysis/flowr/commit/bf4bbfb7810c7c20c34ad3e6b1f35aeaa138705d"
        },
        "date": 1740298489052,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 241.68971736363636,
            "unit": "ms",
            "range": 103.70077791332173,
            "extra": "median: 212.96ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.183423727272725,
            "unit": "ms",
            "range": 31.637889967272674,
            "extra": "median: 8.15ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 66.7542489090909,
            "unit": "ms",
            "range": 144.93942462917178,
            "extra": "median: 31.59ms"
          },
          {
            "name": "Total per-file",
            "value": 830.8697058181818,
            "unit": "ms",
            "range": 1508.078554353693,
            "extra": "median: 365.64ms"
          },
          {
            "name": "Static slicing",
            "value": 2.0992138934431415,
            "unit": "ms",
            "range": 1.2344853252579722,
            "extra": "median: 0.70ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2248262534723587,
            "unit": "ms",
            "range": 0.1835646077305841,
            "extra": "median: 0.09ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.3380695128574147,
            "unit": "ms",
            "range": 1.3269283571325845,
            "extra": "median: 1.01ms"
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
            "value": 0.7891949660994808,
            "unit": "#",
            "extra": "std: 0.1265547989588566"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7665650684287274,
            "unit": "#",
            "extra": "std: 0.13059911524134268"
          },
          {
            "name": "memory (df-graph)",
            "value": 94.41273082386364,
            "unit": "KiB",
            "range": 242.01994311782988,
            "extra": "median: 24.54"
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
          "message": "Fine tune benchmark plots with new colors, labels, and more (#338)\n\n* ci: cycle colors\r\n\r\n* ci: show commit message name start in benchmarks as well\r\n\r\n* ci-fix: npm script `performance-test` should be able to read arguments :D\r\n\r\n* ci, typo: fix wrong name for uploading of benchmark results\r\n\r\n* ci-fix: add `--` to separatae arguments in `qa.yaml`\r\n\r\n* ci: reset current benchmark data (Release v1.1.4)",
          "timestamp": "2023-09-21T01:44:43+02:00",
          "tree_id": "9f4b37285d7d1eb59c97e553f8fd0766c9bb1b06",
          "url": "https://github.com/flowr-analysis/flowr/commit/20612c4734312e5bbd8963132eb9d25802d2f8a8"
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
          "message": "Fine tune benchmark plots with new colors, labels, and more (#338)\n\n* ci: cycle colors\r\n\r\n* ci: show commit message name start in benchmarks as well\r\n\r\n* ci-fix: npm script `performance-test` should be able to read arguments :D\r\n\r\n* ci, typo: fix wrong name for uploading of benchmark results\r\n\r\n* ci-fix: add `--` to separatae arguments in `qa.yaml`\r\n\r\n* ci: reset current benchmark data (Release v1.1.4)",
          "timestamp": "2023-09-21T01:44:43+02:00",
          "tree_id": "9f4b37285d7d1eb59c97e553f8fd0766c9bb1b06",
          "url": "https://github.com/flowr-analysis/flowr/commit/20612c4734312e5bbd8963132eb9d25802d2f8a8"
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
          "message": "ci-fix: remove `comment-always` from the `github-action-benchmark` action as it seems to simply duplicate the commit (Release v1.1.4)",
          "timestamp": "2023-09-21T07:25:25+02:00",
          "tree_id": "6335e8da9c2187d2a440388c40a1b8b022d8a429",
          "url": "https://github.com/flowr-analysis/flowr/commit/89b3e36c8d362f4c841830bc78a39fe17b375027"
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
          "message": "ci-fix: remove `comment-always` from the `github-action-benchmark` action as it seems to simply duplicate the commit (Release v1.1.4)",
          "timestamp": "2023-09-21T07:25:25+02:00",
          "tree_id": "6335e8da9c2187d2a440388c40a1b8b022d8a429",
          "url": "https://github.com/flowr-analysis/flowr/commit/89b3e36c8d362f4c841830bc78a39fe17b375027"
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
          "message": "ci-fix: remove summary from the social-science graph to avoid double commit (Release v1.1.4)",
          "timestamp": "2023-09-21T09:21:19+02:00",
          "tree_id": "d487002e9ec254edd9cc4b596b0dce914d8cfbbd",
          "url": "https://github.com/flowr-analysis/flowr/commit/05f243e420d0a81a6884f1a65a2003b16af6ef7c"
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
          "id": "127bc834a15a16930038f25587b54cb1422c9df4",
          "message": "Merge benchmark commits into one (#340)\n\nci, refactor: merge benchmark commits into one (Release v1.1.4)",
          "timestamp": "2023-09-21T12:24:40+02:00",
          "tree_id": "180c8b31c7e6d78169d1bd2523ee0a42008906da",
          "url": "https://github.com/flowr-analysis/flowr/commit/127bc834a15a16930038f25587b54cb1422c9df4"
        },
        "date": 1695293613097,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 10353.511371139999,
            "unit": "ms",
            "range": 7945.998317819517,
            "extra": "median: 7004.00ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 1954.34549752,
            "unit": "ms",
            "range": 86.96945974789051,
            "extra": "median: 1910.90ms"
          },
          {
            "name": "Normalize R AST",
            "value": 143.91832563999998,
            "unit": "ms",
            "range": 93.24623858689549,
            "extra": "median: 102.86ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 202.18744424000002,
            "unit": "ms",
            "range": 348.67995633062833,
            "extra": "median: 58.55ms"
          },
          {
            "name": "Total per-slice",
            "value": 11.269991689915706,
            "unit": "ms",
            "range": 19.271245102607832,
            "extra": "median: 8.51ms"
          },
          {
            "name": "Static slicing",
            "value": 10.675190389430906,
            "unit": "ms",
            "range": 19.197254445080794,
            "extra": "median: 7.92ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.5808481126288867,
            "unit": "ms",
            "range": 0.37190554764486994,
            "extra": "median: 0.52ms"
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
          "id": "0fda4c49cd9e2b2191a1b15c137cd78cb08f52aa",
          "message": "[release:patch] Update xmldom Dependency and Benchmarking Support (Release v1.1.5)",
          "timestamp": "2023-09-24T14:13:29+02:00",
          "tree_id": "4ecc81b2e690ba8ac4f1912756542fa125261a27",
          "url": "https://github.com/flowr-analysis/flowr/commit/0fda4c49cd9e2b2191a1b15c137cd78cb08f52aa"
        },
        "date": 1695559899869,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 10167.26307336,
            "unit": "ms",
            "range": 7757.800306249087,
            "extra": "median: 7085.44ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 1922.82903474,
            "unit": "ms",
            "range": 92.0174433869226,
            "extra": "median: 1880.33ms"
          },
          {
            "name": "Normalize R AST",
            "value": 141.65425568,
            "unit": "ms",
            "range": 89.65148388641258,
            "extra": "median: 98.40ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 201.65686672,
            "unit": "ms",
            "range": 343.7900866082758,
            "extra": "median: 58.83ms"
          },
          {
            "name": "Total per-slice",
            "value": 11.122963729868514,
            "unit": "ms",
            "range": 19.02618842149997,
            "extra": "median: 8.40ms"
          },
          {
            "name": "Static slicing",
            "value": 10.547716197918898,
            "unit": "ms",
            "range": 18.9574394872282,
            "extra": "median: 7.82ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.5621520540074592,
            "unit": "ms",
            "range": 0.3531758257800486,
            "extra": "median: 0.50ms"
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
          "id": "77159de13994c94d1a86ebf0db70c0a01067d372",
          "message": "[release:patch] CFG, N-Quads export (Release v1.1.6)",
          "timestamp": "2023-10-10T11:16:02+02:00",
          "tree_id": "4760f5664753b99fdb69e3d5675ba0cef3cf1140",
          "url": "https://github.com/flowr-analysis/flowr/commit/77159de13994c94d1a86ebf0db70c0a01067d372"
        },
        "date": 1696931420717,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 8034.84090942,
            "unit": "ms",
            "range": 9604.625289228263,
            "extra": "median: 4043.53ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 124.82507790000001,
            "unit": "ms",
            "range": 107.9293020348158,
            "extra": "median: 69.31ms"
          },
          {
            "name": "Normalize R AST",
            "value": 179.29568896,
            "unit": "ms",
            "range": 123.44694857133258,
            "extra": "median: 123.87ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 268.54568845999995,
            "unit": "ms",
            "range": 461.57700859286194,
            "extra": "median: 74.02ms"
          },
          {
            "name": "Total per-slice",
            "value": 13.623904308641448,
            "unit": "ms",
            "range": 23.262025184775986,
            "extra": "median: 10.29ms"
          },
          {
            "name": "Static slicing",
            "value": 12.85277434221828,
            "unit": "ms",
            "range": 23.13377314122338,
            "extra": "median: 9.52ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.7582018704904955,
            "unit": "ms",
            "range": 0.488770718926368,
            "extra": "median: 0.66ms"
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
          "id": "a13ba7d57c8f8ca264630109c56e1906e21c2066",
          "message": "[release:minor] Feature Extraction and CFG Export (Release v1.2.0)",
          "timestamp": "2023-10-15T08:56:06+02:00",
          "tree_id": "89e99a6cb66c08dc2c808dd798df9e888c88931c",
          "url": "https://github.com/flowr-analysis/flowr/commit/a13ba7d57c8f8ca264630109c56e1906e21c2066"
        },
        "date": 1697355095607,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 9217.97168212,
            "unit": "ms",
            "range": 11233.23134490305,
            "extra": "median: 4714.38ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 147.46538397999998,
            "unit": "ms",
            "range": 132.5895147714834,
            "extra": "median: 85.85ms"
          },
          {
            "name": "Normalize R AST",
            "value": 193.47818752,
            "unit": "ms",
            "range": 124.29041849585441,
            "extra": "median: 141.72ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 306.41368989999995,
            "unit": "ms",
            "range": 521.6767922234001,
            "extra": "median: 87.94ms"
          },
          {
            "name": "Total per-slice",
            "value": 16.16594832538752,
            "unit": "ms",
            "range": 26.82605591153744,
            "extra": "median: 11.98ms"
          },
          {
            "name": "Static slicing",
            "value": 15.202546042225746,
            "unit": "ms",
            "range": 26.638722260076488,
            "extra": "median: 11.02ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.9461226541249134,
            "unit": "ms",
            "range": 0.6094339586982859,
            "extra": "median: 0.88ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 9,
            "unit": "#",
            "extra": "out of 11316 slices"
          },
          {
            "name": "times hit threshold",
            "value": 967,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8987761232201357,
            "unit": "#",
            "extra": "std: 0.08614052435714427"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8582032343145828,
            "unit": "#",
            "extra": "std: 0.11575735009565753"
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
          "id": "1e9911dfb7b57bba9af2fbc21bb25b7b8a769b63",
          "message": "[release:patch] More Robust Server (Release v1.2.1)",
          "timestamp": "2023-10-18T14:31:58+02:00",
          "tree_id": "c4d6e9b11aa00ac6785f02ca584364bfdf5b52ab",
          "url": "https://github.com/flowr-analysis/flowr/commit/1e9911dfb7b57bba9af2fbc21bb25b7b8a769b63"
        },
        "date": 1697634674497,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 9713.11473926,
            "unit": "ms",
            "range": 11773.545244421579,
            "extra": "median: 4974.89ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 156.08280956000002,
            "unit": "ms",
            "range": 149.55703092829685,
            "extra": "median: 83.12ms"
          },
          {
            "name": "Normalize R AST",
            "value": 200.25081626,
            "unit": "ms",
            "range": 129.3982181467671,
            "extra": "median: 146.30ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 320.69478826,
            "unit": "ms",
            "range": 551.2570090540489,
            "extra": "median: 88.87ms"
          },
          {
            "name": "Total per-slice",
            "value": 16.852776720947936,
            "unit": "ms",
            "range": 28.85478957515023,
            "extra": "median: 12.31ms"
          },
          {
            "name": "Static slicing",
            "value": 15.851951991270107,
            "unit": "ms",
            "range": 28.621227875209645,
            "extra": "median: 11.36ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.9823377155343551,
            "unit": "ms",
            "range": 0.5882086964170495,
            "extra": "median: 0.89ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 9,
            "unit": "#",
            "extra": "out of 11316 slices"
          },
          {
            "name": "times hit threshold",
            "value": 967,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8987761232201357,
            "unit": "#",
            "extra": "std: 0.08614052435714427"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8582032343145828,
            "unit": "#",
            "extra": "std: 0.11575735009565753"
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
          "id": "ef6b5bc18f7145ba61f75b43ed973d5f961ce670",
          "message": "[release:patch] Include character counts in meta statistics (Release v1.3.1)",
          "timestamp": "2023-11-02T13:39:16+01:00",
          "tree_id": "48744a8fc8d41b2b0740b8b7b4ccf7b4ca9c388c",
          "url": "https://github.com/flowr-analysis/flowr/commit/ef6b5bc18f7145ba61f75b43ed973d5f961ce670"
        },
        "date": 1698930900376,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 8783.45502014,
            "unit": "ms",
            "range": 10738.891531340689,
            "extra": "median: 4452.32ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 136.40897754,
            "unit": "ms",
            "range": 126.93000424816188,
            "extra": "median: 66.48ms"
          },
          {
            "name": "Normalize R AST",
            "value": 186.37888664,
            "unit": "ms",
            "range": 124.71433128113007,
            "extra": "median: 137.21ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 289.51431136,
            "unit": "ms",
            "range": 482.3141635134121,
            "extra": "median: 86.46ms"
          },
          {
            "name": "Total per-slice",
            "value": 15.525487126197506,
            "unit": "ms",
            "range": 25.375808817534253,
            "extra": "median: 11.48ms"
          },
          {
            "name": "Static slicing",
            "value": 14.648966841272854,
            "unit": "ms",
            "range": 25.183235462545703,
            "extra": "median: 10.65ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.8578698127083991,
            "unit": "ms",
            "range": 0.6532316473694225,
            "extra": "median: 0.74ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 9,
            "unit": "#",
            "extra": "out of 11316 slices"
          },
          {
            "name": "times hit threshold",
            "value": 967,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8987761232201357,
            "unit": "#",
            "extra": "std: 0.08614052435714427"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8582032343145828,
            "unit": "#",
            "extra": "std: 0.11575735009565753"
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
          "id": "266b087710648b96b1779436aee32a0c47ac80cd",
          "message": "[release:patch] Robustness against encoding errors (Release v1.3.2)",
          "timestamp": "2023-11-03T20:54:13+01:00",
          "tree_id": "c245f343a8ef43765a4f36f2aad48763dc77d6b3",
          "url": "https://github.com/flowr-analysis/flowr/commit/266b087710648b96b1779436aee32a0c47ac80cd"
        },
        "date": 1699043094505,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 6628.01911806,
            "unit": "ms",
            "range": 7920.64451462989,
            "extra": "median: 3245.55ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 99.94474708,
            "unit": "ms",
            "range": 91.9298826769113,
            "extra": "median: 49.64ms"
          },
          {
            "name": "Normalize R AST",
            "value": 145.95498125999998,
            "unit": "ms",
            "range": 97.05366533791602,
            "extra": "median: 107.15ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 202.67506718,
            "unit": "ms",
            "range": 350.35799969129454,
            "extra": "median: 57.78ms"
          },
          {
            "name": "Total per-slice",
            "value": 11.209356158365976,
            "unit": "ms",
            "range": 19.217066969533313,
            "extra": "median: 8.28ms"
          },
          {
            "name": "Static slicing",
            "value": 10.588980339286781,
            "unit": "ms",
            "range": 19.12716492275005,
            "extra": "median: 7.68ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.6050062891914059,
            "unit": "ms",
            "range": 0.3596537358962295,
            "extra": "median: 0.54ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 9,
            "unit": "#",
            "extra": "out of 11316 slices"
          },
          {
            "name": "times hit threshold",
            "value": 967,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8987761232201357,
            "unit": "#",
            "extra": "std: 0.08614052435714427"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8582032343145828,
            "unit": "#",
            "extra": "std: 0.11575735009565753"
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
          "id": "243959c2f01ddf928c85ee4905105307971ad19b",
          "message": "[release:patch] Robustify Quad Export Against Cyclic Structures (Release v1.3.3)",
          "timestamp": "2023-11-10T18:59:51+01:00",
          "tree_id": "8e5af22f7b39483e95e62308330a5e9e002ba57a",
          "url": "https://github.com/flowr-analysis/flowr/commit/243959c2f01ddf928c85ee4905105307971ad19b"
        },
        "date": 1699640654242,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 5419.399718899999,
            "unit": "ms",
            "range": 6111.491408384184,
            "extra": "median: 2837.80ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 85.22318365999999,
            "unit": "ms",
            "range": 79.41151212889127,
            "extra": "median: 46.48ms"
          },
          {
            "name": "Normalize R AST",
            "value": 113.45254984,
            "unit": "ms",
            "range": 69.72126242848063,
            "extra": "median: 83.08ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 164.38322226,
            "unit": "ms",
            "range": 279.00889908327076,
            "extra": "median: 48.09ms"
          },
          {
            "name": "Total per-slice",
            "value": 8.82827828085479,
            "unit": "ms",
            "range": 14.575511768060265,
            "extra": "median: 6.59ms"
          },
          {
            "name": "Static slicing",
            "value": 8.228727295296194,
            "unit": "ms",
            "range": 14.45423896853327,
            "extra": "median: 6.01ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.5898725311439794,
            "unit": "ms",
            "range": 0.30780610835907124,
            "extra": "median: 0.55ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 9,
            "unit": "#",
            "extra": "out of 11316 slices"
          },
          {
            "name": "times hit threshold",
            "value": 967,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8987761232201357,
            "unit": "#",
            "extra": "std: 0.08614052435714427"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8582032343145828,
            "unit": "#",
            "extra": "std: 0.11575735009565753"
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
          "id": "c209d78300f23960363beb046efd2b07a0a5531d",
          "message": "[release:patch] Allow Strings as Names for Function Call Arguments (Release v1.3.4)",
          "timestamp": "2023-11-22T13:22:53+01:00",
          "tree_id": "a052c400e622d7062e4ff675a07f088883eaccee",
          "url": "https://github.com/flowr-analysis/flowr/commit/c209d78300f23960363beb046efd2b07a0a5531d"
        },
        "date": 1700657321110,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 5464.289228619999,
            "unit": "ms",
            "range": 6098.39318648839,
            "extra": "median: 2862.32ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 86.76445109999999,
            "unit": "ms",
            "range": 77.45681339952834,
            "extra": "median: 48.72ms"
          },
          {
            "name": "Normalize R AST",
            "value": 113.78691086,
            "unit": "ms",
            "range": 69.64981912121678,
            "extra": "median: 81.94ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 166.90590034000002,
            "unit": "ms",
            "range": 285.57711744755056,
            "extra": "median: 46.13ms"
          },
          {
            "name": "Total per-slice",
            "value": 8.863963769870134,
            "unit": "ms",
            "range": 14.566635289387673,
            "extra": "median: 6.61ms"
          },
          {
            "name": "Static slicing",
            "value": 8.249822291669334,
            "unit": "ms",
            "range": 14.448470605228648,
            "extra": "median: 6.01ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.6040326772298797,
            "unit": "ms",
            "range": 0.31033593750624766,
            "extra": "median: 0.57ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 9,
            "unit": "#",
            "extra": "out of 11321 slices"
          },
          {
            "name": "times hit threshold",
            "value": 967,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.898713819973478,
            "unit": "#",
            "extra": "std: 0.08614825965194707"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8579790415512589,
            "unit": "#",
            "extra": "std: 0.11594939184257376"
          }
        ]
      },
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
          "id": "7cef37c8fb8e93c1e22647fa0efed2c1ddcf21a9",
          "message": "[release:patch] Quads With Repeated Edge Types (Release v1.3.5)",
          "timestamp": "2023-12-08T15:24:04+01:00",
          "tree_id": "e7a3ab3994be6ef3dfd8e8b13a4957bbfe0242b5",
          "url": "https://github.com/flowr-analysis/flowr/commit/7cef37c8fb8e93c1e22647fa0efed2c1ddcf21a9"
        },
        "date": 1702046953709,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 5547.87590246,
            "unit": "ms",
            "range": 5808.9007657238435,
            "extra": "median: 3142.30ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 83.26392776,
            "unit": "ms",
            "range": 74.69286976317407,
            "extra": "median: 48.41ms"
          },
          {
            "name": "Normalize R AST",
            "value": 114.04236388,
            "unit": "ms",
            "range": 68.66664360803951,
            "extra": "median: 82.39ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 165.24087462,
            "unit": "ms",
            "range": 281.0471116203503,
            "extra": "median: 48.28ms"
          },
          {
            "name": "Total per-slice",
            "value": 8.55444112926569,
            "unit": "ms",
            "range": 14.175433877418497,
            "extra": "median: 6.35ms"
          },
          {
            "name": "Static slicing",
            "value": 8.023095687643547,
            "unit": "ms",
            "range": 14.039065545508109,
            "extra": "median: 5.86ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.5223300878196391,
            "unit": "ms",
            "range": 0.27511931827473707,
            "extra": "median: 0.46ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 9,
            "unit": "#",
            "extra": "out of 11321 slices"
          },
          {
            "name": "times hit threshold",
            "value": 967,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.898713819973478,
            "unit": "#",
            "extra": "std: 0.08614825965194707"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8579790415512589,
            "unit": "#",
            "extra": "std: 0.11594939184257376"
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
          "id": "5d9e4d36fce917d72f382c8cc441ce576baf18a6",
          "message": "[release:patch] Using Next in RDF Quads (Release v1.3.6)",
          "timestamp": "2023-12-13T13:59:30+01:00",
          "tree_id": "c9aa3c29b811c7d73cc287b2a5f9e89f06951cd9",
          "url": "https://github.com/flowr-analysis/flowr/commit/5d9e4d36fce917d72f382c8cc441ce576baf18a6"
        },
        "date": 1702473795124,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 5495.98474754,
            "unit": "ms",
            "range": 6144.791977946316,
            "extra": "median: 2917.26ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 87.9300398,
            "unit": "ms",
            "range": 82.31171038319312,
            "extra": "median: 47.12ms"
          },
          {
            "name": "Normalize R AST",
            "value": 116.14717965999999,
            "unit": "ms",
            "range": 71.95088143645037,
            "extra": "median: 86.06ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 167.8961487,
            "unit": "ms",
            "range": 286.86269934169644,
            "extra": "median: 48.72ms"
          },
          {
            "name": "Total per-slice",
            "value": 8.831731593745403,
            "unit": "ms",
            "range": 14.580007239439105,
            "extra": "median: 6.58ms"
          },
          {
            "name": "Static slicing",
            "value": 8.226681299611007,
            "unit": "ms",
            "range": 14.452727478186006,
            "extra": "median: 5.98ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.5949460157048858,
            "unit": "ms",
            "range": 0.32814023555695415,
            "extra": "median: 0.56ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 9,
            "unit": "#",
            "extra": "out of 11321 slices"
          },
          {
            "name": "times hit threshold",
            "value": 967,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.898713819973478,
            "unit": "#",
            "extra": "std: 0.08614825965194707"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8579790415512589,
            "unit": "#",
            "extra": "std: 0.11594939184257376"
          }
        ]
      },
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
          "id": "c148955f1c3a57e08545baa6a94b58c9124b4613",
          "message": "[release:patch] Demo File for Presentations (Release v1.3.7)",
          "timestamp": "2024-01-04T09:31:14+01:00",
          "tree_id": "952d243e0eef028eb0fc52f25ccac831253d9f17",
          "url": "https://github.com/flowr-analysis/flowr/commit/c148955f1c3a57e08545baa6a94b58c9124b4613"
        },
        "date": 1704358482215,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 5299.04631092,
            "unit": "ms",
            "range": 5949.936560017347,
            "extra": "median: 2829.15ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 83.68679132,
            "unit": "ms",
            "range": 73.7801235231147,
            "extra": "median: 45.86ms"
          },
          {
            "name": "Normalize R AST",
            "value": 114.06245784000001,
            "unit": "ms",
            "range": 68.14560113212112,
            "extra": "median: 83.72ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 163.93117192,
            "unit": "ms",
            "range": 280.35389486139917,
            "extra": "median: 45.01ms"
          },
          {
            "name": "Total per-slice",
            "value": 8.620094841233877,
            "unit": "ms",
            "range": 14.21744467164844,
            "extra": "median: 6.41ms"
          },
          {
            "name": "Static slicing",
            "value": 8.074770025618278,
            "unit": "ms",
            "range": 14.080844460663188,
            "extra": "median: 5.91ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.536541978843609,
            "unit": "ms",
            "range": 0.29920637505319564,
            "extra": "median: 0.48ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 9,
            "unit": "#",
            "extra": "out of 11321 slices"
          },
          {
            "name": "times hit threshold",
            "value": 967,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.898713819973478,
            "unit": "#",
            "extra": "std: 0.08614825965194707"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8579790415512589,
            "unit": "#",
            "extra": "std: 0.11594939184257376"
          }
        ]
      },
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
          "id": "4b9d841139c45af7a2e50de57bf454b4d98dcd34",
          "message": "[release:patch] Publish NPM to own namespace (Release v1.3.12)",
          "timestamp": "2024-01-04T16:44:38+01:00",
          "tree_id": "3af219dac7ab8e8aeff5ce9aaec1f1b45f9d32bb",
          "url": "https://github.com/flowr-analysis/flowr/commit/4b9d841139c45af7a2e50de57bf454b4d98dcd34"
        },
        "date": 1704384537083,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 5630.90276288,
            "unit": "ms",
            "range": 6189.977079365194,
            "extra": "median: 3025.94ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 88.74249856,
            "unit": "ms",
            "range": 79.36546677463602,
            "extra": "median: 50.12ms"
          },
          {
            "name": "Normalize R AST",
            "value": 115.71117578,
            "unit": "ms",
            "range": 70.51500122311208,
            "extra": "median: 84.48ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 167.23523491999998,
            "unit": "ms",
            "range": 284.0799259585442,
            "extra": "median: 48.06ms"
          },
          {
            "name": "Total per-slice",
            "value": 8.964610417036198,
            "unit": "ms",
            "range": 14.770407700550463,
            "extra": "median: 6.76ms"
          },
          {
            "name": "Static slicing",
            "value": 8.327410223106314,
            "unit": "ms",
            "range": 14.653312758833414,
            "extra": "median: 6.11ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.6271384692131352,
            "unit": "ms",
            "range": 0.2941281386739033,
            "extra": "median: 0.60ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 9,
            "unit": "#",
            "extra": "out of 11321 slices"
          },
          {
            "name": "times hit threshold",
            "value": 967,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.898713819973478,
            "unit": "#",
            "extra": "std: 0.08614825965194707"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8579790415512589,
            "unit": "#",
            "extra": "std: 0.11594939184257376"
          }
        ]
      },
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
          "id": "2e17bd230fd0762e103508098f5fb1fa3d565d46",
          "message": "[release:patch] Update NPM Package Dependencies (Release v1.3.13)",
          "timestamp": "2024-01-13T14:09:36+01:00",
          "tree_id": "81a22dece7b6bc2454b2f78cc3dd742fa9b690fa",
          "url": "https://github.com/flowr-analysis/flowr/commit/2e17bd230fd0762e103508098f5fb1fa3d565d46"
        },
        "date": 1705152648795,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 5067.11699072,
            "unit": "ms",
            "range": 6013.966295548738,
            "extra": "median: 2670.34ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 72.89874598,
            "unit": "ms",
            "range": 65.47213185510104,
            "extra": "median: 39.87ms"
          },
          {
            "name": "Normalize R AST",
            "value": 112.63807184000001,
            "unit": "ms",
            "range": 69.0681140265212,
            "extra": "median: 81.00ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 163.4963136,
            "unit": "ms",
            "range": 275.2982409802191,
            "extra": "median: 47.68ms"
          },
          {
            "name": "Total per-slice",
            "value": 8.727472260919003,
            "unit": "ms",
            "range": 14.4602468429054,
            "extra": "median: 6.54ms"
          },
          {
            "name": "Static slicing",
            "value": 8.21931140277668,
            "unit": "ms",
            "range": 14.341926068785162,
            "extra": "median: 6.04ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.4984137426920286,
            "unit": "ms",
            "range": 0.24500938778272444,
            "extra": "median: 0.44ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 9,
            "unit": "#",
            "extra": "out of 11321 slices"
          },
          {
            "name": "times hit threshold",
            "value": 967,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.898713819973478,
            "unit": "#",
            "extra": "std: 0.08614825965194707"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8579790415512589,
            "unit": "#",
            "extra": "std: 0.11594939184257376"
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
          "id": "816c844036b361042c26d2af07b4d092e66b46fb",
          "message": "[release:patch] Drop readlines/promises Dependency (Release v1.3.14)",
          "timestamp": "2024-01-15T23:29:47+01:00",
          "tree_id": "2383d566e88ea2e0dbe60dd73f7d7b92b3093407",
          "url": "https://github.com/flowr-analysis/flowr/commit/816c844036b361042c26d2af07b4d092e66b46fb"
        },
        "date": 1705359156307,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 5046.89271988,
            "unit": "ms",
            "range": 6042.128928598865,
            "extra": "median: 2559.91ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 73.85860644,
            "unit": "ms",
            "range": 69.28452321715349,
            "extra": "median: 37.89ms"
          },
          {
            "name": "Normalize R AST",
            "value": 114.01183648,
            "unit": "ms",
            "range": 69.33746165288669,
            "extra": "median: 81.81ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 163.82888334,
            "unit": "ms",
            "range": 279.6344141597903,
            "extra": "median: 47.81ms"
          },
          {
            "name": "Total per-slice",
            "value": 8.618077094909866,
            "unit": "ms",
            "range": 14.411839324447698,
            "extra": "median: 6.42ms"
          },
          {
            "name": "Static slicing",
            "value": 8.092352677712956,
            "unit": "ms",
            "range": 14.275084427627904,
            "extra": "median: 5.94ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.5170374517553479,
            "unit": "ms",
            "range": 0.28554733887508554,
            "extra": "median: 0.46ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 9,
            "unit": "#",
            "extra": "out of 11321 slices"
          },
          {
            "name": "times hit threshold",
            "value": 967,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.898713819973478,
            "unit": "#",
            "extra": "std: 0.08614825965194707"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8579790415512589,
            "unit": "#",
            "extra": "std: 0.11594939184257376"
          }
        ]
      },
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
          "id": "d69018e52ccd36d2a4c6749a259bc7347a5c8a5d",
          "message": "[release:patch] npm for WebSocket Server (Release v1.4.1)",
          "timestamp": "2024-01-31T15:39:17+01:00",
          "tree_id": "e208ae0ae2bb451ea46ccc05df594033cd4f95bc",
          "url": "https://github.com/flowr-analysis/flowr/commit/d69018e52ccd36d2a4c6749a259bc7347a5c8a5d"
        },
        "date": 1706713172666,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 3566.86774236,
            "unit": "ms",
            "range": 5920.286185213901,
            "extra": "median: 1072.56ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 72.22227936,
            "unit": "ms",
            "range": 60.97026629229811,
            "extra": "median: 43.58ms"
          },
          {
            "name": "Normalize R AST",
            "value": 113.02594858,
            "unit": "ms",
            "range": 70.71306906384982,
            "extra": "median: 80.14ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 163.44175874,
            "unit": "ms",
            "range": 276.9623037407309,
            "extra": "median: 48.05ms"
          },
          {
            "name": "Run abstract interpretation",
            "value": 0.06162254,
            "unit": "ms",
            "range": 0.02971958909151336,
            "extra": "median: 0.06ms"
          },
          {
            "name": "Total per-slice",
            "value": 8.599255365044066,
            "unit": "ms",
            "range": 14.312877376595168,
            "extra": "median: 6.34ms"
          },
          {
            "name": "Static slicing",
            "value": 8.071953766135923,
            "unit": "ms",
            "range": 14.188089279803133,
            "extra": "median: 5.84ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.5187709959800451,
            "unit": "ms",
            "range": 0.27627204677573897,
            "extra": "median: 0.46ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 9,
            "unit": "#",
            "extra": "out of 11321 slices"
          },
          {
            "name": "times hit threshold",
            "value": 967,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.898713819973478,
            "unit": "#",
            "extra": "std: 0.08614825965194707"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8579790415512589,
            "unit": "#",
            "extra": "std: 0.11594939184257376"
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
          "id": "78da42c867266e8832933ba9bcd2e1bc3951d5f9",
          "message": "[release:patch] Dropping xmlparsedata, Benchmark Re-Runs, and Repl Fixes (Release v1.4.2)",
          "timestamp": "2024-03-17T22:21:47+01:00",
          "tree_id": "3f3bb3107a47ce4ffee7f569cb902e0c641dbe60",
          "url": "https://github.com/flowr-analysis/flowr/commit/78da42c867266e8832933ba9bcd2e1bc3951d5f9"
        },
        "date": 1710711452839,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 314.59240092,
            "unit": "ms",
            "range": 0,
            "extra": "median: 314.59ms"
          },
          {
            "name": "Normalize R AST",
            "value": 34.330948840000005,
            "unit": "ms",
            "range": 0,
            "extra": "median: 34.33ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 183.7401157,
            "unit": "ms",
            "range": 0,
            "extra": "median: 183.74ms"
          },
          {
            "name": "Total per-file",
            "value": 3711.77919708,
            "unit": "ms",
            "range": 0,
            "extra": "median: 3711.78ms"
          },
          {
            "name": "Static slicing",
            "value": 8.640449953634949,
            "unit": "ms",
            "range": 14.893197269568514,
            "extra": "median: 6.26ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.49011368492753077,
            "unit": "ms",
            "range": 0.2360399526962079,
            "extra": "median: 0.44ms"
          },
          {
            "name": "Total per-slice",
            "value": 9.139501453399692,
            "unit": "ms",
            "range": 15.009902173338167,
            "extra": "median: 6.75ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 7,
            "unit": "#",
            "extra": "out of 988 slices"
          },
          {
            "name": "times hit threshold",
            "value": 298,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8935817303062389,
            "unit": "#",
            "extra": "std: 0.0919375252942165"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8531248144961375,
            "unit": "#",
            "extra": "std: 0.11962978374069927"
          }
        ]
      },
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
          "id": "1e5ddeb7a95d9191d401a3c3bacce978d16b0075",
          "message": "[release:patch] Completed Declutter of flowr (Release v1.5.2)",
          "timestamp": "2024-04-05T17:19:28+02:00",
          "tree_id": "b3d73e6ef022921d7e9367296525a7389e976aa4",
          "url": "https://github.com/flowr-analysis/flowr/commit/1e5ddeb7a95d9191d401a3c3bacce978d16b0075"
        },
        "date": 1712331740598,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 330.55613118,
            "unit": "ms",
            "range": 0,
            "extra": "median: 330.56ms"
          },
          {
            "name": "Normalize R AST",
            "value": 36.10837608,
            "unit": "ms",
            "range": 0,
            "extra": "median: 36.11ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 188.6117503,
            "unit": "ms",
            "range": 0,
            "extra": "median: 188.61ms"
          },
          {
            "name": "Total per-file",
            "value": 3858.78617088,
            "unit": "ms",
            "range": 0,
            "extra": "median: 3858.79ms"
          },
          {
            "name": "Static slicing",
            "value": 8.763488287471356,
            "unit": "ms",
            "range": 15.142795018273485,
            "extra": "median: 6.38ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.6295735167403027,
            "unit": "ms",
            "range": 0.28826473087031307,
            "extra": "median: 0.62ms"
          },
          {
            "name": "Total per-slice",
            "value": 9.403718790030862,
            "unit": "ms",
            "range": 15.25727767695505,
            "extra": "median: 7.04ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 7,
            "unit": "#",
            "extra": "out of 988 slices"
          },
          {
            "name": "times hit threshold",
            "value": 298,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8935817303062389,
            "unit": "#",
            "extra": "std: 0.0919375252942165"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8531248144961375,
            "unit": "#",
            "extra": "std: 0.11962978374069927"
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
          "id": "0e655150b7b2a4064640d9f4d1da8292c2ddc1c0",
          "message": "[release:major] Dataflow v2 (Release v2.0.0)",
          "timestamp": "2024-05-11T23:33:15+02:00",
          "tree_id": "076a1a4d0811c48b8d5b1772f553266db1b1df6f",
          "url": "https://github.com/flowr-analysis/flowr/commit/0e655150b7b2a4064640d9f4d1da8292c2ddc1c0"
        },
        "date": 1715463948018,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 239.93236378,
            "unit": "ms",
            "range": 0,
            "extra": "median: 239.93ms"
          },
          {
            "name": "Normalize R AST",
            "value": 32.316517940000004,
            "unit": "ms",
            "range": 0,
            "extra": "median: 32.32ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 82.86663146,
            "unit": "ms",
            "range": 0,
            "extra": "median: 82.87ms"
          },
          {
            "name": "Total per-file",
            "value": 2708.2384036599997,
            "unit": "ms",
            "range": 0,
            "extra": "median: 2708.24ms"
          },
          {
            "name": "Static slicing",
            "value": 5.494413213093118,
            "unit": "ms",
            "range": 10.284982890298208,
            "extra": "median: 3.15ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.36979232064013845,
            "unit": "ms",
            "range": 0.19866379648274377,
            "extra": "median: 0.32ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.8734746720326,
            "unit": "ms",
            "range": 10.356188443845689,
            "extra": "median: 3.52ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 2,
            "unit": "#",
            "extra": "out of 1054 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.9241844105867956,
            "unit": "#",
            "extra": "std: 0.09300218811319369"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8924953600737399,
            "unit": "#",
            "extra": "std: 0.13307655364098295"
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
          "id": "eddce744a32324cab8a47397de625e142cb26a91",
          "message": "[release:patch] Drop `node:` prefix from dependencies (Release v2.0.1)",
          "timestamp": "2024-05-12T00:38:09+02:00",
          "tree_id": "f33b1f4a06829b8f849c4229bf9855e38270193d",
          "url": "https://github.com/flowr-analysis/flowr/commit/eddce744a32324cab8a47397de625e142cb26a91"
        },
        "date": 1715467769258,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 236.60308994,
            "unit": "ms",
            "range": 0,
            "extra": "median: 236.60ms"
          },
          {
            "name": "Normalize R AST",
            "value": 31.77161632,
            "unit": "ms",
            "range": 0,
            "extra": "median: 31.77ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 81.86384715999999,
            "unit": "ms",
            "range": 0,
            "extra": "median: 81.86ms"
          },
          {
            "name": "Total per-file",
            "value": 2674.55292236,
            "unit": "ms",
            "range": 0,
            "extra": "median: 2674.55ms"
          },
          {
            "name": "Static slicing",
            "value": 5.448939336693711,
            "unit": "ms",
            "range": 10.154387662460568,
            "extra": "median: 3.13ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.35616079097800935,
            "unit": "ms",
            "range": 0.1827576285958724,
            "extra": "median: 0.31ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.814113487370482,
            "unit": "ms",
            "range": 10.211794878365124,
            "extra": "median: 3.49ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 2,
            "unit": "#",
            "extra": "out of 1054 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.9241844105867956,
            "unit": "#",
            "extra": "std: 0.09300218811319369"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8924953600737399,
            "unit": "#",
            "extra": "std: 0.13307655364098295"
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
          "id": "d22453ad5b876eaffda4b7595db678f8e426493b",
          "message": "[release:patch] Fixing Control-Flow, Markdown-Exports, and Handling of Unnamed Closures (Release v2.0.2)",
          "timestamp": "2024-05-28T17:35:51+02:00",
          "tree_id": "0f59a79dfa984998f6ebf263b3656546a6088458",
          "url": "https://github.com/flowr-analysis/flowr/commit/d22453ad5b876eaffda4b7595db678f8e426493b"
        },
        "date": 1716911273594,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 247.43381508000002,
            "unit": "ms",
            "range": 0,
            "extra": "median: 223.86ms"
          },
          {
            "name": "Normalize R AST",
            "value": 33.4230567,
            "unit": "ms",
            "range": 0,
            "extra": "median: 19.60ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 85.83065882,
            "unit": "ms",
            "range": 0,
            "extra": "median: 34.07ms"
          },
          {
            "name": "Total per-file",
            "value": 2777.5929095,
            "unit": "ms",
            "range": 0,
            "extra": "median: 741.09ms"
          },
          {
            "name": "Static slicing",
            "value": 5.5137404737607545,
            "unit": "ms",
            "range": 10.327216642720945,
            "extra": "median: 1.68ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.43471190543086874,
            "unit": "ms",
            "range": 0.2334928148723243,
            "extra": "median: 0.20ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.958018194733382,
            "unit": "ms",
            "range": 10.414870484304286,
            "extra": "median: 2.11ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 2,
            "unit": "#",
            "extra": "out of 1054 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.9244759792036856,
            "unit": "#",
            "extra": "std: 0.09247519780429117"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8924953600737399,
            "unit": "#",
            "extra": "std: 0.13307655364098295"
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
          "id": "7462f093ba274f5b5a43541dff95acfb36b44133",
          "message": "[release:patch] Fine-Grained Benchmarks (Release v2.0.3)",
          "timestamp": "2024-06-02T01:28:31+02:00",
          "tree_id": "4fe2a786a66b2863b953662c0179d11e7fce64dc",
          "url": "https://github.com/flowr-analysis/flowr/commit/7462f093ba274f5b5a43541dff95acfb36b44133"
        },
        "date": 1717285175222,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 237.49947566,
            "unit": "ms",
            "range": 42.59419668004059,
            "extra": "median: 218.81ms"
          },
          {
            "name": "Normalize R AST",
            "value": 32.3657585,
            "unit": "ms",
            "range": 26.029966595862636,
            "extra": "median: 20.34ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 80.4003074,
            "unit": "ms",
            "range": 93.5950491199757,
            "extra": "median: 31.69ms"
          },
          {
            "name": "Total per-file",
            "value": 2651.33203514,
            "unit": "ms",
            "range": 4647.144426196837,
            "extra": "median: 719.22ms"
          },
          {
            "name": "Static slicing",
            "value": 5.328150052631018,
            "unit": "ms",
            "range": 10.022508311211684,
            "extra": "median: 1.63ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.35697670196500186,
            "unit": "ms",
            "range": 0.17310803237800013,
            "extra": "median: 0.18ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.693765915154062,
            "unit": "ms",
            "range": 10.079165272048721,
            "extra": "median: 1.94ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 2,
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
            "value": 0.9244759792036856,
            "unit": "#",
            "extra": "std: 0.09247519780429117"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8924953600737399,
            "unit": "#",
            "extra": "std: 0.13307655364098295"
          },
          {
            "name": "memory (df-graph)",
            "value": 165.02990234375,
            "unit": "KiB",
            "range": 166.4547496663315,
            "extra": "median: 82.24"
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
          "id": "f52a2e4651cfb3a8a8abc910d5736243f7c4dd0c",
          "message": "[release:patch] Fix: Supply ref for Benchmark Reports (Release v2.0.4)",
          "timestamp": "2024-06-02T12:20:41+02:00",
          "tree_id": "c4eb733ab79584ed9a08bf5b99902613beeb4eaa",
          "url": "https://github.com/flowr-analysis/flowr/commit/f52a2e4651cfb3a8a8abc910d5736243f7c4dd0c"
        },
        "date": 1717324356386,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 241.88627104,
            "unit": "ms",
            "range": 45.2868726464018,
            "extra": "median: 221.49ms"
          },
          {
            "name": "Normalize R AST",
            "value": 31.99510546,
            "unit": "ms",
            "range": 26.718151376328738,
            "extra": "median: 20.08ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 82.05211870000001,
            "unit": "ms",
            "range": 94.49576348214671,
            "extra": "median: 31.77ms"
          },
          {
            "name": "Total per-file",
            "value": 2693.7223885999997,
            "unit": "ms",
            "range": 4729.730280126149,
            "extra": "median: 748.69ms"
          },
          {
            "name": "Static slicing",
            "value": 5.392054102896612,
            "unit": "ms",
            "range": 10.20499629608879,
            "extra": "median: 1.58ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.3777515626188115,
            "unit": "ms",
            "range": 0.19715577691579164,
            "extra": "median: 0.19ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.778710742797366,
            "unit": "ms",
            "range": 10.280404788122235,
            "extra": "median: 1.95ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 2,
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
            "value": 0.9244759792036856,
            "unit": "#",
            "extra": "std: 0.09247519780429117"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8924953600737399,
            "unit": "#",
            "extra": "std: 0.13307655364098295"
          },
          {
            "name": "memory (df-graph)",
            "value": 165.02990234375,
            "unit": "KiB",
            "range": 166.4547496663315,
            "extra": "median: 82.24"
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
          "id": "fb3aeb716a5945a820d37df8341ea431a5fcd462",
          "message": "[release:patch] Support for R 3.6.0 (Release v2.0.5)",
          "timestamp": "2024-06-02T16:05:52+02:00",
          "tree_id": "49c7c72a37e1403900352f0acbcc48ce3fe3680d",
          "url": "https://github.com/flowr-analysis/flowr/commit/fb3aeb716a5945a820d37df8341ea431a5fcd462"
        },
        "date": 1717337873451,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 238.89170294,
            "unit": "ms",
            "range": 42.902488939054926,
            "extra": "median: 220.02ms"
          },
          {
            "name": "Normalize R AST",
            "value": 32.10603632,
            "unit": "ms",
            "range": 26.03502508335503,
            "extra": "median: 20.01ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 80.52452195999999,
            "unit": "ms",
            "range": 91.67209930945589,
            "extra": "median: 33.71ms"
          },
          {
            "name": "Total per-file",
            "value": 2660.9765168000004,
            "unit": "ms",
            "range": 4677.712175156626,
            "extra": "median: 717.48ms"
          },
          {
            "name": "Static slicing",
            "value": 5.329788050262995,
            "unit": "ms",
            "range": 10.08024898232618,
            "extra": "median: 1.62ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.36270209414825477,
            "unit": "ms",
            "range": 0.17813340938938396,
            "extra": "median: 0.17ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.701240429907604,
            "unit": "ms",
            "range": 10.144487161307138,
            "extra": "median: 1.99ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 2,
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
            "value": 0.9244759792036856,
            "unit": "#",
            "extra": "std: 0.09247519780429117"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8924953600737399,
            "unit": "#",
            "extra": "std: 0.13307655364098295"
          },
          {
            "name": "memory (df-graph)",
            "value": 165.02990234375,
            "unit": "KiB",
            "range": 166.4547496663315,
            "extra": "median: 82.24"
          }
        ]
      },
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
          "id": "575f504c26d43c968abb9c9fabf7e99b6cbf371e",
          "message": "[release:patch] Fix: Expression-Lists in Binary-Operators and Comment-Only Files (Release v2.0.6)",
          "timestamp": "2024-06-03T11:28:44+02:00",
          "tree_id": "1c00ff329c711b6c9af0a386c677ecef5dfd7410",
          "url": "https://github.com/flowr-analysis/flowr/commit/575f504c26d43c968abb9c9fabf7e99b6cbf371e"
        },
        "date": 1717407622969,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 251.31904182,
            "unit": "ms",
            "range": 46.4588315953866,
            "extra": "median: 228.07ms"
          },
          {
            "name": "Normalize R AST",
            "value": 32.32633034,
            "unit": "ms",
            "range": 26.187047463561896,
            "extra": "median: 19.46ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 83.44498036,
            "unit": "ms",
            "range": 96.43084706580663,
            "extra": "median: 33.12ms"
          },
          {
            "name": "Total per-file",
            "value": 2767.8597222199996,
            "unit": "ms",
            "range": 4846.530361833896,
            "extra": "median: 717.46ms"
          },
          {
            "name": "Static slicing",
            "value": 5.446788492882948,
            "unit": "ms",
            "range": 10.283373004656191,
            "extra": "median: 1.74ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.4316983650673128,
            "unit": "ms",
            "range": 0.236513368663327,
            "extra": "median: 0.20ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.8881370931348265,
            "unit": "ms",
            "range": 10.375713513047257,
            "extra": "median: 2.02ms"
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
            "value": 0.9244839321684389,
            "unit": "#",
            "extra": "std: 0.09245245567369478"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8925060111388464,
            "unit": "#",
            "extra": "std: 0.13301569245585973"
          },
          {
            "name": "memory (df-graph)",
            "value": 165.02990234375,
            "unit": "KiB",
            "range": 166.4547496663315,
            "extra": "median: 82.24"
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
          "id": "39dfc7cdf4c4761a03a4a4e255fe8c8ec1d8e9d0",
          "message": "[release:patch] More Built-Ins and Sample-Benchmarks (Release v2.0.7)",
          "timestamp": "2024-06-03T23:49:38+02:00",
          "tree_id": "cecee91a74d6ca26a55782eb4d9ccaf3ddcb0242",
          "url": "https://github.com/flowr-analysis/flowr/commit/39dfc7cdf4c4761a03a4a4e255fe8c8ec1d8e9d0"
        },
        "date": 1717452068678,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 241.03721904,
            "unit": "ms",
            "range": 44.69032842424015,
            "extra": "median: 222.48ms"
          },
          {
            "name": "Normalize R AST",
            "value": 32.56675896,
            "unit": "ms",
            "range": 26.691919190035012,
            "extra": "median: 20.29ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 81.92171164,
            "unit": "ms",
            "range": 93.34174196708004,
            "extra": "median: 31.88ms"
          },
          {
            "name": "Total per-file",
            "value": 2215.64605008,
            "unit": "ms",
            "range": 3785.332097334837,
            "extra": "median: 696.32ms"
          },
          {
            "name": "Static slicing",
            "value": 4.306902247276028,
            "unit": "ms",
            "range": 7.92323617098868,
            "extra": "median: 1.36ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.3774662077162011,
            "unit": "ms",
            "range": 0.19162953014055226,
            "extra": "median: 0.19ms"
          },
          {
            "name": "Total per-slice",
            "value": 4.693106354000687,
            "unit": "ms",
            "range": 7.988772070847194,
            "extra": "median: 1.73ms"
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
            "value": 0.9250085598882574,
            "unit": "#",
            "extra": "std: 0.09163704405604679"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8936602769604,
            "unit": "#",
            "extra": "std: 0.13105244106324643"
          },
          {
            "name": "memory (df-graph)",
            "value": 165.26138671875,
            "unit": "KiB",
            "range": 166.95669718874987,
            "extra": "median: 82.55"
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
          "id": "c919f62d01807eca7e54a00e415bad56a46e9311",
          "message": "[release:patch] Reduce Dataflow Memory-Print (Release v2.0.8)",
          "timestamp": "2024-06-04T14:41:02+02:00",
          "tree_id": "bbb9834a895cbcd96b15d03ea473dce0bbca5e62",
          "url": "https://github.com/flowr-analysis/flowr/commit/c919f62d01807eca7e54a00e415bad56a46e9311"
        },
        "date": 1717505553349,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 241.9667686,
            "unit": "ms",
            "range": 46.10934730464404,
            "extra": "median: 220.58ms"
          },
          {
            "name": "Normalize R AST",
            "value": 32.605486760000005,
            "unit": "ms",
            "range": 27.251591528051446,
            "extra": "median: 20.03ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 80.1191975,
            "unit": "ms",
            "range": 90.93493662590448,
            "extra": "median: 33.82ms"
          },
          {
            "name": "Total per-file",
            "value": 2193.08144084,
            "unit": "ms",
            "range": 3707.9598145128634,
            "extra": "median: 703.03ms"
          },
          {
            "name": "Static slicing",
            "value": 4.25956238165629,
            "unit": "ms",
            "range": 7.811390850026209,
            "extra": "median: 1.37ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.37460654698732837,
            "unit": "ms",
            "range": 0.18993208234810682,
            "extra": "median: 0.18ms"
          },
          {
            "name": "Total per-slice",
            "value": 4.64289851007374,
            "unit": "ms",
            "range": 7.885517381765674,
            "extra": "median: 1.75ms"
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
            "value": 0.9250085598882574,
            "unit": "#",
            "extra": "std: 0.09163704405604679"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8936602769604,
            "unit": "#",
            "extra": "std: 0.13105244106324643"
          },
          {
            "name": "memory (df-graph)",
            "value": 142.9233984375,
            "unit": "KiB",
            "range": 147.09727351207317,
            "extra": "median: 70.68"
          }
        ]
      },
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
          "id": "f700458cef613440be51006076707eddda8ee1dc",
          "message": "[release:patch] Fix: File-Specific Benchmarks, Shorter Server Messages, Smaller Environments (Release v2.0.9)",
          "timestamp": "2024-06-12T14:15:47+02:00",
          "tree_id": "be2b0649d99fd34f81dfd6033b134f98ecd037f9",
          "url": "https://github.com/flowr-analysis/flowr/commit/f700458cef613440be51006076707eddda8ee1dc"
        },
        "date": 1718195270813,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 239.7466977,
            "unit": "ms",
            "range": 44.430335740665576,
            "extra": "median: 218.76ms"
          },
          {
            "name": "Normalize R AST",
            "value": 32.3679836,
            "unit": "ms",
            "range": 26.655833798985764,
            "extra": "median: 18.44ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 79.06429944,
            "unit": "ms",
            "range": 89.37181075782458,
            "extra": "median: 33.60ms"
          },
          {
            "name": "Total per-file",
            "value": 2188.09461714,
            "unit": "ms",
            "range": 3728.6959809477935,
            "extra": "median: 684.63ms"
          },
          {
            "name": "Static slicing",
            "value": 4.288802088178038,
            "unit": "ms",
            "range": 7.835863076091714,
            "extra": "median: 1.34ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.3685810549987568,
            "unit": "ms",
            "range": 0.18325371914853053,
            "extra": "median: 0.18ms"
          },
          {
            "name": "Total per-slice",
            "value": 4.6658792920129475,
            "unit": "ms",
            "range": 7.902796435245641,
            "extra": "median: 1.83ms"
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
            "value": 0.9250085598882571,
            "unit": "#",
            "extra": "std: 0.09163704405604677"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8936602769604,
            "unit": "#",
            "extra": "std: 0.13105244106324643"
          },
          {
            "name": "memory (df-graph)",
            "value": 142.5463671875,
            "unit": "KiB",
            "range": 146.6995040110581,
            "extra": "median: 70.55"
          }
        ]
      },
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
          "id": "5b3ed9d7e79cfa406a8a9145190f66b72202c8e4",
          "message": "[release:patch] Fix: Correctly print CDs in mermaid (Release v2.0.10)",
          "timestamp": "2024-06-25T09:57:48+02:00",
          "tree_id": "5bdc6eeff97fccbed9fa85a43ad37df03483e839",
          "url": "https://github.com/flowr-analysis/flowr/commit/5b3ed9d7e79cfa406a8a9145190f66b72202c8e4"
        },
        "date": 1719303028425,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 243.97138318,
            "unit": "ms",
            "range": 43.85312989297979,
            "extra": "median: 228.06ms"
          },
          {
            "name": "Normalize R AST",
            "value": 33.32186876,
            "unit": "ms",
            "range": 27.7304378627707,
            "extra": "median: 20.21ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 79.67889694,
            "unit": "ms",
            "range": 90.9276974383577,
            "extra": "median: 31.96ms"
          },
          {
            "name": "Total per-file",
            "value": 2218.10364312,
            "unit": "ms",
            "range": 3803.48849751598,
            "extra": "median: 694.98ms"
          },
          {
            "name": "Static slicing",
            "value": 4.3128597072218735,
            "unit": "ms",
            "range": 7.960117727429911,
            "extra": "median: 1.38ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.37606291199102965,
            "unit": "ms",
            "range": 0.19272447461649175,
            "extra": "median: 0.19ms"
          },
          {
            "name": "Total per-slice",
            "value": 4.697860587731026,
            "unit": "ms",
            "range": 8.030224482502822,
            "extra": "median: 1.79ms"
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
            "value": 0.9250085598882571,
            "unit": "#",
            "extra": "std: 0.09163704405604677"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8936602769604,
            "unit": "#",
            "extra": "std: 0.13105244106324643"
          },
          {
            "name": "memory (df-graph)",
            "value": 142.5463671875,
            "unit": "KiB",
            "range": 146.6995040110581,
            "extra": "median: 70.55"
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
          "id": "d16b9a2cd653d7276b7f9f60e143773eab5f488d",
          "message": "[release:patch] Fix: undefined parse in repl (Release v2.0.11)",
          "timestamp": "2024-06-27T04:05:32+02:00",
          "tree_id": "ebcf13e298ffdcddc68023ca2e2e871f3494200a",
          "url": "https://github.com/flowr-analysis/flowr/commit/d16b9a2cd653d7276b7f9f60e143773eab5f488d"
        },
        "date": 1719454716068,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 247.62148213999998,
            "unit": "ms",
            "range": 45.06237178263203,
            "extra": "median: 227.00ms"
          },
          {
            "name": "Normalize R AST",
            "value": 31.95647656,
            "unit": "ms",
            "range": 25.60791349140293,
            "extra": "median: 20.24ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 81.06377198,
            "unit": "ms",
            "range": 92.78105042956382,
            "extra": "median: 33.24ms"
          },
          {
            "name": "Total per-file",
            "value": 2253.7859776799996,
            "unit": "ms",
            "range": 3816.1054094291667,
            "extra": "median: 708.78ms"
          },
          {
            "name": "Static slicing",
            "value": 4.320062977207287,
            "unit": "ms",
            "range": 7.979427803781336,
            "extra": "median: 1.35ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.4180827296166881,
            "unit": "ms",
            "range": 0.21129610863943676,
            "extra": "median: 0.21ms"
          },
          {
            "name": "Total per-slice",
            "value": 4.7471979325717735,
            "unit": "ms",
            "range": 8.060206129507852,
            "extra": "median: 1.85ms"
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
            "value": 0.9250085598882571,
            "unit": "#",
            "extra": "std: 0.09163704405604677"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8936602769604,
            "unit": "#",
            "extra": "std: 0.13105244106324643"
          },
          {
            "name": "memory (df-graph)",
            "value": 142.5463671875,
            "unit": "KiB",
            "range": 146.6995040110581,
            "extra": "median: 70.55"
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
          "id": "4fb2496898322ccc8fcf217f590bb8341aeaffbd",
          "message": "[release:patch] Link Closures in Unknown Calls (Release v2.0.16)",
          "timestamp": "2024-08-28T20:12:41+02:00",
          "tree_id": "5931659ac2cd2e713c4ce2f761c19194ea694468",
          "url": "https://github.com/flowr-analysis/flowr/commit/4fb2496898322ccc8fcf217f590bb8341aeaffbd"
        },
        "date": 1724869648778,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 240.9999736,
            "unit": "ms",
            "range": 45.52546037334287,
            "extra": "median: 218.20ms"
          },
          {
            "name": "Normalize R AST",
            "value": 22.044827100000003,
            "unit": "ms",
            "range": 17.4420619617221,
            "extra": "median: 13.17ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 68.41181266,
            "unit": "ms",
            "range": 83.25046712198441,
            "extra": "median: 28.74ms"
          },
          {
            "name": "Total per-file",
            "value": 3603.0243807399997,
            "unit": "ms",
            "range": 7958.676569737224,
            "extra": "median: 729.17ms"
          },
          {
            "name": "Static slicing",
            "value": 7.403007833130669,
            "unit": "ms",
            "range": 20.923205633042343,
            "extra": "median: 1.38ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.24681178006363166,
            "unit": "ms",
            "range": 0.15169934993997963,
            "extra": "median: 0.15ms"
          },
          {
            "name": "Total per-slice",
            "value": 7.657637977886095,
            "unit": "ms",
            "range": 20.95063234618626,
            "extra": "median: 1.61ms"
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
            "value": 0.9214445180065712,
            "unit": "#",
            "extra": "std: 0.09383880285366177"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.88847659105633,
            "unit": "#",
            "extra": "std: 0.1337889426590932"
          },
          {
            "name": "memory (df-graph)",
            "value": 142.5463671875,
            "unit": "KiB",
            "range": 146.6995040110581,
            "extra": "median: 70.55"
          }
        ]
      },
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
          "id": "f7dd663f0b3028ec6b64733ed182c4a3c3cc29f7",
          "message": "[release:patch] Forcing Arguments, Improved Side-Effect Detection, and Lineage Command (Release v2.0.17)",
          "timestamp": "2024-08-30T16:22:32+02:00",
          "tree_id": "05ba0ba302b72ac649936ad42e3780fe5aa4be40",
          "url": "https://github.com/flowr-analysis/flowr/commit/f7dd663f0b3028ec6b64733ed182c4a3c3cc29f7"
        },
        "date": 1725028631883,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 237.40032316,
            "unit": "ms",
            "range": 43.13005941619528,
            "extra": "median: 220.25ms"
          },
          {
            "name": "Normalize R AST",
            "value": 22.09362788,
            "unit": "ms",
            "range": 16.761602459541297,
            "extra": "median: 13.50ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 68.97634276000001,
            "unit": "ms",
            "range": 82.8815602292033,
            "extra": "median: 30.16ms"
          },
          {
            "name": "Total per-file",
            "value": 3713.15087572,
            "unit": "ms",
            "range": 7958.055524113993,
            "extra": "median: 754.75ms"
          },
          {
            "name": "Static slicing",
            "value": 7.663184753343301,
            "unit": "ms",
            "range": 20.21369881919582,
            "extra": "median: 1.62ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.23133881371574955,
            "unit": "ms",
            "range": 0.1459510437889604,
            "extra": "median: 0.15ms"
          },
          {
            "name": "Total per-slice",
            "value": 7.902366581545092,
            "unit": "ms",
            "range": 20.237900525090257,
            "extra": "median: 1.90ms"
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
            "value": 0.9060203516109888,
            "unit": "#",
            "extra": "std: 0.09042819256149472"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8749621691839767,
            "unit": "#",
            "extra": "std: 0.130777331317321"
          },
          {
            "name": "memory (df-graph)",
            "value": 142.4557421875,
            "unit": "KiB",
            "range": 146.62238285216054,
            "extra": "median: 70.48"
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
          "id": "f36fe912b408ebc8f8f524b31347e297fb15cea7",
          "message": "[release:patch] Support Side Effects by Loads, Table Assignments, and *Apply (Release v2.0.18)",
          "timestamp": "2024-08-31T20:52:30+02:00",
          "tree_id": "837af1424ca334760308cee914c63b35dd901833",
          "url": "https://github.com/flowr-analysis/flowr/commit/f36fe912b408ebc8f8f524b31347e297fb15cea7"
        },
        "date": 1725131265023,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 236.20020272,
            "unit": "ms",
            "range": 44.510089320062605,
            "extra": "median: 215.14ms"
          },
          {
            "name": "Normalize R AST",
            "value": 21.84563062,
            "unit": "ms",
            "range": 16.81836677518031,
            "extra": "median: 13.26ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 69.25975887999999,
            "unit": "ms",
            "range": 82.88272054902026,
            "extra": "median: 28.79ms"
          },
          {
            "name": "Total per-file",
            "value": 3906.98821284,
            "unit": "ms",
            "range": 8085.840779669835,
            "extra": "median: 811.61ms"
          },
          {
            "name": "Static slicing",
            "value": 8.26620901638564,
            "unit": "ms",
            "range": 20.34106654726218,
            "extra": "median: 1.97ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.21374418768808237,
            "unit": "ms",
            "range": 0.13804892121699308,
            "extra": "median: 0.13ms"
          },
          {
            "name": "Total per-slice",
            "value": 8.487232284216436,
            "unit": "ms",
            "range": 20.37077549956052,
            "extra": "median: 2.21ms"
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
            "value": 0.904417248154758,
            "unit": "#",
            "extra": "std: 0.09194130251895545"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8728070906034533,
            "unit": "#",
            "extra": "std: 0.13241532345368606"
          },
          {
            "name": "memory (df-graph)",
            "value": 142.521875,
            "unit": "KiB",
            "range": 146.6519663264334,
            "extra": "median: 70.15"
          }
        ]
      },
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
          "id": "2ba4d77877fe53239f726a488ec64a2875a2d054",
          "message": "[release:patch] Fix: Use of Replacement Functions in Function Definitions (Release v2.0.19)",
          "timestamp": "2024-09-03T22:40:53+02:00",
          "tree_id": "484c952218196a6640f5665649fadc168fcefb30",
          "url": "https://github.com/flowr-analysis/flowr/commit/2ba4d77877fe53239f726a488ec64a2875a2d054"
        },
        "date": 1725397132358,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 243.98377468,
            "unit": "ms",
            "range": 44.65454208073405,
            "extra": "median: 221.23ms"
          },
          {
            "name": "Normalize R AST",
            "value": 22.16135236,
            "unit": "ms",
            "range": 16.672667480590608,
            "extra": "median: 13.26ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 72.23525608,
            "unit": "ms",
            "range": 86.60187300046161,
            "extra": "median: 30.20ms"
          },
          {
            "name": "Total per-file",
            "value": 4031.8785642,
            "unit": "ms",
            "range": 8285.555073707617,
            "extra": "median: 833.83ms"
          },
          {
            "name": "Static slicing",
            "value": 8.512326865448639,
            "unit": "ms",
            "range": 20.852034679315373,
            "extra": "median: 2.03ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.23621496079457663,
            "unit": "ms",
            "range": 0.15042289859405333,
            "extra": "median: 0.15ms"
          },
          {
            "name": "Total per-slice",
            "value": 8.756647337180182,
            "unit": "ms",
            "range": 20.88345286926803,
            "extra": "median: 2.30ms"
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
            "value": 0.9038287698156573,
            "unit": "#",
            "extra": "std: 0.09278162591666926"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8715309581660212,
            "unit": "#",
            "extra": "std: 0.1344210870113287"
          },
          {
            "name": "memory (df-graph)",
            "value": 142.5441796875,
            "unit": "KiB",
            "range": 146.66042171252732,
            "extra": "median: 70.15"
          }
        ]
      },
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
          "id": "d6d97d3fea33e517ba14715d9fc2fbf476969926",
          "message": "[release:patch] Fix: Overshadow Built-Ins in Loops (Release v2.0.20)",
          "timestamp": "2024-09-09T10:17:42+02:00",
          "tree_id": "39481f7becc3c958ae8d9195b92f08ed9e6ef7c4",
          "url": "https://github.com/flowr-analysis/flowr/commit/d6d97d3fea33e517ba14715d9fc2fbf476969926"
        },
        "date": 1725871133924,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 238.45832514,
            "unit": "ms",
            "range": 44.01516969239197,
            "extra": "median: 219.26ms"
          },
          {
            "name": "Normalize R AST",
            "value": 21.8018916,
            "unit": "ms",
            "range": 16.153242755954302,
            "extra": "median: 13.36ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 73.37089498,
            "unit": "ms",
            "range": 86.87821424333349,
            "extra": "median: 30.21ms"
          },
          {
            "name": "Total per-file",
            "value": 10697.70673224,
            "unit": "ms",
            "range": 51757.12122600268,
            "extra": "median: 812.87ms"
          },
          {
            "name": "Static slicing",
            "value": 20.852021200476752,
            "unit": "ms",
            "range": 78.34298008513575,
            "extra": "median: 2.37ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.22516315606876278,
            "unit": "ms",
            "range": 0.13784797448770958,
            "extra": "median: 0.13ms"
          },
          {
            "name": "Total per-slice",
            "value": 21.08480712275338,
            "unit": "ms",
            "range": 78.36487556608114,
            "extra": "median: 2.64ms"
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
            "value": 0.8944619525615458,
            "unit": "#",
            "extra": "std: 0.09800382104106263"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8534320485134076,
            "unit": "#",
            "extra": "std: 0.14398517665453786"
          },
          {
            "name": "memory (df-graph)",
            "value": 146.770703125,
            "unit": "KiB",
            "range": 154.0029022815246,
            "extra": "median: 70.15"
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
          "id": "5ec575519531bc0853fc1f7388ea53bfe5536b16",
          "message": "[release:patch] Fix `mapply`, Nested Data-Frame-Assignments, and CD Nestings (Release v2.0.21)",
          "timestamp": "2024-09-10T00:41:42+02:00",
          "tree_id": "2d2319307093dbe8d76aafd3e03eea3f5f6e26a7",
          "url": "https://github.com/flowr-analysis/flowr/commit/5ec575519531bc0853fc1f7388ea53bfe5536b16"
        },
        "date": 1725922988640,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 237.69329584,
            "unit": "ms",
            "range": 43.84340925172529,
            "extra": "median: 218.92ms"
          },
          {
            "name": "Normalize R AST",
            "value": 21.9065619,
            "unit": "ms",
            "range": 16.225847445998614,
            "extra": "median: 13.56ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 74.67179426,
            "unit": "ms",
            "range": 88.28330200016099,
            "extra": "median: 29.56ms"
          },
          {
            "name": "Total per-file",
            "value": 10810.819275639999,
            "unit": "ms",
            "range": 51897.778865580585,
            "extra": "median: 819.13ms"
          },
          {
            "name": "Static slicing",
            "value": 21.057520127739036,
            "unit": "ms",
            "range": 77.76167376331098,
            "extra": "median: 2.37ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.22169126925109592,
            "unit": "ms",
            "range": 0.13858017956284233,
            "extra": "median: 0.12ms"
          },
          {
            "name": "Total per-slice",
            "value": 21.28670664379957,
            "unit": "ms",
            "range": 77.7851923602881,
            "extra": "median: 2.74ms"
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
            "value": 0.8925178291385903,
            "unit": "#",
            "extra": "std: 0.10165213441102777"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8508531059077417,
            "unit": "#",
            "extra": "std: 0.14791471186446967"
          },
          {
            "name": "memory (df-graph)",
            "value": 145.84685546875,
            "unit": "KiB",
            "range": 153.44623089940248,
            "extra": "median: 65.38"
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
          "id": "69a5fc86cba0257f9dd4afb87153a86912635ac2",
          "message": "[release:patch] Fix `par` and Memory-Increase for Docker (Release v2.0.22)",
          "timestamp": "2024-09-12T15:57:15+02:00",
          "tree_id": "fa75f21d466253de387fd2050d5217dbea78ca34",
          "url": "https://github.com/flowr-analysis/flowr/commit/69a5fc86cba0257f9dd4afb87153a86912635ac2"
        },
        "date": 1726150770158,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 241.419398,
            "unit": "ms",
            "range": 45.10415936849987,
            "extra": "median: 219.99ms"
          },
          {
            "name": "Normalize R AST",
            "value": 22.21252828,
            "unit": "ms",
            "range": 16.743829774339492,
            "extra": "median: 13.49ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 76.47963048,
            "unit": "ms",
            "range": 92.86765617245509,
            "extra": "median: 31.28ms"
          },
          {
            "name": "Total per-file",
            "value": 11128.12225152,
            "unit": "ms",
            "range": 53314.44953778299,
            "extra": "median: 843.43ms"
          },
          {
            "name": "Static slicing",
            "value": 21.721580926884755,
            "unit": "ms",
            "range": 79.88249488357124,
            "extra": "median: 2.58ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.23449054097499383,
            "unit": "ms",
            "range": 0.14561179514636924,
            "extra": "median: 0.14ms"
          },
          {
            "name": "Total per-slice",
            "value": 21.963907934107166,
            "unit": "ms",
            "range": 79.90597541173697,
            "extra": "median: 2.85ms"
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
            "value": 0.8862013459637729,
            "unit": "#",
            "extra": "std: 0.1016537616587095"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8339515062511054,
            "unit": "#",
            "extra": "std: 0.14792006930185111"
          },
          {
            "name": "memory (df-graph)",
            "value": 145.7402734375,
            "unit": "KiB",
            "range": 153.4526987962704,
            "extra": "median: 65.38"
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
          "id": "44c526b4eb30b0cc6cb10bb1a3a056a3f51c9597",
          "message": "[release:patch] Support More Side-Effects (Release v2.0.23)",
          "timestamp": "2024-09-13T03:43:31+02:00",
          "tree_id": "81bd9928fc36ac9ea963c11981ef0ba31d2f22f2",
          "url": "https://github.com/flowr-analysis/flowr/commit/44c526b4eb30b0cc6cb10bb1a3a056a3f51c9597"
        },
        "date": 1726193152752,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 241.19898486000002,
            "unit": "ms",
            "range": 44.93266335552592,
            "extra": "median: 219.55ms"
          },
          {
            "name": "Normalize R AST",
            "value": 22.15083762,
            "unit": "ms",
            "range": 17.078596378622905,
            "extra": "median: 13.26ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 74.87567007999999,
            "unit": "ms",
            "range": 88.09994848451149,
            "extra": "median: 30.32ms"
          },
          {
            "name": "Total per-file",
            "value": 11369.75587748,
            "unit": "ms",
            "range": 54073.12372176306,
            "extra": "median: 967.82ms"
          },
          {
            "name": "Static slicing",
            "value": 22.549699250990475,
            "unit": "ms",
            "range": 80.89690479433877,
            "extra": "median: 3.58ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.23785571716825718,
            "unit": "ms",
            "range": 0.14842108337668944,
            "extra": "median: 0.14ms"
          },
          {
            "name": "Total per-slice",
            "value": 22.79558156247473,
            "unit": "ms",
            "range": 80.92056204842162,
            "extra": "median: 3.75ms"
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
            "value": 0.8702425339407753,
            "unit": "#",
            "extra": "std: 0.09794304894957125"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8080197262683358,
            "unit": "#",
            "extra": "std: 0.1433623538968359"
          },
          {
            "name": "memory (df-graph)",
            "value": 145.541875,
            "unit": "KiB",
            "range": 153.47859961917467,
            "extra": "median: 65.38"
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
          "id": "e97ab14baf2ce8e8dd82634b0ed34e4283364345",
          "message": "[release:patch] Fix: Incorrect Side-Effects for dev.off (Release v2.0.24)",
          "timestamp": "2024-09-13T08:04:48+02:00",
          "tree_id": "bc3bfc5f35a5efb84d34ca16adc94e78635389ed",
          "url": "https://github.com/flowr-analysis/flowr/commit/e97ab14baf2ce8e8dd82634b0ed34e4283364345"
        },
        "date": 1726208808259,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 230.45514896,
            "unit": "ms",
            "range": 41.928890449506795,
            "extra": "median: 209.85ms"
          },
          {
            "name": "Normalize R AST",
            "value": 21.83893728,
            "unit": "ms",
            "range": 16.824930859182228,
            "extra": "median: 13.21ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 71.77401414,
            "unit": "ms",
            "range": 84.7721694767239,
            "extra": "median: 29.93ms"
          },
          {
            "name": "Total per-file",
            "value": 10637.351617459999,
            "unit": "ms",
            "range": 50105.335952081325,
            "extra": "median: 961.84ms"
          },
          {
            "name": "Static slicing",
            "value": 21.13796129326044,
            "unit": "ms",
            "range": 74.99919647035496,
            "extra": "median: 3.06ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.20996977181571297,
            "unit": "ms",
            "range": 0.1323410404638652,
            "extra": "median: 0.13ms"
          },
          {
            "name": "Total per-slice",
            "value": 21.355262023955028,
            "unit": "ms",
            "range": 75.02211455722146,
            "extra": "median: 3.16ms"
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
            "value": 0.8719618340615195,
            "unit": "#",
            "extra": "std: 0.09794330006770832"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.810633662275233,
            "unit": "#",
            "extra": "std: 0.1433627097836729"
          },
          {
            "name": "memory (df-graph)",
            "value": 145.6434765625,
            "unit": "KiB",
            "range": 153.49028997815503,
            "extra": "median: 65.38"
          }
        ]
      },
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
          "id": "9d8b36155cdc051cb13f4f2c93eb42c14394e0a9",
          "message": "[release:patch] Dataflow Graph Deserialization (Release v2.0.25)",
          "timestamp": "2024-09-16T18:33:48+02:00",
          "tree_id": "6d5085f73235cd2a3ed9c137e1d32256f8e84097",
          "url": "https://github.com/flowr-analysis/flowr/commit/9d8b36155cdc051cb13f4f2c93eb42c14394e0a9"
        },
        "date": 1726506371218,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 238.40722376,
            "unit": "ms",
            "range": 42.95412443307438,
            "extra": "median: 216.89ms"
          },
          {
            "name": "Normalize R AST",
            "value": 22.0872248,
            "unit": "ms",
            "range": 17.016890594916376,
            "extra": "median: 13.67ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 74.60461736,
            "unit": "ms",
            "range": 88.95210983454488,
            "extra": "median: 30.54ms"
          },
          {
            "name": "Total per-file",
            "value": 11091.201449639999,
            "unit": "ms",
            "range": 52310.41942604725,
            "extra": "median: 967.44ms"
          },
          {
            "name": "Static slicing",
            "value": 22.047137876062838,
            "unit": "ms",
            "range": 78.30877993604865,
            "extra": "median: 3.18ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2327517832436913,
            "unit": "ms",
            "range": 0.14954480815603388,
            "extra": "median: 0.14ms"
          },
          {
            "name": "Total per-slice",
            "value": 22.287796325154986,
            "unit": "ms",
            "range": 78.33211951742135,
            "extra": "median: 3.44ms"
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
            "value": 0.8719618340615195,
            "unit": "#",
            "extra": "std: 0.09794330006770832"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.810633662275233,
            "unit": "#",
            "extra": "std: 0.1433627097836729"
          },
          {
            "name": "memory (df-graph)",
            "value": 145.6434765625,
            "unit": "KiB",
            "range": 153.49028997815503,
            "extra": "median: 65.38"
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
          "id": "87e0d906cf2af0afd4cca69261ecd3b5a9c94cba",
          "message": "[release:patch] Several New Queries (Dataflow, Normalized AST, Id-Map, Clusters, Slice) (Release v2.1.2)",
          "timestamp": "2024-10-12T21:16:01+02:00",
          "tree_id": "7189ce7de02572ec3e2615f5d14feda54c733e31",
          "url": "https://github.com/flowr-analysis/flowr/commit/87e0d906cf2af0afd4cca69261ecd3b5a9c94cba"
        },
        "date": 1728761758923,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 242.00403574,
            "unit": "ms",
            "range": 45.320075472333585,
            "extra": "median: 222.22ms"
          },
          {
            "name": "Normalize R AST",
            "value": 20.69905216,
            "unit": "ms",
            "range": 15.186291643827508,
            "extra": "median: 13.48ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 76.57805664,
            "unit": "ms",
            "range": 89.58088354130591,
            "extra": "median: 34.49ms"
          },
          {
            "name": "Total per-file",
            "value": 7709.17616424,
            "unit": "ms",
            "range": 28829.19832835734,
            "extra": "median: 961.72ms"
          },
          {
            "name": "Static slicing",
            "value": 16.011826354372698,
            "unit": "ms",
            "range": 44.07740390571893,
            "extra": "median: 3.34ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.24862159317179558,
            "unit": "ms",
            "range": 0.1500116592324732,
            "extra": "median: 0.18ms"
          },
          {
            "name": "Total per-slice",
            "value": 16.268530062071488,
            "unit": "ms",
            "range": 44.104014536012066,
            "extra": "median: 3.55ms"
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
            "value": 0.8712997340230448,
            "unit": "#",
            "extra": "std: 0.10089474161172114"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8102441553774778,
            "unit": "#",
            "extra": "std: 0.14548434035979138"
          },
          {
            "name": "memory (df-graph)",
            "value": 99.8990234375,
            "unit": "KiB",
            "range": 113.72812769327498,
            "extra": "median: 49.92"
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
          "id": "96e933e11de9483de54200657c3dbf930f0c657b",
          "message": "[release:patch] Lineage Query (Release v2.1.3)",
          "timestamp": "2024-10-13T11:49:17+02:00",
          "tree_id": "69ef18259b9d63b7cf73755c0c68ed84651cd0fb",
          "url": "https://github.com/flowr-analysis/flowr/commit/96e933e11de9483de54200657c3dbf930f0c657b"
        },
        "date": 1728814106118,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 239.76002830000002,
            "unit": "ms",
            "range": 44.476154875177215,
            "extra": "median: 218.04ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.04045506,
            "unit": "ms",
            "range": 14.770405721401682,
            "extra": "median: 10.74ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 74.39786466,
            "unit": "ms",
            "range": 87.80796950166253,
            "extra": "median: 32.28ms"
          },
          {
            "name": "Total per-file",
            "value": 7666.33215246,
            "unit": "ms",
            "range": 28737.408915639426,
            "extra": "median: 946.55ms"
          },
          {
            "name": "Static slicing",
            "value": 15.907723437298863,
            "unit": "ms",
            "range": 43.83669809749617,
            "extra": "median: 3.35ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2509487217116593,
            "unit": "ms",
            "range": 0.14943631432024615,
            "extra": "median: 0.17ms"
          },
          {
            "name": "Total per-slice",
            "value": 16.166379499642126,
            "unit": "ms",
            "range": 43.873427530614464,
            "extra": "median: 3.59ms"
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
            "value": 0.8712997340230448,
            "unit": "#",
            "extra": "std: 0.10089474161172114"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8102441553774778,
            "unit": "#",
            "extra": "std: 0.14548434035979138"
          },
          {
            "name": "memory (df-graph)",
            "value": 99.8990234375,
            "unit": "KiB",
            "range": 113.72812769327498,
            "extra": "median: 49.92"
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
          "id": "b1b2a4fc1891a2deaf0d8b8ad8a4e68997516598",
          "message": "[release:patch] Dependencies Query (Release v2.1.4)",
          "timestamp": "2024-11-03T19:08:28+01:00",
          "tree_id": "aeeada919a449d740b91787f92776ecd678c9482",
          "url": "https://github.com/flowr-analysis/flowr/commit/b1b2a4fc1891a2deaf0d8b8ad8a4e68997516598"
        },
        "date": 1730658473725,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 239.06656040000001,
            "unit": "ms",
            "range": 44.16598823989777,
            "extra": "median: 217.68ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.04988786,
            "unit": "ms",
            "range": 14.665186835895385,
            "extra": "median: 10.86ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 72.05729572,
            "unit": "ms",
            "range": 67.06092157569653,
            "extra": "median: 34.06ms"
          },
          {
            "name": "Total per-file",
            "value": 7652.55437492,
            "unit": "ms",
            "range": 28693.166726381678,
            "extra": "median: 1009.41ms"
          },
          {
            "name": "Static slicing",
            "value": 15.882825839192575,
            "unit": "ms",
            "range": 43.82984820001617,
            "extra": "median: 3.16ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.24678118745144187,
            "unit": "ms",
            "range": 0.1433648958022132,
            "extra": "median: 0.15ms"
          },
          {
            "name": "Total per-slice",
            "value": 16.137227556865618,
            "unit": "ms",
            "range": 43.86167991198577,
            "extra": "median: 3.33ms"
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
            "value": 0.8712997340230448,
            "unit": "#",
            "extra": "std: 0.10089474161172114"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8102441553774778,
            "unit": "#",
            "extra": "std: 0.14548434035979138"
          },
          {
            "name": "memory (df-graph)",
            "value": 99.4425,
            "unit": "KiB",
            "range": 113.62933451202426,
            "extra": "median: 49.92"
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
          "id": "0d1268dc84fe71880bd570ec306ef25f81b46329",
          "message": "[release:patch] Fix: Dependency Query with Aliases (Release v2.1.5)",
          "timestamp": "2024-11-04T20:00:23+01:00",
          "tree_id": "0f4be08b9ed899e2acb220fce2a76fbe7fe269bc",
          "url": "https://github.com/flowr-analysis/flowr/commit/0d1268dc84fe71880bd570ec306ef25f81b46329"
        },
        "date": 1730748115312,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 254.70445752,
            "unit": "ms",
            "range": 48.56635699718653,
            "extra": "median: 232.77ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.45440952,
            "unit": "ms",
            "range": 14.953138748943163,
            "extra": "median: 10.94ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 75.30514048,
            "unit": "ms",
            "range": 71.35653069164984,
            "extra": "median: 37.95ms"
          },
          {
            "name": "Total per-file",
            "value": 7850.45238692,
            "unit": "ms",
            "range": 28841.253371136383,
            "extra": "median: 1018.34ms"
          },
          {
            "name": "Static slicing",
            "value": 16.172304981916042,
            "unit": "ms",
            "range": 44.135225929438114,
            "extra": "median: 3.34ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.34529443588845116,
            "unit": "ms",
            "range": 0.1709415154465775,
            "extra": "median: 0.23ms"
          },
          {
            "name": "Total per-slice",
            "value": 16.52688720676753,
            "unit": "ms",
            "range": 44.1588873153231,
            "extra": "median: 3.62ms"
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
            "value": 0.8712997340230448,
            "unit": "#",
            "extra": "std: 0.10089474161172114"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8102441553774778,
            "unit": "#",
            "extra": "std: 0.14548434035979138"
          },
          {
            "name": "memory (df-graph)",
            "value": 99.4425,
            "unit": "KiB",
            "range": 113.62933451202426,
            "extra": "median: 49.92"
          }
        ]
      },
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
          "id": "f2c385450bed779acacfd46a3b030ee57c48264c",
          "message": "[release:patch] Include Source-File Information, Vitest, and Documentation (Release v2.1.6)",
          "timestamp": "2024-11-14T17:17:14+01:00",
          "tree_id": "d078189bfab30293d38ae2019d0eb7bd14dd983b",
          "url": "https://github.com/flowr-analysis/flowr/commit/f2c385450bed779acacfd46a3b030ee57c48264c"
        },
        "date": 1731602214613,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 249.49471076,
            "unit": "ms",
            "range": 47.70744524568832,
            "extra": "median: 226.38ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.32525848,
            "unit": "ms",
            "range": 14.88692036854954,
            "extra": "median: 10.86ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 75.50122194,
            "unit": "ms",
            "range": 70.59030670138222,
            "extra": "median: 34.37ms"
          },
          {
            "name": "Total per-file",
            "value": 7858.00967028,
            "unit": "ms",
            "range": 29238.813896525935,
            "extra": "median: 1029.44ms"
          },
          {
            "name": "Static slicing",
            "value": 16.196331723819696,
            "unit": "ms",
            "range": 44.66453894216285,
            "extra": "median: 3.33ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.30821959026002077,
            "unit": "ms",
            "range": 0.1609036955871433,
            "extra": "median: 0.22ms"
          },
          {
            "name": "Total per-slice",
            "value": 16.5134858115635,
            "unit": "ms",
            "range": 44.69517481552843,
            "extra": "median: 3.49ms"
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
            "value": 0.8712997340230448,
            "unit": "#",
            "extra": "std: 0.10089474161172114"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8102441553774778,
            "unit": "#",
            "extra": "std: 0.14548434035979138"
          },
          {
            "name": "memory (df-graph)",
            "value": 99.4425,
            "unit": "KiB",
            "range": 113.62933451202426,
            "extra": "median: 49.92"
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
          "id": "23801137ca7083fd1edfe603a80c8ebf6d2d557a",
          "message": "[release:patch] Fix: Static Slicing For Inverted Caller (Release v2.1.7)",
          "timestamp": "2024-11-17T19:53:11+01:00",
          "tree_id": "60b0536b0e628727fcdc94746a38538f3f6c5896",
          "url": "https://github.com/flowr-analysis/flowr/commit/23801137ca7083fd1edfe603a80c8ebf6d2d557a"
        },
        "date": 1731870836485,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 246.34857636,
            "unit": "ms",
            "range": 46.05736358259125,
            "extra": "median: 222.96ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.12205878,
            "unit": "ms",
            "range": 14.425168152928613,
            "extra": "median: 11.90ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 74.45471131999999,
            "unit": "ms",
            "range": 70.57749655074137,
            "extra": "median: 33.53ms"
          },
          {
            "name": "Total per-file",
            "value": 7726.72160172,
            "unit": "ms",
            "range": 28528.07523908248,
            "extra": "median: 1025.43ms"
          },
          {
            "name": "Static slicing",
            "value": 15.999780665624812,
            "unit": "ms",
            "range": 43.68226004466487,
            "extra": "median: 3.30ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2820169656616924,
            "unit": "ms",
            "range": 0.15417410861831182,
            "extra": "median: 0.18ms"
          },
          {
            "name": "Total per-slice",
            "value": 16.29007209329986,
            "unit": "ms",
            "range": 43.71440479393139,
            "extra": "median: 3.49ms"
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
            "value": 0.8712997340230448,
            "unit": "#",
            "extra": "std: 0.10089474161172114"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8102441553774778,
            "unit": "#",
            "extra": "std: 0.14548434035979138"
          },
          {
            "name": "memory (df-graph)",
            "value": 99.4425,
            "unit": "KiB",
            "range": 113.62933451202426,
            "extra": "median: 49.92"
          }
        ]
      },
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
          "id": "db7ac2e228f8144da97c252a2affb26bd9ea4e0b",
          "message": "[release:patch] Improved Dead-Code Detection, Location Restrictions for Call-Context Query, New Visitor (Release v2.1.8)",
          "timestamp": "2024-11-28T13:54:45+01:00",
          "tree_id": "54959f17cb72871023e10232c7b70ca57816b089",
          "url": "https://github.com/flowr-analysis/flowr/commit/db7ac2e228f8144da97c252a2affb26bd9ea4e0b"
        },
        "date": 1732799936603,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 237.81388206,
            "unit": "ms",
            "range": 43.26435892465071,
            "extra": "median: 219.92ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.584648960000003,
            "unit": "ms",
            "range": 13.710753719051512,
            "extra": "median: 10.86ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 71.41246154000001,
            "unit": "ms",
            "range": 65.6106108648961,
            "extra": "median: 32.22ms"
          },
          {
            "name": "Total per-file",
            "value": 7625.11364774,
            "unit": "ms",
            "range": 29095.600821943466,
            "extra": "median: 966.37ms"
          },
          {
            "name": "Static slicing",
            "value": 15.746698561898643,
            "unit": "ms",
            "range": 44.50249372495068,
            "extra": "median: 3.18ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.24344144772080362,
            "unit": "ms",
            "range": 0.13994668646932817,
            "extra": "median: 0.15ms"
          },
          {
            "name": "Total per-slice",
            "value": 15.997988500166153,
            "unit": "ms",
            "range": 44.53599655284285,
            "extra": "median: 3.48ms"
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
            "value": 0.8762109251198998,
            "unit": "#",
            "extra": "std: 0.10203599599093915"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.819994064355517,
            "unit": "#",
            "extra": "std: 0.14776952252356845"
          },
          {
            "name": "memory (df-graph)",
            "value": 99.526015625,
            "unit": "KiB",
            "range": 113.60201607005874,
            "extra": "median: 49.92"
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
          "id": "2b2a899bb137bbe37158d8b89b5d9ab797377c87",
          "message": "[release:patch] Improved Closure Slicing, DFG docs, and Support for the Car Package (Release v2.1.9)",
          "timestamp": "2024-12-21T19:20:34+01:00",
          "tree_id": "5021a4d182f712192184590249ccca759e5c2361",
          "url": "https://github.com/flowr-analysis/flowr/commit/2b2a899bb137bbe37158d8b89b5d9ab797377c87"
        },
        "date": 1734806436813,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 240.29553246,
            "unit": "ms",
            "range": 43.566698252490966,
            "extra": "median: 218.97ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.887684059999998,
            "unit": "ms",
            "range": 14.011413326184593,
            "extra": "median: 12.50ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 75.87755006,
            "unit": "ms",
            "range": 71.20775670773445,
            "extra": "median: 34.78ms"
          },
          {
            "name": "Total per-file",
            "value": 8196.63913376,
            "unit": "ms",
            "range": 29495.910083125105,
            "extra": "median: 987.76ms"
          },
          {
            "name": "Static slicing",
            "value": 16.277712909531544,
            "unit": "ms",
            "range": 44.55798671432273,
            "extra": "median: 3.20ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.24983815231539427,
            "unit": "ms",
            "range": 0.14603721736587416,
            "extra": "median: 0.15ms"
          },
          {
            "name": "Total per-slice",
            "value": 16.535243500004896,
            "unit": "ms",
            "range": 44.592894451465924,
            "extra": "median: 3.36ms"
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
            "value": 0.8675079502314259,
            "unit": "#",
            "extra": "std: 0.09672370351664435"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8039272829076662,
            "unit": "#",
            "extra": "std: 0.13958898876719777"
          },
          {
            "name": "memory (df-graph)",
            "value": 99.374609375,
            "unit": "KiB",
            "range": 113.04110172670963,
            "extra": "median: 49.92"
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
          "id": "193493e9fb030ea261ae5f34cb1637c1dbdc8c0c",
          "message": "[release:patch] First support for pointer analysis (named list arguments with `$`) (Release v2.1.10)",
          "timestamp": "2025-01-05T09:27:15+01:00",
          "tree_id": "0ff91a4015f58348ae7b57e9fcdf0c9beb6e0d66",
          "url": "https://github.com/flowr-analysis/flowr/commit/193493e9fb030ea261ae5f34cb1637c1dbdc8c0c"
        },
        "date": 1736072501906,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 239.83494634000002,
            "unit": "ms",
            "range": 44.091585283717734,
            "extra": "median: 216.40ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.75151096,
            "unit": "ms",
            "range": 14.043201910950488,
            "extra": "median: 11.10ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 78.18609565999999,
            "unit": "ms",
            "range": 74.2114422379391,
            "extra": "median: 37.88ms"
          },
          {
            "name": "Total per-file",
            "value": 7533.92321098,
            "unit": "ms",
            "range": 29636.25828137677,
            "extra": "median: 1004.60ms"
          },
          {
            "name": "Static slicing",
            "value": 15.208209336602515,
            "unit": "ms",
            "range": 44.74548831215854,
            "extra": "median: 2.62ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.24570827411135815,
            "unit": "ms",
            "range": 0.1455091615894726,
            "extra": "median: 0.14ms"
          },
          {
            "name": "Total per-slice",
            "value": 15.461665096914391,
            "unit": "ms",
            "range": 44.78032403557931,
            "extra": "median: 2.88ms"
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
            "value": 0.8760481407790371,
            "unit": "#",
            "extra": "std: 0.09199242410216736"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8152466834674152,
            "unit": "#",
            "extra": "std: 0.13304938654347453"
          },
          {
            "name": "memory (df-graph)",
            "value": 99.6448046875,
            "unit": "KiB",
            "range": 113.2159841674677,
            "extra": "median: 49.92"
          }
        ]
      },
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
          "id": "541c8774cb7fdf6746f88a6796dbdbd702f05b88",
          "message": "[release:patch] Improved Configuration Retrieve and Config Query (Release v2.1.11)",
          "timestamp": "2025-01-08T14:10:23+01:00",
          "tree_id": "fc705e512f52a0003e3980f292189ef33cd27b88",
          "url": "https://github.com/flowr-analysis/flowr/commit/541c8774cb7fdf6746f88a6796dbdbd702f05b88"
        },
        "date": 1736343769301,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 250.87034932,
            "unit": "ms",
            "range": 46.56680546713231,
            "extra": "median: 230.34ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.59508812,
            "unit": "ms",
            "range": 15.03973619515968,
            "extra": "median: 11.06ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 80.38135018000001,
            "unit": "ms",
            "range": 75.58341867973724,
            "extra": "median: 39.84ms"
          },
          {
            "name": "Total per-file",
            "value": 7771.39472922,
            "unit": "ms",
            "range": 30428.76676795769,
            "extra": "median: 1062.19ms"
          },
          {
            "name": "Static slicing",
            "value": 15.587390670545206,
            "unit": "ms",
            "range": 45.92209633324931,
            "extra": "median: 2.98ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.32552061473770666,
            "unit": "ms",
            "range": 0.1685298984993543,
            "extra": "median: 0.23ms"
          },
          {
            "name": "Total per-slice",
            "value": 15.922086932457127,
            "unit": "ms",
            "range": 45.94589119581666,
            "extra": "median: 3.13ms"
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
            "value": 0.8760481407790371,
            "unit": "#",
            "extra": "std: 0.09199242410216736"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8152466834674152,
            "unit": "#",
            "extra": "std: 0.13304938654347453"
          },
          {
            "name": "memory (df-graph)",
            "value": 99.6448046875,
            "unit": "KiB",
            "range": 113.2159841674677,
            "extra": "median: 49.92"
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
          "id": "7070a1878fcd8538f6608721a8b2fff257baa7b1",
          "message": "[release:patch] Flowr Search API and Query (+wiki improvements) (Release v2.1.12)",
          "timestamp": "2025-01-10T21:26:04+01:00",
          "tree_id": "25127a9bdefc846b50ba6b660e3404755fedacad",
          "url": "https://github.com/flowr-analysis/flowr/commit/7070a1878fcd8538f6608721a8b2fff257baa7b1"
        },
        "date": 1736542055397,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 244.83609080000002,
            "unit": "ms",
            "range": 45.845435564196265,
            "extra": "median: 222.08ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.903888,
            "unit": "ms",
            "range": 14.297294404190415,
            "extra": "median: 11.23ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 79.56099024,
            "unit": "ms",
            "range": 76.09515622149628,
            "extra": "median: 38.44ms"
          },
          {
            "name": "Total per-file",
            "value": 7634.83357248,
            "unit": "ms",
            "range": 29791.82637367462,
            "extra": "median: 1016.53ms"
          },
          {
            "name": "Static slicing",
            "value": 15.340383644121527,
            "unit": "ms",
            "range": 45.020966899276466,
            "extra": "median: 2.75ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2855028997482908,
            "unit": "ms",
            "range": 0.15964057495818737,
            "extra": "median: 0.17ms"
          },
          {
            "name": "Total per-slice",
            "value": 15.634114200618324,
            "unit": "ms",
            "range": 45.054357950381686,
            "extra": "median: 2.96ms"
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
            "value": 0.8760481407790371,
            "unit": "#",
            "extra": "std: 0.09199242410216736"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8152466834674152,
            "unit": "#",
            "extra": "std: 0.13304938654347453"
          },
          {
            "name": "memory (df-graph)",
            "value": 99.6448046875,
            "unit": "KiB",
            "range": 113.2159841674677,
            "extra": "median: 49.92"
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
          "id": "e03f8209a04870aa9fd67af64ef1d5bd138b0162",
          "message": "[release:minor] Tree-Sitter Engine (Release v2.2.0)",
          "timestamp": "2025-01-16T17:07:49+01:00",
          "tree_id": "81d8ed434124b40723bab15b19f8da577a9e0f50",
          "url": "https://github.com/flowr-analysis/flowr/commit/e03f8209a04870aa9fd67af64ef1d5bd138b0162"
        },
        "date": 1737044790207,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 240.40298668,
            "unit": "ms",
            "range": 44.74124894190378,
            "extra": "median: 217.21ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.744728440000003,
            "unit": "ms",
            "range": 14.298720718371266,
            "extra": "median: 10.79ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 77.84476045999999,
            "unit": "ms",
            "range": 73.85390788737382,
            "extra": "median: 37.02ms"
          },
          {
            "name": "Total per-file",
            "value": 7602.77100316,
            "unit": "ms",
            "range": 29929.27728486919,
            "extra": "median: 1030.04ms"
          },
          {
            "name": "Static slicing",
            "value": 15.305812616190021,
            "unit": "ms",
            "range": 45.16941912272401,
            "extra": "median: 2.68ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2559031904393219,
            "unit": "ms",
            "range": 0.14888485451860714,
            "extra": "median: 0.13ms"
          },
          {
            "name": "Total per-slice",
            "value": 15.569331823069898,
            "unit": "ms",
            "range": 45.20255455292855,
            "extra": "median: 2.91ms"
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
            "value": 0.8760481407790371,
            "unit": "#",
            "extra": "std: 0.09199242410216736"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8152466834674152,
            "unit": "#",
            "extra": "std: 0.13304938654347453"
          },
          {
            "name": "memory (df-graph)",
            "value": 99.6448046875,
            "unit": "KiB",
            "range": 113.2159841674677,
            "extra": "median: 49.92"
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
          "id": "a877df7af36cbd777d23162a0e1a009e8687de3a",
          "message": "[release:patch] New Happens-Before Query (Release v2.2.1)",
          "timestamp": "2025-01-16T19:36:36+01:00",
          "tree_id": "24f6ef9b2e4fb3189e7f9d9f381c59bf6af84079",
          "url": "https://github.com/flowr-analysis/flowr/commit/a877df7af36cbd777d23162a0e1a009e8687de3a"
        },
        "date": 1737053865320,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 240.34012847999998,
            "unit": "ms",
            "range": 43.93673078226616,
            "extra": "median: 218.71ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.87248132,
            "unit": "ms",
            "range": 14.186278380523435,
            "extra": "median: 10.79ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 78.15406248000001,
            "unit": "ms",
            "range": 73.48454316898545,
            "extra": "median: 37.39ms"
          },
          {
            "name": "Total per-file",
            "value": 7582.25710378,
            "unit": "ms",
            "range": 29767.39189439267,
            "extra": "median: 1006.50ms"
          },
          {
            "name": "Static slicing",
            "value": 15.270449566508105,
            "unit": "ms",
            "range": 44.94967789767313,
            "extra": "median: 2.69ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2585950662014173,
            "unit": "ms",
            "range": 0.1532502183629028,
            "extra": "median: 0.16ms"
          },
          {
            "name": "Total per-slice",
            "value": 15.537331197364793,
            "unit": "ms",
            "range": 44.98374295831238,
            "extra": "median: 3.03ms"
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
            "value": 0.8760481407790371,
            "unit": "#",
            "extra": "std: 0.09199242410216736"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8152466834674152,
            "unit": "#",
            "extra": "std: 0.13304938654347453"
          },
          {
            "name": "memory (df-graph)",
            "value": 99.6448046875,
            "unit": "KiB",
            "range": 113.2159841674677,
            "extra": "median: 49.92"
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
          "id": "cd1e1d6eda1935ec0c9e27945414a6f0cc9f6f71",
          "message": "[release:patch] 2.2.2 Robustify tree-sitter Integration, Resolve-Value Query",
          "timestamp": "2025-02-03T22:15:59+01:00",
          "tree_id": "7347ee4a2c6dea354a58609e36800157ad442359",
          "url": "https://github.com/flowr-analysis/flowr/commit/cd1e1d6eda1935ec0c9e27945414a6f0cc9f6f71"
        },
        "date": 1738618615176,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 249.834723,
            "unit": "ms",
            "range": 46.64301964139698,
            "extra": "median: 229.17ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.9032402,
            "unit": "ms",
            "range": 14.410371386388666,
            "extra": "median: 10.73ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 79.56861864,
            "unit": "ms",
            "range": 75.38089905764774,
            "extra": "median: 38.52ms"
          },
          {
            "name": "Total per-file",
            "value": 7676.563004340001,
            "unit": "ms",
            "range": 30178.520026225517,
            "extra": "median: 1023.55ms"
          },
          {
            "name": "Static slicing",
            "value": 15.385355881913398,
            "unit": "ms",
            "range": 45.537570883658304,
            "extra": "median: 2.71ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2986068961094413,
            "unit": "ms",
            "range": 0.1649446516182493,
            "extra": "median: 0.20ms"
          },
          {
            "name": "Total per-slice",
            "value": 15.692704446118183,
            "unit": "ms",
            "range": 45.564863805695474,
            "extra": "median: 2.93ms"
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
            "value": 0.8760481407790371,
            "unit": "#",
            "extra": "std: 0.09199242410216736"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8152466834674152,
            "unit": "#",
            "extra": "std: 0.13304938654347453"
          },
          {
            "name": "memory (df-graph)",
            "value": 99.6448046875,
            "unit": "KiB",
            "range": 113.2159841674677,
            "extra": "median: 49.92"
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
          "id": "dbb424a89673eb3ceb9077854f1545a9bdf4116c",
          "message": "[release:patch] 2.2.3 Improved Documentation, Tree-Sitter with Meta-Information, Minor Bug-Fixes",
          "timestamp": "2025-02-12T17:46:46+01:00",
          "tree_id": "5578ec5eba5c03ad576b45205a32a8467fbcc9de",
          "url": "https://github.com/flowr-analysis/flowr/commit/dbb424a89673eb3ceb9077854f1545a9bdf4116c"
        },
        "date": 1739379899080,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 240.53834136,
            "unit": "ms",
            "range": 44.403378570471475,
            "extra": "median: 221.06ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.56012626,
            "unit": "ms",
            "range": 13.755764851072687,
            "extra": "median: 10.41ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 78.38113166,
            "unit": "ms",
            "range": 72.02476055851989,
            "extra": "median: 38.60ms"
          },
          {
            "name": "Total per-file",
            "value": 7571.22196178,
            "unit": "ms",
            "range": 30128.105092398102,
            "extra": "median: 1004.55ms"
          },
          {
            "name": "Static slicing",
            "value": 15.212406253695903,
            "unit": "ms",
            "range": 45.4346849220547,
            "extra": "median: 2.56ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.24474538664746154,
            "unit": "ms",
            "range": 0.14868831866711876,
            "extra": "median: 0.15ms"
          },
          {
            "name": "Total per-slice",
            "value": 15.464618232062096,
            "unit": "ms",
            "range": 45.46448728825064,
            "extra": "median: 2.88ms"
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
            "value": 0.8760481407790371,
            "unit": "#",
            "extra": "std: 0.09199242410216736"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8152466834674152,
            "unit": "#",
            "extra": "std: 0.13304938654347453"
          },
          {
            "name": "memory (df-graph)",
            "value": 99.6448046875,
            "unit": "KiB",
            "range": 113.2159841674677,
            "extra": "median: 49.92"
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
          "id": "0b7d7a153620a982b5749df49e1ec8a64493628e",
          "message": "[release:patch] 2.2.4 Improved Docs and Dependency Query",
          "timestamp": "2025-02-16T21:03:26+01:00",
          "tree_id": "0d08f609af1a3799ace8492817ea2598d782040c",
          "url": "https://github.com/flowr-analysis/flowr/commit/0b7d7a153620a982b5749df49e1ec8a64493628e"
        },
        "date": 1739737374142,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 220.27321678,
            "unit": "ms",
            "range": 46.82965394587724,
            "extra": "median: 200.07ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.531466239999997,
            "unit": "ms",
            "range": 14.246504778179132,
            "extra": "median: 10.28ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 78.0078909,
            "unit": "ms",
            "range": 73.12117437668333,
            "extra": "median: 36.67ms"
          },
          {
            "name": "Total per-file",
            "value": 7563.336846300001,
            "unit": "ms",
            "range": 29674.629215149285,
            "extra": "median: 1039.56ms"
          },
          {
            "name": "Static slicing",
            "value": 15.191619080456112,
            "unit": "ms",
            "range": 44.766208586979474,
            "extra": "median: 2.78ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.288708909703299,
            "unit": "ms",
            "range": 0.16023843601492307,
            "extra": "median: 0.19ms"
          },
          {
            "name": "Total per-slice",
            "value": 15.489022970033698,
            "unit": "ms",
            "range": 44.79458478419601,
            "extra": "median: 2.95ms"
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
            "value": 0.8760481407790371,
            "unit": "#",
            "extra": "std: 0.09199242410216736"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8152466834674152,
            "unit": "#",
            "extra": "std: 0.13304938654347453"
          },
          {
            "name": "memory (df-graph)",
            "value": 99.6448046875,
            "unit": "KiB",
            "range": 113.2159841674677,
            "extra": "median: 49.92"
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
          "id": "835a7fe83c22f74a0ee757f71b8316aaabd188cf",
          "message": "[release:patch] 2.2.5 Fix: Defer path retrieveal for the REPL",
          "timestamp": "2025-02-17T08:58:39+01:00",
          "tree_id": "c96e6d2e89ee124bf63946bf4f3a181acf9ef09f",
          "url": "https://github.com/flowr-analysis/flowr/commit/835a7fe83c22f74a0ee757f71b8316aaabd188cf"
        },
        "date": 1739780250170,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 216.92183998,
            "unit": "ms",
            "range": 45.251659077825366,
            "extra": "median: 195.40ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.285922239999998,
            "unit": "ms",
            "range": 13.98118011233093,
            "extra": "median: 10.39ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 77.23644942,
            "unit": "ms",
            "range": 72.12963160290835,
            "extra": "median: 39.53ms"
          },
          {
            "name": "Total per-file",
            "value": 7506.43394872,
            "unit": "ms",
            "range": 29552.15593860494,
            "extra": "median: 994.07ms"
          },
          {
            "name": "Static slicing",
            "value": 15.09422952472583,
            "unit": "ms",
            "range": 44.61996398020867,
            "extra": "median: 2.78ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.253677424314995,
            "unit": "ms",
            "range": 0.14861340904161055,
            "extra": "median: 0.15ms"
          },
          {
            "name": "Total per-slice",
            "value": 15.355486703079794,
            "unit": "ms",
            "range": 44.65737249341717,
            "extra": "median: 3.13ms"
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
            "value": 0.8760481407790371,
            "unit": "#",
            "extra": "std: 0.09199242410216736"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8152466834674152,
            "unit": "#",
            "extra": "std: 0.13304938654347453"
          },
          {
            "name": "memory (df-graph)",
            "value": 99.6448046875,
            "unit": "KiB",
            "range": 113.2159841674677,
            "extra": "median: 49.92"
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
          "id": "249a580b3ef3ccb312dd441497fbf826284d47ee",
          "message": "[release:patch] 2.2.6 Dependency Query traces Linked Ids",
          "timestamp": "2025-02-19T08:57:38+01:00",
          "tree_id": "ae91cc47ca0ce353491ce3914ba8783351196c48",
          "url": "https://github.com/flowr-analysis/flowr/commit/249a580b3ef3ccb312dd441497fbf826284d47ee"
        },
        "date": 1739952922749,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 243.00649506,
            "unit": "ms",
            "range": 44.74592591193767,
            "extra": "median: 220.79ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.9437914,
            "unit": "ms",
            "range": 13.547821539602324,
            "extra": "median: 10.21ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 76.63880958,
            "unit": "ms",
            "range": 71.32447729731284,
            "extra": "median: 34.77ms"
          },
          {
            "name": "Total per-file",
            "value": 7440.85352906,
            "unit": "ms",
            "range": 29317.711247364838,
            "extra": "median: 991.25ms"
          },
          {
            "name": "Static slicing",
            "value": 14.982702404812276,
            "unit": "ms",
            "range": 44.2192703392622,
            "extra": "median: 2.73ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.24269864672214714,
            "unit": "ms",
            "range": 0.1476995408422871,
            "extra": "median: 0.15ms"
          },
          {
            "name": "Total per-slice",
            "value": 15.23310980706151,
            "unit": "ms",
            "range": 44.25097252376832,
            "extra": "median: 2.91ms"
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
            "value": 0.8760481407790371,
            "unit": "#",
            "extra": "std: 0.09199242410216736"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8152466834674152,
            "unit": "#",
            "extra": "std: 0.13304938654347453"
          },
          {
            "name": "memory (df-graph)",
            "value": 99.6448046875,
            "unit": "KiB",
            "range": 113.2159841674677,
            "extra": "median: 49.92"
          }
        ]
      },
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
          "id": "cd8033c600da5ca9fa76d76ddbb8a333eebff0de",
          "message": "[release:patch] 2.2.7 Fix: Value-Resolve and Tree-Sitter Logs",
          "timestamp": "2025-02-19T16:15:30+01:00",
          "tree_id": "e99eb6a373e88c700fb1482c8a485fc9f1946343",
          "url": "https://github.com/flowr-analysis/flowr/commit/cd8033c600da5ca9fa76d76ddbb8a333eebff0de"
        },
        "date": 1739979645805,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 247.67860588,
            "unit": "ms",
            "range": 48.509943331247754,
            "extra": "median: 224.24ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.661095879999998,
            "unit": "ms",
            "range": 14.257613118894241,
            "extra": "median: 11.10ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 79.45499164,
            "unit": "ms",
            "range": 75.92749746986998,
            "extra": "median: 36.77ms"
          },
          {
            "name": "Total per-file",
            "value": 7694.31968308,
            "unit": "ms",
            "range": 30346.750497209567,
            "extra": "median: 1029.73ms"
          },
          {
            "name": "Static slicing",
            "value": 15.390951914131783,
            "unit": "ms",
            "range": 45.73405252975975,
            "extra": "median: 2.83ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2944391060277477,
            "unit": "ms",
            "range": 0.1583656239314177,
            "extra": "median: 0.18ms"
          },
          {
            "name": "Total per-slice",
            "value": 15.694063863147763,
            "unit": "ms",
            "range": 45.76381372073752,
            "extra": "median: 3.21ms"
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
            "value": 0.8760481407790371,
            "unit": "#",
            "extra": "std: 0.09199242410216736"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8152466834674152,
            "unit": "#",
            "extra": "std: 0.13304938654347453"
          },
          {
            "name": "memory (df-graph)",
            "value": 99.6448046875,
            "unit": "KiB",
            "range": 113.2159841674677,
            "extra": "median: 49.92"
          }
        ]
      },
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
          "id": "70a1add623b504582b9e96fccadfac16682ab4f1",
          "message": "[release:patch] 2.2.8 Lax Parsing Mode for Tree-Sitter",
          "timestamp": "2025-02-19T17:56:51+01:00",
          "tree_id": "36fbb1b610643bc6bec61c54a73a2d34e633b122",
          "url": "https://github.com/flowr-analysis/flowr/commit/70a1add623b504582b9e96fccadfac16682ab4f1"
        },
        "date": 1739985544530,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 242.88652534,
            "unit": "ms",
            "range": 43.931951080296045,
            "extra": "median: 219.74ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.2062621,
            "unit": "ms",
            "range": 13.834638409079014,
            "extra": "median: 10.26ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 77.85535254000001,
            "unit": "ms",
            "range": 73.93347323020336,
            "extra": "median: 37.10ms"
          },
          {
            "name": "Total per-file",
            "value": 7591.22023716,
            "unit": "ms",
            "range": 30124.517436257767,
            "extra": "median: 1001.30ms"
          },
          {
            "name": "Static slicing",
            "value": 15.240608882071834,
            "unit": "ms",
            "range": 45.49482609653009,
            "extra": "median: 2.56ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2512380551059409,
            "unit": "ms",
            "range": 0.1495729575586581,
            "extra": "median: 0.17ms"
          },
          {
            "name": "Total per-slice",
            "value": 15.499901884305233,
            "unit": "ms",
            "range": 45.5333861958385,
            "extra": "median: 2.84ms"
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
            "value": 0.8760481407790371,
            "unit": "#",
            "extra": "std: 0.09199242410216736"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8152466834674152,
            "unit": "#",
            "extra": "std: 0.13304938654347453"
          },
          {
            "name": "memory (df-graph)",
            "value": 99.6448046875,
            "unit": "KiB",
            "range": 113.2159841674677,
            "extra": "median: 49.92"
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
          "id": "1f84d99fc4fa1162e8f7a348784b1da07c99710f",
          "message": "[release:patch] 2.2.9 Compressable DFG, Flexible Source",
          "timestamp": "2025-02-21T16:25:06+01:00",
          "tree_id": "d9a49f187f2c82214e4ed249b335fca997ba9745",
          "url": "https://github.com/flowr-analysis/flowr/commit/1f84d99fc4fa1162e8f7a348784b1da07c99710f"
        },
        "date": 1740152586739,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 252.02048136000002,
            "unit": "ms",
            "range": 47.47899487911794,
            "extra": "median: 228.16ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.753034600000003,
            "unit": "ms",
            "range": 14.70788753505142,
            "extra": "median: 10.33ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 79.38735514,
            "unit": "ms",
            "range": 74.50488931699823,
            "extra": "median: 39.46ms"
          },
          {
            "name": "Total per-file",
            "value": 7713.2586013,
            "unit": "ms",
            "range": 30268.546672104236,
            "extra": "median: 1048.14ms"
          },
          {
            "name": "Static slicing",
            "value": 15.441341589484157,
            "unit": "ms",
            "range": 45.68187084909301,
            "extra": "median: 2.71ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.3016789592993709,
            "unit": "ms",
            "range": 0.16252473736163983,
            "extra": "median: 0.20ms"
          },
          {
            "name": "Total per-slice",
            "value": 15.752117260939835,
            "unit": "ms",
            "range": 45.7121334718635,
            "extra": "median: 2.84ms"
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
            "value": 0.8760092470698225,
            "unit": "#",
            "extra": "std: 0.09200251921871941"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8152101167430215,
            "unit": "#",
            "extra": "std: 0.1330554897734756"
          },
          {
            "name": "memory (df-graph)",
            "value": 97.56591796875,
            "unit": "KiB",
            "range": 110.45073981121513,
            "extra": "median: 47.96"
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
          "id": "bf4bbfb7810c7c20c34ad3e6b1f35aeaa138705d",
          "message": "[release:patch] 2.2.10 Fix: Linking Definitions, setNames",
          "timestamp": "2025-02-23T08:56:16+01:00",
          "tree_id": "b69cfbb2aa5171b0c3e7cd54627a4cf7ed8df916",
          "url": "https://github.com/flowr-analysis/flowr/commit/bf4bbfb7810c7c20c34ad3e6b1f35aeaa138705d"
        },
        "date": 1740298491386,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 241.83315842,
            "unit": "ms",
            "range": 44.4035470434997,
            "extra": "median: 221.09ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.9431702,
            "unit": "ms",
            "range": 13.402128412320533,
            "extra": "median: 10.12ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 77.12791532,
            "unit": "ms",
            "range": 71.69721133014396,
            "extra": "median: 38.59ms"
          },
          {
            "name": "Total per-file",
            "value": 7430.74682542,
            "unit": "ms",
            "range": 29182.286949048044,
            "extra": "median: 988.91ms"
          },
          {
            "name": "Static slicing",
            "value": 14.846513771047364,
            "unit": "ms",
            "range": 44.056262504825234,
            "extra": "median: 2.24ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2508021110554898,
            "unit": "ms",
            "range": 0.14703063027462354,
            "extra": "median: 0.15ms"
          },
          {
            "name": "Total per-slice",
            "value": 15.104973454739486,
            "unit": "ms",
            "range": 44.08190332279612,
            "extra": "median: 2.51ms"
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
            "value": 0.8795472153022007,
            "unit": "#",
            "extra": "std: 0.09583760118711787"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8217020591308837,
            "unit": "#",
            "extra": "std: 0.1364653677208263"
          },
          {
            "name": "memory (df-graph)",
            "value": 97.532578125,
            "unit": "KiB",
            "range": 110.47195373340013,
            "extra": "median: 47.96"
          }
        ]
      }
    ],
    "\"artificial\" Benchmark Suite (tree-sitter)": [
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
          "id": "e03f8209a04870aa9fd67af64ef1d5bd138b0162",
          "message": "[release:minor] Tree-Sitter Engine (Release v2.2.0)",
          "timestamp": "2025-01-16T17:07:49+01:00",
          "tree_id": "81d8ed434124b40723bab15b19f8da577a9e0f50",
          "url": "https://github.com/flowr-analysis/flowr/commit/e03f8209a04870aa9fd67af64ef1d5bd138b0162"
        },
        "date": 1737044791416,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 8.262767863636363,
            "unit": "ms",
            "range": 8.5703734833285,
            "extra": "median: 5.75ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.486179954545452,
            "unit": "ms",
            "range": 22.767610409460342,
            "extra": "median: 14.09ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 72.23964218181818,
            "unit": "ms",
            "range": 151.2369029179261,
            "extra": "median: 32.95ms"
          },
          {
            "name": "Total per-file",
            "value": 639.7088135909091,
            "unit": "ms",
            "range": 1431.2470976067677,
            "extra": "median: 179.41ms"
          },
          {
            "name": "Static slicing",
            "value": 2.2450645075842806,
            "unit": "ms",
            "range": 1.712941607180361,
            "extra": "median: 0.73ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.23870037526593374,
            "unit": "ms",
            "range": 0.1893662944360379,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.4990122188659476,
            "unit": "ms",
            "range": 1.7564036014266908,
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
            "value": 0.7891949660994808,
            "unit": "#",
            "extra": "std: 0.1265547989588566"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7665650684287274,
            "unit": "#",
            "extra": "std: 0.13059911524134268"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.19682173295455,
            "unit": "KiB",
            "range": 244.24808975931026,
            "extra": "median: 24.54"
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
          "id": "a877df7af36cbd777d23162a0e1a009e8687de3a",
          "message": "[release:patch] New Happens-Before Query (Release v2.2.1)",
          "timestamp": "2025-01-16T19:36:36+01:00",
          "tree_id": "24f6ef9b2e4fb3189e7f9d9f381c59bf6af84079",
          "url": "https://github.com/flowr-analysis/flowr/commit/a877df7af36cbd777d23162a0e1a009e8687de3a"
        },
        "date": 1737053866493,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 8.145506545454547,
            "unit": "ms",
            "range": 9.786080094734778,
            "extra": "median: 5.48ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.78099590909091,
            "unit": "ms",
            "range": 23.820712056308647,
            "extra": "median: 15.36ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 70.83680254545455,
            "unit": "ms",
            "range": 150.5207252208632,
            "extra": "median: 34.42ms"
          },
          {
            "name": "Total per-file",
            "value": 627.2099676818182,
            "unit": "ms",
            "range": 1407.4477264884629,
            "extra": "median: 181.39ms"
          },
          {
            "name": "Static slicing",
            "value": 2.0248883955065318,
            "unit": "ms",
            "range": 1.1173257361688766,
            "extra": "median: 0.79ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.23812396339689798,
            "unit": "ms",
            "range": 0.1785232875956438,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.2780515267109083,
            "unit": "ms",
            "range": 1.198556469122308,
            "extra": "median: 1.02ms"
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
            "value": 0.7891949660994808,
            "unit": "#",
            "extra": "std: 0.1265547989588566"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7665650684287274,
            "unit": "#",
            "extra": "std: 0.13059911524134268"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.19682173295455,
            "unit": "KiB",
            "range": 244.24808975931026,
            "extra": "median: 24.54"
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
          "id": "cd1e1d6eda1935ec0c9e27945414a6f0cc9f6f71",
          "message": "[release:patch] 2.2.2 Robustify tree-sitter Integration, Resolve-Value Query",
          "timestamp": "2025-02-03T22:15:59+01:00",
          "tree_id": "7347ee4a2c6dea354a58609e36800157ad442359",
          "url": "https://github.com/flowr-analysis/flowr/commit/cd1e1d6eda1935ec0c9e27945414a6f0cc9f6f71"
        },
        "date": 1738618616373,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 7.711460954545454,
            "unit": "ms",
            "range": 8.70094710304562,
            "extra": "median: 5.11ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.98246340909091,
            "unit": "ms",
            "range": 23.415289004552186,
            "extra": "median: 12.92ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 68.4941285,
            "unit": "ms",
            "range": 142.02957347687396,
            "extra": "median: 32.10ms"
          },
          {
            "name": "Total per-file",
            "value": 602.4039685454545,
            "unit": "ms",
            "range": 1374.7365030011194,
            "extra": "median: 169.36ms"
          },
          {
            "name": "Static slicing",
            "value": 2.029322511028924,
            "unit": "ms",
            "range": 1.1260251486281259,
            "extra": "median: 0.76ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.22072200455387958,
            "unit": "ms",
            "range": 0.17277778386930323,
            "extra": "median: 0.09ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.262645207724198,
            "unit": "ms",
            "range": 1.1896836514820142,
            "extra": "median: 0.95ms"
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
            "value": 0.7891949660994808,
            "unit": "#",
            "extra": "std: 0.1265547989588566"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7665650684287274,
            "unit": "#",
            "extra": "std: 0.13059911524134268"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.19682173295455,
            "unit": "KiB",
            "range": 244.24808975931026,
            "extra": "median: 24.54"
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
          "id": "dbb424a89673eb3ceb9077854f1545a9bdf4116c",
          "message": "[release:patch] 2.2.3 Improved Documentation, Tree-Sitter with Meta-Information, Minor Bug-Fixes",
          "timestamp": "2025-02-12T17:46:46+01:00",
          "tree_id": "5578ec5eba5c03ad576b45205a32a8467fbcc9de",
          "url": "https://github.com/flowr-analysis/flowr/commit/dbb424a89673eb3ceb9077854f1545a9bdf4116c"
        },
        "date": 1739379900189,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 12.842791727272727,
            "unit": "ms",
            "range": 16.181786708497913,
            "extra": "median: 9.04ms"
          },
          {
            "name": "Normalize R AST",
            "value": 14.331072681818181,
            "unit": "ms",
            "range": 19.71728647065712,
            "extra": "median: 10.71ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 74.67082990909091,
            "unit": "ms",
            "range": 165.61645442564256,
            "extra": "median: 36.37ms"
          },
          {
            "name": "Total per-file",
            "value": 613.9104531818182,
            "unit": "ms",
            "range": 1412.7933283316297,
            "extra": "median: 174.12ms"
          },
          {
            "name": "Static slicing",
            "value": 1.994018839046101,
            "unit": "ms",
            "range": 1.082092681493097,
            "extra": "median: 0.73ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.22893544883727432,
            "unit": "ms",
            "range": 0.17082023672434832,
            "extra": "median: 0.09ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.2359297759714156,
            "unit": "ms",
            "range": 1.1547970268451515,
            "extra": "median: 1.01ms"
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
            "value": 0.7891949660994808,
            "unit": "#",
            "extra": "std: 0.1265547989588566"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7665650684287274,
            "unit": "#",
            "extra": "std: 0.13059911524134268"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.19682173295455,
            "unit": "KiB",
            "range": 244.24808975931026,
            "extra": "median: 24.54"
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
          "id": "0b7d7a153620a982b5749df49e1ec8a64493628e",
          "message": "[release:patch] 2.2.4 Improved Docs and Dependency Query",
          "timestamp": "2025-02-16T21:03:26+01:00",
          "tree_id": "0d08f609af1a3799ace8492817ea2598d782040c",
          "url": "https://github.com/flowr-analysis/flowr/commit/0b7d7a153620a982b5749df49e1ec8a64493628e"
        },
        "date": 1739737376591,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 12.601416272727274,
            "unit": "ms",
            "range": 14.97959944086354,
            "extra": "median: 9.07ms"
          },
          {
            "name": "Normalize R AST",
            "value": 15.467657590909091,
            "unit": "ms",
            "range": 20.549420024882878,
            "extra": "median: 11.13ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 71.0771050909091,
            "unit": "ms",
            "range": 146.43770789832362,
            "extra": "median: 40.67ms"
          },
          {
            "name": "Total per-file",
            "value": 641.727329,
            "unit": "ms",
            "range": 1409.9818627965026,
            "extra": "median: 202.78ms"
          },
          {
            "name": "Static slicing",
            "value": 2.0341113171085574,
            "unit": "ms",
            "range": 1.7028549829060942,
            "extra": "median: 0.75ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2229978361904897,
            "unit": "ms",
            "range": 0.17074180799747485,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.2695481645882287,
            "unit": "ms",
            "range": 1.7836182018958542,
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
            "value": 0.7891949660994808,
            "unit": "#",
            "extra": "std: 0.1265547989588566"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7665650684287274,
            "unit": "#",
            "extra": "std: 0.13059911524134268"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.19682173295455,
            "unit": "KiB",
            "range": 244.24808975931026,
            "extra": "median: 24.54"
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
          "id": "835a7fe83c22f74a0ee757f71b8316aaabd188cf",
          "message": "[release:patch] 2.2.5 Fix: Defer path retrieveal for the REPL",
          "timestamp": "2025-02-17T08:58:39+01:00",
          "tree_id": "c96e6d2e89ee124bf63946bf4f3a181acf9ef09f",
          "url": "https://github.com/flowr-analysis/flowr/commit/835a7fe83c22f74a0ee757f71b8316aaabd188cf"
        },
        "date": 1739780251245,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 13.1704555,
            "unit": "ms",
            "range": 14.886561426402102,
            "extra": "median: 9.25ms"
          },
          {
            "name": "Normalize R AST",
            "value": 15.083565227272727,
            "unit": "ms",
            "range": 19.116409267489242,
            "extra": "median: 11.54ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 69.23526513636364,
            "unit": "ms",
            "range": 141.47346750382252,
            "extra": "median: 37.15ms"
          },
          {
            "name": "Total per-file",
            "value": 637.6376034090908,
            "unit": "ms",
            "range": 1395.3094882795247,
            "extra": "median: 205.46ms"
          },
          {
            "name": "Static slicing",
            "value": 2.0535378404784166,
            "unit": "ms",
            "range": 1.8561101393687005,
            "extra": "median: 0.70ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.22297446507133262,
            "unit": "ms",
            "range": 0.17951220360835665,
            "extra": "median: 0.09ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.2886915445838607,
            "unit": "ms",
            "range": 1.9453929104238457,
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
            "value": 0.7891949660994808,
            "unit": "#",
            "extra": "std: 0.1265547989588566"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7665650684287274,
            "unit": "#",
            "extra": "std: 0.13059911524134268"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.19682173295455,
            "unit": "KiB",
            "range": 244.24808975931026,
            "extra": "median: 24.54"
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
          "id": "249a580b3ef3ccb312dd441497fbf826284d47ee",
          "message": "[release:patch] 2.2.6 Dependency Query traces Linked Ids",
          "timestamp": "2025-02-19T08:57:38+01:00",
          "tree_id": "ae91cc47ca0ce353491ce3914ba8783351196c48",
          "url": "https://github.com/flowr-analysis/flowr/commit/249a580b3ef3ccb312dd441497fbf826284d47ee"
        },
        "date": 1739952923863,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 12.439350636363637,
            "unit": "ms",
            "range": 14.356474791834938,
            "extra": "median: 9.12ms"
          },
          {
            "name": "Normalize R AST",
            "value": 13.807416090909092,
            "unit": "ms",
            "range": 18.515899802442362,
            "extra": "median: 9.92ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 70.17132818181818,
            "unit": "ms",
            "range": 145.04372850719952,
            "extra": "median: 33.31ms"
          },
          {
            "name": "Total per-file",
            "value": 607.5059199545454,
            "unit": "ms",
            "range": 1388.1568066538102,
            "extra": "median: 176.09ms"
          },
          {
            "name": "Static slicing",
            "value": 2.0624045578521035,
            "unit": "ms",
            "range": 1.5675771657048543,
            "extra": "median: 0.65ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.21728305816779314,
            "unit": "ms",
            "range": 0.16822920200783062,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.2935225788087292,
            "unit": "ms",
            "range": 1.6200185382157157,
            "extra": "median: 0.97ms"
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
            "value": 0.7891949660994808,
            "unit": "#",
            "extra": "std: 0.1265547989588566"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7665650684287274,
            "unit": "#",
            "extra": "std: 0.13059911524134268"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.19682173295455,
            "unit": "KiB",
            "range": 244.24808975931026,
            "extra": "median: 24.54"
          }
        ]
      },
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
          "id": "cd8033c600da5ca9fa76d76ddbb8a333eebff0de",
          "message": "[release:patch] 2.2.7 Fix: Value-Resolve and Tree-Sitter Logs",
          "timestamp": "2025-02-19T16:15:30+01:00",
          "tree_id": "e99eb6a373e88c700fb1482c8a485fc9f1946343",
          "url": "https://github.com/flowr-analysis/flowr/commit/cd8033c600da5ca9fa76d76ddbb8a333eebff0de"
        },
        "date": 1739979654417,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 13.217839272727273,
            "unit": "ms",
            "range": 16.16182369008521,
            "extra": "median: 9.32ms"
          },
          {
            "name": "Normalize R AST",
            "value": 15.132112636363637,
            "unit": "ms",
            "range": 21.665826529763997,
            "extra": "median: 10.21ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 68.71533745454545,
            "unit": "ms",
            "range": 145.826541336855,
            "extra": "median: 32.41ms"
          },
          {
            "name": "Total per-file",
            "value": 615.2478953181819,
            "unit": "ms",
            "range": 1415.421781475568,
            "extra": "median: 179.87ms"
          },
          {
            "name": "Static slicing",
            "value": 2.0239067541930917,
            "unit": "ms",
            "range": 1.1773405526017109,
            "extra": "median: 0.78ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2367227016911668,
            "unit": "ms",
            "range": 0.19189685326968384,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.2742497236387744,
            "unit": "ms",
            "range": 1.252417778297747,
            "extra": "median: 0.97ms"
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
            "value": 0.7891949660994808,
            "unit": "#",
            "extra": "std: 0.1265547989588566"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7665650684287274,
            "unit": "#",
            "extra": "std: 0.13059911524134268"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.19682173295455,
            "unit": "KiB",
            "range": 244.24808975931026,
            "extra": "median: 24.54"
          }
        ]
      },
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
          "id": "70a1add623b504582b9e96fccadfac16682ab4f1",
          "message": "[release:patch] 2.2.8 Lax Parsing Mode for Tree-Sitter",
          "timestamp": "2025-02-19T17:56:51+01:00",
          "tree_id": "36fbb1b610643bc6bec61c54a73a2d34e633b122",
          "url": "https://github.com/flowr-analysis/flowr/commit/70a1add623b504582b9e96fccadfac16682ab4f1"
        },
        "date": 1739985545588,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 12.853206909090908,
            "unit": "ms",
            "range": 14.721453734770503,
            "extra": "median: 9.58ms"
          },
          {
            "name": "Normalize R AST",
            "value": 14.439020590909092,
            "unit": "ms",
            "range": 19.789514146463954,
            "extra": "median: 10.07ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 68.56369981818182,
            "unit": "ms",
            "range": 142.66285096404548,
            "extra": "median: 36.51ms"
          },
          {
            "name": "Total per-file",
            "value": 603.7908477272728,
            "unit": "ms",
            "range": 1376.4721773575084,
            "extra": "median: 171.55ms"
          },
          {
            "name": "Static slicing",
            "value": 1.9673874303239716,
            "unit": "ms",
            "range": 1.1381969516740362,
            "extra": "median: 0.77ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2213917943008187,
            "unit": "ms",
            "range": 0.17498376423688367,
            "extra": "median: 0.09ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.2018391657699365,
            "unit": "ms",
            "range": 1.2151001420635426,
            "extra": "median: 0.99ms"
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
            "value": 0.7891949660994808,
            "unit": "#",
            "extra": "std: 0.1265547989588566"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7665650684287274,
            "unit": "#",
            "extra": "std: 0.13059911524134268"
          },
          {
            "name": "memory (df-graph)",
            "value": 95.19682173295455,
            "unit": "KiB",
            "range": 244.24808975931026,
            "extra": "median: 24.54"
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
          "id": "1f84d99fc4fa1162e8f7a348784b1da07c99710f",
          "message": "[release:patch] 2.2.9 Compressable DFG, Flexible Source",
          "timestamp": "2025-02-21T16:25:06+01:00",
          "tree_id": "d9a49f187f2c82214e4ed249b335fca997ba9745",
          "url": "https://github.com/flowr-analysis/flowr/commit/1f84d99fc4fa1162e8f7a348784b1da07c99710f"
        },
        "date": 1740152587830,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 12.600458590909092,
            "unit": "ms",
            "range": 14.77715766470141,
            "extra": "median: 8.85ms"
          },
          {
            "name": "Normalize R AST",
            "value": 14.912504272727274,
            "unit": "ms",
            "range": 22.3427798099717,
            "extra": "median: 8.04ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 68.28944886363637,
            "unit": "ms",
            "range": 146.32384385592619,
            "extra": "median: 31.61ms"
          },
          {
            "name": "Total per-file",
            "value": 602.8016551818181,
            "unit": "ms",
            "range": 1378.216005730469,
            "extra": "median: 175.41ms"
          },
          {
            "name": "Static slicing",
            "value": 2.0685282858702383,
            "unit": "ms",
            "range": 1.1714062288474139,
            "extra": "median: 0.74ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2262772986999621,
            "unit": "ms",
            "range": 0.1805531265124713,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.3079925672237933,
            "unit": "ms",
            "range": 1.2719385820141482,
            "extra": "median: 0.98ms"
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
            "value": 0.7891949660994808,
            "unit": "#",
            "extra": "std: 0.1265547989588566"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7665650684287274,
            "unit": "#",
            "extra": "std: 0.13059911524134268"
          },
          {
            "name": "memory (df-graph)",
            "value": 94.41273082386364,
            "unit": "KiB",
            "range": 242.01994311782988,
            "extra": "median: 24.54"
          }
        ]
      }
    ],
    "\"social-science\" Benchmark Suite (tree-sitter)": [
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
          "id": "e03f8209a04870aa9fd67af64ef1d5bd138b0162",
          "message": "[release:minor] Tree-Sitter Engine (Release v2.2.0)",
          "timestamp": "2025-01-16T17:07:49+01:00",
          "tree_id": "81d8ed434124b40723bab15b19f8da577a9e0f50",
          "url": "https://github.com/flowr-analysis/flowr/commit/e03f8209a04870aa9fd67af64ef1d5bd138b0162"
        },
        "date": 1737044792331,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 10.664225155555556,
            "unit": "ms",
            "range": 6.709500394419908,
            "extra": "median: 7.58ms"
          },
          {
            "name": "Normalize R AST",
            "value": 24.379417555555555,
            "unit": "ms",
            "range": 12.399567059680663,
            "extra": "median: 19.59ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 79.22320886666665,
            "unit": "ms",
            "range": 67.4010397733899,
            "extra": "median: 39.69ms"
          },
          {
            "name": "Total per-file",
            "value": 7647.276617733333,
            "unit": "ms",
            "range": 31040.60328747663,
            "extra": "median: 785.66ms"
          },
          {
            "name": "Static slicing",
            "value": 16.01762948847355,
            "unit": "ms",
            "range": 46.12637124725645,
            "extra": "median: 3.13ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.27361086343124025,
            "unit": "ms",
            "range": 0.1623679162176804,
            "extra": "median: 0.17ms"
          },
          {
            "name": "Total per-slice",
            "value": 16.299155832326004,
            "unit": "ms",
            "range": 46.16463688479813,
            "extra": "median: 3.30ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 0,
            "unit": "#",
            "extra": "out of 11224 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8685107303274813,
            "unit": "#",
            "extra": "std: 0.0931222279627942"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8049905198879769,
            "unit": "#",
            "extra": "std: 0.13483475175243118"
          },
          {
            "name": "memory (df-graph)",
            "value": 97.50590277777778,
            "unit": "KiB",
            "range": 111.14577334743846,
            "extra": "median: 49.92"
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
          "id": "a877df7af36cbd777d23162a0e1a009e8687de3a",
          "message": "[release:patch] New Happens-Before Query (Release v2.2.1)",
          "timestamp": "2025-01-16T19:36:36+01:00",
          "tree_id": "24f6ef9b2e4fb3189e7f9d9f381c59bf6af84079",
          "url": "https://github.com/flowr-analysis/flowr/commit/a877df7af36cbd777d23162a0e1a009e8687de3a"
        },
        "date": 1737053867721,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 10.4682258,
            "unit": "ms",
            "range": 6.536909762375299,
            "extra": "median: 7.28ms"
          },
          {
            "name": "Normalize R AST",
            "value": 23.515930466666664,
            "unit": "ms",
            "range": 11.460003796895084,
            "extra": "median: 19.58ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 77.72576402222222,
            "unit": "ms",
            "range": 66.68368526289126,
            "extra": "median: 38.65ms"
          },
          {
            "name": "Total per-file",
            "value": 7557.427238355555,
            "unit": "ms",
            "range": 30739.010883053157,
            "extra": "median: 752.84ms"
          },
          {
            "name": "Static slicing",
            "value": 15.83153546219062,
            "unit": "ms",
            "range": 45.672079288893144,
            "extra": "median: 3.00ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2510293465879067,
            "unit": "ms",
            "range": 0.15539877495324173,
            "extra": "median: 0.15ms"
          },
          {
            "name": "Total per-slice",
            "value": 16.090141405670494,
            "unit": "ms",
            "range": 45.71466701697095,
            "extra": "median: 3.19ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 0,
            "unit": "#",
            "extra": "out of 11224 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8685107303274813,
            "unit": "#",
            "extra": "std: 0.0931222279627942"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8049905198879769,
            "unit": "#",
            "extra": "std: 0.13483475175243118"
          },
          {
            "name": "memory (df-graph)",
            "value": 97.50590277777778,
            "unit": "KiB",
            "range": 111.14577334743846,
            "extra": "median: 49.92"
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
          "id": "cd1e1d6eda1935ec0c9e27945414a6f0cc9f6f71",
          "message": "[release:patch] 2.2.2 Robustify tree-sitter Integration, Resolve-Value Query",
          "timestamp": "2025-02-03T22:15:59+01:00",
          "tree_id": "7347ee4a2c6dea354a58609e36800157ad442359",
          "url": "https://github.com/flowr-analysis/flowr/commit/cd1e1d6eda1935ec0c9e27945414a6f0cc9f6f71"
        },
        "date": 1738618617675,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 10.333295439999999,
            "unit": "ms",
            "range": 6.515061193149318,
            "extra": "median: 7.30ms"
          },
          {
            "name": "Normalize R AST",
            "value": 23.85117408,
            "unit": "ms",
            "range": 12.018059372944569,
            "extra": "median: 19.86ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 80.4126023,
            "unit": "ms",
            "range": 72.68460324105622,
            "extra": "median: 39.17ms"
          },
          {
            "name": "Total per-file",
            "value": 7354.647594939999,
            "unit": "ms",
            "range": 29937.69999077122,
            "extra": "median: 744.33ms"
          },
          {
            "name": "Static slicing",
            "value": 15.202236281349057,
            "unit": "ms",
            "range": 45.22344469924519,
            "extra": "median: 2.53ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2588813527737264,
            "unit": "ms",
            "range": 0.16035362524225383,
            "extra": "median: 0.13ms"
          },
          {
            "name": "Total per-slice",
            "value": 15.468953306497948,
            "unit": "ms",
            "range": 45.26474140541222,
            "extra": "median: 2.79ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 0,
            "unit": "#",
            "extra": "out of 12700 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8752607999898916,
            "unit": "#",
            "extra": "std: 0.092607802301171"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8150427620394497,
            "unit": "#",
            "extra": "std: 0.13344495673238044"
          },
          {
            "name": "memory (df-graph)",
            "value": 99.6003515625,
            "unit": "KiB",
            "range": 113.23180421291488,
            "extra": "median: 49.92"
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
          "id": "dbb424a89673eb3ceb9077854f1545a9bdf4116c",
          "message": "[release:patch] 2.2.3 Improved Documentation, Tree-Sitter with Meta-Information, Minor Bug-Fixes",
          "timestamp": "2025-02-12T17:46:46+01:00",
          "tree_id": "5578ec5eba5c03ad576b45205a32a8467fbcc9de",
          "url": "https://github.com/flowr-analysis/flowr/commit/dbb424a89673eb3ceb9077854f1545a9bdf4116c"
        },
        "date": 1739379901500,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 18.955982940000002,
            "unit": "ms",
            "range": 11.286742384816787,
            "extra": "median: 13.85ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.95284476,
            "unit": "ms",
            "range": 10.337826794056342,
            "extra": "median: 16.67ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 81.72275382,
            "unit": "ms",
            "range": 73.32590045655509,
            "extra": "median: 42.61ms"
          },
          {
            "name": "Total per-file",
            "value": 7391.1851669,
            "unit": "ms",
            "range": 29681.523316961993,
            "extra": "median: 751.73ms"
          },
          {
            "name": "Static slicing",
            "value": 15.22962818185736,
            "unit": "ms",
            "range": 44.920584352782775,
            "extra": "median: 2.78ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2979700390619409,
            "unit": "ms",
            "range": 0.17291096655094218,
            "extra": "median: 0.20ms"
          },
          {
            "name": "Total per-slice",
            "value": 15.536254324544688,
            "unit": "ms",
            "range": 44.95819777105582,
            "extra": "median: 2.98ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 0,
            "unit": "#",
            "extra": "out of 12700 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8752607999898916,
            "unit": "#",
            "extra": "std: 0.092607802301171"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8150427620394497,
            "unit": "#",
            "extra": "std: 0.13344495673238044"
          },
          {
            "name": "memory (df-graph)",
            "value": 99.6003515625,
            "unit": "KiB",
            "range": 113.23180421291488,
            "extra": "median: 49.92"
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
          "id": "0b7d7a153620a982b5749df49e1ec8a64493628e",
          "message": "[release:patch] 2.2.4 Improved Docs and Dependency Query",
          "timestamp": "2025-02-16T21:03:26+01:00",
          "tree_id": "0d08f609af1a3799ace8492817ea2598d782040c",
          "url": "https://github.com/flowr-analysis/flowr/commit/0b7d7a153620a982b5749df49e1ec8a64493628e"
        },
        "date": 1739737378003,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 18.73123716,
            "unit": "ms",
            "range": 11.87710349442098,
            "extra": "median: 13.16ms"
          },
          {
            "name": "Normalize R AST",
            "value": 20.38790076,
            "unit": "ms",
            "range": 11.783119912545551,
            "extra": "median: 15.23ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 80.70971478,
            "unit": "ms",
            "range": 72.54428717461924,
            "extra": "median: 40.78ms"
          },
          {
            "name": "Total per-file",
            "value": 7333.3027802,
            "unit": "ms",
            "range": 29841.136093718524,
            "extra": "median: 765.45ms"
          },
          {
            "name": "Static slicing",
            "value": 15.108615542662598,
            "unit": "ms",
            "range": 45.06589071883227,
            "extra": "median: 2.62ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.23758964408884647,
            "unit": "ms",
            "range": 0.15451563945089677,
            "extra": "median: 0.14ms"
          },
          {
            "name": "Total per-slice",
            "value": 15.353724249863333,
            "unit": "ms",
            "range": 45.10359830891174,
            "extra": "median: 2.86ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 0,
            "unit": "#",
            "extra": "out of 12700 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8752607999898916,
            "unit": "#",
            "extra": "std: 0.092607802301171"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8150427620394497,
            "unit": "#",
            "extra": "std: 0.13344495673238044"
          },
          {
            "name": "memory (df-graph)",
            "value": 99.6003515625,
            "unit": "KiB",
            "range": 113.23180421291488,
            "extra": "median: 49.92"
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
          "id": "835a7fe83c22f74a0ee757f71b8316aaabd188cf",
          "message": "[release:patch] 2.2.5 Fix: Defer path retrieveal for the REPL",
          "timestamp": "2025-02-17T08:58:39+01:00",
          "tree_id": "c96e6d2e89ee124bf63946bf4f3a181acf9ef09f",
          "url": "https://github.com/flowr-analysis/flowr/commit/835a7fe83c22f74a0ee757f71b8316aaabd188cf"
        },
        "date": 1739780262522,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 18.729504239999997,
            "unit": "ms",
            "range": 10.990515663312468,
            "extra": "median: 15.19ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.49718888,
            "unit": "ms",
            "range": 9.565143829513476,
            "extra": "median: 16.36ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 79.4717109,
            "unit": "ms",
            "range": 71.73266200302905,
            "extra": "median: 40.83ms"
          },
          {
            "name": "Total per-file",
            "value": 7319.29140234,
            "unit": "ms",
            "range": 29546.909262458266,
            "extra": "median: 776.81ms"
          },
          {
            "name": "Static slicing",
            "value": 15.086546098435148,
            "unit": "ms",
            "range": 44.63847921660834,
            "extra": "median: 2.52ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2530436529336143,
            "unit": "ms",
            "range": 0.14829267951622266,
            "extra": "median: 0.17ms"
          },
          {
            "name": "Total per-slice",
            "value": 15.348006188630853,
            "unit": "ms",
            "range": 44.67726736910317,
            "extra": "median: 2.86ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 0,
            "unit": "#",
            "extra": "out of 12700 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8752607999898916,
            "unit": "#",
            "extra": "std: 0.092607802301171"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8150427620394497,
            "unit": "#",
            "extra": "std: 0.13344495673238044"
          },
          {
            "name": "memory (df-graph)",
            "value": 99.6003515625,
            "unit": "KiB",
            "range": 113.23180421291488,
            "extra": "median: 49.92"
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
          "id": "249a580b3ef3ccb312dd441497fbf826284d47ee",
          "message": "[release:patch] 2.2.6 Dependency Query traces Linked Ids",
          "timestamp": "2025-02-19T08:57:38+01:00",
          "tree_id": "ae91cc47ca0ce353491ce3914ba8783351196c48",
          "url": "https://github.com/flowr-analysis/flowr/commit/249a580b3ef3ccb312dd441497fbf826284d47ee"
        },
        "date": 1739952925068,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 18.794790980000002,
            "unit": "ms",
            "range": 11.734044333106606,
            "extra": "median: 13.35ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.50034822,
            "unit": "ms",
            "range": 10.350693386002916,
            "extra": "median: 15.66ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 80.01257659999999,
            "unit": "ms",
            "range": 72.89784388923937,
            "extra": "median: 39.01ms"
          },
          {
            "name": "Total per-file",
            "value": 7297.1661958,
            "unit": "ms",
            "range": 29339.163660662154,
            "extra": "median: 741.77ms"
          },
          {
            "name": "Static slicing",
            "value": 15.066555562702753,
            "unit": "ms",
            "range": 44.334533637109516,
            "extra": "median: 2.70ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.27966026159987006,
            "unit": "ms",
            "range": 0.1628747728206825,
            "extra": "median: 0.14ms"
          },
          {
            "name": "Total per-slice",
            "value": 15.35431809452537,
            "unit": "ms",
            "range": 44.36628277650638,
            "extra": "median: 2.91ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 0,
            "unit": "#",
            "extra": "out of 12700 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8752607999898916,
            "unit": "#",
            "extra": "std: 0.092607802301171"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8150427620394497,
            "unit": "#",
            "extra": "std: 0.13344495673238044"
          },
          {
            "name": "memory (df-graph)",
            "value": 99.6003515625,
            "unit": "KiB",
            "range": 113.23180421291488,
            "extra": "median: 49.92"
          }
        ]
      },
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
          "id": "cd8033c600da5ca9fa76d76ddbb8a333eebff0de",
          "message": "[release:patch] 2.2.7 Fix: Value-Resolve and Tree-Sitter Logs",
          "timestamp": "2025-02-19T16:15:30+01:00",
          "tree_id": "e99eb6a373e88c700fb1482c8a485fc9f1946343",
          "url": "https://github.com/flowr-analysis/flowr/commit/cd8033c600da5ca9fa76d76ddbb8a333eebff0de"
        },
        "date": 1739979656777,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 18.70340118,
            "unit": "ms",
            "range": 11.225769721843193,
            "extra": "median: 13.83ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.33950234,
            "unit": "ms",
            "range": 10.270807281625636,
            "extra": "median: 15.92ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 79.99668102,
            "unit": "ms",
            "range": 70.37920066183219,
            "extra": "median: 46.98ms"
          },
          {
            "name": "Total per-file",
            "value": 7279.88924012,
            "unit": "ms",
            "range": 29496.212299290928,
            "extra": "median: 748.47ms"
          },
          {
            "name": "Static slicing",
            "value": 15.039382628218211,
            "unit": "ms",
            "range": 44.57192931730138,
            "extra": "median: 2.62ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2533635890842854,
            "unit": "ms",
            "range": 0.16339113269360692,
            "extra": "median: 0.15ms"
          },
          {
            "name": "Total per-slice",
            "value": 15.300393360916553,
            "unit": "ms",
            "range": 44.60949266927637,
            "extra": "median: 3.03ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 0,
            "unit": "#",
            "extra": "out of 12700 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8752607999898916,
            "unit": "#",
            "extra": "std: 0.092607802301171"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8150427620394497,
            "unit": "#",
            "extra": "std: 0.13344495673238044"
          },
          {
            "name": "memory (df-graph)",
            "value": 99.6003515625,
            "unit": "KiB",
            "range": 113.23180421291488,
            "extra": "median: 49.92"
          }
        ]
      },
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
          "id": "70a1add623b504582b9e96fccadfac16682ab4f1",
          "message": "[release:patch] 2.2.8 Lax Parsing Mode for Tree-Sitter",
          "timestamp": "2025-02-19T17:56:51+01:00",
          "tree_id": "36fbb1b610643bc6bec61c54a73a2d34e633b122",
          "url": "https://github.com/flowr-analysis/flowr/commit/70a1add623b504582b9e96fccadfac16682ab4f1"
        },
        "date": 1739985546843,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 18.82702856,
            "unit": "ms",
            "range": 11.201117723285954,
            "extra": "median: 13.97ms"
          },
          {
            "name": "Normalize R AST",
            "value": 20.23346372,
            "unit": "ms",
            "range": 10.750014827166334,
            "extra": "median: 16.86ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 81.74276828,
            "unit": "ms",
            "range": 72.41763453301995,
            "extra": "median: 48.77ms"
          },
          {
            "name": "Total per-file",
            "value": 7390.53153942,
            "unit": "ms",
            "range": 29662.69352976625,
            "extra": "median: 765.94ms"
          },
          {
            "name": "Static slicing",
            "value": 15.227443372955928,
            "unit": "ms",
            "range": 44.801170821184876,
            "extra": "median: 2.72ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.31222961385728,
            "unit": "ms",
            "range": 0.1739894142302109,
            "extra": "median: 0.21ms"
          },
          {
            "name": "Total per-slice",
            "value": 15.548453995364582,
            "unit": "ms",
            "range": 44.83566009408776,
            "extra": "median: 2.96ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 0,
            "unit": "#",
            "extra": "out of 12700 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8752607999898916,
            "unit": "#",
            "extra": "std: 0.092607802301171"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8150427620394497,
            "unit": "#",
            "extra": "std: 0.13344495673238044"
          },
          {
            "name": "memory (df-graph)",
            "value": 99.6003515625,
            "unit": "KiB",
            "range": 113.23180421291488,
            "extra": "median: 49.92"
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
          "id": "1f84d99fc4fa1162e8f7a348784b1da07c99710f",
          "message": "[release:patch] 2.2.9 Compressable DFG, Flexible Source",
          "timestamp": "2025-02-21T16:25:06+01:00",
          "tree_id": "d9a49f187f2c82214e4ed249b335fca997ba9745",
          "url": "https://github.com/flowr-analysis/flowr/commit/1f84d99fc4fa1162e8f7a348784b1da07c99710f"
        },
        "date": 1740152589061,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 18.780396760000002,
            "unit": "ms",
            "range": 11.525749453964497,
            "extra": "median: 13.29ms"
          },
          {
            "name": "Normalize R AST",
            "value": 20.74569386,
            "unit": "ms",
            "range": 10.800170343040865,
            "extra": "median: 16.64ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 82.63362201999999,
            "unit": "ms",
            "range": 72.3853093579683,
            "extra": "median: 49.27ms"
          },
          {
            "name": "Total per-file",
            "value": 7451.73342296,
            "unit": "ms",
            "range": 29862.242113533724,
            "extra": "median: 788.65ms"
          },
          {
            "name": "Static slicing",
            "value": 15.355660329018459,
            "unit": "ms",
            "range": 45.058586640345084,
            "extra": "median: 2.67ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.3251161497261057,
            "unit": "ms",
            "range": 0.17340089951437673,
            "extra": "median: 0.22ms"
          },
          {
            "name": "Total per-slice",
            "value": 15.690002820532685,
            "unit": "ms",
            "range": 45.082297307905115,
            "extra": "median: 3.03ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 0,
            "unit": "#",
            "extra": "out of 12700 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8752218136932163,
            "unit": "#",
            "extra": "std: 0.09261788813461713"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8150061720722629,
            "unit": "#",
            "extra": "std: 0.1334510496094727"
          },
          {
            "name": "memory (df-graph)",
            "value": 97.52146484375,
            "unit": "KiB",
            "range": 110.46646074707529,
            "extra": "median: 47.96"
          }
        ]
      }
    ]
  }
}