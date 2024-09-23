import { DataflowGraph } from '../dataflow/graph/graph';
import type { MermaidMarkdownMark } from '../util/mermaid/dfg';
import { RShell } from '../r-bridge/shell';
import { VertexType } from '../dataflow/graph/vertex';
import { EdgeType } from '../dataflow/graph/edge';
import { emptyGraph } from '../dataflow/graph/dataflowgraph-builder';
import { guard } from '../util/assert';
import { defaultEnv } from '../../test/functionality/_helper/dataflow/environment-builder';
import { setMinLevelOfAllLogs } from '../../test/functionality/_helper/log';
import { LogLevel } from '../util/log';
import { printDfGraphForCode, verifyExpectedSubgraph } from './doc-util/doc-dfg';
import { getFilePathMd } from './doc-util/doc-files';
import { autoGenHeader } from './doc-util/doc-auto-gen';
import {nth} from "../util/text";

export interface SubExplanationParameters {
	readonly name:             string,
	readonly description:      string,
	readonly code:             string,
	readonly expectedSubgraph: DataflowGraph
}

export interface ExplanationParameters {
	readonly shell:            RShell,
	readonly name:             string,
	readonly type:             VertexType | EdgeType,
	readonly description:      string,
	readonly code:             string,
	readonly expectedSubgraph: DataflowGraph
}

function getAllVertices(): [string, VertexType][] {
	return Object.entries(VertexType) as [string, VertexType][];
}

function getAllEdges(): [string, EdgeType][] {
	return Object.entries(EdgeType).filter(([,v]) => Number.isInteger(v)) as [string, EdgeType][];
}


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
### ${index}) ${name}

Type: \`${type}\`

${await subExplanation(shell, { name, description, code, expectedSubgraph })}

${subExplanations.length > 0 ? await printAllSubExplanations(shell, subExplanations) : ''}
	`;
}

async function getVertexExplanations(shell: RShell): Promise<string> {
	/* we use the map to ensure order easily :D */
	const vertexExplanations = new Map<VertexType,[ExplanationParameters, SubExplanationParameters[]]>();

	vertexExplanations.set(VertexType.Value, [{
		shell:            shell,
		name:             'Value Vertex',
		type:             VertexType.Value,
		description:      'Describes a constant value (numbers, logicals, strings, ...)',
		code:             '42',
		expectedSubgraph: emptyGraph().constant('0')
	}, []]);

	vertexExplanations.set(VertexType.Use, [{
		shell:            shell,
		name:             'Use Vertex',
		type:             VertexType.Use,
		description:      'Describes symbol/variable references',
		code:             'x',
		expectedSubgraph: emptyGraph().use('1@x', 'x')
	}, []]);

	vertexExplanations.set(VertexType.FunctionCall, [{
		shell:            shell,
		name:             'Function Call Vertex',
		type:             VertexType.FunctionCall,
		description:      'Describes any kind of function call, these can happen implicitly as well! (see the notable cases)',
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


async function getText(shell: RShell) {
	const rversion = (await shell.usedRVersion())?.format() ?? 'unknown';
	return `${autoGenHeader({ filename: module.filename, purpose: 'dataflow graph', rVersion: rversion })}

This page briefly summarizes flowR's dataflow graph, represented by ${DataflowGraph.name} in ${getFilePathMd('../dataflow/graph/graph.ts')}.
In case you want to manually build such a graph (e.g., for testing), you can use the builder in ${getFilePathMd('../dataflow/graph/dataflowgraph-builder.ts')}.
This wiki page focuses on explaining what such a dataflow graph looks like!

${await printDfGraphForCode(shell,'x <- 3\ny <- x + 1\ny')}



The above dataflow graph showcases the general gist. We define a dataflow graph as a directed graph G = (V, E), differentiating between ${getAllVertices().length} types of vertices V and 
${getAllEdges().length} types of edges E allowing each vertex to have a single, and each edge to have multiple distinct types.
Additionally, every node may have links to its [control dependencies](#control-dependencies) (which you may view as a ${nth(getAllEdges().length + 1)} edge type although they are explicitly no data dependency).

<details open>

<summary>Vertex Types</summary>

The following vertices types exist:

1. ${getAllVertices().map(
		([k,v], index) => `[\`${k}\`](#${index + 1}-${v.toLowerCase().replace(/\s/g, '-')}-vertex)`
	).join('\n1. ')}

</details>

<details open>

<summary>Edge Types</summary>

The following edges types exist, internally we use bitmasks to represent multiple types in a compact form:

1. ${getAllEdges().map(
		([k, v], index) => `[\`${k}\` (${v})](#${index + 1}-${k.toLowerCase().replace(/\s/g, '-')}-edge)`
	).join('\n1. ')}

</details>


From an implementation perspective all of these types are represented by respective interfaces, see ${getFilePathMd('../dataflow/graph/vertex.ts')} and ${getFilePathMd('../dataflow/graph/edge.ts')}.

The following sections present details on the different types of vertices and edges, including examples and explanations.

## Vertices

${await getVertexExplanations(shell)}

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
