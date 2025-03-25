import { RShell } from '../r-bridge/shell';
import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';

import { TreeSitterExecutor } from '../r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import {
	FlowrDockerRef,
	FlowrGithubBaseRef,
	FlowrNpmRef,
	FlowrVsCode,
	FlowrWikiBaseRef, getFileContentFromRoot,
	linkFlowRSourceFile
} from './doc-util/doc-files';
import { codeBlock } from './doc-util/doc-code';
import { getReplCommand } from './doc-util/doc-cli-option';
import { getLastBenchmarkUpdate, getLatestDfAnalysisTime } from './doc-util/doc-benchmarks';
import { roundToDecimals } from '../util/numbers';
import { textWithTooltip } from '../util/html-hover-over';
import { details } from './doc-util/doc-structure';
import { documentReplSession } from './doc-util/doc-repl';
import { fileNameForGenHeader } from './doc-util/doc-auto-gen';
import { prefixLines } from './doc-util/doc-general';
import { printDfGraphForCode } from './doc-util/doc-dfg';

async function getText(shell: RShell) {
	const dateOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };

	return `
[![flowR logo](https://raw.githubusercontent.com/wiki/flowr-analysis/flowr/img/flowR.png)](${FlowrGithubBaseRef}/flowr/wiki)\\
[![QA (and potentially deploy)](${FlowrGithubBaseRef}/flowr/actions/workflows/qa.yaml/badge.svg)](${FlowrGithubBaseRef}/flowr/actions/workflows/qa.yaml)
[![codecov](https://codecov.io/gh/flowr-analysis/flowr/graph/badge.svg)](https://codecov.io/gh/flowr-analysis/flowr)
[![Docker Image Version (latest semver)](https://img.shields.io/docker/v/eagleoutice/flowr?logo=docker&logoColor=white&label=dockerhub)](${FlowrDockerRef})
[![latest tag](https://badgen.net/github/tag/flowr-analysis/flowr?label=latest&color=purple)](${FlowrGithubBaseRef}/flowr/releases/latest)
[![Marketplace](https://badgen.net/vs-marketplace/v/code-inspect.vscode-flowr)](${FlowrVsCode})
[![DOI](https://zenodo.org/badge/624819038.svg)](https://zenodo.org/doi/10.5281/zenodo.13319290)

_flowR_ is a sophisticated, static [dataflow analyzer](https://en.wikipedia.org/wiki/Data-flow_analysis) for the [R programming language](https://www.r-project.org/).
It offers a wide variety of features, for example:

* 🍕 **program slicing**\\
   Given a point of interest like the visualization of a plot, _flowR_ reduces the program to just the parts which are relevant
   for the computation of the point of interest.

${prefixLines(details('Example: Slicing with flowR', `
The simplest way to retrieve slices is with flowR's [Visual Studio Code extension](${FlowrVsCode}). 
However, you can slice using the [REPL](${FlowrWikiBaseRef}/Interface#using-the-repl) as well.
This can help you if you want to reuse specific parts of an existing analysis within another context or if you want to understand
what is happening in the code.

For this, let's have a look at the example file, located at ${linkFlowRSourceFile('test/testfiles/example.R')}:

${codeBlock('r', getFileContentFromRoot('test/testfiles/example.R'))}

Let's suppose we are interested only in the \`sum\` which is printed in line 11.
To get a slice for this, you can use the following command:

${await documentReplSession(shell, [{
	command:     ':slicer test/testfiles/example.R --criterion "11@sum"',
	description: ''
}])}
   
   `), '    ')}

* 📚 **dependency analysis**\\
  Given your analysis project, flowR offers a plethora of so-called [queries](${FlowrWikiBaseRef}/Query-API) to get more information about your code.
  An important query is the [dependencies query](${FlowrWikiBaseRef}/Query-API#dependencies-query), which shows you the library your project needs,
  the data files it reads, the scripts it sources, and the data it outputs.
  
  ${prefixLines(details('Example: Dependency Analysis with flowR', `
The following showcases the dependency view of the [Visual Studio Code extension](${FlowrVsCode}):

![Dependency Analysis](https://raw.githubusercontent.com/flowr-analysis/vscode-flowr/refs/heads/main/media/dependencies.png)
  
  `), '    ')}

* 🚀 **fast data- and control-flow graphs**\\
  Within just ${'<i>' + textWithTooltip(roundToDecimals(await getLatestDfAnalysisTime('"social-science" Benchmark Suite (tree-sitter)'), 1) + ' ms', 'This measurement is automatically fetched from the latest benchmark!') + '</i>'} (as of ${new Date(await getLastBenchmarkUpdate()).toLocaleDateString('en-US', dateOptions)}), 
  _flowR_ can analyze the data- and control-flow of the average real-world R script. See the [benchmarks](https://flowr-analysis.github.io/flowr/wiki/stats/benchmark) for more information,
  and consult the [wiki pages](${FlowrWikiBaseRef}/Dataflow-Graph) for more details on the dataflow graph.

${prefixLines(details('Example: Generating a dataflow graph with flowR', `
You can investigate flowR's analyses using the [REPL](${FlowrWikiBaseRef}/Interface#using-the-repl).
Commands like ${getReplCommand('dataflow*')} allow you to view a dataflow graph for a given R script.

Let's have a look at the following example:

${codeBlock('r', getFileContentFromRoot('test/testfiles/example.R'))}

To get the dataflow graph for this script, you can use the following command:

${await documentReplSession(shell, [{
	command:     ':dataflow* test/testfiles/example.R',
	description: `
Following the link output should show the following:
${await printDfGraphForCode(shell, getFileContentFromRoot('test/testfiles/example.R'), { showCode: false })}`
}])}
   
   `), '    ')}

If you want to use flowR and the features it provides, feel free to check out the:

- [Visual Studio Code extension](${FlowrVsCode}): provides access to flowR directly in VS Code (or [vscode.dev](https://vscode.dev/))
- [RStudio Addin](${FlowrGithubBaseRef}/rstudio-addin-flowr): integrates flowR into [RStudio](https://posit.co/downloads/)
- [R package](${FlowrGithubBaseRef}/flowr-r-adapter): use flowR in your R scripts
- [Docker image](${FlowrDockerRef}): run flowR in a container, this also includes [flowR's server](${FlowrWikiBaseRef}/Interface#communicating-with-the-server)
- [NPM package](${FlowrNpmRef}): include flowR in your TypeScript and JavaScript projects
 
## ⭐ Getting Started

To get started with _flowR_ and its features, please check out the [Overview](${FlowrGithubBaseRef}/flowr/wiki/Overview) wiki page. 
The [Setup](${FlowrGithubBaseRef}/flowr/wiki/Setup) wiki page explains how you can download and setup _flowR_ on your system. 
With docker&nbsp;🐳️, the following line should be enough (and drop you directly into the read-eval-print loop):

${codeBlock('shell', 'docker run -it --rm eagleoutice/flowr')}

You can enter ${getReplCommand('help')} to gain more information on its capabilities.

<details>

<summary>Example REPL session</summary>

![Example of a simple REPL session](wiki/gif/repl-demo.gif)

</details>

## 📜 More Information

For more details on how to use _flowR_ please refer to the [wiki pages](${FlowrGithubBaseRef}/flowr/wiki),
as well as the deployed [code documentation](https://flowr-analysis.github.io/flowr/doc/).

## 🚀 Contributing

We welcome every contribution! Please check out the [contributing guidelines](${FlowrGithubBaseRef}/flowr/tree/main/.github/CONTRIBUTING.md) for more information.

### Contributors

<a href="https://github.com/flowr-analysis/flowr/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=flowr-analysis/flowr"  alt="flowR Contributors"/>
</a>

----

*flowr* is actively developed by [Florian Sihler](https://eagleoutice.github.io/portfolio/) under the
[GPLv3 License](LICENSE).\\
It is partially supported by the German Research Foundation (DFG) under the grant [504226141](https://gepris.dfg.de/gepris/projekt/504226141) ("CodeInspector").

----

### Generation Notice

Please notice that this file was generated automatically using the file ${fileNameForGenHeader(module.filename)} as a source.\\
If you want to make changes please edit the source file (the CI will take care of the rest).
In fact, many files in the [wiki](${FlowrWikiBaseRef}) are generated, so make sure to check for the source file if you want to make changes.

`.trim();
}


/** if we run this script, we want a Markdown representation of the capabilities */
if(require.main === module) {
	void TreeSitterExecutor.initTreeSitter().then(() => {
		setMinLevelOfAllLogs(LogLevel.Fatal);

		const shell = new RShell();
		void getText(shell).then(str => {
			console.log(str);
		}).finally(() => {
			shell.close();
		});
	});
}
