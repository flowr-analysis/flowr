window.BENCHMARK_DATA = {
  "lastUpdate": 1695226562891,
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
          "id": "2a4f46774b3361de53c439a2dfcf7fe578365ed5",
          "message": "More Metrics for the Benchmark (#334)\n\n* ci-fix: increase timeout for performance tests\r\n\r\n* doc: explain the performance tests in the wiki\r\n\r\n* ci: try to merge all benchmarks into one file\r\n\r\n* ci, refactor: clean up existing benchmark results\r\n\r\n* ci-fix: report total measurements\r\n\r\n* feat: add more metrics to the graph summary (#333)\r\n\r\n* ci, refactor: shorten names",
          "timestamp": "2023-09-20T17:34:13+02:00",
          "tree_id": "f102cfd6f28065209c39755141aa1394011b3540",
          "url": "https://github.com/Code-Inspect/flowr/commit/2a4f46774b3361de53c439a2dfcf7fe578365ed5"
        },
        "date": 1695226562633,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 9053.009495545453,
            "unit": "ms",
            "range": 5431.99041819689,
            "extra": "median: 7389.05ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 2347.3007900909092,
            "unit": "ms",
            "range": 194.12257108447432,
            "extra": "median: 2277.24ms"
          },
          {
            "name": "Normalize R AST",
            "value": 149.88438627272728,
            "unit": "ms",
            "range": 257.88443615877395,
            "extra": "median: 95.11ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 100.68997054545454,
            "unit": "ms",
            "range": 264.27441143817384,
            "extra": "median: 25.30ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.748399383128472,
            "unit": "ms",
            "range": 2.173560944441966,
            "extra": "median: 2.35ms"
          },
          {
            "name": "Static slicing",
            "value": 2.047276769211237,
            "unit": "ms",
            "range": 2.0822492434764976,
            "extra": "median: 1.58ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.674644126201728,
            "unit": "ms",
            "range": 0.3721221299333419,
            "extra": "median: 0.61ms"
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
          "id": "2a4f46774b3361de53c439a2dfcf7fe578365ed5",
          "message": "More Metrics for the Benchmark (#334)\n\n* ci-fix: increase timeout for performance tests\r\n\r\n* doc: explain the performance tests in the wiki\r\n\r\n* ci: try to merge all benchmarks into one file\r\n\r\n* ci, refactor: clean up existing benchmark results\r\n\r\n* ci-fix: report total measurements\r\n\r\n* feat: add more metrics to the graph summary (#333)\r\n\r\n* ci, refactor: shorten names",
          "timestamp": "2023-09-20T17:34:13+02:00",
          "tree_id": "f102cfd6f28065209c39755141aa1394011b3540",
          "url": "https://github.com/Code-Inspect/flowr/commit/2a4f46774b3361de53c439a2dfcf7fe578365ed5"
        },
        "date": 1695226562633,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 9053.009495545453,
            "unit": "ms",
            "range": 5431.99041819689,
            "extra": "median: 7389.05ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 2347.3007900909092,
            "unit": "ms",
            "range": 194.12257108447432,
            "extra": "median: 2277.24ms"
          },
          {
            "name": "Normalize R AST",
            "value": 149.88438627272728,
            "unit": "ms",
            "range": 257.88443615877395,
            "extra": "median: 95.11ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 100.68997054545454,
            "unit": "ms",
            "range": 264.27441143817384,
            "extra": "median: 25.30ms"
          },
          {
            "name": "Total per-slice",
            "value": 2.748399383128472,
            "unit": "ms",
            "range": 2.173560944441966,
            "extra": "median: 2.35ms"
          },
          {
            "name": "Static slicing",
            "value": 2.047276769211237,
            "unit": "ms",
            "range": 2.0822492434764976,
            "extra": "median: 1.58ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.674644126201728,
            "unit": "ms",
            "range": 0.3721221299333419,
            "extra": "median: 0.61ms"
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
          "id": "2a4f46774b3361de53c439a2dfcf7fe578365ed5",
          "message": "More Metrics for the Benchmark (#334)\n\n* ci-fix: increase timeout for performance tests\r\n\r\n* doc: explain the performance tests in the wiki\r\n\r\n* ci: try to merge all benchmarks into one file\r\n\r\n* ci, refactor: clean up existing benchmark results\r\n\r\n* ci-fix: report total measurements\r\n\r\n* feat: add more metrics to the graph summary (#333)\r\n\r\n* ci, refactor: shorten names",
          "timestamp": "2023-09-20T17:34:13+02:00",
          "tree_id": "f102cfd6f28065209c39755141aa1394011b3540",
          "url": "https://github.com/Code-Inspect/flowr/commit/2a4f46774b3361de53c439a2dfcf7fe578365ed5"
        },
        "date": 1695226562888,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total per-file",
            "value": 10438.4186084,
            "unit": "ms",
            "range": 8029.447472119035,
            "extra": "median: 7094.29ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 1960.0962523800001,
            "unit": "ms",
            "range": 84.13977515895786,
            "extra": "median: 1934.46ms"
          },
          {
            "name": "Normalize R AST",
            "value": 143.8451531,
            "unit": "ms",
            "range": 90.19852870347388,
            "extra": "median: 106.64ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 202.23391881999999,
            "unit": "ms",
            "range": 347.70766169576206,
            "extra": "median: 56.18ms"
          },
          {
            "name": "Total per-slice",
            "value": 11.390812039205374,
            "unit": "ms",
            "range": 19.641345251975633,
            "extra": "median: 8.55ms"
          },
          {
            "name": "Static slicing",
            "value": 10.793410682976605,
            "unit": "ms",
            "range": 19.563754377531755,
            "extra": "median: 7.97ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.5836696931207735,
            "unit": "ms",
            "range": 0.37681853334375154,
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
      }
    ]
  }
}