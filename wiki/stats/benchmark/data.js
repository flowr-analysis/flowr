window.BENCHMARK_DATA = {
  "lastUpdate": 1755701579705,
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
      }
    ],
    "\"social-science\" Benchmark Suite": [
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
      }
    ],
    "\"artificial\" Benchmark Suite (tree-sitter)": [
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
      }
    ],
    "\"social-science\" Benchmark Suite (tree-sitter)": [
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
      }
    ]
  }
}