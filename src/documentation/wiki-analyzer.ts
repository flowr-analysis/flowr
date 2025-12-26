import { FlowrAnalyzer } from '../project/flowr-analyzer';
import { FlowrAnalyzerBuilder } from '../project/flowr-analyzer-builder';
import { block, collapsibleToc, section } from './doc-util/doc-structure';
import { FlowrGithubBaseRef, FlowrGithubGroupName, FlowrWikiBaseRef } from './doc-util/doc-files';
import { FlowrAnalyzerQmdFilePlugin } from '../project/plugins/file-plugins/notebooks/flowr-analyzer-qmd-file-plugin';
import { BuiltInPlugins, makePlugin, registerPluginMaker } from '../project/plugins/plugin-registry';
import { codeInline } from './doc-util/doc-code';
import {
	FlowrAnalyzerProjectDiscoveryPlugin
} from '../project/plugins/project-discovery/flowr-analyzer-project-discovery-plugin';
import {
	FlowrAnalyzerDescriptionFilePlugin
} from '../project/plugins/file-plugins/flowr-analyzer-description-file-plugin';
import {
	FlowrAnalyzerPackageVersionsDescriptionFilePlugin
} from '../project/plugins/package-version-plugins/flowr-analyzer-package-versions-description-file-plugin';
import {
	FlowrAnalyzerLoadingOrderDescriptionFilePlugin
} from '../project/plugins/loading-order-plugins/flowr-analyzer-loading-order-description-file-plugin';
import { FlowrAnalyzerFilePlugin } from '../project/plugins/file-plugins/flowr-analyzer-file-plugin';
import {
	FlowrAnalyzerPackageVersionsPlugin
} from '../project/plugins/package-version-plugins/flowr-analyzer-package-versions-plugin';
import {
	FlowrAnalyzerLoadingOrderPlugin
} from '../project/plugins/loading-order-plugins/flowr-analyzer-loading-order-plugin';
import { contextFromInput, contextFromSources, FlowrAnalyzerContext } from '../project/context/flowr-analyzer-context';
import { requestFromInput } from '../r-bridge/retriever';
import { FlowrAnalyzerFilesContext } from '../project/context/flowr-analyzer-files-context';
import { FlowrAnalyzerLoadingOrderContext } from '../project/context/flowr-analyzer-loading-order-context';
import { FlowrAnalyzerDependenciesContext } from '../project/context/flowr-analyzer-dependencies-context';
import { FlowrAnalyzerCache } from '../project/cache/flowr-analyzer-cache';
import { PipelineExecutor } from '../core/pipeline-executor';
import { FlowrAnalyzerPluginDefaults } from '../project/plugins/flowr-analyzer-plugin-defaults';
import type { DocMakerArgs } from './wiki-mk/doc-maker';
import { DocMaker } from './wiki-mk/doc-maker';
import { FlowrAnalyzerRmdFilePlugin } from '../project/plugins/file-plugins/notebooks/flowr-analyzer-rmd-file-plugin';
import { FlowrAnalyzerPlugin } from '../project/plugins/flowr-analyzer-plugin';
import { FlowrAnalyzerEnvironmentContext } from '../project/context/flowr-analyzer-environment-context';
import { FlowrAnalyzerFunctionsContext } from '../project/context/flowr-analyzer-functions-context';

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

/**
 * https://github.com/flowr-analysis/flowr/wiki/Analyzer
 */
export class WikiAnalyzer extends DocMaker<'wiki/Analyzer.md'> {
	constructor() {
		super('wiki/Analyzer.md', module.filename, 'analyzer');
	}

	public text({ ctx }: DocMakerArgs): string {
		return `
${
	collapsibleToc({
		'Overview': {
			'Overview of the Analyzer': undefined,
			'Conducting Analyses':      undefined
		},
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
			'How to add a new plugin': undefined,
		},
		'Context Information': {
			'Files Context':         undefined,
			'Loading Order Context': undefined,
			'Dependencies Context':  undefined,
			'Environment Context':   undefined
		},
		'Caching': undefined
	})
}


${section('Overview', 2)}

No matter whether you want to analyze a single R script, a couple of R notebooks, a complete project, or an R package,
your journey starts with the ${ctx.link(FlowrAnalyzerBuilder)} (further described in [Builder Configuration](#builder-configuration) below).
This builder allows you to configure the analysis in many different ways, for example, by specifying which [plugins](#Plugins) to use or
what [engine](${FlowrWikiBaseRef}/Engines) to use for the analysis.

When building the ${ctx.link(FlowrAnalyzer)} instance, the builder will take care to

* load the [requested plugins](#Plugins)
* setup an initial [context](#Context_Information)
* create a [cache](#Caching) for speeding up future analyses
* initialize the [engine](${FlowrWikiBaseRef}/Engines) (e.g., TreeSitter) if needed

The builder provides two methods for building the analyzer:

* ${ctx.linkM(FlowrAnalyzerBuilder, 'build')}\\
	for an asynchronous build process that also initializes the engine if needed
* ${ctx.linkM(FlowrAnalyzerBuilder, 'buildSync')}\\
	for a synchronous build process,
	which requires that the engine (e.g., TreeSitter) has already been initialized before calling this method.
	Yet, as Engines only have to be initialized once per process, this method is often more convenient to use.

	For more information on how to configure the builder, please refer to the [Builder Configuration](#builder-configuration) section below.

	${section('Overview of the Analyzer', 3)}

Once you have created an analyzer instance, you can add R files, folders, or even entire projects for analysis using the
${ctx.linkM(FlowrAnalyzer, 'addRequest')} method.
All loaded [plugins](#Plugins) will be applied fully automatically during the analysis.
Please note that adding new files _after_ you already requested analysis results may cause bigger invalidations and cause re-analysis of previously analyzed files.
With the [files context](#Files_Context), you can also add virtual files to the analysis to consider, or *overwrite* existing files with modified content.
For this, have a look at the
${ctx.linkM(FlowrAnalyzer, 'addFile')} method.

	${block({
		type:    'NOTE',
		content: `If you want to quickly try out the analyzer, you can use the following code snippet that analyzes a simple R expression:

${ctx.code(analyzerQuickExample, { dropLinesStart: 1, dropLinesEnd: 2, hideDefinedAt: true })}
`
	})}

To reset the analysis (e.g., to provide new requests) you can use ${ctx.linkM(FlowrAnalyzer, 'reset')}.
If you need to pre-compute analysis results (e.g., to speed up future queries), you can use ${ctx.linkM(FlowrAnalyzer, 'runFull')}.

${section('Conducting Analyses', 3)}

Please make sure to add all of the files, folder, and projects you want to analyze using the
${ctx.linkM(FlowrAnalyzer, 'addRequest')} method (or ${ctx.linkM(FlowrAnalyzer, 'addFile')} for virtual files).
Afterwards, you can request different kinds of analysis results, such as:

* ${ctx.linkM(FlowrAnalyzer, 'parse')} to get the parsed information by the respective [engine](${FlowrWikiBaseRef}/Engines)\\
You can also use ${ctx.linkM(FlowrAnalyzer, 'peekParse', { codeFont: true, realNameWrapper: 'i' })} to inspect the parse information if it was already computed (but without triggering a computation).
With ${ctx.linkM(FlowrAnalyzer, 'parserInformation', { codeFont: true, realNameWrapper: 'i' })}, you get additional information on the parser used for the analysis.
* ${ctx.linkM(FlowrAnalyzer, 'normalize')} to compute the [Normalized AST](${FlowrWikiBaseRef}/Normalized%20AST)\\
Likewise, ${ctx.linkM(FlowrAnalyzer, 'peekNormalize', { codeFont: true, realNameWrapper: 'i' })} returns the normalized AST if it was already computed but without triggering a computation.
* ${ctx.linkM(FlowrAnalyzer, 'dataflow')} to compute the [Dataflow Graph](${FlowrWikiBaseRef}/Dataflow%20Graph)\\
Again, ${ctx.linkM(FlowrAnalyzer, 'peekDataflow', { codeFont: true, realNameWrapper: 'i' })} allows you to inspect the dataflow graph if it was already computed (but without triggering a computation).
* ${ctx.linkM(FlowrAnalyzer, 'controlflow')} to compute the [Control Flow Graph](${FlowrWikiBaseRef}/Control%20Flow%20Graph)\\
Also, ${ctx.linkM(FlowrAnalyzer, 'peekControlflow', { codeFont: true, realNameWrapper: 'i' })} returns the control flow graph if it was already computed but without triggering a computation.
* ${ctx.linkM(FlowrAnalyzer, 'query')} to run [queries](${FlowrWikiBaseRef}/Query-API) on the analyzed code.
* ${ctx.linkM(FlowrAnalyzer, 'runSearch')} to run a search query on the analyzed code using the [search API](${FlowrWikiBaseRef}/Search%20API)

We work on providing a set of example repositories that demonstrate how to use the analyzer in different scenarios:

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
embedded in the interface ${ctx.link('FlowrConfigOptions')}.
With the builder you can either provide a complete configuration or amend the default configuration using:

* ${ctx.linkM(FlowrAnalyzerBuilder, 'setConfig')} to set a complete configuration
* ${ctx.linkM(FlowrAnalyzerBuilder, 'amendConfig')} to amend the default configuration

By default, the builder uses flowR's standard configuration obtained with ${ctx.link('defaultConfigOptions')}.

${block({
	type:    'NOTE',
	content: `During the analysis with the ${ctx.link(FlowrAnalyzer.name)}, you can also access the configuration with
		 the ${ctx.link(FlowrAnalyzerContext)}.`
})}

${section('Configuring the Engine', 3)}

FlowR supports multiple [engines](${FlowrWikiBaseRef}/Engines) for parsing and analyzing R code.
With the builder, you can select the engine to use with:

* ${ctx.linkM(FlowrAnalyzerBuilder, 'setEngine')} to set the desired engine.
* ${ctx.linkM(FlowrAnalyzerBuilder, 'setParser')} to set a specific parser implementation.

By default, the builder uses the TreeSitter engine with the TreeSitter parser.
The builder also takes care to initialize the engine if needed during the asynchronous build process
with ${ctx.linkM(FlowrAnalyzerBuilder, 'build')}.
If you want to use the synchronous build process with ${ctx.linkM(FlowrAnalyzerBuilder, 'buildSync')},
please ensure that the engine has already been initialized before calling this method.

${section('Configuring Plugins', 3)}

There are various ways for you to register plugins with the builder, exemplified by the following snippet
relying on the ${ctx.linkM(FlowrAnalyzerBuilder, 'registerPlugins')} method:

${ctx.code(analyzerQuickExampleToRegisterPlugins, { dropLinesStart: 1, dropLinesEnd: 2, hideDefinedAt: true })}

This indicates three ways to add a new plugin:

1. By using a predefined name (e.g., \`file:description\` for the ${ctx.link(FlowrAnalyzerDescriptionFilePlugin)})\\
   These mappings are controlled by the ${ctx.link(registerPluginMaker)} function in the ${ctx.link('PluginRegistry')}.
   Under the hood, this relies on ${ctx.link(makePlugin)} to create the plugin instance from the name.
2. By providing an already instantiated plugin (e.g., the new ${ctx.link(FlowrAnalyzerQmdFilePlugin)} instance).\\
   You can pass these by reference, instantiating any class that conforms to the [plugin specification](#Plugins).
3. By providing a tuple of the plugin name and its constructor arguments (e.g., \`['file:rmd', [/.*.rmd/i]]\` for the ${ctx.link(FlowrAnalyzerRmdFilePlugin)}).\\
   This will also use the ${ctx.link(makePlugin)} function under the hood to create the plugin instance.

Please note, that by passing \`false\` to the builder constructor, no default plugins (see ${ctx.link(FlowrAnalyzerPluginDefaults)}) are registered (otherwise, all of the plugins in the example above would be registered by default).
If you want to unregister specific plugins, you can use the ${ctx.linkM(FlowrAnalyzerBuilder, 'unregisterPlugins')} method.

${
	block({
		type:    'NOTE',
		content: `
If you directly access the API, please prefer creating the objects yourself by instantiating the respective classes instead of relying on the plugin registry.
This avoids the indirection *and* potential issues with naming collisions in the registry.
Moreover, this allows you to directly provide custom configuration to the plugin constructors in a readable fashion,
*and* to re-use plugin instances.
Instantiation by text is mostly for serialized communications (e.g., via a CLI or config format).
`.trim()
	})
}

For more information on the different plugin types and how to create new plugins, please refer to the [Plugins](#Plugins) section below.

${section('Builder Reference', 3)}

The builder provides a plethora of methods to configure the resulting analyzer instance:

${
	Object.getOwnPropertyNames(FlowrAnalyzerBuilder.prototype).filter(c => c !== 'constructor' && !c.startsWith('build')).sort().map(
		key => `- ${ctx.link( `${FlowrAnalyzerBuilder.name}::${key}`)}\\\n${ctx.doc(`${FlowrAnalyzerBuilder.name}::${key}`)}`
	).join('\n')
}

To build the analyzer after you have configured the builder, you can use one of the following:

${
	Object.getOwnPropertyNames(FlowrAnalyzerBuilder.prototype).filter(c => c.startsWith('build')).sort().map(
		key => `- ${ctx.link( `${FlowrAnalyzerBuilder.name}::${key}`)}\\\n${ctx.doc(`${FlowrAnalyzerBuilder.name}::${key}`)}`
	).join('\n')
}

${section('Plugins', 2)}

Plugins allow you to extend the capabilities of the analyzer in many different ways.
For example, they can be used to support other file formats, or to provide new algorithms to determine the loading order of files in a project.
All plugins have to extend the ${ctx.link(FlowrAnalyzerPlugin)} base class and specify their ${ctx.link('PluginType')}.
During the analysis, the analyzer will apply all registered plugins of the different types at the appropriate stages of the analysis.
If you just want to _use_ these plugins, you can usually ignore their [type](#plugin-types) and just register them with the builder as described 
in the [Builder Configuration](#builder-configuration) section above.
However, if you want to _create_ new plugins, you should be aware of the different plugin types and when they are applied during the analysis.

Currently, flowR supports the following plugin types built-in:

| Name | Class | Type | Description |
|------|-------|------|-------------|
${
	BuiltInPlugins.sort(([a,], [b]) => a.localeCompare(b)).map(
		([key, value]) => `| ${codeInline(key)} | ${ctx.link( `${value.name}`)} |  ${new value().type} | ${ctx.doc(`${value.name}`).replaceAll('|', '&#124;').replaceAll('\n', ' ')} |`
	).join('\n')
}


${section('Plugin Types', 3)}

During the construction of a new ${ctx.link(FlowrAnalyzer)}, plugins of different types are applied at different stages of the analysis.
These plugins are grouped by their ${ctx.link('PluginType')} and are applied in the following order (as shown in the documentation of the ${ctx.link('PluginType')}):

${(() => {
	const doc = ctx.doc('PluginType');
	// skip until the first ```text
	const lines = doc.split('\n');
	const start = lines.findIndex(l => l.trim().startsWith('```text'));
	const end = lines.findIndex((l, i) => i > start && l.trim().startsWith('```'));
	// github rendering pls fix xD
	return start >= 0 && end > start ? '```text\n' + lines.slice(start + 1, end).join('\n').replaceAll('▶', '>') + '\n```' : doc;
})()}

Please note, that every plugin type has a default implementation (e.g., see ${ctx.link(FlowrAnalyzerProjectDiscoveryPlugin.defaultPlugin.name)})
that is always active.
We describe the different plugin types in more detail below.

${section('Project Discovery', 4)}

These plugins trigger when confronted with a project analysis request (see, ${ctx.link('RProjectAnalysisRequest')}).
Their job is to identify the files that belong to the project and add them to the analysis.
flowR provides the ${ctx.link(FlowrAnalyzerProjectDiscoveryPlugin)} with a 
${ctx.link(FlowrAnalyzerProjectDiscoveryPlugin.defaultPlugin.name)} as the default implementation that simply collects all R source files in the given folder.

Please note that all project discovery plugins should conform to the ${ctx.link(FlowrAnalyzerProjectDiscoveryPlugin)} base class.

${section('File Loading', 4)}

These plugins register for every file encountered by the [files context](#Files_Context) and determine whether and _how_ they can process the file.
They are responsible for transforming the raw file content into a representation that flowR can work with during the analysis.
For example, the ${ctx.link(FlowrAnalyzerDescriptionFilePlugin.name)} adds support for R \`DESCRIPTION\` files by parsing their content into key-value pairs.
These can then be used by other plugins, e.g. the ${ctx.link(FlowrAnalyzerPackageVersionsDescriptionFilePlugin)} that extracts package version information from these files.

If multiple file plugins could apply (${ctx.link('DefaultFlowrAnalyzerFilePlugin::' + FlowrAnalyzerFilePlugin.defaultPlugin().applies.name)}) to the same file,
the loading order of these plugins determines which plugin gets to process the file.
Please ensure that no two file plugins _apply_ to the same file,
as this could lead to unexpected behavior.
Also, make sure that all file plugins conform to the ${ctx.link(FlowrAnalyzerFilePlugin)} base class.

${section('Dependency Identification', 4)}

These plugins should identify which R packages are required with which versions for the analysis.
This information is then used to setup the R environment for the analysis correctly.
For example, the ${ctx.link(FlowrAnalyzerPackageVersionsDescriptionFilePlugin)} extracts package version information from \`DESCRIPTION\` files
to identify the required packages and their versions.

All dependency identification plugins should conform to the ${ctx.link(FlowrAnalyzerPackageVersionsPlugin)} base class.

${section('Loading Order', 4)}

These plugins determine the order in which files are loaded and analyzed.
This is crucial for correctly understanding the dependencies between files and improved analyses, especially in larger projects.
For example, the ${ctx.link(FlowrAnalyzerLoadingOrderDescriptionFilePlugin)} provides a basic implementation that orders files based on
the specification in a \`DESCRIPTION\` file, if present.

All loading order plugins should conform to the ${ctx.link(FlowrAnalyzerLoadingOrderPlugin)} base class.

${section('How to add a new plugin', 3)}

If you want to make a new plugin you first have to decide which type of plugin you want to create (see [Plugin Types](#plugin-types) above).
Then, you must create a new class that extends the corresponding base class (e.g., ${ctx.link(FlowrAnalyzerFilePlugin)} for file loading plugins).
In general, most plugins operate on the [context information](#Context_Information) provided by the analyzer.
Usually it is a good idea to have a look at the existing plugins of the same type to get an idea of how to implement your own plugin.

Once you have your plugin you should register it with a sensible name using the ${ctx.link(registerPluginMaker)} function.
This will allow users to register your plugin easily by name using the builder's ${ctx.linkM(FlowrAnalyzerBuilder, 'registerPlugins')} method.
Otherwise, users will have to provide an instance of your plugin class directly.

${section('Context Information', 2)}

The ${ctx.link(FlowrAnalyzer)} provides various context information during the analysis.
You can access the context with ${ctx.linkM(FlowrAnalyzer, 'inspectContext')}
to receive a read-only view of the current analysis context.
Likewise, you can use ${ctx.linkM(FlowrAnalyzerContext, 'inspect')} to get a read-only view of a given context.
These read-only views prevent you from accidentally modifying the context during the analysis which may cause inconsistencies (this should be done either by
wrapping methods or by [plugins](#Plugins)).
The context is divided into multiple sub-contexts, each responsible for a specific aspect of the analysis.
These sub-contexts are described in more detail below.

For the general structure from an implementation perspective, please have a look at ${ctx.link(FlowrAnalyzerContext)}.
${
	block({
		type:    'TIP',
		content: `
If you need a context for testing or to create analyses with lower-level components, you can use
either ${ctx.link(contextFromInput)} to create a context from input data (which lifts the old ${ctx.link(requestFromInput)}) or
${ctx.link(contextFromSources)} to create a context from source files (e.g., if you need a virtual file system).
`.trim()
	})
}

If for whatever reason you need to reset the context during an analysis, you can use
${ctx.linkM(FlowrAnalyzerContext, 'reset')}.
To pre-compute all possible information in the context before starting the main analysis, you can use
${ctx.linkM(FlowrAnalyzerContext, 'resolvePreAnalysis')}.

${section('Files Context', 3)}

First, let's have look at the ${ctx.link(FlowrAnalyzerFilesContext)}  class that provides access to the files to be analyzed and their [loading order](#Loading_Order_Context):

${ctx.hierarchy(FlowrAnalyzerFilesContext, { showImplSnippet: false })}

Using the available [plugins](#Plugins),
the files context categorizes files by their ${ctx.link('FileRole')} (e.g., source files or DESCRIPTION files)
and makes them accessible by these roles (e.g., via ${ctx.linkM(FlowrAnalyzerFilesContext, 'getFilesByRole', { codeFont: true, realNameWrapper: 'i' })}).
It also provides methods to check for whether a file exists (e.g., ${ctx.linkM(FlowrAnalyzerFilesContext, 'hasFile', { codeFont: true, realNameWrapper: 'i' })},
${ctx.linkM(FlowrAnalyzerFilesContext, 'exists', { codeFont: true, realNameWrapper: 'i' })})
and to translate requests so they respect the context (e.g., ${ctx.linkM(FlowrAnalyzerFilesContext, 'resolveRequest', { codeFont: true, realNameWrapper: 'i' })}).

For legacy reasons it also provides the list of files considered by the dataflow analysis via
${ctx.linkM(FlowrAnalyzerFilesContext, 'consideredFilesList', { codeFont: true, realNameWrapper: 'i' })}.

${section('Loading Order Context', 3)}

${
	block({
		type:    'NOTE',
		content: `
Please be aware that the loading order is inherently tied to the files context (as it determines which files are available for ordering).
Hence, the ${ctx.link(FlowrAnalyzerLoadingOrderContext)} is accessible (only) via the ${ctx.link(FlowrAnalyzerFilesContext)}.
`.trim()
	})
}

Here is the structure of the ${ctx.link(FlowrAnalyzerLoadingOrderContext)} that provides access to the identified loading order of files:

${ctx.hierarchy(FlowrAnalyzerLoadingOrderContext, { showImplSnippet: false })}

Using the available [plugins](#Plugins), the loading order context determines the order in which files are loaded and analyzed by flowR's analyzer.
You can inspect the identified loading order using
${ctx.linkM(FlowrAnalyzerLoadingOrderContext, 'getLoadingOrder', { codeFont: true, realNameWrapper: 'i' })}.
If there are multiple possible loading orders (e.g., due to circular dependencies),
you can use ${ctx.linkM(FlowrAnalyzerLoadingOrderContext, 'currentGuesses', { codeFont: true, realNameWrapper: 'i' })}.

${section('Dependencies Context', 3)}

Here is the structure of the ${ctx.link(FlowrAnalyzerDependenciesContext)} that provides access to the identified dependencies and their versions,
including the version of R:

${ctx.hierarchy(FlowrAnalyzerDependenciesContext, { showImplSnippet: false })}

Probably the most important method is
${ctx.linkM(FlowrAnalyzerDependenciesContext, 'getDependency', { codeFont: true, realNameWrapper: 'i' })}
that allows you to query for a specific dependency by name.

${section('Functions Context', 3)}

The ${ctx.link(FlowrAnalyzerDependenciesContext)} also provides access to the associated
${ctx.link(FlowrAnalyzerFunctionsContext)} via its \`functionsContext\` attribute.

${ctx.hierarchy(FlowrAnalyzerFunctionsContext, { showImplSnippet: false })}

Probably the most important method is
${ctx.linkM(FlowrAnalyzerFunctionsContext, 'getFunctionInfo', { codeFont: true, realNameWrapper: 'i' })}
that allows you to query for a specific function by name.

${section('Environment Context', 3)}

Here is the structure of the ${ctx.link(FlowrAnalyzerEnvironmentContext)} that provides access to the built-in environment:

${ctx.hierarchy(FlowrAnalyzerEnvironmentContext, { showImplSnippet: false })}

The environment context provides access to the built-in environment via
${ctx.linkM(FlowrAnalyzerEnvironmentContext, 'makeCleanEnv', { codeFont: true, realNameWrapper: 'i' })}.
It also provides the empty built-in environment, which only contains primitives, via
${ctx.linkM(FlowrAnalyzerEnvironmentContext, 'makeCleanEnvWithEmptyBuiltIns', { codeFont: true, realNameWrapper: 'i' })}.

${section('Caching', 2)}

To speed up analyses, flowR provides a caching mechanism that stores intermediate results of the analysis.
The cache is maintained by the ${ctx.link(FlowrAnalyzerCache)} class and is used automatically by the analyzer during the analysis.
Underlying, it relies on the ${ctx.link(PipelineExecutor)} to cache results of different pipeline stages.

Usually, you do not have to worry about the cache, as it is managed automatically by the analyzer.
If you want to overwrite cache information, the analysis methods in ${ctx.link(FlowrAnalyzer)} (see [Conducting Analyses](#conducting-analyses) above)
usually provide an optional \`force\` parameter to control whether to use the cache or recompute the results.
`;
	}
}
