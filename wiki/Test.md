***This wiki page is currently under construction***

- [Functionality Tests](#functionality-tests)
- [Performance Tests](#performance-tests)

## Functionality Tests

How to test *flowR* and how the CI works

## Performance Tests

The performance test suite of *flowR* uses several suites to check for variations in the required times for certain steps.
Although we measure wall time in the CI (which is subject to rather large variations), it should give a rough idea of the performance of *flowR*.
Furthermore, the respective scripts can be used locally as well.

See [test/performance](https://github.com/Code-Inspect/flowr/tree/main/test/performance) for more information on the suites, how to run them, and their results. If you are interested in the results of the default artificial benchmark, see [here](https://code-inspect.github.io/flowr/wiki/stats/benchmark/artificial/).
