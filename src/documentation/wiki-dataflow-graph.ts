import { DataflowGraph } from '../dataflow/graph/graph';
import {
	type DataflowGraphVertexFunctionCall,
	type DataflowGraphVertexFunctionDefinition,
	VertexType
} from '../dataflow/graph/vertex';
import { DfEdge, EdgeType } from '../dataflow/graph/edge';
import { DataflowGraphBuilder, emptyGraph } from '../dataflow/graph/dataflowgraph-builder';
import { guard } from '../util/assert';
import { formatSideEffect, printDfGraph, printDfGraphForCode, verifyExpectedSubgraph } from './doc-util/doc-dfg';
import {
	FlowrGithubBaseRef,
	FlowrGithubGroupName,
	FlowrWikiBaseRef,
	getFilePathMd
} from './doc-util/doc-files';
import { jsonReplacer } from '../util/json';
import { printEnvironmentToMarkdown } from './doc-util/doc-env';
import {
	type ExplanationParameters,
	getAllEdges,
	getAllVertices,
	type SubExplanationParameters
} from './data/dfg/doc-data-dfg-util';
import { getReplCommand } from './doc-util/doc-cli-option';
import { getTypesFromFolder, printHierarchy } from './doc-util/doc-types';
import { block, details, section } from './doc-util/doc-structure';
import { codeBlock } from './doc-util/doc-code';
import path from 'path';
import { lastJoin, prefixLines } from './doc-util/doc-general';
import { NodeId, recoverContent, recoverName } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Identifier, ReferenceType } from '../dataflow/environments/identifier';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import {
	resolveByName,
	resolveByNameAnyType,
	resolvesToBuiltInConstant,
} from '../dataflow/environments/resolve-by-name';
import { createDataflowPipeline } from '../core/steps/pipeline/default-pipelines';
import { nth } from '../util/text/text';
import { getAllFunctionCallTargets } from '../dataflow/internal/linker';
import { printNormalizedAstForCode } from './doc-util/doc-normalized-ast';
import type { RFunctionDefinition } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { getOriginInDfg } from '../dataflow/origin/dfg-get-origin';
import { getValueOfArgument } from '../queries/catalog/call-context-query/identify-link-to-last-call-relation';
import { getAliases, resolveIdToValue } from '../dataflow/eval/resolve/alias-tracking';
import { NewIssueUrl } from './doc-util/doc-issue';
import {
	UnnamedFunctionCallPrefix
} from '../dataflow/internal/process/functions/call/unnamed-call-handling';
import { defaultEnv } from '../../test/functionality/_helper/dataflow/environment-builder';
import { FlowrAnalyzerBuilder } from '../project/flowr-analyzer-builder';
import type { DataflowInformation } from '../dataflow/info';
import { contextFromInput } from '../project/context/flowr-analyzer-context';
import type { DocMakerArgs } from './wiki-mk/doc-maker';
import { DocMaker } from './wiki-mk/doc-maker';
import type { GeneralDocContext } from './wiki-mk/doc-context';
import type { TreeSitterExecutor } from '../r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { KnownParser } from '../r-bridge/parser';
import type { MermaidMarkdownMark } from '../util/mermaid/info';
import { FlowrAnalyzer } from '../project/flowr-analyzer';
import { BuiltInProcName } from '../dataflow/environments/built-in';
import { mermaidNodeBrackets } from '../util/mermaid/dfg';
import { RNumber } from '../r-bridge/lang-4.x/ast/model/nodes/r-number';
import { RNode } from '../r-bridge/lang-4.x/ast/model/model';
import { SourceRange } from '../util/range';

async function subExplanation(parser: KnownParser, { description, code, expectedSubgraph }: SubExplanationParameters): Promise<string> {
	expectedSubgraph = await verifyExpectedSubgraph(parser, code, expectedSubgraph);

	const marks: MermaidMarkdownMark[] = [];
	for(const [id] of expectedSubgraph.vertices(true)) {
		marks.push(id);
	}
	for(const [from, targets] of expectedSubgraph.edges()) {
		for(const [to] of targets) {
			marks.push(`${from}->${to}`);
		}
	}

	return `
${await printDfGraphForCode(parser, code, { mark: new Set(marks) })}

${description}`;

}

async function printAllSubExplanations(parser: KnownParser, expls: readonly SubExplanationParameters[]): Promise<string> {
	let result = `
<details>

<summary>Additional Case${expls.length > 1 ? 's' : ''}</summary>

`;
	for(const sub of expls) {
		result += `#### ${sub.name}\n`;
		result += await subExplanation(parser, sub) + '\n';
	}
	return result + '\n\n</details>';
}

async function explanation(
	{ name, type, description, code, expectedSubgraph }: ExplanationParameters,
	parser: KnownParser,
	index: number,
	...subExplanations: SubExplanationParameters[]
): Promise<string> {
	await verifyExpectedSubgraph(parser, code, expectedSubgraph);


	return `
<a id='${name.toLowerCase().replaceAll(' ', '-')}'> </a>
<a id='${String(type).toLowerCase().replaceAll(' ', '-')}-vertex'> </a>
### ${index}) ${name}

Type: \`${type}\` (this is the bit-flag value, e.g., when looking at the serialization)

${await subExplanation(parser, { name, description, code, expectedSubgraph })}

${subExplanations.length > 0 ? await printAllSubExplanations(parser, subExplanations) : ''}
	`;
}

function edgeTypeToId(edgeType: EdgeType): string {
	return DfEdge.typeToName(edgeType).toLowerCase().replaceAll(' ', '-');
}

function linkEdgeName(edgeType: EdgeType, page = ''): string {
	return `[\`${DfEdge.typeToName(edgeType)}\`](${page}#${edgeTypeToId(edgeType)})`;
}

async function getVertexExplanations(parser: TreeSitterExecutor, ctx: GeneralDocContext): Promise<string> {
	/* we use the map to ensure order easily :D */
	const vertexExplanations = new Map<VertexType, [ExplanationParameters, SubExplanationParameters[]]>();

	vertexExplanations.set(VertexType.Value, [{
		name:        'Value Vertex',
		type:        VertexType.Value,
		description: `
Describes a constant value (numbers, booleans/logicals, strings, ...).
In general, the respective vertex is more or less a dummy vertex as you can see from its implementation.

${
	ctx.hierarchy('DataflowGraphVertexValue')
}

${
	block({
		type:    'NOTE',
		content: `
The value is not stored in the vertex itself, but in the normalized AST.
To access the value, you can use the \`id\` of the vertex to access the respective node in the [normalized AST](${FlowrWikiBaseRef}/Normalized%20AST)
and ask for the value associated with it.
				`
	})
}

Please be aware that such nodes may be the result from language semantics as well, and not just from constants directly in the source.
For example, an access operation like \`df$column\` will treat the column name as a constant value.

${
	details('Example: Semantics Create a Value',
		`In the following graph, the original type printed by mermaid is still \`RSymbol\` (from the [normalized AST](${FlowrWikiBaseRef}/Normalized-AST)), however, the shape of the vertex signals to you that the symbol is in-fact treated as a constant! If you do not know what \`df$column\` even means, please refer to the [R topic](https://rdrr.io/r/base/Extract.html).\n` +
				await printDfGraphForCode(parser, 'df$column', { mark: new Set([1]) }))
}
		`,
		code:             '42',
		expectedSubgraph: emptyGraph().constant('0')
	}, []]);

	vertexExplanations.set(VertexType.Use, [{
		name:        'Use Vertex',
		type:        VertexType.Use,
		description: `
		
Describes symbol/variable references which are read (or potentially read at a given position).
Similar to the [value vertex](#value-vertex) described above, this is more a marker vertex as 
you can see from the implementation.

${
	ctx.hierarchy('DataflowGraphVertexUse')
}

${
	block({
		type:    'NOTE',
		content: `
The name of the symbol is not actually part of what we store in the dataflow graph,
as we have it within the normalized AST.
To access the name, you can use the \`id\` of the vertex:

${codeBlock('ts', `const name = ${recoverName.name}(id, graph.idMap);`)}
				`
	})
}

Most often, you will see the _use_ vertex whenever a variable is read.
However, similar to the [value vertex](#value-vertex), the _use_ vertex can also be the result of language semantics.
Consider a case, in which we refer to a variable with a string, as in \`get("x")\`.

${
	details('Example: Semantics Create a Symbol',
		`In the following graph, the original type printed by mermaid is still \`RString\` (from the [normalized AST](${FlowrWikiBaseRef}/Normalized%20AST)), however, the shape of the vertex signals to you that the symbol is in-fact treated as a variable use! ` +
		'If you are unsure what `get` does, refer to the [documentation](https://www.rdocumentation.org/packages/base/versions/3.6.2/topics/get). ' +
		'Please note, that the lexeme being printed as `"x"` may be misleading (after all it is recovered from the AST), the quotes are not part of the reference.\n' +
				await printDfGraphForCode(parser, 'get("x")', { mark: new Set([1]) }))
}

But now to the interesting stuff: how do we actually know which values are read by the respective variable use?
This usually involves a [variable definition](#variable-definition-vertex) and a [reads edge](#reads-edge) linking the two.

${
	details('Example: Reads Edge Identifying a Single Definition',
		'In the following graph, the `x` is read from the definition `x <- 1`.\n' +
				await printDfGraphForCode(parser, 'x <- 1\nprint(x)', { mark: new Set([3, '0->3']), codeOpen: true }))
}

In general, there may be many such edges, identifying every possible definition of the variable.

${
	details('Example: Reads Edge Identifying Multiple Definitions (conditional)',
		await printDfGraphForCode(parser, 'x <- 1\nif(u) x <- 2\nprint(x)', { mark: new Set([10, '10->0', '10->4']), codeOpen: true }))
}
${
	details('Example: Reads Edge Identifying Multiple Definitions (loop)',
		await printDfGraphForCode(parser, 'x <- 1\nfor(i in v) x <- 2\nprint(x)', { mark: new Set([11, '11->0', '11->5']), codeOpen: true }))
}
${
	details('Example: Reads Edge Identifying Multiple Definitions (side-effect)',
		await printDfGraphForCode(parser, 'f <- function() x <<- 2\nx <- 2\nif(u) f()\nprint(x)', { mark: new Set([16, '16->1', '16->7']), codeOpen: true }))
}

${block({
	type:    'IMPORTANT',
	content: `
	If you want to obtain the locations where a variable is defined, or read, or re-defined, refrain from tracking these details manually in the dataflow graph
	as there are some edge-cases that require special attention.
	In general, the ${ctx.link(getOriginInDfg)} function explained below in [working with the dataflow graph](${FlowrWikiBaseRef}/Dataflow%20Graph#working-with-the-dataflow-graph) will help you to get the information you need.
	`
})}

`,
		code:             'x',
		expectedSubgraph: emptyGraph().use('1@x', 'x')
	}, []]);

	vertexExplanations.set(VertexType.FunctionCall, [{
		name:        'Function Call Vertex',
		type:        VertexType.FunctionCall,
		description: `
Describes any kind of function call, including unnamed calls and those that happen implicitly!
In general the vertex provides you with information about 
the _name_ of the called function, the passed _arguments_, and the _environment_ in which the call happens (if it is of importance).

However, the implementation reveals that it may hold an additional \`onlyBuiltin\` flag to indicate that the call is only calling builtin functions &mdash; however, this is only a flag to improve performance,
and it should not be relied on as it may under-approximate the actual calling targets (e.g., being \`false\` even though all calls resolve to builtins).
	 
${
	ctx.hierarchy('DataflowGraphVertexFunctionCall')
}

The related function argument references are defined like this:
${
	ctx.hierarchy('FunctionArgument')
}

There is another element of potential interest to you, the \`origin\` property which records how flowR created the respective function call.
These origins may hold the name of any processor that is part of the ${ctx.link('BuiltInProcName')} enumeration to signal that the respective processor (cf. ${ctx.link('BuiltInProcessorMapper')}) was responsible for creating the vertex.
The entry \`${BuiltInProcName.Function}\` signals that flowR used a processor for a user-defined function defined within the source code, \`${BuiltInProcName.Unnamed}\` signals that the function as an anonymous function definition.
However, in general, flowR may use any fitting handler as an origin (see the ${ctx.link('BuiltInProcName')} enum for a *complete* list). For example, within a access definition, flowR will correspondingly redefine the meaning of \`:=\` to that of the \`${BuiltInProcName.TableAssignment}\`. 

${
	details('Example: Simple Function Call (unresolved)',
		await (async() => {
			const code = 'foo(x,3,y=3,)';
			const [text, info] = await printDfGraphForCode(parser, code, { mark: new Set([8]), exposeResult: true });
			const callInfo = info.dataflow.graph.vertices(true).find(([, vertex]) => vertex.tag === VertexType.FunctionCall && Identifier.getName(vertex.name) === 'foo');
			guard(callInfo !== undefined, () => `Could not find call vertex for ${code}`);
			const [callId, callVert] = callInfo as [NodeId, DataflowGraphVertexFunctionCall];
			const inverseMapReferenceTypes = Object.fromEntries(Object.entries(ReferenceType).map(([k, v]) => [v, k]));
			const identifierType = getTypesFromFolder({
				files:       [path.resolve('./src/dataflow/environments/identifier.ts')],
				inlineTypes: ['ControlDependency']
			});
			return `
To get a better understanding, let's look at a simple function call without any known call target, like \`${code}\`:

${text}

In this case, we have a function call vertex with id \`${callId}\` and the following arguments:

${codeBlock('json', JSON.stringify(callVert.args, jsonReplacer, 2))}

Of course now, this is hard to read in this form (although the ids of the arguments can be mapped pretty easily to the visualization),
as the \`type\` of these references is a bit-mask, encoding one of the following reference types:

| Value | Reference Type |
|------:|----------------|
${Object.values(ReferenceType).filter(k => typeof k === 'string').map(k => `| ${ReferenceType[k as keyof typeof ReferenceType]} | ${k} |`).join('\n')}

In other words, we classify the references as ${
			lastJoin(callVert.args.map(a => {
				if(a === EmptyArgument) {
					return `the (special) empty argument type (\`${EmptyArgument}\`)`;
				} else {
					return inverseMapReferenceTypes[a.type];
				}
			}), ', ', ', and ')
			}.
For more information on the types of references, please consult the implementation.

${printHierarchy({ program: identifierType.program, info: identifierType.info, root: 'ReferenceType' })}
	`;
		})())
}

${
	block({
		type:    'NOTE',
		content: `
But how do you know which definitions are actually called by the function?

So first of all, some frontends of _flowR_ (like the ${getReplCommand('slicer')} and ${getReplCommand('query')} with the [Query API](${FlowrWikiBaseRef}/Query%20API)) already provide you with this information.
In general there are three scenarios you may be interested in:
  
${
	details('1) the function resolves only to builtin definitions (like <code><-</code>)', `

Let's have a look at a simple assignment:

${await printDfGraphForCode(parser, 'x <- 2')}

In this case, the call does not have a single ${linkEdgeName(EdgeType.Calls)} edge, which in general means (i.e., if the analysis is done and you are not looking at an intermediate result) it is bound to anything
global beyond the scope of the given script. _flowR_ generally (theoretically at least) does not know if the call really refers to a built-in variable or function,
as any code that is not part of the analysis could cause the semantics to change. 
However, it is (in most cases) safe to assume we call a builtin if there is a builtin function with the given name and if there is no ${linkEdgeName(EdgeType.Calls)} edge attached to a call.
If you want to check the resolve targets, refer to ${ctx.link(resolveByName)}.
`)
}

${details('2) the function only resolves to definitions that are present in the program', `

Let's have a look at a call to a function named \`foo\` which is defined in the same script:

${await (async() => {
		const code = 'foo <- function() 3\nfoo()';
		const [text, info] = await printDfGraphForCode(parser, code, { exposeResult: true, mark: new Set([6, '6->0', '6->1', '6->3']) });

		const numberOfEdges = [...info.dataflow.graph. edges()].flatMap(e => [...e[1].keys()]).length;
		const callVertex = info.dataflow.graph.vertices(true).find(([, vertex]) => vertex.tag === VertexType.FunctionCall && Identifier.getName(vertex.name) === 'foo');
		guard(callVertex !== undefined, () => `Could not find call vertex for ${code}`);
		const [callId] = callVertex;


		return `
${text}

Now, there are several edges, ${numberOfEdges} to be precise, although we are primarily interested in the ${info.dataflow.graph.outgoingEdges(callId)?.size ?? 0}
edges going out from the call vertex \`${callId}\`.
The ${linkEdgeName(EdgeType.Reads)} edge signals all definitions which are read by the \`foo\` identifier (similar to a [use vertex](#use-vertex)).
While it seems to be somewhat redundant given the ${linkEdgeName(EdgeType.Calls)} edge that identifies the called [function definition](#function-definition-vertex),
you have to consider cases in which aliases are involved in the call resolution (e.g., with higher order functions).

${details('Example: Alias in Call Resolution', `In the following example, \`g\` ${linkEdgeName(EdgeType.Reads)} the previous definition, but ${linkEdgeName(EdgeType.Calls)} the function assigned to \`f\`.\n`
			+ await printDfGraphForCode(parser, 'f <- function() 3\ng <- f\ng()', { mark: new Set(['9', '9->5', '9->3']) }))}
			
Lastly, the ${linkEdgeName(EdgeType.Returns)} edge links the call to the return vertices(s) of the function.
Please be aware, that these multiple exit points may be counter intuitive as they often appear with a nested call (usually a call to the built-in \`{\` function).

 ${details('(Advanced) Example: Multiple Exit Points May Still Reflect As One',
			await printDfGraphForCode(parser, `
f <- function() {
	if(u) return(3)
	if(v) return(2)
	1
}
f()`.trim(), { mark: new Set([22, '22->18']) }) +
			`
In this case the call of \`f\` still only has one ${linkEdgeName(EdgeType.Returns)} edge, although the function _looks_ as if it would have multiple exit points!
But you have to beware that \`{\` is a function call as well (see below) and it may be redefined, or at least affect the actual returns of the function.
In this scenario we show two types of such returns (or exit points): _explicit_ returns with the \`return\` function and _implicit_ returns (the result of the last evaluated expression).
However, they are actually linked with the call of the built-in function \`{\` (and, in fact, they are highlighted in the mermaid graph).
`
		)}
		`;
	})()
}

 

`)}


${details('3) the function resolves to a mix of both', `

Users may write… interesting pieces of code - for reasons we should not be interested in!
Consider a case in which you have a built-in function (like the assignment operator \`<-\`) and a user that wants to redefine the meaning of the function call _sometimes_:

${await (async() => {
	const [text, info] = await printDfGraphForCode(parser, 'x <- 2\nif(u) `<-` <- `*`\nx <- 3', { switchCodeAndGraph: true, mark: new Set([9, '9->0', '9->10']), exposeResult: true });

	const interestingUseOfAssignment = info.dataflow.graph.vertices(true).find(([, vertex]) => vertex.id === 11);
	guard(interestingUseOfAssignment !== undefined, () => 'Could not find interesting assignment vertex for the code');
	const [id, interestingVertex] = interestingUseOfAssignment;
	const env = interestingVertex.environment;
	guard(env !== undefined, () => 'Could not find environment for interesting assignment vertex');
	const name = interestingVertex.name as string | undefined;
	guard(name !== undefined, () => 'Could not find name for interesting assignment vertex');
	return `
${text}

Interesting program, right? Running this with \`u <- TRUE\` will cause the last line to evaluate to \`6\` because we redefined the assignment
operator to mean multiplication, while with \`u <- FALSE\` causes \`x\` to be assigned to \`3\`.
In short: the last line may either refer to a definition or to a use of \`x\`, and we are not fully equipped to visualize this (this causes a warning).
First of all how can you spot that something weird is happening? Well, this definition has a ${linkEdgeName(EdgeType.Reads)} and a ${linkEdgeName(EdgeType.DefinedBy)} edge,
but this of course does not apply to the general case.

For starters, let's have a look at the environment of the call to \`<-\` in the last line:

${printEnvironmentToMarkdown(env.current)}

Great, you should see a definition of \`<-\` which is constraint by the [control dependency](#control-dependencies) to the \`if\`.
Hence, trying to re-resolve the call using ${ctx.link(getAllFunctionCallTargets)} (defined in ${getFilePathMd('../dataflow/internal/linker.ts')}) with the id \`${id}\` of the call as starting point will present you with
the following target ids: { \`${[...getAllFunctionCallTargets(id, info.dataflow.graph)].join('`, `')}\` }.
This way we know that the call may refer to the built-in assignment operator or to the multiplication.
Similarly, trying to resolve the name with ${ctx.link(resolveByName)}\` using the environment attached to the call vertex (filtering for any reference type) returns (in a similar fashion): 
{ \`${resolveByNameAnyType(Identifier.make(name), env)?.map(d => d.nodeId).join('`, `')}\` } (however, the latter will not trace aliases).

	`;
})()}

`)}


Similar to finding the definitions read by a variable use, please use the ${ctx.link(getAllFunctionCallTargets)} function to find all possible definitions of a function call,
as explained in the [working with the dataflow graph](${FlowrWikiBaseRef}/Dataflow%20Graph#working-with-the-dataflow-graph) section.`
	})
}

Function calls are the most complicated mechanism in R as essentially everything is a function call.
Even **control structures** like \`if(p) a else b\` are desugared into function calls (e.g., as \`\` \`if\`(p, a, b) \`\`).
${details('Example: <code>if</code> as a Function Call', await printDfGraphForCode(parser, 'if(p) a else b'))}

Similarly, you should be aware of calls to **anonymous functions**, which may appear given directly (e.g. as \`(function() 1)()\`) or indirectly, with code
directly calling the return of another function call: \`foo()()\`.
${details('Example: Anonymous Function Call (given directly)', await printDfGraphForCode(parser, '(function() 1)()', { mark: new Set([6, '6->4']) }))}

${details('Example: Anonymous Function Call (given indirectly)', await printDfGraphForCode(parser, 'foo <- function() return(function() 3)\nfoo()()', { mark: new Set([12, '12->4']) }))}

${block({
	type:    'NOTE',
	content: `Now you might be asking yourself how to differentiate anonymous and named functions and what you have to keep in mind when working with them?

Unnamed functions have an array of signatures which you can use to identify them. 
But in short: the \`origin\` attribute of the ${ctx.link('DataflowGraphVertexFunctionCall')} is \`${BuiltInProcName.Unnamed}\`.
Please be aware that unnamed functions still have a \`name\` property to give it a unique identifier that can be used for debugging and reference.
This name _always_ starts with \`${UnnamedFunctionCallPrefix}\`.

To identify these calls please do not rely on the [normalized AST](${FlowrWikiBaseRef}/Normalized-AST). An expression like \`1 + 1\` will be correctly
identified as a syntactical binary operation. Yet, from a dataflow/semantic perspective this is equivalent to \`\` \`+\`(1, 1) \`\` (which is a named function call and marked as such in the dataflow graph).
To know which function is called, please rely on the ${linkEdgeName(EdgeType.Calls)} edge.
	`
})}

Another interesting case is a function with **side effects**, most prominently with the super-assignment \`<<-\`.
In this case, you may encounter the ${linkEdgeName(EdgeType.SideEffectOnCall)} as exemplified below.
${details('Example: Function Call with a Side-Effect', await printDfGraphForCode(parser, 'f <- function() x <<- 3\n f()', { mark: new Set([8, '1->8']) }))}
 
`,
		code:             'foo()',
		expectedSubgraph: emptyGraph().call('1@foo', 'foo', [])
	}, []]);

	vertexExplanations.set(VertexType.VariableDefinition, [{
		name:        'Variable Definition Vertex',
		type:        VertexType.VariableDefinition,
		description: `
Defined variables most commonly occur in the context of an assignment, for example, with the \`<-\` operator as shown above.

${details('Example: Super Definition (<code><<-</code>)', await printDfGraphForCode(parser, 'x <<- 1', { mark: new Set([0]) }))}

The implementation is relatively sparse and similar to the other marker vertices:

${
	ctx.hierarchy('DataflowGraphVertexVariableDefinition')
}
Of only interest is \`par\`, which signals that the definitions is partial (e.g., in the case of \`x[a] <- 1\`).

Of course, there are not just operators that define variables, but also functions, like \`assign\`.

${
	details('Example: Using <code>assign</code>',
		await printDfGraphForCode(parser, 'assign("x", 1)\nx', { mark: new Set([1]) })
		+ `\nThe example may be misleading as the visualization uses \`${recoverName.name}\` to print the lexeme of the variable. However, this actually defines the variable \`x\` (without the quotes) as you can see with the ${linkEdgeName(EdgeType.Reads)} edge.`
	)
}

Please be aware, that the name of the symbol defined may differ from what you read in the program as R allows the assignments to strings, escaped names, and more:

${details('Example: Assigning with an Escaped Name', await printDfGraphForCode(parser, '`x` <- 1\nx', { mark: new Set([0]) }))}
${details('Example: Assigning with a String', await printDfGraphForCode(parser, '"x" <- 1\nx', { mark: new Set([0]) }))}

Definitions may be constrained by conditionals (_flowR_ takes care of calculating the dominating front for you).

${details('Conditional Assignments', await (async() => {
	const constrainedDefinitions = await printDfGraphForCode(parser, 'x <- 0\nif(u) x <- 1 else x <- 2\nx', { exposeResult: true });
	const [text, info] = constrainedDefinitions;

	const finalEnvironment = printEnvironmentToMarkdown(info.dataflow.environment.current);

	return `
${text}

In this case, the definition of \`x\` is constrained by the conditional, which is reflected in the environment at the end of the analysis:

${finalEnvironment}

As you can see, _flowR_ is able to recognize that the initial definition of \`x\` has no influence on the final value of the variable.
		`;
})())}

`,
		code:             'x <- 1',
		expectedSubgraph: emptyGraph().defineVariable('1@x', 'x')
	}, []]);

	vertexExplanations.set(VertexType.FunctionDefinition, [{
		name:        'Function Definition Vertex',
		type:        VertexType.FunctionDefinition,
		description: `
Defining a function does do a lot of things:  1) it creates a new scope,  2) it may introduce parameters which act as promises and which are only evaluated if they are actually required in the body,  3) it may access the enclosing environments and the callstack.
The vertex object in the dataflow graph stores multiple things, including all exit points, the enclosing environment if necessary, and the information of the subflow (the "body" of the function).

${
	ctx.hierarchy('DataflowGraphVertexFunctionDefinition')
}
The subflow is defined like this:
${
	ctx.hierarchy('DataflowFunctionFlowInformation')
}
And if you are interested in the exit points, they are defined like this:
${
	ctx.hierarchy('ExitPoint')
}

Whenever we visualize a function definition, we use a dedicated node to represent the anonymous function object,
and a subgraph (usually with the name \`"function <id>"\`) to encompass the body of the function (they are linked with a dotted line).

${
	block({
		type:    'NOTE',
		content: `
You may ask yourself: How can I know which vertices are part of the function body? how do i know the parameters?
All vertices that are part of the graph are present in the \`graph\` property of the function definition &mdash; it contains a set of all ids of the contained vertices: 
the actual dataflow graph is flat, and you can query all root vertices (i.e., those not part of any function definition) using 
\`${new DataflowGraph(undefined).rootIds.name}\`. Additionally, most functions that you can call on the dataflow graph offer a flag whether you want to include
vertices of function definitions or not (e.g., \`${new DataflowGraph(undefined).vertices.name}\`)

${details('Example: Nested Function Definitions',
	await (async() => {
		const [text, info] = await printDfGraphForCode(parser, 'f <- function() { g <- function() 3 }', { mark: new Set([9, 6]), exposeResult: true });

		const definitions = info.dataflow.graph.verticesOfType(VertexType.FunctionDefinition)
			.map(([id, vertex]) => `| \`${id}\` | { \`${[...(vertex as DataflowGraphVertexFunctionDefinition).subflow.graph].join('`, `')}\` } |`)
			.toArray();

		return `
${text}

As you can see, the vertex ids of the subflow do not contain those of nested function definitions but again only those which are part of the respective scope (creating a tree-like structure):

| Id | Vertex Ids in Subflow |
|---:|-----------------------|
${definitions.join('\n')}

	`;
	})()
)}

But now there is still an open question: how do you know which vertices are the parameters?
In short: there is no direct way to infer this from the dataflow graph (as parameters are handled as open references which are promises).
However, you can use the [normalized AST](${FlowrWikiBaseRef}/Normalized%20AST) to get the parameters used.   

${details('Example: Parameters of a Function',
	await (async() => {

		const code = 'f <- function(x, y = 3) x + y';
		const [text, info] = await printDfGraphForCode(parser, code, { mark: new Set([10, 1, 3]), exposeResult: true });
		const ast = await printNormalizedAstForCode(parser, code, { prefix: 'flowchart LR\n', showCode: false });

		const functionDefinition = [...info.dataflow.graph.vertices(true)].find(([, vertex]) => vertex.tag === VertexType.FunctionDefinition);
		guard(functionDefinition !== undefined, () => `Could not find function definition for ${code}`);
		const [id] = functionDefinition;

		const normalized = info.normalize.idMap.get(id) as RFunctionDefinition;

		return `
Let's first consider the following dataflow graph (of \`${code}\`):

${text}

The function definition we are interested in has the id \`${id}\`. Looking at the [normalized AST](${FlowrWikiBaseRef}/Normalized%20AST) of the code,
we can get the parameters simply be requesting the \`parameters\` property of the function definition (yielding the names: [${normalized.parameters.map(p => `\`${p.name.content}\``).join(', ')}]):

${ast}
	`;
	})()
)}
				`
	})
}

Last but not least, please keep in mind that R offers another way of writing anonymous functions (using the backslash): 

${await printDfGraphForCode(parser, '\\(x) x + 1', { switchCodeAndGraph: true })}

Besides this being a theoretically "shorter" way of defining a function, this behaves similarly to the use of \`function\`. 

`,
		code:             'function() 1',
		expectedSubgraph: emptyGraph().defineFunction('1@function', [0], { hooks: [], graph: new Set('0'), in: [{ nodeId: 0, cds: [], type: ReferenceType.Constant, name: undefined }], out: [], unknownReferences: [], entryPoint: 0, environment: defaultEnv() })
	}, []]);

	const results = [];
	let i = 0;
	for(const [,vertex] of getAllVertices()) {
		const get = vertexExplanations.get(vertex);
		guard(get !== undefined, () => `No explanation for vertex type ${vertex}`);
		const [expl, subExplanations] = get;
		results.push(await explanation(expl, parser, ++i, ...subExplanations));
	}
	return results.join('\n');
}

async function getEdgesExplanations(parser: KnownParser, ctx: GeneralDocContext): Promise<string> {
	const edgeExplanations = new Map<EdgeType, [ExplanationParameters, SubExplanationParameters[]]>();

	edgeExplanations.set(EdgeType.Reads, [{
		name:        'Reads Edge',
		type:        EdgeType.Reads,
		description: `
Reads edges mark that the source vertex (usually a [use vertex](#use-vertex)) reads whatever is defined by the target vertex (usually a [variable definition](#variable-definition-vertex)).

${
	block({
		type:    'NOTE',
		content: `
A ${linkEdgeName(EdgeType.Reads)} edge is not a transitive closure and only links the "directly read" definition(s).
Our abstract domains resolving transitive ${linkEdgeName(EdgeType.Reads)} edges (and for that matter, following ${linkEdgeName(EdgeType.Returns)} as well)
are currently tailored to what we need in _flowR_. Hence, we offer a function like ${ctx.link(getAllFunctionCallTargets)},
as well as ${ctx.link(resolvesToBuiltInConstant)} which do this for specific cases.
Refer to ${ctx.link(getOriginInDfg)} for a more general solution, as explained in [working with the dataflow graph](${FlowrWikiBaseRef}/Dataflow%20Graph#working-with-the-dataflow-graph).

${details('Example: Multi-Level Reads', await printDfGraphForCode(parser,  'x <- 3\ny <- x\nprint(y)', { mark: new Set(['9->7', '7->3', '4->0']) }))}

Similarly, ${linkEdgeName(EdgeType.Reads)} can be cyclic, for example in the context of loops:

${details('Example: Cyclic Reads', await printDfGraphForCode(parser, 'for(i in v) x <- x + 1', { mark: new Set(['3->2']) }))}
				`
	})
}

Reads edges may point to built-in definitions as well, to signal that something relates to a built-in element of flowR.
Their targets are not part of the ${ctx.link(DataflowGraph)} but only markers to signal that the respective definition is a built-in.

 
Please refer to the explanation of the respective vertices for more information.
`,
		code:             'x <- 2\nprint(x)',
		expectedSubgraph: emptyGraph().reads('2@x', '1@x')
	}, [{
		name:             'Reads Edge (Call)',
		description:      'Named calls are resolved too, linking to the symbol that holds the anonymous function definition (indirectly or directly)',
		code:             'foo <- function() {}\nfoo()',
		expectedSubgraph: emptyGraph().reads('2@foo', '1@foo')
	}, {
		name:             'Reads Edge (Parameter)',
		description:      'Parameters can read from each other as well.',
		code:             'f <- function(x, y=x) {}',
		expectedSubgraph: emptyGraph().reads('1:20', '1@x')
	}]]);

	edgeExplanations.set(EdgeType.DefinedBy, [{
		name:        'DefinedBy Edge', /* concat for link generation */
		type:        EdgeType.DefinedBy,
		description: `
The source vertex is usually a [\`variable definition\`](#variable-definition-vertex) linking the defined symbol to the entry point of the resulting side.
${
	details('In general, this does not have to be the right hand side of the operator.', await printDfGraphForCode(parser, '3 -> x', { mark: new Set([0]) }))
}

However, nested definitions can carry it (in the nested case, \`x\` is defined by the return value of <code>\\\`<-\\\`(y, z)</code>). Additionally, we link the assignment function.

`,
		code:             'x <- y',
		expectedSubgraph: emptyGraph().definedBy('1@x', '1@y').definedBy('1@x', '1:3')
	}, [{
		name:             'DefinedBy Edge (Nested)',
		description:      `Nested definitions can carry the ${linkEdgeName(EdgeType.DefinedBy)} edge as well.`,
		code:             'x <- y <- z',
		expectedSubgraph: emptyGraph().definedBy('1@x', '1:3').definedBy('1@x', '1:8').definedBy('1@y', '1:8')
	}, {
		name:             'DefinedBy Edge (Expression)',
		description:      'Here, we define by the result of the `+` expression.',
		code:             'x <- y + z',
		expectedSubgraph: emptyGraph().definedBy('1@x', '1:8')
	}]]);

	edgeExplanations.set(EdgeType.Calls, [{
		name:        'Calls Edge',
		type:        EdgeType.Calls,
		description: `Link the [function call](#function-call-vertex) to the [function definition](#function-definition-vertex) that is called. To find all called definitions, 
		please use the ${ctx.link(getOriginInDfg.name)} function, as explained in ${ctx.linkPage('wiki/Dataflow Graph', 'working with the dataflow graph', 'Working-with-the-Dataflow-Graph')}.
		If you are interested in the call graph, refer to ${ctx.linkM(FlowrAnalyzer, 'callGraph')} and consult the ${ctx.linkPage('wiki/Dataflow Graph', 'call graph wiki', 'perspectives-cg')} for more information.
		`,
		code:             'foo <- function() {}\nfoo()',
		expectedSubgraph: emptyGraph().calls('2@foo', '1@function')
	}, []]);

	edgeExplanations.set(EdgeType.Returns, [{
		name:        'Returns Edge',
		type:        EdgeType.Returns,
		description: `Link the [function call](#function-call-vertex) to the exit points of the target definition (this may incorporate the call-context).
As you can see in the example, this happens for user-defined functions (like \`foo\`) as well as for built-in functions (like \`<-\`).
However, these edges are specific to scenarios in which flowR knows that a specific element is returned. 
For contrast, compare this to a use of, for example, \`+\`:
		
${details('Example: No returns edge for +', await printDfGraphForCode(parser,  '1 + 1'))}

Here, we do not get a ${linkEdgeName(EdgeType.Returns)} edge as this function call creates a new value based on its arguments.
In these scenarios you should rely on the \`args\` property of the ${ctx.link('DataflowGraphVertexFunctionCall')} 
and use the arguments to calculate what you need to know. Alternatively, you can track the ${linkEdgeName(EdgeType.Argument)} edges.

In general, the ${linkEdgeName(EdgeType.Returns)} edge already does most of the heavy lifting for you, by respecting control flow influences and
(as long as flowR is able to detect it) dead code.

${details('Example: Tricky Returns',
	`We show the _simplified_ DFG for simplicity and highlight all ${linkEdgeName(EdgeType.Returns)} edges involved in tracking the return of a call to \`f\` (as ${linkEdgeName(EdgeType.Returns)} are never transitive and must hence be followed):\n` +
	await printDfGraphForCode(parser,  'f <- function() { if(u) { return(3); 2 } else 42 }\nf()', {
		simplified: true,
		mark:       new Set(['19->15', '15->14', '14->12', '14->11', '11->9', '9->7'])
	})
			+ '\n\n Note, that the `2` should be completely absent of the dataflow graph (recognized as dead code).'
)}
<br/>

${block({
	type:    'NOTE',
	content: `You might find it an inconvenience that there is no ${linkEdgeName(EdgeType.Returns)} edge for _every_ function call. 
If there is particular function for which you think flowR should be able to detect the return, please open a [new issue](${NewIssueUrl}).
Yet the problem of flowR not tracking returns for functions that create new/transform existing values is a fundamental design decision &mdash; if this irritates you ~~you may be eligible for compensation~~, you may be interested in an
alternative with the [Control Flow Graph](${FlowrWikiBaseRef}/Control%20Flow%20Graph#cfg-exit-points) which not just tracks all possible execution orders of the program,
but also the exit points of _all_ function calls. 
`
})}
		`,
		code:             'foo <- function() x\nfoo()',
		expectedSubgraph: emptyGraph().returns('2@foo', '1@x').returns('1@<-', '1@foo').argument('1@<-', '1@foo')
	}, []]);


	const lateBindingExample = `
f <- function() x
x <- 3
f()
	`.trim();

	const dfInfo = await printDfGraphForCode(parser, lateBindingExample, { switchCodeAndGraph: true, codeOpen: true, mark: new Set([1, '1->5', '9->5']) });

	edgeExplanations.set(EdgeType.DefinesOnCall, [{
		name:        'DefinesOnCall Edge',
		type:        EdgeType.DefinesOnCall,
		description: `*This edge is usually joined with ${linkEdgeName(EdgeType.DefinedByOnCall)}!*

 Links an argument to whichever parameter they cause to be defined if the related function call is invoked.
 
 In the context of functions which access their closure environment these edges play another tricky role as there are many cases 
 made more difficult by R's way of allowing closure environments to later receive variables.
 Consider the following scenario in which we first define a function which returns the value of a variable named \`x\` and then define \`x\`
 only after we defined the function:
   
${dfInfo}

 The final call evaluates to \`3\` (similar to if we defined \`x\` before the function definition).
 Within a dataflow graph you can see this with two edges. The \`x\` within the function body will have a ${linkEdgeName(EdgeType.DefinedByOnCall)} 
 to every definition it _may_ refer to. In turn, each call vertex calling the function which encloses the use of \`x\` will have a
 ${linkEdgeName(EdgeType.DefinesOnCall)} edge to the definition(s) it causes to be active within the function body. 
 `,
		code:             'f <- function(x) {}\nf(x=1)',
		// here we use the ids as the argument wrappers are not easily selected with slicing criteria
		expectedSubgraph: emptyGraph().definesOnCall('$11', '$1').definedByOnCall('$1', '$11')
	}, []]);
	edgeExplanations.set(EdgeType.DefinedByOnCall, [{
		name:        'DefinedByOnCall Edge',
		type:        EdgeType.DefinedByOnCall,
		description: `*This edge is usually joined with ${linkEdgeName(EdgeType.DefinesOnCall)}!*

 This represents the other part of the ${linkEdgeName(EdgeType.DefinesOnCall)} edge (e.g., links the parameter to the argument). Please look there for further documentation.`,
		code:             'f <- function(x) {}\nf(x=1)',
		expectedSubgraph: emptyGraph().definesOnCall('$11', '$1').definedByOnCall('$1', '$11')
	}, []]);

	edgeExplanations.set(EdgeType.Argument, [{
		name:        'Argument Edge',
		type:        EdgeType.Argument,
		description: `Links a [function call](#function-call-vertex) to the entry point of its arguments. If we do not know the target of such a call, we automatically assume that all arguments are read by the call as well!
		
The exception to this is the [function definition](#function-definition-vertex) which does no longer hold these argument relationships (as they are not implicit in the structure).
		`,
		code:             'f(x,y)',
		expectedSubgraph: emptyGraph().argument('1@f', '1@x').reads('1@f', '1@x').argument('1@f', '1@y').reads('1@f', '1@y')
	}, []]);

	edgeExplanations.set(EdgeType.SideEffectOnCall, [{
		name:             'SideEffectOnCall Edge',
		type:             EdgeType.SideEffectOnCall,
		description:      'Links a global side effect to an affected function call (e.g., a super definition within the function body)',
		code:             'f <- function() { x <<- 2 }\nf()',
		expectedSubgraph: emptyGraph().sideEffectOnCall('1@x', '2@f')
	}, []]);

	edgeExplanations.set(EdgeType.NonStandardEvaluation, [{
		name:        'NonStandardEvaluation Edge',
		type:        EdgeType.NonStandardEvaluation,
		description: `
Marks cases in which R's non-standard evaluation mechanisms cause the default semantics to deviate (see the case below for multiple vertices)

${
	block({
		type:    'NOTE',
		content: `
What to do if you encounter a vertex marked with this edge? 

This depends on your analysis. To handle many real-world sources correctly you are probably fine with just ignoring it.
Yet, you may choose to follow these references for other queries. For now, _flowR's_ support for non-standard evaluation is limited.

Besides the obvious quotation there are other cases in which _flowR_ may choose to create a ${linkEdgeName(EdgeType.NonStandardEvaluation)} edge, there are
some that may appear to be counter-intuitive. For example, a for-loop body, as in the following example.

${details('Example: For-Loop Body', await printDfGraphForCode(parser, 'for(i in v) b', { mark: new Set([2, '4->2']) }))}
${details('Example: While-Loop Body', await printDfGraphForCode(parser, 'while(TRUE) b', { mark: new Set([1, '3->1']) }))}
				`
	})
}
`,
		code:             'quote(x)',
		expectedSubgraph: emptyGraph().argument('1@quote', '1@x').nse('1@quote', '1@x')
	}, [{
		name:             'Complete Expressions',
		description:      'This works, even if we have a larger expression in `quote`.',
		code:             'quote(x + y)',
		expectedSubgraph: emptyGraph()
			.argument('1@quote', '1@+').nse('1@quote', '1@+')
			.nse('1@quote', '1@x')
			.nse('1@quote', '1@y')
	}]]);


	const results = [];
	let i = 0;
	for(const [,edge] of getAllEdges()) {
		const get = edgeExplanations.get(edge);
		guard(get !== undefined, () => `No explanation for edge type ${edge}`);
		const [expl, subExplanations] = get;
		results.push(`<a id='${edgeTypeToId(edge)}'></a>` + await explanation(expl, parser, ++i, ...subExplanations));
	}
	return results.join('\n');
}

async function dummyDataflow(): Promise<DataflowInformation> {
	const analyzer = await new FlowrAnalyzerBuilder().build();
	analyzer.addRequest('x <- 1\nx + 1');
	const result = await analyzer.dataflow();
	analyzer.close();
	return result;
}

/**
 * https://github.com/flowr-analysis/flowr/wiki/Dataflow-Graph
 */
export class WikiDataflowGraph extends DocMaker<'wiki/Dataflow Graph.md'> {
	constructor() {
		super('wiki/Dataflow Graph.md', module.filename, 'dataflow graph');
	}

	protected async text({ ctx, treeSitter }: DocMakerArgs): Promise<string> {
		const introExampleCode = 'x <- 3\ny <- x + 1\ny';

		return `
This page briefly summarizes flowR's dataflow graph (${ctx.link(DataflowGraph)}).
If you are interested in which features we support and which features are still to be worked on, please refer to our ${ctx.linkPage('wiki/Capabilities')} page.
In case you want to manually build such a graph (e.g., for testing), you can use the ${ctx.link(DataflowGraphBuilder)}.
In summary, we discuss the following topics in this wiki page:

- [Reading the Visualization](#reading-the-visualization)
- [Vertices](#vertices)
- [Edges](#edges)
- [Control Dependencies](#control-dependencies)
- [Dataflow Information](#dataflow-information)
	- [Unknown Side Effects](#unknown-side-effects)
- [Perspectives on the Dataflow Graph](#perspectives)
    - [Call Graph Perspective](#perspectives-cg)
- [Working with the Dataflow Graph](#dfg-working)

Please be aware that the accompanied [dataflow information](#dataflow-information) (${ctx.link('DataflowInformation')}) returned by _flowR_ 
contains things besides the graph, like the entry and exit points of the subgraphs, and currently active references (see [below](#dataflow-information)).
Additionally, you may be interested in the [Unknown Side Effects](#unknown-side-effects), marking calls which _flowR_ is unable to handle correctly.

> [!TIP]
> To investigate the dataflow graph,
> you can either use the ${ctx.linkPage('flowr:vscode')} or the ${ctx.replCmd('dataflow*')}
> command in the REPL (see the ${ctx.linkPage('wiki/Interface', 'Interface wiki page')}). 
> There is also a simplified version available with ${ctx.replCmd('dataflowsimple*')} that does not show everything but is easier to read.
> For small graphs, you can also use ${ctx.replCmd('dataflowascii')} to print the graph as ASCII art.
> 
> If you receive a dataflow graph in its serialized form (e.g., by talking to a [_flowR_ server](${FlowrWikiBaseRef}/Interface)), you can use ${ctx.linkM(DataflowGraph, 'fromJson', { realNameWrapper: 'i', codeFont: true })} to recover the graph object.
>
> Also, check out the [${FlowrGithubGroupName}/sample-analyzer-df-diff](${FlowrGithubBaseRef}/sample-analyzer-df-diff) repository for a complete example project creating and comparing dataflow graphs.

To get started, let's look at the graph for the following code snippet:
${codeBlock('r', introExampleCode)}

With this code, the corresponding dataflow graph looks like this:

${await printDfGraphForCode(treeSitter, introExampleCode, { showCode: false })}

The above dataflow graph showcases the general gist. We define a dataflow graph as a directed graph G&nbsp;=&nbsp;(V,&nbsp;E), 
differentiating between ${getAllVertices().length} types of vertices&nbsp;V and
${getAllEdges().length} types of edges&nbsp;E allowing each vertex to have a single, and each edge to have multiple distinct types.
Additionally, every node may have links to its [control dependencies](#control-dependencies) (which you may view as a ${nth(getAllEdges().length + 1)} edge type, 
although they are explicitly no data dependency and relate to the ${ctx.linkPage('wiki/Control Flow Graph')}. 

${details('Simplified Version of the graph', await printDfGraphForCode(treeSitter, 'x <- 3\ny <- x + 1\ny', { simplified: true, showCode: false }))}

The following vertices types exist:

1. ${getAllVertices().map(
	([k, v], index) => `[\`${k}\`](#${index + 1}-${v.toLowerCase().replace(/\s/g, '-')}-vertex)`
).join('\n1. ')}

${details('Class Diagram', 'All boxes should link to their respective implementation:\n' + codeBlock('mermaid', ctx.mermaid('DataflowGraphVertexInfo', { inlineTypes: ['MergeableRecord'] })))}

The following edges types exist, internally we use bitmasks to represent multiple types in a compact form, so you 
should use the ${ctx.link('DfEdge', { codeFont: false, realNameWrapper: 'i' }, { type: 'variable' })} object and its methods to work with them:

1. ${getAllEdges().map(
	([k, v], index) => `[\`${k}\` (${v})](#${index + 1}-${k.toLowerCase().replace(/\s/g, '-')}-edge)`
).join('\n1. ')}

${details('Class Diagram', 'All boxes should link to their respective implementation:\n' + codeBlock('mermaid', ctx.mermaid('EdgeType', { inlineTypes: ['MergeableRecord'] })))}


From an implementation perspective all of these types are represented by respective interfaces, see ${getFilePathMd('../dataflow/graph/vertex.ts')} and ${getFilePathMd('../dataflow/graph/edge.ts')}.

The following sections present details on the different types of vertices and edges, including examples and explanations.

> [!NOTE]
> Every dataflow vertex holds an \`id\` which links it to the respective node in the [normalized AST](${FlowrWikiBaseRef}/Normalized-AST).
> So if you want more information about the respective vertex, you can usually access more information
> using the <code>${ctx.link(`${DataflowGraph.name}`, { codeFont: false, realNameWrapper: 'i' })}::idMap</code> linked to the dataflow graph:
${prefixLines(codeBlock('ts', 'const node = graph.idMap.get(id);'), '> ')}
> In case you just need the name (\`lexeme\`) of the respective vertex, ${ctx.link(recoverName)} can help you out:
${prefixLines(codeBlock('ts', `const name = ${recoverName.name}(id, graph.idMap);`), '> ')}
>
> Please note, that not every node in the [normalized AST](${FlowrWikiBaseRef}/Normalized-AST) is represented in the dataflow graph.
> For example, if the node is unreachable in a way that can be detected during the analysis and flowR
> is configured to ignore dead code (there are more powerful dead code capabilities with the [CFG](${FlowrWikiBaseRef}/Control-Flow-Graph)). Likewise, empty argument wrappers do not have a corresponding
> dataflow graph vertex (as they are not relevant for the dataflow graph). It depends on the scenario what to do in such a case. 
> For argument wrappers you can access the dataflow information for their value. For dead code, however, flowR currently contains
> some core heuristics that remove it which cannot be reversed easily. So please open [an issue](${NewIssueUrl}) if you encounter such a case and require the node to be present in the dataflow graph.

${section('Reading the Visualizations', 2, 'reading-the-visualization')}

Before we dive into the details of the different vertices and edges, let's briefly talk about how to read the visualizations.
For this, let's have a look at a very simple graph, created for the number \`42\`:

${await printDfGraphForCode(treeSitter, '42', { showCode: false })}

${section('Vertex Shape', 3, 'vtx-shape')}

The _shape_ of the vertex tells you the type of the vertex in the dataflow graph using the following scheme (the types are 
explained in more detail in the following sections):

${
	codeBlock('mermaid',
		'flowchart TD\n' +
	// use mermaidNodeBrackets to get open and closing bracket
	Object.entries(VertexType)
		.map(([k, v]) => {
			const { open, close } = mermaidNodeBrackets(v);
			return `   ${v}${open}${k}${close}`;
		}).join('\n') +
		// we add a subflow for the function definition
		'\n    subgraph fbox ["function body"]\n   body((...))\n    end\n   fdef-->fbox'
	)
}

${section('Syntactic Types', 3, 'vtx-synt-type')}

Within the shape, in square brackets, you can find the syntactic type of the vertex
which is linked to the node in the ${ctx.linkPage('wiki/Normalized AST')}.
For more information on valid types and what to do with them, please refer to the ${ctx.linkPage('wiki/Normalized AST', 'normalized AST wiki page')}
and the corresponding helper objects (e.g., ${ctx.link(RNumber, undefined, { type: 'variable' })}).

${section('Lexeme', 3, 'vtx-lexeme')}

Also in the first line, next to the [syntactic type](#vtx-synt-type), you can find the lexeme of the vertex (if it has one, e.g., for a variable definition or use).
This usually represents the textual source string of the respective vertex, and is also linked to the ${ctx.linkPage('wiki/Normalized AST')}.
You can access the lexeme too with ${ctx.linkO(RNode, 'lexeme')}.

${section('Vertex Id', 3, 'vtx-id')}

In the second line, you will usually find the id (in the form of a ${ctx.link(NodeId, undefined, { type: 'variable' })}) of the vertex,
alongside its [control dependencies](#control-dependencies) if it has any. This id links the vertex to the respective node in the ${ctx.linkPage('wiki/Normalized AST')} (and all other perspectives created by flowR).
To give you an example, have a look at the following graph:

${await printDfGraphForCode(treeSitter, 'if(u) a', { showCode: false, mark: new Set(['1']) })}
With the _may_ prefix you can see that \`a\` has a [control dependency](#control-dependencies)
on the \`if\`, which only triggers when the condition is \`true\` (as indicated by the \`+\` suffix).

${section('Location', 3, 'vtx-location')}

The third line indicates the compressed ${ctx.link(SourceRange)} of the vertex in the format \`startLine.startCharacter - endLine.endCharacter\`. If the range reads \`1.7\`, 
this is short for \`1.7-1.7\`, likewise, \`1.7-9\` is short for \`1.7-1.9\`. So, \`1.7-9\` describes something starting
in the first line at the seventh character and ending in the first line at the ninth character.

${section('Arguments and Additional Information', 3, 'vtx-additional-info')}

Some vertices (e.g., [function calls](#function-call-vertex)) have additional information, like the arguments of the call. 
As you can see with the \`if\` example above alongside the [vertex id](#vtx-id),
these vertices also have an additional line which lists the ids of the arguments in order to clear any ambiguity in case, for example,
the mermaid graph layouting fumbles the order.

${section('Vertices', 2, 'vertices')}

1. ${getAllVertices().map(
	([k, v]) => `[\`${k}\`](#${v.toLowerCase().replaceAll(/\s/g, '-')}-vertex)`
).join('\n1. ')}

${await getVertexExplanations(treeSitter, ctx)}

${section('Edges', 2, 'edges')}

1. ${getAllEdges().map(
	([k, v], index) => `[\`${k}\` (${v})](#${index + 1}-${k.toLowerCase().replace(/\s/g, '-')}-edge)`
).join('\n1. ')}

${await getEdgesExplanations(treeSitter, ctx)}

${section('Control Dependencies', 2, 'control-dependencies')}

Each vertex may have a list of active control dependencies.
They hold the ${ctx.link('NodeId')} of all nodes that effect if the current vertex is part of the execution or not,
and a boolean flag \`when\` to indicate if the control dependency is active when the condition is \`true\` or \`false\`.

As an example, consider the following dataflow graph:

${await printDfGraphForCode(treeSitter, 'if(p) a else b')}

Whenever we visualize a graph, we represent the control dependencies as grayed out edges with a \`CD\` prefix, followed
by the \`when\` flag.
In the above example, both \`a\` and \`b\` depend on the \`if\`. Please note that they are _not_ linked to the result of
the condition itself as this is the more general linkage point (and harmonizes with other control structures, especially those which are user-defined).

${details('Example: Multiple Vertices (Assignment)', await printDfGraphForCode(treeSitter, 'if(p) a <- 1'))}
${details('Example: Multiple Vertices (Arithmetic Expression)', await printDfGraphForCode(treeSitter, 'if(p) 3 + 2'))}
${details('Example: Nested Conditionals', await printDfGraphForCode(treeSitter, 'if(x) { if(y) a else b } else c'))}


${section('Dataflow Information', 2, 'dataflow-information')}

Using _flowR's_ code interface (see the [Interface](${FlowrWikiBaseRef}/Interface#creating-flowr-analyses) wiki page for more), you can generate the dataflow information
for a given piece of R code (in this case \`x <- 1; x + 1\`) as follows:

${codeBlock('ts', `
const analyzer = await new FlowrAnalyzerBuilder(requestFromInput('x <- 1\nx + 1')).build();
const result = await analyzer.dataflow();
`)}

<details>

<summary style="color:gray">Transpiled Code</summary>

The actual code we are using in case the example above gets oudated:

${codeBlock('ts', dummyDataflow.toString())}

</details>


Now, you can find the dataflow _information_ with \`result.dataflow\`. More specifically, the graph is stored in \`result.dataflow.graph\` and looks like this:

${await (async() => {
		const result = await dummyDataflow();
		const dfGraphString = printDfGraph(result.graph);

		return `
${dfGraphString}

However, the dataflow information contains more, quite a lot of information in fact.

<details>

<summary style="color:gray">Dataflow Information as Json</summary>

_As the information is pretty long, we inhibit pretty printing and syntax highlighting:_
${codeBlock('text', JSON.stringify(result, jsonReplacer))}

</details>

You may be interested in its implementation:

${
		ctx.hierarchy('DataflowInformation')
		}

Let's start by looking at the properties of the dataflow information object: ${Object.keys(result).map(k => `\`${k}\``).join(', ')}.

${ (() => {
			/* this includes the meta field for timing and the quick CFG in order to enable re-use and improve performance */
			guard(Object.keys(result).length === 10, () => 'Update Dataflow Documentation! (Keys: ' + Object.keys(result).join(', ') + ')'); return '';
		})() }

There are three sets of references.
**in** (ids: ${JSON.stringify(new Set(result.in.map(n => n.nodeId)), jsonReplacer)}) and **out** (ids: ${JSON.stringify(new Set(result.out.map(n => n.nodeId)), jsonReplacer)}) contain the 
ingoing and outgoing references of the subgraph at hand (in this case, the whole code, as we are at the end of the dataflow analysis).
Besides the Ids, they also contain important meta-information (e.g., what is to be read).
The third set, **unknownReferences**, contains all references that are not yet identified as read or written 
(the example does not have any, but, for example, \`x\` (with id 0) would first be unknown and then later classified as a definition).

The **environment** property contains the active environment information of the subgraph.
In other words, this is a linked list of tables (scopes), mapping identifiers to their respective definitions.
A summarized version of the produced environment looks like this:

${printEnvironmentToMarkdown(result.environment.current)}

This shows us that the local environment contains a single definition for \`x\` (with id 0) and that the parent environment is the built-in environment.
Additionally, we get the information that the node with the id 2 was responsible for the definition of \`x\`.

Last but not least, the information contains the single **entry point** (${
		JSON.stringify(result.entryPoint)
		}) and a set of **exit points** (${
			JSON.stringify(result.exitPoints.map(e => e.nodeId))
		}). 
Besides marking potential exits, the exit points also provide information about why the exit occurs and which control dependencies affect the exit.

### Unknown Side Effects

In case _flowR_ encounters a function call that it cannot handle, it marks the call as an unknown side effect.
You can find these as part of the dataflow graph, specifically as \`unknownSideEffects\` (with a leading underscore if sesrialized as JSON).
In the following graph, _flowR_ realizes that it is unable to correctly handle the impacts of the \`load\` call and therefore marks it as such (marked in bright red):

${await printDfGraphForCode(treeSitter, 'load("file")\nprint(x + y)')}

In general, as we cannot handle these correctly, we leave it up to other analyses (and [queries](${FlowrWikiBaseRef}/Query%20API)) to handle these cases
as they see fit.

#### Linked Unknown Side Effects

Not all side effects are created equal in the sense that they stem from a specific function call.
Consider R's basic [\`graphics\`](https://www.rdocumentation.org/packages/graphics/) which
implicitly draws on the current device and does not explicitly link a function like \`points\` to the last call opening a new graphic device. In such a scenario, we use a linked side effect to mark the relation:

${await (async() => {
			const [result, df] = await printDfGraphForCode(treeSitter, 'plot(data)\npoints(data2)', { exposeResult: true });
			return `
${result}

Such side effects are not marked explicitly (with a big edge) but they are part of the unknown side effects: [${[...df.dataflow.graph.unknownSideEffects].map(formatSideEffect).join(',')}].
Additionally, we express this by a ${linkEdgeName(EdgeType.Reads)} edge.
	`;
		})()}
 
${section('Perspectives on the Dataflow Graph', 2, 'perspectives')}

For certain questions, handling the *full* dataflow graph may be too complex or unnecessary, given that you might have to consider edge interactions, or trace
transitive relationships by yourself.
Perspectives are simplified views on the dataflow graph, tailored to specific questions, which still comply with the ${ctx.link(DataflowGraph)} interface
so you can use them as drop-in replacements for the full dataflow graph. Although, please be aware that this does not mean that every function will work correctly&mdash;a
call graph will no longer contain information on variables, for example.

${section('Call Graphs', 3, 'perspectives-cg')}

These are simplified views on the dataflow graph, following the ${ctx.link('CallGraph')} type.
It can be obtained, e.g., by ${ctx.linkM(FlowrAnalyzer, 'callGraph')}.
These graphs only contain function definitions and function calls as vertices, and ${linkEdgeName(EdgeType.Calls)} edges.
Consider the following example:

${codeBlock('r', 'f <- function() f()')}

The resulting call graph looks like this:

${await printDfGraphForCode(treeSitter, 'f <- function() f()', { callGraph: true })}

Please note, that, due to the over-approximative nature of call-graphs, the call-graph may label some function calls that are *not*
marked as such in the full dataflow graph (which may have more precise information).
For example, if we call an unknown alias:

${codeBlock('r', 'alias <- unknown\nalias(print)')}

The resulting call graph looks like this:

${await printDfGraphForCode(treeSitter, 'alias <- unknown\nalias()', { callGraph: true })}

Here, \`unknown\` is a function call, while it is a symbol in the full dataflow graph (as we cannot resolve it):

${await printDfGraphForCode(treeSitter, 'alias <- unknown\nalias()', { callGraph: false })}


${section('Working with the Dataflow Graph', 2, 'dfg-working')}

The ${ctx.link('DataflowInformation')} is the core result of _flowR_ and summarizes a lot of information.
Depending on what you are interested in, there exists a plethora of functions and queries to help you out, answering the most important questions:

* The **${ctx.linkPage('wiki/Query API')}** provides many functions to query the dataflow graph for specific information (dependencies, calls, slices, clusters, ...)
* The **${ctx.linkPage('wiki/Search API')}** allows you to search for specific vertices or edges in the dataflow graph or the original program
* ${ctx.link(recoverName)} and ${ctx.link(recoverContent)} to get the name or content of a vertex in the dataflow graph
* ${ctx.link(resolveIdToValue)} to resolve the value of a variable or id (if possible, see [below](#dfg-resolving-values))
* ${ctx.link(getAliases)} to get all (potentially currently) aliases of a given definition
* ${ctx.link(getValueOfArgument)} to get the (syntactical) value of an argument in a function call 
* ${ctx.link(getOriginInDfg)} to get information about where a read, call, ... comes from (see [below](#dfg-resolving-values))

FlowR also provides various helper objects (with the same name as the corresponding type) to help you work with the dataflow graph:

* ${ctx.link('DfEdge', undefined, { type: 'variable' })} to get helpful functions wrt. edges (see [below](#dfg-resolving-values))
* ${ctx.link('Identifier', undefined, { type: 'variable' })} to get helpful functions wrt. identifiers
* ${ctx.link('FunctionArgument', undefined, { type: 'variable' })} to get helpful functions wrt. function arguments

Some of these functions have been explained in their respective wiki pages. However, some are part of the ${ctx.linkPage('wiki/Dataflow Graph', 'Dataflow Graph API')} and so we explain them here.
If you are interested in which features we support and which features are still to be worked on, please refer to our ${ctx.linkPage('wiki/Capabilities', 'capabilities')} page.

${section('Resolving Values', 3, 'dfg-resolving-values')}

FlowR supports a [configurable](${FlowrWikiBaseRef}/Interface#configuring-flowr) level of value tracking&mdash;all with the goal of knowing the static value domain of a variable.
These capabilities are exposed by the [resolve value Query](${FlowrWikiBaseRef}/Query-API#resolve-value-query) and backed by two important functions:

${ctx.link(resolveIdToValue)} provides an environment-sensitive (see ${ctx.link('REnvironmentInformation')})
value resolution depending on if the environment is provided.
The idea of ${ctx.link(resolveIdToValue)} is to provide a compromise between precision and performance, to
be used _during_ and _after_ the core analysis. After the dataflow analysis completes, there are much more expensive queries possible (such as the resolution of the data frame shape, see the [Query API](${FlowrWikiBaseRef}/Query-API)).

Additionally, to ${ctx.link(resolveIdToValue)}, we offer the aforementioned ${ctx.link(getValueOfArgument)} to retrieve the value of an argument in a function call.
Be aware, that this function is currently not optimized for speed, so if you frequently require the values of multiple arguments of the same function call, you may want to open [an issue](${NewIssueUrl}) to request support for resolving
multiple arguments at once.

${section('Assessing Edges', 3, 'dfg-assess-edge')}

The [edges](#edges) of the dataflow graph use bitmasks to represent an edge with multiple types. While this compacts the representation greatly, it makes it
difficult to check whether a given edge is a read edge. 
Consider the following example:

${await printDfGraphForCode(treeSitter, 'print(x)', { mark: new Set(['3->1']) })}

Retrieving the _types_ of the edge from the print call to its argument returns:
${await(async() => {
			const dfg =  await createDataflowPipeline(treeSitter, {
				context: contextFromInput('print(x)')
			}).allRemainingSteps();
			const edge = dfg.dataflow.graph.outgoingEdges(3);
			if(edge) {
				const wanted = edge.get(1);
				if(wanted) {
					return '`' + wanted.types + '`';
				}
			}
			throw new Error('Could not find edge');
		})()}&mdash;which is usually not very helpful.
You can use ${ctx.link('DfEdge::splitTypes')} to get the individual bitmasks of all included types, and 
${ctx.link('DfEdge::includesType')} to check whether a specific type (or one of a collection of types) is included in the edge.

${section('Handling Origins', 3, 'dfg-handling-origins')}

If you are writing another analysis on top of the dataflow graph, you probably want to know all definitions that serve as the source of a read, all functions
that are called by an invocation, and more.
For this, the ${ctx.link(getOriginInDfg)} function provides you with a collection of ${ctx.link('Origin')} objects:

${ctx.hierarchy('Origin', { openTop: true })}

Their respective uses are documented alongside their implementation:

${
		['SimpleOrigin', 'FunctionCallOrigin', 'BuiltInFunctionOrigin'].sort((a, b) => a.localeCompare(b)).map(
			key => `- ${ctx.link(key)}\\\n${ctx.doc(key, { type: 'interface' })}`
		).join('\n')
		}

Please note, the current structure of this function is biased by what implementations already exist in flowR.
Hence, we do not just track definitions and constants, but also the origins of function calls, albeit we do not yet track the origins of values (only resorting to
a constant origin). If you are confused by this please start a discussion&mdash;in a way we are still deciding on a good API for this.
	`;

	})()
}

`;
	}
}
