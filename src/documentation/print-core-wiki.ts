import { RShell } from '../r-bridge/shell';
import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { expensiveTrace, FlowrLogger, LogLevel } from '../util/log';
import { autoGenHeader } from './doc-util/doc-auto-gen';
import { block, details } from './doc-util/doc-structure';
import { FlowrWikiBaseRef, RemoteFlowrFilePathBaseRef } from './doc-util/doc-files';
import { getCliLongOptionOf, getReplCommand } from './doc-util/doc-cli-option';
import { getTypesFromFolderAsMermaid, mermaidHide, printHierarchy, shortLink } from './doc-util/doc-types';
import path from 'path';
import { codeBlock } from './doc-util/doc-code';
import { produceDataFlowGraph } from '../dataflow/extractor';
import { parseRequests } from '../r-bridge/parser';
import { normalize, normalizeButNotDecorated } from '../r-bridge/lang-4.x/ast/parser/json/parser';
import { documentReplSession } from './doc-util/doc-repl';
import { printDfGraphForCode } from './doc-util/doc-dfg';
import { printNormalizedAstForCode } from './doc-util/doc-normalized-ast';
import { initCommand } from '../r-bridge/init';
import { convertPreparedParsedData, prepareParsedData } from '../r-bridge/lang-4.x/ast/parser/json/format';
import { normalizeRootObjToAst } from '../r-bridge/lang-4.x/ast/parser/main/internal/structure/normalize-root';
import { decorateAst, deterministicCountingIdGenerator } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { processUninterestingLeaf } from '../dataflow/internal/process/process-uninteresting-leaf';
import { processAccess } from '../dataflow/internal/process/functions/call/built-in/built-in-access';
import { processForLoop } from '../dataflow/internal/process/functions/call/built-in/built-in-for-loop';
import { processRepeatLoop } from '../dataflow/internal/process/functions/call/built-in/built-in-repeat-loop';
import { linkCircularRedefinitionsWithinALoop } from '../dataflow/internal/linker';
import { staticSlicing } from '../slicing/static/static-slicer';
import { filterOutLoopExitPoints, initializeCleanDataflowInformation } from '../dataflow/info';
import { processDataflowFor } from '../dataflow/processor';
import {
	createDataflowPipeline,
	createNormalizePipeline,
	createParsePipeline, TREE_SITTER_PARSE_PIPELINE
} from '../core/steps/pipeline/default-pipelines';
import { TreeSitterExecutor } from '../r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { fileProtocol, requestFromInput, retrieveParseDataFromRCode } from '../r-bridge/retriever';
import { jsonReplacer } from '../util/json';
import { foldAstStateful } from '../r-bridge/lang-4.x/ast/model/processing/stateful-fold';
import { normalizeSingleNode } from '../r-bridge/lang-4.x/ast/parser/main/internal/structure/normalize-single-node';
import { tryNormalizeIfThen } from '../r-bridge/lang-4.x/ast/parser/main/internal/control/normalize-if-then';
import { tryNormalizeFor } from '../r-bridge/lang-4.x/ast/parser/main/internal/loops/normalize-for';
import { NewIssueUrl } from './doc-util/doc-issue';
import { PipelineExecutor } from '../core/pipeline-executor';
import { createPipeline } from '../core/steps/pipeline/pipeline';

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
If you think parts of the wiki are missing, wrong, or outdated, please do not hesitate to [open a new issue](${NewIssueUrl})!
In case you are new and want to develop for flowR, please check out the relevant [Setup](${FlowrWikiBaseRef}/Setup#-developing-for-flowr) wiki page
and the [Contributing Guidelines](${RemoteFlowrFilePathBaseRef}/.github/CONTRIBUTING.md).

${block({
	type:    'NOTE',
	content: `
Essentially every step we explain here can be explored directly from flowR's REPL in an interactive fashion (see the [Interface](${FlowrWikiBaseRef}/Interface#using-the-repl) wiki page).
We recommend to use commands like ${getReplCommand('parse')} or ${getReplCommand('dataflow*')} to explore the output of flowR using your own samples.
As a quickstart you may use:

${await documentReplSession(shell, [{
	command:     `:parse "${sampleCode}"`,
	description: `Retrieves the AST from the ${shortLink(RShell.name,info)}.`
}])}
	
If you are brave (or desperate) enough, you can also try to use the ${getCliLongOptionOf('flowr', 'verbose')} option to be dumped with information about flowR's internals (please, never use this for benchmarking).
See the [Getting flowR to Talk](#getting-flowr-to-talk) section below for more information.
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
* [Getting flowR to Talk](#getting-flowr-to-talk)
	
## Pipelines and their Execution

At the core of every analysis by flowR is the ${shortLink(PipelineExecutor.name, info)} class which takes a sequence of analysis steps (in the form of a ${shortLink('Pipeline', info)}) and executes it
on a given input. In general, these pipeline steps are analysis agnostic and may use arbitrary input and ordering. However, two important and predefined pipelines, 
the ${shortLink('DEFAULT_DATAFLOW_PIPELINE', info)} and the ${shortLink('TREE_SITTER_DATAFLOW_PIPELINE', info)} adequately cover the most common analysis steps 
(differentiated only by the [Engine](${FlowrWikiBaseRef}/Engines) used).

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
We create a new ${shortLink(PipelineExecutor.name, info)} with the ${shortLink('TREE_SITTER_DATAFLOW_PIPELINE', info)} and then use ${shortLink(`${PipelineExecutor.name}::${new PipelineExecutor(TREE_SITTER_PARSE_PIPELINE, { parser: new TreeSitterExecutor(), request: requestFromInput('') }).allRemainingSteps.name}`, info)} 
to cause the execution of all contained steps (in general, pipelines can be executed step-by-step, but this is usually not required if you just want the result).
${shortLink(requestFromInput.name, info)} is merely a convenience function to create a request object from a code string.

In general, however, most flowR-internal functions which are tasked with generating dataflow prefer the use of ${shortLink(createDataflowPipeline.name, info)} as this function
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
As the types may seem to be somewhat confusing or over-complicated, we recommend you to look at some existing steps, like 
the ${shortLink('PARSE_WITH_R_SHELL_STEP', info)} or the ${shortLink('STATIC_DATAFLOW', info)} step.
The pipeline executor should do a good job of scheduling these steps (usually using a topological sort), and inferring the required inputs in the type system (have a look at the ${shortLink(createPipeline.name, info)} function if you want to know more).

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
	
${block({
	type:    'TIP',
	content: `
	All of these commands accept file paths as well, so you can write longer R code within a file, and then pass 
	the file path prefixed with \`${fileProtocol}\` (e.g., \`${fileProtocol}test/testfiles/example.R\`) to the commands.`
})}	

Especially when you are just starting with flowR, we recommend using the REPL to explore the output of the different steps.

${block({ 
	type:    'NOTE', 
	content: 'Maybe you are left with the question: What is tree-sitter doing differently? Expand the following to get more information!\n\n' + details('And what changes with tree-sitter?', `

Essentially not much (from a user perspective, it does essentially everything and all differently under the hood)! Have a look at the [Engines](${FlowrWikiBaseRef}/Engines) wiki page for more information on the differences between the engines.
Below you can see the Repl commands for the tree-sitter engine (using ${getCliLongOptionOf('flowr', 'default-engine')} to set the engine to tree-sitter):

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

The parsing step uses the ${shortLink(RShell.name, info)} to parse the input program (or, of course, the ${shortLink(TreeSitterExecutor.name, info)} when using the [\`tree-sitter\` engine](${FlowrWikiBaseRef}/Engines)).
To speed up the process, we use the ${shortLink(initCommand.name, info)} function to compile the parsing function and rely on a 
custom serialization, which outputs the information in a CSV-like format.
This means, that the ${getReplCommand('parse')} command actually kind-of lies to you, as it does pretty print the serialized version which looks more like the following (this uses the ${shortLink(retrieveParseDataFromRCode.name, info)} function with the sample code \`${sampleCode}\`):

${details(`Raw parse output for <code>${sampleCode}</code>`, `For the code \`${sampleCode}\`:\n\n` + codeBlock('csv',await retrieveParseDataFromRCode(requestFromInput(sampleCode), shell)))}

Beautiful, right? I thought so too! In fact, the output is a little bit nicer, when we put it into a table-format and add the appropriate headers:

<details open>
<summary>Parse output in table format</summary>

For the code \`${sampleCode}\`:

| line-start | col-start | line-end | col-end | id | parent | token type | terminal | text |
| ---------: | --------: | -------: | ------: | -: | -----: | ---------- | -------- | ---- |
${await retrieveParseDataFromRCode(requestFromInput(sampleCode), shell).then(data =>
	(JSON.parse('[' + data + ']') as string[][]).map(([line1, col1, line2, col2, id, parent, type, terminal, text]) => `| ${line1} | ${col1} | ${line2} | ${col2} | ${id} | ${parent} | \`${type}\` | ${terminal} | ${text} |`).join('\n')
)}

</details>

In fact, this data is merely what R's [\`base::parse\`](https://stat.ethz.ch/R-manual/R-devel/library/base/html/parse.html) and [\`utils::getParseData\`](https://stat.ethz.ch/R-manual/R-devel/library/utils/html/getParseData.html) functions provide.
We then use this data in the [normalization](#normalization) step to create a [normalized AST](${FlowrWikiBaseRef}/Normalized-AST).

If you are interested in the raw token types that we may encounter, have a look at the ${shortLink('RawRType', info)} enum.

### Normalization

The normalization function ${shortLink(normalize.name, info)} takes the output from the previous steps and uses the ${shortLink(prepareParsedData.name, info)} and 
${shortLink(convertPreparedParsedData.name, info)} functions to first transform the serialized parsing output to an object. 
Next, ${shortLink(normalizeRootObjToAst.name, info)} transforms this object to a normalized AST and ${shortLink(decorateAst.name, info)} adds additional information to the AST (like roles, ids, depth, etc.).
While looking at the mermaid visualization of such an AST is nice and usually sufficient, looking at the objects themselves shows you the full range of information the AST provides (all encompassed within the ${shortLink('RNode', info)} type).

Let's have a look at the normalized AST for the sample code \`${sampleCode}\` (please refer to the [normalized AST](${FlowrWikiBaseRef}/Normalized-AST) wiki page for more information):

${details('Normalized AST for <code>x <- 1; print(x)</code>', codeBlock('json', 
	JSON.stringify((await createNormalizePipeline(shell, { request: requestFromInput(sampleCode) }).allRemainingSteps()).normalize.ast, jsonReplacer, 4)
))}

This is… a lot! We get the type from the ${shortLink('RType', info)} enum, the lexeme, location information, an id, the children of the node, and their parents.
While the [normalized AST](${FlowrWikiBaseRef}/Normalized-AST) wiki page provides you with information on how to interpret this data, we will focus on how we get it from the
table provided by the [parsing](#parsing) step.

There are two important functions: ${shortLink(normalizeRootObjToAst.name, info)}, which operates on the parse-output already transformed into a tree-like structure,
and ${shortLink(decorateAst.name, info)}, which adds additional information to the AST.
Both follow a [fold](https://en.wikipedia.org/wiki/Fold_(higher-order_function)) pattern.
The fold is explicit for ${shortLink(decorateAst.name, info)}, which directly relies on the ${shortLink(foldAstStateful.name, info)} function,
while ${shortLink(normalizeRootObjToAst.name, info)} uses the fold-idiom but deviates in cases in which (for example) we require more information on other nodes to know what it should be normalized too.

#### Normalizing the Object

We have a handler for everything. For example ${shortLink(tryNormalizeIfThen.name, info)} or ${shortLink(tryNormalizeFor.name, info)} to handle \`if(x) y\` or \`for(i in 1:10) x\` constructs.
All of these handlers contain many sanity checks to be sure that we talk to an ${shortLink('RShell', info)} which we can handle (as assumptions may break with newer versions).
These functions contain the keyword \`try\` as they may fail. For example, whenever they notice late into normalization that they should actually be a different construct (R is great).
For single nodes, we use ${shortLink(normalizeSingleNode.name, info)} which contains a catch-all for some edge-cases in the R grammar.

The output of just this pass is listed below (using the ${shortLink(normalizeButNotDecorated.name, info)} function):

${details('Ast for <code>x <- 1; print(x)</code> after the first normalization', codeBlock('json',
	JSON.stringify(normalizeButNotDecorated((await createParsePipeline(shell, { request: requestFromInput(sampleCode) }).allRemainingSteps()).parse), jsonReplacer, 4)
))}


#### Decorating the AST

The decoration is comparatively trivial. We take the AST throw it into the ${shortLink(decorateAst.name, info)} function (which again, handles each normalized node type) and
get:

1. The AST with ids, roles, and depth information (see the [normalized AST](${FlowrWikiBaseRef}/Normalized-AST) wiki page for more information).
2. A mapping of ids to nodes in the form of a ${shortLink('AstIdMap', info)} object. This allows us to quickly access nodes by their id.

The ids used for the AST generation are arbitrary (usually created by the ${shortLink(deterministicCountingIdGenerator.name, info)}) function) but unique and intentionally
separated from the ids used by the R&nbsp;parser. For one, this detaches us from the [Engine](${FlowrWikiBaseRef}/Engines) used, and secondly, it allows for much easier
extension of the AST (e.g., when R&nbsp;files use [\`base::source\`](https://stat.ethz.ch/R-manual/R-devel/library/base/html/source.html) to include other R&nbsp;files).
All ids conform to the ${shortLink('NodeId', info)} type.

### Dataflow Graph Generation

The core of the dataflow graph generation works as a "stateful [fold](https://en.wikipedia.org/wiki/Fold_(higher-order_function))", 
which uses the tree-like structure of the AST to combine the dataflow information of the children, while tracking the currently active variables and control flow 
information as a “backpack” (state).	
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

* the ${shortLink('DataflowGraph', info)} of the current subtree 
* the currently active ${shortLink('REnvironmentInformation', info)} as an abstraction of all active definitions linking to potential definition locations (see [Advanced R::Environments](https://adv-r.hadley.nz/environments.html))
* control flow information in ${shortLink('DataflowCfgInformation', info)} which is used to enrich the dataflow information with control flow information
* and sets of currently ingoing (read), outgoing (write) and unknown ${shortLink('IdentifierReference', info)}s.

While all of them are essentially empty when processing an “uninteresting leaf”, handling a constant is slightly more interesting with ${shortLink('processValue', info)}:

${printHierarchy({ program, info, root: 'processValue', maxDepth: 2, openTop: true })}

Please note, that we add the [value vertex](${FlowrWikiBaseRef}/Dataflow-Graph#value-vertex) to the newly created dataflow graph,
which holds a reference to the constant. If you are confused with the use of the ${shortLink('ParentInformation', info)} type, 
this stems from the [AST decoration](#normalization) and signals that we have a decorated ${shortLink('RNode', info)} (which may have additional information in \`OtherInfo\`).

Yet again, this is not very interesting. When looking at the ${shortLink('processors', info)} object you may be confused by
many lines just mapping the node to the ${shortLink('processAsNamedCall', info)} function.
This is because during the dataflow analysis we actually "desugar" the AST, and treat syntax constructs like binary operators (e.g., \`x + y\`) as function calls (e.g. \`\` \`+\`(x, y) \`\`).
We do this, because R does it the same way, and allows to even overwrite these operators (including \`if\`, \`<-\`, etc.) by their name.
By treating them like R, as function calls, we get support for these overwrites for free, courtesy of flowR's call resolution.

But where are all the interesting things handled then? 
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

Afterward, we take the \`processedArguments\`, perform another round of sanity checks and then use two special functions to apply the
semantic effects of the repeat loop. We first use one of flowR's linkers to
${shortLink(linkCircularRedefinitionsWithinALoop.name, info)} and then retrieve the active exit points with ${shortLink(filterOutLoopExitPoints.name, info)}.

Feel free to have a look around and explore the other handlers for now. Each of them uses the results of its children alongside the active backpack 
to produce a new dataflow information.

## Beyond the Dataflow Graph

Given the [dataflow graph](${FlowrWikiBaseRef}/Dataflow-Graph), you can do a lot more!
You can issue [queries](${FlowrWikiBaseRef}/Query-API) to explore the graph, [search](${FlowrWikiBaseRef}/Search-API) for specific elements, or, for example, request a [static backward slice](#static-backward-slicing).
Of course, all of these endeavors work not just with the ${shortLink(RShell.name, info)} but also with the [\`tree-sitter\` engine](${FlowrWikiBaseRef}/Engines). 

### Static Backward Slicing

The slicing is available as an extra step as you can see by inspecting he ${shortLink('DEFAULT_SLICING_PIPELINE', info)}.
Besides ${shortLink('STATIC_SLICE', info)} it contains a ${shortLink('NAIVE_RECONSTRUCT', info)} to print the slice as (executable) R code.

Your main point of interesting here is the ${shortLink(staticSlicing.name, info)} function which relies on a modified
breadth-first search to collect all nodes which are part of the slice. 
For more information on how the slicing works, please refer to the [tool demonstration (Section 3.2)](https://doi.org/10.1145/3691620.3695359),
or the [original master's thesis (Chapter 4)](https://doi.org/10.18725/OPARU-50107).

You can explore the slicing using the REPL with the ${getReplCommand('slicer')} command:

${await documentReplSession(shell, [{
	command:     ':slicer test/testfiles/example.R --criterion "12@product"',
	description: 'Slice for the example file for the variable "prod" in line 12.'
}], { openOutput: true })}

## Helpful Things

### Getting flowR to Talk

When using flowR from the CLI, you can use the ${getCliLongOptionOf('flowr', 'verbose')} option to get more information about what flowR is doing.
While coding, however, you can use the ${shortLink(setMinLevelOfAllLogs.name, info)} function to set the minimum level of logs to be displayed (this works with the ${shortLink(FlowrLogger.name, info)} abstraction).
In general, you can configure the levels of individual logs, such as the general \`log\` (obtained with ${shortLink('getActiveLog', info)}) or the ${shortLink('parseLog', info)}.
Please note that flowR makes no guarantees that log outputs are persistent across versions, and it is up to the implementors to provide sensible logging.
If you are an implementor and want to add logging, please make sure there are no larger runtime impliciations when logging is disabled. 
Have a look at the ${shortLink(expensiveTrace.name, info)} function for example, which uses a function to generate the log message only when the log level is reached.

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
