window.BENCHMARK_DATA = {
  "lastUpdate": 1695153074235,
  "repoUrl": "https://github.com/Code-Inspect/flowr",
  "entries": {
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
          "id": "967b85f412ff9969ef01705dcb037ebaa11eb89b",
          "message": "Fix: Performance Test Submissions on main (#327)\n\n* ci-fix: use release token so that the qa can publish the benchmark results\r\n\r\n* ci-fix: pull before re-push\r\n\r\n* ci-fix: restrict upload runs to 1 at a time\r\n\r\n* ci-fix: remove iniital pull again, as the limited parallel run of uploads should be everything\r\n\r\n* ci-fix: use explicit step duplication to avoid checkout problem\r\n\r\n* ci: remove current stats",
          "timestamp": "2023-09-19T21:10:48+02:00",
          "tree_id": "6dc5de79bd4e718db7514101abe7ff2af666bee9",
          "url": "https://github.com/Code-Inspect/flowr/commit/967b85f412ff9969ef01705dcb037ebaa11eb89b"
        },
        "date": 1695153074159,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total",
            "value": 12043.403827799999,
            "unit": "ms",
            "range": 9100.109923007121,
            "extra": "median: 8297.11ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 2298.1048927800002,
            "unit": "ms",
            "range": 134.6305378109518,
            "extra": "median: 2287.28ms"
          },
          {
            "name": "Normalize R AST",
            "value": 172.90272658,
            "unit": "ms",
            "range": 115.65140809728184,
            "extra": "median: 121.48ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 257.71523314,
            "unit": "ms",
            "range": 443.600167109156,
            "extra": "median: 69.13ms"
          },
          {
            "name": "Total",
            "value": 13.086491825432814,
            "unit": "ms",
            "range": 22.378965522414568,
            "extra": "median: 9.90ms"
          },
          {
            "name": "Static slicing",
            "value": 12.397671450099258,
            "unit": "ms",
            "range": 22.29361944682933,
            "extra": "median: 9.19ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.675106263732484,
            "unit": "ms",
            "range": 0.40189410442835366,
            "extra": "median: 0.59ms"
          }
        ]
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
          "id": "967b85f412ff9969ef01705dcb037ebaa11eb89b",
          "message": "Fix: Performance Test Submissions on main (#327)\n\n* ci-fix: use release token so that the qa can publish the benchmark results\r\n\r\n* ci-fix: pull before re-push\r\n\r\n* ci-fix: restrict upload runs to 1 at a time\r\n\r\n* ci-fix: remove iniital pull again, as the limited parallel run of uploads should be everything\r\n\r\n* ci-fix: use explicit step duplication to avoid checkout problem\r\n\r\n* ci: remove current stats",
          "timestamp": "2023-09-19T21:10:48+02:00",
          "tree_id": "6dc5de79bd4e718db7514101abe7ff2af666bee9",
          "url": "https://github.com/Code-Inspect/flowr/commit/967b85f412ff9969ef01705dcb037ebaa11eb89b"
        },
        "date": 1695153074159,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "Total",
            "value": 12043.403827799999,
            "unit": "ms",
            "range": 9100.109923007121,
            "extra": "median: 8297.11ms"
          },
          {
            "name": "Retrieve AST from R code",
            "value": 2298.1048927800002,
            "unit": "ms",
            "range": 134.6305378109518,
            "extra": "median: 2287.28ms"
          },
          {
            "name": "Normalize R AST",
            "value": 172.90272658,
            "unit": "ms",
            "range": 115.65140809728184,
            "extra": "median: 121.48ms"
          },
          {
            "name": "Produce dataflow information",
            "value": 257.71523314,
            "unit": "ms",
            "range": 443.600167109156,
            "extra": "median: 69.13ms"
          },
          {
            "name": "Total",
            "value": 13.086491825432814,
            "unit": "ms",
            "range": 22.378965522414568,
            "extra": "median: 9.90ms"
          },
          {
            "name": "Static slicing",
            "value": 12.397671450099258,
            "unit": "ms",
            "range": 22.29361944682933,
            "extra": "median: 9.19ms"
          },
          {
            "name": "Reconstruct code",
            "value": 0.675106263732484,
            "unit": "ms",
            "range": 0.40189410442835366,
            "extra": "median: 0.59ms"
          }
        ]
      }
    ]
  }
}