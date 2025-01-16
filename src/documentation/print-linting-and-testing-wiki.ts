import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { codeBlock } from './doc-util/doc-code';
import { FlowrCodecovRef, FlowrDockerRef, FlowrGithubBaseRef, FlowrSiteBaseRef, FlowrWikiBaseRef, getFilePathMd, RemoteFlowrFilePathBaseRef } from './doc-util/doc-files';
import { block } from './doc-util/doc-structure';

function getText() {
	return `
For the latest code coverage information, see [codecov.io](${FlowrCodecovRef}), 
for the latest benchmark results, see the [benchmark results](${FlowrSiteBaseRef}/wiki/stats/benchmark) wiki page.

- [Testing Suites](#testing-suites)
  - [Functionality Tests](#functionality-tests)
    - [Test Structure](#test-structure)
    - [Writing a Test](#writing-a-test)
    - [Running Only Some Tests](#running-only-some-tests)
  - [System Tests](#system-tests)
  - [Performance Tests](#performance-tests)
  - [Oh no, the tests are slow](#oh-no-the-tests-are-slow)
  - [Testing Within Your IDE](#testing-within-your-ide)
    - [VS Code](#vs-code)
    - [Webstorm](#webstorm)
- [CI Pipeline](#ci-pipeline)
- [Linting](#linting)
  - [Oh no, the linter fails](#oh-no-the-linter-fails)
  - [License Checker](#license-checker)
- [Debugging](#debugging)
  - [VS Code](#vs-code-1)

## Testing Suites

Currently, flowR contains three testing suites: one for [functionality](#functionality-tests), 
one for [system tests](#system-tests), and one for [performance](#performance-tests). We explain each of them in the following.
In addition to running those tests, you can use the more generalized \`npm run checkup\`. 
This command includes the construction of the docker image, the generation of the wiki pages, and the linter.

### Functionality Tests

The functionality tests represent conventional unit (and depending on your terminology component/api) tests.
We use [vitest](https://vitest.dev/) as our testing framework.
You can run the tests by issuing (some quick benchmarks may be available with \`vitest bench\`):

${codeBlock('shell', 'npm run test')}

Within the commandline,
this should automatically drop you into a watch mode which will automatically re-run (potentially) affected tests if you change the code.
If, at any time there are too many errors for you to comprehend, you can use \`--bail=<value>\` to stop the tests after a certain number of errors.
For example:

${codeBlock('shell', 'npm run test -- --bail=1')}

If you want to run the tests without the watch mode, you can use:

${codeBlock('shell', 'npm run test -- --no-watch')}

To run all tests, including a coverage report and label summary, run: 

${codeBlock('shell', 'npm run test-full')}

However, depending on your local version of&nbsp;R, your network connection, and other factors (each test may have a set of criteria), 
some tests may be skipped automatically as they do not apply to your current system setup (or cannot be tested with the current prerequisites). 
Each test can specify such requirements as part of the \`TestConfiguration\`, which is then used in the \`test.skipIf\` function of _vitest_.
It is up to the [ci](#ci-pipeline) to run the tests on different systems to ensure that those tests run.

#### Test Structure

All functionality tests are to be located under [test/functionality](${RemoteFlowrFilePathBaseRef}test/functionality).

This folder contains three special and important elements:

- \`test-setup.ts\` which is the entry point if *all* tests are run. It should automatically disable logging statements and configure global variables (e.g., if installation tests should run).
- \`_helper/\` folder which contains helper functions to be used by other tests.
- \`test-summary.ts\` which may produce a summary of the covered capabilities.

${block({
		type:    'WARNING',
		content: `
We name all test files using the \`.test.ts\` suffix and try to run them in parallel.
Whenever this is not possible (e.g., when using \`withShell\`), please use \`describe.sequential\`
to disable parallel execution for the respective test (otherwise, such tests are flaky).
` 
	})}

#### Writing a Test

Currently, this is heavily dependent on what you want to test (normalization, dataflow, quad-export, ...) 
and it is probably best to have a look at existing tests in that area to get an idea of what comfort functionality is available.

Generally, tests should be [labeled](${RemoteFlowrFilePathBaseRef}test/functionality/_helper/label.ts) according to the *flowR* capabilities they test. The set of currently supported capabilities and their IDs can be found in ${getFilePathMd('../r-bridge/data/data.ts')}. The resulting labels are used in the test report that is generated as part of the test output. They group tests by the capabilities they test and allow the report to display how many tests ensure that any given capability is properly supported. 

Various helper functions are available to ease in writing tests with common behaviors, like testing for dataflow, slicing or query results. These can be found in [the \`_helper\` subdirectory](${RemoteFlowrFilePathBaseRef}test/functionality/_helper).

For example, an [existing test](${RemoteFlowrFilePathBaseRef}test/functionality/dataflow/processing-of-elements/atomic/dataflow-atomic.test.ts) that tests the dataflow graph of a simple variable looks like this:
${codeBlock('typescript', `
assertDataflow(label('simple variable', ['name-normal']), shell,
	'x', emptyGraph().use('0', 'x')
);
`)}

When writing dataflow tests, additional settings can be used to reduce the amount of graph data that needs to be pre-written. Notably:

- \`expectIsSubgraph\` indicates that the expected graph is a subgraph, rather than the full graph that the test should generate. The test will then only check if the supplied graph is contained in the result graph, rather than an exact match.
- \`resolveIdsAsCriterion\` indicates that the ids given in the expected (sub)graph should be resolved as [slicing criteria](${FlowrWikiBaseRef}/Terminology#slicing-criterion) rather than actual ids. For example, passing \`12@a\` as an id in the expected (sub)graph will cause it to be resolved as the corresponding id.

The following example shows both in use:
${codeBlock('typescript', `
assertDataflow(label('without distractors', [...OperatorDatabase['<-'].capabilities, 'numbers', 'name-normal', 'newlines', 'name-escaped']),
	shell, '\`a\` <- 2\\na',
	emptyGraph()
		.use('2@a')
		.reads('2@a', '1@\`a\`'),
	{
		expectIsSubgraph:      true,
		resolveIdsAsCriterion: true
	}
);
`)}

#### Running Only Some Tests

To run only some tests, vitest allows you to [filter](https://vitest.dev/guide/filtering.html) tests. 
Besides, you can use the watch mode (with \`npm run test\`) to only run tests that are affected by your changes.

### System Tests

In contrast to the [functionality tests](#functionality-tests), the system tests use runners like the \`npm\` scripts
to test the behavior of the whole system, for example, by running the CLI or the server.
They are slower and hence not part of \`npm run test\` but can be run using:
${codeBlock('shell', 'npm run test:system')}
To work, they require you to set up your system correctly (e.g., have \`npm\` available on your path).
The CI environment will make sure of that. At the moment, these tests are not labeled and only intended
to check basic availability of *flowR*'s core features (as we test the functionality of these features dedicately 
with the [functionality tests](#functionality-tests)).

Have a look at the [test/system-tests](${RemoteFlowrFilePathBaseRef}test/system-tests) folder for more information.
 


### Performance Tests

The performance test suite of *flowR* uses several suites to check for variations in the required times for certain steps.
Although we measure wall time in the CI (which is subject to rather large variations), it should give a rough idea *flowR*'s performance.
Furthermore, the respective scripts can be used locally as well.
To run them, issue:

${codeBlock('shell', 'npm run performance-test')}

See [test/performance](${RemoteFlowrFilePathBaseRef}test/performance) for more information on the suites, how to run them, and their results. If you are interested in the results of the benchmarks, see [here](${FlowrSiteBaseRef}/wiki/stats/benchmark).


### Testing Within Your IDE

#### VS Code

Using the vitest Extension for Visual Studio Code, you can start tests directly from the definition and explore your suite in the Testing tab.
To get started, install the [vitest Extension](https://marketplace.visualstudio.com/items?itemName=vitest.explorer).

![vscode market place](img/vs-code-vitest.png)

|               Testing Tab               | In Code                               |
|:---------------------------------------:|:-------------------------------------:|
| ![testing tab](img/testing-vs-code.png) | ![in code](img/testing-vs-code-2.png) |

- Left-clicking the <img style="vertical-align: middle" src='img/circle-check-regular.svg' height='16pt'> or <img style="vertical-align: middle" src='img/circle-xmark-regular.svg' height='16pt'> Icon next to the code will rerun the test. Right-clicking will open a context menu, allowing you to debug the test.
- In the Testing tab, you can run (and debug) all tests, individual suites or individual tests.

#### Webstorm

Please follow the official guide [here](https://www.jetbrains.com/help/webstorm/vitest.html).


## CI Pipeline

We have several workflows defined in [.github/workflows](${RemoteFlowrFilePathBaseRef}/.github/workflows/).
We explain the most important workflows in the following:

- [qa.yaml](${RemoteFlowrFilePathBaseRef}/.github/workflows/qa.yaml) is the main workflow that will run different steps depending on several factors. It is responsible for:
  - running the [functionality](#functionality-tests) and [performance tests](#performance-tests)
    - uploading the results to the [benchmark page](${FlowrSiteBaseRef}/wiki/stats/benchmark) for releases
    - running the [functionality tests](#functionality-tests) on different operating systems (Windows, macOS, Linux) and with different versions of R
    - reporting code coverage
  - running the [linter](#linting) and reporting its results
  - deploying the documentation to [GitHub Pages](${FlowrSiteBaseRef}/doc/)
- [release.yaml](${RemoteFlowrFilePathBaseRef}/.github/workflows/release.yaml) is responsible for creating a new release, only to be run by repository owners. Furthermore, it adds the new docker image to [docker hub](${FlowrDockerRef}).
- [broken-links-and-wiki.yaml](${RemoteFlowrFilePathBaseRef}/.github/workflows/broken-links-and-wiki.yaml) repeatedly tests that all links are not dead!

## Linting

There are two linting scripts.
The main one:

${codeBlock('shell', 'npm run lint')}

And a weaker version of the first (allowing for *todo* comments) which is run automatically in the [pre-push githook](${RemoteFlowrFilePathBaseRef}/.githooks/pre-push) as explained in the [CONTRIBUTING.md](${RemoteFlowrFilePathBaseRef}/.github/CONTRIBUTING.md):

${codeBlock('shell', 'npm run lint-local')}

Besides checking coding style (as defined in the [package.json](${RemoteFlowrFilePathBaseRef}/package.json)), the *full* linter runs the [license checker](#license-checker).

In case you are unaware,
eslint can automatically fix several linting problems[](https://eslint.org/docs/latest/use/command-line-interface#fix-problems).
So you may be fine by just running:

${codeBlock('shell', 'npm run lint-local -- --fix')}

### Oh no, the linter fails

By now, the rules should be rather stable and so, if the linter fails,
it is usually best if you (when necessary) read the respective description and fix the respective problem.
Rules in this project cover general JavaScript issues [using regular ESLint](https://eslint.org/docs/latest/rules), TypeScript-specific issues [using typescript-eslint](https://typescript-eslint.io/rules/), and code formatting [with ESLint Stylistic](https://eslint.style/packages/default#rules).

However, in case you think that the linter is wrong, please do not hesitate to open a [new issue](${FlowrGithubBaseRef}/flowr/issues/new/choose).

### License Checker

*flowR* is licensed under the [GPLv3 License](${FlowrGithubBaseRef}/flowr/blob/main/LICENSE) requiring us to only rely on [compatible licenses](https://www.gnu.org/licenses/license-list.en.html). For now, this list is hardcoded as part of the npm [\`license-compat\`](${RemoteFlowrFilePathBaseRef}/package.json) script so it can very well be that a new dependency you add causes the checker to fail &mdash; *even though it is compatible*. In that case, please either open a [new issue](${FlowrGithubBaseRef}/flowr/issues/new/choose) or directly add the license to the list (including a reference to why it is compatible).


## Debugging
### VS Code
When working with VS Code, you can attach a debugger to the REPL. This works automatically by running the \`Start Debugging\` command (\`F5\` by default).
You can also set the \`Auto Attach Filter\` setting to automatically attach the debugger, when running \`npm run flowr\`.
`;
}

if(require.main === module) {
	setMinLevelOfAllLogs(LogLevel.Fatal);
	console.log(getText());
}
