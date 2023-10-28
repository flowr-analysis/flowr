***This wiki page is currently under construction***

- [Testing Suites](#testing-suites)
  - [Functionality Tests](#functionality-tests)
  - [Performance Tests](#performance-tests)
- [CI Pipeline](#ci-pipeline)
- [Linting](#linting)
  - [Oh no, the linter fails](#oh-no-the-linter-fails)
  - [License Checker](#license-checker)

## Testing Suites

### Functionality Tests

How to test *flowR*

### Performance Tests

The performance test suite of *flowR* uses several suites to check for variations in the required times for certain steps.
Although we measure wall time in the CI (which is subject to rather large variations), it should give a rough idea of the performance of *flowR*.
Furthermore, the respective scripts can be used locally as well.

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

Besides checking coding style (as defined in the [package.json](../package.json)), the linter runs the [license checker](#license-checker).

If you are unaware, several linting problems can be automatically fixed by [eslint](https://eslint.org/docs/latest/use/command-line-interface#fix-problems). So you may be fine by just running:

```shell
npm run lint -- --fix
```

Similarly, for `lint-local`:

```shell
npm run lint-local -- --fix
```

### Oh no, the linter fails

By now, the rules should be rather stable and so, if the linter fails it is usually best if you (if necessary) read the respective [eslint](https://eslint.org/docs/latest/rules) description and fix the respective problem.
However, in case you think that the linter is wrong, please do not hesitate to open a [new issue](https://github.com/Code-Inspect/flowr/issues/new/choose).

### License Checker

*flowR* is licensed under the [GPLv3 License](LICENSE) requiring us to only rely on [compatible licenses](https://www.gnu.org/licenses/license-list.en.html). For now, this list is hardcoded as part of the npm [`license-compat`](../package.json) script so it can very well be that a new dependency you add causes the checker to fail &mdash; *even though it is compatible*. In that case, please either open a [new issue](https://github.com/Code-Inspect/flowr/issues/new/choose) or directly add the license to the list (including a reference to why it is compatible).
