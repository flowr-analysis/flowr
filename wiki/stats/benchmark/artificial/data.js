window.BENCHMARK_DATA = {
  "lastUpdate": 1695153073918,
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
          "id": "967b85f412ff9969ef01705dcb037ebaa11eb89b",
          "message": "Fix: Performance Test Submissions on main (#327)\n\n* ci-fix: use release token so that the qa can publish the benchmark results\r\n\r\n* ci-fix: pull before re-push\r\n\r\n* ci-fix: restrict upload runs to 1 at a time\r\n\r\n* ci-fix: remove iniital pull again, as the limited parallel run of uploads should be everything\r\n\r\n* ci-fix: use explicit step duplication to avoid checkout problem\r\n\r\n* ci: remove current stats",
          "timestamp": "2023-09-19T21:10:48+02:00",
          "tree_id": "6dc5de79bd4e718db7514101abe7ff2af666bee9",
          "url": "https://github.com/Code-Inspect/flowr/commit/967b85f412ff9969ef01705dcb037ebaa11eb89b"
        },
        "date": 1695153073913,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total",
            "value": 9194.419532863636,
            "unit": "ms",
            "range": 5711.795326098939,
            "extra": "median: 7533.18ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 2368.8804439545456,
            "unit": "ms",
            "range": 238.31690753230743,
            "extra": "median: 2288.18ms"
          },
          {
            "name": "Normalize R AST",
            "value": 152.8474165,
            "unit": "ms",
            "range": 258.99234670118045,
            "extra": "median: 97.29ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 103.67440913636364,
            "unit": "ms",
            "range": 272.9291895295685,
            "extra": "median: 30.63ms"
          },
          {
            "name": "Total",
            "value": 2.761553353193063,
            "unit": "ms",
            "range": 2.009883852968059,
            "extra": "median: 2.36ms"
          },
          {
            "name": "Static slicing",
            "value": 2.0270250013231976,
            "unit": "ms",
            "range": 1.8828934030012243,
            "extra": "median: 1.58ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.7075955392343369,
            "unit": "ms",
            "range": 0.41642185097256024,
            "extra": "median: 0.63ms"
          }
        ]
      }
    ]
  }
}