import { FlowrLogger } from '../util/log';
import { codeBlock } from './doc-util/doc-code';
import {
	FlowrCodecovRef,
	FlowrGithubBaseRef,
	FlowrWikiBaseRef,
	getFilePathMd,
	linkFlowRSourceFile,
	RemoteFlowrFilePathBaseRef
} from './doc-util/doc-files';
import { block } from './doc-util/doc-structure';
import { getCliLongOptionOf } from './doc-util/doc-cli-option';
import { DfEdge } from '../dataflow/graph/edge';
import { Resolve } from '../dataflow/environments/resolve-helper';
import { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DocMakerArgs } from './wiki-mk/doc-maker';
import { DocMaker } from './wiki-mk/doc-maker';


/**
 * https://github.com/flowr-analysis/flowr/wiki/Linting-and-Testing
 */
export class WikiLintingAndTesting extends DocMaker<'wiki/Linting and Testing.md'> {
	constructor() {
		super('wiki/Linting and Testing.md', module.filename, 'linting and testing definitions');
	}

	protected text({ ctx }: DocMakerArgs): string {
		return `
For the latest code coverage information, see [codecov.io](${FlowrCodecovRef}), 
for the latest benchmark results, see the ${ctx.linkPage('flowr:benchmarks', 'benchmark results')} wiki page.

- [🏨 Testing Suites](#testing-suites)
  - [🧪 Functionality Tests](#functionality-tests)
    - [🏗️ Test Structure](#test-structure)
    - [🏷️ Test Labels](#test-labels)
    - [🖋️ Writing a Test](#writing-a-test)
    - [🤏 Running Only Some Tests](#running-only-some-tests)
  - [💽 System Tests](#system-tests)
  - [💃 Performance Tests](#performance-tests)
  - [📝 Testing Within Your IDE](#testing-within-your-ide)
    - [VS Code](#vs-code)
    - [Webstorm](#webstorm)
- [🪈 CI Pipeline](#ci-pipeline)
- [🧹 Linting](#linting)
  - [Oh no, the linter fails](#oh-no-the-linter-fails)
  - [flowR-Specific Rules](#flowr-specific-rules)
    - [Pointing at a Helper with \`@useInstead\`](#pointing-at-a-helper-with-useinstead)
    - [Replacement Patterns](#replacement-patterns)
    - [Suppressing a Rule](#suppressing-a-rule)
    - [A Part of unicorn](#a-part-of-unicorn)
  - [License Checker](#license-checker)
- [🐛 Debugging](#debugging)
  - [VS Code](#vs-code-1)
  - [Logging](#logging)

<a id='testing-suites'></a>
## 🏨 Testing Suites

Currently, flowR contains three testing suites: one for [functionality](#functionality-tests), 
one for [system tests](#system-tests), and one for [performance](#performance-tests). We explain each of them in the following.
In addition to running those tests, you can use the more generalized \`npm run checkup\`.
This command includes the construction of the docker image, the generation of the wiki pages, and the linter.
It runs these jobs concurrently but caps the test workers so the combined run fits the machine (it splits the
available cores across the parallel \`vitest\` jobs via \`--maxWorkers\` instead of letting each grab every core).
Pass job ids to run a subset (e.g. \`npm run checkup -- lint tests\`) or \`--no-docker\` to skip the image build.

<a id='functionality-tests'></a>
### 🧪 Functionality Tests

The functionality tests represent conventional unit (and depending on your terminology component/api) tests.
We use [vitest](https://vitest.dev/) as our testing framework.
You can run the tests by issuing (some quick benchmarks may be available with \`npm run test:bench\`):

${codeBlock('shell', 'npm run test')}

Within the commandline,
this should automatically drop you into a watch mode which will automatically re-run (potentially) affected tests if you change the code.
If, at any time there are too many errors for you to comprehend, you can use \`--bail=<value>\` to stop the tests after a certain number of errors.
For example:

${codeBlock('shell', 'npm run test -- --bail=1')}

If you want to run the tests without the watch mode, you can use:

${codeBlock('shell', 'npm run test -- --no-watch')}

To run all tests, including a coverage report and label summary, run:

${codeBlock('shell', 'npm run test:full')}

However, depending on your local version of&nbsp;R, your network connection, and other factors (each test may have a set of criteria), 
some tests may be skipped automatically as they do not apply to your current system setup (or cannot be tested with the current prerequisites). 
Each test can specify such requirements as part of the \`TestConfiguration\`, which is then used in the \`test.skipIf\` function of _vitest_.
It is up to the [ci](#ci-pipeline) to run the tests on different systems to ensure that those tests run.

<a id='test-structure'></a>
#### 🏗️ Test Structure

All functionality tests are to be located under [test/functionality](${RemoteFlowrFilePathBaseRef}test/functionality).

This folder contains three special and important elements:

- \`test-setup.ts\` which is the entry point if *all* tests are run. It should automatically disable logging statements and configure global variables (e.g., if installation tests should run).
- \`_helper/\` folder which contains helper functions to be used by other tests.
- \`test-summary.ts\` which may produce a summary of the covered capabilities.

${block({
	type:    'WARNING',
	content: `
We name all test files using the \`.test.ts\` suffix and try to run them in parallel.
Whenever this is impossible (e.g., when using ${ctx.link('withShell')}), pass \`{ concurrent: false }\` to the
\`describe\` to disable parallel execution for the respective test (otherwise, such tests are flaky):

${codeBlock('typescript', 'describe(\'my suite\', { concurrent: false }, withShell(shell => { /* ... */ }));')}

Vitest deprecated the \`describe.sequential\` form in favour of that option, so please do not reintroduce it.
`
})}

<a id='test-labels'></a>
#### 🏷️ Test Labels

Generally, tests are [labeled](${RemoteFlowrFilePathBaseRef}test/functionality/_helper/label.ts) according to the *flowR* capabilities they test. 

The set of currently supported capabilities and their IDs can be found in ${getFilePathMd('../r-bridge/data/data.ts')}. 

The resulting labels are used in the test report that is generated as part of the test output. 
They group tests by the capabilities they test and allow the report to display how many tests ensure that any given capability is properly supported.
The report can be found on the wiki's ${ctx.linkPage('wiki/Capabilities', 'capabilities page')}.

To add new labels, simply add them to the relevant section in ${getFilePathMd('../r-bridge/data/data.ts')} as part of a pull request.

<a id='writing-a-test'></a>
#### 🖋️ Writing a Test

Currently, this is heavily dependent on what you want to test (normalization, dataflow, quad-export, …) 
and it is probably best to have a look at existing tests in that area to get an idea of what comfort functionality is available.

Various helper functions are available to ease in writing tests with common behaviors, like testing for dataflow, slicing or query results. 
These can be found in [the \`_helper\` subdirectory](${RemoteFlowrFilePathBaseRef}test/functionality/_helper).

For example, an [existing test](${RemoteFlowrFilePathBaseRef}test/functionality/dataflow/main/atomic/dataflow-atomic.test.ts) that tests the dataflow graph of a simple variable looks like this:
${codeBlock('typescript', `
assertDataflow(label('simple variable', ['name-normal']), shell,
	'x', emptyGraph().use('0', 'x')
);
`)}
Have a look at ${ctx.link('assertDataflow')}, ${ctx.link('label')}, and ${ctx.link('emptyGraph')} for more information.

When writing dataflow tests, additional settings can be used to reduce the amount of graph data that needs to be pre-written. Notably:

- ${ctx.link('expectIsSubgraph')} indicates that the expected graph is a subgraph, rather than the full graph that the test should generate. 
  The test will then only check if the supplied graph is contained in the result graph, rather than an exact match.
- ${ctx.link('resolveIdsAsCriterion')} indicates that the ids given in the expected (sub)graph should be resolved as [slicing criteria](${FlowrWikiBaseRef}/Terminology#slicing-criterion) rather than actual ids. 
  For example, passing \`12@a\` as an id in the expected (sub)graph will cause it to be resolved as the corresponding id.

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

<a id='running-only-some-tests'></a>
#### 🤏 Running Only Some Tests

To run only some tests, vitest allows you to [filter](https://vitest.dev/guide/filtering.html) tests. 
Besides, you can use the watch mode (with \`npm run test\`) to only run tests that are affected by your changes.

<a id='system-tests'></a>
### 💽 System Tests

In contrast to the [functionality tests](#functionality-tests), the system tests use runners like the \`npm\` scripts
to test the behavior of the whole system, for example, by running the CLI or the server.
They are slower and hence not part of \`npm run test\` but can be run using:
${codeBlock('shell', 'npm run test:system')}
To work, they require you to set up your system correctly (e.g., have \`npm\` available on your path).
The CI environment will make sure of that. At the moment, these tests are not labeled and only intended
to check basic availability of *flowR*'s core features (as we test the functionality of these features dedicately 
with the [functionality tests](#functionality-tests)).

Have a look at the [test/system-tests](${RemoteFlowrFilePathBaseRef}test/system-tests) folder for more information.
 
<a id='performance-tests'></a>
### 💃 Performance Tests

The performance test suite of *flowR* uses several suites to check for variations in the required times for certain steps.
Although we measure wall time in the CI (which is subject to rather large variations), it should give a rough idea *flowR*'s performance.
Furthermore, the respective scripts can be used locally as well.
To run them, issue:

${codeBlock('shell', 'npm run test:performance')}

See ${linkFlowRSourceFile('test/performance')} for more information on the suites, how to run them, and their results. If you are interested in the results of the benchmarks, see ${ctx.linkPage('flowr:benchmarks', 'here')}.

<a id='testing-within-your-ide'></a>
### 📝 Testing Within Your IDE

#### VS Code

Using the vitest Extension for Visual Studio Code, you can start tests directly from the definition and explore your suite in the Testing tab.
To get started, install the [vitest Extension](https://marketplace.visualstudio.com/items?itemName=vitest.explorer).

|               Testing Tab               | In Code                               |
|:---------------------------------------:|:-------------------------------------:|
| ![testing tab](img/testing-vs-code.png) | ![in code](img/testing-vs-code-2.png) |

- Left-clicking the <img style="vertical-align: middle" src='img/circle-check-regular.svg' height='16pt'> or <img style="vertical-align: middle" src='img/circle-xmark-regular.svg' height='16pt'> Icon next to the code will rerun the test. Right-clicking will open a context menu, allowing you to debug the test.
- In the Testing tab, you can run (and debug) all tests, individual suites or individual tests.

#### Webstorm

Please follow the official guide [here](https://www.jetbrains.com/help/webstorm/vitest.html).
Note that the working directory has to be set to the project root directory, not the test subdirectory!
Otherwise, the tests will not be instantiated.

![Webstorm test configuration](img/testing-webstorm.png)

<a id='ci-pipeline'></a>
## 🪈 CI Pipeline

We have several workflows defined in ${linkFlowRSourceFile('.github/workflows')}.
We explain the most important workflows in the following:

- ${linkFlowRSourceFile('.github/workflows/qa.yaml')} is the main workflow that will run different steps depending on several factors. It is responsible for:
  - running the [functionality](#functionality-tests) and [performance tests](#performance-tests)
    - uploading the results to the ${ctx.linkPage('flowr:benchmarks', 'benchmark page')} for releases
    - running the [functionality tests](#functionality-tests) on different operating systems (Windows, macOS, Linux) and with different versions of R
    - reporting code coverage
  - running the [linter](#linting) and reporting its results
  - deploying the documentation to ${ctx.linkPage('flowr:docs', 'GitHub Pages')}
- ${linkFlowRSourceFile('.github/workflows/release.yaml')} is responsible for creating a new release, only to be run by repository owners. Furthermore, it adds the new docker image to ${ctx.linkPage('flowr:docker', 'docker hub')}.
- ${linkFlowRSourceFile('.github/workflows/broken-links-and-wiki.yaml')} repeatedly tests that all links are not dead!
 
<a id='linting'></a>
## 🧹 Linting

There are two linting scripts.
The main one:

${codeBlock('shell', 'npm run lint')}

And a weaker version of the first (allowing for *todo* comments) which is run automatically in the [pre-push githook](${RemoteFlowrFilePathBaseRef}.githooks/pre-push) as explained in the [CONTRIBUTING.md](${RemoteFlowrFilePathBaseRef}.github/CONTRIBUTING.md):

${codeBlock('shell', 'npm run lint-local')}

Besides checking coding style (as defined in the [package.json](${RemoteFlowrFilePathBaseRef}package.json)), the *full* linter runs the [license checker](#license-checker).

In case you are unaware,
eslint can automatically fix several linting problems[](https://eslint.org/docs/latest/use/command-line-interface#fix-problems).
So you may be fine by just running:

${codeBlock('shell', 'npm run lint-local -- --fix')}
 
<a id='oh-no-the-linter-fails'></a>
### 💥 Oh no, the linter fails

By now, the rules should be rather stable and so, if the linter fails,
it is usually best if you (when necessary) read the respective description and fix the respective problem.
Rules in this project cover general JavaScript issues [using regular ESLint](https://eslint.org/docs/latest/rules), TypeScript-specific issues [using typescript-eslint](https://typescript-eslint.io/rules/), and code formatting [with ESLint Stylistic](https://eslint.style/packages/default#rules).

However, in case you think that the linter is wrong, please do not hesitate to open a [new issue](${FlowrGithubBaseRef}/flowr/issues/new/choose).

<a id='flowr-specific-rules'></a>
### 🧭 flowR-Specific Rules

flowR groups its functions in helper objects (${ctx.link(DfEdge)}, ${ctx.link(Resolve)}, ${ctx.link(NodeId)}, and
friends) so that there is one obvious entry point per topic. Two rules of the
[\`flowr\` plugin](${FlowrGithubBaseRef}/flowr-lint) keep the code on those entry points, both part of \`npm run lint\`.
Each is fixed on the spot where the replacement is already imported, and offered as an editor suggestion otherwise.

<a id='pointing-at-a-helper-with-useinstead'></a>
#### Pointing at a Helper with \`@useInstead\`

A function that only exists to be wired into a helper object names its replacement, and every reference outside its own
file is then reported:

${codeBlock('ts', `/**
 * Every definition the identifier may refer to.
 * @useInstead {@link Resolve.byName}
 */
export function resolveByNameAnyType(/* ... */) { /* ... */ }`)}

Never reported are the references that make the replacement exist: the wiring in an object literal
(${ctx.linkO(Resolve, 'byName')} pointing at \`resolveByNameAnyType\`), re-exports, and files declaring the helper itself.

<a id='replacement-patterns'></a>
#### Replacement Patterns

Some replacements are a shape of code rather than a renamed function, such as \`edge.types === EdgeType.Reads\`, which
reads like "has this type" (${ctx.linkO(DfEdge, 'includesType')}) but holds only if it is the *only* type
(${ctx.linkO(DfEdge, 'isOnlyType')}). These are matched with [esquery](https://github.com/estools/esquery) selectors,
the language \`no-restricted-syntax\` uses.

The [flowr-lint README](${FlowrGithubBaseRef}/flowr-lint#flowrreplacement-pattern) documents the fields of a pattern,
and \`npx eslint\` names the id of whichever one fires.
To propose a new pattern or a change to any of them, open an issue with the replacement pattern template in
[that repository](${FlowrGithubBaseRef}/flowr-lint/issues/new/choose).

<a id='suppressing-a-rule'></a>
#### Suppressing a Rule

A tag on a declaration covers everything below it, a header comment above the imports covers the whole file.

| | silences |
| :-- | :-- |
| \`// eslint-disable-next-line\` | the next line, as usual |
| \`@lintIgnore <ids>\` | the named rules or pattern ids, all of them when given none |

Put the reason in the prose above the tag, a hot path that has to keep the raw form is as good a reason as any.

<a id='a-part-of-unicorn'></a>
#### A Part of unicorn

The configuration also enables a hand-picked part of [unicorn](https://github.com/sindresorhus/eslint-plugin-unicorn):
the rules naming a shape with a clearer equivalent (\`prefer-includes\`, \`prefer-string-slice\`, and friends), not its
opinions on naming or style. Three are left out on purpose:

- \`prefer-array-flat\` rewrites \`.flatMap(f => f)\` on an iterator, which has no \`.flat()\`.
- \`prefer-structured-clone\` does not know that a \`JSON\` round-trip is sometimes the point.
- \`prefer-node-protocol\` is inverted, \`no-restricted-imports\` forbids the \`node:\` prefix instead: flowR is bundled for
  the browser as well (the web build of the ${ctx.linkPage('flowr:vscode', 'VS Code extension')}), where the core modules
  are swapped for polyfills by their bare name, and a \`node:\` specifier matches none of those bundler keys.

<a id='license-checker'></a>
### 🪪 License Checker

*flowR* is licensed under the [GPLv3 License](${FlowrGithubBaseRef}/flowr/blob/main/LICENSE) requiring us to only rely on [compatible licenses](https://www.gnu.org/licenses/license-list.en.html). For now, this list is hardcoded as part of the npm [\`license-compat\`](${RemoteFlowrFilePathBaseRef}package.json) script so it can very well be that a new dependency you add causes the checker to fail &mdash; *even though it is compatible*. In that case, please either open a [new issue](${FlowrGithubBaseRef}/flowr/issues/new/choose) or directly add the license to the list (including a reference to why it is compatible).

<a id='debugging'></a>
## 🐛 Debugging
### VS Code
When working with VS Code, you can attach a debugger to the REPL. This works automatically by running the \`Start Debugging\` command (\`F5\` by default).
You can also set the \`Auto Attach Filter\` setting to automatically attach the debugger, when running \`npm run flowr\`.

### Logging

*flowR* uses a wrapper around [tslog](https://www.npmjs.com/package/tslog) using a class named
${ctx.link(FlowrLogger)}. They obey to, for example, the ${getCliLongOptionOf('flowr', 'verbose')}
option. Throughout *flowR*, we use the \`log\` object (or subloggers of it) for logging.
To create your own logger, you can use ${ctx.linkM(FlowrLogger, 'getSubLogger', { codeFont: true, realNameWrapper: 'i' })}.
For example, check out the ${ctx.link('slicerLogger')} for the static slicer.

`;
	}
}
