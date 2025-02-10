import { RShell } from '../r-bridge/shell';
import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';


import { autoGenHeader } from './doc-util/doc-auto-gen';
import { block, details } from './doc-util/doc-structure';
import { FlowrWikiBaseRef } from './doc-util/doc-files';
import { getCliLongOptionOf, getReplCommand } from './doc-util/doc-cli-option';
import { getTypesFromFolderAsMermaid, mermaidHide, printHierarchy, shortLink } from './doc-util/doc-types';
import path from 'path';
import { codeBlock } from './doc-util/doc-code';
import { produceDataFlowGraph } from '../dataflow/extractor';
import { parseRequests } from '../r-bridge/parser';
import { normalize } from '../r-bridge/lang-4.x/ast/parser/json/parser';
import { documentReplSession } from './doc-util/doc-repl';
import { printDfGraphForCode } from './doc-util/doc-dfg';
import { printNormalizedAstForCode } from './doc-util/doc-normalized-ast';
import { initCommand } from '../r-bridge/init';
import { convertPreparedParsedData, prepareParsedData } from '../r-bridge/lang-4.x/ast/parser/json/format';
import { normalizeRootObjToAst } from '../r-bridge/lang-4.x/ast/parser/main/internal/structure/normalize-root';
import { decorateAst } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { processUninterestingLeaf } from '../dataflow/internal/process/process-uninteresting-leaf';
import { processAccess } from '../dataflow/internal/process/functions/call/built-in/built-in-access';
import { processForLoop } from '../dataflow/internal/process/functions/call/built-in/built-in-for-loop';
import { processRepeatLoop } from '../dataflow/internal/process/functions/call/built-in/built-in-repeat-loop';
import { linkCircularRedefinitionsWithinALoop } from '../dataflow/internal/linker';
import { staticSlicing } from '../slicing/static/static-slicer';
import { filterOutLoopExitPoints, initializeCleanDataflowInformation } from '../dataflow/info';
import { processDataflowFor } from '../dataflow/processor';
import { createDataflowPipeline } from '../core/steps/pipeline/default-pipelines';
import { TreeSitterExecutor } from '../r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';

async function getText(shell: RShell) {
	const rversion = (await shell.usedRVersion())?.format() ?? 'unknown';
	const sampleCode = 'x <- 1; print(x)';
	const { info, program } = getTypesFromFolderAsMermaid({
		rootFolder:  path.resolve('./src'),
		typeName:    RShell.name,
		inlineTypes: mermaidHide
	});

	return `${autoGenHeader({ filename: module.filename, purpose: 'core', rVersion: rversion })}

This wiki page provides an overview of the inner workings of _flowR_.
It is mostly intended for developers that want to extend the capabilities of _flowR_
and assumes knowledge of [TypeScript](https://www.typescriptlang.org/) and [R](https://www.r-project.org/).

${block({
		type:    'NOTE',
		content: `
Essentially every step we explain here can be explored directly from flowR's REPL in an interactive fashion (see the [Interface](${FlowrWikiBaseRef}/Interface#using-the-repl) wiki page).
We recommend to use commands like ${getReplCommand('parse')} or ${getReplCommand('dataflow', true)} to explore the output of flowR using your own samples.
As a quickstart you may use:

${await documentReplSession(shell, [{
		command:     `:parse "${sampleCode}"`,
		description: `Retrieves the AST from the ${shortLink(RShell.name,info)}.`
	}])}
	
If you are brave (or desperate) enough, you can also try to use the ${getCliLongOptionOf('flowr', 'verbose')} option to be dumped with information about flowR's internals (please, never use this for benchmarking).
`
	})}
	
* [Pipelines and their Execution](#pipelines-and-their-execution)
* [How flowR Produces Dataflow Graphs](#how-flowr-produces-dataflow-graphs)
  * [Overview](#overview)
  * [Parsing](#parsing)
  * [Normalization](#normalization)
  * [Dataflow Graph Generation](#dataflow-graph-generation)
* [Beyond the Dataflow Graph](#beyond-the-dataflow-graph)
  * [Static Backward Slicing](#static-backward-slicing)
	
## Pipelines and their Execution

At the core of every analysis by flowR is the ${shortLink('PipelineExecutor', info)} class which takes a sequence of analysis steps (in the form of a ${shortLink('Pipeline', info)}) and executes it
on a given input. In general, these pipeline steps are analysis agnostic and may use arbitrary input and ordering. However, two important and predefined pipelines, 
the ${shortLink('DEFAULT_DATAFLOW_PIPELINE', info)} and the ${shortLink('TREE_SITTER_DATAFLOW_PIPELINE', info)} adequately cover the most common analysis steps (differentiated only by the [Engine](${FlowrWikiBaseRef}/Engines) used).

${block({
		type:    'TIP',
		content: `
	You can hover over most links within these wiki pages to get access to the tsdoc comment of the respective element. 
	The links should direct you to the up-to-date implementation.
`
	})}
	
Using the [\`tree-sitter\` engine](${FlowrWikiBaseRef}/Engines) you can request a dataflow analysis of a sample piece of R code like the following:

${codeBlock('typescript', `
const executor = new PipelineExecutor(TREE_SITTER_DATAFLOW_PIPELINE, {
	parser:  new TreeSitterExecutor(),
	request: requestFromInput('x <- 1; y <- x; print(y);')
});
const result = await executor.allRemainingSteps();
`)}

This is, roughly, what the ${shortLink('replGetDataflow', info)} function does for the ${getReplCommand('dataflow')} REPL command when using the [\`tree-sitter\` engine](${FlowrWikiBaseRef}/Engines).
In general, however, most flowR-internal function which are tasked with generating dataflow prefer the use of ${createDataflowPipeline.name} as this function
automatically selects the correct pipeline based on the engine used.

### Understanding Pipeline Steps

Everything that complies to the ${shortLink('IPipelineStep', info)} interface can be used as a step in a pipeline, with the most important definition being the
\`processor\` function, which refers to the actual work performed by the step.
For example, the ${shortLink('STATIC_DATAFLOW', info)} step ultimately relies on the ${shortLink(produceDataFlowGraph.name, info)} function to create a [dataflow graph](${FlowrWikiBaseRef}/Dataflow-Graph) 
using the [normalized AST](${FlowrWikiBaseRef}/Normalized-AST) of the program.

### Shape of a Pipeline Step

Using code, you can provide an arbitrary pipeline step to the executor, as long as it implements the ${shortLink('IPipelineStep', info)} interface:

${printHierarchy({ program, info, root: 'IPipelineStep', maxDepth: 0 })}

Every step may specify required inputs, ways of visualizing the output, and its dependencies using the ${shortLink('IPipelineStepOrder', info)} interface.
As the types may seem to be somewhat confusing or over-complicated, we recommend you to look at some of the existing steps, like 
the ${shortLink('PARSE_WITH_R_SHELL_STEP', info)} or the ${shortLink('STATIC_DATAFLOW', info)} step.
The pipeline executor should do a good job of scheduling these steps, and inferring the required inputs in the type system (have a look at the ${shortLink('createPipeline', info)} function if you want to know more).

${block({
		type:    'NOTE',
		content: `
Under the hood there is a step-subtype called a decoration. Such a step can be added to a pipeline to decorate the output of another one (e.g., making it more precise, re-adding debug info, ...).
To mark a step as a decoration, you can use the \`decorates\` field in the ${shortLink('IPipelineStepOrder', info)} interface.
However, as such steps are currently not relevant for any of flowR's core analyses we will not go into detail here. It suffices to know how "real" steps work.
`
	})}
	
## How flowR Produces Dataflow Graphs

This section focuses on the generation of a [dataflow graph](${FlowrWikiBaseRef}/Dataflow-Graph) from a given R program, using the [RShell Engine](${FlowrWikiBaseRef}/Engines) and hence the 
${shortLink('DEFAULT_DATAFLOW_PIPELINE', info)}. The [\`tree-sitter\` engine](${FlowrWikiBaseRef}/Engines) uses the ${shortLink('TREE_SITTER_DATAFLOW_PIPELINE', info)}), 
which replaces the parser with the integrated tree-sitter parser and hence uses a slightly adapted normalization step to produce a similar [normalized AST](${FlowrWikiBaseRef}/Normalized-AST).
The [dataflow graph](${FlowrWikiBaseRef}/Dataflow-Graph) should be the same for both engines (although [\`tree-sitter\`](${FlowrWikiBaseRef}/Engines) is faster and may be able to parse more files).

### Overview

Let's have a look at the definition of the pipeline:

${printHierarchy({ program, info, root: 'DEFAULT_DATAFLOW_PIPELINE', maxDepth: 0 })}

We can see that it relies on three steps:

1. **${shortLink('PARSE_WITH_R_SHELL_STEP', info, false)}** ([parsing](#parsing)): Uses the ${shortLink(RShell.name, info)} to parse the input program.\\
   _Its main function linked as the processor is the ${shortLink(parseRequests.name, info, false)} function._
2. **${shortLink('NORMALIZE', info, false)}** ([normalization](#normalization)):  Normalizes the AST produced by the parser (to create a [normalized AST](${FlowrWikiBaseRef}/Normalized-AST)).\\
   _Its main function linked as the processor is the ${shortLink(normalize.name, info, false)} function._
3. **${shortLink('STATIC_DATAFLOW', info, false)}** ([dataflow](#dataflow-graph-generation)): Produces the actual [dataflow graph](${FlowrWikiBaseRef}/Dataflow-Graph) from the normalized AST.\\
   _Its main function linked as the processor is the ${shortLink(produceDataFlowGraph.name, info, false)} function._

To explore these steps, let's use the REPL with the (very simple and contrived) R code: \`${sampleCode}\`.

${await documentReplSession(shell, [{
		command:     `:parse "${sampleCode}"`,
		description: `This shows the ASCII-Art representation of the parse-tree of the R code \`${sampleCode}\`, as it is provided by the ${shortLink(RShell.name,info)}. See the ${shortLink(initCommand.name, info)} function for more information on how we request a parse.`
	},
	{
		command:     `:normalize* "${sampleCode}"`,	
		description: `Following the link output should show the following:\n${await printNormalizedAstForCode(shell, sampleCode, { showCode: false })}`
	},
	{
		command:     `:dataflow* "${sampleCode}"`,
		description: `Following the link output should show the following:\n${await printDfGraphForCode(shell, sampleCode, { showCode: false })}`
	}
	], { openOutput: false })}
	
Especially when you are just starting with flowR, we recommend to use the REPL to explore the output of the different steps.

${block({ 
		type:    'NOTE', 
		content: 'Maybe you are left with the question on what is tree-sitter doing different. Expand the following to get more information!\n\n' + details('And what changes with tree-sitter?', `

Essentially not much! Have a look at the [Engines](${FlowrWikiBaseRef}/Engines) wiki page for more information on the differences between the engines.
Below you can see the Repl commands for the tree-sitter engine:

${await (async() => {
		const exec = new TreeSitterExecutor(); 
		return await documentReplSession(exec, [{
			command:     `:parse "${sampleCode}"`,
			description: `This shows the ASCII-Art representation of the parse-tree of the R code \`${sampleCode}\`, as it is provided by the ${shortLink(TreeSitterExecutor.name, info)}. See the [Engines](${FlowrWikiBaseRef}/Engines) wiki page for more information on the differences between the engines.`
		},
		{
			command:     `:normalize* "${sampleCode}"`,
			description: `Following the link output should show the following:\n${await printNormalizedAstForCode(exec, sampleCode, { showCode: false })}`
		},
		{
			command:     `:dataflow* "${sampleCode}"`,
			description: `Following the link output should show the following:\n${await printDfGraphForCode(exec, sampleCode, { showCode: false })}`
		}], { openOutput: false, args: '--default-engine tree-sitter' });
	}
	)()}
`) })}

### Parsing

This uses the ${shortLink(RShell.name, info)} to parse the input program.
To speed up the process, we use the ${shortLink(initCommand.name, info)} function to compile the parsing function and rely on a 
custom serialization.

_This is currently work in progress._


### Normalization

The normalization takes the output from the previous steps and uses the ${shortLink(prepareParsedData.name, info)} and 
${shortLink(convertPreparedParsedData.name, info)} functions to
first transform the serialized parsing output to an object. Next, ${shortLink(normalizeRootObjToAst.name, info)} transforms this object to
an normalized AST and ${shortLink(decorateAst.name, info)} adds additional information to the AST (like roles, ids, depth, etc.).

_This is currently work in progress._

### Dataflow Graph Generation

The core of the dataflow graph generation works as a "stateful [fold](https://en.wikipedia.org/wiki/Fold_(higher-order_function))", 
which uses the tree-like structure of the AST to combine the dataflow information of the children, while tracking the currently active variables and control flow 
information as a "backpack" (state).	
We use the ${shortLink(produceDataFlowGraph.name, info)} function as an entry point to the dataflow generation (the actual fold entry is in ${shortLink(processDataflowFor.name, info)}).
The function is mainly backed by its ${shortLink('processors', info)} object which maps each type in the normalized AST to an appropriate handler ("fold-function").

To understand these handlers, let's start with the simplest one, ${shortLink(processUninterestingLeaf.name, info)} signals that 
we do not care about this node and just produce an empty dataflow information (using ${shortLink(initializeCleanDataflowInformation.name, info)}). 
Looking at the function showcases the general structure of a processor:

${printHierarchy({ program, info, root: 'processUninterestingLeaf', maxDepth: 2, openTop: true })}

Every processor has the same shape. It takes the normalized node (see the [normalized AST](${FlowrWikiBaseRef}/Normalized-AST) for more information),
and a ${shortLink('DataflowProcessorInformation', info)} object which, as some kind of "backpack" carries global information
to every handler. 
This information is to be used to create a ${shortLink('DataflowInformation', info)}:

${printHierarchy({ program, info, root: 'DataflowInformation', maxDepth: 2 })}

Essentially, these processors should use the dataflow information from their children combined with their own semantics
to produce a new dataflow information to pass upwards in the fold. The ${shortLink('DataflowInformation', info)} contains:

* the ${shortLink('DataflowGraph', info)} of the current sub-tree 
* the currently active ${shortLink('REnvironmentInformation', info)} as an abstraction of all active definitions linking to potential definition locations (see [Advanced R::Environments](https://adv-r.hadley.nz/environments.html))
* control flow information in ${shortLink('DataflowCfgInformation', info)} which is used to enrich the dataflow information with control flow information
* and sets of currently ingoing (read), outgoing (write) and unknown ${shortLink('IdentifierReference', info)}s.

While all of them are essentially empty when processing an "uninteresting leaf", handling a constant is slightly more interesting with ${shortLink('processValue', info)}:

${printHierarchy({ program, info, root: 'processValue', maxDepth: 2, openTop: true })}

Please note, that we add the [value vertex](${FlowrWikiBaseRef}/Dataflow-Graph#value-vertex) to the newly created dataflow graph,
which holds a reference to the constant. 

But again, this is not very interesting. When looking at the ${shortLink('processors', info)} object you may be confused by
many lines just mapping the node to the ${shortLink('processAsNamedCall', info)} function.
This is because during the dataflow analysis we actually "desugar" the AST, and treat syntax constructs like binary operators (e.g. \`x + y\`) as function calls (e.g. \`\` \`+\`(x, y) \`\`).
We do this, because R does it the same way, and allows to even overwrite these operators (including \`if\`, \`<-\`, etc.) by their name.
By treating them like R, as function calls, we get support for these overwrites for free, courtesy of flowR's call resolution.

But where are all of the interesting things handled then? 
For that, we want to have a look at the built-in environment, which can be freely configured using flowR's [configuration system](${FlowrWikiBaseRef}/Interface#configuring-flowr).
FlowR's heart and soul resides in the ${shortLink('DefaultBuiltinConfig', info)} object, which is used to configure the built-in environment
by mapping function names to ${shortLink('BuiltInProcessorMapper', info)} functions.
There you can find functions like ${shortLink(processAccess.name, info)} which handles the (subset) access to a variable, 
or ${shortLink(processForLoop.name, info)} which handles the primitive for loop construct (whenever it is not overwritten).

Just as an example, we want to have a look at the ${shortLink(processRepeatLoop.name, info)} function, as it is one of the simplest built-in processors
we have:

${printHierarchy({ program, info, root: 'processRepeatLoop', maxDepth: 2, openTop: true })}

Similar to any other built-in processor, we get the name of the function call which caused us to land here,
as well as the passed arguments. The \`rootId\` refers to what caused the call to happen (and is usually just the function call),
while \`data\` is our good old backpack, carrying all the information we need to produce a dataflow graph.

After a couple of common sanity checks at the beginning which we use to check whether the repeat loop is used in a way that we expect,
we start by issuing the fold continuation by processing its arguments. Given we expect \`repeat <body>\`, we expect only a single argument.
During the processing we make sure to stitch in the correct control dependencies, adding the repeat loop to the mix.
For just the repeat loop the stitching is actually not necessary, but this way the handling is consistent for all looping constructs.

Afterwards, we tak the \`processedArguments\`, perform another round of sanity checks and then use two special functions to apply the
semantic effects of the repeat loop. We first use one of flowR's linkers to
${shortLink(linkCircularRedefinitionsWithinALoop.name, info)} and then retrieve the active exit points with ${shortLink(filterOutLoopExitPoints.name, info)}.

_This is currently work in progress._
Feel free to have a look around and explore the other handlers for now. Each of them uses the results of its children alongside the active backpack 
to produce a new dataflow information.

## Beyond the Dataflow Graph

Given the [dataflow graph](${FlowrWikiBaseRef}/Dataflow-Graph), you can do a lot more!
You can issue [queries](${FlowrWikiBaseRef}/Query-API) to explore the graph, or, for example, request a [static backward slice](#static-backward-slicing).
Of course, all of these endeavors work not just with the ${shortLink(RShell.name, info)} but also with the [\`tree-sitter\` engine](${FlowrWikiBaseRef}/Engines). 

### Static Backward Slicing 

The slicing is available as an extra step as you can see by inspecting he ${shortLink('DEFAULT_SLICING_PIPELINE', info)}.
Besides ${shortLink('STATIC_SLICE', info)} it contains a ${shortLink('NAIVE_RECONSTRUCT', info)} to print the slice as (executable) R code.

Your main point of interesting here is the ${shortLink(staticSlicing.name, info)} function which relies on a modified
breadth-first search to collect all nodes which are part of the slice. 
For more information on how the slicing works, please refer to the [tool demonstration (Section 3.2)](https://doi.org/10.1145/3691620.3695359),
or the [original master's thesis (Chapter 4)](http://dx.doi.org/10.18725/OPARU-50107).

You can explore the slicing using the REPL with the ${getReplCommand('slicer')} command:

${await documentReplSession(shell, [{
		command:     ':slicer test/testfiles/example.R --criterion "12@product"',
		description: 'Slice for the example file for the variable "prod" in line 12.'
	}], { openOutput: true })}
`;
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
