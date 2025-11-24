import {
	FlowrDockerRef,
	FlowrGithubBaseRef,
	FlowrNpmRef, FlowrPositron,
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
import { showQuery } from './doc-util/doc-query';
import { NewIssueUrl } from './doc-util/doc-issue';
import { joinWithLast } from '../util/text/strings';
import type { DocMakerArgs } from './wiki-mk/doc-maker';
import { DocMaker } from './wiki-mk/doc-maker';

const PublicationsMain: { header: string, description: string, doi: string, bibtex: string }[] = [
	{
		header:      'Statically Analyzing the Dataflow of R Programs (OOPSLA \'25)',
		description: 'Please cite this paper if you are using flowR in your research.',
		doi:         'https://doi.org/10.1145/3763087',
		bibtex:      `@article{10.1145/3763087,
	author = {Sihler, Florian and Tichy, Matthias},
	title = {Statically Analyzing the Dataflow of R Programs},
	year = {2025},
	issue_date = {October 2025},
	publisher = {Association for Computing Machinery},
	address = {New York, NY, USA},
	volume = {9},
	number = {OOPSLA2},
	url = {https://doi.org/10.1145/3763087},
	doi = {10.1145/3763087},
	abstract = {The R programming language is primarily designed for statistical computing and mostly used by researchers without a background in computer science. R provides a wide range of dynamic features and peculiarities that are difficult to analyze statically like dynamic scoping and lazy evaluation with dynamic side effects. At the same time, the R ecosystem lacks sophisticated analysis tools that support researchers in understanding and improving their code.   In this paper, we present a novel static dataflow analysis framework for the R programming language that is capable of handling the dynamic nature of R programs and produces the dataflow graph of given R programs. This graph can be essential in a range of analyses, including program slicing, which we implement as a proof of concept. The core analysis works as a stateful fold over a normalized version of the abstract syntax tree of the R program, which tracks (re-)definitions, values, function calls, side effects, external files, and a dynamic control flow to produce one dataflow graph per program.   We evaluate the correctness of our analysis using output equivalence testing on a manually curated dataset of 779 sensible slicing points from executable real-world R scripts. Additionally, we use a set of systematic test cases based on the capabilities of the R language and the implementation of the R interpreter and measure the runtimes well as the memory consumption on a set of 4,230 real-world R scripts and 20,815 packages available on R’s package manager CRAN.   Furthermore, we evaluate the recall of our program slicer, its accuracy using shrinking, and its improvement over the state of the art. We correctly analyze almost all programs in our equivalence test suite, preserving the identical output for 99.7\\% of the manually curated slicing points. On average, we require 576ms to analyze the dataflow and around 213kB to store the graph of a research script.   This shows that our analysis is capable of analyzing real-world sources quickly and correctly. Our slicer achieves an average reduction of 84.8\\% of tokens indicating its potential to improve program comprehension.},
	journal = {Proc. ACM Program. Lang.},
	month = oct,
	articleno = {309},
	numpages = {29},
	keywords = {Dataflow Analysis, R Programming Language, Static Analysis}
}`
	},
	{
		header:      'flowR: A Static Program Slicer for R (ASE \'24, Tool)',
		description: `This refers to the tool-demonstration of the <a href="${FlowrVsCode}">VS Code Extension</a>.`,
		doi:         'https://doi.org/10.1145/3691620.3695359',
		bibtex:      `@inproceedings{DBLP:conf/kbse/SihlerT24,
  author       = {Florian Sihler and
                  Matthias Tichy},
  editor       = {Vladimir Filkov and
                  Baishakhi Ray and
                  Minghui Zhou},
  title        = {flowR: {A} Static Program Slicer for {R}},
  booktitle    = {Proceedings of the 39th {IEEE/ACM} International Conference on Automated
                  Software Engineering, {ASE} 2024, Sacramento, CA, USA, October 27
                  - November 1, 2024},
  pages        = {2390--2393},
  publisher    = {{ACM}},
  year         = {2024},
  url          = {https://doi.org/10.1145/3691620.3695359},
  doi          = {10.1145/3691620.3695359},
  timestamp    = {Mon, 03 Mar 2025 21:16:51 +0100},
  biburl       = {https://dblp.org/rec/conf/kbse/SihlerT24.bib},
  bibsource    = {dblp computer science bibliography, https://dblp.org}
}`
	},
	{
		header:      'On the Anatomy of Real-World R Code for Static Analysis (MSR \'24)',
		description: 'This paper lays the foundation for flowR by analyzing the characteristics of real-world R code.',
		doi:         'https://doi.org/10.1145/3643991.3644911',
		bibtex:      `

@inproceedings{DBLP:conf/msr/SihlerPSTDD24,
  author       = {Florian Sihler and
                  Lukas Pietzschmann and
                  Raphael Straub and
                  Matthias Tichy and
                  Andor Diera and
                  Abdelhalim Hafedh Dahou},
  editor       = {Diomidis Spinellis and
                  Alberto Bacchelli and
                  Eleni Constantinou},
  title        = {On the Anatomy of Real-World {R} Code for Static Analysis},
  booktitle    = {21st {IEEE/ACM} International Conference on Mining Software Repositories,
                  {MSR} 2024, Lisbon, Portugal, April 15-16, 2024},
  pages        = {619--630},
  publisher    = {{ACM}},
  year         = {2024},
  url          = {https://doi.org/10.1145/3643991.3644911},
  doi          = {10.1145/3643991.3644911},
  timestamp    = {Sun, 19 Jan 2025 13:31:27 +0100},
  biburl       = {https://dblp.org/rec/conf/msr/SihlerPSTDD24.bib},
  bibsource    = {dblp computer science bibliography, https://dblp.org}
}`
	}
];

const OtherWorksUsingFlowr: { name: string, doi: string }[] = [
	{ name: 'Computational Reproducibility of R Code Supplements on OSF', doi: 'https://doi.org/10.36190/2025.49' },
	{ name: 'Multi-View Structural Graph Summaries', doi: 'https://doi.org/10.1109/WI-IAT62293.2024.00037' }
];

function printPublications() {
	return PublicationsMain.map(pub => {
		return `
* [${pub.header}](${pub.doi})  
  ${pub.description}
  <details><summary>BibTeX</summary>
  
${prefixLines(codeBlock('bibtex', pub.bibtex), '   ')}
  
  </details>
		`.trim();
	}).join('\n\n') + '\n\n Works using flowR include:\n' +
		joinWithLast(OtherWorksUsingFlowr.map(pub => `[${pub.name}](${pub.doi})`)) + '.\n';
}

/**
 * https://github.com/flowr-analysis/flowr/blob/main/README.md
 */
export class DocReadme extends DocMaker {
	constructor() {
		super('README.md', module.filename, 'flowR README', false);
	}

	public async text({ treeSitter }: DocMakerArgs): Promise<string> {
		const dateOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };

		return `
[![flowR logo](https://raw.githubusercontent.com/wiki/flowr-analysis/flowr/img/flowR.png)](${FlowrGithubBaseRef}/flowr/wiki)\\
[![QA (and potentially deploy)](${FlowrGithubBaseRef}/flowr/actions/workflows/qa.yaml/badge.svg)](${FlowrGithubBaseRef}/flowr/actions/workflows/qa.yaml)
[![codecov](https://codecov.io/gh/flowr-analysis/flowr/graph/badge.svg)](https://codecov.io/gh/flowr-analysis/flowr)
[![Docker Image Version (latest semver)](https://img.shields.io/docker/v/eagleoutice/flowr?logo=docker&logoColor=white&label=dockerhub)](${FlowrDockerRef})
[![latest tag](https://badgen.net/github/tag/flowr-analysis/flowr?label=latest&color=purple)](${FlowrGithubBaseRef}/flowr/releases/latest)
[![Marketplace](https://badgen.net/vs-marketplace/v/code-inspect.vscode-flowr)](${FlowrVsCode})
[![Marketplace](https://badgen.net/open-vsx/version/code-inspect/vscode-flowr?label=Positron/Open%20VSX)](${FlowrPositron})
[![DOI](https://zenodo.org/badge/624819038.svg)](https://zenodo.org/doi/10.5281/zenodo.13319290)

_flowR_ is a sophisticated, static [dataflow analyzer](https://en.wikipedia.org/wiki/Data-flow_analysis) for the [R programming language](https://www.r-project.org/),
available for [VSCode](${FlowrVsCode}), [Positron](${FlowrPositron}), [RStudio](${FlowrGithubBaseRef}/rstudio-addin-flowr),
and [Docker](${FlowrDockerRef}).
It offers a wide variety of features, for example:

* 🐞 **code linting**\\
   Analyze your R scripts for common issues and potential bugs (see the [wiki page](${FlowrGithubBaseRef}/flowr/wiki/Linter) for more information on the currently supported linters).

	${prefixLines(details('Example: Linting code with flowR', `To lint your code, you can use the [REPL](${FlowrWikiBaseRef}/Interface#using-the-repl) or the [Visual Studio Code extension](${FlowrVsCode}) (see [vscode-flowr#283](https://github.com/flowr-analysis/vscode-flowr/pull/283)).
	
${await(async() => {
	const code = 'read.csv("/root/x.txt")';
	const res = await showQuery(treeSitter, code, [{ type: 'linter' }], { showCode: false, collapseQuery: true, collapseResult: false });
	return await documentReplSession(treeSitter, [{
		command:     `:query @linter ${JSON.stringify(code)}`,
		description: `
The linter will analyze the code and return any issues found.
Formatted more nicely, this returns:

${res}
		`
	}]);
})()}
	   
	   `), '    ')}


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

${await documentReplSession(treeSitter, [{
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

${await documentReplSession(treeSitter, [{
	command:     ':dataflow* test/testfiles/example.R',
	description: `
Following the link output should show the following:
${await printDfGraphForCode(treeSitter, getFileContentFromRoot('test/testfiles/example.R'), { showCode: false })}`
}])}
   
   `), '    ')}

If you want to use flowR and the features it provides, feel free to check out the:

- [Visual Studio Code](${FlowrVsCode})/[Positron](${FlowrPositron}): provides access to flowR directly in VS Code and Positron (or [vscode.dev](https://vscode.dev/))
- [RStudio Addin](${FlowrGithubBaseRef}/rstudio-addin-flowr): integrates flowR into [RStudio](https://posit.co/downloads/)
- [R package](${FlowrGithubBaseRef}/flowr-r-adapter): use flowR in your R scripts
- [Docker image](${FlowrDockerRef}): run flowR in a container, this also includes [flowR's server](${FlowrWikiBaseRef}/Interface#communicating-with-the-server)
- [NPM package](${FlowrNpmRef}): include flowR in your TypeScript and JavaScript projects
 

If you are already using flowR and want to give feedback, please consider filling out our [feedback form](https://docs.google.com/forms/d/e/1FAIpQLScKFhgnh9LGVU7QzqLvFwZe1oiv_5jNhkIO-G-zND0ppqsMxQ/viewform).

 
## ⭐ Getting Started

To get started with _flowR_ and its features, please check out the [Overview](${FlowrGithubBaseRef}/flowr/wiki/Overview) wiki page. 
The [Setup](${FlowrGithubBaseRef}/flowr/wiki/Setup) wiki page explains how you can download and setup _flowR_ on your system. 
With docker&nbsp;🐳️, the following line should be enough (and drop you directly into the read-eval-print loop):

${codeBlock('shell', 'docker run -it --rm eagleoutice/flowr')}

You can enter ${getReplCommand('help')} to gain more information on its capabilities.

<details>

<summary>Example REPL session</summary>

![Example of a simple REPL session](wiki/gif/repl-demo-opt.gif)

If you want to use the same commands:

1. First this runs \`docker run -it --rm eagleoutice/flowr\` in a terminal to start the REPL.
2. In the REPL, it runs \`:slicer -c '11@prod' demo.R --diff\` to slice the example file \`demo.R\` for the print statement in line 11.
   Please note that the \`11\` refers to the 11th line number to slice for!

</details>

## 📜 More Information

For more details on how to use _flowR_ please refer to the [wiki pages](${FlowrGithubBaseRef}/flowr/wiki),
as well as the deployed [code documentation](https://flowr-analysis.github.io/flowr/doc/).

## 📃 Publications on flowR

If you are interested in the theoretical background of _flowR_,
please check out the following publications (if you find that a paper is missing here, please open [a new issue](${NewIssueUrl})):

${printPublications()}

## 🚀 Contributing

We welcome every contribution! Please check out the [developer onboarding](${FlowrWikiBaseRef}/Onboarding) section in the wiki for all the information you will need.

### Contributors

<a href="https://github.com/flowr-analysis/flowr/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=flowr-analysis/flowr"  alt="flowR Contributors"/>
</a>

----

*flowr* is actively developed by [Florian Sihler](https://eagleoutice.github.io/portfolio/) and (since October 1st 2025) [Oliver Gerstl](https://www.linkedin.com/in/oliver-gerstl) under the
[GPLv3 License](LICENSE).\\
It is partially supported by the German Research Foundation (DFG) under the grant [504226141](https://gepris.dfg.de/gepris/projekt/504226141) ("CodeInspector").

----

### Generation Notice

Please notice that this file was generated automatically using the file ${fileNameForGenHeader(module.filename)} as a source.\\
If you want to make changes please edit the source file (the CI will take care of the rest).
In fact, many files in the [wiki](${FlowrWikiBaseRef}) are generated, so make sure to check for the source file if you want to make changes.

`.trim();
	}
}
