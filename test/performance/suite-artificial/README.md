# The Artificial Benchmark Suite

Small hand-written R files that each stress a particular edge-case of the analysis (control flow, loops,
redefinitions, closures, data frames, long pipes, and so on). They live in `static/` and are checked in, so the
suite runs offline.

`setup.sh` links every file from `static/` into `files/` and also writes a `-large` copy of each (the file
repeated a number of times) to test larger inputs.

To add a case, drop another `.r` file into `static/`; it is picked up automatically.
