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
import { FlowrAnalyzerQmdFilePlugin } from '../project/plugins/file-plugins/notebooks/flowr-analyzer-qmd-file-plugin';
import { makePlugin, registerPluginMaker } from '../project/plugins/plugin-registry';

async function analyzerQuickExample() {
	const analyzer = await new FlowrAnalyzerBuilder()
		.setEngine('tree-sitter')
		.build();
	// register a simple inline text-file for analysis
	analyzer.addRequest('x <- 1; print(x)');
	// get the dataflow
	const df = await analyzer.dataflow();
	// obtain the identified loading order
	console.log(analyzer.inspectContext().files.loadingOrder.getLoadingOrder());
	// run a dependency query
	const results = await analyzer.query([{ type: 'dependencies' }]);
	return { analyzer, df, results };
}

async function analyzerQuickExampleToRegisterPlugins() {
	const analyzer = await new FlowrAnalyzerBuilder(false)
		.registerPlugins(
			'file:description',
			new FlowrAnalyzerQmdFilePlugin(),
			['file:rmd', [/.*.rmd/i]]
		)
		.build();
	return analyzer;
}

async function getText(shell: RShell) {
	const rversion = (await shell.usedRVersion())?.format() ?? 'unknown';

	const types = getTypesFromFolder({
		rootFolder:  path.resolve('src/'),
		inlineTypes: mermaidHide
	});

	return `${autoGenHeader({ filename: module.filename, purpose: 'analyzer', rVersion: rversion })}

${
	block({
		type:    'NOTE',
		content: `
We are currently working on documenting the capabilities of the analyzer (with the plugins, their loading order, etc.). 
In general, the code documentation starting with the ${shortLink(FlowrAnalyzer.name, types.info)} and the ${shortLink(FlowrAnalyzerBuilder.name, types.info)}
should be the best starting point.`.trim()
	})
}

${
	collapsibleToc({
		'Overview':              undefined,
		'Builder Configuration': {
			'Configuring flowR':      undefined,
			'Configuring the Engine': undefined,
			'Configuring Plugins':    undefined,
			'Builder Reference':      undefined
		},
		'Plugins': {
			'Plugin Types': {
				'Dependency Identification': undefined,
				'Project Discovery':         undefined,
				'File Loading':              undefined,
				'Loading Order':             undefined
			},
			'How to add a new plugin':      undefined,
			'How to add a new plugin type': undefined
		},
		'Caching':             undefined,
		'Context Information': {
			'Files Context':         undefined,
			'Loading Order Context': undefined,
			'Dependencies Context':  undefined,
			'Environment Context':   undefined
		},
		'Analyzer Internals': undefined
	})
}


${section('Overview', 2)}

No matter whether you want to analyze a single R script, a couple of R notebooks, a complete project, or an R package,
your journey starts with the ${shortLink(FlowrAnalyzerBuilder.name, types.info)} (further described in [Builder Configuration](#builder-configuration) below).
This builder allows you to configure the analysis in many different ways, for example, by specifying which [plugins](#Plugins) to use or
what [engine](${FlowrWikiBaseRef}/Engines) to use for the analysis.

When building the ${shortLink(FlowrAnalyzer.name, types.info)} instance, the builder will take care to

* load the [requested plugins](#Plugins)
* setup an initial [context](#Context_Information) 
* create a [cache](#Caching) for speeding up future analyses
* initialize the [engine](${FlowrWikiBaseRef}/Engines) (e.g., TreeSitter) if needed

The builder provides two methods for building the analyzer:
* ${shortLink(FlowrAnalyzerBuilder.name + '::' + FlowrAnalyzerBuilder.prototype.build.name, types.info)}\\
  for an asynchronous build process that also initializes the engine if needed
* ${shortLink(FlowrAnalyzerBuilder.name + '::' + FlowrAnalyzerBuilder.prototype.buildSync.name, types.info)}\\
  for a synchronous build process,
  which requires that the engine (e.g., TreeSitter) has already been initialized before calling this method.
  Yet, as Engines only have to be initialized once per process, this method is often more convenient to use.

For more information on how to configure the builder, please refer to the [Builder Configuration](#builder-configuration) section below.

Once you have created an analyzer instance, you can add R files, folders, or even entire projects for analysis using the
${shortLink(FlowrAnalyzer.name + '::' + FlowrAnalyzer.prototype.addRequest.name, types.info)} method.
All loaded [plugins](#Plugins) will be applied fully automatically during the analysis.
Please note that adding new files _after_ you already requested analysis results may cause bigger invalidations and cause re-analysis of previously analyzed files.
With the [files context](#Files_Context), you can also add virtual files to the analysis to consider, or *overwrite* existing files with modified content.
For this, have a look at the
${shortLink(FlowrAnalyzer.name + '::' + FlowrAnalyzer.prototype.addFile.name, types.info)} method. 

${block({
	type:    'NOTE',
	content: `If you want to quickly try out the analyzer, you can use the following code snippet that analyzes a simple R expression:
	
${printCodeOfElement({ program: types.program, info: types.info, dropLinesStart: 1, dropLinesEnd: 2, hideDefinedAt: true }, analyzerQuickExample.name)}
		`
})} 

In general, we work on providing a set of example repositories that demonstrate how to use the analyzer in different scenarios:

* [${FlowrGithubGroupName}/sample-analyzer-project-query](${FlowrGithubBaseRef}/sample-analyzer-project-query) for an example project that runs queries on an R project
* [${FlowrGithubGroupName}/sample-analyzer-df-diff](${FlowrGithubBaseRef}/sample-analyzer-df-diff) for an example project that compares dataflows graphs

${section('Builder Configuration', 2)}

If you are interested in all available options, have a look at the [Builder Reference](#builder-reference) below.
The following sections highlight some of the most important configuration options:
1. How to [configure flowR](#configuring-flowr)
1. How to [configure the engine](#configuring-the-engine)
2. How to [register plugins](#configuring-plugins)

${section('Configuring flowR', 3)}

You can fundamentally change the behavior of flowR using the [config file](${FlowrWikiBaseRef}/Interface#configuring-flowr),
embedded in the interface ${shortLink('FlowrConfigOptions', types.info)}.
With the builder you can either provide a complete configuration or amend the default configuration using:

* ${shortLink(FlowrAnalyzerBuilder.name + '::' + FlowrAnalyzerBuilder.prototype.setConfig.name, types.info)} to set a complete configuration
* ${shortLink(FlowrAnalyzerBuilder.name + '::' + FlowrAnalyzerBuilder.prototype.amendConfig.name, types.info)} to amend the default configuration

By default, the builder uses flowR's standard configuration obtained with ${shortLink('defaultConfigOptions', types.info)}.

${section('Configuring the Engine', 3)}

FlowR supports multiple [engines](${FlowrWikiBaseRef}/Engines) for parsing and analyzing R code.
With the builder, you can select the engine to use with:

* ${shortLink(FlowrAnalyzerBuilder.name + '::' + FlowrAnalyzerBuilder.prototype.setEngine.name, types.info)} to set the desired engine.
* ${shortLink(FlowrAnalyzerBuilder.name + '::' + FlowrAnalyzerBuilder.prototype.setParser.name, types.info)} to set a specific parser implementation.

By default, the builder uses the TreeSitter engine with the TreeSitter parser.
The builder also takes care to initialize the engine if needed during the asynchronous build process
with ${shortLink(FlowrAnalyzerBuilder.name + '::' + FlowrAnalyzerBuilder.prototype.build.name, types.info)}.
If you want to use the synchronous build process with ${shortLink(FlowrAnalyzerBuilder.name + '::' + FlowrAnalyzerBuilder.prototype.buildSync.name, types.info)},
please ensure that the engine has already been initialized before calling this method.

${section('Configuring Plugins', 3)}

There are various ways for you to register plugins with the builder, exemplified by the following snippet
relying on the ${shortLink(FlowrAnalyzerBuilder.name + '::' + FlowrAnalyzerBuilder.prototype.registerPlugins.name, types.info)} method:

${printCodeOfElement({ program: types.program, info: types.info, dropLinesStart: 1, dropLinesEnd: 2, hideDefinedAt: true }, analyzerQuickExampleToRegisterPlugins.name)}

This indicates three ways to add a new plugin:

1. By using a predefined name (e.g., \`file:description\` for the ${shortLink('FlowrAnalyzerDescriptionFilePlugin', types.info)})\\
   These mappings are controlled by the ${shortLink(registerPluginMaker.name, types.info)} function in the ${shortLink('PluginRegistry', types.info)}.
   Under the hood, this relies on ${shortLink(makePlugin.name, types.info)} to create the plugin instance from the name.
2. By providing an already instantiated plugin (e.g., the new ${shortLink(FlowrAnalyzerQmdFilePlugin.name, types.info)} instance).\\
   You can pass these by reference, instantiating any class that conforms to the [plugin specification](#Plugins).
3. By providing a tuple of the plugin name and its constructor arguments (e.g., \`['file:rmd', [/.*.rmd/i]]\` for the ${shortLink('FlowrAnalyzerRmdFilePlugin', types.info)}).\\
   This will also use the ${shortLink(makePlugin.name, types.info)} function under the hood to create the plugin instance.

Please note, that by passing \`false\` to the builder constructor, no default plugins are registered (otherwise, all of the plugins in the example above would be registered by default).
If you want to unregister specific plugins, you can use the ${shortLink(FlowrAnalyzerBuilder.name + '::' + FlowrAnalyzerBuilder.prototype.unregisterPlugins.name, types.info)} method.

For more information on the different plugin types and how to create new plugins, please refer to the [Plugins](#Plugins) section below.

${section('Builder Reference', 3)}

The builder provides a plethora of methods to configure the resulting analyzer instance:

${
	Object.getOwnPropertyNames(FlowrAnalyzerBuilder.prototype).filter(c => c !== 'constructor' && !c.startsWith('build')).sort().map(
		key => `- ${shortLink( `${FlowrAnalyzerBuilder.name}::${key}`, types.info)}\\\n${getDocumentationForType(`${FlowrAnalyzerBuilder.name}::${key}`, types.info)}`
	).join('\n')
}

To build the analyzer after you have configured the builder, you can use one of the following:

${
	Object.getOwnPropertyNames(FlowrAnalyzerBuilder.prototype).filter(c => c.startsWith('build')).sort().map(
		key => `- ${shortLink( `${FlowrAnalyzerBuilder.name}::${key}`, types.info)}\\\n${getDocumentationForType(`${FlowrAnalyzerBuilder.name}::${key}`, types.info)}`
	).join('\n')
}

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

${section('Environment Context', 3)}


${section('Caching', 2)}


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
