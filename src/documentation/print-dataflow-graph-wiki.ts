import { DataflowGraph } from '../dataflow/graph/graph';
import type { MermaidMarkdownMark } from '../util/mermaid/dfg';
import { RShell } from '../r-bridge/shell';
import type { DataflowGraphVertexFunctionCall, DataflowGraphVertexFunctionDefinition } from '../dataflow/graph/vertex';
import { VertexType } from '../dataflow/graph/vertex';
import { EdgeType, edgeTypeToName } from '../dataflow/graph/edge';
import { DataflowGraphBuilder, emptyGraph } from '../dataflow/graph/dataflowgraph-builder';
import { guard } from '../util/assert';
import { formatSideEffect, printDfGraph, printDfGraphForCode, verifyExpectedSubgraph } from './doc-util/doc-dfg';
import { FlowrGithubBaseRef, FlowrWikiBaseRef, getFilePathMd } from './doc-util/doc-files';
import { PipelineExecutor } from '../core/pipeline-executor';
import { requestFromInput } from '../r-bridge/retriever';
import { jsonReplacer } from '../util/json';
import { printEnvironmentToMarkdown } from './doc-util/doc-env';
import type { ExplanationParameters, SubExplanationParameters } from './data/dfg/doc-data-dfg-util';
import { getAllEdges, getAllVertices } from './data/dfg/doc-data-dfg-util';
import { getReplCommand } from './doc-util/doc-cli-option';
import type { MermaidTypeReport } from './doc-util/doc-types';
import { shortLink , getTypesFromFolderAsMermaid, printHierarchy } from './doc-util/doc-types';
import { block, details } from './doc-util/doc-structure';
import { codeBlock } from './doc-util/doc-code';
import path from 'path';
import { lastJoin, prefixLines } from './doc-util/doc-general';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { recoverName } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { ReferenceType } from '../dataflow/environments/identifier';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { resolveByName, resolvesToBuiltInConstant } from '../dataflow/environments/resolve-by-name';
import { defaultEnv } from '../../test/functionality/_helper/dataflow/environment-builder';
import { DEFAULT_DATAFLOW_PIPELINE } from '../core/steps/pipeline/default-pipelines';
import type { PipelineOutput } from '../core/steps/pipeline/pipeline';
import { autoGenHeader } from './doc-util/doc-auto-gen';
import { nth } from '../util/text';
import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { getAllFunctionCallTargets } from '../dataflow/internal/linker';
import { printNormalizedAstForCode } from './doc-util/doc-normalized-ast';
import type { RFunctionDefinition } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';

async function subExplanation(shell: RShell, { description, code, expectedSubgraph }: SubExplanationParameters): Promise<string> {
	expectedSubgraph = await verifyExpectedSubgraph(shell, code, expectedSubgraph);

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
${await printDfGraphForCode(shell, code, { mark: new Set(marks) })}

${description}`;

}

async function printAllSubExplanations(shell: RShell, expls: readonly SubExplanationParameters[]): Promise<string> {
	let result = `
<details>

<summary>Additional Case${expls.length > 1 ? 's' : ''}</summary>

`;
	for(const sub of expls) {
		result += `#### ${sub.name}\n`;
		result += await subExplanation(shell, sub) + '\n';
	}
	return result + '\n\n</details>';
}

async function explanation(
	{ shell, name, type, description, code, expectedSubgraph }: ExplanationParameters,
	index: number,
	...subExplanations: SubExplanationParameters[]
): Promise<string> {
	await verifyExpectedSubgraph(shell, code, expectedSubgraph);


	return `
<a id='${name.toLowerCase().replaceAll(' ', '-')}'> </a>
### ${index}) ${name}

Type: \`${type}\`

${await subExplanation(shell, { name, description, code, expectedSubgraph })}

${subExplanations.length > 0 ? await printAllSubExplanations(shell, subExplanations) : ''}
	`;
}

function edgeTypeToId(edgeType: EdgeType): string {
	return edgeTypeToName(edgeType).toLowerCase().replaceAll(' ', '-');
}

function linkEdgeName(edgeType: EdgeType): string {
	return `[\`${edgeTypeToName(edgeType)}\`](#${edgeTypeToId(edgeType)})`;
}

async function getVertexExplanations(shell: RShell, vertexType: MermaidTypeReport): Promise<string> {
	/* we use the map to ensure order easily :D */
	const vertexExplanations = new Map<VertexType,[ExplanationParameters, SubExplanationParameters[]]>();

	vertexExplanations.set(VertexType.Value, [{
		shell,
		name:        'Value Vertex',
		type:        VertexType.Value,
		description: `
Describes a constant value (numbers, booleans/logicals, strings, ...).
In general, the respective vertex is more or less a dummy vertex as you can see from its implementation.

${
	printHierarchy({ program: vertexType.program, info: vertexType.info, root: 'DataflowGraphVertexValue' })
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
		`In the following graph, the original type printed by mermaid is still \`RSymbol\` (from the [normalized AST](${FlowrWikiBaseRef}/Normalized%20AST)), however, the shape of the vertex signals to you that the symbol is in-fact treated as a constant! If you do not know what \`df$column\` even means, please refer to the [R topic](https://rdrr.io/r/base/Extract.html).\n` + 
				await printDfGraphForCode(shell, 'df$column', { mark: new Set([1]) }))
}
		`,
		code:             '42',
		expectedSubgraph: emptyGraph().constant('0')
	}, []]);

	vertexExplanations.set(VertexType.Use, [{
		shell,
		name:        'Use Vertex',
		type:        VertexType.Use,
		description: `
		
Describes symbol/variable references which are read (or potentially read at a given position).
Similar to the [value vertex](#value-vertex) described above, this is more a marker vertex as 
you can see from the implementation.

${
	printHierarchy({ program: vertexType.program, info: vertexType.info, root: 'DataflowGraphVertexUse' })
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
				await printDfGraphForCode(shell, 'get("x")', { mark: new Set([1]) }))
}

But now to the interesting stuff: how do we actually know which values are read by the respective variable use?
This usually involves a [variable definition](#variable-definition-vertex) and a [reads edge](#reads-edge) linking the two.

${
	details('Example: Reads Edge Identifying a Single Definition',
		'In the following graph, the `x` is read from the definition `x <- 1`.\n' +
				await printDfGraphForCode(shell, 'x <- 1\nprint(x)', { mark: new Set([3, '0->3']), codeOpen: true }))
}

In general, there may be many such edges, identifying every possible definition of the variable.

${
	details('Example: Reads Edge Identifying Multiple Definitions (conditional)',
		await printDfGraphForCode(shell, 'x <- 1\nif(u) x <- 2\nprint(x)', { mark: new Set([10, '10->0', '10->4']), codeOpen: true }))
}
${
	details('Example: Reads Edge Identifying Multiple Definitions (loop)',
		await printDfGraphForCode(shell, 'x <- 1\nfor(i in v) x <- 2\nprint(x)', { mark: new Set([11, '11->0', '11->5']), codeOpen: true }))
}
${
	details('Example: Reads Edge Identifying Multiple Definitions (side-effect)',
		await printDfGraphForCode(shell, 'f <- function() x <<- 2\nx <- 2\nif(u) f()\nprint(x)', { mark: new Set([16, '16->1', '16->7']), codeOpen: true }))
}
`,
		code:             'x',
		expectedSubgraph: emptyGraph().use('1@x', 'x')
	}, []]);

	vertexExplanations.set(VertexType.FunctionCall, [{
		shell,
		name:        'Function Call Vertex',
		type:        VertexType.FunctionCall,
		description: `
Describes any kind of function call, including unnamed calls and those that happen implicitly!
In general the vertex provides you with information about 
the _name_ of the called function, the passed _arguments_, and the _environment_ in which the call happens (if it is of importance).

However, the implementation reveals that it may hold an additional \`onlyBuiltin\` flag to indicate that the call is only calling builtin functions &mdash; however, this is only a flag to improve performance,
and it should not be relied on as it may under-approximate the actual calling targets (e.g., being \`false\` even though all calls resolve to builtins).
	 
${
	printHierarchy({ program: vertexType.program, info: vertexType.info, root: 'DataflowGraphVertexFunctionCall' })
}
The related function argument references are defined like this:
${
	printHierarchy({ program: vertexType.program, info: vertexType.info, root: 'FunctionArgument' })
}


${
	details('Example: Simple Function Call (unresolved)', 
		await (async() => {
			const code = 'foo(x,3,y=3,)';
			const [text, info] = await printDfGraphForCode(shell, code, { mark: new Set([8]), exposeResult: true });
			const callInfo = [...info.dataflow.graph.vertices(true)].find(([, vertex]) => vertex.tag === VertexType.FunctionCall && vertex.name === 'foo');
			guard(callInfo !== undefined, () => `Could not find call vertex for ${code}`);
			const [callId, callVert] = callInfo as [NodeId, DataflowGraphVertexFunctionCall];
			const inverseMapReferenceTypes = Object.fromEntries(Object.entries(ReferenceType).map(([k, v]) => [v, k]));
			const identifierType = getTypesFromFolderAsMermaid({
				files:       [path.resolve('./src/dataflow/environments/identifier.ts')],
				typeName:    'IdentifierReference',
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

${await printDfGraphForCode(shell, 'x <- 2')}

In this case, the call does not have a single ${linkEdgeName(EdgeType.Calls)} edge, which in general means (i.e., if the analysis is done and you are not looking at an intermediate result) it is bound to anything
global beyond the scope of the given script. _flowR_ generally (theoretically at least) does not know if the call really refers to a built-in variable or function,
as any code that is not part of the analysis could cause the semantics to change. 
However, it is (in most cases) safe to assume we call a builtin if there is a builtin function with the given name and if there is no ${linkEdgeName(EdgeType.Calls)} edge attached to a call.
If you want to check the resolve targets, refer to \`${resolveByName.name}\` which is defined in ${getFilePathMd('../dataflow/environments/resolve-by-name')}.
`)
}

${details('2) the function only resolves to definitions that are present in the program', `

Let's have a look at a call to a function named \`foo\` which is defined in the same script:

${await (async() => {
		const code = 'foo <- function() 3\nfoo()'; 
		const [text, info] = await printDfGraphForCode(shell, code, { exposeResult: true, mark: new Set([6, '6->0', '6->1', '6->3']) });
		
		const numberOfEdges = [...info.dataflow.graph.edges()].flatMap(e => [...e[1].keys()]).length;
		const callVertex = [...info.dataflow.graph.vertices(true)].find(([, vertex]) => vertex.tag === VertexType.FunctionCall && vertex.name === 'foo');
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
			+ await printDfGraphForCode(shell, 'f <- function() 3\ng <- f\ng()', { mark: new Set(['9', '9->5', '9->3']) }))}
			
Lastly, the ${linkEdgeName(EdgeType.Returns)} edge links the call to the return vertices(s) of the function.
Please be aware, that these multiple exit points may be counter intuitive as they often appear with a nested call (usually a call to the built-in \`{\` function).

 ${details('(Advanced) Example: Multiple Exit Points May Still Reflect As One',
			await printDfGraphForCode(shell, `
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
		const [text, info] = await printDfGraphForCode(shell, 'x <- 2\nif(u) `<-` <- `*`\nx <- 3', { switchCodeAndGraph: true, mark: new Set([9, '9->0', '9->10']), exposeResult: true });
	
		const interestingUseOfAssignment = [...info.dataflow.graph.vertices(true)].find(([, vertex]) => vertex.id === 11);
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
Hence, trying to re-resolve the call using \`${getAllFunctionCallTargets.name}\` (defined in ${getFilePathMd('../dataflow/internal/linker.ts')}) with the id \`${id}\` of the call as starting point will present you with
the following target ids: { \`${[...getAllFunctionCallTargets(id, info.dataflow.graph)].join('`, `')}\` }.
This way we know that the call may refer to the built-in assignment operator or to the multiplication.
Similarly, trying to resolve the name with \`${resolveByName.name}\` using the environment attached to the call vertex (filtering for any reference type) returns (in a similar fashion): 
{ \`${resolveByName(name, env)?.map(d => d.nodeId).join('`, `')}\` } (however, the latter will not trace aliases).

	`;		
	})()}

`)}

				`
	})
}

Function calls are the most complicated mechanism in R as essentially everything is a function call.
Even **control structures** like \`if(p) a else b\` are desugared into function calls (e.g., as \`if\`(p, a, b)).
${details('Example: <code>if</code> as a Function Call', await printDfGraphForCode(shell, 'if(p) a else b'))}

Similarly, you should be aware of calls to **anonymous functions**, which may appear given directly (e.g. as \`(function() 1)()\`) or indirectly, with code
directly calling the return of another function call: \`foo()()\`.
${details('Example: Anonymous Function Call (given directly)', await printDfGraphForCode(shell, '(function() 1)()', { mark: new Set([6, '6->4']) }))}

${details('Example: Anonymous Function Call (given indirectly)', await printDfGraphForCode(shell, 'foo <- function() return(function() 3)\nfoo()()', { mark: new Set([12, '12->4']) }))}

Another interesting case is a function with **side effects**, most prominently with the super-assignment \`<<-\`.
In this case, you may encounter the ${linkEdgeName(EdgeType.SideEffectOnCall)} as exemplified below.
${details('Example: Function Call with a Side-Effect', await printDfGraphForCode(shell, 'f <- function() x <<- 3\n f()', { mark: new Set([8, '1->8']) }))}
 
`,
		code:             'foo()',
		expectedSubgraph: emptyGraph().call('1@foo', 'foo', [])
	}, []]);

	vertexExplanations.set(VertexType.VariableDefinition, [{
		shell,
		name:        'Variable Definition Vertex',
		type:        VertexType.VariableDefinition,
		description: `
Defined variables most commonly occur in the context of an assignment, for example, with the \`<-\` operator as shown above.

${details('Example: Super Definition (<code><<-</code>)', await printDfGraphForCode(shell, 'x <<- 1', { mark: new Set([0]) }))}

The implementation is relatively sparse and similar to the other marker vertices:

${
	printHierarchy({ program: vertexType.program, info: vertexType.info, root: 'DataflowGraphVertexVariableDefinition' })
}

Of course, there are not just operators that define variables, but also functions, like \`assign\`.

${
	details('Example: Using <code>assign</code>', 
		await printDfGraphForCode(shell, 'assign("x", 1)\nx', { mark: new Set([1]) })
		+ `\nThe example may be misleading as the visualization uses \`${recoverName.name}\` to print the lexeme of the variable. However, this actually defines the variable \`x\` (without the quotes) as you can see with the ${linkEdgeName(EdgeType.Reads)} edge.`
	)
}

Please be aware, that the name of the symbol defined may differ from what you read in the program as R allows the assignments to strings, escaped names, and more:

${details('Example: Assigning with an Escaped Name', await printDfGraphForCode(shell, '`x` <- 1\nx', { mark: new Set([0]) }))}
${details('Example: Assigning with a String', await printDfGraphForCode(shell, '"x" <- 1\nx', { mark: new Set([0]) }))}

Definitions may be constrained by conditionals (_flowR_ takes care of calculating the dominating front for you).

${details('Conditional Assignments', await (async() => {
		const constrainedDefinitions = await printDfGraphForCode(shell, 'x <- 0\nif(u) x <- 1 else x <- 2\nx', { exposeResult: true });
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
		shell,
		name:        'Function Definition Vertex',
		type:        VertexType.FunctionDefinition,
		description: `
Defining a function does do a lot of things: 1) it creates a new scope, 2) it may introduce parameters which act as promises and which are only evaluated if they are actually required in the body, 3) it may access the enclosing environments and the callstack.
The vertex object in the dataflow graph stores multiple things, including all exit points, the enclosing environment if necessary, and the information of the subflow (the "body" of the function).

${
	printHierarchy({ program: vertexType.program, info: vertexType.info, root: 'DataflowGraphVertexFunctionDefinition' })
}
The subflow is defined like this:
${
	printHierarchy({ program: vertexType.program, info: vertexType.info, root: 'DataflowFunctionFlowInformation' })
}
And if you are interested in the exit points, they are defined like this:
${
	printHierarchy({ program: vertexType.program, info: vertexType.info, root: 'ExitPoint' })
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
			const [text, info] = await printDfGraphForCode(shell, 'f <- function() { g <- function() 3 }', { mark: new Set([9, 6]), exposeResult: true });
	
			const definitions = [...info.dataflow.graph.vertices(true)]
				.filter(([, vertex]) => vertex.tag === VertexType.FunctionDefinition)
				.map(([id, vertex]) => `| \`${id}\` | { \`${[...(vertex as DataflowGraphVertexFunctionDefinition).subflow.graph].join('`, `')}\` } |`);
			
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
			const [text, info] = await printDfGraphForCode(shell, code, { mark: new Set([10, 1, 3]), exposeResult: true });
			const ast = await printNormalizedAstForCode(shell, code, { prefix: 'flowchart LR\n', showCode: false });
			
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

${await printDfGraphForCode(shell, '\\(x) x + 1', { switchCodeAndGraph: true })}

Besides this being a theoretically "shorter" way of defining a function, this behaves similarly to the use of \`function\`. 

`,
		code:             'function() 1',
		expectedSubgraph: emptyGraph().defineFunction('1@function', [0], { graph: new Set('0'), in: [], out: [], unknownReferences: [], entryPoint: 0, environment: defaultEnv() })
	}, []]);

	const results = [];
	let i = 0;
	for(const [,vertex] of getAllVertices()) {
		const get = vertexExplanations.get(vertex);
		guard(get !== undefined, () => `No explanation for vertex type ${vertex}`);
		const [expl, subExplanations] = get;
		results.push(await explanation(expl, ++i, ...subExplanations));
	}
	return results.join('\n');
}

async function getEdgesExplanations(shell: RShell, vertexType: MermaidTypeReport): Promise<string> {
	const edgeExplanations = new Map<EdgeType,[ExplanationParameters, SubExplanationParameters[]]>();

	edgeExplanations.set(EdgeType.Reads, [{
		shell,
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
are currently tailored to what we need in _flowR_. Hence, we offer a function like ${shortLink(getAllFunctionCallTargets.name, vertexType.info)} (defined in ${getFilePathMd('../dataflow/internal/linker.ts')}),
as well as ${shortLink(resolvesToBuiltInConstant.name, vertexType.info)} (defined in ${getFilePathMd('../dataflow/environments/resolve-by-name.ts')}) which do this for specific cases.

${details('Example: Multi-Level Reads', await printDfGraphForCode(shell,  'x <- 3\ny <- x\nprint(y)', { mark: new Set(['9->7', '7->3', '4->0']) }))}

Similarly, ${linkEdgeName(EdgeType.Reads)} can be cyclic, for example in the context of loops:

${details('Example: Cyclic Reads', await printDfGraphForCode(shell, 'for(i in v) x <- x + 1', { mark: new Set(['3->2']) }))}
				`
	})
}
 
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
		shell,
		name:        'DefinedBy Edge', /* concat for link generation */
		type:        EdgeType.DefinedBy,
		description: `
The source vertex is usually a [\`define variable vertex\`](#variable-definition-vertex) linking the defined symbol to the entry point of the resulting side.
${
	details('In general, this does not have to be the right hand side of the operator.', await printDfGraphForCode(shell, '3 -> x', { mark: new Set([0]) }))
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
		shell,
		name:             'Calls Edge',
		type:             EdgeType.Calls,
		description:      'Link the [function call](#function-call-vertex) to the [function definition](#function-definition-vertex) that is called.',
		code:             'foo <- function() {}\nfoo()',
		expectedSubgraph: emptyGraph().calls('2@foo', '1@function')
	}, []]);

	edgeExplanations.set(EdgeType.Returns, [{
		shell,
		name:             'Returns Edge',
		type:             EdgeType.Returns,
		description:      'Link the [function call](#function-call-vertex) to the exit points of the target definition (this may incorporate the call-context).',
		code:             'foo <- function() x\nfoo()',
		expectedSubgraph: emptyGraph().returns('2@foo', '1@x')
	}, []]);


	const lateBindingExample = `
f <- function() x
x <- 3
f()
	`.trim();

	const dfInfo = await printDfGraphForCode(shell, lateBindingExample, { switchCodeAndGraph: true, codeOpen: true, mark: new Set([1, '1->5', '9->5']) });

	edgeExplanations.set(EdgeType.DefinesOnCall, [{
		shell,
		name:        'DefinesOnCall Edge',
		type:        EdgeType.DefinesOnCall,
		description: `*This edge is usually joined with ${linkEdgeName(EdgeType.DefinedByOnCall)}!*

 Links an Argument to whichever parameter they cause to be defined if the related function call is invoked.
 
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
		shell,
		name:        'DefinedByOnCall Edge',
		type:        EdgeType.DefinedByOnCall,
		description: `*This edge is usually joined with ${linkEdgeName(EdgeType.DefinesOnCall)}!*

 This represents the other part of the ${linkEdgeName(EdgeType.DefinesOnCall)} edge (e.g., links the parameter to the argument). Please look there for further documentation.`,
		code:             'f <- function(x) {}\nf(x=1)',
		expectedSubgraph: emptyGraph().definesOnCall('$11', '$1').definedByOnCall('$1', '$11')
	}, []]);

	edgeExplanations.set(EdgeType.Argument, [{
		shell,
		name:        'Argument Edge',
		type:        EdgeType.Argument,
		description: `Links a [function call](#function-call-vertex) to the entry point of its arguments. If we do not know the target of such a call, we automatically assume that all arguments are read by the call as well!
		
The exception to this is the [function definition](#function-definition-vertex) which does no longer hold these argument relationships (as they are not implicit in the structure).
		`,
		code:             'f(x,y)',
		expectedSubgraph: emptyGraph().argument('1@f', '1@x').reads('1@f', '1@x').argument('1@f', '1@y').reads('1@f', '1@y')
	}, []]);

	edgeExplanations.set(EdgeType.SideEffectOnCall, [{
		shell,
		name:             'SideEffectOnCall Edge',
		type:             EdgeType.SideEffectOnCall,
		description:      'Links a global side effect to an affected function call (e.g., a super definition within the function body)',
		code:             'f <- function() { x <<- 2 }\nf()',
		expectedSubgraph: emptyGraph().sideEffectOnCall('1@x', '2@f')
	}, []]);

	edgeExplanations.set(EdgeType.NonStandardEvaluation, [{
		shell,
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

${details('Example: For-Loop Body', await printDfGraphForCode(shell, 'for(i in v) b', { mark: new Set([2, '4->2']) }))}	
${details('Example: While-Loop Body', await printDfGraphForCode(shell, 'while(TRUE) b', { mark: new Set([1, '3->1']) }))}	

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
		results.push(`<a id='${edgeTypeToId(edge)}'></a>` + await explanation(expl, ++i, ...subExplanations));
	}
	return results.join('\n');
}

async function dummyDataflow(): Promise<PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>> {
	const shell = new RShell();
	const result = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
		parser:  shell,
		request: requestFromInput('x <- 1\nx + 1')
	}).allRemainingSteps();
	shell.close();
	return result;
}

async function getText(shell: RShell) {
	const rversion = (await shell.usedRVersion())?.format() ?? 'unknown';
	/* we collect type information on the graph */
	const vertexType = getTypesFromFolderAsMermaid({
		rootFolder:  path.resolve('./src/'),
		typeName:    'DataflowGraphVertexInfo',
		inlineTypes: ['MergeableRecord']
	});
	const edgeType = getTypesFromFolderAsMermaid({
		files:       [path.resolve('./src/dataflow/graph/edge.ts'), path.resolve('./src/dataflow/graph/graph.ts'), path.resolve('./src/dataflow/environments/identifier.ts'), path.resolve('./src/dataflow/info.ts')],
		typeName:    'EdgeType',
		inlineTypes: ['MergeableRecord']
	});
	return `${autoGenHeader({ filename: module.filename, purpose: 'dataflow graph', rVersion: rversion })}

This page briefly summarizes flowR's dataflow graph, represented by the ${shortLink(DataflowGraph.name, vertexType.info)}.
In case you want to manually build such a graph (e.g., for testing), you can use the ${shortLink(DataflowGraphBuilder.name, vertexType.info)}.
This wiki page focuses on explaining what such a dataflow graph looks like!

Please be aware that the accompanied [dataflow information](#dataflow-information) returned by _flowR_ contains things besides the graph,
like the entry and exit points of the subgraphs, and currently active references (see [below](#dataflow-information)).
Additionally, you may be interested in the set of [Unknown Side Effects](#unknown-side-effects) marking calls which _flowR_ is unable to handle correctly.

> [!TIP]
> If you want to investigate the dataflow graph,
> you can either use the [Visual Studio Code extension](${FlowrGithubBaseRef}/vscode-flowr) or the ${getReplCommand('dataflow*')}
> command in the REPL (see the [Interface wiki page](${FlowrWikiBaseRef}/Interface) for more information). When using _flowR_ as a library, you may use the functions in ${getFilePathMd('../util/mermaid/dfg.ts')}.
> 
> If you receive a dataflow graph in its serialized form (e.g., by talking to a [_flowR_ server](${FlowrWikiBaseRef}/Interface)), you can use ${shortLink(`${DataflowGraph.name}::${DataflowGraph.fromJson.name}`, vertexType.info, true, 'i')} to retrieve the graph from the JSON representation.

${await printDfGraphForCode(shell,'x <- 3\ny <- x + 1\ny')}


The above dataflow graph showcases the general gist. We define a dataflow graph as a directed graph G = (V, E), differentiating between ${getAllVertices().length} types of vertices V and
${getAllEdges().length} types of edges E allowing each vertex to have a single, and each edge to have multiple distinct types.
Additionally, every node may have links to its [control dependencies](#control-dependencies) (which you may view as a ${nth(getAllEdges().length + 1)} edge type, although they are explicitly no data dependency).

<details open>

<summary>Vertex Types</summary>

The following vertices types exist:

1. ${getAllVertices().map(
		([k,v], index) => `[\`${k}\`](#${index + 1}-${v.toLowerCase().replace(/\s/g, '-')}-vertex)`
	).join('\n1. ')}

${vertexType.text.trim().length > 0 ? details('Class Diagram', 'All boxes should link to their respective implementation:\n' + codeBlock('mermaid', vertexType.text)) : ''}

</details>

<details open>

<summary>Edge Types</summary>

The following edges types exist, internally we use bitmasks to represent multiple types in a compact form:

1. ${getAllEdges().map(
		([k, v], index) => `[\`${k}\` (${v})](#${index + 1}-${k.toLowerCase().replace(/\s/g, '-')}-edge)`
	).join('\n1. ')}

${edgeType.text.trim().length > 0 ? details('Class Diagram', 'All boxes should link to their respective implementation:\n' + codeBlock('mermaid', edgeType.text)) : ''}

</details>


From an implementation perspective all of these types are represented by respective interfaces, see ${getFilePathMd('../dataflow/graph/vertex.ts')} and ${getFilePathMd('../dataflow/graph/edge.ts')}.

The following sections present details on the different types of vertices and edges, including examples and explanations.

> [!NOTE]
> Every dataflow vertex holds an \`id\` which links it to the respective node in the [normalized AST](${FlowrWikiBaseRef}/Normalized%20AST).
> So if you want more information about the respective vertex, you can usually access more information
> using the <code>${shortLink(`${DataflowGraph.name}`, vertexType.info, false, 'i')}::idMap</code> linked to the dataflow graph:
${prefixLines(codeBlock('ts', 'const node = graph.idMap.get(id);'), '> ')}
> In case you just need the name (\`lexeme\`) of the respective vertex, ${shortLink(recoverName.name, vertexType.info)} can help you out:
${prefixLines(codeBlock('ts', `const name = ${recoverName.name}(id, graph.idMap);`), '> ')}

## Vertices

${await getVertexExplanations(shell, vertexType)}

## Edges

${await getEdgesExplanations(shell, vertexType)}

## Control Dependencies

Each vertex may have a list of active control dependencies.
They hold the \`id\` of all nodes that effect if the current vertex is part of the execution or not,
and a boolean flag \`when\` to indicate if the control dependency is active when the condition is \`true\` or \`false\`.

As an example, consider the following dataflow graph:

${await printDfGraphForCode(shell,'if(p) a else b')}

Whenever we visualize a graph, we represent the control dependencies as grayed out edges with a \`CD\` prefix, followed
by the \`when\` flag.
In the above example, both \`a\` and \`b\` depend on the \`if\`. Please note that they are _not_ linked to the result of
the condition itself as this is the more general linkage point (and harmonizes with other control structures, especially those which are user-defined).

${details('Example: Multiple Vertices (Assignment)', await printDfGraphForCode(shell, 'if(p) a <- 1'))}
${details('Example: Multiple Vertices (Arithmetic Expression)', await printDfGraphForCode(shell, 'if(p) 3 + 2'))}
${details('Example: Nested Conditionals', await printDfGraphForCode(shell, 'if(x) { if(y) a else b } else c'))}

## Dataflow Information

Using _flowR's_ code interface (see the [Interface](${FlowrWikiBaseRef}/Interface) wiki page for more), you can generate the dataflow information
for a given piece of R code (in this case \`x <- 1; x + 1\`) as follows (using the ${shortLink(RShell.name, vertexType.info)} and the ${shortLink(PipelineExecutor.name, vertexType.info)} classes):

${codeBlock('ts', `
const shell = new ${RShell.name}()
const result = await new ${PipelineExecutor.name}(DEFAULT_DATAFLOW_PIPELINE, {
    shell,
    request:   ${requestFromInput.name}('x <- 1; x + 1')
}).allRemainingSteps();
shell.close();
`)}

<details>

<summary style="color:gray">Transpiled Code</summary>

The actual code we are using in case the example above gets oudated:

${codeBlock('ts', dummyDataflow.toString())}

</details>


Now, you can find the dataflow _information_ with \`result.dataflow\`. More specifically, the graph is stored in \`result.dataflow.graph\` and looks like this:

${
	await (async() => {
		const result = await dummyDataflow();
		const dfGraphString = printDfGraph(result.dataflow.graph);

		return `
${dfGraphString}

However, the dataflow information contains more, quite a lot of information in fact.

<details>

<summary style="color:gray">Dataflow Information as Json</summary>

_As the information is pretty long, we inhibit pretty printing and syntax highlighting:_
${codeBlock('text', JSON.stringify(result.dataflow, jsonReplacer))}

</details>

You may be interested in its implementation:

${
		printHierarchy({ program: vertexType.program, info: vertexType.info, root: 'DataflowInformation' })
		}

Let's start by looking at the properties of the dataflow information object: ${Object.keys(result.dataflow).map(k => `\`${k}\``).join(', ')}.

${ (() => {
			/* this includes the meta field for timing */
			guard(Object.keys(result.dataflow).length === 8, () => 'Update Dataflow Documentation!'); return ''; 
		})() }

There are three sets of references.
**in** (ids: ${JSON.stringify(new Set(result.dataflow.in.map(n => n.nodeId)), jsonReplacer)}) and **out** (ids: ${JSON.stringify(new Set(result.dataflow.out.map(n => n.nodeId)), jsonReplacer)}) contain the 
ingoing and outgoing references of the subgraph at hand (in this case, the whole code, as we are at the end of the dataflow analysis).
Besides the Ids, they also contain important meta-information (e.g., what is to be read).
The third set, **unknownReferences**, contains all references that are not yet identified as read or written 
(the example does not have any, but, for example, \`x\` (with id 0) would first be unknown and then later classified as a definition).

The **environment** property contains the active environment information of the subgraph.
In other words, this is a linked list of tables (scopes), mapping identifiers to their respective definitions.
A summarized version of the produced environment looks like this:

${printEnvironmentToMarkdown(result.dataflow.environment.current)}

This shows us that the local environment contains a single definition for \`x\` (with id 0) and that the parent environment is the built-in environment.
Additionally, we get the information that the node with the id 2 was responsible for the definition of \`x\`.

Last but not least, the information contains the single **entry point** (${
		JSON.stringify(result.dataflow.entryPoint)
		}) and a set of **exit points** (${
			JSON.stringify(result.dataflow.exitPoints.map(e => e.nodeId))
		}). 
Besides marking potential exits, the exit points also provide information about why the exit occurs and which control dependencies affect the exit.

### Unknown Side Effects

In case _flowR_ encounters a function call that it cannot handle, it marks the call as an unknown side effect.
You can find these as part of the dataflow graph, specifically as \`unknownSideEffects\` (with a leading underscore if sesrialized as JSON).
In the following graph, _flowR_ realizes that it is unable to correctly handle the impacts of the \`load\` call and therefore marks it as such (marked in bright red):

${await printDfGraphForCode(shell,'load("file")\nprint(x + y)')}

In general, as we cannot handle these correctly, we leave it up to other analyses (and [queries](${FlowrWikiBaseRef}/Query%20API)) to handle these cases
as they see fit.

#### Linked Unknown Side Effects

Not all side effects are created equal in the sense that they stem from a specific function call.
Consider R's basic [\`graphics\`](https://www.rdocumentation.org/packages/graphics/) which
implicitly draws on the current device and does not explicitly link a function like \`points\` to the last call opening a new graphic device. In such a scenario, we use a linked side effect to mark the relation:

${await (async() => {
			const [result, df] = await printDfGraphForCode(shell, 'plot(data)\npoints(data2)', { exposeResult: true });
			return `
${result}

Such side effects are not marked explicitly (with a big edge) but they are part of the unknown side effects: [${[...df.dataflow.graph.unknownSideEffects].map(formatSideEffect).join(',')}].
Additionally, we express this by a ${linkEdgeName(EdgeType.Reads)} edge.
	`;
		})()}
 

	`;

	})()
}

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
