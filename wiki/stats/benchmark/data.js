window.BENCHMARK_DATA = {
  "lastUpdate": 1755519426194,
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
      }
    ]
  }
}