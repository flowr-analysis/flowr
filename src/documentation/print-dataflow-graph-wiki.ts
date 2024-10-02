import { DataflowGraph } from '../dataflow/graph/graph';
import type { MermaidMarkdownMark } from '../util/mermaid/dfg';
import { RShell } from '../r-bridge/shell';
import type { DataflowGraphVertexFunctionCall } from '../dataflow/graph/vertex';
import { VertexType } from '../dataflow/graph/vertex';
import { EdgeType } from '../dataflow/graph/edge';
import { emptyGraph } from '../dataflow/graph/dataflowgraph-builder';
import { guard } from '../util/assert';
import { defaultEnv } from '../../test/functionality/_helper/dataflow/environment-builder';
import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { printDfGraph, printDfGraphForCode, verifyExpectedSubgraph } from './doc-util/doc-dfg';
import { FlowrGithubBaseRef, FlowrWikiBaseRef, getFilePathMd } from './doc-util/doc-files';
import { autoGenHeader } from './doc-util/doc-auto-gen';
import { nth } from '../util/text';
import { PipelineExecutor } from '../core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../r-bridge/retriever';
import type { PipelineOutput } from '../core/steps/pipeline/pipeline';
import { jsonReplacer } from '../util/json';
import { printEnvironmentToMarkdown } from './doc-util/doc-env';
import type {
	ExplanationParameters,
	SubExplanationParameters
} from './data/dfg/doc-data-dfg-util';
import {
	getAllEdges,
	getAllVertices
} from './data/dfg/doc-data-dfg-util';
import { getReplCommand } from './doc-util/doc-cli-option';
import type { MermaidTypeReport } from './doc-util/doc-types';
import { getTypesFromFolderAsMermaid, printHierarchy } from './doc-util/doc-types';
import { block, details } from './doc-util/doc-structure';
import { codeBlock } from './doc-util/doc-code';
import path from 'path';
import { lastJoin, prefixLines } from './doc-util/doc-general';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { recoverName } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { ReferenceType } from '../dataflow/environments/identifier';
import { EmptyArgument } from '../r-bridge/lang-4.x/ast/model/nodes/r-function-call';

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

<summary>Interesting Case${expls.length > 1 ? 's' : ''}</summary>

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

async function getVertexExplanations(shell: RShell, vertexType: MermaidTypeReport): Promise<string> {
	/* we use the map to ensure order easily :D */
	const vertexExplanations = new Map<VertexType,[ExplanationParameters, SubExplanationParameters[]]>();

	vertexExplanations.set(VertexType.Value, [{
		shell:       shell,
		name:        'Value Vertex',
		type:        VertexType.Value,
		description: `
Describes a constant value (numbers, booleans/logicals, strings, ...).
In general, the respective vertex is more or less a dummy vertex as you can see from its implementation.

${
	printHierarchy({ program: vertexType.program, hierarchy: vertexType.info, root: 'DataflowGraphVertexValue' })
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
		'In the following graph, the original type printed by mermaid is still `RSymbol` (from the [normalized AST](${FlowrWikiBaseRef}/Normalized%20AST)), however, the shape of the vertex signals to you that the symbol is in-fact treated as a constant! If you do not know what `df$column` even means, please refer to the [R topic](https://rdrr.io/r/base/Extract.html).\n' + 
				await printDfGraphForCode(shell, 'df$column', { mark: new Set([1]) }))
}
		`,
		code:             '42',
		expectedSubgraph: emptyGraph().constant('0')
	}, []]);

	vertexExplanations.set(VertexType.Use, [{
		shell:       shell,
		name:        'Use Vertex',
		type:        VertexType.Use,
		description: `
		
Describes symbol/variable references which are read (or potentially read at a given position).
Similar to the [value vertex](#value-vertex) described above, this is more a marker vertex as 
you can see from the implementation.

${
	printHierarchy({ program: vertexType.program, hierarchy: vertexType.info, root: 'DataflowGraphVertexUse' })
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
		'In the following graph, the original type printed by mermaid is still `RString` (from the [normalized AST](${FlowrWikiBaseRef}/Normalized%20AST)), however, the shape of the vertex signals to you that the symbol is in-fact treated as a variable use! ' +
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
		shell:       shell,
		name:        'Function Call Vertex',
		type:        VertexType.FunctionCall,
		description: `
Describes any kind of function call, including unnamed calls and those that happen implicitly!
In general the vertex provides you with information about 
the _name_ of the called function, the passed _arguments_, and the _environment_ in which the call happens (if it is of importance).

However, the implementation reveals that it may hold an additional \`onlyBuiltin\` flag to indicate that the call is only calling builtin functions &mdash; however, this is only a flag to improve performance
and it should not be relied on as it may under-approximate the actual calling targets (e.g., being \`false\` even though all calls resolve to builtins).
	 
${
	printHierarchy({ program: vertexType.program, hierarchy: vertexType.info, root: 'DataflowGraphVertexFunctionCall' })
}
The related function argument references are defined like this:
${
	printHierarchy({ program: vertexType.program, hierarchy: vertexType.info, root: 'FunctionArgument' })
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
			const itentifierType = getTypesFromFolderAsMermaid({
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

${printHierarchy({ program: itentifierType.program, hierarchy: itentifierType.info, root: 'ReferenceType' })}
	`;
		})())
}

${
	block({
		type:    'NOTE',
		content: `
But how do you know which definitions are actually called by the function?
So first of all, some frontends of _flowR_ (like the ${getReplCommand('slicer')} and ${getReplCommand('query')} with the [Query API}(${FlowrWikiBaseRef}/Query%20API)) already provide you with this information.
In general there are three scenarios you may be interested in:

1. the function resolves only to builtin definitions (like \`<-\`)  
${
	prefixLines(details('Details', `
Heho
`), '    ')
}

2. the function only resolves to definitions that are present in the program
3. the function resolves to a mix of both

				`
	})
}

 TODO: normal call, call with for or other control structures, unnamed call, call with side effect, call with unknown function, call with only builtin function, redefined builtin functions
 TODO: general node on calls and argument edges
 
`,
		code:             'foo()',
		expectedSubgraph: emptyGraph().call('1@foo', 'foo', [])
	}, [{
		name:             'Built-In Function Call',
		description:      'Control structures like `if` are desugared into function calls (we omit the arguments of `if`(TRUE, 1) for simplicity).',
		code:             'if(TRUE) 1',
		expectedSubgraph: emptyGraph().call('1@if', 'if', [], { onlyBuiltIn: true })
	}]]);

	vertexExplanations.set(VertexType.VariableDefinition, [{
		shell:            shell,
		name:             'Variable Definition Vertex',
		type:             VertexType.VariableDefinition,
		description:      'Describes a defined variable. Not just `<-` causes this!',
		code:             'x <- 1',
		expectedSubgraph: emptyGraph().defineVariable('1@x', 'x')
	}, [{
		name:             'Globally Defined Variable',
		description:      'Are described similar within the dataflow graph, only the active environment differs.',
		code:             'x <<- 1',
		expectedSubgraph: emptyGraph().defineVariable('1@x', 'x')
	}]]);

	vertexExplanations.set(VertexType.FunctionDefinition, [{
		shell:            shell,
		name:             'Function Definition Vertex',
		type:             VertexType.FunctionDefinition,
		description:      'Describes a function definition. Are always anonymous at first; although they can be bound to a name, the id `0` refers to the `1` in the body. The presented subgraph refers to the body of the function, marking exit points and open references.',
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

async function getEdgesExplanations(shell: RShell): Promise<string> {
	const edgeExplanations = new Map<EdgeType,[ExplanationParameters, SubExplanationParameters[]]>();

	edgeExplanations.set(EdgeType.Reads, [{
		shell:            shell,
		name:             'Reads Edge',
		type:             EdgeType.Reads,
		description:      'The source vertex is usually a `use` that reads from the respective target definition.',
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
		shell:            shell,
		name:             'DefinedBy Edge', /* concat for link generation */
		type:             EdgeType.DefinedBy,
		description:      'The source vertex is usually a `define variable` that is defined by the respective target use. However, nested definitions can carry it (in the nested case, `x` is defined by the return value of `<-`(y, z)). Additionally, we link the assignment.',
		code:             'x <- y',
		expectedSubgraph: emptyGraph().definedBy('1@x', '1@y').definedBy('1@x', '1:3')
	}, [{
		name:             'DefinedBy Edge (Nested)',
		description:      'Nested definitions can carry the `defined by` edge as well.',
		code:             'x <- y <- z',
		expectedSubgraph: emptyGraph().definedBy('1@x', '1:3').definedBy('1@x', '1:8').definedBy('1@y', '1:8')
	}, {
		name:             'DefinedBy Edge (Expression)',
		description:      'Here, we define by the result of the `+` expression.',
		code:             'x <- y + z',
		expectedSubgraph: emptyGraph().definedBy('1@x', '1:8')
	}]]);

	edgeExplanations.set(EdgeType.Calls, [{
		shell:            shell,
		name:             'Calls Edge',
		type:             EdgeType.Calls,
		description:      'Link the function call to the (anonymous) function definition.',
		code:             'foo <- function() {}\nfoo()',
		expectedSubgraph: emptyGraph().calls('2@foo', '1@function')
	}, []]);

	edgeExplanations.set(EdgeType.Returns, [{
		shell:            shell,
		name:             'Returns Edge',
		type:             EdgeType.Returns,
		description:      'Link the function call to the exit points of the target definition (this may incorporate the call-context).',
		code:             'foo <- function() x\nfoo()',
		expectedSubgraph: emptyGraph().returns('2@foo', '1@x')
	}, []]);

	edgeExplanations.set(EdgeType.DefinesOnCall, [{
		shell:            shell,
		name:             'DefinesOnCall Edge',
		type:             EdgeType.DefinesOnCall,
		description:      '**This edge is automatically joined with defined by on call!**\n\n Link an Argument to whichever parameter they cause to be defined if the related function call is invoked.',
		code:             'f <- function(x) {}\nf(x=1)',
		// here we use the ids as the argument wrappers are not easily selected with slicing criteria
		expectedSubgraph: emptyGraph().definesOnCall('$11', '$1')
	}, []]);

	edgeExplanations.set(EdgeType.DefinedByOnCall, [{
		shell:            shell,
		name:             'DefinedByOnCall Edge',
		type:             EdgeType.DefinedByOnCall,
		description:      '**This edge is automatically joined with defines on call!**\n\n This represents the other direction of `defines on call` (i.e., links the parameter to the argument). This is just for completeness.',
		code:             'f <- function(x) {}\nf(x=1)',
		expectedSubgraph: emptyGraph().definesOnCall('$11', '$1')
	}, []]);

	edgeExplanations.set(EdgeType.Argument, [{
		shell:            shell,
		name:             'Argument Edge',
		type:             EdgeType.Argument,
		description:      'Links a function call to the entry point of its arguments. If we do not know the target of such a call, we automatically assume that all arguments are read by the call as well!',
		code:             'f(x,y)',
		expectedSubgraph: emptyGraph().argument('1@f', '1@x').reads('1@f', '1@x').argument('1@f', '1@y').reads('1@f', '1@y')
	}, []]);

	edgeExplanations.set(EdgeType.SideEffectOnCall, [{
		shell:            shell,
		name:             'SideEffectOnCall Edge',
		type:             EdgeType.SideEffectOnCall,
		description:      'Links a global side effect to an affected function call (e.g., a super definition within the function body)',
		code:             'f <- function() { x <<- 2 }\nf()',
		expectedSubgraph: emptyGraph().sideEffectOnCall('1@x', '2@f')
	}, []]);

	edgeExplanations.set(EdgeType.NonStandardEvaluation, [{
		shell:            shell,
		name:             'NonStandardEvaluation Edge',
		type:             EdgeType.NonStandardEvaluation,
		description:      'Marks cases in which R\'s non-standard evaluation mechanisms cause the default semantics to deviate',
		code:             'quote(x)',
		expectedSubgraph: emptyGraph().argument('1@quote', '1@x').nse('1@quote', '1@x')
	}, []]);


	const results = [];
	let i = 0;
	for(const [,edge] of getAllEdges()) {
		const get = edgeExplanations.get(edge);
		guard(get !== undefined, () => `No explanation for edge type ${edge}`);
		const [expl, subExplanations] = get;
		results.push(await explanation(expl, ++i, ...subExplanations));
	}
	return results.join('\n');
}

async function dummyDataflow(): Promise<PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>> {
	const shell = new RShell();
	const result = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
		shell,
		request: requestFromInput('x <- 1\nx + 1')
	}).allRemainingSteps();
	shell.close();
	return result;
}

async function getText(shell: RShell) {
	const rversion = (await shell.usedRVersion())?.format() ?? 'unknown';
	/* we collect type information on the graph */
	const vertexType = getTypesFromFolderAsMermaid({
		files:       [path.resolve('./src/dataflow/graph/vertex.ts'), path.resolve('./src/dataflow/graph/graph.ts'), path.resolve('./src/dataflow/environments/identifier.ts')],
		typeName:    'DataflowGraphVertexInfo',
		inlineTypes: ['MergeableRecord']
	});
	const edgeType = getTypesFromFolderAsMermaid({
		files:       [path.resolve('./src/dataflow/graph/edge.ts'), path.resolve('./src/dataflow/graph/graph.ts'), path.resolve('./src/dataflow/environments/identifier.ts')],
		typeName:    'EdgeType',
		inlineTypes: ['MergeableRecord']
	});
	return `${autoGenHeader({ filename: module.filename, purpose: 'dataflow graph', rVersion: rversion })}

This page briefly summarizes flowR's dataflow graph, represented by ${DataflowGraph.name} in ${getFilePathMd('../dataflow/graph/graph.ts')}.
In case you want to manually build such a graph (e.g., for testing), you can use the builder in ${getFilePathMd('../dataflow/graph/dataflowgraph-builder.ts')}.
This wiki page focuses on explaining what such a dataflow graph looks like!

Please be aware that the accompanied [dataflow information](#dataflow-information) returned by _flowR_ contains things besides the graph, 
like the entry and exit points of the subgraphs, and currently active references (see [below](#dataflow-information)).
Additionally, you may be interested in the set of [Unknown Side Effects](#unknown-side-effects) marking calls which _flowR_ is unable to handle correctly.	

> [!TIP]
> If you want to investigate the dataflow graph, 
> you can either use the [Visual Studio Code extension](${FlowrGithubBaseRef}/vscode-flowr) or the ${getReplCommand('dataflow*')} 
> command in the REPL (see the [Interface wiki page](${FlowrWikiBaseRef}/Interface) for more information). 

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
> using the \`${DataflowGraph.name}::idMap\` linked to the dataflow graph:
${prefixLines(codeBlock('ts', 'const node = graph.idMap.get(id);'), '> ')}
> In case you just need the name (\`lexeme\`) of the respective vertex, ${recoverName.name} (defined in ${getFilePathMd('../r-bridge/lang-4.x/ast/model/processing/node-id.ts')}) can help you out:
${prefixLines(codeBlock('ts', `const name = ${recoverName.name}(id, graph.idMap);`), '> ')}

## Vertices

${await getVertexExplanations(shell, vertexType)}

## Edges

${await getEdgesExplanations(shell)}

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

## Dataflow Information

Using _flowR's_ code interface (see the [Interface](${FlowrWikiBaseRef}/Interface) wiki page for more), you can generate the dataflow information
for a given piece of R code (in this case \`x <- 1; x + 1\`) as follows:

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

So let's start by looking at the properties of the dataflow information object: ${Object.keys(result.dataflow).map(k => `\`${k}\``).join(', ')}.

${ (() => {
			guard(Object.keys(result.dataflow).length === 7, () => 'Update Dataflow Documentation!'); return ''; 
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

${
		printEnvironmentToMarkdown(result.dataflow.environment.current)
		}

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
