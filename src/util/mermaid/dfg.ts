import type { SourceRange } from '../range';


import { escapeId, escapeMarkdown, mermaidCodeToUrl } from './mermaid';
import type { DataflowFunctionFlowInformation, DataflowGraph, FunctionArgument } from '../../dataflow/graph/graph';
import { isNamedArgument, isPositionalArgument } from '../../dataflow/graph/graph';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { normalizeIdToNumberIfPossible } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { IdentifierDefinition, IdentifierReference } from '../../dataflow/environments/identifier';
import { ReferenceTypeReverseMapping } from '../../dataflow/environments/identifier';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { EdgeType } from '../../dataflow/graph/edge';
import { edgeTypeToName, splitEdgeTypes } from '../../dataflow/graph/edge';
import type { DataflowGraphVertexInfo } from '../../dataflow/graph/vertex';
import { VertexType } from '../../dataflow/graph/vertex';
import type { IEnvironment } from '../../dataflow/environments/environment';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { isBuiltIn } from '../../dataflow/environments/built-in';


type MarkVertex = NodeId
type MarkEdge = `${string}->${string}`

export type MermaidMarkdownMark = MarkVertex | MarkEdge

export interface MermaidMarkStyle {
	readonly vertex: string
	readonly edge:   string
}

interface MermaidGraph {
	nodeLines:           string[]
	edgeLines:           string[]
	includeEnvironments: boolean
	mark:                ReadonlySet<MermaidMarkdownMark> | undefined
	markStyle:           MermaidMarkStyle
	/** in the form of from-\>to because I am lazy, see {@link encodeEdge} */
	presentEdges:        Set<string>
	presentVertices:     Set<string>
	// keep for sub-flows
	rootGraph:           DataflowGraph
	/** if given, the dataflow graph will only focus on the "important" parts */
	simplified?:         boolean
}

/**
 * Prints a {@link SourceRange|range} as a human-readable string.
 */
export function formatRange(range: SourceRange | undefined): string {
	if(range === undefined) {
		return '??-??';
	} else if(range[0] === range[2]) {
		if(range[1] === range[3]) {
			return `${range[0]}.${range[1]}`;
		} else {
			return `${range[0]}.${range[1]}-${range[3]}`;
		}
	}
	return `${range[0]}.${range[1]}-${range[2]}.${range[3]}`;
}

function subflowToMermaid(nodeId: NodeId, exitPoints: readonly NodeId[], subflow: DataflowFunctionFlowInformation | undefined, mermaid: MermaidGraph, idPrefix = ''): void {
	if(subflow === undefined) {
		return;
	}
	const subflowId = escapeId(`${idPrefix}flow-${nodeId}`);
	if(mermaid.simplified) {
		// get parent
		const idMap = mermaid.rootGraph.idMap;
		const node = idMap?.get(nodeId);
		const nodeLexeme = node?.info.fullLexeme ?? node?.lexeme ?? 'function';
		const location = node?.location?.[0] ? ` (L. ${node?.location?.[0]})` : '';
		mermaid.nodeLines.push(`\nsubgraph "${subflowId}" ["${escapeMarkdown(nodeLexeme)}${location}"]`);
	} else {
		mermaid.nodeLines.push(`\nsubgraph "${subflowId}" [function ${nodeId}]`);
	}
	const subgraph = graphToMermaidGraph(subflow.graph, {
		graph:               mermaid.rootGraph,
		rootGraph:           mermaid.rootGraph,
		idPrefix,
		includeEnvironments: mermaid.includeEnvironments,
		mark:                mermaid.mark,
		prefix:              null,
		simplified:          mermaid.simplified
	});
	mermaid.nodeLines.push(...subgraph.nodeLines);
	mermaid.edgeLines.push(...subgraph.edgeLines);
	for(const present of subgraph.presentEdges) {
		mermaid.presentEdges.add(present);
	}
	for(const [color, pool] of [['purple', subflow.in], ['green', subflow.out], ['orange', subflow.unknownReferences]]) {
		for(const out of pool as IdentifierReference[]) {
			if(!mermaid.mark?.has(out.nodeId)) {
				// in/out/active for unmarked
				mermaid.nodeLines.push(`    style ${idPrefix}${out.nodeId} stroke:${color as string},stroke-width:4px; `);
			}
		}
	}

	mermaid.nodeLines.push('end');
	mermaid.edgeLines.push(`${idPrefix}${nodeId} -.-|function| ${subflowId}\n`);
	/* mark edge as present */
	const edgeId = encodeEdge(idPrefix + nodeId, subflowId, new Set(['function']));
	mermaid.presentEdges.add(edgeId);
}


function printArg(arg: FunctionArgument | undefined): string {
	if(arg === undefined) {
		return '??';
	} else if(arg === EmptyArgument) {
		return '[empty]';
	} else if(isNamedArgument(arg)) {
		const deps = arg.controlDependencies ? ', :may:' + arg.controlDependencies.map(c => c.id + (c.when ? '+' : '-')).join(',') : '';
		return `${arg.name} (${arg.nodeId}${deps})`;
	} else if(isPositionalArgument(arg)) {
		const deps = arg.controlDependencies ? ' (:may:' + arg.controlDependencies.map(c => c.id + (c.when ? '+' : '-')).join(',') + ')': '';
		return `${arg.nodeId}${deps}`;
	} else {
		return '??';
	}
}
function displayFunctionArgMapping(argMapping: readonly FunctionArgument[]): string {
	const result = [];
	for(const arg of argMapping) {
		result.push(printArg(arg));
	}
	return result.length === 0 ? '' : `\n    (${result.join(', ')})`;
}
function encodeEdge(from: string, to: string, types: Set<EdgeType | 'CD-True' | 'CD-False' | 'function'>): string {
	return `${from}->${to}["${[...types].join(':')}"]`;
}


function mermaidNodeBrackets(tag: DataflowGraphVertexInfo['tag']): { open: string, close: string } {
	let open: string;
	let close: string;
	if(tag === 'function-definition' || tag === 'variable-definition') {
		open = '[';
		close = ']';
	} else if(tag === VertexType.FunctionCall) {
		open = '[[';
		close = ']]';
	} else if(tag === 'value') {
		open = '{{';
		close = '}}';
	} else {
		open = '([';
		close = '])';
	}
	return { open, close };
}

export function printIdentifier(id: IdentifierDefinition): string {
	return `**${id.name}** (id: ${id.nodeId}, type: ${ReferenceTypeReverseMapping.get(id.type)},${id.controlDependencies? ' cds: {' + id.controlDependencies.map(c => c.id + (c.when ? '+' : '-')).join(',') + '},' : ''} def. @${id.definedAt})`;
}

function printEnvironmentToLines(env: IEnvironment | undefined): string[] {
	if(env === undefined) {
		return ['??'];
	} else if(env.builtInEnv) {
		return ['Built-in'];
	}
	const lines = [...printEnvironmentToLines(env.parent), `${env.id}${'-'.repeat(40)}`];
	const longestName = Math.max(...[...env.memory.keys()].map(x => x.length));
	for(const [name, defs] of env.memory.entries()) {
		const printName = `${name}:`;
		lines.push(`  ${printName.padEnd(longestName + 1, ' ')} {${defs.map(printIdentifier).join(', ')}}`);
	}
	return lines;
}

function vertexToMermaid(info: DataflowGraphVertexInfo, mermaid: MermaidGraph, id: NodeId, idPrefix: string, mark: ReadonlySet<NodeId> | undefined): void {
	const fCall = info.tag === VertexType.FunctionCall;
	const { open, close } = mermaidNodeBrackets(info.tag);
	id = escapeId(id);

	if(info.environment && info.builtInEnvironment && mermaid.includeEnvironments) {
		if(info.environment.level > 0 || info.environment.current.memory.size !== 0) {
			mermaid.nodeLines.push(
				`    %% Environment of ${id} [level: ${info.environment.level}]:`,
				printEnvironmentToLines(info.environment.current).map(x => `    %% ${x}`).join('\n'));
		}
	}

	const node = mermaid.rootGraph.idMap?.get(info.id);
	const lexeme = node?.lexeme ?? (node?.type === RType.ExpressionList ? node?.grouping?.[0]?.lexeme : '') ?? '??';

	if(mermaid.simplified) {
		const location = node?.location?.[0] ? ` (L. ${node?.location?.[0]})` : '';
		const escapedName = '**' + escapeMarkdown(node ? `${lexeme}` : '??') + '**' + location + (node ? `\n*${node.type}*` : '');
		mermaid.nodeLines.push(`    ${idPrefix}${id}${open}"\`${escapedName}\`"${close}`);
	} else {
		const escapedName = escapeMarkdown(node ? `[${node.type}] ${lexeme}` : '??');
		const deps = info.cds ? ', :may:' + info.cds.map(c => c.id + (c.when ? '+' : '-')).join(',') : '';
		const lnks = info.link?.origin ? ', :links:' + info.link.origin.join(',') : '';
		const n = node?.info.fullRange ?? node?.location ?? (node?.type === RType.ExpressionList ? node?.grouping?.[0].location : undefined);
		mermaid.nodeLines.push(`    ${idPrefix}${id}${open}"\`${escapedName}${escapedName.length > 10 ? '\n      ' : ' '}(${id}${deps}${lnks})\n      *${formatRange(n)}*${
			fCall ? displayFunctionArgMapping(info.args) : ''
		}\`"${close}`);
	}
	if(mark?.has(id)) {
		mermaid.nodeLines.push(`    style ${idPrefix}${id} ${mermaid.markStyle.vertex} `);
	}
	if([...mermaid.rootGraph.unknownSideEffects].some(l => normalizeIdToNumberIfPossible(l as string) === normalizeIdToNumberIfPossible(id))) {
		mermaid.nodeLines.push(`    style ${idPrefix}${id} stroke:red,stroke-width:5px; `);
	}

	const edges = mermaid.rootGraph.get(normalizeIdToNumberIfPossible(id), true);
	if(edges === undefined) {
		mermaid.nodeLines.push('   %% No edges found for ' + id);
		return;
	}
	const artificialCdEdges = (info.cds ?? []).map(x => [x.id, { types: new Set<EdgeType | 'CD-True' | 'CD-False'>([x.when ? 'CD-True' : 'CD-False']) }] as const);
	// eslint-disable-next-line prefer-const
	for(let [target, edge] of [...edges[1], ...artificialCdEdges]) {
		const originalTarget = target;
		target = escapeId(target);
		const edgeTypes = typeof edge.types == 'number' ? new Set(splitEdgeTypes(edge.types)) : edge.types;
		const edgeId = encodeEdge(idPrefix + id, idPrefix + target, edgeTypes);
		if(!mermaid.presentEdges.has(edgeId)) {
			mermaid.presentEdges.add(edgeId);
			const style = isBuiltIn(target) ? '-.->' : '-->';
			mermaid.edgeLines.push(`    ${idPrefix}${id} ${style}|"${[...edgeTypes].map(e => typeof e === 'number' ? edgeTypeToName(e) : e).join(', ')}"| ${idPrefix}${target}`);
			if(mermaid.mark?.has(id + '->' + target)) {
				// who invented this syntax?!
				mermaid.edgeLines.push(`    linkStyle ${mermaid.presentEdges.size - 1} ${mermaid.markStyle.edge}`);
			}
			if(edgeTypes.has('CD-True') || edgeTypes.has('CD-False')) {
				mermaid.edgeLines.push(`    linkStyle ${mermaid.presentEdges.size - 1} stroke:gray,color:gray;`);
			}
			if(isBuiltIn(target)) {
				mermaid.edgeLines.push(`    linkStyle ${mermaid.presentEdges.size - 1} stroke:gray;`);
				if(!mermaid.presentVertices.has(target)) {
					mermaid.nodeLines.push(`    ${idPrefix}${target}["\`Built-In:\n${escapeMarkdown(String(originalTarget).replace('built-in:', ''))}\`"]`);
					mermaid.nodeLines.push(`    style ${idPrefix}${target} stroke:gray,fill:lightgray,stroke-width:2px,opacity:.8;`);
					mermaid.presentVertices.add(target);
				}
			}
		}
	}
	if(info.tag === 'function-definition') {
		subflowToMermaid(id, info.exitPoints, info.subflow, mermaid, idPrefix);
	}
}

interface MermaidGraphConfiguration {
	graph:                DataflowGraph,
	prefix?:              string | null,
	idPrefix?:            string,
	includeEnvironments?: boolean,
	mark?:                ReadonlySet<MermaidMarkdownMark>,
	markStyle?:           MermaidMarkStyle,
	rootGraph?:           DataflowGraph,
	presentEdges?:        Set<string>,
	simplified?:          boolean
}


// make the passing of root ids more performant again
function graphToMermaidGraph(
	rootIds: ReadonlySet<NodeId>,
	{ simplified, graph, prefix = 'flowchart BT', idPrefix = '', includeEnvironments = !simplified, mark, rootGraph, presentEdges = new Set<string>(), markStyle = { vertex: 'stroke:teal,stroke-width:7px,stroke-opacity:.8;', edge: 'stroke:teal,stroke-width:4.2px,stroke-opacity:.8' } }: MermaidGraphConfiguration
): MermaidGraph {
	const mermaid: MermaidGraph = { nodeLines: prefix === null ? [] : [prefix], edgeLines: [], presentEdges, presentVertices: new Set(), mark, rootGraph: rootGraph ?? graph, includeEnvironments, markStyle, simplified };

	for(const [id, info] of graph.vertices(true)) {
		if(rootIds.has(id)) {
			vertexToMermaid(info, mermaid, id, idPrefix, mark);
		}
	}

	return mermaid;
}

export function graphToMermaid(config: MermaidGraphConfiguration): { string: string, mermaid: MermaidGraph } {
	const mermaid = graphToMermaidGraph(config.graph.rootIds(), config);
	return { string: `${mermaid.nodeLines.join('\n')}\n${mermaid.edgeLines.join('\n')}`, mermaid };
}

/**
 * Converts a dataflow graph to a mermaid url that visualizes the graph.
 *
 * @param graph               - The graph to convert
 * @param includeEnvironments - Whether to include the environments in the mermaid graph code
 * @param mark                - Special nodes to mark (e.g., those included in the slice)
 * @param simplified          - Whether to simplify the graph
 */
export function graphToMermaidUrl(graph: DataflowGraph, includeEnvironments?: boolean, mark?: ReadonlySet<NodeId>, simplified = false): string {
	return mermaidCodeToUrl(graphToMermaid({ graph, includeEnvironments, mark, simplified }).string);
}

export interface LabeledDiffGraph {
	label: string
	graph: DataflowGraph
	mark?: Set<MermaidMarkdownMark>
}

/** uses same id map but ensures, it is different from the rhs so that mermaid can work with that */
export function diffGraphsToMermaid(left: LabeledDiffGraph, right: LabeledDiffGraph, prefix: string): string {
	// we add the prefix ourselves
	const { string: leftGraph, mermaid } = graphToMermaid({ graph: left.graph, prefix: '', idPrefix: `l-${left.label}`, includeEnvironments: true, mark: left.mark });
	const { string: rightGraph } = graphToMermaid({ graph: right.graph, prefix: '', idPrefix: `r-${right.label}`, includeEnvironments: true, mark: right.mark, presentEdges: mermaid.presentEdges });

	return `${prefix}flowchart BT\nsubgraph "${left.label}"\n${leftGraph}\nend\nsubgraph "${right.label}"\n${rightGraph}\nend`;
}

export function diffGraphsToMermaidUrl(left: LabeledDiffGraph, right: LabeledDiffGraph, prefix: string): string {
	return mermaidCodeToUrl(diffGraphsToMermaid(left, right, prefix));
}
