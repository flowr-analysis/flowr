import { RShell } from '../r-bridge/shell';
import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { getTypesFromFolderAsMermaid, mermaidHide } from './doc-util/doc-types';
import path from 'path';

import { TreeSitterExecutor } from '../r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { FlowrDockerRef, FlowrGithubBaseRef, FlowrNpmRef, FlowrVsCode, FlowrWikiBaseRef } from './doc-util/doc-files';
import { codeBlock } from './doc-util/doc-code';
import { getReplCommand } from './doc-util/doc-cli-option';

async function getText(shell: RShell) {
	const rversion = (await shell.usedRVersion())?.format() ?? 'unknown';
	const sampleCode = 'x <- 1; print(x)';
	const { info, program } = getTypesFromFolderAsMermaid({
		rootFolder:  path.resolve('./src'),
		typeName:    RShell.name,
		inlineTypes: mermaidHide
	});

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
 
* [program slicing](${FlowrGithubBaseRef}/flowr/wiki/Terminology#program-slice) over [code search](${FlowrWikiBaseRef}/Search-API) to [dependency analysis](${FlowrWikiBaseRef}/Query-API#dependencies-query).

If you want to use flowR, feel free to check out the:
- [Visual Studio Code extension](${FlowrVsCode})\\
  _provides access to flowR's capabilities directly in VS Code (also works in [vscode.dev](https://vscode.dev/))_
- [RStudio Addin](${FlowrGithubBaseRef}/rstudio-addin-flowr)\\
  _integrates flowR into [RStudio](https://posit.co/downloads/)_
- [R package](${FlowrGithubBaseRef}/flowr-r-adapter)\\
  _allows you to use flowR in your R scripts_
- [Docker image](${FlowrDockerRef})\\
   _run flowR in a container, this also includes [flowR's server](${FlowrWikiBaseRef}/Interface#communicating-with-the-server)_
- [NPM package](${FlowrNpmRef})\\
   _include flowR in your TypeScript and JavaScript projects (e.g., used for the VS Code extension)_
 
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
