For the latest code-coverage information, see [codecov.io](https://codecov.io/gh/Code-Inspect/flowr), for the latest benchmark results, see the [benchmark results](https://code-inspect.github.io/flowr/wiki/stats/benchmark) wiki page.

- [Testing Suites](#testing-suites)
  - [Functionality Tests](#functionality-tests)
    - [Test Structure](#test-structure)
    - [Writing a Test](#writing-a-test)
  - [Performance Tests](#performance-tests)
- [CI Pipeline](#ci-pipeline)
- [Linting](#linting)
  - [Oh no, the linter fails](#oh-no-the-linter-fails)
  - [License Checker](#license-checker)

## Testing Suites

Currently, flowR contains two testing suites: one for [functionality](#functionality-tests) and one for [performance](#performance-tests). We explain each of them in the following.

### Functionality Tests

The functionality tests represent conventional unit (and depending on your terminology component/api) tests.
We use [mocha](https://mochajs.org/) as our testing framework and [chai](https://www.chaijs.com/) as our assertion library.
To run these tests, simply issue:

```shell
npm run test
```

What may be counter-intuitive is that this does not run *all* tests by default but only those that do not try R's package installation (as this can require more time). To run all tests, installation tests included, use:

```shell
npm run test-full
```

However, depending on your local R version, your network connection and potentially other factors, some tests may be skipped automatically as they do not apply to your current system setup (or can't be tested with the current prerequisites). Each test can speciy such requirements as part of the `TestConfiguration`, which is then enforced by the [`ensureConfig`](https://github.com/Code-Inspect/flowr/blob/main/test/functionality/_helper/shell.ts) function.
It is up to the [ci](#ci-pipeline) to run the tests on different systems to ensure that those tests are ensured to run.

#### Test Structure

All functionality tests are to be located under [test/functionality](https://github.com/Code-Inspect/flowr/tree/main/test/functionality).

This folder contains two special elements:

- `main.spec.ts` which is the entry point if *all* tests are run. It should automatically disable logging statements and configure global variables (e.g., if installation tests should run).
- `_helper` which contains helper functions to be used by other tests.

Besides folders can (theoretically) arbitrarily structure their tests. We use the following convention:

- `*.spec.ts` denotes a test file which is to be collected when all tests are run, it may require other files to avoid big testing files and improve structure, but those should never end in `*.spec.ts`.
. `-tests.ts` denotes test files which are required by `*.spec.ts` files. To require them, there is also the helper function `requireAllTestsInFolder` which performs sanity checks to avoid forgotten tests.

#### Writing a Test

Currently this is heavily dependend on what you want to test (normalization, dataflow, quad-export, ...) and it is probably best to have a look at existing tests in that area to get an idea of what comfort functionality is available.

### Performance Tests

The performance test suite of *flowR* uses several suites to check for variations in the required times for certain steps.
Although we measure wall time in the CI (which is subject to rather large variations), it should give a rough idea of the performance of *flowR*.
Furthermore, the respective scripts can be used locally as well.
To run them, issue:

```shell
npm run performance-test
```

See [test/performance](https://github.com/Code-Inspect/flowr/tree/main/test/performance) for more information on the suites, how to run them, and their results. If you are interested in the results of the benchmarks, see [here](https://code-inspect.github.io/flowr/wiki/stats/benchmark).

## CI Pipeline

We have several workflows defined in [.github/workflows](../.github/workflows/) (with the core setup of node and R being outsourced to [.github/actions/setup](../.github/actions/setup)).
We explain the most important workflows in the following:

- [run.yaml](../.github/workflows/run.yaml) is a [reusable workflow](https://docs.github.com/en/actions/using-workflows/reusing-workflows) that we use *whenever* we want to run a *flowR* npm script in the pipeline (furthermore, this hides necessary extra steps for coverage, documentation, and benchmarks).
- [qa.yaml](../.github/workflows/qa.yaml) is the main workflow which will run different steps depending on several factors. It is repsonsible for:
  - running the [functionality](#functionality-tests) and [performance tests](#performance-tests)
    - uploading the results to the [benchmark page](https://code-inspect.github.io/flowr/wiki/stats/benchmark) for releases
    - running the [functionality tests](#functionality-tests) on different operating systems (Windows, macOS, Linux) and with different versions of R
    - reporting code coverage
  - running the [linter](#linting) and reporting its results
  - deploying the documentation to [GitHub Pages](https://code-inspect.github.io/flowr/doc/)
- [release.yaml](../.github/workflows/release.yaml) is responsible for creating a new release, only to be run by repository owners. Furthermore, it adds the new docker image to [docker hub](https://hub.docker.com/r/eagleoutice/flowr).
- [check-broken-links.yaml](../.github/workflows/check-broken-links.yaml) repeatedly tests that all links are not dead!

## Linting

There are two linting scripts.
The main one:

```shell
npm run lint
```

And a weaker version of the first (allowing for *todo* comments) which is run automatically in the [pre-push githook](../.githooks/pre-push) as explained in the [CONTRIBUTING.md](../.github/CONTRIBUTING.md):

```shell
npm run lint-local
```

Besides checking coding style (as defined in the [package.json](../package.json)), the _full_ linter runs the [license checker](#license-checker).

If you are unaware, several linting problems can be automatically fixed by [eslint](https://eslint.org/docs/latest/use/command-line-interface#fix-problems). So you may be fine by just running:

```shell
npm run lint-local -- --fix
```

### Oh no, the linter fails

By now, the rules should be rather stable and so, if the linter fails it is usually best if you (if necessary) read the respective [eslint](https://eslint.org/docs/latest/rules) description and fix the respective problem.
However, in case you think that the linter is wrong, please do not hesitate to open a [new issue](https://github.com/Code-Inspect/flowr/issues/new/choose).

### License Checker

*flowR* is licensed under the [GPLv3 License](LICENSE) requiring us to only rely on [compatible licenses](https://www.gnu.org/licenses/license-list.en.html). For now, this list is hardcoded as part of the npm [`license-compat`](../package.json) script so it can very well be that a new dependency you add causes the checker to fail &mdash; *even though it is compatible*. In that case, please either open a [new issue](https://github.com/Code-Inspect/flowr/issues/new/choose) or directly add the license to the list (including a reference to why it is compatible).