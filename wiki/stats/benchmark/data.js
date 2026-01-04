window.BENCHMARK_DATA = {
  "lastUpdate": 1767487682487,
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
          "id": "ae435ebae9cf85e90cdfc73b0e1923e585d59414",
          "message": "[release:patch] 2.2.11 Better Compression, Project Query, Improved Location-Map",
          "timestamp": "2025-03-02T20:17:12+01:00",
          "tree_id": "10d49938f6bed0e336aba3a4b25d6abb70dae7f3",
          "url": "https://github.com/flowr-analysis/flowr/commit/ae435ebae9cf85e90cdfc73b0e1923e585d59414"
        },
        "date": 1740944078030,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 236.71596431818182,
            "unit": "ms",
            "range": 98.13438428671967,
            "extra": "median: 210.67ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.257947818181815,
            "unit": "ms",
            "range": 31.65457930320598,
            "extra": "median: 8.27ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 66.37128786363637,
            "unit": "ms",
            "range": 143.2228810488391,
            "extra": "median: 33.45ms"
          },
          {
            "name": "Total per-file",
            "value": 641.3072157727272,
            "unit": "ms",
            "range": 1166.6735784074674,
            "extra": "median: 312.26ms"
          },
          {
            "name": "Static slicing",
            "value": 0.4693137810028153,
            "unit": "ms",
            "range": 0.42191555157347027,
            "extra": "median: 0.20ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.22677867701970625,
            "unit": "ms",
            "range": 0.1698074108159553,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.7152492920125485,
            "unit": "ms",
            "range": 0.5638348228174264,
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
          "id": "48e25a3515e92280375989939735f34489b17def",
          "message": "[release:patch] 2.2.12 Vector Support, Improved Graphic Support, Eval of Strings",
          "timestamp": "2025-03-17T09:01:02+01:00",
          "tree_id": "1fa464ef6978b578ec9bf2c48d5bf00b0a526d68",
          "url": "https://github.com/flowr-analysis/flowr/commit/48e25a3515e92280375989939735f34489b17def"
        },
        "date": 1742199188568,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 235.8529125,
            "unit": "ms",
            "range": 96.64402587397105,
            "extra": "median: 210.97ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.039425227272726,
            "unit": "ms",
            "range": 30.78635422817945,
            "extra": "median: 8.21ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 68.40513227272727,
            "unit": "ms",
            "range": 150.70946630241622,
            "extra": "median: 35.66ms"
          },
          {
            "name": "Total per-file",
            "value": 639.8965154545455,
            "unit": "ms",
            "range": 1165.8876857439245,
            "extra": "median: 307.48ms"
          },
          {
            "name": "Static slicing",
            "value": 0.46716427621538104,
            "unit": "ms",
            "range": 0.43280368429808813,
            "extra": "median: 0.21ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.22535935137726198,
            "unit": "ms",
            "range": 0.16583203636175198,
            "extra": "median: 0.11ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.7110094188939899,
            "unit": "ms",
            "range": 0.5764471131768342,
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
            "value": 89.26784446022727,
            "unit": "KiB",
            "range": 233.4752433920374,
            "extra": "median: 19.71"
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
          "id": "c9e254b4461384546c402bde212d87b1fc5eb6f2",
          "message": "[release:patch] 2.2.13 Control-Flow Graph, R Graphics, and Better Aliasing",
          "timestamp": "2025-05-27T12:38:34+02:00",
          "tree_id": "cbce8203f5fb142ee31cb5baf2de68be545e2acf",
          "url": "https://github.com/flowr-analysis/flowr/commit/c9e254b4461384546c402bde212d87b1fc5eb6f2"
        },
        "date": 1748343292800,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 240.57427063636362,
            "unit": "ms",
            "range": 102.98573332341721,
            "extra": "median: 212.26ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.878515727272728,
            "unit": "ms",
            "range": 33.17310947671068,
            "extra": "median: 8.23ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 76.83597372727273,
            "unit": "ms",
            "range": 181.71046148253882,
            "extra": "median: 35.84ms"
          },
          {
            "name": "Total per-file",
            "value": 729.3852148636364,
            "unit": "ms",
            "range": 1379.753131524459,
            "extra": "median: 321.33ms"
          },
          {
            "name": "Static slicing",
            "value": 0.5636316113669138,
            "unit": "ms",
            "range": 0.44840848757021506,
            "extra": "median: 0.31ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.22810559865223617,
            "unit": "ms",
            "range": 0.16664254206439716,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.8084683553185408,
            "unit": "ms",
            "range": 0.5942317459193692,
            "extra": "median: 0.45ms"
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
            "value": 115.99072265625,
            "unit": "KiB",
            "range": 295.50818665671295,
            "extra": "median: 34.15"
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
          "id": "0a000cc15c89ace7254d47c380227e261d1cfb18",
          "message": "[release:patch] 2.2.14 Basic Linting Setup",
          "timestamp": "2025-05-31T20:20:31+02:00",
          "tree_id": "3de3eb59c995a0a1e70d82b9564310f8bdf8aace",
          "url": "https://github.com/flowr-analysis/flowr/commit/0a000cc15c89ace7254d47c380227e261d1cfb18"
        },
        "date": 1748716592092,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 235.8438995909091,
            "unit": "ms",
            "range": 95.59375113911669,
            "extra": "median: 211.03ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.420142181818182,
            "unit": "ms",
            "range": 32.024036231339345,
            "extra": "median: 8.23ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 74.67460145454545,
            "unit": "ms",
            "range": 175.86239528732042,
            "extra": "median: 34.10ms"
          },
          {
            "name": "Total per-file",
            "value": 719.3215973181818,
            "unit": "ms",
            "range": 1365.3641827315482,
            "extra": "median: 315.16ms"
          },
          {
            "name": "Static slicing",
            "value": 0.5546191069973376,
            "unit": "ms",
            "range": 0.43913212828180526,
            "extra": "median: 0.32ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.22980592518742393,
            "unit": "ms",
            "range": 0.16384250100349748,
            "extra": "median: 0.11ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.8009818037863569,
            "unit": "ms",
            "range": 0.5833020339414798,
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
            "value": 115.99072265625,
            "unit": "KiB",
            "range": 295.50818665671295,
            "extra": "median: 34.15"
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
          "id": "117391bed2bf109635c058150d3cc1d95b01c4ac",
          "message": "[release:patch] 2.2.15 Value-Vector-Support, Linter Fixes",
          "timestamp": "2025-06-02T22:56:01+02:00",
          "tree_id": "7663c39bcbd8e0b030361e514aedb79192d69297",
          "url": "https://github.com/flowr-analysis/flowr/commit/117391bed2bf109635c058150d3cc1d95b01c4ac"
        },
        "date": 1748898944279,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 240.75738263636362,
            "unit": "ms",
            "range": 110.2597510648424,
            "extra": "median: 208.62ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.37960190909091,
            "unit": "ms",
            "range": 31.959764093966445,
            "extra": "median: 8.25ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 73.64739577272726,
            "unit": "ms",
            "range": 166.36838539803855,
            "extra": "median: 35.29ms"
          },
          {
            "name": "Total per-file",
            "value": 721.9686657272728,
            "unit": "ms",
            "range": 1362.8844478375638,
            "extra": "median: 312.67ms"
          },
          {
            "name": "Static slicing",
            "value": 0.5687110945361334,
            "unit": "ms",
            "range": 0.4539416335526991,
            "extra": "median: 0.29ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.23173758150914106,
            "unit": "ms",
            "range": 0.16809395632235624,
            "extra": "median: 0.11ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.8169473254508849,
            "unit": "ms",
            "range": 0.598073093983809,
            "extra": "median: 0.47ms"
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
            "value": 115.99072265625,
            "unit": "KiB",
            "range": 295.50818665671295,
            "extra": "median: 34.15"
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
          "id": "c83d61b417de41d625ff1eaa6bafeec1c9515d3c",
          "message": "[release:patch] 2.2.16 Local Config, Fixes, New Linter Rules",
          "timestamp": "2025-07-12T17:46:19+02:00",
          "tree_id": "32dc33bb5e67b5d31cf964b0d0e8bfb2ab587658",
          "url": "https://github.com/flowr-analysis/flowr/commit/c83d61b417de41d625ff1eaa6bafeec1c9515d3c"
        },
        "date": 1752336338386,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 239.84171913636362,
            "unit": "ms",
            "range": 102.48671669032665,
            "extra": "median: 214.07ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.355873181818183,
            "unit": "ms",
            "range": 31.534760381949546,
            "extra": "median: 8.22ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 72.84860072727274,
            "unit": "ms",
            "range": 166.80074218761843,
            "extra": "median: 35.61ms"
          },
          {
            "name": "Total per-file",
            "value": 722.0707231363637,
            "unit": "ms",
            "range": 1358.20579868256,
            "extra": "median: 322.29ms"
          },
          {
            "name": "Static slicing",
            "value": 0.5557797118924107,
            "unit": "ms",
            "range": 0.44284794166833547,
            "extra": "median: 0.32ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.22682629265696144,
            "unit": "ms",
            "range": 0.16141481185471984,
            "extra": "median: 0.11ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.8015027483471263,
            "unit": "ms",
            "range": 0.581588406581998,
            "extra": "median: 0.43ms"
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
            "value": 115.98459694602273,
            "unit": "KiB",
            "range": 295.4973184297739,
            "extra": "median: 34.15"
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
          "id": "9813198d1b677669d51a188fda97ca97d759d4ed",
          "message": "[release:minor] 2.3.0 Data Frame Shape Inference",
          "timestamp": "2025-07-21T13:30:08+02:00",
          "tree_id": "8f32ebb30ba791261c8ed267b51f312f8f457b87",
          "url": "https://github.com/flowr-analysis/flowr/commit/9813198d1b677669d51a188fda97ca97d759d4ed"
        },
        "date": 1753099073337,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 248.39613186363638,
            "unit": "ms",
            "range": 108.03099906883207,
            "extra": "median: 220.66ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.200340318181816,
            "unit": "ms",
            "range": 30.83880676448674,
            "extra": "median: 8.42ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 75.10548313636365,
            "unit": "ms",
            "range": 170.59071941643046,
            "extra": "median: 36.65ms"
          },
          {
            "name": "Total per-file",
            "value": 738.5088255909092,
            "unit": "ms",
            "range": 1388.0034906082192,
            "extra": "median: 331.89ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 0,
            "unit": "ms",
            "range": null,
            "extra": "median: NaNms"
          },
          {
            "name": "Infer data frame shapes",
            "value": 0,
            "unit": "ms",
            "range": null,
            "extra": "median: NaNms"
          },
          {
            "name": "Static slicing",
            "value": 0.5700701021389379,
            "unit": "ms",
            "range": 0.4437915687290047,
            "extra": "median: 0.33ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.23093786169993363,
            "unit": "ms",
            "range": 0.17042681577496852,
            "extra": "median: 0.11ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.820682826278492,
            "unit": "ms",
            "range": 0.5877949617113547,
            "extra": "median: 0.47ms"
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
            "value": 115.98459694602273,
            "unit": "KiB",
            "range": 295.4973184297739,
            "extra": "median: 34.15"
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
          "id": "da0972c3d22ad92c7e07921b4fb65926ed163a6f",
          "message": "[release:minor] 2.4.0 Forward-Slicing, Minor Fixes",
          "timestamp": "2025-08-06T22:30:00+02:00",
          "tree_id": "a05dcedfd31580a22beb3ebdde5f2fcbc9217c2d",
          "url": "https://github.com/flowr-analysis/flowr/commit/da0972c3d22ad92c7e07921b4fb65926ed163a6f"
        },
        "date": 1754513683282,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 245.493947,
            "unit": "ms",
            "range": 103.94357986919319,
            "extra": "median: 218.79ms"
          },
          {
            "name": "Normalize R AST",
            "value": 16.845505545454547,
            "unit": "ms",
            "range": 29.903534601132396,
            "extra": "median: 8.28ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 70.9942204090909,
            "unit": "ms",
            "range": 163.90208129426176,
            "extra": "median: 33.76ms"
          },
          {
            "name": "Total per-file",
            "value": 738.9195584545455,
            "unit": "ms",
            "range": 1394.1265191605717,
            "extra": "median: 329.39ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.061232136363637,
            "unit": "ms",
            "range": 17.458203422932158,
            "extra": "median: 3.22ms"
          },
          {
            "name": "Static slicing",
            "value": 0.5694040515055333,
            "unit": "ms",
            "range": 0.45349521593894276,
            "extra": "median: 0.37ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2314149293450933,
            "unit": "ms",
            "range": 0.1660907146741283,
            "extra": "median: 0.11ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.8196838145188172,
            "unit": "ms",
            "range": 0.5950926962896251,
            "extra": "median: 0.49ms"
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
            "value": 115.98459694602273,
            "unit": "KiB",
            "range": 295.4973184297739,
            "extra": "median: 34.15"
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
          "id": "78d418ba611903be1dc7ca71a48dbc655265606b",
          "message": "[release:patch] 2.4.2 Backward Compatibility",
          "timestamp": "2025-08-19T22:09:34+02:00",
          "tree_id": "dc49d2cc29eef59f25a0b84c47ab18dbd6424fe1",
          "url": "https://github.com/flowr-analysis/flowr/commit/78d418ba611903be1dc7ca71a48dbc655265606b"
        },
        "date": 1755635627818,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 268.50567368181817,
            "unit": "ms",
            "range": 117.03330631486453,
            "extra": "median: 237.29ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.140772954545454,
            "unit": "ms",
            "range": 35.47556728896352,
            "extra": "median: 8.69ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 81.37103077272727,
            "unit": "ms",
            "range": 190.11351298762443,
            "extra": "median: 36.90ms"
          },
          {
            "name": "Total per-file",
            "value": 899.2883360454545,
            "unit": "ms",
            "range": 1763.069338995556,
            "extra": "median: 361.40ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 9.564266772727274,
            "unit": "ms",
            "range": 20.580998849531596,
            "extra": "median: 3.87ms"
          },
          {
            "name": "Static slicing",
            "value": 0.8974751337703356,
            "unit": "ms",
            "range": 0.5058455904994237,
            "extra": "median: 0.76ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2579666531189168,
            "unit": "ms",
            "range": 0.21633760933155413,
            "extra": "median: 0.13ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.1766034753959718,
            "unit": "ms",
            "range": 0.6686134064854765,
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
          "id": "5ec7debf603e07049f0f5f87c4ef68c2f6570419",
          "message": "[release:patch] 2.4.4 Stability Fixes",
          "timestamp": "2025-08-20T16:27:35+02:00",
          "tree_id": "9962abc2f65092057c0b79c2d53f9badd4eb9ea7",
          "url": "https://github.com/flowr-analysis/flowr/commit/5ec7debf603e07049f0f5f87c4ef68c2f6570419"
        },
        "date": 1755701572521,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 255.33507718181818,
            "unit": "ms",
            "range": 114.93380536120786,
            "extra": "median: 224.68ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.009731954545455,
            "unit": "ms",
            "range": 33.55369590510315,
            "extra": "median: 8.63ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 75.37157754545454,
            "unit": "ms",
            "range": 173.730392879018,
            "extra": "median: 35.44ms"
          },
          {
            "name": "Total per-file",
            "value": 833.4159893181819,
            "unit": "ms",
            "range": 1616.4319480611794,
            "extra": "median: 352.98ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.380709,
            "unit": "ms",
            "range": 17.920669004061633,
            "extra": "median: 3.36ms"
          },
          {
            "name": "Static slicing",
            "value": 0.8816024846013679,
            "unit": "ms",
            "range": 0.4841111465558237,
            "extra": "median: 0.77ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.23792920749556218,
            "unit": "ms",
            "range": 0.20238042235291323,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.140688281628046,
            "unit": "ms",
            "range": 0.645460427886882,
            "extra": "median: 0.86ms"
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
          "id": "b259768e775981c7e1430a45046b79cada9a7f45",
          "message": "[release:patch] 2.4.5 Benchmark Patch",
          "timestamp": "2025-08-20T17:16:35+02:00",
          "tree_id": "b4a13338215ac4f19a08389629cbb94077a37916",
          "url": "https://github.com/flowr-analysis/flowr/commit/b259768e775981c7e1430a45046b79cada9a7f45"
        },
        "date": 1755705324636,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 261.1407016818182,
            "unit": "ms",
            "range": 115.74362615201038,
            "extra": "median: 229.97ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.366658045454546,
            "unit": "ms",
            "range": 34.101718700692906,
            "extra": "median: 8.77ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 78.3624945,
            "unit": "ms",
            "range": 180.6644538327077,
            "extra": "median: 36.41ms"
          },
          {
            "name": "Total per-file",
            "value": 854.8357736818182,
            "unit": "ms",
            "range": 1658.6360617265975,
            "extra": "median: 364.53ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.753953045454544,
            "unit": "ms",
            "range": 18.276868874528322,
            "extra": "median: 3.90ms"
          },
          {
            "name": "Static slicing",
            "value": 0.881220124181657,
            "unit": "ms",
            "range": 0.48241790745587937,
            "extra": "median: 0.81ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.24604132590697053,
            "unit": "ms",
            "range": 0.21746562785366047,
            "extra": "median: 0.12ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.147630662480359,
            "unit": "ms",
            "range": 0.6428141990646017,
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
          "id": "f76a9565b68adc516aab54ef1e0eaddc3dc40832",
          "message": "[release:patch] 2.4.6 Fix MapIterator in DFShape Linter",
          "timestamp": "2025-08-20T18:54:08+02:00",
          "tree_id": "f6fddd12c13459514380efe842dc91c81011c613",
          "url": "https://github.com/flowr-analysis/flowr/commit/f76a9565b68adc516aab54ef1e0eaddc3dc40832"
        },
        "date": 1755710667760,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 241.16969122727272,
            "unit": "ms",
            "range": 99.66926858499325,
            "extra": "median: 214.86ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.334096727272726,
            "unit": "ms",
            "range": 30.819299469931217,
            "extra": "median: 8.11ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 69.81611536363636,
            "unit": "ms",
            "range": 155.45118726070567,
            "extra": "median: 34.35ms"
          },
          {
            "name": "Total per-file",
            "value": 788.4858195909092,
            "unit": "ms",
            "range": 1511.4865870851797,
            "extra": "median: 342.23ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.369058,
            "unit": "ms",
            "range": 17.89672412462468,
            "extra": "median: 3.70ms"
          },
          {
            "name": "Static slicing",
            "value": 0.8395331922298017,
            "unit": "ms",
            "range": 0.45187272049343435,
            "extra": "median: 0.90ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.22867503920298254,
            "unit": "ms",
            "range": 0.17563078788446718,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.0889048834616037,
            "unit": "ms",
            "range": 0.593099222564085,
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
          "id": "87ffcf33ef1f98032391f4c01799ab07d82c3535",
          "message": "[release:patch] 2.4.7 AbsInt Framework",
          "timestamp": "2025-08-20T20:12:22+02:00",
          "tree_id": "f074bdf7c2c43e429a51399ee64b360768a5f11b",
          "url": "https://github.com/flowr-analysis/flowr/commit/87ffcf33ef1f98032391f4c01799ab07d82c3535"
        },
        "date": 1755715257249,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 252.7532734090909,
            "unit": "ms",
            "range": 121.13416244740107,
            "extra": "median: 219.82ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.735508045454548,
            "unit": "ms",
            "range": 32.571038799414644,
            "extra": "median: 8.46ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 72.64983904545454,
            "unit": "ms",
            "range": 164.27099540836198,
            "extra": "median: 34.47ms"
          },
          {
            "name": "Total per-file",
            "value": 814.0056945,
            "unit": "ms",
            "range": 1568.7088778471484,
            "extra": "median: 343.87ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.825442454545454,
            "unit": "ms",
            "range": 19.150528261270733,
            "extra": "median: 3.72ms"
          },
          {
            "name": "Static slicing",
            "value": 0.8380336245176676,
            "unit": "ms",
            "range": 0.46145647851930544,
            "extra": "median: 0.74ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.23387873636246223,
            "unit": "ms",
            "range": 0.18168671100900868,
            "extra": "median: 0.11ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.0927205443643273,
            "unit": "ms",
            "range": 0.6071181990377011,
            "extra": "median: 0.87ms"
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
          "id": "5f6939cf39d36c0b7f37824c2f28dab4a6255f3f",
          "message": "[release:minor] 2.5.0 RMarkdown Adapter",
          "timestamp": "2025-09-23T23:23:41+02:00",
          "tree_id": "edb9befaf52c99b5fa3263805d737db4834fb2b8",
          "url": "https://github.com/flowr-analysis/flowr/commit/5f6939cf39d36c0b7f37824c2f28dab4a6255f3f"
        },
        "date": 1758664057190,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 241.7024398181818,
            "range": "101.42886729246509",
            "unit": "ms",
            "extra": "median: 213.57ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.09344209090909,
            "range": "32.26387021767052",
            "unit": "ms",
            "extra": "median: 10.60ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 72.29905886363636,
            "range": "158.83347217895923",
            "unit": "ms",
            "extra": "median: 35.02ms"
          },
          {
            "name": "Total per-file",
            "value": 797.5047455909091,
            "range": "1527.4529553834207",
            "unit": "ms",
            "extra": "median: 349.07ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 9.849297136363637,
            "range": "24.757537494167337",
            "unit": "ms",
            "extra": "median: 2.93ms"
          },
          {
            "name": "Static slicing",
            "value": 0.8799516592842742,
            "range": "0.4407412582009097",
            "unit": "ms",
            "extra": "median: 0.75ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.22976091168944504,
            "range": "0.17349092513546505",
            "unit": "ms",
            "extra": "median: 0.11ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.129397942966736,
            "range": "0.5810577459231261",
            "unit": "ms",
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
            "value": 0.7801660063880064,
            "unit": "#",
            "extra": "std: 0.1261285782699485"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7575735855163274,
            "unit": "#",
            "extra": "std: 0.12942676908005035"
          },
          {
            "name": "memory (df-graph)",
            "value": 117.67085404829545,
            "range": "300.9854515829695",
            "unit": "KiB",
            "extra": "median: 34.18"
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
          "id": "682d74373c38c114c4e29134c2c3383f2981e025",
          "message": "[release:minor] 2.6.0 Project API",
          "timestamp": "2025-10-14T00:24:40+08:00",
          "tree_id": "47d8c3cb141b1fa6146da160ddbe8b6b0a6211e2",
          "url": "https://github.com/flowr-analysis/flowr/commit/682d74373c38c114c4e29134c2c3383f2981e025"
        },
        "date": 1760374352487,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 251.38656454545452,
            "range": "108.3120082292152",
            "unit": "ms",
            "extra": "median: 221.20ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.464365636363638,
            "range": "31.61049462911446",
            "unit": "ms",
            "extra": "median: 9.66ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 73.27209572727273,
            "range": "160.23998616546825",
            "unit": "ms",
            "extra": "median: 34.94ms"
          },
          {
            "name": "Total per-file",
            "value": 823.2022186363637,
            "range": "1578.6606066380048",
            "unit": "ms",
            "extra": "median: 359.96ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 9.193445045454546,
            "range": "21.621774544741932",
            "unit": "ms",
            "extra": "median: 3.23ms"
          },
          {
            "name": "Static slicing",
            "value": 0.9255775076760769,
            "range": "0.4866782143059541",
            "unit": "ms",
            "extra": "median: 0.78ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.24134767998188747,
            "range": "0.1908637187376753",
            "unit": "ms",
            "extra": "median: 0.12ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.1860452047979915,
            "range": "0.6330510452916971",
            "unit": "ms",
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
            "value": 0.7801660063880064,
            "unit": "#",
            "extra": "std: 0.1261285782699485"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7575735855163274,
            "unit": "#",
            "extra": "std: 0.12942676908005035"
          },
          {
            "name": "memory (df-graph)",
            "value": 117.67085404829545,
            "range": "300.9854515829695",
            "unit": "KiB",
            "extra": "median: 34.18"
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
          "id": "9b5e57d9348c4f48dbe7f3176e759a70611069e7",
          "message": "[release:patch] 2.6.1 Fixes, Higher-Order-Fn Query",
          "timestamp": "2025-10-21T08:08:34+02:00",
          "tree_id": "2f91cf50597d2820d504537ae42bb4f6cbfd3d39",
          "url": "https://github.com/flowr-analysis/flowr/commit/9b5e57d9348c4f48dbe7f3176e759a70611069e7"
        },
        "date": 1761028228530,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 242.9034735,
            "range": "101.61628330196675",
            "unit": "ms",
            "extra": "median: 214.33ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.520089181818182,
            "range": "30.105017857911612",
            "unit": "ms",
            "extra": "median: 10.28ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 72.0788843181818,
            "range": "158.54837312375065",
            "unit": "ms",
            "extra": "median: 33.13ms"
          },
          {
            "name": "Total per-file",
            "value": 793.0172983181819,
            "range": "1506.069835446516",
            "unit": "ms",
            "extra": "median: 347.05ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.041953363636363,
            "range": "17.3288894943566",
            "unit": "ms",
            "extra": "median: 2.96ms"
          },
          {
            "name": "Static slicing",
            "value": 0.8955791667643523,
            "range": "0.4507876963094242",
            "unit": "ms",
            "extra": "median: 0.87ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.23197968680293954,
            "range": "0.17328485445356698",
            "unit": "ms",
            "extra": "median: 0.11ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.1476296836082094,
            "range": "0.5881005711314611",
            "unit": "ms",
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
            "value": 0.7801660063880064,
            "unit": "#",
            "extra": "std: 0.1261285782699485"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7575735855163274,
            "unit": "#",
            "extra": "std: 0.12942676908005035"
          },
          {
            "name": "memory (df-graph)",
            "value": 117.67085404829545,
            "range": "300.9854515829695",
            "unit": "KiB",
            "extra": "median: 34.18"
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
          "id": "d7fb0c432a4921d48b863349e6d706924073c485",
          "message": "[release:patch] 2.6.2 TS-Queries, new Domain Structure, more Reserved Words, removed Lineage Query",
          "timestamp": "2025-11-09T08:33:06+01:00",
          "tree_id": "306bc4d11ef1823fa36a831a11b0bb24f1a74438",
          "url": "https://github.com/flowr-analysis/flowr/commit/d7fb0c432a4921d48b863349e6d706924073c485"
        },
        "date": 1762674760091,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 232.09088613636362,
            "range": "108.79775435569552",
            "unit": "ms",
            "extra": "median: 201.83ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.84216859090909,
            "range": "31.07506225346355",
            "unit": "ms",
            "extra": "median: 9.75ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 68.80595977272726,
            "range": "152.60239923224782",
            "unit": "ms",
            "extra": "median: 30.19ms"
          },
          {
            "name": "Total per-file",
            "value": 808.845531,
            "range": "1617.609989746458",
            "unit": "ms",
            "extra": "median: 330.67ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.151804818181818,
            "range": "18.72490978939474",
            "unit": "ms",
            "extra": "median: 3.15ms"
          },
          {
            "name": "Static slicing",
            "value": 0.8551831535400461,
            "range": "0.43234034167357466",
            "unit": "ms",
            "extra": "median: 0.68ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.22997999397365665,
            "range": "0.1787570976014635",
            "unit": "ms",
            "extra": "median: 0.11ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.1034065319331,
            "range": "0.561011820079985",
            "unit": "ms",
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
            "value": 0.7801660063880064,
            "unit": "#",
            "extra": "std: 0.1261285782699485"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7575735855163274,
            "unit": "#",
            "extra": "std: 0.12942676908005035"
          },
          {
            "name": "memory (df-graph)",
            "value": 117.67085404829545,
            "range": "300.9854515829695",
            "unit": "KiB",
            "extra": "median: 34.18"
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
          "id": "4d1661312b8aff8da696f936fe6bbb33476dfe97",
          "message": "[release:patch] 2.6.3 Doc, Refined Analyzer, Caching, and Perf",
          "timestamp": "2025-11-25T13:20:14+01:00",
          "tree_id": "9e6bba5056c3400d6afe642ee4ef68557ea0d94f",
          "url": "https://github.com/flowr-analysis/flowr/commit/4d1661312b8aff8da696f936fe6bbb33476dfe97"
        },
        "date": 1764074353236,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 252.00516281818182,
            "range": "115.85753697688142",
            "unit": "ms",
            "extra": "median: 220.57ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.720715045454547,
            "range": "35.350417846838894",
            "unit": "ms",
            "extra": "median: 9.15ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 71.34410118181819,
            "range": "157.54165951843243",
            "unit": "ms",
            "extra": "median: 35.62ms"
          },
          {
            "name": "Total per-file",
            "value": 820.7656425909091,
            "range": "1581.154704964909",
            "unit": "ms",
            "extra": "median: 353.10ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.759715090909092,
            "range": "19.22319638019312",
            "unit": "ms",
            "extra": "median: 3.01ms"
          },
          {
            "name": "Static slicing",
            "value": 0.8765940515738152,
            "range": "0.47053722902193834",
            "unit": "ms",
            "extra": "median: 0.72ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.24520630684661968,
            "range": "0.19543120425529595",
            "unit": "ms",
            "extra": "median: 0.11ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.14107607337729,
            "range": "0.6255102109428051",
            "unit": "ms",
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
            "value": 0.7801660063880064,
            "unit": "#",
            "extra": "std: 0.1261285782699485"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7575735855163274,
            "unit": "#",
            "extra": "std: 0.12942676908005035"
          },
          {
            "name": "memory (df-graph)",
            "value": 117.67085404829545,
            "range": "300.9854515829695",
            "unit": "KiB",
            "extra": "median: 34.18"
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
          "id": "6a75a4fb1580fb3d26de71d59c6a6b4f20823ea3",
          "message": "[release:minor] 2.7.0 Set-Range Domains, Environment Caches, and Mermaid Exclusions",
          "timestamp": "2025-12-03T13:21:40+01:00",
          "tree_id": "81d5be6eccf50444e4a8391a0ecec541d33d00df",
          "url": "https://github.com/flowr-analysis/flowr/commit/6a75a4fb1580fb3d26de71d59c6a6b4f20823ea3"
        },
        "date": 1764765646395,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 247.11707086363637,
            "range": "111.94186057178526",
            "unit": "ms",
            "extra": "median: 217.16ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.743718136363636,
            "range": "32.38543903575263",
            "unit": "ms",
            "extra": "median: 8.62ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 59.672371,
            "range": "118.35786630802934",
            "unit": "ms",
            "extra": "median: 34.80ms"
          },
          {
            "name": "Total per-file",
            "value": 726.8179467272728,
            "range": "1359.3860592503863",
            "unit": "ms",
            "extra": "median: 329.89ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 9.525790045454546,
            "range": "22.277457826887172",
            "unit": "ms",
            "extra": "median: 3.16ms"
          },
          {
            "name": "Static slicing",
            "value": 0.4855528047879234,
            "range": "0.5323310237334883",
            "unit": "ms",
            "extra": "median: 0.14ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2545582629708196,
            "range": "0.1931922872759902",
            "unit": "ms",
            "extra": "median: 0.13ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.7574144148928385,
            "range": "0.6901224135073082",
            "unit": "ms",
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
            "value": 0.7801660063880064,
            "unit": "#",
            "extra": "std: 0.1261285782699485"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7575735855163274,
            "unit": "#",
            "extra": "std: 0.12942676908005035"
          },
          {
            "name": "memory (df-graph)",
            "value": 117.68869850852273,
            "range": "301.0391208122946",
            "unit": "KiB",
            "extra": "median: 34.18"
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
          "id": "f1a2885127c7e8c67841600f34c677aa8096fe53",
          "message": "[release:patch] 2.7.2 News File Support, files Query, Better Doc Context, Mermaid for NAST and CFG (npm retry)",
          "timestamp": "2025-12-17T13:44:16+01:00",
          "tree_id": "16694244a284b080a16f01a6a8761fa969522a4c",
          "url": "https://github.com/flowr-analysis/flowr/commit/f1a2885127c7e8c67841600f34c677aa8096fe53"
        },
        "date": 1765976488089,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 242.0140588181818,
            "range": "105.44997461203604",
            "unit": "ms",
            "extra": "median: 212.16ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.549852681818184,
            "range": "38.74514975751711",
            "unit": "ms",
            "extra": "median: 8.45ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 60.46389181818182,
            "range": "123.60139103861172",
            "unit": "ms",
            "extra": "median: 34.23ms"
          },
          {
            "name": "Total per-file",
            "value": 719.0011253181818,
            "range": "1343.9139396884705",
            "unit": "ms",
            "extra": "median: 324.69ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.690524818181819,
            "range": "18.14762961102814",
            "unit": "ms",
            "extra": "median: 3.07ms"
          },
          {
            "name": "Static slicing",
            "value": 0.4991765257204629,
            "range": "0.50946173781484",
            "unit": "ms",
            "extra": "median: 0.13ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2548040909816072,
            "range": "0.18674560979035787",
            "unit": "ms",
            "extra": "median: 0.12ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.7713934192365867,
            "range": "0.6623999487693129",
            "unit": "ms",
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
            "value": 0.7801660063880064,
            "unit": "#",
            "extra": "std: 0.1261285782699485"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7575735855163274,
            "unit": "#",
            "extra": "std: 0.12942676908005035"
          },
          {
            "name": "memory (df-graph)",
            "value": 117.68869850852273,
            "range": "301.0391208122946",
            "unit": "KiB",
            "extra": "median: 34.18"
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
          "id": "ff8c08742ca6fe6451fb028f50ae9dd1392fad72",
          "message": "[release:patch] 2.7.3 Namespace-File Support",
          "timestamp": "2025-12-21T15:57:35+01:00",
          "tree_id": "4abef89472b7472e816c077d5f72f1c3dd021515",
          "url": "https://github.com/flowr-analysis/flowr/commit/ff8c08742ca6fe6451fb028f50ae9dd1392fad72"
        },
        "date": 1766330103792,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 239.5137867727273,
            "range": "100.96954410902039",
            "unit": "ms",
            "extra": "median: 213.28ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.583832227272726,
            "range": "32.50474708256492",
            "unit": "ms",
            "extra": "median: 8.19ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 58.212227090909096,
            "range": "114.47264946356081",
            "unit": "ms",
            "extra": "median: 33.73ms"
          },
          {
            "name": "Total per-file",
            "value": 714.4344353181818,
            "range": "1336.7411584363513",
            "unit": "ms",
            "extra": "median: 321.23ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.05922340909091,
            "range": "16.675378052178583",
            "unit": "ms",
            "extra": "median: 3.14ms"
          },
          {
            "name": "Static slicing",
            "value": 0.48591422710947113,
            "range": "0.5249706273194239",
            "unit": "ms",
            "extra": "median: 0.16ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2555847584121569,
            "range": "0.1912130013864844",
            "unit": "ms",
            "extra": "median: 0.12ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.7584379245991989,
            "range": "0.6864788768211089",
            "unit": "ms",
            "extra": "median: 0.43ms"
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
            "value": 0.7801660063880064,
            "unit": "#",
            "extra": "std: 0.1261285782699485"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7575735855163274,
            "unit": "#",
            "extra": "std: 0.12942676908005035"
          },
          {
            "name": "memory (df-graph)",
            "value": 117.68869850852273,
            "range": "301.0391208122946",
            "unit": "KiB",
            "extra": "median: 34.18"
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
          "id": "e338b738f2c8f76da1a90c6e4b02164e30450199",
          "message": "[release:patch] 2.7.4 Performance Improvements",
          "timestamp": "2025-12-22T10:07:40+01:00",
          "tree_id": "c5ff185085d80ab908e0526defa30393a6be2ee4",
          "url": "https://github.com/flowr-analysis/flowr/commit/e338b738f2c8f76da1a90c6e4b02164e30450199"
        },
        "date": 1766395517172,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 248.13570559090908,
            "range": "114.60525113612977",
            "unit": "ms",
            "extra": "median: 217.64ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.81618790909091,
            "range": "32.57437251634188",
            "unit": "ms",
            "extra": "median: 8.59ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 50.145981,
            "range": "94.9646631248052",
            "unit": "ms",
            "extra": "median: 26.69ms"
          },
          {
            "name": "Total per-file",
            "value": 719.0666675909091,
            "range": "1340.218136544747",
            "unit": "ms",
            "extra": "median: 327.51ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 9.502884772727274,
            "range": "23.131018719599766",
            "unit": "ms",
            "extra": "median: 3.08ms"
          },
          {
            "name": "Static slicing",
            "value": 0.49858204720180127,
            "range": "0.5409376305996669",
            "unit": "ms",
            "extra": "median: 0.16ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.25543452193055677,
            "range": "0.19277444016815723",
            "unit": "ms",
            "extra": "median: 0.13ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.7720327458196807,
            "range": "0.6984593699744513",
            "unit": "ms",
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
            "value": 0.7801660063880064,
            "unit": "#",
            "extra": "std: 0.1261285782699485"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7575735855163274,
            "unit": "#",
            "extra": "std: 0.12942676908005035"
          },
          {
            "name": "memory (df-graph)",
            "value": 117.68869850852273,
            "range": "301.0391208122946",
            "unit": "KiB",
            "extra": "median: 34.18"
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
          "id": "1b0bbae3b9d6d61e621d74be103c71f48660c933",
          "message": "[release:patch] 2.7.5 License and Author parsing, Ascii-DFGs, Minor Fixes and Features",
          "timestamp": "2025-12-23T19:09:30+01:00",
          "tree_id": "0e9bd987fb90d53191551e769d642100ee546ec4",
          "url": "https://github.com/flowr-analysis/flowr/commit/1b0bbae3b9d6d61e621d74be103c71f48660c933"
        },
        "date": 1766514423612,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 246.85965086363638,
            "range": "111.14910936811341",
            "unit": "ms",
            "extra": "median: 216.49ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.365768681818185,
            "range": "34.55310856268118",
            "unit": "ms",
            "extra": "median: 10.14ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 51.132096227272726,
            "range": "97.30520152376303",
            "unit": "ms",
            "extra": "median: 25.39ms"
          },
          {
            "name": "Total per-file",
            "value": 714.7749622727273,
            "range": "1333.9274896097188",
            "unit": "ms",
            "extra": "median: 321.73ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 9.579887318181818,
            "range": "21.76229564598147",
            "unit": "ms",
            "extra": "median: 3.11ms"
          },
          {
            "name": "Static slicing",
            "value": 0.49879809843479717,
            "range": "0.5421166763273703",
            "unit": "ms",
            "extra": "median: 0.17ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2547673825172963,
            "range": "0.1897823781874222",
            "unit": "ms",
            "extra": "median: 0.14ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.7708837737176801,
            "range": "0.6940477997875366",
            "unit": "ms",
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
            "value": 0.7801660063880064,
            "unit": "#",
            "extra": "std: 0.1261285782699485"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7575735855163274,
            "unit": "#",
            "extra": "std: 0.12942676908005035"
          },
          {
            "name": "memory (df-graph)",
            "value": 117.68869850852273,
            "range": "301.0391208122946",
            "unit": "KiB",
            "extra": "median: 34.18"
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
          "id": "b1b4f9a90cc5e46cb6ea372e475e39eb142ed762",
          "message": "[release:patch] 2.7.6 Custom License Parsing",
          "timestamp": "2025-12-23T23:16:16+01:00",
          "tree_id": "4b6d032ed0ceb950ac5f6c4c4caf4a036d5602bd",
          "url": "https://github.com/flowr-analysis/flowr/commit/b1b4f9a90cc5e46cb6ea372e475e39eb142ed762"
        },
        "date": 1766529230612,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 242.928793,
            "range": "106.64012038162332",
            "unit": "ms",
            "extra": "median: 213.24ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.92409713636364,
            "range": "32.548829184960425",
            "unit": "ms",
            "extra": "median: 10.18ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 50.06019845454545,
            "range": "92.81373386568838",
            "unit": "ms",
            "extra": "median: 26.08ms"
          },
          {
            "name": "Total per-file",
            "value": 704.9136089090908,
            "range": "1309.4756046029074",
            "unit": "ms",
            "extra": "median: 321.09ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 9.748942727272727,
            "range": "23.398468305553052",
            "unit": "ms",
            "extra": "median: 3.46ms"
          },
          {
            "name": "Static slicing",
            "value": 0.5130948325487004,
            "range": "0.5272657433409015",
            "unit": "ms",
            "extra": "median: 0.17ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.25304492139688534,
            "range": "0.18974333753972422",
            "unit": "ms",
            "extra": "median: 0.13ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.7845696603849676,
            "range": "0.6804326784074001",
            "unit": "ms",
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
            "value": 0.7801660063880064,
            "unit": "#",
            "extra": "std: 0.1261285782699485"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7575735855163274,
            "unit": "#",
            "extra": "std: 0.12942676908005035"
          },
          {
            "name": "memory (df-graph)",
            "value": 117.68869850852273,
            "range": "301.0391208122946",
            "unit": "KiB",
            "extra": "median: 34.18"
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
          "id": "e31adf1f97c0d6086d52d8e0b2839eefeb8eca5c",
          "message": "[release:minor] 2.8.0 Call-Graphs, Roxygen 2 Support, Many Plugins, Registrations, Exceptions and Hooks",
          "timestamp": "2026-01-03T22:59:25+01:00",
          "tree_id": "352f59ea06cc313f58abb4295c602797c49f107a",
          "url": "https://github.com/flowr-analysis/flowr/commit/e31adf1f97c0d6086d52d8e0b2839eefeb8eca5c"
        },
        "date": 1767478623369,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 246.37688495454546,
            "range": "108.01781992697524",
            "unit": "ms",
            "extra": "median: 215.77ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.322312227272725,
            "range": "32.71729253463986",
            "unit": "ms",
            "extra": "median: 10.42ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 48.98087240909091,
            "range": "90.8025053154274",
            "unit": "ms",
            "extra": "median: 27.80ms"
          },
          {
            "name": "Total per-file",
            "value": 708.9325477272728,
            "range": "1308.355033808945",
            "unit": "ms",
            "extra": "median: 318.70ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 9.290041045454545,
            "range": "21.55389275670168",
            "unit": "ms",
            "extra": "median: 3.02ms"
          },
          {
            "name": "Static slicing",
            "value": 0.5176167594493881,
            "range": "0.5396828594927694",
            "unit": "ms",
            "extra": "median: 0.23ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.25725976634969505,
            "range": "0.19608335549740913",
            "unit": "ms",
            "extra": "median: 0.14ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.7924369664667342,
            "range": "0.697469327899471",
            "unit": "ms",
            "extra": "median: 0.46ms"
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
            "value": 0.7801660063880064,
            "unit": "#",
            "extra": "std: 0.1261285782699485"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7575735855163274,
            "unit": "#",
            "extra": "std: 0.12942676908005035"
          },
          {
            "name": "memory (df-graph)",
            "value": 119.32293146306819,
            "range": "305.20520739372563",
            "unit": "KiB",
            "extra": "median: 34.18"
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
          "id": "bd9b3f6e3edb84c29dd335623aa915d1356eca7b",
          "message": "[release:patch] 2.8.1 Fix: Call-Graph Construction",
          "timestamp": "2026-01-04T01:29:58+01:00",
          "tree_id": "5569a17c31003f5bede2a29cb0a8ca11c9a680e5",
          "url": "https://github.com/flowr-analysis/flowr/commit/bd9b3f6e3edb84c29dd335623aa915d1356eca7b"
        },
        "date": 1767487681255,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 250.7658063636364,
            "range": "111.32343064817353",
            "unit": "ms",
            "extra": "median: 221.26ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.749433272727273,
            "range": "34.41577710522395",
            "unit": "ms",
            "extra": "median: 10.53ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 49.14808259090909,
            "range": "92.29507765186244",
            "unit": "ms",
            "extra": "median: 24.66ms"
          },
          {
            "name": "Total per-file",
            "value": 723.3198111363636,
            "range": "1346.3057297332764",
            "unit": "ms",
            "extra": "median: 328.38ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.669313772727273,
            "range": "18.430636712470992",
            "unit": "ms",
            "extra": "median: 3.11ms"
          },
          {
            "name": "Static slicing",
            "value": 0.5168627215078769,
            "range": "0.5313298662883221",
            "unit": "ms",
            "extra": "median: 0.20ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.26297486462769903,
            "range": "0.20289390669071478",
            "unit": "ms",
            "extra": "median: 0.14ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.7975927309619445,
            "range": "0.6904940788042458",
            "unit": "ms",
            "extra": "median: 0.45ms"
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
            "value": 0.7801660063880064,
            "unit": "#",
            "extra": "std: 0.1261285782699485"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7575735855163274,
            "unit": "#",
            "extra": "std: 0.12942676908005035"
          },
          {
            "name": "memory (df-graph)",
            "value": 119.05730646306819,
            "range": "304.18943285884376",
            "unit": "KiB",
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
          "id": "ae435ebae9cf85e90cdfc73b0e1923e585d59414",
          "message": "[release:patch] 2.2.11 Better Compression, Project Query, Improved Location-Map",
          "timestamp": "2025-03-02T20:17:12+01:00",
          "tree_id": "10d49938f6bed0e336aba3a4b25d6abb70dae7f3",
          "url": "https://github.com/flowr-analysis/flowr/commit/ae435ebae9cf85e90cdfc73b0e1923e585d59414"
        },
        "date": 1740944079401,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 239.64079702,
            "unit": "ms",
            "range": 44.11375307924821,
            "extra": "median: 219.26ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.1434968,
            "unit": "ms",
            "range": 13.773637260246277,
            "extra": "median: 10.30ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 76.97500626,
            "unit": "ms",
            "range": 73.77788186374572,
            "extra": "median: 35.21ms"
          },
          {
            "name": "Total per-file",
            "value": 2022.78157726,
            "unit": "ms",
            "range": 3244.1720736213683,
            "extra": "median: 453.18ms"
          },
          {
            "name": "Static slicing",
            "value": 3.6170589593030935,
            "unit": "ms",
            "range": 8.590681611280363,
            "extra": "median: 0.63ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.25373652217473913,
            "unit": "ms",
            "range": 0.15060373123484225,
            "extra": "median: 0.16ms"
          },
          {
            "name": "Total per-slice",
            "value": 3.8783335916414536,
            "unit": "ms",
            "range": 8.621427296354272,
            "extra": "median: 0.89ms"
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
            "value": 0.8705421806084227,
            "unit": "#",
            "extra": "std: 0.10037830604661653"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8093097223711857,
            "unit": "#",
            "extra": "std: 0.14285022991221383"
          },
          {
            "name": "memory (df-graph)",
            "value": 97.222890625,
            "unit": "KiB",
            "range": 110.26854360469518,
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
          "id": "48e25a3515e92280375989939735f34489b17def",
          "message": "[release:patch] 2.2.12 Vector Support, Improved Graphic Support, Eval of Strings",
          "timestamp": "2025-03-17T09:01:02+01:00",
          "tree_id": "1fa464ef6978b578ec9bf2c48d5bf00b0a526d68",
          "url": "https://github.com/flowr-analysis/flowr/commit/48e25a3515e92280375989939735f34489b17def"
        },
        "date": 1742199190346,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 241.85785622,
            "unit": "ms",
            "range": 44.78394526182359,
            "extra": "median: 219.27ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.563525339999998,
            "unit": "ms",
            "range": 14.015051445282008,
            "extra": "median: 10.41ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 84.72433579999999,
            "unit": "ms",
            "range": 84.66356280746363,
            "extra": "median: 40.39ms"
          },
          {
            "name": "Total per-file",
            "value": 1867.65965942,
            "unit": "ms",
            "range": 2877.5044318275345,
            "extra": "median: 464.24ms"
          },
          {
            "name": "Static slicing",
            "value": 3.3928179595763157,
            "unit": "ms",
            "range": 8.319583725582904,
            "extra": "median: 0.67ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.25920965454827644,
            "unit": "ms",
            "range": 0.15391454983711592,
            "extra": "median: 0.15ms"
          },
          {
            "name": "Total per-slice",
            "value": 3.659628971976802,
            "unit": "ms",
            "range": 8.35784339735362,
            "extra": "median: 0.88ms"
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
            "value": 0.8798554086495026,
            "unit": "#",
            "extra": "std: 0.10489293098285703"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8255303575466827,
            "unit": "#",
            "extra": "std: 0.15010194310878314"
          },
          {
            "name": "memory (df-graph)",
            "value": 97.1080859375,
            "unit": "KiB",
            "range": 110.16212749021126,
            "extra": "median: 48.65"
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
          "id": "c9e254b4461384546c402bde212d87b1fc5eb6f2",
          "message": "[release:patch] 2.2.13 Control-Flow Graph, R Graphics, and Better Aliasing",
          "timestamp": "2025-05-27T12:38:34+02:00",
          "tree_id": "cbce8203f5fb142ee31cb5baf2de68be545e2acf",
          "url": "https://github.com/flowr-analysis/flowr/commit/c9e254b4461384546c402bde212d87b1fc5eb6f2"
        },
        "date": 1748343294051,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 238.73175382,
            "unit": "ms",
            "range": 44.49323708226236,
            "extra": "median: 220.41ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.36970688,
            "unit": "ms",
            "range": 13.757481289223822,
            "extra": "median: 10.49ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 93.81097472,
            "unit": "ms",
            "range": 90.26909541566434,
            "extra": "median: 47.53ms"
          },
          {
            "name": "Total per-file",
            "value": 2111.28978724,
            "unit": "ms",
            "range": 3465.7886785501487,
            "extra": "median: 501.56ms"
          },
          {
            "name": "Static slicing",
            "value": 4.308306557482454,
            "unit": "ms",
            "range": 13.255500824577089,
            "extra": "median: 0.73ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.25422914516422396,
            "unit": "ms",
            "range": 0.1663756353254469,
            "extra": "median: 0.15ms"
          },
          {
            "name": "Total per-slice",
            "value": 4.570049491901042,
            "unit": "ms",
            "range": 13.280475927815786,
            "extra": "median: 0.96ms"
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
            "value": 0.8777744028063875,
            "unit": "#",
            "extra": "std: 0.10660809376285156"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8225385840469721,
            "unit": "#",
            "extra": "std: 0.15263521047510092"
          },
          {
            "name": "memory (df-graph)",
            "value": 107.678828125,
            "unit": "KiB",
            "range": 118.33421974292067,
            "extra": "median: 53.09"
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
          "id": "0a000cc15c89ace7254d47c380227e261d1cfb18",
          "message": "[release:patch] 2.2.14 Basic Linting Setup",
          "timestamp": "2025-05-31T20:20:31+02:00",
          "tree_id": "3de3eb59c995a0a1e70d82b9564310f8bdf8aace",
          "url": "https://github.com/flowr-analysis/flowr/commit/0a000cc15c89ace7254d47c380227e261d1cfb18"
        },
        "date": 1748716593291,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 245.73977236000002,
            "unit": "ms",
            "range": 45.63704374767473,
            "extra": "median: 226.29ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.699923440000003,
            "unit": "ms",
            "range": 14.433306988911369,
            "extra": "median: 10.73ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 94.67940623999999,
            "unit": "ms",
            "range": 90.4962361884528,
            "extra": "median: 50.51ms"
          },
          {
            "name": "Total per-file",
            "value": 2176.43274228,
            "unit": "ms",
            "range": 3560.4561797595143,
            "extra": "median: 510.32ms"
          },
          {
            "name": "Static slicing",
            "value": 4.4285133992005115,
            "unit": "ms",
            "range": 13.55840366082753,
            "extra": "median: 0.71ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.27372893967868517,
            "unit": "ms",
            "range": 0.15399531987785164,
            "extra": "median: 0.19ms"
          },
          {
            "name": "Total per-slice",
            "value": 4.7099944414138974,
            "unit": "ms",
            "range": 13.586873736225074,
            "extra": "median: 0.94ms"
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
            "value": 0.8777744028063875,
            "unit": "#",
            "extra": "std: 0.10660809376285156"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8225385840469721,
            "unit": "#",
            "extra": "std: 0.15263521047510092"
          },
          {
            "name": "memory (df-graph)",
            "value": 107.678828125,
            "unit": "KiB",
            "range": 118.33421974292067,
            "extra": "median: 53.09"
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
          "id": "117391bed2bf109635c058150d3cc1d95b01c4ac",
          "message": "[release:patch] 2.2.15 Value-Vector-Support, Linter Fixes",
          "timestamp": "2025-06-02T22:56:01+02:00",
          "tree_id": "7663c39bcbd8e0b030361e514aedb79192d69297",
          "url": "https://github.com/flowr-analysis/flowr/commit/117391bed2bf109635c058150d3cc1d95b01c4ac"
        },
        "date": 1748898945680,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 242.28877866,
            "unit": "ms",
            "range": 45.23087513682071,
            "extra": "median: 221.39ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.3782157,
            "unit": "ms",
            "range": 13.90128803557734,
            "extra": "median: 10.31ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 94.36926845999999,
            "unit": "ms",
            "range": 90.81537165699382,
            "extra": "median: 50.10ms"
          },
          {
            "name": "Total per-file",
            "value": 2137.4902879,
            "unit": "ms",
            "range": 3503.8753969438703,
            "extra": "median: 492.62ms"
          },
          {
            "name": "Static slicing",
            "value": 4.3640904111874645,
            "unit": "ms",
            "range": 13.466143881830213,
            "extra": "median: 0.67ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2573004735613169,
            "unit": "ms",
            "range": 0.15394260642550095,
            "extra": "median: 0.16ms"
          },
          {
            "name": "Total per-slice",
            "value": 4.6288577268509625,
            "unit": "ms",
            "range": 13.49266686272323,
            "extra": "median: 0.94ms"
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
            "value": 0.8777744028063875,
            "unit": "#",
            "extra": "std: 0.10660809376285156"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8225385840469721,
            "unit": "#",
            "extra": "std: 0.15263521047510092"
          },
          {
            "name": "memory (df-graph)",
            "value": 107.67833984375,
            "unit": "KiB",
            "range": 118.33449625641981,
            "extra": "median: 53.09"
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
          "id": "c83d61b417de41d625ff1eaa6bafeec1c9515d3c",
          "message": "[release:patch] 2.2.16 Local Config, Fixes, New Linter Rules",
          "timestamp": "2025-07-12T17:46:19+02:00",
          "tree_id": "32dc33bb5e67b5d31cf964b0d0e8bfb2ab587658",
          "url": "https://github.com/flowr-analysis/flowr/commit/c83d61b417de41d625ff1eaa6bafeec1c9515d3c"
        },
        "date": 1752336340608,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 246.79707758,
            "unit": "ms",
            "range": 47.5183391474623,
            "extra": "median: 223.12ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.63315134,
            "unit": "ms",
            "range": 14.186300187412845,
            "extra": "median: 10.27ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 96.38177258,
            "unit": "ms",
            "range": 92.71503492136621,
            "extra": "median: 51.69ms"
          },
          {
            "name": "Total per-file",
            "value": 2187.75076262,
            "unit": "ms",
            "range": 3593.2820321888335,
            "extra": "median: 507.66ms"
          },
          {
            "name": "Static slicing",
            "value": 4.468225042947262,
            "unit": "ms",
            "range": 13.92009549032153,
            "extra": "median: 0.76ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2636850217461581,
            "unit": "ms",
            "range": 0.1542892107731148,
            "extra": "median: 0.16ms"
          },
          {
            "name": "Total per-slice",
            "value": 4.739415259671516,
            "unit": "ms",
            "range": 13.954361338644603,
            "extra": "median: 0.93ms"
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
            "value": 0.8777744028063875,
            "unit": "#",
            "extra": "std: 0.10660809376285156"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8225385840469721,
            "unit": "#",
            "extra": "std: 0.15263521047510092"
          },
          {
            "name": "memory (df-graph)",
            "value": 107.6742578125,
            "unit": "KiB",
            "range": 118.3336498681691,
            "extra": "median: 53.09"
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
          "id": "9813198d1b677669d51a188fda97ca97d759d4ed",
          "message": "[release:minor] 2.3.0 Data Frame Shape Inference",
          "timestamp": "2025-07-21T13:30:08+02:00",
          "tree_id": "8f32ebb30ba791261c8ed267b51f312f8f457b87",
          "url": "https://github.com/flowr-analysis/flowr/commit/9813198d1b677669d51a188fda97ca97d759d4ed"
        },
        "date": 1753099074838,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 256.31918026,
            "unit": "ms",
            "range": 48.04986217787748,
            "extra": "median: 234.76ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.88341182,
            "unit": "ms",
            "range": 14.544096183521296,
            "extra": "median: 10.76ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 98.14783536,
            "unit": "ms",
            "range": 93.4031068187599,
            "extra": "median: 52.60ms"
          },
          {
            "name": "Total per-file",
            "value": 2253.5739518200003,
            "unit": "ms",
            "range": 3699.3042186304283,
            "extra": "median: 508.13ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 0,
            "unit": "ms",
            "range": null,
            "extra": "median: NaNms"
          },
          {
            "name": "Infer data frame shapes",
            "value": 0,
            "unit": "ms",
            "range": null,
            "extra": "median: NaNms"
          },
          {
            "name": "Static slicing",
            "value": 4.544352693282431,
            "unit": "ms",
            "range": 13.992164332373276,
            "extra": "median: 0.72ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.29886803865803224,
            "unit": "ms",
            "range": 0.17190887987636033,
            "extra": "median: 0.20ms"
          },
          {
            "name": "Total per-slice",
            "value": 4.85133269418561,
            "unit": "ms",
            "range": 14.026187794109482,
            "extra": "median: 0.99ms"
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
            "value": 0.8777744028063875,
            "unit": "#",
            "extra": "std: 0.10660809376285156"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8225385840469721,
            "unit": "#",
            "extra": "std: 0.15263521047510092"
          },
          {
            "name": "memory (df-graph)",
            "value": 107.6742578125,
            "unit": "KiB",
            "range": 118.3336498681691,
            "extra": "median: 53.09"
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
          "id": "da0972c3d22ad92c7e07921b4fb65926ed163a6f",
          "message": "[release:minor] 2.4.0 Forward-Slicing, Minor Fixes",
          "timestamp": "2025-08-06T22:30:00+02:00",
          "tree_id": "a05dcedfd31580a22beb3ebdde5f2fcbc9217c2d",
          "url": "https://github.com/flowr-analysis/flowr/commit/da0972c3d22ad92c7e07921b4fb65926ed163a6f"
        },
        "date": 1754513685474,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 248.50097946,
            "unit": "ms",
            "range": 46.049818809929235,
            "extra": "median: 224.33ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.90139154,
            "unit": "ms",
            "range": 14.388410519099594,
            "extra": "median: 10.29ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 92.29897593999999,
            "unit": "ms",
            "range": 87.13912345234867,
            "extra": "median: 46.31ms"
          },
          {
            "name": "Total per-file",
            "value": 2199.274343,
            "unit": "ms",
            "range": 3602.0040732286225,
            "extra": "median: 497.00ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.316044960000001,
            "unit": "ms",
            "range": 8.752063148713113,
            "extra": "median: 7.40ms"
          },
          {
            "name": "Static slicing",
            "value": 4.464464426149427,
            "unit": "ms",
            "range": 13.827997178067916,
            "extra": "median: 0.75ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2629646667264127,
            "unit": "ms",
            "range": 0.15065310123494727,
            "extra": "median: 0.15ms"
          },
          {
            "name": "Total per-slice",
            "value": 4.7348500874348245,
            "unit": "ms",
            "range": 13.856194490213971,
            "extra": "median: 0.98ms"
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
            "value": 0.8777744028063875,
            "unit": "#",
            "extra": "std: 0.10660809376285156"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8225385840469721,
            "unit": "#",
            "extra": "std: 0.15263521047510092"
          },
          {
            "name": "memory (df-graph)",
            "value": 107.6742578125,
            "unit": "KiB",
            "range": 118.3336498681691,
            "extra": "median: 53.09"
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
          "id": "6861d92ca7eed15ab47a237a9981ada168adf133",
          "message": "[release:patch] 2.4.1 Localized Config, Support for File Modes",
          "timestamp": "2025-08-18T13:40:09+02:00",
          "tree_id": "98a6643a733244c5396f5a3e2a505b2c540e6b26",
          "url": "https://github.com/flowr-analysis/flowr/commit/6861d92ca7eed15ab47a237a9981ada168adf133"
        },
        "date": 1755519423468,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 260.3295076,
            "unit": "ms",
            "range": 48.613132899008676,
            "extra": "median: 238.67ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.48195876,
            "unit": "ms",
            "range": 14.776037653171475,
            "extra": "median: 10.82ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 98.20798378,
            "unit": "ms",
            "range": 91.63106672619791,
            "extra": "median: 50.01ms"
          },
          {
            "name": "Total per-file",
            "value": 2360.87909936,
            "unit": "ms",
            "range": 3792.177232496188,
            "extra": "median: 521.07ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.7849818,
            "unit": "ms",
            "range": 9.518689178080075,
            "extra": "median: 7.51ms"
          },
          {
            "name": "Static slicing",
            "value": 4.8614156315698045,
            "unit": "ms",
            "range": 14.124537898006672,
            "extra": "median: 0.96ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.3150602441705956,
            "unit": "ms",
            "range": 0.19065532981947364,
            "extra": "median: 0.20ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.1850955561926355,
            "unit": "ms",
            "range": 14.160888241315304,
            "extra": "median: 1.24ms"
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
            "value": 108.77921875,
            "unit": "KiB",
            "range": 119.21180415572344,
            "extra": "median: 54.17"
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
          "id": "78d418ba611903be1dc7ca71a48dbc655265606b",
          "message": "[release:patch] 2.4.2 Backward Compatibility",
          "timestamp": "2025-08-19T22:09:34+02:00",
          "tree_id": "dc49d2cc29eef59f25a0b84c47ab18dbd6424fe1",
          "url": "https://github.com/flowr-analysis/flowr/commit/78d418ba611903be1dc7ca71a48dbc655265606b"
        },
        "date": 1755635628601,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 247.51687363999997,
            "unit": "ms",
            "range": 45.8180531173997,
            "extra": "median: 225.64ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.3220113,
            "unit": "ms",
            "range": 13.962072240284348,
            "extra": "median: 10.34ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 92.93348498,
            "unit": "ms",
            "range": 86.35825351955896,
            "extra": "median: 45.67ms"
          },
          {
            "name": "Total per-file",
            "value": 2254.18911494,
            "unit": "ms",
            "range": 3651.7374375826316,
            "extra": "median: 524.52ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 9.91366574,
            "unit": "ms",
            "range": 8.729540246495763,
            "extra": "median: 6.79ms"
          },
          {
            "name": "Static slicing",
            "value": 4.71526179595657,
            "unit": "ms",
            "range": 13.830293445856125,
            "extra": "median: 0.93ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.25705859754825566,
            "unit": "ms",
            "range": 0.1526516341937826,
            "extra": "median: 0.18ms"
          },
          {
            "name": "Total per-slice",
            "value": 4.97975007304028,
            "unit": "ms",
            "range": 13.861671623291565,
            "extra": "median: 1.34ms"
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
            "value": 108.77921875,
            "unit": "KiB",
            "range": 119.21180415572344,
            "extra": "median: 54.17"
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
          "id": "5ec7debf603e07049f0f5f87c4ef68c2f6570419",
          "message": "[release:patch] 2.4.4 Stability Fixes",
          "timestamp": "2025-08-20T16:27:35+02:00",
          "tree_id": "9962abc2f65092057c0b79c2d53f9badd4eb9ea7",
          "url": "https://github.com/flowr-analysis/flowr/commit/5ec7debf603e07049f0f5f87c4ef68c2f6570419"
        },
        "date": 1755701574982,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 255.30822162,
            "unit": "ms",
            "range": 48.09335135884101,
            "extra": "median: 235.11ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.87829894,
            "unit": "ms",
            "range": 14.567700693024044,
            "extra": "median: 10.30ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 94.57506184,
            "unit": "ms",
            "range": 89.39248585914324,
            "extra": "median: 49.11ms"
          },
          {
            "name": "Total per-file",
            "value": 2302.6302205399998,
            "unit": "ms",
            "range": 3671.8502243158073,
            "extra": "median: 535.93ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.63778934,
            "unit": "ms",
            "range": 9.145744602498855,
            "extra": "median: 8.17ms"
          },
          {
            "name": "Static slicing",
            "value": 4.739819725786079,
            "unit": "ms",
            "range": 13.679897497223768,
            "extra": "median: 0.90ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2858180761606835,
            "unit": "ms",
            "range": 0.1725112211872535,
            "extra": "median: 0.17ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.033809549691688,
            "unit": "ms",
            "range": 13.71658095771215,
            "extra": "median: 1.30ms"
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
          "id": "b259768e775981c7e1430a45046b79cada9a7f45",
          "message": "[release:patch] 2.4.5 Benchmark Patch",
          "timestamp": "2025-08-20T17:16:35+02:00",
          "tree_id": "b4a13338215ac4f19a08389629cbb94077a37916",
          "url": "https://github.com/flowr-analysis/flowr/commit/b259768e775981c7e1430a45046b79cada9a7f45"
        },
        "date": 1755705326069,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 253.73778956,
            "unit": "ms",
            "range": 48.36186328606636,
            "extra": "median: 230.64ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.04892132,
            "unit": "ms",
            "range": 14.463433606946563,
            "extra": "median: 10.43ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 94.39283481999999,
            "unit": "ms",
            "range": 90.36686413750905,
            "extra": "median: 48.71ms"
          },
          {
            "name": "Total per-file",
            "value": 2288.85266534,
            "unit": "ms",
            "range": 3691.771351589431,
            "extra": "median: 523.88ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.39620464,
            "unit": "ms",
            "range": 9.027710349396258,
            "extra": "median: 7.20ms"
          },
          {
            "name": "Static slicing",
            "value": 4.760660933654036,
            "unit": "ms",
            "range": 13.978551499383961,
            "extra": "median: 0.92ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.26445878617614127,
            "unit": "ms",
            "range": 0.15732454233100687,
            "extra": "median: 0.16ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.032695697498037,
            "unit": "ms",
            "range": 14.010009607756839,
            "extra": "median: 1.15ms"
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
          "id": "f76a9565b68adc516aab54ef1e0eaddc3dc40832",
          "message": "[release:patch] 2.4.6 Fix MapIterator in DFShape Linter",
          "timestamp": "2025-08-20T18:54:08+02:00",
          "tree_id": "f6fddd12c13459514380efe842dc91c81011c613",
          "url": "https://github.com/flowr-analysis/flowr/commit/f76a9565b68adc516aab54ef1e0eaddc3dc40832"
        },
        "date": 1755710669174,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 248.34321038,
            "unit": "ms",
            "range": 45.86513750681649,
            "extra": "median: 225.89ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.51127652,
            "unit": "ms",
            "range": 13.69139006694241,
            "extra": "median: 10.67ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 92.12778496,
            "unit": "ms",
            "range": 86.50468912130977,
            "extra": "median: 45.29ms"
          },
          {
            "name": "Total per-file",
            "value": 2253.99134382,
            "unit": "ms",
            "range": 3641.0078971429307,
            "extra": "median: 529.42ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.10682538,
            "unit": "ms",
            "range": 9.331435335221203,
            "extra": "median: 6.87ms"
          },
          {
            "name": "Static slicing",
            "value": 4.709082555501608,
            "unit": "ms",
            "range": 13.710285525645427,
            "extra": "median: 0.91ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.25665609243318827,
            "unit": "ms",
            "range": 0.16203818432629422,
            "extra": "median: 0.15ms"
          },
          {
            "name": "Total per-slice",
            "value": 4.97336514955098,
            "unit": "ms",
            "range": 13.741605899100344,
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
          "id": "87ffcf33ef1f98032391f4c01799ab07d82c3535",
          "message": "[release:patch] 2.4.7 AbsInt Framework",
          "timestamp": "2025-08-20T20:12:22+02:00",
          "tree_id": "f074bdf7c2c43e429a51399ee64b360768a5f11b",
          "url": "https://github.com/flowr-analysis/flowr/commit/87ffcf33ef1f98032391f4c01799ab07d82c3535"
        },
        "date": 1755715258815,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 244.77497540000002,
            "unit": "ms",
            "range": 45.16501399668505,
            "extra": "median: 223.82ms"
          },
          {
            "name": "Normalize R AST",
            "value": 18.3741813,
            "unit": "ms",
            "range": 13.822957544984224,
            "extra": "median: 10.34ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 91.60587054000001,
            "unit": "ms",
            "range": 86.12766129711436,
            "extra": "median: 46.24ms"
          },
          {
            "name": "Total per-file",
            "value": 2205.1805046599998,
            "unit": "ms",
            "range": 3556.262513901843,
            "extra": "median: 515.41ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.043949119999999,
            "unit": "ms",
            "range": 8.473457721046062,
            "extra": "median: 7.22ms"
          },
          {
            "name": "Static slicing",
            "value": 4.5976882299888855,
            "unit": "ms",
            "range": 13.398865525816698,
            "extra": "median: 0.88ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.24499297792268562,
            "unit": "ms",
            "range": 0.14797265692946382,
            "extra": "median: 0.14ms"
          },
          {
            "name": "Total per-slice",
            "value": 4.849946613331357,
            "unit": "ms",
            "range": 13.426447349907228,
            "extra": "median: 1.10ms"
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
          "id": "5f6939cf39d36c0b7f37824c2f28dab4a6255f3f",
          "message": "[release:minor] 2.5.0 RMarkdown Adapter",
          "timestamp": "2025-09-23T23:23:41+02:00",
          "tree_id": "edb9befaf52c99b5fa3263805d737db4834fb2b8",
          "url": "https://github.com/flowr-analysis/flowr/commit/5f6939cf39d36c0b7f37824c2f28dab4a6255f3f"
        },
        "date": 1758664058922,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 245.83156102,
            "range": "45.32526256213791",
            "unit": "ms",
            "extra": "median: 228.17ms"
          },
          {
            "name": "Normalize R AST",
            "value": 20.401951420000003,
            "range": "13.989121576848646",
            "unit": "ms",
            "extra": "median: 12.86ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 94.20931764,
            "range": "87.80310334459479",
            "unit": "ms",
            "extra": "median: 46.82ms"
          },
          {
            "name": "Total per-file",
            "value": 2474.980707,
            "range": "4011.9133410639947",
            "unit": "ms",
            "extra": "median: 525.50ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.3804991,
            "range": "9.130224962774696",
            "unit": "ms",
            "extra": "median: 6.64ms"
          },
          {
            "name": "Static slicing",
            "value": 5.21330274061889,
            "range": "14.814058966513855",
            "unit": "ms",
            "extra": "median: 0.93ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2524543444811809,
            "range": "0.1589196561692175",
            "unit": "ms",
            "extra": "median: 0.18ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.473346819376645,
            "range": "14.844793187546925",
            "unit": "ms",
            "extra": "median: 1.17ms"
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
            "value": 0.876351149729202,
            "unit": "#",
            "extra": "std: 0.1066330704666776"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8210829968770128,
            "unit": "#",
            "extra": "std: 0.15253328165512922"
          },
          {
            "name": "memory (df-graph)",
            "value": 111.78607421875,
            "range": "123.57358955141903",
            "unit": "KiB",
            "extra": "median: 54.67"
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
          "id": "682d74373c38c114c4e29134c2c3383f2981e025",
          "message": "[release:minor] 2.6.0 Project API",
          "timestamp": "2025-10-14T00:24:40+08:00",
          "tree_id": "47d8c3cb141b1fa6146da160ddbe8b6b0a6211e2",
          "url": "https://github.com/flowr-analysis/flowr/commit/682d74373c38c114c4e29134c2c3383f2981e025"
        },
        "date": 1760374353764,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 255.63132081999998,
            "range": "48.84114349615493",
            "unit": "ms",
            "extra": "median: 235.06ms"
          },
          {
            "name": "Normalize R AST",
            "value": 20.567090280000002,
            "range": "15.276713148392052",
            "unit": "ms",
            "extra": "median: 12.52ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 97.33709344,
            "range": "91.98120737320885",
            "unit": "ms",
            "extra": "median: 52.44ms"
          },
          {
            "name": "Total per-file",
            "value": 2609.55714694,
            "range": "4261.334347901732",
            "unit": "ms",
            "extra": "median: 568.00ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.45682388,
            "range": "9.170184753908163",
            "unit": "ms",
            "extra": "median: 7.08ms"
          },
          {
            "name": "Static slicing",
            "value": 5.453491865368731,
            "range": "15.716472220013994",
            "unit": "ms",
            "extra": "median: 0.95ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.30233343678394586,
            "range": "0.1803288672154372",
            "unit": "ms",
            "extra": "median: 0.20ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.764412153451093,
            "range": "15.751001638039082",
            "unit": "ms",
            "extra": "median: 1.24ms"
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
            "value": 0.876351149729202,
            "unit": "#",
            "extra": "std: 0.1066330704666776"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8210829968770128,
            "unit": "#",
            "extra": "std: 0.15253328165512922"
          },
          {
            "name": "memory (df-graph)",
            "value": 111.78607421875,
            "range": "123.57358955141903",
            "unit": "KiB",
            "extra": "median: 54.67"
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
          "id": "9b5e57d9348c4f48dbe7f3176e759a70611069e7",
          "message": "[release:patch] 2.6.1 Fixes, Higher-Order-Fn Query",
          "timestamp": "2025-10-21T08:08:34+02:00",
          "tree_id": "2f91cf50597d2820d504537ae42bb4f6cbfd3d39",
          "url": "https://github.com/flowr-analysis/flowr/commit/9b5e57d9348c4f48dbe7f3176e759a70611069e7"
        },
        "date": 1761028229950,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 248.52106458,
            "range": "46.035532237828185",
            "unit": "ms",
            "extra": "median: 228.18ms"
          },
          {
            "name": "Normalize R AST",
            "value": 21.16217136,
            "range": "14.309223580930638",
            "unit": "ms",
            "extra": "median: 13.45ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 96.91211514,
            "range": "90.91916696871742",
            "unit": "ms",
            "extra": "median: 50.19ms"
          },
          {
            "name": "Total per-file",
            "value": 2503.85964566,
            "range": "4045.4613366997355",
            "unit": "ms",
            "extra": "median: 531.94ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.34765722,
            "range": "8.833812072172735",
            "unit": "ms",
            "extra": "median: 7.09ms"
          },
          {
            "name": "Static slicing",
            "value": 5.266916897791065,
            "range": "14.788298632784597",
            "unit": "ms",
            "extra": "median: 1.03ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.26433166056349755,
            "range": "0.18410838403315866",
            "unit": "ms",
            "extra": "median: 0.19ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.539095730216457,
            "range": "14.821531564468039",
            "unit": "ms",
            "extra": "median: 1.31ms"
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
            "value": 0.876351149729202,
            "unit": "#",
            "extra": "std: 0.1066330704666776"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8210829968770128,
            "unit": "#",
            "extra": "std: 0.15253328165512922"
          },
          {
            "name": "memory (df-graph)",
            "value": 111.78607421875,
            "range": "123.57358955141903",
            "unit": "KiB",
            "extra": "median: 54.67"
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
          "id": "d7fb0c432a4921d48b863349e6d706924073c485",
          "message": "[release:patch] 2.6.2 TS-Queries, new Domain Structure, more Reserved Words, removed Lineage Query",
          "timestamp": "2025-11-09T08:33:06+01:00",
          "tree_id": "306bc4d11ef1823fa36a831a11b0bb24f1a74438",
          "url": "https://github.com/flowr-analysis/flowr/commit/d7fb0c432a4921d48b863349e6d706924073c485"
        },
        "date": 1762674761556,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 252.83915462000002,
            "range": "48.29717932602698",
            "unit": "ms",
            "extra": "median: 230.07ms"
          },
          {
            "name": "Normalize R AST",
            "value": 21.113592699999998,
            "range": "15.072776359051021",
            "unit": "ms",
            "extra": "median: 12.99ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 96.90410286,
            "range": "92.24628793092222",
            "unit": "ms",
            "extra": "median: 52.12ms"
          },
          {
            "name": "Total per-file",
            "value": 2537.9017442199997,
            "range": "4124.781223540891",
            "unit": "ms",
            "extra": "median: 547.37ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.67394056,
            "range": "9.602754693478916",
            "unit": "ms",
            "extra": "median: 6.79ms"
          },
          {
            "name": "Static slicing",
            "value": 5.31241700424238,
            "range": "15.12817525394319",
            "unit": "ms",
            "extra": "median: 1.04ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2832719834393749,
            "range": "0.17394667264379185",
            "unit": "ms",
            "extra": "median: 0.18ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.6041881294622415,
            "range": "15.161174389997509",
            "unit": "ms",
            "extra": "median: 1.30ms"
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
            "value": 0.876351149729202,
            "unit": "#",
            "extra": "std: 0.1066330704666776"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8210829968770128,
            "unit": "#",
            "extra": "std: 0.15253328165512922"
          },
          {
            "name": "memory (df-graph)",
            "value": 110.7741796875,
            "range": "123.19172053624678",
            "unit": "KiB",
            "extra": "median: 54.67"
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
          "id": "4d1661312b8aff8da696f936fe6bbb33476dfe97",
          "message": "[release:patch] 2.6.3 Doc, Refined Analyzer, Caching, and Perf",
          "timestamp": "2025-11-25T13:20:14+01:00",
          "tree_id": "9e6bba5056c3400d6afe642ee4ef68557ea0d94f",
          "url": "https://github.com/flowr-analysis/flowr/commit/4d1661312b8aff8da696f936fe6bbb33476dfe97"
        },
        "date": 1764074355304,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 225.456328125,
            "range": "35.7938718003122",
            "unit": "ms",
            "extra": "median: 210.48ms"
          },
          {
            "name": "Normalize R AST",
            "value": 16.964470875,
            "range": "10.797828667841951",
            "unit": "ms",
            "extra": "median: 12.29ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 76.03449725,
            "range": "54.1046815901597",
            "unit": "ms",
            "extra": "median: 54.09ms"
          },
          {
            "name": "Total per-file",
            "value": 2307.4543971666667,
            "range": "3897.5879556374107",
            "unit": "ms",
            "extra": "median: 651.42ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.611637541666665,
            "range": "8.652207244507544",
            "unit": "ms",
            "extra": "median: 9.15ms"
          },
          {
            "name": "Static slicing",
            "value": 4.580239551270387,
            "range": "8.571861442637253",
            "unit": "ms",
            "extra": "median: 0.77ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2556544095946202,
            "range": "0.14061871517748978",
            "unit": "ms",
            "extra": "median: 0.22ms"
          },
          {
            "name": "Total per-slice",
            "value": 4.843072827853854,
            "range": "8.607985486948273",
            "unit": "ms",
            "extra": "median: 0.94ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 0,
            "unit": "#",
            "extra": "out of 6412 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8732552613195894,
            "unit": "#",
            "extra": "std: 0.11306997514535944"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8481492959752363,
            "unit": "#",
            "extra": "std: 0.13731812513001812"
          },
          {
            "name": "memory (df-graph)",
            "value": 103.42171223958333,
            "range": "82.36667010132857",
            "unit": "KiB",
            "extra": "median: 63.97"
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
          "id": "6a75a4fb1580fb3d26de71d59c6a6b4f20823ea3",
          "message": "[release:minor] 2.7.0 Set-Range Domains, Environment Caches, and Mermaid Exclusions",
          "timestamp": "2025-12-03T13:21:40+01:00",
          "tree_id": "81d5be6eccf50444e4a8391a0ecec541d33d00df",
          "url": "https://github.com/flowr-analysis/flowr/commit/6a75a4fb1580fb3d26de71d59c6a6b4f20823ea3"
        },
        "date": 1764765647642,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 228.78069958333333,
            "range": "38.01985811444568",
            "unit": "ms",
            "extra": "median: 208.00ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.58190025,
            "range": "11.101288468219828",
            "unit": "ms",
            "extra": "median: 13.84ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 74.49771891666667,
            "range": "53.198861391798566",
            "unit": "ms",
            "extra": "median: 68.49ms"
          },
          {
            "name": "Total per-file",
            "value": 2407.101557875,
            "range": "4125.376639988184",
            "unit": "ms",
            "extra": "median: 599.93ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.1676075,
            "range": "6.407026902162103",
            "unit": "ms",
            "extra": "median: 9.89ms"
          },
          {
            "name": "Static slicing",
            "value": 4.812316717028728,
            "range": "9.50574468223416",
            "unit": "ms",
            "extra": "median: 0.68ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2865033126019446,
            "range": "0.15573482559057586",
            "unit": "ms",
            "extra": "median: 0.26ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.105410418096923,
            "range": "9.544436411109086",
            "unit": "ms",
            "extra": "median: 0.92ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 0,
            "unit": "#",
            "extra": "out of 6412 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8732722138991175,
            "unit": "#",
            "extra": "std: 0.11308081915815325"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8481666944659172,
            "unit": "#",
            "extra": "std: 0.13732675848827966"
          },
          {
            "name": "memory (df-graph)",
            "value": 103.38810221354167,
            "range": "82.4087421327873",
            "unit": "KiB",
            "extra": "median: 63.99"
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
          "id": "f1a2885127c7e8c67841600f34c677aa8096fe53",
          "message": "[release:patch] 2.7.2 News File Support, files Query, Better Doc Context, Mermaid for NAST and CFG (npm retry)",
          "timestamp": "2025-12-17T13:44:16+01:00",
          "tree_id": "16694244a284b080a16f01a6a8761fa969522a4c",
          "url": "https://github.com/flowr-analysis/flowr/commit/f1a2885127c7e8c67841600f34c677aa8096fe53"
        },
        "date": 1765976489521,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 234.46046941666665,
            "range": "38.485175715210744",
            "unit": "ms",
            "extra": "median: 217.57ms"
          },
          {
            "name": "Normalize R AST",
            "value": 17.598476958333332,
            "range": "11.374379451232304",
            "unit": "ms",
            "extra": "median: 14.01ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 76.87148304166668,
            "range": "53.507983918977295",
            "unit": "ms",
            "extra": "median: 76.92ms"
          },
          {
            "name": "Total per-file",
            "value": 2451.251263,
            "range": "4168.240770476819",
            "unit": "ms",
            "extra": "median: 619.79ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 11.488460708333333,
            "range": "7.204820699899133",
            "unit": "ms",
            "extra": "median: 10.40ms"
          },
          {
            "name": "Static slicing",
            "value": 4.879965658661618,
            "range": "9.597959147708302",
            "unit": "ms",
            "extra": "median: 0.64ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.3074977352648729,
            "range": "0.15543031815306219",
            "unit": "ms",
            "extra": "median: 0.30ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.194587455836816,
            "range": "9.638600100240753",
            "unit": "ms",
            "extra": "median: 0.93ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 0,
            "unit": "#",
            "extra": "out of 6412 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8732722138991175,
            "unit": "#",
            "extra": "std: 0.11308081915815325"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8481666944659172,
            "unit": "#",
            "extra": "std: 0.13732675848827966"
          },
          {
            "name": "memory (df-graph)",
            "value": 103.38810221354167,
            "range": "82.4087421327873",
            "unit": "KiB",
            "extra": "median: 63.99"
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
          "id": "ff8c08742ca6fe6451fb028f50ae9dd1392fad72",
          "message": "[release:patch] 2.7.3 Namespace-File Support",
          "timestamp": "2025-12-21T15:57:35+01:00",
          "tree_id": "4abef89472b7472e816c077d5f72f1c3dd021515",
          "url": "https://github.com/flowr-analysis/flowr/commit/ff8c08742ca6fe6451fb028f50ae9dd1392fad72"
        },
        "date": 1766330104979,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 243.94502191666666,
            "range": "37.87489794041811",
            "unit": "ms",
            "extra": "median: 225.65ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.227258541666668,
            "range": "12.301492165452801",
            "unit": "ms",
            "extra": "median: 14.05ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 79.83118975,
            "range": "54.8687081930553",
            "unit": "ms",
            "extra": "median: 80.26ms"
          },
          {
            "name": "Total per-file",
            "value": 2404.856532375,
            "range": "4057.108494913291",
            "unit": "ms",
            "extra": "median: 629.31ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.177863791666667,
            "range": "6.278866513879768",
            "unit": "ms",
            "extra": "median: 9.47ms"
          },
          {
            "name": "Static slicing",
            "value": 4.818001688114911,
            "range": "9.361922464063895",
            "unit": "ms",
            "extra": "median: 0.72ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2682302284190859,
            "range": "0.16518802194739435",
            "unit": "ms",
            "extra": "median: 0.23ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.093183099044054,
            "range": "9.404263893779468",
            "unit": "ms",
            "extra": "median: 0.96ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 0,
            "unit": "#",
            "extra": "out of 6412 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8732722138991175,
            "unit": "#",
            "extra": "std: 0.11308081915815325"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8481666944659172,
            "unit": "#",
            "extra": "std: 0.13732675848827966"
          },
          {
            "name": "memory (df-graph)",
            "value": 103.38810221354167,
            "range": "82.4087421327873",
            "unit": "KiB",
            "extra": "median: 63.99"
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
          "id": "e338b738f2c8f76da1a90c6e4b02164e30450199",
          "message": "[release:patch] 2.7.4 Performance Improvements",
          "timestamp": "2025-12-22T10:07:40+01:00",
          "tree_id": "c5ff185085d80ab908e0526defa30393a6be2ee4",
          "url": "https://github.com/flowr-analysis/flowr/commit/e338b738f2c8f76da1a90c6e4b02164e30450199"
        },
        "date": 1766395518702,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 245.89158591666666,
            "range": "40.654552711659136",
            "unit": "ms",
            "extra": "median: 233.19ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.399905208333333,
            "range": "12.544430080540158",
            "unit": "ms",
            "extra": "median: 13.94ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 75.60529775,
            "range": "50.549954877176795",
            "unit": "ms",
            "extra": "median: 78.25ms"
          },
          {
            "name": "Total per-file",
            "value": 2415.23256675,
            "range": "4094.5536377479243",
            "unit": "ms",
            "extra": "median: 642.28ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.334600583333334,
            "range": "6.18034183972765",
            "unit": "ms",
            "extra": "median: 9.44ms"
          },
          {
            "name": "Static slicing",
            "value": 4.866628914234675,
            "range": "9.465841227463208",
            "unit": "ms",
            "extra": "median: 0.70ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.27386150673147147,
            "range": "0.16113288308666895",
            "unit": "ms",
            "extra": "median: 0.24ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.147433495606249,
            "range": "9.510168986286537",
            "unit": "ms",
            "extra": "median: 1.01ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 0,
            "unit": "#",
            "extra": "out of 6412 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8732722138991175,
            "unit": "#",
            "extra": "std: 0.11308081915815325"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8481666944659172,
            "unit": "#",
            "extra": "std: 0.13732675848827966"
          },
          {
            "name": "memory (df-graph)",
            "value": 103.38810221354167,
            "range": "82.4087421327873",
            "unit": "KiB",
            "extra": "median: 63.99"
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
          "id": "1b0bbae3b9d6d61e621d74be103c71f48660c933",
          "message": "[release:patch] 2.7.5 License and Author parsing, Ascii-DFGs, Minor Fixes and Features",
          "timestamp": "2025-12-23T19:09:30+01:00",
          "tree_id": "0e9bd987fb90d53191551e769d642100ee546ec4",
          "url": "https://github.com/flowr-analysis/flowr/commit/1b0bbae3b9d6d61e621d74be103c71f48660c933"
        },
        "date": 1766514425776,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 248.88955154166666,
            "range": "38.6912086957645",
            "unit": "ms",
            "extra": "median: 229.89ms"
          },
          {
            "name": "Normalize R AST",
            "value": 20.982024666666668,
            "range": "12.437728462622786",
            "unit": "ms",
            "extra": "median: 16.47ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 76.169158,
            "range": "50.67927054928483",
            "unit": "ms",
            "extra": "median: 68.12ms"
          },
          {
            "name": "Total per-file",
            "value": 2460.27773,
            "range": "4156.720421469868",
            "unit": "ms",
            "extra": "median: 622.15ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.286039,
            "range": "6.824290482055449",
            "unit": "ms",
            "extra": "median: 9.82ms"
          },
          {
            "name": "Static slicing",
            "value": 4.944386881585005,
            "range": "9.691730435045251",
            "unit": "ms",
            "extra": "median: 0.74ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2773648482245893,
            "range": "0.170599011172702",
            "unit": "ms",
            "extra": "median: 0.23ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.229083752107253,
            "range": "9.732991310277272",
            "unit": "ms",
            "extra": "median: 0.98ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 0,
            "unit": "#",
            "extra": "out of 6412 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8732552613195894,
            "unit": "#",
            "extra": "std: 0.11306997514535944"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8481492959752363,
            "unit": "#",
            "extra": "std: 0.13731812513001812"
          },
          {
            "name": "memory (df-graph)",
            "value": 103.43351236979167,
            "range": "82.37059848003125",
            "unit": "KiB",
            "extra": "median: 63.99"
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
          "id": "b1b4f9a90cc5e46cb6ea372e475e39eb142ed762",
          "message": "[release:patch] 2.7.6 Custom License Parsing",
          "timestamp": "2025-12-23T23:16:16+01:00",
          "tree_id": "4b6d032ed0ceb950ac5f6c4c4caf4a036d5602bd",
          "url": "https://github.com/flowr-analysis/flowr/commit/b1b4f9a90cc5e46cb6ea372e475e39eb142ed762"
        },
        "date": 1766529232778,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 249.34427208333335,
            "range": "40.58908813234044",
            "unit": "ms",
            "extra": "median: 230.95ms"
          },
          {
            "name": "Normalize R AST",
            "value": 20.886960541666667,
            "range": "12.274097707068313",
            "unit": "ms",
            "extra": "median: 17.43ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 76.20148520833332,
            "range": "51.12933599949484",
            "unit": "ms",
            "extra": "median: 66.45ms"
          },
          {
            "name": "Total per-file",
            "value": 2430.9674362083333,
            "range": "4092.3672543624602",
            "unit": "ms",
            "extra": "median: 624.42ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.4109515,
            "range": "6.414511020317046",
            "unit": "ms",
            "extra": "median: 9.92ms"
          },
          {
            "name": "Static slicing",
            "value": 4.878873967279141,
            "range": "9.517383102097286",
            "unit": "ms",
            "extra": "median: 0.75ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2659200797886331,
            "range": "0.15682371833452963",
            "unit": "ms",
            "extra": "median: 0.22ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.151892235589215,
            "range": "9.554521315428438",
            "unit": "ms",
            "extra": "median: 0.96ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 0,
            "unit": "#",
            "extra": "out of 6412 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8732552613195894,
            "unit": "#",
            "extra": "std: 0.11306997514535944"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8481492959752363,
            "unit": "#",
            "extra": "std: 0.13731812513001812"
          },
          {
            "name": "memory (df-graph)",
            "value": 103.43351236979167,
            "range": "82.37059848003125",
            "unit": "KiB",
            "extra": "median: 63.99"
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
          "id": "e31adf1f97c0d6086d52d8e0b2839eefeb8eca5c",
          "message": "[release:minor] 2.8.0 Call-Graphs, Roxygen 2 Support, Many Plugins, Registrations, Exceptions and Hooks",
          "timestamp": "2026-01-03T22:59:25+01:00",
          "tree_id": "352f59ea06cc313f58abb4295c602797c49f107a",
          "url": "https://github.com/flowr-analysis/flowr/commit/e31adf1f97c0d6086d52d8e0b2839eefeb8eca5c"
        },
        "date": 1767478624566,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 245.6088305,
            "range": "38.78389149846633",
            "unit": "ms",
            "extra": "median: 232.34ms"
          },
          {
            "name": "Normalize R AST",
            "value": 21.0981255,
            "range": "12.07560419898382",
            "unit": "ms",
            "extra": "median: 16.09ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 72.34518020833333,
            "range": "47.31626795122082",
            "unit": "ms",
            "extra": "median: 60.43ms"
          },
          {
            "name": "Total per-file",
            "value": 2310.4749786666666,
            "range": "3715.2143218656533",
            "unit": "ms",
            "extra": "median: 616.68ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.015717375,
            "range": "6.105818661711477",
            "unit": "ms",
            "extra": "median: 9.10ms"
          },
          {
            "name": "Static slicing",
            "value": 4.689842715369001,
            "range": "8.129343056119788",
            "unit": "ms",
            "extra": "median: 0.74ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2629811782447167,
            "range": "0.16612322366395768",
            "unit": "ms",
            "extra": "median: 0.21ms"
          },
          {
            "name": "Total per-slice",
            "value": 4.9597786280232565,
            "range": "8.16443016343748",
            "unit": "ms",
            "extra": "median: 0.84ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 0,
            "unit": "#",
            "extra": "out of 6412 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8715622195835785,
            "unit": "#",
            "extra": "std: 0.10739304109710461"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8484672457616397,
            "unit": "#",
            "extra": "std: 0.13236461665428143"
          },
          {
            "name": "memory (df-graph)",
            "value": 107.31396484375,
            "range": "85.94578119594064",
            "unit": "KiB",
            "extra": "median: 65.40"
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
          "id": "bd9b3f6e3edb84c29dd335623aa915d1356eca7b",
          "message": "[release:patch] 2.8.1 Fix: Call-Graph Construction",
          "timestamp": "2026-01-04T01:29:58+01:00",
          "tree_id": "5569a17c31003f5bede2a29cb0a8ca11c9a680e5",
          "url": "https://github.com/flowr-analysis/flowr/commit/bd9b3f6e3edb84c29dd335623aa915d1356eca7b"
        },
        "date": 1767487682479,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 252.84295733333335,
            "range": "38.778829303929726",
            "unit": "ms",
            "extra": "median: 233.87ms"
          },
          {
            "name": "Normalize R AST",
            "value": 21.599672625,
            "range": "12.553586258257932",
            "unit": "ms",
            "extra": "median: 17.83ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 74.59277404166667,
            "range": "49.33766897623267",
            "unit": "ms",
            "extra": "median: 62.40ms"
          },
          {
            "name": "Total per-file",
            "value": 2375.121077125,
            "range": "3840.078693175589",
            "unit": "ms",
            "extra": "median: 633.65ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.697375208333334,
            "range": "6.615142534104776",
            "unit": "ms",
            "extra": "median: 10.12ms"
          },
          {
            "name": "Static slicing",
            "value": 4.769244572871522,
            "range": "8.34693800092805",
            "unit": "ms",
            "extra": "median: 0.75ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.28361878829039255,
            "range": "0.16728786604969098",
            "unit": "ms",
            "extra": "median: 0.23ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.060587591794801,
            "range": "8.385367782028602",
            "unit": "ms",
            "extra": "median: 0.82ms"
          },
          {
            "name": "failed to reconstruct/re-parse",
            "value": 0,
            "unit": "#",
            "extra": "out of 6412 slices"
          },
          {
            "name": "times hit threshold",
            "value": 0,
            "unit": "#"
          },
          {
            "name": "reduction (characters)",
            "value": 0.8715622195835785,
            "unit": "#",
            "extra": "std: 0.10739304109710461"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8484672457616397,
            "unit": "#",
            "extra": "std: 0.13236461665428143"
          },
          {
            "name": "memory (df-graph)",
            "value": 107.24755859375,
            "range": "86.00080717155264",
            "unit": "KiB",
            "extra": "median: 65.40"
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
        "date": 1740298493282,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 12.707914090909092,
            "unit": "ms",
            "range": 14.436931733949686,
            "extra": "median: 9.31ms"
          },
          {
            "name": "Normalize R AST",
            "value": 14.07765,
            "unit": "ms",
            "range": 16.880497731749053,
            "extra": "median: 11.52ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 70.7186604090909,
            "unit": "ms",
            "range": 143.5752496686063,
            "extra": "median: 41.25ms"
          },
          {
            "name": "Total per-file",
            "value": 630.2796834545455,
            "unit": "ms",
            "range": 1428.688615558449,
            "extra": "median: 178.18ms"
          },
          {
            "name": "Static slicing",
            "value": 2.2451230006567915,
            "unit": "ms",
            "range": 1.884670222445624,
            "extra": "median: 0.77ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.25071162639797157,
            "unit": "ms",
            "range": 0.20508401419581218,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.5102251675580796,
            "unit": "ms",
            "range": 1.9877594203952604,
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
          "id": "ae435ebae9cf85e90cdfc73b0e1923e585d59414",
          "message": "[release:patch] 2.2.11 Better Compression, Project Query, Improved Location-Map",
          "timestamp": "2025-03-02T20:17:12+01:00",
          "tree_id": "10d49938f6bed0e336aba3a4b25d6abb70dae7f3",
          "url": "https://github.com/flowr-analysis/flowr/commit/ae435ebae9cf85e90cdfc73b0e1923e585d59414"
        },
        "date": 1740944090715,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 13.271832818181819,
            "unit": "ms",
            "range": 16.04321654708738,
            "extra": "median: 9.49ms"
          },
          {
            "name": "Normalize R AST",
            "value": 15.818185454545455,
            "unit": "ms",
            "range": 22.913436337066383,
            "extra": "median: 10.33ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 71.18746181818182,
            "unit": "ms",
            "range": 152.76911595785035,
            "extra": "median: 36.33ms"
          },
          {
            "name": "Total per-file",
            "value": 438.7153605,
            "unit": "ms",
            "range": 1095.9856013057336,
            "extra": "median: 129.48ms"
          },
          {
            "name": "Static slicing",
            "value": 0.47504037361607176,
            "unit": "ms",
            "range": 0.4689944554274824,
            "extra": "median: 0.24ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.23153499906845068,
            "unit": "ms",
            "range": 0.17884218276287134,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.7217315743442135,
            "unit": "ms",
            "range": 0.6209004809934245,
            "extra": "median: 0.43ms"
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
          "id": "48e25a3515e92280375989939735f34489b17def",
          "message": "[release:patch] 2.2.12 Vector Support, Improved Graphic Support, Eval of Strings",
          "timestamp": "2025-03-17T09:01:02+01:00",
          "tree_id": "1fa464ef6978b578ec9bf2c48d5bf00b0a526d68",
          "url": "https://github.com/flowr-analysis/flowr/commit/48e25a3515e92280375989939735f34489b17def"
        },
        "date": 1742199191384,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 13.122123,
            "unit": "ms",
            "range": 16.07686293248418,
            "extra": "median: 9.77ms"
          },
          {
            "name": "Normalize R AST",
            "value": 13.977290954545454,
            "unit": "ms",
            "range": 17.341206242418828,
            "extra": "median: 10.30ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 72.18113768181819,
            "unit": "ms",
            "range": 152.08092766684226,
            "extra": "median: 38.42ms"
          },
          {
            "name": "Total per-file",
            "value": 436.6175717727273,
            "unit": "ms",
            "range": 1087.059692073892,
            "extra": "median: 136.07ms"
          },
          {
            "name": "Static slicing",
            "value": 0.46662192307668093,
            "unit": "ms",
            "range": 0.4201024795007609,
            "extra": "median: 0.29ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.22974847109148808,
            "unit": "ms",
            "range": 0.17230501569365272,
            "extra": "median: 0.11ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.7123293104537151,
            "unit": "ms",
            "range": 0.5675468645569265,
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
            "value": 89.26784446022727,
            "unit": "KiB",
            "range": 233.4752433920374,
            "extra": "median: 19.71"
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
          "id": "c9e254b4461384546c402bde212d87b1fc5eb6f2",
          "message": "[release:patch] 2.2.13 Control-Flow Graph, R Graphics, and Better Aliasing",
          "timestamp": "2025-05-27T12:38:34+02:00",
          "tree_id": "cbce8203f5fb142ee31cb5baf2de68be545e2acf",
          "url": "https://github.com/flowr-analysis/flowr/commit/c9e254b4461384546c402bde212d87b1fc5eb6f2"
        },
        "date": 1748343295089,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 12.795212454545455,
            "unit": "ms",
            "range": 15.908824704729804,
            "extra": "median: 9.59ms"
          },
          {
            "name": "Normalize R AST",
            "value": 15.324891818181818,
            "unit": "ms",
            "range": 20.876277489075303,
            "extra": "median: 11.04ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 79.82071018181819,
            "unit": "ms",
            "range": 184.7364255986622,
            "extra": "median: 37.48ms"
          },
          {
            "name": "Total per-file",
            "value": 521.7831747727273,
            "unit": "ms",
            "range": 1291.812214983597,
            "extra": "median: 142.23ms"
          },
          {
            "name": "Static slicing",
            "value": 0.5644227122287968,
            "unit": "ms",
            "range": 0.4638989290162317,
            "extra": "median: 0.32ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2396756809765661,
            "unit": "ms",
            "range": 0.19563979495530825,
            "extra": "median: 0.11ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.8188262791230101,
            "unit": "ms",
            "range": 0.6270566960352205,
            "extra": "median: 0.49ms"
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
            "value": 115.99072265625,
            "unit": "KiB",
            "range": 295.50818665671295,
            "extra": "median: 34.15"
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
          "id": "0a000cc15c89ace7254d47c380227e261d1cfb18",
          "message": "[release:patch] 2.2.14 Basic Linting Setup",
          "timestamp": "2025-05-31T20:20:31+02:00",
          "tree_id": "3de3eb59c995a0a1e70d82b9564310f8bdf8aace",
          "url": "https://github.com/flowr-analysis/flowr/commit/0a000cc15c89ace7254d47c380227e261d1cfb18"
        },
        "date": 1748716594325,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 13.200878590909092,
            "unit": "ms",
            "range": 15.89166482724672,
            "extra": "median: 9.39ms"
          },
          {
            "name": "Normalize R AST",
            "value": 15.076508136363637,
            "unit": "ms",
            "range": 19.56915223738025,
            "extra": "median: 10.88ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 74.24347922727273,
            "unit": "ms",
            "range": 168.38006303741628,
            "extra": "median: 36.91ms"
          },
          {
            "name": "Total per-file",
            "value": 514.364478909091,
            "unit": "ms",
            "range": 1283.3519293720426,
            "extra": "median: 140.15ms"
          },
          {
            "name": "Static slicing",
            "value": 0.554244618768212,
            "unit": "ms",
            "range": 0.4376890885931725,
            "extra": "median: 0.29ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.23808857928227603,
            "unit": "ms",
            "range": 0.18380236551647033,
            "extra": "median: 0.11ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.8071606252340534,
            "unit": "ms",
            "range": 0.5965493244685955,
            "extra": "median: 0.49ms"
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
            "value": 115.99072265625,
            "unit": "KiB",
            "range": 295.50818665671295,
            "extra": "median: 34.15"
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
          "id": "117391bed2bf109635c058150d3cc1d95b01c4ac",
          "message": "[release:patch] 2.2.15 Value-Vector-Support, Linter Fixes",
          "timestamp": "2025-06-02T22:56:01+02:00",
          "tree_id": "7663c39bcbd8e0b030361e514aedb79192d69297",
          "url": "https://github.com/flowr-analysis/flowr/commit/117391bed2bf109635c058150d3cc1d95b01c4ac"
        },
        "date": 1748898946803,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 12.502354318181819,
            "unit": "ms",
            "range": 15.008386133139865,
            "extra": "median: 9.18ms"
          },
          {
            "name": "Normalize R AST",
            "value": 14.516001772727273,
            "unit": "ms",
            "range": 18.044221814077446,
            "extra": "median: 10.74ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 74.89184909090909,
            "unit": "ms",
            "range": 166.07176061196944,
            "extra": "median: 32.71ms"
          },
          {
            "name": "Total per-file",
            "value": 512.1670945909091,
            "unit": "ms",
            "range": 1275.1740415647532,
            "extra": "median: 133.36ms"
          },
          {
            "name": "Static slicing",
            "value": 0.5558078596178451,
            "unit": "ms",
            "range": 0.4407416017910263,
            "extra": "median: 0.30ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.232210199327764,
            "unit": "ms",
            "range": 0.17298048180351677,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.8031465066111031,
            "unit": "ms",
            "range": 0.5950147686727696,
            "extra": "median: 0.49ms"
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
            "value": 115.99072265625,
            "unit": "KiB",
            "range": 295.50818665671295,
            "extra": "median: 34.15"
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
          "id": "c83d61b417de41d625ff1eaa6bafeec1c9515d3c",
          "message": "[release:patch] 2.2.16 Local Config, Fixes, New Linter Rules",
          "timestamp": "2025-07-12T17:46:19+02:00",
          "tree_id": "32dc33bb5e67b5d31cf964b0d0e8bfb2ab587658",
          "url": "https://github.com/flowr-analysis/flowr/commit/c83d61b417de41d625ff1eaa6bafeec1c9515d3c"
        },
        "date": 1752336342546,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 13.530377454545455,
            "unit": "ms",
            "range": 16.1784151096326,
            "extra": "median: 10.29ms"
          },
          {
            "name": "Normalize R AST",
            "value": 16.31660859090909,
            "unit": "ms",
            "range": 21.10544910036797,
            "extra": "median: 12.81ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 84.51878704545454,
            "unit": "ms",
            "range": 194.43112240740112,
            "extra": "median: 40.12ms"
          },
          {
            "name": "Total per-file",
            "value": 558.0888642272728,
            "unit": "ms",
            "range": 1388.577335106416,
            "extra": "median: 152.39ms"
          },
          {
            "name": "Static slicing",
            "value": 0.6124829247910438,
            "unit": "ms",
            "range": 0.49697645954873537,
            "extra": "median: 0.38ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.25669348851711626,
            "unit": "ms",
            "range": 0.20846294776958418,
            "extra": "median: 0.13ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.8839450591588476,
            "unit": "ms",
            "range": 0.6692160302933918,
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
            "value": 115.98459694602273,
            "unit": "KiB",
            "range": 295.4973184297739,
            "extra": "median: 34.15"
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
          "id": "9813198d1b677669d51a188fda97ca97d759d4ed",
          "message": "[release:minor] 2.3.0 Data Frame Shape Inference",
          "timestamp": "2025-07-21T13:30:08+02:00",
          "tree_id": "8f32ebb30ba791261c8ed267b51f312f8f457b87",
          "url": "https://github.com/flowr-analysis/flowr/commit/9813198d1b677669d51a188fda97ca97d759d4ed"
        },
        "date": 1753099076153,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 12.917367409090907,
            "unit": "ms",
            "range": 15.276397400229461,
            "extra": "median: 9.63ms"
          },
          {
            "name": "Normalize R AST",
            "value": 14.581851863636363,
            "unit": "ms",
            "range": 17.972943968085684,
            "extra": "median: 11.22ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 79.64558463636364,
            "unit": "ms",
            "range": 182.57808481552814,
            "extra": "median: 35.83ms"
          },
          {
            "name": "Total per-file",
            "value": 516.4334237727272,
            "unit": "ms",
            "range": 1276.3925931847996,
            "extra": "median: 136.42ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 0,
            "unit": "ms",
            "range": null,
            "extra": "median: NaNms"
          },
          {
            "name": "Infer data frame shapes",
            "value": 0,
            "unit": "ms",
            "range": null,
            "extra": "median: NaNms"
          },
          {
            "name": "Static slicing",
            "value": 0.5772018022666755,
            "unit": "ms",
            "range": 0.4575591829997375,
            "extra": "median: 0.31ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.23675215494832322,
            "unit": "ms",
            "range": 0.1816300085880296,
            "extra": "median: 0.11ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.828777056259691,
            "unit": "ms",
            "range": 0.6112703035028543,
            "extra": "median: 0.47ms"
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
            "value": 115.98459694602273,
            "unit": "KiB",
            "range": 295.4973184297739,
            "extra": "median: 34.15"
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
          "id": "da0972c3d22ad92c7e07921b4fb65926ed163a6f",
          "message": "[release:minor] 2.4.0 Forward-Slicing, Minor Fixes",
          "timestamp": "2025-08-06T22:30:00+02:00",
          "tree_id": "a05dcedfd31580a22beb3ebdde5f2fcbc9217c2d",
          "url": "https://github.com/flowr-analysis/flowr/commit/da0972c3d22ad92c7e07921b4fb65926ed163a6f"
        },
        "date": 1754513687305,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 14.098150818181818,
            "unit": "ms",
            "range": 18.48984826415147,
            "extra": "median: 9.93ms"
          },
          {
            "name": "Normalize R AST",
            "value": 15.822863954545456,
            "unit": "ms",
            "range": 20.200803717303117,
            "extra": "median: 12.03ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 74.55254163636364,
            "unit": "ms",
            "range": 160.98474659762803,
            "extra": "median: 37.28ms"
          },
          {
            "name": "Total per-file",
            "value": 539.6961254545455,
            "unit": "ms",
            "range": 1333.524950597152,
            "extra": "median: 147.47ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.736005590909091,
            "unit": "ms",
            "range": 19.24288233793657,
            "extra": "median: 3.45ms"
          },
          {
            "name": "Static slicing",
            "value": 0.5720584707772275,
            "unit": "ms",
            "range": 0.46940195482513575,
            "extra": "median: 0.33ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2439760601450612,
            "unit": "ms",
            "range": 0.18831182890270712,
            "extra": "median: 0.12ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.8310003370996032,
            "unit": "ms",
            "range": 0.6294030667771899,
            "extra": "median: 0.49ms"
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
            "value": 115.98459694602273,
            "unit": "KiB",
            "range": 295.4973184297739,
            "extra": "median: 34.15"
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
          "id": "6861d92ca7eed15ab47a237a9981ada168adf133",
          "message": "[release:patch] 2.4.1 Localized Config, Support for File Modes",
          "timestamp": "2025-08-18T13:40:09+02:00",
          "tree_id": "98a6643a733244c5396f5a3e2a505b2c540e6b26",
          "url": "https://github.com/flowr-analysis/flowr/commit/6861d92ca7eed15ab47a237a9981ada168adf133"
        },
        "date": 1755519424687,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 12.492041454545456,
            "unit": "ms",
            "range": 14.889059020506755,
            "extra": "median: 9.60ms"
          },
          {
            "name": "Normalize R AST",
            "value": 15.022788636363636,
            "unit": "ms",
            "range": 18.82386787874481,
            "extra": "median: 11.20ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 73.86094627272726,
            "unit": "ms",
            "range": 159.3191635090827,
            "extra": "median: 34.84ms"
          },
          {
            "name": "Total per-file",
            "value": 584.5485562272728,
            "unit": "ms",
            "range": 1443.2338987799521,
            "extra": "median: 154.35ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.129936454545454,
            "unit": "ms",
            "range": 17.57204704187519,
            "extra": "median: 2.93ms"
          },
          {
            "name": "Static slicing",
            "value": 0.8560651179796688,
            "unit": "ms",
            "range": 0.46499322682997823,
            "extra": "median: 0.85ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.23521771006157957,
            "unit": "ms",
            "range": 0.18570413301993688,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.1066636776871046,
            "unit": "ms",
            "range": 0.6155898814678581,
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
          "id": "78d418ba611903be1dc7ca71a48dbc655265606b",
          "message": "[release:patch] 2.4.2 Backward Compatibility",
          "timestamp": "2025-08-19T22:09:34+02:00",
          "tree_id": "dc49d2cc29eef59f25a0b84c47ab18dbd6424fe1",
          "url": "https://github.com/flowr-analysis/flowr/commit/78d418ba611903be1dc7ca71a48dbc655265606b"
        },
        "date": 1755635629189,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 13.234871318181819,
            "unit": "ms",
            "range": 15.906212537551879,
            "extra": "median: 9.50ms"
          },
          {
            "name": "Normalize R AST",
            "value": 14.655486772727274,
            "unit": "ms",
            "range": 18.02811385865022,
            "extra": "median: 11.23ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 74.78826454545455,
            "unit": "ms",
            "range": 163.49539317366907,
            "extra": "median: 37.71ms"
          },
          {
            "name": "Total per-file",
            "value": 591.3358250909091,
            "unit": "ms",
            "range": 1464.0145902447775,
            "extra": "median: 163.49ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.652507318181819,
            "unit": "ms",
            "range": 18.45889485214842,
            "extra": "median: 3.35ms"
          },
          {
            "name": "Static slicing",
            "value": 0.8418940762889352,
            "unit": "ms",
            "range": 0.4526808559517294,
            "extra": "median: 0.76ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.23678856710116278,
            "unit": "ms",
            "range": 0.19671530996603812,
            "extra": "median: 0.11ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.0937339188067203,
            "unit": "ms",
            "range": 0.6110670062922082,
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
          "id": "242f9494a180fd2720caa0b621124fd62c198c3d",
          "message": "[release:patch] 2.4.3 Linting Rule: Useless Loop",
          "timestamp": "2025-08-20T10:35:54+02:00",
          "tree_id": "d338e8d592713002ea619a18cf40d4629d04c249",
          "url": "https://github.com/flowr-analysis/flowr/commit/242f9494a180fd2720caa0b621124fd62c198c3d"
        },
        "date": 1755680552921,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 12.951230227272726,
            "unit": "ms",
            "range": 16.376882876083208,
            "extra": "median: 9.28ms"
          },
          {
            "name": "Normalize R AST",
            "value": 15.555360636363636,
            "unit": "ms",
            "range": 20.391321843687077,
            "extra": "median: 11.98ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 73.66923709090909,
            "unit": "ms",
            "range": 160.70858555161757,
            "extra": "median: 39.04ms"
          },
          {
            "name": "Total per-file",
            "value": 576.8073637727273,
            "unit": "ms",
            "range": 1426.9384062752326,
            "extra": "median: 153.87ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.363148818181818,
            "unit": "ms",
            "range": 18.241097167587984,
            "extra": "median: 3.76ms"
          },
          {
            "name": "Static slicing",
            "value": 0.8446195799686181,
            "unit": "ms",
            "range": 0.4245835177298461,
            "extra": "median: 0.81ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.23053676716517874,
            "unit": "ms",
            "range": 0.1805700273651875,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.089550862844344,
            "unit": "ms",
            "range": 0.5718376506650956,
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
          "id": "5ec7debf603e07049f0f5f87c4ef68c2f6570419",
          "message": "[release:patch] 2.4.4 Stability Fixes",
          "timestamp": "2025-08-20T16:27:35+02:00",
          "tree_id": "9962abc2f65092057c0b79c2d53f9badd4eb9ea7",
          "url": "https://github.com/flowr-analysis/flowr/commit/5ec7debf603e07049f0f5f87c4ef68c2f6570419"
        },
        "date": 1755701577318,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 12.496885863636363,
            "unit": "ms",
            "range": 15.111089542650772,
            "extra": "median: 9.53ms"
          },
          {
            "name": "Normalize R AST",
            "value": 15.130143636363636,
            "unit": "ms",
            "range": 19.045972046427316,
            "extra": "median: 11.70ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 74.11697640909091,
            "unit": "ms",
            "range": 163.50542310352876,
            "extra": "median: 38.07ms"
          },
          {
            "name": "Total per-file",
            "value": 580.8130724545455,
            "unit": "ms",
            "range": 1437.5230622282324,
            "extra": "median: 157.00ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.26075968181818,
            "unit": "ms",
            "range": 17.42480931960938,
            "extra": "median: 3.62ms"
          },
          {
            "name": "Static slicing",
            "value": 0.8396811517300964,
            "unit": "ms",
            "range": 0.4308001003777623,
            "extra": "median: 0.78ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.23152334558408372,
            "unit": "ms",
            "range": 0.17544387806625167,
            "extra": "median: 0.11ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.0862546607833812,
            "unit": "ms",
            "range": 0.576675332149789,
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
          "id": "b259768e775981c7e1430a45046b79cada9a7f45",
          "message": "[release:patch] 2.4.5 Benchmark Patch",
          "timestamp": "2025-08-20T17:16:35+02:00",
          "tree_id": "b4a13338215ac4f19a08389629cbb94077a37916",
          "url": "https://github.com/flowr-analysis/flowr/commit/b259768e775981c7e1430a45046b79cada9a7f45"
        },
        "date": 1755705327349,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 13.524228727272726,
            "unit": "ms",
            "range": 16.414117559244204,
            "extra": "median: 9.56ms"
          },
          {
            "name": "Normalize R AST",
            "value": 15.483978227272727,
            "unit": "ms",
            "range": 21.01854166074569,
            "extra": "median: 11.26ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 79.3139798181818,
            "unit": "ms",
            "range": 181.37455907657275,
            "extra": "median: 35.30ms"
          },
          {
            "name": "Total per-file",
            "value": 603.8349656818182,
            "unit": "ms",
            "range": 1497.023801284282,
            "extra": "median: 155.96ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.943514272727274,
            "unit": "ms",
            "range": 18.915325580214148,
            "extra": "median: 3.35ms"
          },
          {
            "name": "Static slicing",
            "value": 0.864738841414574,
            "unit": "ms",
            "range": 0.4661320762186803,
            "extra": "median: 0.69ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.23916942389224444,
            "unit": "ms",
            "range": 0.19211909832874033,
            "extra": "median: 0.11ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.1185772612795792,
            "unit": "ms",
            "range": 0.6181939777199276,
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
          "id": "f76a9565b68adc516aab54ef1e0eaddc3dc40832",
          "message": "[release:patch] 2.4.6 Fix MapIterator in DFShape Linter",
          "timestamp": "2025-08-20T18:54:08+02:00",
          "tree_id": "f6fddd12c13459514380efe842dc91c81011c613",
          "url": "https://github.com/flowr-analysis/flowr/commit/f76a9565b68adc516aab54ef1e0eaddc3dc40832"
        },
        "date": 1755710670479,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 12.806118181818182,
            "unit": "ms",
            "range": 15.25733328832822,
            "extra": "median: 9.41ms"
          },
          {
            "name": "Normalize R AST",
            "value": 15.367087545454545,
            "unit": "ms",
            "range": 19.321146084085413,
            "extra": "median: 11.73ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 74.42731163636364,
            "unit": "ms",
            "range": 165.71207669222838,
            "extra": "median: 35.20ms"
          },
          {
            "name": "Total per-file",
            "value": 591.3327782272728,
            "unit": "ms",
            "range": 1466.4432934078477,
            "extra": "median: 152.50ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.472190045454544,
            "unit": "ms",
            "range": 18.645419221853736,
            "extra": "median: 3.22ms"
          },
          {
            "name": "Static slicing",
            "value": 0.851197288980519,
            "unit": "ms",
            "range": 0.46189965334606664,
            "extra": "median: 0.74ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2365098087764867,
            "unit": "ms",
            "range": 0.1918538535849674,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.1042966799285783,
            "unit": "ms",
            "range": 0.6187155621277551,
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
          "id": "87ffcf33ef1f98032391f4c01799ab07d82c3535",
          "message": "[release:patch] 2.4.7 AbsInt Framework",
          "timestamp": "2025-08-20T20:12:22+02:00",
          "tree_id": "f074bdf7c2c43e429a51399ee64b360768a5f11b",
          "url": "https://github.com/flowr-analysis/flowr/commit/87ffcf33ef1f98032391f4c01799ab07d82c3535"
        },
        "date": 1755715260141,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 12.602494863636363,
            "unit": "ms",
            "range": 15.041196098732684,
            "extra": "median: 9.43ms"
          },
          {
            "name": "Normalize R AST",
            "value": 14.771077409090909,
            "unit": "ms",
            "range": 18.811798441289003,
            "extra": "median: 11.31ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 72.95342795454545,
            "unit": "ms",
            "range": 162.98437621335978,
            "extra": "median: 37.01ms"
          },
          {
            "name": "Total per-file",
            "value": 582.0671242727273,
            "unit": "ms",
            "range": 1444.8703170102135,
            "extra": "median: 152.38ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.365070818181819,
            "unit": "ms",
            "range": 18.694051562164333,
            "extra": "median: 2.90ms"
          },
          {
            "name": "Static slicing",
            "value": 0.8427542243359423,
            "unit": "ms",
            "range": 0.42958060600329184,
            "extra": "median: 0.75ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2327596503052503,
            "unit": "ms",
            "range": 0.18060757635432112,
            "extra": "median: 0.10ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.09024702659751,
            "unit": "ms",
            "range": 0.5780951377565356,
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
          "id": "5f6939cf39d36c0b7f37824c2f28dab4a6255f3f",
          "message": "[release:minor] 2.5.0 RMarkdown Adapter",
          "timestamp": "2025-09-23T23:23:41+02:00",
          "tree_id": "edb9befaf52c99b5fa3263805d737db4834fb2b8",
          "url": "https://github.com/flowr-analysis/flowr/commit/5f6939cf39d36c0b7f37824c2f28dab4a6255f3f"
        },
        "date": 1758664060486,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 12.617613954545455,
            "range": "14.117463684364079",
            "unit": "ms",
            "extra": "median: 9.61ms"
          },
          {
            "name": "Normalize R AST",
            "value": 15.3721925,
            "range": "19.885176692896508",
            "unit": "ms",
            "extra": "median: 11.67ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 77.43501872727273,
            "range": "170.10252057142284",
            "unit": "ms",
            "extra": "median: 34.90ms"
          },
          {
            "name": "Total per-file",
            "value": 604.9281383636363,
            "range": "1503.8317184334924",
            "unit": "ms",
            "extra": "median: 158.46ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.270258681818182,
            "range": "24.37700198971698",
            "unit": "ms",
            "extra": "median: 3.42ms"
          },
          {
            "name": "Static slicing",
            "value": 0.8703347563646695,
            "range": "0.49307973208321443",
            "unit": "ms",
            "extra": "median: 0.59ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.24700690438282538,
            "range": "0.21412476188462395",
            "unit": "ms",
            "extra": "median: 0.11ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.1323993193756592,
            "range": "0.6583417194414105",
            "unit": "ms",
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
            "value": 0.7801660063880064,
            "unit": "#",
            "extra": "std: 0.1261285782699485"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7575735855163274,
            "unit": "#",
            "extra": "std: 0.12942676908005035"
          },
          {
            "name": "memory (df-graph)",
            "value": 117.67085404829545,
            "range": "300.9854515829695",
            "unit": "KiB",
            "extra": "median: 34.18"
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
          "id": "682d74373c38c114c4e29134c2c3383f2981e025",
          "message": "[release:minor] 2.6.0 Project API",
          "timestamp": "2025-10-14T00:24:40+08:00",
          "tree_id": "47d8c3cb141b1fa6146da160ddbe8b6b0a6211e2",
          "url": "https://github.com/flowr-analysis/flowr/commit/682d74373c38c114c4e29134c2c3383f2981e025"
        },
        "date": 1760374354853,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 12.85821468181818,
            "range": "14.091883291512183",
            "unit": "ms",
            "extra": "median: 9.26ms"
          },
          {
            "name": "Normalize R AST",
            "value": 15.365326363636363,
            "range": "20.780572203552932",
            "unit": "ms",
            "extra": "median: 10.59ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 72.11892963636365,
            "range": "157.66241543075003",
            "unit": "ms",
            "extra": "median: 35.77ms"
          },
          {
            "name": "Total per-file",
            "value": 570.8747883636364,
            "range": "1423.0350358618134",
            "unit": "ms",
            "extra": "median: 155.45ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.145854727272727,
            "range": "18.178467240554053",
            "unit": "ms",
            "extra": "median: 3.10ms"
          },
          {
            "name": "Static slicing",
            "value": 0.8372342176002633,
            "range": "0.4532450265840219",
            "unit": "ms",
            "extra": "median: 0.71ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.23023467131623607,
            "range": "0.1829640129655771",
            "unit": "ms",
            "extra": "median: 0.11ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.082075651036959,
            "range": "0.6045099051634321",
            "unit": "ms",
            "extra": "median: 0.88ms"
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
            "value": 0.7801660063880064,
            "unit": "#",
            "extra": "std: 0.1261285782699485"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7575735855163274,
            "unit": "#",
            "extra": "std: 0.12942676908005035"
          },
          {
            "name": "memory (df-graph)",
            "value": 117.67085404829545,
            "range": "300.9854515829695",
            "unit": "KiB",
            "extra": "median: 34.18"
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
          "id": "9b5e57d9348c4f48dbe7f3176e759a70611069e7",
          "message": "[release:patch] 2.6.1 Fixes, Higher-Order-Fn Query",
          "timestamp": "2025-10-21T08:08:34+02:00",
          "tree_id": "2f91cf50597d2820d504537ae42bb4f6cbfd3d39",
          "url": "https://github.com/flowr-analysis/flowr/commit/9b5e57d9348c4f48dbe7f3176e759a70611069e7"
        },
        "date": 1761028231203,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 13.116464636363636,
            "range": "14.627774810247615",
            "unit": "ms",
            "extra": "median: 9.58ms"
          },
          {
            "name": "Normalize R AST",
            "value": 15.972998045454545,
            "range": "21.59063269126927",
            "unit": "ms",
            "extra": "median: 11.16ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 78.14236759090909,
            "range": "172.55683289528895",
            "unit": "ms",
            "extra": "median: 39.45ms"
          },
          {
            "name": "Total per-file",
            "value": 601.1105252272728,
            "range": "1491.1305303580828",
            "unit": "ms",
            "extra": "median: 162.85ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 9.679087909090908,
            "range": "22.885891437713305",
            "unit": "ms",
            "extra": "median: 3.07ms"
          },
          {
            "name": "Static slicing",
            "value": 0.88449066528418,
            "range": "0.47879966024674314",
            "unit": "ms",
            "extra": "median: 0.69ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.24487821796566164,
            "range": "0.2057345963325523",
            "unit": "ms",
            "extra": "median: 0.12ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.1439702790991835,
            "range": "0.6408172874855941",
            "unit": "ms",
            "extra": "median: 0.81ms"
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
            "value": 0.7801660063880064,
            "unit": "#",
            "extra": "std: 0.1261285782699485"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7575735855163274,
            "unit": "#",
            "extra": "std: 0.12942676908005035"
          },
          {
            "name": "memory (df-graph)",
            "value": 117.67085404829545,
            "range": "300.9854515829695",
            "unit": "KiB",
            "extra": "median: 34.18"
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
          "id": "d7fb0c432a4921d48b863349e6d706924073c485",
          "message": "[release:patch] 2.6.2 TS-Queries, new Domain Structure, more Reserved Words, removed Lineage Query",
          "timestamp": "2025-11-09T08:33:06+01:00",
          "tree_id": "306bc4d11ef1823fa36a831a11b0bb24f1a74438",
          "url": "https://github.com/flowr-analysis/flowr/commit/d7fb0c432a4921d48b863349e6d706924073c485"
        },
        "date": 1762674762870,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 12.386231045454545,
            "range": "14.90502072772543",
            "unit": "ms",
            "extra": "median: 9.20ms"
          },
          {
            "name": "Normalize R AST",
            "value": 14.344164045454544,
            "range": "19.32443618867301",
            "unit": "ms",
            "extra": "median: 9.50ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 68.9044105,
            "range": "155.53075551750499",
            "unit": "ms",
            "extra": "median: 32.84ms"
          },
          {
            "name": "Total per-file",
            "value": 608.3651927727273,
            "range": "1551.609325966361",
            "unit": "ms",
            "extra": "median: 149.62ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.721791863636364,
            "range": "19.495582656166555",
            "unit": "ms",
            "extra": "median: 3.17ms"
          },
          {
            "name": "Static slicing",
            "value": 0.8208789291117496,
            "range": "0.44931991189040116",
            "unit": "ms",
            "extra": "median: 0.74ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.24151013618821174,
            "range": "0.19922767988873136",
            "unit": "ms",
            "extra": "median: 0.11ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.075694527957671,
            "range": "0.5978123332387457",
            "unit": "ms",
            "extra": "median: 0.88ms"
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
            "value": 0.7801660063880064,
            "unit": "#",
            "extra": "std: 0.1261285782699485"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7575735855163274,
            "unit": "#",
            "extra": "std: 0.12942676908005035"
          },
          {
            "name": "memory (df-graph)",
            "value": 117.67085404829545,
            "range": "300.9854515829695",
            "unit": "KiB",
            "extra": "median: 34.18"
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
          "id": "4d1661312b8aff8da696f936fe6bbb33476dfe97",
          "message": "[release:patch] 2.6.3 Doc, Refined Analyzer, Caching, and Perf",
          "timestamp": "2025-11-25T13:20:14+01:00",
          "tree_id": "9e6bba5056c3400d6afe642ee4ef68557ea0d94f",
          "url": "https://github.com/flowr-analysis/flowr/commit/4d1661312b8aff8da696f936fe6bbb33476dfe97"
        },
        "date": 1764074357251,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 12.960302590909091,
            "range": "14.930283024382016",
            "unit": "ms",
            "extra": "median: 9.62ms"
          },
          {
            "name": "Normalize R AST",
            "value": 15.606466090909091,
            "range": "20.12642604354077",
            "unit": "ms",
            "extra": "median: 11.43ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 72.40180236363636,
            "range": "155.24035709348783",
            "unit": "ms",
            "extra": "median: 36.47ms"
          },
          {
            "name": "Total per-file",
            "value": 587.8572282272728,
            "range": "1454.0781769285243",
            "unit": "ms",
            "extra": "median: 164.20ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.237963681818181,
            "range": "17.66285858921098",
            "unit": "ms",
            "extra": "median: 3.05ms"
          },
          {
            "name": "Static slicing",
            "value": 0.8686616331672486,
            "range": "0.44663608719761105",
            "unit": "ms",
            "extra": "median: 0.86ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2458684937103648,
            "range": "0.1981168723392372",
            "unit": "ms",
            "extra": "median: 0.11ms"
          },
          {
            "name": "Total per-slice",
            "value": 1.129752127923891,
            "range": "0.6111227451750624",
            "unit": "ms",
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
            "value": 0.7801660063880064,
            "unit": "#",
            "extra": "std: 0.1261285782699485"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7575735855163274,
            "unit": "#",
            "extra": "std: 0.12942676908005035"
          },
          {
            "name": "memory (df-graph)",
            "value": 117.67085404829545,
            "range": "300.9854515829695",
            "unit": "KiB",
            "extra": "median: 34.18"
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
          "id": "6a75a4fb1580fb3d26de71d59c6a6b4f20823ea3",
          "message": "[release:minor] 2.7.0 Set-Range Domains, Environment Caches, and Mermaid Exclusions",
          "timestamp": "2025-12-03T13:21:40+01:00",
          "tree_id": "81d5be6eccf50444e4a8391a0ecec541d33d00df",
          "url": "https://github.com/flowr-analysis/flowr/commit/6a75a4fb1580fb3d26de71d59c6a6b4f20823ea3"
        },
        "date": 1764765648915,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 12.802365636363637,
            "range": "15.490057669827847",
            "unit": "ms",
            "extra": "median: 9.33ms"
          },
          {
            "name": "Normalize R AST",
            "value": 14.228470727272727,
            "range": "18.728453335950892",
            "unit": "ms",
            "extra": "median: 9.19ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 56.4452555,
            "range": "108.06651275707125",
            "unit": "ms",
            "extra": "median: 31.07ms"
          },
          {
            "name": "Total per-file",
            "value": 497.755534,
            "range": "1259.2264488006165",
            "unit": "ms",
            "extra": "median: 125.44ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.597318863636364,
            "range": "19.604759240180485",
            "unit": "ms",
            "extra": "median: 3.45ms"
          },
          {
            "name": "Static slicing",
            "value": 0.4425792138918379,
            "range": "0.45922022000848195",
            "unit": "ms",
            "extra": "median: 0.10ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.242225288635582,
            "range": "0.1733508663167471",
            "unit": "ms",
            "extra": "median: 0.11ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.69703848690514,
            "range": "0.60144139913191",
            "unit": "ms",
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
            "value": 0.7801660063880064,
            "unit": "#",
            "extra": "std: 0.1261285782699485"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7575735855163274,
            "unit": "#",
            "extra": "std: 0.12942676908005035"
          },
          {
            "name": "memory (df-graph)",
            "value": 117.68869850852273,
            "range": "301.0391208122946",
            "unit": "KiB",
            "extra": "median: 34.18"
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
          "id": "f1a2885127c7e8c67841600f34c677aa8096fe53",
          "message": "[release:patch] 2.7.2 News File Support, files Query, Better Doc Context, Mermaid for NAST and CFG (npm retry)",
          "timestamp": "2025-12-17T13:44:16+01:00",
          "tree_id": "16694244a284b080a16f01a6a8761fa969522a4c",
          "url": "https://github.com/flowr-analysis/flowr/commit/f1a2885127c7e8c67841600f34c677aa8096fe53"
        },
        "date": 1765976490871,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 13.255244772727274,
            "range": "17.135298391911128",
            "unit": "ms",
            "extra": "median: 9.45ms"
          },
          {
            "name": "Normalize R AST",
            "value": 14.454532545454544,
            "range": "18.36685092690339",
            "unit": "ms",
            "extra": "median: 11.07ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 59.11674118181818,
            "range": "116.24766139783513",
            "unit": "ms",
            "extra": "median: 31.87ms"
          },
          {
            "name": "Total per-file",
            "value": 516.1474766363636,
            "range": "1307.6919124784338",
            "unit": "ms",
            "extra": "median: 129.59ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.266484954545454,
            "range": "17.856530119118272",
            "unit": "ms",
            "extra": "median: 3.54ms"
          },
          {
            "name": "Static slicing",
            "value": 0.4631105600489594,
            "range": "0.49450369253394166",
            "unit": "ms",
            "extra": "median: 0.15ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.25606902019446665,
            "range": "0.18141934698988837",
            "unit": "ms",
            "extra": "median: 0.13ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.7323158747709118,
            "range": "0.6402432700301774",
            "unit": "ms",
            "extra": "median: 0.37ms"
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
            "value": 0.7801660063880064,
            "unit": "#",
            "extra": "std: 0.1261285782699485"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7575735855163274,
            "unit": "#",
            "extra": "std: 0.12942676908005035"
          },
          {
            "name": "memory (df-graph)",
            "value": 117.68869850852273,
            "range": "301.0391208122946",
            "unit": "KiB",
            "extra": "median: 34.18"
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
          "id": "ff8c08742ca6fe6451fb028f50ae9dd1392fad72",
          "message": "[release:patch] 2.7.3 Namespace-File Support",
          "timestamp": "2025-12-21T15:57:35+01:00",
          "tree_id": "4abef89472b7472e816c077d5f72f1c3dd021515",
          "url": "https://github.com/flowr-analysis/flowr/commit/ff8c08742ca6fe6451fb028f50ae9dd1392fad72"
        },
        "date": 1766330106061,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 13.354791272727274,
            "range": "15.997709723707834",
            "unit": "ms",
            "extra": "median: 9.45ms"
          },
          {
            "name": "Normalize R AST",
            "value": 14.83101681818182,
            "range": "20.317959183619937",
            "unit": "ms",
            "extra": "median: 11.03ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 60.345417227272726,
            "range": "120.29377367453436",
            "unit": "ms",
            "extra": "median: 32.25ms"
          },
          {
            "name": "Total per-file",
            "value": 509.94633813636364,
            "range": "1286.8769212607838",
            "unit": "ms",
            "extra": "median: 128.95ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.382887318181819,
            "range": "18.69841331407349",
            "unit": "ms",
            "extra": "median: 3.59ms"
          },
          {
            "name": "Static slicing",
            "value": 0.4487542105732083,
            "range": "0.48075445003276124",
            "unit": "ms",
            "extra": "median: 0.11ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2482979224146286,
            "range": "0.18554454276854732",
            "unit": "ms",
            "extra": "median: 0.12ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.7088486452506914,
            "range": "0.6287385716403582",
            "unit": "ms",
            "extra": "median: 0.37ms"
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
            "value": 0.7801660063880064,
            "unit": "#",
            "extra": "std: 0.1261285782699485"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7575735855163274,
            "unit": "#",
            "extra": "std: 0.12942676908005035"
          },
          {
            "name": "memory (df-graph)",
            "value": 117.68869850852273,
            "range": "301.0391208122946",
            "unit": "KiB",
            "extra": "median: 34.18"
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
          "id": "e338b738f2c8f76da1a90c6e4b02164e30450199",
          "message": "[release:patch] 2.7.4 Performance Improvements",
          "timestamp": "2025-12-22T10:07:40+01:00",
          "tree_id": "c5ff185085d80ab908e0526defa30393a6be2ee4",
          "url": "https://github.com/flowr-analysis/flowr/commit/e338b738f2c8f76da1a90c6e4b02164e30450199"
        },
        "date": 1766395520242,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 13.140795090909092,
            "range": "15.232248793836126",
            "unit": "ms",
            "extra": "median: 9.62ms"
          },
          {
            "name": "Normalize R AST",
            "value": 15.378516818181819,
            "range": "20.357854085761883",
            "unit": "ms",
            "extra": "median: 11.07ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 49.78081927272727,
            "range": "91.29388426506557",
            "unit": "ms",
            "extra": "median: 23.08ms"
          },
          {
            "name": "Total per-file",
            "value": 502.02807818181816,
            "range": "1265.9973101889912",
            "unit": "ms",
            "extra": "median: 126.43ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.304300363636363,
            "range": "17.704352792223837",
            "unit": "ms",
            "extra": "median: 3.25ms"
          },
          {
            "name": "Static slicing",
            "value": 0.45576468021728134,
            "range": "0.49602057716009734",
            "unit": "ms",
            "extra": "median: 0.15ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.24953185425403696,
            "range": "0.18780264804547503",
            "unit": "ms",
            "extra": "median: 0.12ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.7176321442019715,
            "range": "0.643849087045429",
            "unit": "ms",
            "extra": "median: 0.37ms"
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
            "value": 0.7801660063880064,
            "unit": "#",
            "extra": "std: 0.1261285782699485"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7575735855163274,
            "unit": "#",
            "extra": "std: 0.12942676908005035"
          },
          {
            "name": "memory (df-graph)",
            "value": 117.68869850852273,
            "range": "301.0391208122946",
            "unit": "KiB",
            "extra": "median: 34.18"
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
          "id": "1b0bbae3b9d6d61e621d74be103c71f48660c933",
          "message": "[release:patch] 2.7.5 License and Author parsing, Ascii-DFGs, Minor Fixes and Features",
          "timestamp": "2025-12-23T19:09:30+01:00",
          "tree_id": "0e9bd987fb90d53191551e769d642100ee546ec4",
          "url": "https://github.com/flowr-analysis/flowr/commit/1b0bbae3b9d6d61e621d74be103c71f48660c933"
        },
        "date": 1766514427842,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 12.896040409090908,
            "range": "15.698721233173206",
            "unit": "ms",
            "extra": "median: 9.28ms"
          },
          {
            "name": "Normalize R AST",
            "value": 14.075193227272727,
            "range": "17.753802039287134",
            "unit": "ms",
            "extra": "median: 11.00ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 47.20526681818182,
            "range": "90.6652459112244",
            "unit": "ms",
            "extra": "median: 23.27ms"
          },
          {
            "name": "Total per-file",
            "value": 489.75931436363635,
            "range": "1254.7812514045668",
            "unit": "ms",
            "extra": "median: 116.70ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.653481409090908,
            "range": "18.58370945502937",
            "unit": "ms",
            "extra": "median: 3.55ms"
          },
          {
            "name": "Static slicing",
            "value": 0.4565968672349354,
            "range": "0.4910388208064423",
            "unit": "ms",
            "extra": "median: 0.12ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2517610753863859,
            "range": "0.20508950148180968",
            "unit": "ms",
            "extra": "median: 0.12ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.7203767742028279,
            "range": "0.6439472322096771",
            "unit": "ms",
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
            "value": 0.7801660063880064,
            "unit": "#",
            "extra": "std: 0.1261285782699485"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7575735855163274,
            "unit": "#",
            "extra": "std: 0.12942676908005035"
          },
          {
            "name": "memory (df-graph)",
            "value": 117.68869850852273,
            "range": "301.0391208122946",
            "unit": "KiB",
            "extra": "median: 34.18"
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
          "id": "b1b4f9a90cc5e46cb6ea372e475e39eb142ed762",
          "message": "[release:patch] 2.7.6 Custom License Parsing",
          "timestamp": "2025-12-23T23:16:16+01:00",
          "tree_id": "4b6d032ed0ceb950ac5f6c4c4caf4a036d5602bd",
          "url": "https://github.com/flowr-analysis/flowr/commit/b1b4f9a90cc5e46cb6ea372e475e39eb142ed762"
        },
        "date": 1766529234838,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 13.073263454545454,
            "range": "15.057440057446446",
            "unit": "ms",
            "extra": "median: 9.63ms"
          },
          {
            "name": "Normalize R AST",
            "value": 15.930812045454545,
            "range": "21.589155277691024",
            "unit": "ms",
            "extra": "median: 11.19ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 51.22668604545455,
            "range": "92.32052715621639",
            "unit": "ms",
            "extra": "median: 30.31ms"
          },
          {
            "name": "Total per-file",
            "value": 480.0108673181818,
            "range": "1202.066946953243",
            "unit": "ms",
            "extra": "median: 128.97ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.438093863636363,
            "range": "18.07472592915546",
            "unit": "ms",
            "extra": "median: 3.08ms"
          },
          {
            "name": "Static slicing",
            "value": 0.47905600284224714,
            "range": "0.5185286498016303",
            "unit": "ms",
            "extra": "median: 0.16ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2526538555366208,
            "range": "0.19542010788974976",
            "unit": "ms",
            "extra": "median: 0.13ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.7461349165526512,
            "range": "0.6816202752259121",
            "unit": "ms",
            "extra": "median: 0.37ms"
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
            "value": 0.7801660063880064,
            "unit": "#",
            "extra": "std: 0.1261285782699485"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7575735855163274,
            "unit": "#",
            "extra": "std: 0.12942676908005035"
          },
          {
            "name": "memory (df-graph)",
            "value": 117.68869850852273,
            "range": "301.0391208122946",
            "unit": "KiB",
            "extra": "median: 34.18"
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
          "id": "e31adf1f97c0d6086d52d8e0b2839eefeb8eca5c",
          "message": "[release:minor] 2.8.0 Call-Graphs, Roxygen 2 Support, Many Plugins, Registrations, Exceptions and Hooks",
          "timestamp": "2026-01-03T22:59:25+01:00",
          "tree_id": "352f59ea06cc313f58abb4295c602797c49f107a",
          "url": "https://github.com/flowr-analysis/flowr/commit/e31adf1f97c0d6086d52d8e0b2839eefeb8eca5c"
        },
        "date": 1767478625675,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 13.439155409090908,
            "range": "15.303803957116026",
            "unit": "ms",
            "extra": "median: 9.90ms"
          },
          {
            "name": "Normalize R AST",
            "value": 14.648671318181819,
            "range": "18.378058622787794",
            "unit": "ms",
            "extra": "median: 10.94ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 50.19302127272727,
            "range": "93.53083148674217",
            "unit": "ms",
            "extra": "median: 25.66ms"
          },
          {
            "name": "Total per-file",
            "value": 487.03599436363635,
            "range": "1225.6737825809585",
            "unit": "ms",
            "extra": "median: 128.54ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 8.427771363636364,
            "range": "17.736330445534122",
            "unit": "ms",
            "extra": "median: 3.19ms"
          },
          {
            "name": "Static slicing",
            "value": 0.48740651740792884,
            "range": "0.5234742512478386",
            "unit": "ms",
            "extra": "median: 0.18ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.25563530042372673,
            "range": "0.20158090613531818",
            "unit": "ms",
            "extra": "median: 0.14ms"
          },
          {
            "name": "Total per-slice",
            "value": 0.7558127959646196,
            "range": "0.688794243688602",
            "unit": "ms",
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
            "value": 0.7801660063880064,
            "unit": "#",
            "extra": "std: 0.1261285782699485"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.7575735855163274,
            "unit": "#",
            "extra": "std: 0.12942676908005035"
          },
          {
            "name": "memory (df-graph)",
            "value": 119.32293146306819,
            "range": "305.20520739372563",
            "unit": "KiB",
            "extra": "median: 34.18"
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
        "date": 1740298495420,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 18.74393864,
            "unit": "ms",
            "range": 11.417408650879585,
            "extra": "median: 13.24ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.714566859999998,
            "unit": "ms",
            "range": 10.734126819988226,
            "extra": "median: 16.20ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 80.65341228,
            "unit": "ms",
            "range": 71.45041162383933,
            "extra": "median: 39.97ms"
          },
          {
            "name": "Total per-file",
            "value": 7276.911772560001,
            "unit": "ms",
            "range": 29262.758487609546,
            "extra": "median: 765.86ms"
          },
          {
            "name": "Static slicing",
            "value": 14.905927425005043,
            "unit": "ms",
            "range": 44.265914964120256,
            "extra": "median: 2.20ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.27289540064860957,
            "unit": "ms",
            "range": 0.16260416786228823,
            "extra": "median: 0.18ms"
          },
          {
            "name": "Total per-slice",
            "value": 15.186714240696148,
            "unit": "ms",
            "range": 44.304650760486425,
            "extra": "median: 2.47ms"
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
            "value": 0.8787770417341478,
            "unit": "#",
            "extra": "std: 0.09642856707464109"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8214981144601251,
            "unit": "#",
            "extra": "std: 0.1368510718635072"
          },
          {
            "name": "memory (df-graph)",
            "value": 97.488125,
            "unit": "KiB",
            "range": 110.48765823699225,
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
          "id": "ae435ebae9cf85e90cdfc73b0e1923e585d59414",
          "message": "[release:patch] 2.2.11 Better Compression, Project Query, Improved Location-Map",
          "timestamp": "2025-03-02T20:17:12+01:00",
          "tree_id": "10d49938f6bed0e336aba3a4b25d6abb70dae7f3",
          "url": "https://github.com/flowr-analysis/flowr/commit/ae435ebae9cf85e90cdfc73b0e1923e585d59414"
        },
        "date": 1740944092008,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 18.99564224,
            "unit": "ms",
            "range": 11.608821958243965,
            "extra": "median: 13.34ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.834844620000002,
            "unit": "ms",
            "range": 11.0649971981108,
            "extra": "median: 15.71ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 79.0204387,
            "unit": "ms",
            "range": 73.54774777513738,
            "extra": "median: 38.63ms"
          },
          {
            "name": "Total per-file",
            "value": 1835.99005976,
            "unit": "ms",
            "range": 3231.4678328170976,
            "extra": "median: 275.28ms"
          },
          {
            "name": "Static slicing",
            "value": 3.641557220634099,
            "unit": "ms",
            "range": 8.57328565983241,
            "extra": "median: 0.70ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.26306724961593203,
            "unit": "ms",
            "range": 0.15675439380002698,
            "extra": "median: 0.19ms"
          },
          {
            "name": "Total per-slice",
            "value": 3.9124450422206145,
            "unit": "ms",
            "range": 8.608095401514522,
            "extra": "median: 0.88ms"
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
            "value": 0.869768672712898,
            "unit": "#",
            "extra": "std: 0.10094392775606512"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8090122381586085,
            "unit": "#",
            "extra": "std: 0.14322107433145334"
          },
          {
            "name": "memory (df-graph)",
            "value": 97.1784375,
            "unit": "KiB",
            "range": 110.28424848122069,
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
          "id": "48e25a3515e92280375989939735f34489b17def",
          "message": "[release:patch] 2.2.12 Vector Support, Improved Graphic Support, Eval of Strings",
          "timestamp": "2025-03-17T09:01:02+01:00",
          "tree_id": "1fa464ef6978b578ec9bf2c48d5bf00b0a526d68",
          "url": "https://github.com/flowr-analysis/flowr/commit/48e25a3515e92280375989939735f34489b17def"
        },
        "date": 1742199192567,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 18.82184624,
            "unit": "ms",
            "range": 11.103809702693194,
            "extra": "median: 13.13ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.982671019999998,
            "unit": "ms",
            "range": 10.175825940710405,
            "extra": "median: 17.75ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 86.02847314,
            "unit": "ms",
            "range": 82.2866858583495,
            "extra": "median: 45.20ms"
          },
          {
            "name": "Total per-file",
            "value": 1654.60278988,
            "unit": "ms",
            "range": 2866.9847327205853,
            "extra": "median: 290.58ms"
          },
          {
            "name": "Static slicing",
            "value": 3.369632378267749,
            "unit": "ms",
            "range": 8.353787060220494,
            "extra": "median: 0.66ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2566961773481538,
            "unit": "ms",
            "range": 0.15525290084112112,
            "extra": "median: 0.15ms"
          },
          {
            "name": "Total per-slice",
            "value": 3.633922976357732,
            "unit": "ms",
            "range": 8.38645908556462,
            "extra": "median: 0.89ms"
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
            "value": 0.8790860274014363,
            "unit": "#",
            "extra": "std: 0.1054354305140141"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8252338763540544,
            "unit": "#",
            "extra": "std: 0.15045732475979823"
          },
          {
            "name": "memory (df-graph)",
            "value": 97.0636328125,
            "unit": "KiB",
            "range": 110.17738499343824,
            "extra": "median: 48.65"
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
          "id": "c9e254b4461384546c402bde212d87b1fc5eb6f2",
          "message": "[release:patch] 2.2.13 Control-Flow Graph, R Graphics, and Better Aliasing",
          "timestamp": "2025-05-27T12:38:34+02:00",
          "tree_id": "cbce8203f5fb142ee31cb5baf2de68be545e2acf",
          "url": "https://github.com/flowr-analysis/flowr/commit/c9e254b4461384546c402bde212d87b1fc5eb6f2"
        },
        "date": 1748343296414,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 18.97497398,
            "unit": "ms",
            "range": 11.376628361561936,
            "extra": "median: 13.63ms"
          },
          {
            "name": "Normalize R AST",
            "value": 21.42724136,
            "unit": "ms",
            "range": 12.43475196007928,
            "extra": "median: 16.00ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 99.09424484,
            "unit": "ms",
            "range": 93.92149968675031,
            "extra": "median: 55.27ms"
          },
          {
            "name": "Total per-file",
            "value": 1998.2495608800002,
            "unit": "ms",
            "range": 3571.7228823593446,
            "extra": "median: 318.34ms"
          },
          {
            "name": "Static slicing",
            "value": 4.440540741475017,
            "unit": "ms",
            "range": 13.630599599326159,
            "extra": "median: 0.71ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.300880041889449,
            "unit": "ms",
            "range": 0.17792367018157956,
            "extra": "median: 0.17ms"
          },
          {
            "name": "Total per-slice",
            "value": 4.7498451095592324,
            "unit": "ms",
            "range": 13.672912765823739,
            "extra": "median: 0.94ms"
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
            "value": 0.8770437928533015,
            "unit": "#",
            "extra": "std: 0.1071751829080257"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8223103785493011,
            "unit": "#",
            "extra": "std: 0.15302917990919654"
          },
          {
            "name": "memory (df-graph)",
            "value": 107.63185546875,
            "unit": "KiB",
            "range": 118.35156639014849,
            "extra": "median: 53.09"
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
          "id": "0a000cc15c89ace7254d47c380227e261d1cfb18",
          "message": "[release:patch] 2.2.14 Basic Linting Setup",
          "timestamp": "2025-05-31T20:20:31+02:00",
          "tree_id": "3de3eb59c995a0a1e70d82b9564310f8bdf8aace",
          "url": "https://github.com/flowr-analysis/flowr/commit/0a000cc15c89ace7254d47c380227e261d1cfb18"
        },
        "date": 1748716595457,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 18.55119606,
            "unit": "ms",
            "range": 11.437058407348843,
            "extra": "median: 13.34ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.929840300000002,
            "unit": "ms",
            "range": 9.90640619078465,
            "extra": "median: 17.06ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 95.34348058,
            "unit": "ms",
            "range": 89.150476755402,
            "extra": "median: 49.99ms"
          },
          {
            "name": "Total per-file",
            "value": 1920.08226232,
            "unit": "ms",
            "range": 3442.0340388551726,
            "extra": "median: 307.84ms"
          },
          {
            "name": "Static slicing",
            "value": 4.321574115820818,
            "unit": "ms",
            "range": 13.244672040190476,
            "extra": "median: 0.72ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2625565249577722,
            "unit": "ms",
            "range": 0.15368719162668257,
            "extra": "median: 0.15ms"
          },
          {
            "name": "Total per-slice",
            "value": 4.591738590409738,
            "unit": "ms",
            "range": 13.276242647316208,
            "extra": "median: 0.91ms"
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
            "value": 0.8770437928533015,
            "unit": "#",
            "extra": "std: 0.1071751829080257"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8223103785493011,
            "unit": "#",
            "extra": "std: 0.15302917990919654"
          },
          {
            "name": "memory (df-graph)",
            "value": 107.63185546875,
            "unit": "KiB",
            "range": 118.35156639014849,
            "extra": "median: 53.09"
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
          "id": "117391bed2bf109635c058150d3cc1d95b01c4ac",
          "message": "[release:patch] 2.2.15 Value-Vector-Support, Linter Fixes",
          "timestamp": "2025-06-02T22:56:01+02:00",
          "tree_id": "7663c39bcbd8e0b030361e514aedb79192d69297",
          "url": "https://github.com/flowr-analysis/flowr/commit/117391bed2bf109635c058150d3cc1d95b01c4ac"
        },
        "date": 1748898948087,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 18.560954579999997,
            "unit": "ms",
            "range": 11.562496143706568,
            "extra": "median: 13.27ms"
          },
          {
            "name": "Normalize R AST",
            "value": 21.10989758,
            "unit": "ms",
            "range": 11.946423759146954,
            "extra": "median: 18.50ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 96.57180984,
            "unit": "ms",
            "range": 92.31214860333043,
            "extra": "median: 49.80ms"
          },
          {
            "name": "Total per-file",
            "value": 1946.78674232,
            "unit": "ms",
            "range": 3512.2437177568463,
            "extra": "median: 314.31ms"
          },
          {
            "name": "Static slicing",
            "value": 4.3622221375992005,
            "unit": "ms",
            "range": 13.440465945870919,
            "extra": "median: 0.69ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.26626255975165236,
            "unit": "ms",
            "range": 0.1568131524506279,
            "extra": "median: 0.17ms"
          },
          {
            "name": "Total per-slice",
            "value": 4.636016974171246,
            "unit": "ms",
            "range": 13.471477349422017,
            "extra": "median: 0.91ms"
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
            "value": 0.8770367299848165,
            "unit": "#",
            "extra": "std: 0.1071920251540405"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8225896069023335,
            "unit": "#",
            "extra": "std: 0.15284006996295604"
          },
          {
            "name": "memory (df-graph)",
            "value": 107.68138671875,
            "unit": "KiB",
            "range": 118.33262965902532,
            "extra": "median: 53.09"
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
          "id": "c83d61b417de41d625ff1eaa6bafeec1c9515d3c",
          "message": "[release:patch] 2.2.16 Local Config, Fixes, New Linter Rules",
          "timestamp": "2025-07-12T17:46:19+02:00",
          "tree_id": "32dc33bb5e67b5d31cf964b0d0e8bfb2ab587658",
          "url": "https://github.com/flowr-analysis/flowr/commit/c83d61b417de41d625ff1eaa6bafeec1c9515d3c"
        },
        "date": 1752336344733,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 18.562271199999998,
            "unit": "ms",
            "range": 11.185474994484302,
            "extra": "median: 13.47ms"
          },
          {
            "name": "Normalize R AST",
            "value": 19.928955780000003,
            "unit": "ms",
            "range": 11.288829530660339,
            "extra": "median: 15.98ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 97.58279606,
            "unit": "ms",
            "range": 94.45543938781768,
            "extra": "median: 49.02ms"
          },
          {
            "name": "Total per-file",
            "value": 1956.9815536600001,
            "unit": "ms",
            "range": 3544.5211422047273,
            "extra": "median: 312.46ms"
          },
          {
            "name": "Static slicing",
            "value": 4.4238450935786595,
            "unit": "ms",
            "range": 13.670796255665046,
            "extra": "median: 0.65ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.25723614828801183,
            "unit": "ms",
            "range": 0.1519503198881044,
            "extra": "median: 0.17ms"
          },
          {
            "name": "Total per-slice",
            "value": 4.6885649376729805,
            "unit": "ms",
            "range": 13.701057002631972,
            "extra": "median: 0.92ms"
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
            "value": 0.8770367299848165,
            "unit": "#",
            "extra": "std: 0.1071920251540405"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8225896069023335,
            "unit": "#",
            "extra": "std: 0.15284006996295604"
          },
          {
            "name": "memory (df-graph)",
            "value": 107.6773046875,
            "unit": "KiB",
            "range": 118.33178343796521,
            "extra": "median: 53.09"
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
          "id": "9813198d1b677669d51a188fda97ca97d759d4ed",
          "message": "[release:minor] 2.3.0 Data Frame Shape Inference",
          "timestamp": "2025-07-21T13:30:08+02:00",
          "tree_id": "8f32ebb30ba791261c8ed267b51f312f8f457b87",
          "url": "https://github.com/flowr-analysis/flowr/commit/9813198d1b677669d51a188fda97ca97d759d4ed"
        },
        "date": 1753099077630,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 18.88240494,
            "unit": "ms",
            "range": 11.417685791710428,
            "extra": "median: 13.07ms"
          },
          {
            "name": "Normalize R AST",
            "value": 20.82124252,
            "unit": "ms",
            "range": 11.74880609062808,
            "extra": "median: 15.76ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 97.13760414000001,
            "unit": "ms",
            "range": 93.33073401479706,
            "extra": "median: 49.46ms"
          },
          {
            "name": "Total per-file",
            "value": 1967.37430806,
            "unit": "ms",
            "range": 3557.7169623118025,
            "extra": "median: 301.98ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 0,
            "unit": "ms",
            "range": null,
            "extra": "median: NaNms"
          },
          {
            "name": "Infer data frame shapes",
            "value": 0,
            "unit": "ms",
            "range": null,
            "extra": "median: NaNms"
          },
          {
            "name": "Static slicing",
            "value": 4.429336550150057,
            "unit": "ms",
            "range": 13.665305420947655,
            "extra": "median: 0.70ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2572405208192651,
            "unit": "ms",
            "range": 0.14507093148304795,
            "extra": "median: 0.15ms"
          },
          {
            "name": "Total per-slice",
            "value": 4.694213274937786,
            "unit": "ms",
            "range": 13.697384252337072,
            "extra": "median: 0.92ms"
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
            "value": 0.8770367299848165,
            "unit": "#",
            "extra": "std: 0.1071920251540405"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8225896069023335,
            "unit": "#",
            "extra": "std: 0.15284006996295604"
          },
          {
            "name": "memory (df-graph)",
            "value": 107.6773046875,
            "unit": "KiB",
            "range": 118.33178343796521,
            "extra": "median: 53.09"
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
          "id": "da0972c3d22ad92c7e07921b4fb65926ed163a6f",
          "message": "[release:minor] 2.4.0 Forward-Slicing, Minor Fixes",
          "timestamp": "2025-08-06T22:30:00+02:00",
          "tree_id": "a05dcedfd31580a22beb3ebdde5f2fcbc9217c2d",
          "url": "https://github.com/flowr-analysis/flowr/commit/da0972c3d22ad92c7e07921b4fb65926ed163a6f"
        },
        "date": 1754513689220,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 19.290534100000002,
            "unit": "ms",
            "range": 11.622782740763972,
            "extra": "median: 13.73ms"
          },
          {
            "name": "Normalize R AST",
            "value": 20.984798379999997,
            "unit": "ms",
            "range": 11.572664660198189,
            "extra": "median: 16.31ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 98.87453076,
            "unit": "ms",
            "range": 93.14336075601078,
            "extra": "median: 49.02ms"
          },
          {
            "name": "Total per-file",
            "value": 2071.80939838,
            "unit": "ms",
            "range": 3724.121643382857,
            "extra": "median: 327.38ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 11.18679822,
            "unit": "ms",
            "range": 10.4111861791928,
            "extra": "median: 8.11ms"
          },
          {
            "name": "Static slicing",
            "value": 4.582542041790972,
            "unit": "ms",
            "range": 14.168627834426992,
            "extra": "median: 0.69ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.31425275440736977,
            "unit": "ms",
            "range": 0.18187356651742495,
            "extra": "median: 0.20ms"
          },
          {
            "name": "Total per-slice",
            "value": 4.90527949926303,
            "unit": "ms",
            "range": 14.205226229632292,
            "extra": "median: 1.02ms"
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
            "value": 0.8770367299848165,
            "unit": "#",
            "extra": "std: 0.1071920251540405"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8225896069023335,
            "unit": "#",
            "extra": "std: 0.15284006996295604"
          },
          {
            "name": "memory (df-graph)",
            "value": 107.6773046875,
            "unit": "KiB",
            "range": 118.33178343796521,
            "extra": "median: 53.09"
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
          "id": "6861d92ca7eed15ab47a237a9981ada168adf133",
          "message": "[release:patch] 2.4.1 Localized Config, Support for File Modes",
          "timestamp": "2025-08-18T13:40:09+02:00",
          "tree_id": "98a6643a733244c5396f5a3e2a505b2c540e6b26",
          "url": "https://github.com/flowr-analysis/flowr/commit/6861d92ca7eed15ab47a237a9981ada168adf133"
        },
        "date": 1755519426190,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 18.76570882,
            "unit": "ms",
            "range": 11.489642911231579,
            "extra": "median: 13.47ms"
          },
          {
            "name": "Normalize R AST",
            "value": 20.385926920000003,
            "unit": "ms",
            "range": 11.675097165330142,
            "extra": "median: 15.51ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 95.65914443999999,
            "unit": "ms",
            "range": 87.42844194690836,
            "extra": "median: 51.31ms"
          },
          {
            "name": "Total per-file",
            "value": 2046.23951642,
            "unit": "ms",
            "range": 3619.3017047563458,
            "extra": "median: 334.07ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.25265248,
            "unit": "ms",
            "range": 8.836380734015592,
            "extra": "median: 7.62ms"
          },
          {
            "name": "Static slicing",
            "value": 4.683546494145801,
            "unit": "ms",
            "range": 13.774518381865539,
            "extra": "median: 0.87ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2581684933219117,
            "unit": "ms",
            "range": 0.1556571709745288,
            "extra": "median: 0.14ms"
          },
          {
            "name": "Total per-slice",
            "value": 4.949348774529203,
            "unit": "ms",
            "range": 13.812498655851194,
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
            "value": 0.8760636188102862,
            "unit": "#",
            "extra": "std: 0.1071843874046504"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8218888563337355,
            "unit": "#",
            "extra": "std: 0.152841619600717"
          },
          {
            "name": "memory (df-graph)",
            "value": 108.782265625,
            "unit": "KiB",
            "range": 119.20992997206397,
            "extra": "median: 54.17"
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
          "id": "78d418ba611903be1dc7ca71a48dbc655265606b",
          "message": "[release:patch] 2.4.2 Backward Compatibility",
          "timestamp": "2025-08-19T22:09:34+02:00",
          "tree_id": "dc49d2cc29eef59f25a0b84c47ab18dbd6424fe1",
          "url": "https://github.com/flowr-analysis/flowr/commit/78d418ba611903be1dc7ca71a48dbc655265606b"
        },
        "date": 1755635629938,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 18.87205386,
            "unit": "ms",
            "range": 11.581854027985871,
            "extra": "median: 13.50ms"
          },
          {
            "name": "Normalize R AST",
            "value": 20.47603518,
            "unit": "ms",
            "range": 11.653849607974601,
            "extra": "median: 17.33ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 93.42642322,
            "unit": "ms",
            "range": 86.41767470706063,
            "extra": "median: 48.51ms"
          },
          {
            "name": "Total per-file",
            "value": 2021.54095356,
            "unit": "ms",
            "range": 3592.1334034012093,
            "extra": "median: 346.62ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.080163220000001,
            "unit": "ms",
            "range": 8.812972502827723,
            "extra": "median: 7.49ms"
          },
          {
            "name": "Static slicing",
            "value": 4.654700345746523,
            "unit": "ms",
            "range": 13.5614399589836,
            "extra": "median: 0.89ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.24906836896688875,
            "unit": "ms",
            "range": 0.14635063024821027,
            "extra": "median: 0.15ms"
          },
          {
            "name": "Total per-slice",
            "value": 4.911276458324224,
            "unit": "ms",
            "range": 13.592321792324645,
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
            "value": 0.8760636188102862,
            "unit": "#",
            "extra": "std: 0.1071843874046504"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8218888563337355,
            "unit": "#",
            "extra": "std: 0.152841619600717"
          },
          {
            "name": "memory (df-graph)",
            "value": 108.782265625,
            "unit": "KiB",
            "range": 119.20992997206397,
            "extra": "median: 54.17"
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
          "id": "242f9494a180fd2720caa0b621124fd62c198c3d",
          "message": "[release:patch] 2.4.3 Linting Rule: Useless Loop",
          "timestamp": "2025-08-20T10:35:54+02:00",
          "tree_id": "d338e8d592713002ea619a18cf40d4629d04c249",
          "url": "https://github.com/flowr-analysis/flowr/commit/242f9494a180fd2720caa0b621124fd62c198c3d"
        },
        "date": 1755680553659,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 19.025445140000002,
            "unit": "ms",
            "range": 11.566552138728191,
            "extra": "median: 13.46ms"
          },
          {
            "name": "Normalize R AST",
            "value": 21.15367678,
            "unit": "ms",
            "range": 11.55306346105326,
            "extra": "median: 16.09ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 95.95062562000001,
            "unit": "ms",
            "range": 89.5283069060157,
            "extra": "median: 51.54ms"
          },
          {
            "name": "Total per-file",
            "value": 2076.27326248,
            "unit": "ms",
            "range": 3663.210929443124,
            "extra": "median: 342.26ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.400242039999998,
            "unit": "ms",
            "range": 9.438026847847253,
            "extra": "median: 6.86ms"
          },
          {
            "name": "Static slicing",
            "value": 4.746719854938332,
            "unit": "ms",
            "range": 13.875366145343785,
            "extra": "median: 0.94ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.27646422374087837,
            "unit": "ms",
            "range": 0.15767589634291684,
            "extra": "median: 0.18ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.031148022374136,
            "unit": "ms",
            "range": 13.91257484573667,
            "extra": "median: 1.15ms"
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
            "value": 0.8760636188102862,
            "unit": "#",
            "extra": "std: 0.1071843874046504"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8218888563337355,
            "unit": "#",
            "extra": "std: 0.152841619600717"
          },
          {
            "name": "memory (df-graph)",
            "value": 108.7821875,
            "unit": "KiB",
            "range": 119.20997798075639,
            "extra": "median: 54.17"
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
          "id": "5ec7debf603e07049f0f5f87c4ef68c2f6570419",
          "message": "[release:patch] 2.4.4 Stability Fixes",
          "timestamp": "2025-08-20T16:27:35+02:00",
          "tree_id": "9962abc2f65092057c0b79c2d53f9badd4eb9ea7",
          "url": "https://github.com/flowr-analysis/flowr/commit/5ec7debf603e07049f0f5f87c4ef68c2f6570419"
        },
        "date": 1755701579702,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 19.02720944,
            "unit": "ms",
            "range": 11.441336888491405,
            "extra": "median: 13.78ms"
          },
          {
            "name": "Normalize R AST",
            "value": 21.10970686,
            "unit": "ms",
            "range": 11.917376094021982,
            "extra": "median: 16.21ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 96.15091324,
            "unit": "ms",
            "range": 87.76010953318418,
            "extra": "median: 54.99ms"
          },
          {
            "name": "Total per-file",
            "value": 2097.12943448,
            "unit": "ms",
            "range": 3683.9363250548477,
            "extra": "median: 404.96ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.481505859999999,
            "unit": "ms",
            "range": 9.432790487179954,
            "extra": "median: 7.66ms"
          },
          {
            "name": "Static slicing",
            "value": 4.798158037419707,
            "unit": "ms",
            "range": 14.066781126092756,
            "extra": "median: 0.93ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2897521658743107,
            "unit": "ms",
            "range": 0.17627780624861522,
            "extra": "median: 0.20ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.096307300575045,
            "unit": "ms",
            "range": 14.107369828181367,
            "extra": "median: 1.26ms"
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
            "value": 0.8760636188102862,
            "unit": "#",
            "extra": "std: 0.1071843874046504"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8218888563337355,
            "unit": "#",
            "extra": "std: 0.152841619600717"
          },
          {
            "name": "memory (df-graph)",
            "value": 108.7821875,
            "unit": "KiB",
            "range": 119.20997798075639,
            "extra": "median: 54.17"
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
          "id": "b259768e775981c7e1430a45046b79cada9a7f45",
          "message": "[release:patch] 2.4.5 Benchmark Patch",
          "timestamp": "2025-08-20T17:16:35+02:00",
          "tree_id": "b4a13338215ac4f19a08389629cbb94077a37916",
          "url": "https://github.com/flowr-analysis/flowr/commit/b259768e775981c7e1430a45046b79cada9a7f45"
        },
        "date": 1755705328672,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 18.9739689,
            "unit": "ms",
            "range": 11.426571850371298,
            "extra": "median: 13.31ms"
          },
          {
            "name": "Normalize R AST",
            "value": 21.14861306,
            "unit": "ms",
            "range": 11.702173973613382,
            "extra": "median: 16.85ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 95.48121384000001,
            "unit": "ms",
            "range": 88.45264364545329,
            "extra": "median: 48.46ms"
          },
          {
            "name": "Total per-file",
            "value": 2075.36335556,
            "unit": "ms",
            "range": 3674.443864009192,
            "extra": "median: 352.61ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.82723148,
            "unit": "ms",
            "range": 9.099921874682213,
            "extra": "median: 8.19ms"
          },
          {
            "name": "Static slicing",
            "value": 4.754736875440976,
            "unit": "ms",
            "range": 13.899477997288834,
            "extra": "median: 0.95ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.27758521302034966,
            "unit": "ms",
            "range": 0.16742538090352543,
            "extra": "median: 0.15ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.040247206906317,
            "unit": "ms",
            "range": 13.941054757592136,
            "extra": "median: 1.21ms"
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
            "value": 0.8760636188102862,
            "unit": "#",
            "extra": "std: 0.1071843874046504"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8218888563337355,
            "unit": "#",
            "extra": "std: 0.152841619600717"
          },
          {
            "name": "memory (df-graph)",
            "value": 108.7821875,
            "unit": "KiB",
            "range": 119.20997798075639,
            "extra": "median: 54.17"
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
          "id": "f76a9565b68adc516aab54ef1e0eaddc3dc40832",
          "message": "[release:patch] 2.4.6 Fix MapIterator in DFShape Linter",
          "timestamp": "2025-08-20T18:54:08+02:00",
          "tree_id": "f6fddd12c13459514380efe842dc91c81011c613",
          "url": "https://github.com/flowr-analysis/flowr/commit/f76a9565b68adc516aab54ef1e0eaddc3dc40832"
        },
        "date": 1755710671939,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 19.134115899999998,
            "unit": "ms",
            "range": 11.26377847677974,
            "extra": "median: 13.48ms"
          },
          {
            "name": "Normalize R AST",
            "value": 20.85031668,
            "unit": "ms",
            "range": 11.671570696492026,
            "extra": "median: 16.49ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 95.63041082,
            "unit": "ms",
            "range": 89.42462102659404,
            "extra": "median: 53.57ms"
          },
          {
            "name": "Total per-file",
            "value": 2078.10271722,
            "unit": "ms",
            "range": 3693.2299668735764,
            "extra": "median: 355.53ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.48790396,
            "unit": "ms",
            "range": 8.928975625655914,
            "extra": "median: 8.09ms"
          },
          {
            "name": "Static slicing",
            "value": 4.756176201254601,
            "unit": "ms",
            "range": 14.023426553465619,
            "extra": "median: 0.91ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2705395226209734,
            "unit": "ms",
            "range": 0.16433303678790828,
            "extra": "median: 0.15ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.034379914501014,
            "unit": "ms",
            "range": 14.059728135061208,
            "extra": "median: 1.23ms"
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
            "value": 0.8760636188102862,
            "unit": "#",
            "extra": "std: 0.1071843874046504"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8218888563337355,
            "unit": "#",
            "extra": "std: 0.152841619600717"
          },
          {
            "name": "memory (df-graph)",
            "value": 108.7821875,
            "unit": "KiB",
            "range": 119.20997798075639,
            "extra": "median: 54.17"
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
          "id": "87ffcf33ef1f98032391f4c01799ab07d82c3535",
          "message": "[release:patch] 2.4.7 AbsInt Framework",
          "timestamp": "2025-08-20T20:12:22+02:00",
          "tree_id": "f074bdf7c2c43e429a51399ee64b360768a5f11b",
          "url": "https://github.com/flowr-analysis/flowr/commit/87ffcf33ef1f98032391f4c01799ab07d82c3535"
        },
        "date": 1755715261608,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 18.88600648,
            "unit": "ms",
            "range": 11.495425301399225,
            "extra": "median: 13.38ms"
          },
          {
            "name": "Normalize R AST",
            "value": 21.19050726,
            "unit": "ms",
            "range": 11.86670643513547,
            "extra": "median: 16.84ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 95.05053766,
            "unit": "ms",
            "range": 88.35744205816549,
            "extra": "median: 50.37ms"
          },
          {
            "name": "Total per-file",
            "value": 2086.6945838,
            "unit": "ms",
            "range": 3708.0181343599197,
            "extra": "median: 345.93ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.53751938,
            "unit": "ms",
            "range": 9.181766885651285,
            "extra": "median: 7.80ms"
          },
          {
            "name": "Static slicing",
            "value": 4.772656640498091,
            "unit": "ms",
            "range": 14.027944793009004,
            "extra": "median: 0.94ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.27862067947738456,
            "unit": "ms",
            "range": 0.17085971687038037,
            "extra": "median: 0.15ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.059558712006704,
            "unit": "ms",
            "range": 14.067750655154057,
            "extra": "median: 1.20ms"
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
            "value": 0.8760636188102862,
            "unit": "#",
            "extra": "std: 0.1071843874046504"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8218888563337355,
            "unit": "#",
            "extra": "std: 0.152841619600717"
          },
          {
            "name": "memory (df-graph)",
            "value": 108.7821875,
            "unit": "KiB",
            "range": 119.20997798075639,
            "extra": "median: 54.17"
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
          "id": "5f6939cf39d36c0b7f37824c2f28dab4a6255f3f",
          "message": "[release:minor] 2.5.0 RMarkdown Adapter",
          "timestamp": "2025-09-23T23:23:41+02:00",
          "tree_id": "edb9befaf52c99b5fa3263805d737db4834fb2b8",
          "url": "https://github.com/flowr-analysis/flowr/commit/5f6939cf39d36c0b7f37824c2f28dab4a6255f3f"
        },
        "date": 1758664062063,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 19.09427378,
            "range": "11.32429084670836",
            "unit": "ms",
            "extra": "median: 13.30ms"
          },
          {
            "name": "Normalize R AST",
            "value": 20.006779039999998,
            "range": "10.681554169980409",
            "unit": "ms",
            "extra": "median: 16.34ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 97.84343473999999,
            "range": "92.26808022380044",
            "unit": "ms",
            "extra": "median: 50.38ms"
          },
          {
            "name": "Total per-file",
            "value": 2239.2492911599998,
            "range": "3985.41479584103",
            "unit": "ms",
            "extra": "median: 337.55ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.1508728,
            "range": "8.9299249581145",
            "unit": "ms",
            "extra": "median: 7.70ms"
          },
          {
            "name": "Static slicing",
            "value": 5.163455475548514,
            "range": "14.722996292948846",
            "unit": "ms",
            "extra": "median: 0.91ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2527167200116443,
            "range": "0.15834066022289994",
            "unit": "ms",
            "extra": "median: 0.14ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.423876258603248,
            "range": "14.757284016949017",
            "unit": "ms",
            "extra": "median: 1.17ms"
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
            "value": 0.8756158680153058,
            "unit": "#",
            "extra": "std: 0.10721898268233483"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8211374732182364,
            "unit": "#",
            "extra": "std: 0.15273706188196837"
          },
          {
            "name": "memory (df-graph)",
            "value": 111.78912109375,
            "range": "123.57176620731515",
            "unit": "KiB",
            "extra": "median: 54.67"
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
          "id": "682d74373c38c114c4e29134c2c3383f2981e025",
          "message": "[release:minor] 2.6.0 Project API",
          "timestamp": "2025-10-14T00:24:40+08:00",
          "tree_id": "47d8c3cb141b1fa6146da160ddbe8b6b0a6211e2",
          "url": "https://github.com/flowr-analysis/flowr/commit/682d74373c38c114c4e29134c2c3383f2981e025"
        },
        "date": 1760374356320,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 19.106057800000002,
            "range": "11.222298935824503",
            "unit": "ms",
            "extra": "median: 14.49ms"
          },
          {
            "name": "Normalize R AST",
            "value": 20.68246042,
            "range": "11.37614853452561",
            "unit": "ms",
            "extra": "median: 16.63ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 97.10424186,
            "range": "91.56296018031107",
            "unit": "ms",
            "extra": "median: 54.96ms"
          },
          {
            "name": "Total per-file",
            "value": 2243.08818064,
            "range": "3966.355154326775",
            "unit": "ms",
            "extra": "median: 337.48ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 9.9236551,
            "range": "8.89996895152819",
            "unit": "ms",
            "extra": "median: 7.10ms"
          },
          {
            "name": "Static slicing",
            "value": 5.182230486095012,
            "range": "14.566798249316678",
            "unit": "ms",
            "extra": "median: 0.93ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2559666143437169,
            "range": "0.16902466261833612",
            "unit": "ms",
            "extra": "median: 0.16ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.4458558663995325,
            "range": "14.599457400284564",
            "unit": "ms",
            "extra": "median: 1.22ms"
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
            "value": 0.8756158680153058,
            "unit": "#",
            "extra": "std: 0.10721898268233483"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8211374732182364,
            "unit": "#",
            "extra": "std: 0.15273706188196837"
          },
          {
            "name": "memory (df-graph)",
            "value": 111.78912109375,
            "range": "123.57176620731515",
            "unit": "KiB",
            "extra": "median: 54.67"
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
          "id": "9b5e57d9348c4f48dbe7f3176e759a70611069e7",
          "message": "[release:patch] 2.6.1 Fixes, Higher-Order-Fn Query",
          "timestamp": "2025-10-21T08:08:34+02:00",
          "tree_id": "2f91cf50597d2820d504537ae42bb4f6cbfd3d39",
          "url": "https://github.com/flowr-analysis/flowr/commit/9b5e57d9348c4f48dbe7f3176e759a70611069e7"
        },
        "date": 1761028232519,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 19.0833903,
            "range": "11.581445091702275",
            "unit": "ms",
            "extra": "median: 13.40ms"
          },
          {
            "name": "Normalize R AST",
            "value": 20.696359899999997,
            "range": "11.729944300850565",
            "unit": "ms",
            "extra": "median: 16.69ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 97.84310116,
            "range": "93.58821455713483",
            "unit": "ms",
            "extra": "median: 53.38ms"
          },
          {
            "name": "Total per-file",
            "value": 2267.84490542,
            "range": "4026.861792481456",
            "unit": "ms",
            "extra": "median: 320.80ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.143896779999999,
            "range": "9.268433135301485",
            "unit": "ms",
            "extra": "median: 6.64ms"
          },
          {
            "name": "Static slicing",
            "value": 5.214299506026792,
            "range": "14.79517040606329",
            "unit": "ms",
            "extra": "median: 0.95ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2652533871322946,
            "range": "0.1715935214549508",
            "unit": "ms",
            "extra": "median: 0.15ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.487303907613115,
            "range": "14.833282607055555",
            "unit": "ms",
            "extra": "median: 1.25ms"
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
            "value": 0.8756158680153058,
            "unit": "#",
            "extra": "std: 0.10721898268233483"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8211374732182364,
            "unit": "#",
            "extra": "std: 0.15273706188196837"
          },
          {
            "name": "memory (df-graph)",
            "value": 111.78912109375,
            "range": "123.57176620731515",
            "unit": "KiB",
            "extra": "median: 54.67"
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
          "id": "d7fb0c432a4921d48b863349e6d706924073c485",
          "message": "[release:patch] 2.6.2 TS-Queries, new Domain Structure, more Reserved Words, removed Lineage Query",
          "timestamp": "2025-11-09T08:33:06+01:00",
          "tree_id": "306bc4d11ef1823fa36a831a11b0bb24f1a74438",
          "url": "https://github.com/flowr-analysis/flowr/commit/d7fb0c432a4921d48b863349e6d706924073c485"
        },
        "date": 1762674764213,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 19.19233196,
            "range": "11.361118178252617",
            "unit": "ms",
            "extra": "median: 13.77ms"
          },
          {
            "name": "Normalize R AST",
            "value": 20.372592760000003,
            "range": "11.593038770742869",
            "unit": "ms",
            "extra": "median: 15.86ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 99.15286621999999,
            "range": "95.67415029821713",
            "unit": "ms",
            "extra": "median: 49.22ms"
          },
          {
            "name": "Total per-file",
            "value": 2229.9406602,
            "range": "3948.5045867653553",
            "unit": "ms",
            "extra": "median: 339.50ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.32471554,
            "range": "9.360896177703415",
            "unit": "ms",
            "extra": "median: 7.35ms"
          },
          {
            "name": "Static slicing",
            "value": 5.15097648541195,
            "range": "14.572407125970924",
            "unit": "ms",
            "extra": "median: 0.94ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2600959749452102,
            "range": "0.16403791841464885",
            "unit": "ms",
            "extra": "median: 0.14ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.418813117256836,
            "range": "14.606727328169363",
            "unit": "ms",
            "extra": "median: 1.20ms"
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
            "value": 0.8756158680153058,
            "unit": "#",
            "extra": "std: 0.10721898268233483"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8211374732182364,
            "unit": "#",
            "extra": "std: 0.15273706188196837"
          },
          {
            "name": "memory (df-graph)",
            "value": 110.78205078125,
            "range": "123.18697480849939",
            "unit": "KiB",
            "extra": "median: 54.67"
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
          "id": "4d1661312b8aff8da696f936fe6bbb33476dfe97",
          "message": "[release:patch] 2.6.3 Doc, Refined Analyzer, Caching, and Perf",
          "timestamp": "2025-11-25T13:20:14+01:00",
          "tree_id": "9e6bba5056c3400d6afe642ee4ef68557ea0d94f",
          "url": "https://github.com/flowr-analysis/flowr/commit/4d1661312b8aff8da696f936fe6bbb33476dfe97"
        },
        "date": 1764074359436,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 19.3653501,
            "range": "11.54550118849532",
            "unit": "ms",
            "extra": "median: 13.93ms"
          },
          {
            "name": "Normalize R AST",
            "value": 21.19816214,
            "range": "11.52114547704086",
            "unit": "ms",
            "extra": "median: 17.40ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 84.4050977,
            "range": "70.12012087185798",
            "unit": "ms",
            "extra": "median: 52.42ms"
          },
          {
            "name": "Total per-file",
            "value": 2210.1558189,
            "range": "3893.3969016488795",
            "unit": "ms",
            "extra": "median: 346.55ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 9.97012256,
            "range": "8.698012219660678",
            "unit": "ms",
            "extra": "median: 7.04ms"
          },
          {
            "name": "Static slicing",
            "value": 5.06349541057891,
            "range": "14.810055740830439",
            "unit": "ms",
            "extra": "median: 0.93ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2829028396899066,
            "range": "0.17160586361654523",
            "unit": "ms",
            "extra": "median: 0.16ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.3546813470133765,
            "range": "14.85400393693213",
            "unit": "ms",
            "extra": "median: 1.19ms"
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
            "value": 0.8756158680153058,
            "unit": "#",
            "extra": "std: 0.10721898268233483"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8211374732182364,
            "unit": "#",
            "extra": "std: 0.15273706188196837"
          },
          {
            "name": "memory (df-graph)",
            "value": 110.78205078125,
            "range": "123.18697480849939",
            "unit": "KiB",
            "extra": "median: 54.67"
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
          "id": "6a75a4fb1580fb3d26de71d59c6a6b4f20823ea3",
          "message": "[release:minor] 2.7.0 Set-Range Domains, Environment Caches, and Mermaid Exclusions",
          "timestamp": "2025-12-03T13:21:40+01:00",
          "tree_id": "81d5be6eccf50444e4a8391a0ecec541d33d00df",
          "url": "https://github.com/flowr-analysis/flowr/commit/6a75a4fb1580fb3d26de71d59c6a6b4f20823ea3"
        },
        "date": 1764765650285,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 19.284452039999998,
            "range": "11.243069899654246",
            "unit": "ms",
            "extra": "median: 13.80ms"
          },
          {
            "name": "Normalize R AST",
            "value": 20.764798,
            "range": "11.311929426573409",
            "unit": "ms",
            "extra": "median: 16.73ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 79.59544764,
            "range": "65.27777313197369",
            "unit": "ms",
            "extra": "median: 50.72ms"
          },
          {
            "name": "Total per-file",
            "value": 2183.25336216,
            "range": "4033.3211588496565",
            "unit": "ms",
            "extra": "median: 368.14ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.2571344,
            "range": "8.564210101360734",
            "unit": "ms",
            "extra": "median: 7.46ms"
          },
          {
            "name": "Static slicing",
            "value": 5.064406176847604,
            "range": "15.47824414279004",
            "unit": "ms",
            "extra": "median: 0.72ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2726351524259434,
            "range": "0.16655848042505786",
            "unit": "ms",
            "extra": "median: 0.17ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.34455109239953,
            "range": "15.50373020176344",
            "unit": "ms",
            "extra": "median: 1.01ms"
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
            "value": 0.8760875201716902,
            "unit": "#",
            "extra": "std: 0.10724166547613748"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.822167260204735,
            "unit": "#",
            "extra": "std: 0.1527967200673481"
          },
          {
            "name": "memory (df-graph)",
            "value": 110.73416015625,
            "range": "123.2036565786505",
            "unit": "KiB",
            "extra": "median: 54.68"
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
          "id": "f1a2885127c7e8c67841600f34c677aa8096fe53",
          "message": "[release:patch] 2.7.2 News File Support, files Query, Better Doc Context, Mermaid for NAST and CFG (npm retry)",
          "timestamp": "2025-12-17T13:44:16+01:00",
          "tree_id": "16694244a284b080a16f01a6a8761fa969522a4c",
          "url": "https://github.com/flowr-analysis/flowr/commit/f1a2885127c7e8c67841600f34c677aa8096fe53"
        },
        "date": 1765976492352,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 19.48264942,
            "range": "11.675074554449862",
            "unit": "ms",
            "extra": "median: 14.22ms"
          },
          {
            "name": "Normalize R AST",
            "value": 21.8866065,
            "range": "12.401607866482617",
            "unit": "ms",
            "extra": "median: 18.36ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 82.0679256,
            "range": "68.54067349181992",
            "unit": "ms",
            "extra": "median: 50.86ms"
          },
          {
            "name": "Total per-file",
            "value": 2245.2375222399996,
            "range": "4149.277608942743",
            "unit": "ms",
            "extra": "median: 373.24ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.25151872,
            "range": "8.891866930818082",
            "unit": "ms",
            "extra": "median: 7.49ms"
          },
          {
            "name": "Static slicing",
            "value": 5.147142560623066,
            "range": "15.954927456548598",
            "unit": "ms",
            "extra": "median: 0.71ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.29177935688455175,
            "range": "0.16416528649918188",
            "unit": "ms",
            "extra": "median: 0.20ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.446715154619072,
            "range": "15.98931894787442",
            "unit": "ms",
            "extra": "median: 0.99ms"
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
            "value": 0.8760875201716902,
            "unit": "#",
            "extra": "std: 0.10724166547613748"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.822167260204735,
            "unit": "#",
            "extra": "std: 0.1527967200673481"
          },
          {
            "name": "memory (df-graph)",
            "value": 110.73416015625,
            "range": "123.2036565786505",
            "unit": "KiB",
            "extra": "median: 54.68"
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
          "id": "ff8c08742ca6fe6451fb028f50ae9dd1392fad72",
          "message": "[release:patch] 2.7.3 Namespace-File Support",
          "timestamp": "2025-12-21T15:57:35+01:00",
          "tree_id": "4abef89472b7472e816c077d5f72f1c3dd021515",
          "url": "https://github.com/flowr-analysis/flowr/commit/ff8c08742ca6fe6451fb028f50ae9dd1392fad72"
        },
        "date": 1766330107216,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 19.23728404,
            "range": "11.612781780525802",
            "unit": "ms",
            "extra": "median: 13.66ms"
          },
          {
            "name": "Normalize R AST",
            "value": 20.940054460000002,
            "range": "12.642630074630997",
            "unit": "ms",
            "extra": "median: 15.70ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 80.16275990000001,
            "range": "67.0984464955923",
            "unit": "ms",
            "extra": "median: 44.16ms"
          },
          {
            "name": "Total per-file",
            "value": 2186.77151086,
            "range": "4024.5216227934507",
            "unit": "ms",
            "extra": "median: 353.19ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.4677834,
            "range": "9.614571377328751",
            "unit": "ms",
            "extra": "median: 7.61ms"
          },
          {
            "name": "Static slicing",
            "value": 5.059218081188614,
            "range": "15.552709054723099",
            "unit": "ms",
            "extra": "median: 0.75ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2669884101983248,
            "range": "0.15873182202263675",
            "unit": "ms",
            "extra": "median: 0.15ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.333546836899963,
            "range": "15.581386709886996",
            "unit": "ms",
            "extra": "median: 1.01ms"
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
            "value": 0.8760875201716902,
            "unit": "#",
            "extra": "std: 0.10724166547613748"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.822167260204735,
            "unit": "#",
            "extra": "std: 0.1527967200673481"
          },
          {
            "name": "memory (df-graph)",
            "value": 110.73416015625,
            "range": "123.2036565786505",
            "unit": "KiB",
            "extra": "median: 54.68"
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
          "id": "e338b738f2c8f76da1a90c6e4b02164e30450199",
          "message": "[release:patch] 2.7.4 Performance Improvements",
          "timestamp": "2025-12-22T10:07:40+01:00",
          "tree_id": "c5ff185085d80ab908e0526defa30393a6be2ee4",
          "url": "https://github.com/flowr-analysis/flowr/commit/e338b738f2c8f76da1a90c6e4b02164e30450199"
        },
        "date": 1766395521901,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 19.25121154,
            "range": "11.543770070478248",
            "unit": "ms",
            "extra": "median: 13.58ms"
          },
          {
            "name": "Normalize R AST",
            "value": 21.11583274,
            "range": "11.975356652742287",
            "unit": "ms",
            "extra": "median: 15.65ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 77.25387932,
            "range": "60.48154086307185",
            "unit": "ms",
            "extra": "median: 52.99ms"
          },
          {
            "name": "Total per-file",
            "value": 2192.67929434,
            "range": "4035.4511545863074",
            "unit": "ms",
            "extra": "median: 375.02ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.19741704,
            "range": "8.948192220247087",
            "unit": "ms",
            "extra": "median: 7.91ms"
          },
          {
            "name": "Static slicing",
            "value": 5.103952610888899,
            "range": "15.623360405051816",
            "unit": "ms",
            "extra": "median: 0.76ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2680759876931476,
            "range": "0.15596073033619567",
            "unit": "ms",
            "extra": "median: 0.19ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.379504150225844,
            "range": "15.650042382510026",
            "unit": "ms",
            "extra": "median: 0.95ms"
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
            "value": 0.8760875201716902,
            "unit": "#",
            "extra": "std: 0.10724166547613748"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.822167260204735,
            "unit": "#",
            "extra": "std: 0.1527967200673481"
          },
          {
            "name": "memory (df-graph)",
            "value": 110.73416015625,
            "range": "123.2036565786505",
            "unit": "KiB",
            "extra": "median: 54.68"
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
          "id": "1b0bbae3b9d6d61e621d74be103c71f48660c933",
          "message": "[release:patch] 2.7.5 License and Author parsing, Ascii-DFGs, Minor Fixes and Features",
          "timestamp": "2025-12-23T19:09:30+01:00",
          "tree_id": "0e9bd987fb90d53191551e769d642100ee546ec4",
          "url": "https://github.com/flowr-analysis/flowr/commit/1b0bbae3b9d6d61e621d74be103c71f48660c933"
        },
        "date": 1766514430149,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 19.778612239999998,
            "range": "11.407110554808495",
            "unit": "ms",
            "extra": "median: 14.38ms"
          },
          {
            "name": "Normalize R AST",
            "value": 21.552062120000002,
            "range": "11.78573272833138",
            "unit": "ms",
            "extra": "median: 17.29ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 80.94378292,
            "range": "66.40351940207006",
            "unit": "ms",
            "extra": "median: 48.15ms"
          },
          {
            "name": "Total per-file",
            "value": 2298.6700764400002,
            "range": "4116.3586240169025",
            "unit": "ms",
            "extra": "median: 362.12ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.69248408,
            "range": "8.939529676129677",
            "unit": "ms",
            "extra": "median: 7.19ms"
          },
          {
            "name": "Static slicing",
            "value": 5.273890470051775,
            "range": "15.659720243926312",
            "unit": "ms",
            "extra": "median: 0.77ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.308990158208548,
            "range": "0.1868631302639921",
            "unit": "ms",
            "extra": "median: 0.20ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.59121249145432,
            "range": "15.692035969707554",
            "unit": "ms",
            "extra": "median: 1.01ms"
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
            "value": 0.8756158680153058,
            "unit": "#",
            "extra": "std: 0.10721898268233483"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8211374732182364,
            "unit": "#",
            "extra": "std: 0.15273706188196837"
          },
          {
            "name": "memory (df-graph)",
            "value": 110.79427734375,
            "range": "123.19620101208434",
            "unit": "KiB",
            "extra": "median: 54.68"
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
          "id": "b1b4f9a90cc5e46cb6ea372e475e39eb142ed762",
          "message": "[release:patch] 2.7.6 Custom License Parsing",
          "timestamp": "2025-12-23T23:16:16+01:00",
          "tree_id": "4b6d032ed0ceb950ac5f6c4c4caf4a036d5602bd",
          "url": "https://github.com/flowr-analysis/flowr/commit/b1b4f9a90cc5e46cb6ea372e475e39eb142ed762"
        },
        "date": 1766529237086,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 19.1525127,
            "range": "11.475936094808375",
            "unit": "ms",
            "extra": "median: 13.77ms"
          },
          {
            "name": "Normalize R AST",
            "value": 21.16513954,
            "range": "11.552002143619267",
            "unit": "ms",
            "extra": "median: 15.61ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 77.64342034,
            "range": "62.031382125667086",
            "unit": "ms",
            "extra": "median: 45.17ms"
          },
          {
            "name": "Total per-file",
            "value": 2239.43762984,
            "range": "4057.438547642184",
            "unit": "ms",
            "extra": "median: 370.00ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 11.20102366,
            "range": "9.622073834018876",
            "unit": "ms",
            "extra": "median: 8.51ms"
          },
          {
            "name": "Static slicing",
            "value": 5.179443843876537,
            "range": "15.65846104529104",
            "unit": "ms",
            "extra": "median: 0.77ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2705309534440335,
            "range": "0.16125204921131137",
            "unit": "ms",
            "extra": "median: 0.18ms"
          },
          {
            "name": "Total per-slice",
            "value": 5.457606364493527,
            "range": "15.685209752296277",
            "unit": "ms",
            "extra": "median: 0.98ms"
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
            "value": 0.8756158680153058,
            "unit": "#",
            "extra": "std: 0.10721898268233483"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8211374732182364,
            "unit": "#",
            "extra": "std: 0.15273706188196837"
          },
          {
            "name": "memory (df-graph)",
            "value": 110.79427734375,
            "range": "123.19620101208434",
            "unit": "KiB",
            "extra": "median: 54.68"
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
          "id": "e31adf1f97c0d6086d52d8e0b2839eefeb8eca5c",
          "message": "[release:minor] 2.8.0 Call-Graphs, Roxygen 2 Support, Many Plugins, Registrations, Exceptions and Hooks",
          "timestamp": "2026-01-03T22:59:25+01:00",
          "tree_id": "352f59ea06cc313f58abb4295c602797c49f107a",
          "url": "https://github.com/flowr-analysis/flowr/commit/e31adf1f97c0d6086d52d8e0b2839eefeb8eca5c"
        },
        "date": 1767478626898,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Retrieve AST from R code",
            "value": 19.39898762,
            "range": "11.393188519548046",
            "unit": "ms",
            "extra": "median: 13.94ms"
          },
          {
            "name": "Normalize R AST",
            "value": 21.32224184,
            "range": "11.439370980483412",
            "unit": "ms",
            "extra": "median: 17.67ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 75.97563686,
            "range": "59.78090573124176",
            "unit": "ms",
            "extra": "median: 52.79ms"
          },
          {
            "name": "Total per-file",
            "value": 2605.78157574,
            "range": "5488.786498350437",
            "unit": "ms",
            "extra": "median: 369.95ms"
          },
          {
            "name": "Extract control flow graph",
            "value": 10.64592952,
            "range": "9.327148394943718",
            "unit": "ms",
            "extra": "median: 6.98ms"
          },
          {
            "name": "Static slicing",
            "value": 6.320430246055102,
            "range": "34.648598462187955",
            "unit": "ms",
            "extra": "median: 0.75ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.2763168167203099,
            "range": "0.17381863573101372",
            "unit": "ms",
            "extra": "median: 0.17ms"
          },
          {
            "name": "Total per-slice",
            "value": 6.605211448800813,
            "range": "34.66890058967185",
            "unit": "ms",
            "extra": "median: 0.98ms"
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
            "value": 0.873739762412431,
            "unit": "#",
            "extra": "std: 0.10369666681111303"
          },
          {
            "name": "reduction (normalized tokens)",
            "value": 0.8191485019146605,
            "unit": "#",
            "extra": "std: 0.149513783440807"
          },
          {
            "name": "memory (df-graph)",
            "value": 114.83021484375,
            "range": "126.72727177130871",
            "unit": "KiB",
            "extra": "median: 54.80"
          }
        ]
      }
    ]
  }
}