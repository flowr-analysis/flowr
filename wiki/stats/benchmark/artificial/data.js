window.BENCHMARK_DATA = {
  "lastUpdate": 1695143381725,
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
          "id": "9d15f7b41b42948861221d52ec16f657d65bd2a1",
          "message": "Fix repository rule violations by avoiding parallel uploads (#326)\n\n* ci-fix: use release token so that the qa can publish the benchmark results\r\n\r\n* ci-fix: pull before re-push\r\n\r\n* ci-fix: restrict upload runs to 1 at a time\r\n\r\n* ci-fix: remove iniital pull again, as the limited parallel run of uploads should be everything",
          "timestamp": "2023-09-19T18:25:28+02:00",
          "tree_id": "f2776ac113fdcd8fa466d7977387a9ee05932fe9",
          "url": "https://github.com/Code-Inspect/flowr/commit/9d15f7b41b42948861221d52ec16f657d65bd2a1"
        },
        "date": 1695143381611,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total",
            "value": 9815.560814772727,
            "unit": "ms",
            "range": 6112.831426050107,
            "extra": "median: 8086.22ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 2529.452666318182,
            "unit": "ms",
            "range": 265.77167326592456,
            "extra": "median: 2449.90ms"
          },
          {
            "name": "Normalize R AST",
            "value": 163.4539614090909,
            "unit": "ms",
            "range": 279.58548233228845,
            "extra": "median: 105.34ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 111.0290828181818,
            "unit": "ms",
            "range": 289.20992824461416,
            "extra": "median: 25.54ms"
          },
          {
            "name": "Total",
            "value": 2.8947467373109643,
            "unit": "ms",
            "range": 2.2726180053463794,
            "extra": "median: 2.54ms"
          },
          {
            "name": "Static slicing",
            "value": 2.123216414327812,
            "unit": "ms",
            "range": 2.14296727831939,
            "extra": "median: 1.70ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.7414350898671298,
            "unit": "ms",
            "range": 0.3692158179240182,
            "extra": "median: 0.66ms"
          }
        ]
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
          "id": "9d15f7b41b42948861221d52ec16f657d65bd2a1",
          "message": "Fix repository rule violations by avoiding parallel uploads (#326)\n\n* ci-fix: use release token so that the qa can publish the benchmark results\r\n\r\n* ci-fix: pull before re-push\r\n\r\n* ci-fix: restrict upload runs to 1 at a time\r\n\r\n* ci-fix: remove iniital pull again, as the limited parallel run of uploads should be everything",
          "timestamp": "2023-09-19T18:25:28+02:00",
          "tree_id": "f2776ac113fdcd8fa466d7977387a9ee05932fe9",
          "url": "https://github.com/Code-Inspect/flowr/commit/9d15f7b41b42948861221d52ec16f657d65bd2a1"
        },
        "date": 1695143381611,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total",
            "value": 9815.560814772727,
            "unit": "ms",
            "range": 6112.831426050107,
            "extra": "median: 8086.22ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 2529.452666318182,
            "unit": "ms",
            "range": 265.77167326592456,
            "extra": "median: 2449.90ms"
          },
          {
            "name": "Normalize R AST",
            "value": 163.4539614090909,
            "unit": "ms",
            "range": 279.58548233228845,
            "extra": "median: 105.34ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 111.0290828181818,
            "unit": "ms",
            "range": 289.20992824461416,
            "extra": "median: 25.54ms"
          },
          {
            "name": "Total",
            "value": 2.8947467373109643,
            "unit": "ms",
            "range": 2.2726180053463794,
            "extra": "median: 2.54ms"
          },
          {
            "name": "Static slicing",
            "value": 2.123216414327812,
            "unit": "ms",
            "range": 2.14296727831939,
            "extra": "median: 1.70ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.7414350898671298,
            "unit": "ms",
            "range": 0.3692158179240182,
            "extra": "median: 0.66ms"
          }
        ]
      }
    ]
  }
}