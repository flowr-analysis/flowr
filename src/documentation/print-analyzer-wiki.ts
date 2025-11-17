import { RShell } from '../r-bridge/shell';
import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { autoGenHeader } from './doc-util/doc-auto-gen';
import {
	getDocumentationForType,
	getTypesFromFolder,
	mermaidHide,
	printCodeOfElement,
	shortLink
} from './doc-util/doc-types';
import path from 'path';
import { FlowrAnalyzer } from '../project/flowr-analyzer';
import { FlowrAnalyzerBuilder } from '../project/flowr-analyzer-builder';
import { block, collapsibleToc, section } from './doc-util/doc-structure';
import { FlowrGithubBaseRef, FlowrGithubGroupName, FlowrWikiBaseRef } from './doc-util/doc-files';

async function analyzerQuickExample() {
	const analyzer = await new FlowrAnalyzerBuilder()
		.setEngine('tree-sitter')
		.build();
	analyzer.addRequest('x <- 1; print(x)');
	// get the dataflow
	const df = await analyzer.dataflow();
	// obtain the identified loading order
	console.log(analyzer.inspectContext().files.loadingOrder.getLoadingOrder());
	// run a dependency query
	const results = await analyzer.query([{ type: 'dependencies' }]);
	return { analyzer, df, results };
}


async function getText(shell: RShell) {
	const rversion = (await shell.usedRVersion())?.format() ?? 'unknown';

	const types = getTypesFromFolder({
		rootFolder:  path.resolve('src/'),
		inlineTypes: mermaidHide
	});

	return `${autoGenHeader({ filename: module.filename, purpose: 'analyzer', rVersion: rversion })}

We are currently working on documenting the capabilities of the analyzer (with the plugins, their loading order, etc.). In general, the code documentation
starting with the ${shortLink(FlowrAnalyzer.name, types.info)} and the ${shortLink(FlowrAnalyzerBuilder.name, types.info)} 
should be the best starting point.

${
	collapsibleToc({
		'Overview':              undefined,
		'Builder Configuration': undefined,
		'Plugins':               {
			'Plugin Types': {
				'Dependency Identification': undefined,
				'Project Discovery':         undefined,
				'File Loading':              undefined,
				'Loading Order':             undefined
			},
			'How to add a new plugin':      undefined,
			'How to add a new plugin type': undefined
		},
		'Context Information': {
			'Files Context':         undefined,
			'Loading Order Context': undefined,
			'Dependencies Context':  undefined
		},
		'Analyzer Internals': undefined
	})
}


${section('Overview', 2)}

No matter whether you want to analyze a single R script, a couple of R notebooks, or a complete project,
your journey starts with the ${shortLink(FlowrAnalyzerBuilder.name, types.info)} (further described in [Builder Configuration](#builder-configuration) below).
This builder allows you to configure the analysis in many different ways, for example, by specifying which files to analyze, which plugins to use, or
what [Engine](${FlowrWikiBaseRef}/Engines) to use for the analysis.
 
${block({
	type:    'NOTE',
	content: `If you want to quickly try out the analyzer, you can use the following code snippet that analyzes a simple R expression:
	
${printCodeOfElement({ program: types.program, info: types.info, dropLinesStart: 1, dropLinesEnd: 2, hideDefinedAt: true }, analyzerQuickExample.name)}
		`
})} 

In general, we work on providing a set of example repositories that demonstrate how to use the analyzer in different scenarios:

* [${FlowrGithubGroupName}/sample-analyzer-project-query](${FlowrGithubBaseRef}/sample-analyzer-project-query) for an example project that runs queries on an R project

**TODO**: mention [Context](#Context_Information) 

${section('Builder Configuration', 2)}

**TODO** also explain buildSync and that TreeSitter has to be initialized for this 

${section('Plugins', 2)}

${section('Plugin Types', 3)}

During the construction of a new ${shortLink(FlowrAnalyzer.name, types.info)}, plugins of different types are applied at different stages of the analysis.
These plugins are grouped by their ${shortLink('PluginType', types.info)} and are applied in the following order (as shown in the documentation of the ${shortLink('PluginType', types.info)}):

${(() => {
	const doc = getDocumentationForType('PluginType', types.info);
	// skip until the first ```text
	const lines = doc.split('\n');
	const start = lines.findIndex(l => l.trim().startsWith('```text'));
	const end = lines.findIndex((l, i) => i > start && l.trim().startsWith('```'));
	// github rendering pls fix xD
	return start >= 0 && end > start ? '```text\n' + lines.slice(start + 1, end).join('\n').replaceAll('▶', '>') + '\n```' : doc;
})()}

We describe the different plugin types in more detail below.


${section('Project Discovery', 4)}

${section('File Loading', 4)}

${section('Dependency Identification', 4)}

${section('Loading Order', 4)}

${section('How to add a new plugin', 3)}

${section('How to add a new plugin type', 3)}

${section('Context Information', 2)}

${section('Files Context', 3)}

${section('Loading Order Context', 3)}

${section('Dependencies Context', 3)}

${section('Analyzer Internals', 2)}

`;
}

/** if we run this script, we want a Markdown representation of the capabilities */
if(require.main === module) {
	setMinLevelOfAllLogs(LogLevel.Fatal);

	const shell = new RShell();
	void getText(shell).then(str => {
		console.log(str);
	}).finally(() => {
		shell.close();
	});
}
