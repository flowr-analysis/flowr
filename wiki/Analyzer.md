_<span title="an overview of flowR's analyzer">Generated</span> from '[wiki-analyzer.ts](https://github.com/flowr-analysis/flowr/tree/main/src/documentation/wiki-analyzer.ts "src/documentation/wiki-analyzer.ts")' on 2026-08-29, 18:14:15 UTC (v2.15.8, R v4.6.1), please do not edit directly._


- [Overview](#Overview)
  - [Overview of the Analyzer](#Overview_of_the_Analyzer)  
  - [Conducting Analyses](#Conducting_Analyses)  
- [Builder Configuration](#Builder_Configuration)
  - [Configuring flowR](#Configuring_flowR)  
  - [Configuring the Engine](#Configuring_the_Engine)  
  - [Configuring Plugins](#Configuring_Plugins)  
  - [Builder Reference](#Builder_Reference)  
- [Plugins](#Plugins)
  - [Plugin Types](#Plugin_Types)  
    [Dependency Identification](#Dependency_Identification), [Project Discovery](#Project_Discovery), [File Loading](#File_Loading), and [Loading Order](#Loading_Order)
  - [How to add a new plugin](#How_to_add_a_new_plugin)  
- [Context Information](#Context_Information)
  - [Files Context](#Files_Context)  
  - [Loading Order Context](#Loading_Order_Context)  
  - [Dependencies Context](#Dependencies_Context)  
  - [Environment Context](#Environment_Context)  
  - [Meta Context](#Meta_Context)  
  - [Gas Context](#Gas_Context)  
  - [Incremental Analysis Context](#Incremental_Analysis_Context)  
- [Caching](#Caching)



<h2 id="Overview">Overview</h2>

No matter whether you want to analyze a single R script, a couple of R notebooks, a complete project, or an R package,
your journey starts with the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer-builder.ts#L37"><code><span title="Builder for the FlowrAnalyzer , use it to configure all analysis aspects before creating the analyzer instance with .build() or .buildSync() . You can add new files and folders to analyze using the .addRequest() method on the resulting analyzer.">FlowrAnalyzerBuilder</span></code></a> (further described in [Builder Configuration](#Builder_Configuration) below).
This builder allows you to configure the analysis in many different ways, for example, by specifying which [plugins](#Plugins) to use or
what [engine](https://github.com/flowr-analysis/flowr/wiki/Engines) to use for the analysis.

When building the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer.ts#L203"><code><span title="Central class for conducting analyses with FlowR. Use the FlowrAnalyzerBuilder to create a new instance. If you want the original pattern of creating a pipeline and running all steps, you can still do this with FlowrAnalyzer#runFull . To inspect the context of the analyzer, use FlowrAnalyzer#inspectContext (if you are a plugin and need to modify it, use FlowrAnalyzer#context instead).">FlowrAnalyzer</span></code></a> instance, the builder will take care to

* load the [requested plugins](#Plugins)
* setup an initial [context](#Context_Information)
* create a [cache](#Caching) for speeding up future analyses
* initialize the [engine](https://github.com/flowr-analysis/flowr/wiki/Engines) (e.g., TreeSitter) if needed

The builder provides two methods for building the analyzer:

* <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer-builder.ts#L181"><code><span title="Create the FlowrAnalyzer instance using the given information. Please note that the only reason this is async is that if no parser is set, we need to retrieve the default engine instance which is an async operation. If you have already initialized the engine (e.g., with TreeSitterExecutor#initTreeSitter ), you can use the synchronous version FlowrAnalyzerBuilder#buildSync instead.">FlowrAnalyzerBuilder::<b>build</b></span></code></a>\
	for an asynchronous build process that also initializes the engine if needed
* <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer-builder.ts#L202"><code><span title="Synchronous version of FlowrAnalyzerBuilder#build , please only use this if you have set the parser using FlowrAnalyzerBuilder#setParser before, otherwise an error will be thrown.">FlowrAnalyzerBuilder::<b>buildSync</b></span></code></a>\
	for a synchronous build process,
	which requires that the engine (e.g., TreeSitter) has already been initialized before calling this method.
	Yet, as Engines only have to be initialized once per process, this method is often more convenient to use.

	For more information on how to configure the builder, please refer to the [Builder Configuration](#Builder_Configuration) section below.

<h3 id="Overview_of_the_Analyzer">Overview of the Analyzer</h3>

Once you have created an analyzer instance, you can add R files, folders, or even entire projects for analysis using the
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer.ts#L282"><code>FlowrAnalyzer::<b>addRequest</b></code></a> method.
All loaded [plugins](#Plugins) will be applied fully automatically during the analysis.
Please note that adding new files _after_ you already requested analysis results may cause bigger invalidations and cause re-analysis of previously analyzed files.
With the [files context](#Files_Context), you can also add virtual files to the analysis to consider, or *overwrite* existing files with modified content.
For this, have a look at the
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer.ts#L298"><code>FlowrAnalyzer::<b>addFile</b></code></a> method.

	
> [!NOTE]
> If you want to quickly try out the analyzer, you can use the following code snippet that analyzes a simple R expression:
> 
> 
> ```ts
> const analyzer = await new FlowrAnalyzerBuilder()
>     .setEngine('tree-sitter')
>     .build();
> // register a simple inline text-file for analysis
> analyzer.addRequest('x <- 1; print(x)');
> // get the dataflow
> const df = await analyzer.dataflow();
> // obtain the identified loading order
> console.log(analyzer.inspectContext().files.loadingOrder.getLoadingOrder());
> // run a dependency query
> const results = await analyzer.query([{ type: 'dependencies' }]);
> ```
> 
> 


To reset the analysis (e.g., to provide new requests) you can use <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer.ts#L246"><code>FlowrAnalyzer::<b>reset</b></code></a>.
If you need to pre-compute analysis results (e.g., to speed up future queries), you can use <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer.ts#L344"><code>FlowrAnalyzer::<b>runFull</b></code></a>.

<h3 id="Conducting_Analyses">Conducting Analyses</h3>

Please make sure to add all of the files, folder, and projects you want to analyze using the
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer.ts#L282"><code>FlowrAnalyzer::<b>addRequest</b></code></a> method (or <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer.ts#L298"><code>FlowrAnalyzer::<b>addFile</b></code></a> for virtual files).
Afterwards, you can request different kinds of analysis results, such as:

* <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer.ts#L320"><code>FlowrAnalyzer::<b>parse</b></code></a> to get the parsed information by the respective [engine](https://github.com/flowr-analysis/flowr/wiki/Engines)\
You can also use <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer.ts#L324"><code>FlowrAnalyzer::<i>peekParse</i></code></a> to inspect the parse information if it was already computed (but without triggering a computation).
With <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer.ts#L233"><code>FlowrAnalyzer::<i>parserInformation</i></code></a>, you get additional information on the parser used for the analysis.
* <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer.ts#L328"><code>FlowrAnalyzer::<b>normalize</b></code></a> to compute the [Normalized AST](https://github.com/flowr-analysis/flowr/wiki/Normalized-AST)\
Likewise, <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer.ts#L332"><code>FlowrAnalyzer::<i>peekNormalize</i></code></a> returns the normalized AST if it was already computed but without triggering a computation.
* <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer.ts#L336"><code>FlowrAnalyzer::<b>dataflow</b></code></a> to compute the [Dataflow Graph](https://github.com/flowr-analysis/flowr/wiki/Dataflow-Graph)\
Again, <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer.ts#L340"><code>FlowrAnalyzer::<i>peekDataflow</i></code></a> allows you to inspect the dataflow graph if it was already computed (but without triggering a computation).
* <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer.ts#L349"><code>FlowrAnalyzer::<b>controlflow</b></code></a> to compute the [Control Flow Graph](https://github.com/flowr-analysis/flowr/wiki/Control-Flow-Graph)\
Also, <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer.ts#L353"><code>FlowrAnalyzer::<i>peekControlflow</i></code></a> returns the control flow graph if it was already computed but without triggering a computation.
* <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer.ts#L357"><code>FlowrAnalyzer::<b>callGraph</b></code></a> to compute the [call graph](https://github.com/flowr-analysis/flowr/wiki/Dataflow-Graph#perspectives-cg) of the analyzed code\
Likewise, <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer.ts#L361"><code>FlowrAnalyzer::<i>peekCallGraph</i></code></a> allows you to inspect the call graph if it was already computed (but without triggering a computation).
* <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer.ts#L365"><code>FlowrAnalyzer::<b>query</b></code></a> to run [queries](https://github.com/flowr-analysis/flowr/wiki/Query-API) on the analyzed code.
* <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer.ts#L371"><code>FlowrAnalyzer::<b>runSearch</b></code></a> to run a search query on the analyzed code using the [search API](https://github.com/flowr-analysis/flowr/wiki/Search-API)

We work on providing a set of example repositories that demonstrate how to use the analyzer in different scenarios:

* [flowr-analysis/sample-analyzer-project-query](https://github.com/flowr-analysis/sample-analyzer-project-query) for an example project that runs queries on an R project
* [flowr-analysis/sample-analyzer-df-diff](https://github.com/flowr-analysis/sample-analyzer-df-diff) for an example project that compares dataflows graphs

<h2 id="Builder_Configuration">Builder Configuration</h2>

If you are interested in all available options, have a look at the [Builder Reference](#Builder_Reference) below.
The following sections highlight some of the most important configuration options:

1. How to [configure flowR](#Configuring_flowR)
1. How to [configure the engine](#Configuring_the_Engine)
2. How to [register plugins](#Configuring_Plugins)

<h3 id="Configuring_flowR">Configuring flowR</h3>

You can fundamentally change the behavior of flowR using the [config file](https://github.com/flowr-analysis/flowr/wiki/Interface#configuring-flowr),
embedded in the interface <a href="https://github.com/flowr-analysis/flowr/tree/main/src/config.ts#L107"><code><span title="The configuration file format for flowR.">FlowrConfig</span></code></a>.
With the builder you can either provide a complete configuration or amend the default configuration using:

* <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer-builder.ts#L78"><code><span title="Overwrite the configuration used by the resulting analyzer. This also unloads all default plugins and reloads them as set in the new config if the withDefaultPlugins flag was set in the constructor">FlowrAnalyzerBuilder::<b>setConfig</b></span></code></a> to set a complete configuration
* <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer-builder.ts#L101"><code><span title="Set a specific value in the configuration used by the resulting analyzer. Besides the configuration's own paths this takes an EngineConfigPath , so an engine option that lives in an array entry is reachable the same way as everything else:">FlowrAnalyzerBuilder::<b>configure</b></span></code></a> to set the value of a specific key in the config
* <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer-builder.ts#L67"><code><span title="Apply an amendment to the configuration the builder currently holds. This is mostly intended for more complex logic to transform the config. Please consider using FlowrAnalyzerBuilder.configure to set/amend individual values Per default, the value returned by FlowrConfig.default is used.">FlowrAnalyzerBuilder::<b>amendConfig</b></span></code></a> to amend the default configuration

By default, the builder uses flowR's standard configuration obtained with <a href="https://github.com/flowr-analysis/flowr/tree/main/src/config.ts#L529"><code><span title="The default configuration for flowR, used when no config file is found or when a config file is missing some options. You can use this as a base for your own config and only specify the options you want to change.">FlowrConfig::<b>default</b></span></code></a>.


> [!NOTE]
> During the analysis with the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer.ts#L203"><code><span title="Central class for conducting analyses with FlowR. Use the FlowrAnalyzerBuilder to create a new instance. If you want the original pattern of creating a pipeline and running all steps, you can still do this with FlowrAnalyzer#runFull . To inspect the context of the analyzer, use FlowrAnalyzer#inspectContext (if you are a plugin and need to modify it, use FlowrAnalyzer#context instead).">FlowrAnalyzer</span></code></a>, you can also access the configuration with
> 		 the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-context.ts#L121"><code><span title="This summarizes the other context layers used by the FlowrAnalyzer . Have a look at the attributes and layers listed below (e.g., files and deps ) to get an idea of the capabilities provided by this context. Besides these, this layer only orchestrates the different steps and layers, providing a collection of convenience methods. In general, you do not have to worry about these details, as the Flow...">FlowrAnalyzerContext</span></code></a>.


<h3 id="Configuring_the_Engine">Configuring the Engine</h3>

FlowR supports multiple [engines](https://github.com/flowr-analysis/flowr/wiki/Engines) for parsing and analyzing R code.
With the builder, you can select the engine to use with:

* <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer-builder.ts#L129"><code><span title="Set the engine and hence the parser that will be used by the analyzer. This is an alternative to FlowrAnalyzerBuilder#setParser if you do not have a parser instance at hand.">FlowrAnalyzerBuilder::<b>setEngine</b></span></code></a> to set the desired engine.
* <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer-builder.ts#L118"><code><span title="Set the parser instance used by the analyzer. This is an alternative to FlowrAnalyzerBuilder#setEngine if you already have a parser instance. Please be aware, that if you want to parallelize multiple analyzers, there should be separate parser instances.">FlowrAnalyzerBuilder::<b>setParser</b></span></code></a> to set a specific parser implementation.

By default, the builder uses the TreeSitter engine with the TreeSitter parser.
The builder also takes care to initialize the engine if needed during the asynchronous build process
with <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer-builder.ts#L181"><code><span title="Create the FlowrAnalyzer instance using the given information. Please note that the only reason this is async is that if no parser is set, we need to retrieve the default engine instance which is an async operation. If you have already initialized the engine (e.g., with TreeSitterExecutor#initTreeSitter ), you can use the synchronous version FlowrAnalyzerBuilder#buildSync instead.">FlowrAnalyzerBuilder::<b>build</b></span></code></a>.
If you want to use the synchronous build process with <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer-builder.ts#L202"><code><span title="Synchronous version of FlowrAnalyzerBuilder#build , please only use this if you have set the parser using FlowrAnalyzerBuilder#setParser before, otherwise an error will be thrown.">FlowrAnalyzerBuilder::<b>buildSync</b></span></code></a>,
please ensure that the engine has already been initialized before calling this method.

<h3 id="Configuring_Plugins">Configuring Plugins</h3>

There are various ways for you to register plugins with the builder, exemplified by the following snippet
relying on the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer-builder.ts#L150"><code><span title="Register one or multiple additional plugins. For the default plugin set, please refer to FlowrDefaultPlugins , they can be registered by passing true to the FlowrAnalyzerBuilder constructor.">FlowrAnalyzerBuilder::<b>registerPlugins</b></span></code></a> method:


```ts
const analyzer = await new FlowrAnalyzerBuilder(false)
    .registerPlugins(
        'file:description',
        new FlowrAnalyzerQmdFilePlugin(),
        ['file:rmd', [/.*.rmd/i]]
    )
    .build();
```


This indicates three ways to add a new plugin:

1. By using a predefined name (e.g., `file:description` for the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/flowr-analyzer-description-file-plugin.ts#L31"><code><span title="This plugin provides support for R DESCRIPTION files.">FlowrAnalyzerDescriptionFilePlugin</span></code></a>)\
   These mappings are controlled by the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/plugin-registry.ts#L146"><code><span title="Register a new Flowr Analyzer plugin for the registry, to be used by the FlowrAnalyzerBuilder and FlowrAnalyzer .">registerPluginMaker</span></code></a> function in the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/plugin-registry.ts#L138"><code><span title="The registry of built-in and user-registered Flowr Analyzer plugins. Used by the FlowrAnalyzerBuilder and FlowrAnalyzer to instantiate plugins by name.">PluginRegistry</span></code></a>.
   Under the hood, this relies on <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/plugin-registry.ts#L175"><code><span title="Create a Flowr Analyzer plugin from a PluginToRegister specification.">makePlugin</span></code></a> to create the plugin instance from the name.
2. By providing an already instantiated plugin (e.g., the new <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/notebooks/flowr-analyzer-qmd-file-plugin.ts#L8"><code><span title="The plugin provides support for Quarto R Markdown (.qmd) files">FlowrAnalyzerQmdFilePlugin</span></code></a> instance).\
   You can pass these by reference, instantiating any class that conforms to the [plugin specification](#Plugins).
3. By providing a tuple of the plugin name and its constructor arguments (e.g., `['file:rmd', [/.*.rmd/i]]` for the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/notebooks/flowr-analyzer-rmd-file-plugin.ts#L9"><code><span title="The plugin provides support for R Markdown (.rmd) files">FlowrAnalyzerRmdFilePlugin</span></code></a>).\
   This will also use the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/plugin-registry.ts#L175"><code><span title="Create a Flowr Analyzer plugin from a PluginToRegister specification.">makePlugin</span></code></a> function under the hood to create the plugin instance.

Please note, that by passing `false` to the builder constructor, no default plugins (see <a href="https://github.com/flowr-analysis/flowr/tree/main/src/config.ts#L379"><code>FlowrDefaultPlugins</code></a>) are registered (otherwise, all of the plugins in the example above would be registered by default).
If you want to unregister specific plugins, you can use the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer-builder.ts#L164"><code><span title="Remove one or multiple plugins.">FlowrAnalyzerBuilder::<b>unregisterPlugins</b></span></code></a> method.


> [!NOTE]
> If you directly access the API, please prefer creating the objects yourself by instantiating the respective classes instead of relying on the plugin registry.
> This avoids the indirection *and* potential issues with naming collisions in the registry.
> Moreover, this allows you to directly provide custom configuration to the plugin constructors in a readable fashion,
> *and* to re-use plugin instances.
> Instantiation by text is mostly for serialized communications (e.g., via a CLI or config format).


For more information on the different plugin types and how to create new plugins, please refer to the [Plugins](#Plugins) section below.

<h3 id="Builder_Reference">Builder Reference</h3>

The builder provides a plethora of methods to configure the resulting analyzer instance:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer-builder.ts#L67"><code><span title="Apply an amendment to the configuration the builder currently holds. This is mostly intended for more complex logic to transform the config. Please consider using FlowrAnalyzerBuilder.configure to set/amend individual values Per default, the value returned by FlowrConfig.default is used.">FlowrAnalyzerBuilder::<b>amendConfig</b></span></code></a>\
Apply an amendment to the configuration the builder currently holds.
This is mostly intended for more complex logic to transform the config.
Please consider using
<code>FlowrAnalyzerBuilder.configure</code>
to set/amend individual values
Per default, the value returned by
<code>FlowrConfig.default</code>
is used.
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer-builder.ts#L101"><code><span title="Set a specific value in the configuration used by the resulting analyzer. Besides the configuration's own paths this takes an EngineConfigPath , so an engine option that lives in an array entry is reachable the same way as everything else:">FlowrAnalyzerBuilder::<b>configure</b></span></code></a>\
Set a specific value in the configuration used by the resulting analyzer.
Besides the configuration's own paths this takes an
<code>EngineConfigPath</code>
, so an engine option that
lives in an array entry is reachable the same way as everything else:
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer-builder.ts#L150"><code><span title="Register one or multiple additional plugins. For the default plugin set, please refer to FlowrDefaultPlugins , they can be registered by passing true to the FlowrAnalyzerBuilder constructor.">FlowrAnalyzerBuilder::<b>registerPlugins</b></span></code></a>\
Register one or multiple additional plugins.
For the default plugin set, please refer to
<code>FlowrDefaultPlugins</code>
, they can be registered
by passing `true` to the
<code>FlowrAnalyzerBuilder</code>
constructor.
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer-builder.ts#L78"><code><span title="Overwrite the configuration used by the resulting analyzer. This also unloads all default plugins and reloads them as set in the new config if the withDefaultPlugins flag was set in the constructor">FlowrAnalyzerBuilder::<b>setConfig</b></span></code></a>\
Overwrite the configuration used by the resulting analyzer.
This also unloads all default plugins and reloads them as set in the new config
if the withDefaultPlugins flag was set in the constructor
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer-builder.ts#L129"><code><span title="Set the engine and hence the parser that will be used by the analyzer. This is an alternative to FlowrAnalyzerBuilder#setParser if you do not have a parser instance at hand.">FlowrAnalyzerBuilder::<b>setEngine</b></span></code></a>\
Set the engine and hence the parser that will be used by the analyzer.
This is an alternative to
<code>FlowrAnalyzerBuilder#setParser</code>
if you do not have a parser instance at hand.
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer-builder.ts#L138"><code><span title="Additional parameters for the analyses.">FlowrAnalyzerBuilder::<b>setInput</b></span></code></a>\
Additional parameters for the analyses.
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer-builder.ts#L118"><code><span title="Set the parser instance used by the analyzer. This is an alternative to FlowrAnalyzerBuilder#setEngine if you already have a parser instance. Please be aware, that if you want to parallelize multiple analyzers, there should be separate parser instances.">FlowrAnalyzerBuilder::<b>setParser</b></span></code></a>\
Set the parser instance used by the analyzer.
This is an alternative to
<code>FlowrAnalyzerBuilder#setEngine</code>
if you already have a parser instance.
Please be aware, that if you want to parallelize multiple analyzers, there should be separate parser instances.
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer-builder.ts#L164"><code><span title="Remove one or multiple plugins.">FlowrAnalyzerBuilder::<b>unregisterPlugins</b></span></code></a>\
Remove one or multiple plugins.

To build the analyzer after you have configured the builder, you can use one of the following:

- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer-builder.ts#L181"><code><span title="Create the FlowrAnalyzer instance using the given information. Please note that the only reason this is async is that if no parser is set, we need to retrieve the default engine instance which is an async operation. If you have already initialized the engine (e.g., with TreeSitterExecutor#initTreeSitter ), you can use the synchronous version FlowrAnalyzerBuilder#buildSync instead.">FlowrAnalyzerBuilder::<b>build</b></span></code></a>\
Create the
<code>FlowrAnalyzer</code>
instance using the given information.
Please note that the only reason this is `async` is that if no parser is set,
we need to retrieve the default engine instance which is an async operation.
If you have already initialized the engine (e.g., with
<code>TreeSitterExecutor#initTreeSitter</code>
),
you can use the synchronous version
<code>FlowrAnalyzerBuilder#buildSync</code>
instead.
- <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer-builder.ts#L202"><code><span title="Synchronous version of FlowrAnalyzerBuilder#build , please only use this if you have set the parser using FlowrAnalyzerBuilder#setParser before, otherwise an error will be thrown.">FlowrAnalyzerBuilder::<b>buildSync</b></span></code></a>\
Synchronous version of
<code>FlowrAnalyzerBuilder#build</code>
, please only use this if you have set the parser using
<code>FlowrAnalyzerBuilder#setParser</code>
before, otherwise an error will be thrown.

<h2 id="Plugins">Plugins</h2>

Plugins allow you to extend the capabilities of the analyzer in many different ways.
For example, they can be used to support other file formats, or to provide new algorithms to determine the loading order of files in a project.
All plugins have to extend the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/flowr-analyzer-plugin.ts#L94"><code><span title="The base class every plugin to be used with the FlowrAnalyzer must extend. **Please do not create plugins directly based on this class, but use the classes referenced alongside the PluginType values!* For example, if you want to create a plugin that determines the loading order of files, extend FlowrAnalyzerLoadingOrderPlugin instead. These classes also provide sensible overrides of FlowrAnalyzerP...">FlowrAnalyzerPlugin</span></code></a> base class and specify their <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/flowr-analyzer-plugin.ts#L29"><code><span title="Based on *when* and *what-for* the plugin is applied during the analysis, plugins are categorized into different types.  Consult this diagram for an overview of orders and (implicit or explicit) dependencies:    ┌───────────┐ ┌───────────────────┐ ┌─────────────┐ ┌───────────────┐ ┌───────┐ │ │ │ │ │ │ │ │ │ │ │ *Builder* ├──▶│ Project Discovery ├──▶│ File Loader ├──▶│ Dependencies ├──▶│ *DFA* │ │...">PluginType</span></code></a>.
During the analysis, the analyzer will apply all registered plugins of the different types at the appropriate stages of the analysis.
If you just want to _use_ these plugins, you can usually ignore their [type](#Plugin_Types) and just register them with the builder as described
in the [Builder Configuration](#Builder_Configuration) section above.
However, if you want to _create_ new plugins, you should be aware of the different plugin types and when they are applied during the analysis.

Currently, flowR supports the following plugin types built-in:

| Name | Type | What it does | Class |
|------|------|--------------|-------|
| <code>file-roles:inst</code> | <code>file-load</code> | Loads installed files. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/flowr-analyzer-inst-file-plugin.ts#L11"><code><span title="This plugin provides supports for the identification of installed files (files below an inst/ folder). If you use multiple plugins, this should be included *before* other plugins.">FlowrAnalyzerMetaInstFilesPlugin</span></code></a> |
| <code>file-roles:test</code> | <code>file-load</code> | Loads test files. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/flowr-analyzer-test-file-plugin.ts#L11"><code><span title="This plugin provides supports for the identification of test files. If you use multiple plugins, this should be included *before* other plugins.">FlowrAnalyzerMetaTestFilesPlugin</span></code></a> |
| <code>file-roles:vignette</code> | <code>file-load</code> | Loads vignette files. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/flowr-analyzer-vignette-file-plugin.ts#L11"><code><span title="This plugin provides supports for the loading of Vignette files. If you use multiple plugins, this should be included *before* other plugins.">FlowrAnalyzerMetaVignetteFilesPlugin</span></code></a> |
| <code>file:datalist</code> | <code>file-load</code> | Reads data/datalist into the objects each dataset provides. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/flowr-analyzer-rd-file-plugin.ts#L111"><code><span title="Support for a package's data/datalist: the only place a data(<set>) binding differently named objects is written down.">FlowrAnalyzerDataListFilePlugin</span></code></a> |
| <code>file:description</code> | <code>file-load</code> | Reads DESCRIPTION files into key-value pairs. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/flowr-analyzer-description-file-plugin.ts#L31"><code><span title="This plugin provides support for R DESCRIPTION files.">FlowrAnalyzerDescriptionFilePlugin</span></code></a> |
| <code>file:ipynb</code> | <code>file-load</code> | Parses Jupyter files | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/notebooks/flowr-analyzer-jupyter-file-plugin.ts#L12"><code><span title="The plugin provides support for Jupyter (.ipynb) files">FlowrAnalyzerJupyterFilePlugin</span></code></a> |
| <code>file:license</code> | <code>file-load</code> | Loads license files. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/flowr-analyzer-license-file-plugin.ts#L11"><code><span title="This plugin provides supports for the identification of license files.">FlowrAnalyzerLicenseFilePlugin</span></code></a> |
| <code>file:namespace</code> | <code>file-load</code> | Reads NAMESPACE files into the NAMESPACE format. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/flowr-analyzer-namespace-files-plugin.ts#L12"><code><span title="This plugin provides support for R NAMESPACE files.">FlowrAnalyzerNamespaceFilesPlugin</span></code></a> |
| <code>file:news</code> | <code>file-load</code> | Reads NEWS files into version chunks. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/flowr-analyzer-news-file-plugin.ts#L13"><code><span title="This plugin provides support for R NEWS files.">FlowrAnalyzerNewsFilePlugin</span></code></a> |
| <code>file:qmd</code> | <code>file-load</code> | Parses Quarto R Markdown files | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/notebooks/flowr-analyzer-qmd-file-plugin.ts#L8"><code><span title="The plugin provides support for Quarto R Markdown (.qmd) files">FlowrAnalyzerQmdFilePlugin</span></code></a> |
| <code>file:rd</code> | <code>file-load</code> | Reads .Rd manual pages into the Rd page format. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/flowr-analyzer-rd-file-plugin.ts#L43"><code><span title="Support for R .Rd manual pages: a page states which names it documents (its \\alias{}es); see rdIndexOf .">FlowrAnalyzerRdFilePlugin</span></code></a> |
| <code>file:rd-index</code> | <code>file-load</code> | Reads an installed package's help/AnIndex into the alias-to-topic mapping. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/flowr-analyzer-rd-file-plugin.ts#L59"><code><span title="Support for an installed package's help/AnIndex: the same alias-to-topic mapping the man/ sources give a checkout.">FlowrAnalyzerRdIndexFilePlugin</span></code></a> |
| <code>file:rd-macros</code> | <code>file-load</code> | Reads the \newcommand definitions of man/macros/ files. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/flowr-analyzer-rd-file-plugin.ts#L71"><code><span title="Support for a package's man/macros/ (installed: help/macros/) files, whose \\newcommands rdIndexOf expands before reading pages.">FlowrAnalyzerRdMacroFilePlugin</span></code></a> |
| <code>file:rd-meta</code> | <code>file-load</code> | Reads an installed package's Meta/Rd.rds help table. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/flowr-analyzer-rd-file-plugin.ts#L99"><code><span title="Support for the Meta/Rd.rds help table an installed package serializes, states what the man/ sources do -- topic, aliases, keywords, title.">FlowrAnalyzerRdMetaFilePlugin</span></code></a> |
| <code>file:rd-topics</code> | <code>file-load</code> | Reads INDEX/00Index topic tables into their topic-to-title mapping. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/flowr-analyzer-rd-file-plugin.ts#L87"><code><span title="Support for a package's INDEX and demo/00Index: the topic-and-title table R keeps even where no man/ sources are.">FlowrAnalyzerRdTopicIndexFilePlugin</span></code></a> |
| <code>file:rda</code> | <code>file-load</code> | Reads RDA/RData workspace files into their contained R objects. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/flowr-analyzer-rda-file-plugin.ts#L13"><code><span title="This plugin provides support for R workspace files (.rda/.RData), exposing their top-level objects.">FlowrAnalyzerRdaFilePlugin</span></code></a> |
| <code>file:rmd</code> | <code>file-load</code> | Parses R Markdown files | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/notebooks/flowr-analyzer-rmd-file-plugin.ts#L9"><code><span title="The plugin provides support for R Markdown (.rmd) files">FlowrAnalyzerRmdFilePlugin</span></code></a> |
| <code>file:rnw</code> | <code>file-load</code> | Parses R Sweave files | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/notebooks/flowr-analyzer-sweave-file-plugin.ts#L13"><code><span title="The plugin provides support for Sweave (.Rnw) files">FlowrAnalyzerSweaveFilePlugin</span></code></a> |
| <code>file:rprofile</code> | <code>file-load</code> | Marks R startup files (.Rprofile, Rprofile.site, .Renviron, Renviron.site). | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/flowr-analyzer-rprofile-file-plugin.ts#L19"><code><span title="Marks R startup files: profiles (.Rprofile, Rprofile.site) are R source, so they get FileRole.Startup and FileRole.Source ; environment files (.Renviron, Renviron.site) hold KEY=value definitions rather than R code, so they only get FileRole.Environment . The FlowrAnalyzerLoadingOrderRprofilePlugin moves the profile files to the front of the loading order.">FlowrAnalyzerRprofileFilePlugin</span></code></a> |
| <code>file:rproject</code> | <code>file-load</code> | Marks the rproject.toml manifest of an rv project. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/flowr-analyzer-manifest-file-plugin.ts#L19"><code><span title="Lifts an rv rproject.toml to a FlowrRProjectFile .">FlowrAnalyzerRProjectFilePlugin</span></code></a> |
| <code>file:sysdata</code> | <code>file-load</code> | Reads R/sysdata.rda into the objects it lazy-loads into the package namespace. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/flowr-analyzer-sysdata-file-plugin.ts#L15"><code><span title="This plugin provides support for a package's system data, the objects R lazy-loads into the package namespace. It has to run before the FlowrAnalyzerRdaFilePlugin , which would otherwise claim the .rda.">FlowrAnalyzerSysdataFilePlugin</span></code></a> |
| <code>file:uvr</code> | <code>file-load</code> | Marks the uvr.toml manifest of a uvr project. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/flowr-analyzer-manifest-file-plugin.ts#L33"><code><span title="Lifts a uvr uvr.toml to a FlowrUvrManifestFile .">FlowrAnalyzerUvrManifestFilePlugin</span></code></a> |
| <code>file:virtualenv</code> | <code>file-load</code> | Marks virtual-environment lockfiles (renv.lock, rv.lock, uvr.lock). | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/flowr-analyzer-virtualenv-file-plugin.ts#L12"><code><span title="Tags a project's virtual-environment lockfiles with the FileRole.VirtualEnv role, so the version plugins that read them can look them up by role instead of scanning every project file.">FlowrAnalyzerVirtualEnvFilePlugin</span></code></a> |
| <code>loading-order:description</code> | <code>loading-order</code> | Orders the files by the Collate field of a DESCRIPTION file. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/loading-order-plugins/flowr-analyzer-loading-order-description-file-plugin.ts#L11"><code><span title="This plugin extracts loading order information from R DESCRIPTION files. It looks at the Collate field to determine the order in which files should be loaded. If no Collate field is present, it does nothing.">FlowrAnalyzerLoadingOrderDescriptionFilePlugin</span></code></a> |
| <code>loading-order:implicit-sources</code> | <code>loading-order</code> | Orders the files a framework loads implicitly, as configured by project.implicitSources. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/loading-order-plugins/flowr-analyzer-loading-order-implicit-sources-plugin.ts#L14"><code><span title="Orders the files given by project.implicitSources, which is already specialized for the project kind. Files that are no implicit sources stay in front, as the implicit entry points consume them.">FlowrAnalyzerLoadingOrderImplicitSourcesPlugin</span></code></a> |
| <code>loading-order:included-files</code> | <code>loading-order</code> | Drops files that another document includes from the loading order. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/loading-order-plugins/flowr-analyzer-loading-order-included-files-plugin.ts#L13"><code><span title="Drops the files an R Markdown document splices into itself ( FlowrRMarkdownFile#includedFiles ) from the loading order, as the including document already carries their content. This refines the orders the other loading-order plugins produced, so register it after them.">FlowrAnalyzerLoadingOrderIncludedFilesPlugin</span></code></a> |
| <code>loading-order:rprofile</code> | <code>loading-order</code> | Loads the R startup profiles (.Rprofile, Rprofile.site) before any project code. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/loading-order-plugins/flowr-analyzer-loading-order-rprofile-plugin.ts#L18"><code><span title="Moves the R startup profiles ( FileRole.Startup , tagged by FlowrAnalyzerRprofileFilePlugin ) to the front of the loading order, as R evaluates them before any project code. This refines the orders the other loading-order plugins produced, so register it after them.">FlowrAnalyzerLoadingOrderRprofilePlugin</span></code></a> |
| <code>meta:description</code> | <code>package-versions</code> | Extracts package meta information from DESCRIPTION files. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/package-version-plugins/flowr-analyzer-meta-description-file-plugin.ts#L10"><code><span title="This plugin extracts package meta information from R DESCRIPTION files.">FlowrAnalyzerMetaDescriptionFilePlugin</span></code></a> |
| <code>meta:rproject</code> | <code>package-versions</code> | Extracts project meta information and dependencies from an rproject.toml. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/package-version-plugins/flowr-analyzer-meta-manifest-file-plugin.ts#L37"><code><span title="Reads an rv rproject.toml.">FlowrAnalyzerMetaRProjectFilePlugin</span></code></a> |
| <code>meta:uvr</code> | <code>package-versions</code> | Extracts project meta information and dependencies from a uvr.toml. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/package-version-plugins/flowr-analyzer-meta-manifest-file-plugin.ts#L44"><code><span title="Reads a uvr uvr.toml, whose [dev-dependencies] land in suggests.">FlowrAnalyzerMetaUvrManifestFilePlugin</span></code></a> |
| <code>project-discovery:default</code> | <code>project-discovery</code> | Detects the project kind and discovers only the files it needs (unless project.discovery.full). | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/project-discovery/flowr-analyzer-project-discovery-plugin.ts#L201"><code><span title="flowR's default discovery: walk the project once (pruning noise directories), classify the ProjectKind from what the walk sees, then keep only the files that kind needs. project.discovery.full restores the greedy FlowrAnalyzerFullProjectDiscoveryPlugin , project.discovery.perKind overrides the kept set per kind.">FlowrAnalyzerDefaultProjectDiscoveryPlugin</span></code></a> |
| <code>project-discovery:full</code> | <code>project-discovery</code> | Collects every file below the project root (greedy discovery). | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/project-discovery/flowr-analyzer-project-discovery-plugin.ts#L89"><code><span title="The greedy discovery implementation: every file below the root becomes a RParseRequest (R and Rmd files) or a FlowrTextFile (the rest). This is what FlowrAnalyzerDefaultProjectDiscoveryPlugin falls back to in full mode.">FlowrAnalyzerFullProjectDiscoveryPlugin</span></code></a> |
| <code>project-discovery:gitignore</code> | <code>project-discovery</code> | Wraps a project discovery plugin and filters results by .gitignore rules. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/project-discovery/flowr-analyzer-ignore-file-project-discovery-plugin.ts#L90"><code><span title="Filters the discovered files by the .gitignore at the project root, see FlowrAnalyzerIgnoreFileProjectDiscoveryPlugin .">FlowrAnalyzerGitignoreProjectDiscoveryPlugin</span></code></a> |
| <code>project-discovery:ignore-files</code> | <code>project-discovery</code> | Wraps a project discovery plugin and filters results by .gitignore and .Rbuildignore rules. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/project-discovery/flowr-analyzer-ignore-file-project-discovery-plugin.ts#L52"><code><span title="Decorator around any FlowrAnalyzerProjectDiscoveryPlugin that filters the discovered files by the ignore files found at the project root. Ignore files that do not exist are skipped, so with none of them present the inner plugin's results are returned unchanged. Use FlowrAnalyzerGitignoreProjectDiscoveryPlugin ('project-discovery:gitignore'), FlowrAnalyzerRbuildignoreProjectDiscoveryPlugin ('projec...">FlowrAnalyzerIgnoreFileProjectDiscoveryPlugin</span></code></a> |
| <code>project-discovery:rbuildignore</code> | <code>project-discovery</code> | Wraps a project discovery plugin and filters results by .Rbuildignore rules. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/project-discovery/flowr-analyzer-ignore-file-project-discovery-plugin.ts#L100"><code><span title="Filters the discovered files by the .Rbuildignore at the package root, see FlowrAnalyzerIgnoreFileProjectDiscoveryPlugin .">FlowrAnalyzerRbuildignoreProjectDiscoveryPlugin</span></code></a> |
| <code>versions:description</code> | <code>package-versions</code> | Extracts package versions from DESCRIPTION files. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-description-file-plugin.ts#L12"><code><span title="This plugin extracts package versions from R DESCRIPTION files. It looks at the Depends and Imports fields to find package names and their version constraints.">FlowrAnalyzerPackageVersionsDescriptionFilePlugin</span></code></a> |
| <code>versions:library</code> | <code>package-versions</code> | Recovers the exports of packages no database knows from their installed copy. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-library-plugin.ts#L77"><code><span title="Fills in packages no signature database knows from the copy installed on this machine: a package that CRAN archived (maptools, rgdal, ...) is in no database, but if it is installed, its NAMESPACE states its exports just as well. Off unless solver.sigdb.installedLibrary.enabled says otherwise, and consulted only for a package nothing else could resolve, so it never overrides a database entry.">FlowrAnalyzerPackageVersionsLibraryPlugin</span></code></a> |
| <code>versions:namespace</code> | <code>package-versions</code> | Extracts package versions from NAMESPACE files. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-namespace-file-plugin.ts#L10"><code>FlowrAnalyzerPackageVersionsNamespaceFilePlugin</code></a> |
| <code>versions:packrat</code> | <code>package-versions</code> | Extracts package versions from a packrat.lock lockfile. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-lockfile-plugin.ts#L49"><code><span title="Reads package versions from a packrat.lock (multi-record DCF, metadata first). packrat pins are exact.">FlowrAnalyzerPackageVersionsPackratPlugin</span></code></a> |
| <code>versions:renv</code> | <code>package-versions</code> | Extracts package versions from an renv.lock lockfile. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-lockfile-plugin.ts#L25"><code><span title="Reads package versions from an renv.lock (JSON). renv pins are exact.">FlowrAnalyzerPackageVersionsRenvPlugin</span></code></a> |
| <code>versions:rv</code> | <code>package-versions</code> | Extracts package versions from an rv.lock lockfile. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-lockfile-plugin.ts#L104"><code><span title="Reads package versions from an rv.lock (the resolved rv project lockfile, TOML). rv pins are exact.">FlowrAnalyzerPackageVersionsRvPlugin</span></code></a> |
| <code>versions:session-info</code> | <code>package-versions</code> | Extracts package and R versions from a pasted sessionInfo() output block. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-session-info-plugin.ts#L31"><code><span title="Reads package (and R) versions from a pasted sessionInfo() output block within a source file (typically inside a comment). This is how R users record a reproducible environment, so when present it pins exact versions, just like a lockfile. Detection is conservative: we only act once we see the R version line and/or one of sessionInfo()'s package-listing headers, and additionally require at least o...">FlowrAnalyzerPackageVersionsSessionInfoPlugin</span></code></a> |
| <code>versions:sigdb</code> | <code>package-versions</code> | Resolves library exports (and versioned base R) from precomputed flowr-sigdb databases. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-sigdb-plugin.ts#L114"><code><span title="Resolves library(pkg) / use(pkg, fn) from precomputed flowr-sigdb databases via the PackageSignatureSource contract; for an R-core package it picks the version shipped with the assumed R release. Plain-file sources load lazily, a .br/manifest source needs preload ; on by default.">FlowrAnalyzerPackageVersionsSigDbPlugin</span></code></a> |
| <code>versions:uvr</code> | <code>package-versions</code> | Extracts package versions from a uvr.lock lockfile. | <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-lockfile-plugin.ts#L121"><code><span title="Reads package versions from a uvr.lock (TOML). uvr pins are exact, the dev-dependencies among them.">FlowrAnalyzerPackageVersionsUvrPlugin</span></code></a> |


<h3 id="Plugin_Types">Plugin Types</h3>

During the construction of a new <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer.ts#L203"><code><span title="Central class for conducting analyses with FlowR. Use the FlowrAnalyzerBuilder to create a new instance. If you want the original pattern of creating a pipeline and running all steps, you can still do this with FlowrAnalyzer#runFull . To inspect the context of the analyzer, use FlowrAnalyzer#inspectContext (if you are a plugin and need to modify it, use FlowrAnalyzer#context instead).">FlowrAnalyzer</span></code></a>, plugins of different types are applied at different stages of the analysis.
These plugins are grouped by their <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/flowr-analyzer-plugin.ts#L29"><code><span title="Based on *when* and *what-for* the plugin is applied during the analysis, plugins are categorized into different types.  Consult this diagram for an overview of orders and (implicit or explicit) dependencies:    ┌───────────┐ ┌───────────────────┐ ┌─────────────┐ ┌───────────────┐ ┌───────┐ │ │ │ │ │ │ │ │ │ │ │ *Builder* ├──▶│ Project Discovery ├──▶│ File Loader ├──▶│ Dependencies ├──▶│ *DFA* │ │...">PluginType</span></code></a> and are applied in the following order (as shown in the documentation of the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/flowr-analyzer-plugin.ts#L29"><code><span title="Based on *when* and *what-for* the plugin is applied during the analysis, plugins are categorized into different types.  Consult this diagram for an overview of orders and (implicit or explicit) dependencies:    ┌───────────┐ ┌───────────────────┐ ┌─────────────┐ ┌───────────────┐ ┌───────┐ │ │ │ │ │ │ │ │ │ │ │ *Builder* ├──▶│ Project Discovery ├──▶│ File Loader ├──▶│ Dependencies ├──▶│ *DFA* │ │...">PluginType</span></code></a>):

```text
┌───────────┐   ┌───────────────────┐   ┌─────────────┐   ┌───────────────┐   ┌───────┐
│           │   │                   │   │             │   │               │   │       │
│ *Builder* ├──>│ Project Discovery ├──>│ File Loader ├──>│ Dependencies  ├──>│ *DFA* │
│           │   │  (if necessary)   │   │             │   │   (static)    │   │       │
└───────────┘   └───────────────────┘   └──────┬──────┘   └───────────────┘   └────┬──┘
                                               │                                  ▲│
                                               │          ┌───────────────┐       ││
                                               │          │               │       ││ on-demand
                                               └─────────>│ Loading Order ├───────┘│
                                                          │               │        │  ┌───────────┐
                                                          └───────────────┘        └─>│    Gas    │
                                                                                      └───────────┘
```

Please note, that every plugin type has a default implementation (e.g., see <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/flowr-analyzer-plugin.ts#L103"><code><span title="Returns a default/dummy implementation to be used when no plugin of this type is registered or triggered.">defaultPlugin</span></code></a>)
that is always active.
We describe the different plugin types in more detail below.

<h4 id="Project_Discovery">Project Discovery</h4>

These plugins trigger when confronted with a project analysis request (see, <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-files-context.ts#L44"><code><span title="This is a request to process a folder as a project, which will be expanded by the registered FlowrAnalyzerProjectDiscoveryPlugin s.">RProjectAnalysisRequest</span></code></a>).
Their job is to identify the files that belong to the project and add them to the analysis.
flowR provides the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/project-discovery/flowr-analyzer-project-discovery-plugin.ts#L22"><code><span title="This is the base class for all plugins that discover files in a project for analysis. These plugins interplay with the FlowrAnalyzerFilesContext to gather information about the files in the project. See FlowrAnalyzerDefaultProjectDiscoveryPlugin for the default implementation. In general, these plugins only trigger for a RProjectAnalysisRequest with the idea to discover all files in a project.">FlowrAnalyzerProjectDiscoveryPlugin</span></code></a> with a
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/flowr-analyzer-plugin.ts#L103"><code><span title="Returns a default/dummy implementation to be used when no plugin of this type is registered or triggered.">defaultPlugin</span></code></a> as the default implementation that simply collects all R source files in the given folder.

Please note that all project discovery plugins should conform to the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/project-discovery/flowr-analyzer-project-discovery-plugin.ts#L22"><code><span title="This is the base class for all plugins that discover files in a project for analysis. These plugins interplay with the FlowrAnalyzerFilesContext to gather information about the files in the project. See FlowrAnalyzerDefaultProjectDiscoveryPlugin for the default implementation. In general, these plugins only trigger for a RProjectAnalysisRequest with the idea to discover all files in a project.">FlowrAnalyzerProjectDiscoveryPlugin</span></code></a> base class.

<h4 id="File_Loading">File Loading</h4>

These plugins register for every file encountered by the [files context](#Files_Context) and determine whether and _how_ they can process the file.
They are responsible for transforming the raw file content into a representation that flowR can work with during the analysis.
For example, the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/flowr-analyzer-description-file-plugin.ts#L31"><code><span title="This plugin provides support for R DESCRIPTION files.">FlowrAnalyzerDescriptionFilePlugin</span></code></a> adds support for R `DESCRIPTION` files by parsing their content into key-value pairs.
These can then be used by other plugins, e.g. the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-description-file-plugin.ts#L12"><code><span title="This plugin extracts package versions from R DESCRIPTION files. It looks at the Depends and Imports fields to find package names and their version constraints.">FlowrAnalyzerPackageVersionsDescriptionFilePlugin</span></code></a> that extracts package version information from these files.

If multiple file plugins could apply (<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/flowr-analyzer-file-plugin.ts#L40"><code>DefaultFlowrAnalyzerFilePlugin::<b>applies</b></code></a>) to the same file,
the loading order of these plugins determines which plugin gets to process the file.
Please ensure that no two file plugins _apply_ to the same file,
as this could lead to unexpected behavior.
Also, make sure that all file plugins conform to the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/flowr-analyzer-file-plugin.ts#L22"><code><span title="This is the base class for all plugins that load and possibly transform files when they are loaded. Different from other plugins, these plugins trigger for each file that is loaded (if they applies to the file). See the FlowrAnalyzer.addFile for more information on how files are loaded and managed. It is up to the construction to ensure that no two file plugins applies to the same file, otherwise,...">FlowrAnalyzerFilePlugin</span></code></a> base class.

<h4 id="Dependency_Identification">Dependency Identification</h4>

These plugins should identify which R packages are required with which versions for the analysis.
This information is then used to setup the R environment for the analysis correctly.
For example, the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-description-file-plugin.ts#L12"><code><span title="This plugin extracts package versions from R DESCRIPTION files. It looks at the Depends and Imports fields to find package names and their version constraints.">FlowrAnalyzerPackageVersionsDescriptionFilePlugin</span></code></a> extracts package version information from `DESCRIPTION` files
to identify the required packages and their versions.

All dependency identification plugins should conform to the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/package-version-plugins/flowr-analyzer-package-versions-plugin.ts#L21"><code><span title="This is the base class for all plugins that identify package and dependency versions used in the project. These plugins interplay with the FlowrAnalyzerDependenciesContext to gather information about the packages used in the project. See DefaultFlowrAnalyzerPackageVersionsPlugin for the no-op default implementation.">FlowrAnalyzerPackageVersionsPlugin</span></code></a> base class.

<h4 id="Loading_Order">Loading Order</h4>

These plugins determine the order in which files are loaded and analyzed.
This is crucial for correctly understanding the dependencies between files and improved analyses, especially in larger projects.
For example, the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/loading-order-plugins/flowr-analyzer-loading-order-description-file-plugin.ts#L11"><code><span title="This plugin extracts loading order information from R DESCRIPTION files. It looks at the Collate field to determine the order in which files should be loaded. If no Collate field is present, it does nothing.">FlowrAnalyzerLoadingOrderDescriptionFilePlugin</span></code></a> provides a basic implementation that orders files based on
the specification in a `DESCRIPTION` file, if present.

All loading order plugins should conform to the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/loading-order-plugins/flowr-analyzer-loading-order-plugin.ts#L12"><code><span title="This is the base class for all plugins that determine the loading order of files in a project. These plugins interplay with the FlowrAnalyzerFilesContext to gather information about the files in the project and determine their loading order. See DefaultFlowrAnalyzerLoadingOrderPlugin for the dummy default implementation. In general, these plugins only trigger for a full project analysis after all ...">FlowrAnalyzerLoadingOrderPlugin</span></code></a> base class.

<h3 id="How_to_add_a_new_plugin">How to add a new plugin</h3>

If you want to make a new plugin you first have to decide which type of plugin you want to create (see [Plugin Types](#Plugin_Types) above).
Then, you must create a new class that extends the corresponding base class (e.g., <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/file-plugins/flowr-analyzer-file-plugin.ts#L22"><code><span title="This is the base class for all plugins that load and possibly transform files when they are loaded. Different from other plugins, these plugins trigger for each file that is loaded (if they applies to the file). See the FlowrAnalyzer.addFile for more information on how files are loaded and managed. It is up to the construction to ensure that no two file plugins applies to the same file, otherwise,...">FlowrAnalyzerFilePlugin</span></code></a> for file loading plugins).
In general, most plugins operate on the [context information](#Context_Information) provided by the analyzer.
Usually it is a good idea to have a look at the existing plugins of the same type to get an idea of how to implement your own plugin.

Once you have your plugin you should register it with a sensible name using the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/plugin-registry.ts#L146"><code><span title="Register a new Flowr Analyzer plugin for the registry, to be used by the FlowrAnalyzerBuilder and FlowrAnalyzer .">registerPluginMaker</span></code></a> function.
This will allow users to register your plugin easily by name using the builder's <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer-builder.ts#L150"><code><span title="Register one or multiple additional plugins. For the default plugin set, please refer to FlowrDefaultPlugins , they can be registered by passing true to the FlowrAnalyzerBuilder constructor.">FlowrAnalyzerBuilder::<b>registerPlugins</b></span></code></a> method.
Otherwise, users will have to provide an instance of your plugin class directly.

<h2 id="Context_Information">Context Information</h2>

The <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer.ts#L203"><code><span title="Central class for conducting analyses with FlowR. Use the FlowrAnalyzerBuilder to create a new instance. If you want the original pattern of creating a pipeline and running all steps, you can still do this with FlowrAnalyzer#runFull . To inspect the context of the analyzer, use FlowrAnalyzer#inspectContext (if you are a plugin and need to modify it, use FlowrAnalyzer#context instead).">FlowrAnalyzer</span></code></a> provides various context information during the analysis.
You can access the context with <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer.ts#L238"><code>FlowrAnalyzer::<b>inspectContext</b></code></a>
to receive a read-only view of the current analysis context.
Likewise, you can use <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-context.ts#L332"><code><span title="Get a read-only version of this context. This is useful if you want to pass the context to a place where you do not want it to be modified or just to reduce the available methods.">FlowrAnalyzerContext::<b>inspect</b></span></code></a> to get a read-only view of a given context.
These read-only views prevent you from accidentally modifying the context during the analysis which may cause inconsistencies (this should be done either by
wrapping methods or by [plugins](#Plugins)).
The context is divided into multiple sub-contexts, each responsible for a specific aspect of the analysis.
These sub-contexts are described in more detail below.

For the general structure from an implementation perspective, please have a look at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-context.ts#L121"><code><span title="This summarizes the other context layers used by the FlowrAnalyzer . Have a look at the attributes and layers listed below (e.g., files and deps ) to get an idea of the capabilities provided by this context. Besides these, this layer only orchestrates the different steps and layers, providing a collection of convenience methods. In general, you do not have to worry about these details, as the Flow...">FlowrAnalyzerContext</span></code></a>.

> [!TIP]
> If you need a context for testing or to create analyses with lower-level components, you can use
> either <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-context.ts#L365"><code><span title="Lifting requestFromInput to create a full FlowrAnalyzerContext from input requests. Please use this only for a 'quick' setup, or to have compatibility with the pre-project flowR era. Otherwise, refer to a FlowrAnalyzerBuilder to create a fully customized FlowrAnalyzer instance.">contextFromInput</span></code></a> to create a context from input data (which lifts the old <a href="https://github.com/flowr-analysis/flowr/tree/main/src/r-bridge/retriever.ts#L67"><code>requestFromInput</code></a>) or
> <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-context.ts#L389"><code><span title="Create a FlowrAnalyzerContext from a set of source code strings.">contextFromSources</span></code></a> to create a context from source files (e.g., if you need a virtual file system).


If for whatever reason you need to reset the context during an analysis, you can use
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-context.ts#L339"><code><span title="Reset the context to its initial state, e.g., removing all files, dependencies, and loading orders.">FlowrAnalyzerContext::<b>reset</b></span></code></a>.

<h3 id="Files_Context">Files Context</h3>

First, let's have look at the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-files-context.ts#L205"><code><span title="This is the analyzer file context to be modified by all plugins that affect the files. If you are interested in inspecting these files, refer to ReadOnlyFlowrAnalyzerFilesContext . Plugins, however, can use this context directly to modify files.">FlowrAnalyzerFilesContext</span></code></a>  class that provides access to the files to be analyzed and their [loading order](#Loading_Order_Context):

 * [FlowrAnalyzerFilesContext](https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-files-context.ts#L205)   
   This is the analyzer file context to be modified by all plugins that affect the files.
   If you are interested in inspecting these files, refer to
   <code>ReadOnlyFlowrAnalyzerFilesContext</code>
   .
   Plugins, however, can use this context directly to modify files.
   <br/><i>(Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-files-context.ts#L205">src/project/context/flowr-analyzer-files-context.ts#L205</a>)</i>
   
    <details><summary>View more (AbstractFlowrAnalyzerContext, ReadOnlyFlowrAnalyzerFilesContext, InvalidationEventReceiver)</summary>

   * [AbstractFlowrAnalyzerContext](https://github.com/flowr-analysis/flowr/tree/main/src/project/context/abstract-flowr-analyzer-context.ts#L12)   
     Abstract class representing the context, a context may be modified and enriched by plugins (see
     <code>FlowrAnalyzerPlugin</code>
     ).
     Please use the specialized contexts like
     <code>FlowrAnalyzerFilesContext</code>
     or
     <code>FlowrAnalyzerLoadingOrderContext</code>
     to work with flowR and
     in general, use the
     <code>FlowrAnalyzerContext</code>
     to access the full project context.
     <br/><i>(Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/abstract-flowr-analyzer-context.ts#L12">src/project/context/abstract-flowr-analyzer-context.ts#L12</a>)</i>
     
   * **[ReadOnlyFlowrAnalyzerFilesContext](https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-files-context.ts#L90)**   
     This is the read-only interface for the files context, which is used to manage all files known to the
     <code>FlowrAnalyzer</code>
     .
     It prevents you from modifying the available files, but allows you to inspect them (which is probably what you want when using the
     <code>FlowrAnalyzer</code>
     ).
     If you are a
     <code>FlowrAnalyzerProjectDiscoveryPlugin</code>
     and want to modify the available files, you can use the
     <code>FlowrAnalyzerFilesContext</code>
     directly.
     <br/><i>(Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-files-context.ts#L90">src/project/context/flowr-analyzer-files-context.ts#L90</a>)</i>
     
   * **[InvalidationEventReceiver](https://github.com/flowr-analysis/flowr/tree/main/src/project/cache/flowr-cache.ts#L41)**   
   
     <br/><i>(Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/cache/flowr-cache.ts#L41">src/project/cache/flowr-cache.ts#L41</a>)</i>
     

    </details>

Using the available [plugins](#Plugins),
the files context categorizes files by their <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-file.ts#L18"><code><span title="Some files have a special meaning in R projects, e.g., the DESCRIPTION file in R packages. This list may be extended in the future and reflects files that the FlowrAnalyzer can do something interesting with. If you add an interesting file that is only part of your plugin infrastructure, please use the other role.">FileRole</span></code></a> (e.g., source files or DESCRIPTION files)
and makes them accessible by these roles (e.g., via <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-files-context.ts#L589"><code>FlowrAnalyzerFilesContext::<i>getFilesByRole</i></code></a>).
It also provides methods to check for whether a file exists (e.g., <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-files-context.ts#L451"><code>FlowrAnalyzerFilesContext::<i>hasFile</i></code></a>,
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-files-context.ts#L455"><code>FlowrAnalyzerFilesContext::<i>exists</i></code></a>)
and to translate requests so they respect the context (e.g., <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-files-context.ts#L537"><code>FlowrAnalyzerFilesContext::<i>resolveRequest</i></code></a>).

For legacy reasons it also provides the list of files considered by the dataflow analysis via
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-files-context.ts#L286"><code><span title="Get all files that have been considered during dataflow analysis.">FlowrAnalyzerFilesContext::<i>consideredFilesList</i></span></code></a>.

<h3 id="Loading_Order_Context">Loading Order Context</h3>


> [!NOTE]
> Please be aware that the loading order is inherently tied to the files context (as it determines which files are available for ordering).
> Hence, the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-loading-order-context.ts#L50"><code><span title="This context is responsible for managing the loading order of script files in a project, including guesses and known orders provided by FlowrAnalyzerLoadingOrderPlugin s. If you are interested in inspecting these orders, refer to ReadOnlyFlowrAnalyzerLoadingOrderContext . Plugins, however, can use this context directly to modify order guesses.">FlowrAnalyzerLoadingOrderContext</span></code></a> is accessible (only) via the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-files-context.ts#L205"><code><span title="This is the analyzer file context to be modified by all plugins that affect the files. If you are interested in inspecting these files, refer to ReadOnlyFlowrAnalyzerFilesContext . Plugins, however, can use this context directly to modify files.">FlowrAnalyzerFilesContext</span></code></a>.


Here is the structure of the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-loading-order-context.ts#L50"><code><span title="This context is responsible for managing the loading order of script files in a project, including guesses and known orders provided by FlowrAnalyzerLoadingOrderPlugin s. If you are interested in inspecting these orders, refer to ReadOnlyFlowrAnalyzerLoadingOrderContext . Plugins, however, can use this context directly to modify order guesses.">FlowrAnalyzerLoadingOrderContext</span></code></a> that provides access to the identified loading order of files:

 * [FlowrAnalyzerLoadingOrderContext](https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-loading-order-context.ts#L50)   
   This context is responsible for managing the loading order of script files in a project, including guesses and known orders provided by
   <code>FlowrAnalyzerLoadingOrderPlugin</code>
   s.
   If you are interested in inspecting these orders, refer to
   <code>ReadOnlyFlowrAnalyzerLoadingOrderContext</code>
   .
   Plugins, however, can use this context directly to modify order guesses.
   <br/><i>(Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-loading-order-context.ts#L50">src/project/context/flowr-analyzer-loading-order-context.ts#L50</a>)</i>
   
    <details><summary>View more (AbstractFlowrAnalyzerContext, ReadOnlyFlowrAnalyzerLoadingOrderContext)</summary>

   * [AbstractFlowrAnalyzerContext](https://github.com/flowr-analysis/flowr/tree/main/src/project/context/abstract-flowr-analyzer-context.ts#L12)   
     Abstract class representing the context, a context may be modified and enriched by plugins (see
     <code>FlowrAnalyzerPlugin</code>
     ).
     Please use the specialized contexts like
     <code>FlowrAnalyzerFilesContext</code>
     or
     <code>FlowrAnalyzerLoadingOrderContext</code>
     to work with flowR and
     in general, use the
     <code>FlowrAnalyzerContext</code>
     to access the full project context.
     <br/><i>(Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/abstract-flowr-analyzer-context.ts#L12">src/project/context/abstract-flowr-analyzer-context.ts#L12</a>)</i>
     
   * **[ReadOnlyFlowrAnalyzerLoadingOrderContext](https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-loading-order-context.ts#L14)**   
     Read-only interface for the loading order context, which is used to determine the order in which script files are loaded in a project.
     This interface prevents you from modifying the available files, but allows you to inspect them (which is probably what you want when using the
     <code>FlowrAnalyzer</code>
     ).
     If you are a
     <code>FlowrAnalyzerLoadingOrderPlugin</code>
     and want to modify the available orders, you can use the
     <code>FlowrAnalyzerLoadingOrderContext</code>
     directly.
     <br/><i>(Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-loading-order-context.ts#L14">src/project/context/flowr-analyzer-loading-order-context.ts#L14</a>)</i>
     

    </details>

Using the available [plugins](#Plugins), the loading order context determines the order in which files are loaded and analyzed by flowR's analyzer.
You can inspect the identified loading order using
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-loading-order-context.ts#L201"><code>FlowrAnalyzerLoadingOrderContext::<i>getLoadingOrder</i></code></a>.
If there are multiple possible loading orders (e.g., due to circular dependencies),
you can use <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-loading-order-context.ts#L185"><code>FlowrAnalyzerLoadingOrderContext::<i>currentGuesses</i></code></a>.

<h3 id="Dependencies_Context">Dependencies Context</h3>

Here is the structure of the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-dependencies-context.ts#L125"><code><span title="Manages the project's dependencies, their versions, and their interplay with FlowrAnalyzerPackageVersionsPlugin s.">FlowrAnalyzerDependenciesContext</span></code></a> that provides access to the identified dependencies and their versions,
including the version of R:

 * [FlowrAnalyzerDependenciesContext](https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-dependencies-context.ts#L125)   
   Manages the project's dependencies, their versions, and their interplay with
   <code>FlowrAnalyzerPackageVersionsPlugin</code>
   s.
   <br/><i>(Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-dependencies-context.ts#L125">src/project/context/flowr-analyzer-dependencies-context.ts#L125</a>)</i>
   
    <details><summary>View more (AbstractFlowrAnalyzerContext, ReadOnlyFlowrAnalyzerDependenciesContext, InvalidationEventReceiver)</summary>

   * [AbstractFlowrAnalyzerContext](https://github.com/flowr-analysis/flowr/tree/main/src/project/context/abstract-flowr-analyzer-context.ts#L12)   
     Abstract class representing the context, a context may be modified and enriched by plugins (see
     <code>FlowrAnalyzerPlugin</code>
     ).
     Please use the specialized contexts like
     <code>FlowrAnalyzerFilesContext</code>
     or
     <code>FlowrAnalyzerLoadingOrderContext</code>
     to work with flowR and
     in general, use the
     <code>FlowrAnalyzerContext</code>
     to access the full project context.
     <br/><i>(Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/abstract-flowr-analyzer-context.ts#L12">src/project/context/abstract-flowr-analyzer-context.ts#L12</a>)</i>
     
   * **[ReadOnlyFlowrAnalyzerDependenciesContext](https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-dependencies-context.ts#L20)**   
     Read-only interface to the
     <code>FlowrAnalyzerDependenciesContext</code>
     for inspecting dependencies without modifying them.
     <br/><i>(Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-dependencies-context.ts#L20">src/project/context/flowr-analyzer-dependencies-context.ts#L20</a>)</i>
     
   * **[InvalidationEventReceiver](https://github.com/flowr-analysis/flowr/tree/main/src/project/cache/flowr-cache.ts#L41)**   
   
     <br/><i>(Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/cache/flowr-cache.ts#L41">src/project/cache/flowr-cache.ts#L41</a>)</i>
     

    </details>

Probably the most important method is
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-dependencies-context.ts#L277"><code>FlowrAnalyzerDependenciesContext::<i>getDependency</i></code></a>
that allows you to query for a specific dependency by name.

<h3 id="Functions_Context">Functions Context</h3>

The <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-dependencies-context.ts#L125"><code><span title="Manages the project's dependencies, their versions, and their interplay with FlowrAnalyzerPackageVersionsPlugin s.">FlowrAnalyzerDependenciesContext</span></code></a> also provides access to the associated
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-functions-context.ts#L55"><code><span title="This context is responsible for managing the functions identified in the project, including their origins, types, and other metadata. It works in conjunction with FlowrAnalyzerPackageVersionsPlugin s to gather and maintain this information. If you are interested in inspecting these functions, refer to ReadOnlyFlowrAnalyzerFunctionsContext .">FlowrAnalyzerFunctionsContext</span></code></a> via its `functionsContext` attribute.

 * [FlowrAnalyzerFunctionsContext](https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-functions-context.ts#L55)   
   This context is responsible for managing the functions identified in the project, including their origins, types, and other metadata.
   It works in conjunction with
   <code>FlowrAnalyzerPackageVersionsPlugin</code>
   s to gather and maintain this information.
   If you are interested in inspecting these functions, refer to
   <code>ReadOnlyFlowrAnalyzerFunctionsContext</code>
   .
   <br/><i>(Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-functions-context.ts#L55">src/project/context/flowr-analyzer-functions-context.ts#L55</a>)</i>
   
    <details><summary>View more (AbstractFlowrAnalyzerContext, ReadOnlyFlowrAnalyzerFunctionsContext)</summary>

   * [AbstractFlowrAnalyzerContext](https://github.com/flowr-analysis/flowr/tree/main/src/project/context/abstract-flowr-analyzer-context.ts#L12)   
     Abstract class representing the context, a context may be modified and enriched by plugins (see
     <code>FlowrAnalyzerPlugin</code>
     ).
     Please use the specialized contexts like
     <code>FlowrAnalyzerFilesContext</code>
     or
     <code>FlowrAnalyzerLoadingOrderContext</code>
     to work with flowR and
     in general, use the
     <code>FlowrAnalyzerContext</code>
     to access the full project context.
     <br/><i>(Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/abstract-flowr-analyzer-context.ts#L12">src/project/context/abstract-flowr-analyzer-context.ts#L12</a>)</i>
     
   * **[ReadOnlyFlowrAnalyzerFunctionsContext](https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-functions-context.ts#L38)**   
     This is a read-only interface to the
     <code>FlowrAnalyzerFunctionsContext</code>
     .
     It prevents you from modifying the functions, but allows you to inspect them (which is probably what you want when using the
     <code>FlowrAnalyzer</code>
     ).
     If you are a
     <code>FlowrAnalyzerPackageVersionsPlugin</code>
     and want to modify the functions, you can use the
     <code>FlowrAnalyzerFunctionsContext</code>
     directly.
     <br/><i>(Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-functions-context.ts#L38">src/project/context/flowr-analyzer-functions-context.ts#L38</a>)</i>
     

    </details>

Probably the most important method is
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-functions-context.ts#L105"><code>FlowrAnalyzerFunctionsContext::<i>getFunctionInfo</i></code></a>
that allows you to query for a specific function by name.

<h3 id="Environment_Context">Environment Context</h3>

Here is the structure of the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-environment-context.ts#L83"><code><span title="Provides the built-in environment, created from the FlowrAnalyzerContext configuration.">FlowrAnalyzerEnvironmentContext</span></code></a> that provides access to the built-in environment:

 * [FlowrAnalyzerEnvironmentContext](https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-environment-context.ts#L83)   
   Provides the built-in environment, created from the
   <code>FlowrAnalyzerContext</code>
   configuration.
   <br/><i>(Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-environment-context.ts#L83">src/project/context/flowr-analyzer-environment-context.ts#L83</a>)</i>
   
    <details><summary>View more (ReadOnlyFlowrAnalyzerEnvironmentContext)</summary>

   * **[ReadOnlyFlowrAnalyzerEnvironmentContext](https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-environment-context.ts#L16)**   
     Read-only interface to the
     <code>FlowrAnalyzerEnvironmentContext</code>
     .
     <br/><i>(Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-environment-context.ts#L16">src/project/context/flowr-analyzer-environment-context.ts#L16</a>)</i>
     

    </details>

The environment context provides access to the built-in environment via
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-environment-context.ts#L175"><code>FlowrAnalyzerEnvironmentContext::<i>makeCleanEnv</i></code></a>.
It also provides the empty built-in environment, which only contains primitives, via
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-environment-context.ts#L189"><code>FlowrAnalyzerEnvironmentContext::<i>makeCleanEnvWithEmptyBuiltIns</i></code></a>.

<h3 id="Meta_Context">Meta Context</h3>

This <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-meta-context.ts#L112"><code><span title="This is the context responsible for managing the project metadata such as name, version, title, and namespace. The metadata is source-agnostic: plugins  contribute whatever their file declares (DESCRIPTION, rproject.toml, a lockfile, ...) and consumers read it from here rather than from any particular file. Conflicts are settled by MetaPriority , so contributions are order-independent. If you are ...">FlowrAnalyzerMetaContext</span></code></a> provides access to the project metadata such as name, version, and namespace:
 * [FlowrAnalyzerMetaContext](https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-meta-context.ts#L112)   
   This is the context responsible for managing the project metadata such as name, version, title, and namespace.
   The metadata is source-agnostic: plugins
   <code> contribute</code>
   whatever their
   file declares (`DESCRIPTION`, `rproject.toml`, a lockfile, ...) and consumers read it from here rather than from
   any particular file. Conflicts are settled by
   <code>MetaPriority</code>
   , so contributions are order-independent.
   If you are interested in inspecting this metadata, refer to
   <code>ReadOnlyFlowrAnalyzerMetaContext</code>
   .
   <br/><i>(Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-meta-context.ts#L112">src/project/context/flowr-analyzer-meta-context.ts#L112</a>)</i>
   
    <details><summary>View more (ReadOnlyFlowrAnalyzerMetaContext, InvalidationEventReceiver)</summary>

   * **[ReadOnlyFlowrAnalyzerMetaContext](https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-meta-context.ts#L59)**   
   
     <br/><i>(Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-meta-context.ts#L59">src/project/context/flowr-analyzer-meta-context.ts#L59</a>)</i>
     
   * **[InvalidationEventReceiver](https://github.com/flowr-analysis/flowr/tree/main/src/project/cache/flowr-cache.ts#L41)**   
   
     <br/><i>(Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/cache/flowr-cache.ts#L41">src/project/cache/flowr-cache.ts#L41</a>)</i>
     

    </details>

You can access the project name via
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-meta-context.ts#L154"><code>FlowrAnalyzerMetaContext::<i>getProjectName</i></code></a>,
the project version via
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-meta-context.ts#L162"><code>FlowrAnalyzerMetaContext::<i>getProjectVersion</i></code></a>,
and the project namespace via
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-meta-context.ts#L170"><code>FlowrAnalyzerMetaContext::<i>getNamespace</i></code></a>.

<h3 id="Gas_Context">Gas Context</h3>

The <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-gas-context.ts#L126"><code><span title="Checks heap and elapsed-time pressure for named analysis features. See ReadOnlyFlowrAnalyzerGasContext .">FlowrAnalyzerGasContext</span></code></a> (reachable as `ctx.gas`) acts as the resource guard of an analysis:

 * [FlowrAnalyzerGasContext](https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-gas-context.ts#L126)   
   Checks heap and elapsed-time pressure for named analysis features. See
   <code>ReadOnlyFlowrAnalyzerGasContext</code>
   .
   <br/><i>(Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-gas-context.ts#L126">src/project/context/flowr-analyzer-gas-context.ts#L126</a>)</i>
   
    <details><summary>View more (WriteableFlowrAnalyzerGasContext, InvalidationEventReceiver)</summary>

   * **[WriteableFlowrAnalyzerGasContext](https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-gas-context.ts#L118)**   
     The gas context as the owner of the analyzer sees it, reachable via `analyzer.context().gas`.
     Adds the operations that restart a contingent to
     <code>ReadOnlyFlowrAnalyzerGasContext</code>
     .
     <br/><i>(Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-gas-context.ts#L118">src/project/context/flowr-analyzer-gas-context.ts#L118</a>)</i>
     
      <details><summary>View more (ReadOnlyFlowrAnalyzerGasContext)</summary>

     * **[ReadOnlyFlowrAnalyzerGasContext](https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-gas-context.ts#L90)**   
       Read-only gas context exposed via `ctx.gas`.
       <br/><i>(Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-gas-context.ts#L90">src/project/context/flowr-analyzer-gas-context.ts#L90</a>)</i>
       

      </details>
   * **[InvalidationEventReceiver](https://github.com/flowr-analysis/flowr/tree/main/src/project/cache/flowr-cache.ts#L41)**   
   
     <br/><i>(Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/cache/flowr-cache.ts#L41">src/project/cache/flowr-cache.ts#L41</a>)</i>
     

    </details>

Expensive analysis sites ask for the current resource pressure with
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-gas-context.ts#L276"><code>FlowrAnalyzerGasContext::<i>checkGas</i></code></a>, passing the name of the feature they are about to run
(see <a href="https://github.com/flowr-analysis/flowr/tree/main/src/gas.ts#L20"><code><span title="Known feature keys accepted by ReadOnlyFlowrAnalyzerGasContext.checkGas , each a sensitivity factor in FlowrGasConfig.features .">GasFeatureKey</span></code></a>), and may then degrade or skip their work.
The level combines the current heap usage and the time elapsed within the contingent of the current operation,
each scaled by the per-feature factor from `config.gas.features` and compared against the thresholds
configured for that key (see <a href="https://github.com/flowr-analysis/flowr/tree/main/src/gas.ts#L47"><code><span title="Thresholds for one gas dimension, either as one pair for every feature or split per GasFeatureKey . Per bound, a feature entry wins over default, which wins over the direct pair. A bound nowhere given never triggers.">GasThresholdSpec</span></code></a>).
Registered <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/plugins/gas-plugins/flowr-analyzer-gas-plugin.ts#L19"><code><span title="Base class for gas plugins, queried on-demand by FlowrAnalyzerGasContext.checkGas . Override process to provide a custom resource-pressure assessment for a feature key. Return undefined to defer to the built-in memory and time checks. Multiple Gas plugins are combined by taking the maximum ( GasLevel ) returned by any plugin or by the built-in checks. A gas plugin is the right place to add domain-...">FlowrAnalyzerGasPlugin</span></code></a>s may escalate the level for any key.

Every operation gets a contingent of its own, and anything beginning a new analysis (an added file, a cache
invalidation, a <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-context.ts#L339"><code><span title="Reset the context to its initial state, e.g., removing all files, dependencies, and loading orders.">FlowrAnalyzerContext::<b>reset</b></span></code></a>) restarts it. To restart it between your own
phases, call <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-gas-context.ts#L151"><code><span title="Restart the contingent, so what follows is measured from now. Supported API: call it between phases that should each get the full allowance (analyzer.context().gas.reset()).  flowR calls it itself whenever a new analysis begins, so a caller only has to split its *own* phases. Operations in flight keep their contingent, as restarting a running traversal's clock would defeat the guard bounding it.">FlowrAnalyzerGasContext::<i>reset</i></span></code></a> on the
writeable context (`analyzer.context().gas.reset()`). To bound a single call, pass `gas` overrides to it
(`analyzer.query([...], { gas: { slicer: { critical: 30_000 } } })`) or derive a bounded view with
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-gas-context.ts#L189"><code>FlowrAnalyzerGasContext::<i>scope</i></code></a>.


> [!NOTE]
> Gas is disabled for every feature by default, and with no gas plugins registered
> <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-gas-context.ts#L276"><code>FlowrAnalyzerGasContext::<i>checkGas</i></code></a> returns `GasLevel.Normal` without measuring anything.
> See the [gas section of the Core wiki page](https://github.com/flowr-analysis/flowr/wiki/Core#gas-resource-guard) for the levels, the configuration, and how to write a gas plugin.


<h3 id="Incremental_Analysis_Context">Incremental Analysis Context</h3>

The <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-incremental-analysis-context.ts#L35"><code><span title="Information to carry over for future incremental builds">FlowrAnalyzerIncrementalAnalysisContext</span></code></a> is a context that stores analysis information needed for making the next analysis run incremental by reusing the previous analysis results:

 * [FlowrAnalyzerIncrementalAnalysisContext](https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-incremental-analysis-context.ts#L35)   
   Information to carry over for future incremental builds
   <br/><i>(Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-incremental-analysis-context.ts#L35">src/project/context/flowr-analyzer-incremental-analysis-context.ts#L35</a>)</i>
   
    <details><summary>View more (ReadOnlyFlowrAnalyzerIncrementalAnalysisContext, InvalidationEventReceiver)</summary>

   * **[ReadOnlyFlowrAnalyzerIncrementalAnalysisContext](https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-incremental-analysis-context.ts#L11)**   
   
     <br/><i>(Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-incremental-analysis-context.ts#L11">src/project/context/flowr-analyzer-incremental-analysis-context.ts#L11</a>)</i>
     
   * **[InvalidationEventReceiver](https://github.com/flowr-analysis/flowr/tree/main/src/project/cache/flowr-cache.ts#L41)**   
   
     <br/><i>(Defined at <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/cache/flowr-cache.ts#L41">src/project/cache/flowr-cache.ts#L41</a>)</i>
     

    </details>

This context is not an analysis-result cache by itself.
Instead, it carries forward the minimal state needed by future incremental phases after an invalidation happened.
At the moment, it is used for incremental parsing with Tree-sitter, but it is intended to become the shared context for additional incremental analysis stages as well.

If the analyzer or context is reset, the incremental information is discarded via
<a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-incremental-analysis-context.ts#L51"><code>FlowrAnalyzerIncrementalAnalysisContext::<i>reset</i></code></a>.
In other words, this context only transports incremental handoff state between analysis runs.

<h4 id="Incremental_Parsing">Incremental Parsing</h4>

This context is used to exploit Tree-sitter's incremental parsing feature.
For one file, the incremental state follows a fixed lifecycle:

1. After a successful parse-oriented analysis run, the analyzer cache stores the latest Tree-sitter parse tree via
   <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-incremental-analysis-context.ts#L145"><code>FlowrAnalyzerIncrementalAnalysisContext::<i>storeOldParseResults</i></code></a>.
   This tree is the baseline for the next incremental parse of that file.
2. When a mutable file provider such as <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-file.ts#L222"><code><span title="A basic implementation of the FlowrFileProvider interface for (constant) inline text files. This is also useful for 'special' files like the DESCRIPTION file in R packages that you want to pass in directly. These will be handled by the FlowrAnalyzerDescriptionFilePlugin (e.g., by using the FlowrDescriptionFile#from method decorator).">FlowrInlineTextFile</span></code></a> is invalidated via
   <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-file.ts#L199"><code>FlowrFile::<i>invalidate</i></code></a>,
   the analyzer receives a file invalidation event and stores the file path together with the old source text.
   If the same file is invalidated again before the next parse, this stored old text is intentionally **not** replaced:
   the stored parse tree still belongs to the version from before the first invalidation, so the incremental parse must keep that matching old-content baseline.
3. When parsing is requested again, flowR retrieves
   * the previous parse tree from
     <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-incremental-analysis-context.ts#L156"><code>FlowrAnalyzerIncrementalAnalysisContext::<i>getOldParseResultOf</i></code></a>
   * the stored old source text from
     <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/context/flowr-analyzer-incremental-analysis-context.ts#L160"><code>FlowrAnalyzerIncrementalAnalysisContext::<i>getOldContentOf</i></code></a>

   Using these together with the current file content, <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/incremental/incremental-parse/edit-computation.ts#L9"><code><span title="Computes a single minimal change region ( Parser.Edit ) that contains all modifications.">computeEditRegion</span></code></a> derives a minimal tree-sitter `Parser.Edit`, only when a new parse is actually requested.
   If the file content did not change, the previous tree can be reused directly.
   Otherwise, the edit is applied to the previous tree and Tree-sitter reparses incrementally instead of starting from scratch.
4. The stored old-content entry is removed when it is used because it belongs only to that previous parse snapshot.
   After the new parse succeeds, the analyzer stores a new parse tree baseline.
   A later invalidation must then be able to record a fresh old-content value that matches this new tree.
   If the old-content entry were kept, later invalidations of the same file would not replace it, and the next incremental parse could compare the current file content against stale old text that no longer matches the stored previous tree.

<h4 id="Incremental_Dataflow">Incremental Dataflow</h4>

This context is planned to also support future incremental dataflow graph computation.


<h2 id="Caching">Caching</h2>

To speed up analyses, flowR provides a caching mechanism that stores intermediate results of the analysis.
The cache is maintained by the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/cache/flowr-analyzer-cache.ts#L45"><code><span title="This provides the full analyzer caching layer, please avoid using this directly and prefer the FlowrAnalyzer .">FlowrAnalyzerCache</span></code></a> class and is used automatically by the analyzer during the analysis.
Underlying, it relies on the <a href="https://github.com/flowr-analysis/flowr/tree/main/src/core/pipeline-executor.ts#L97"><code><span title="**Please note:** The PipelineExecutor is now considered to be a rather low-level API for flowR. While it still works and is the basis for all other layers, we strongly recommend using the FlowrAnalyzer and its builder to create and use an analyzer instance that is pre-configured for your use-case. The pipeline executor allows to execute arbitrary pipelines in a step-by-step fashion. If you are not...">PipelineExecutor</span></code></a> to cache results of different pipeline stages.

Usually, you do not have to worry about the cache, as it is managed automatically by the analyzer.
If you want to overwrite cache information, the analysis methods in <a href="https://github.com/flowr-analysis/flowr/tree/main/src/project/flowr-analyzer.ts#L203"><code><span title="Central class for conducting analyses with FlowR. Use the FlowrAnalyzerBuilder to create a new instance. If you want the original pattern of creating a pipeline and running all steps, you can still do this with FlowrAnalyzer#runFull . To inspect the context of the analyzer, use FlowrAnalyzer#inspectContext (if you are a plugin and need to modify it, use FlowrAnalyzer#context instead).">FlowrAnalyzer</span></code></a> (see [Conducting Analyses](#Conducting_Analyses) above)
usually provide an optional `force` parameter to control whether to use the cache or recompute the results.
