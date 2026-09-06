import type { NormalizedAst, RNodeWithParent } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import {
	type CfgBasicBlockVertex,
	CfgEdge,
	CfgVertex,
	type ControlFlowInformation,
	type ReadOnlyControlFlowGraph
} from '../../control-flow/control-flow-graph';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { reconstructToCode } from '../../reconstruct/reconstruct';
import { doNotAutoSelect } from '../../reconstruct/auto-select/auto-select-defaults';
import type { MermaidMarkStyle, MermaidGraphPrinterInfo, MermaidMarkdownMark } from './info';
import { MermaidDefaultMarkStyle } from './info';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { Mermaid } from './mermaid';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RoleInParent } from '../../r-bridge/lang-4.x/ast/model/processing/role';
import { RTrue } from '../../r-bridge/lang-4.x/convert-values';


export interface MermaidCfgGraphPrinterInfo extends MermaidGraphPrinterInfo {
	/** The style to apply to mark an entry point marker node */
	entryPointStyle?:          MermaidMarkStyle['vertex'];
	/** The stly eto apply to mark an exit point marker node */
	exitPointStyle?:           MermaidMarkStyle['vertex'];
	/** If true, a simplified basic block will have "Basic Block (id)" prepended */
	includeBasicBlockLabel?:   boolean;
	/** If this threshold is reached (lexemes of a simplified basic block), the remaning character will be replaced by ... */
	basicBlockCharacterLimit?: number;
}

export const MermaidEntryPointDefaultMarkStyle: MermaidMarkStyle['vertex'] = 'stroke:cyan,stroke-width:6.5px;';
export const MermaidExitPointDefaultMarkStyle: MermaidMarkStyle['vertex'] = 'stroke:green,stroke-width:6.5px;';

function getLexeme(n?: RNodeWithParent) {
	return n ? RNode.lexeme(n) ?? '' : undefined;
}


function cfgOfNode(vert: CfgVertex, normalizedVertex: RNodeWithParent | undefined, id: NodeId, content: string | undefined, output: string): string {
	if(normalizedVertex && content !== undefined) {
		const start = CfgVertex.isExpression(vert) ? '([' : '[';
		const end = CfgVertex.isExpression(vert) ? '])' : ']';
		/* the code is set in bold so it stands out from the type and id above it */
		const code = content ? `\n**${Mermaid.escape(content.replaceAll(/\s+/gu, ' '))}**` : '';
		const calls = CfgVertex.getCallTargets(vert) ? '\n calls:' + Mermaid.escape(JSON.stringify([...CfgVertex.getCallTargets(vert) as Set<NodeId>])) : '';
		const name = `"\`${Mermaid.escape(normalizedVertex.type)} (${id})${code}${calls}\`"`;
		output += `    n${id}${start}${name}${end}\n`;
	} else {
		output += `    n${id}[[${id}]]\n`;
	}
	return output;
}

const getDirRegex = /flowchart\s+([A-Za-z]+)/;

/**
 * The vertices that make up each function body, keyed by the definition that holds it.
 * Nothing flows into such a region, so it is reachable only from the entry the definition points at.
 */
function collectBodies(graph: ReadOnlyControlFlowGraph): Map<NodeId, NodeId[]> {
	const bodies = new Map<NodeId, NodeId[]>();
	for(const [id] of graph.vertices(false)) {
		const children = graph.childrenOf(id);
		if(children === undefined || children.length === 0) {
			continue;
		}
		const body = new Set<NodeId>();
		const stack = [...children];
		while(stack.length > 0) {
			const current = stack.pop() as NodeId;
			if(body.has(current)) {
				continue;
			}
			body.add(current);
			for(const next of graph.successors(current)) {
				stack.push(next);
			}
		}
		bodies.set(id, [...body]);
	}
	return bodies;
}

/**
 * The region a vertex belongs to: the function definition it is part of and whether it sits in its parameter list.
 * A definition itself belongs to the region it is written in, not to the one it opens.
 */
function regionOf(id: NodeId, normalizedAst: NormalizedAst): string {
	let current = normalizedAst.idMap.get(id);
	current = current?.info.parent === undefined ? undefined : normalizedAst.idMap.get(current.info.parent);
	let inParameters = false;
	while(current !== undefined) {
		inParameters ||= current.info.role === RoleInParent.FunctionDefinitionParameter;
		if(RFunctionDefinition.is(current)) {
			return `${current.info.id}-${inParameters ? 'parameters' : 'body'}`;
		}
		current = current.info.parent === undefined ? undefined : normalizedAst.idMap.get(current.info.parent);
	}
	return 'top-level';
}

/**
 * The code a simplified basic block stands for.
 * Its elements are reconstructed per region, so the parameters of a function do not end up looking like its body,
 * and a run that reconstructs to nothing but braces is named by its vertices instead.
 */
function blockCode(elems: readonly Exclude<CfgVertex, CfgBasicBlockVertex>[], normalizedAst: NormalizedAst): string {
	const runs: Exclude<CfgVertex, CfgBasicBlockVertex>[][] = [];
	let lastRegion: string | undefined = undefined;
	for(const elem of elems) {
		const region = regionOf(CfgVertex.getId(elem), normalizedAst);
		if(region !== lastRegion) {
			runs.push([]);
			lastRegion = region;
		}
		runs[runs.length - 1].push(elem);
	}
	return runs.map(run => {
		const code = reconstructToCode(normalizedAst, { nodes: new Set(run.map(CfgVertex.getId)) }, doNotAutoSelect).code;
		if(/[\p{L}\p{N}]/u.test(code)) {
			return code;
		}
		/* nothing but braces means these vertices are where a structure is over, so we name them as the graph does */
		return run.map(elem => `${normalizedAst.idMap.get(CfgVertex.getId(elem))?.type} (${CfgVertex.getId(elem)})`).join('\n');
	}).join('\n');
}

/**
 * Name the condition a branch is decided by, which is where the branch starts from.
 * Within a basic block that is its last element, so an edge still tells what triggers it.
 */
function conditionName(cfg: ControlFlowInformation, normalizedAst: NormalizedAst, from: NodeId): string {
	const vertex = cfg.graph.getVertex(from);
	const condition = CfgVertex.isBlock(vertex) ? CfgVertex.getId(CfgVertex.getBasicBlockElements(vertex).at(-1)) ?? from : from;
	const lexeme = getLexeme(normalizedAst.idMap.get(condition));
	return lexeme ? `${lexeme} (${condition})` : String(condition);
}


function shouldIncludeNode(simplify: boolean, v: CfgVertex, include: ReadonlySet<MermaidMarkdownMark>): boolean {
	if(simplify) {
		// Only basic blocks are shown, so include the BB, if at least one child is selected
		return CfgVertex.isBlock(v) && CfgVertex.getBasicBlockElements(v)
			.some(elem => include.has(CfgVertex.getId(elem)));

	} else {
		// Basic blocks and vertices are shown, include the BB, if all children are highlighted
		return CfgVertex.isBlock(v)
			? CfgVertex.getBasicBlockElements(v).every(elem => include.has(CfgVertex.getId(elem)))
			: include.has(CfgVertex.getId(v));
	}
}

/**
 * Convert the control flow graph to a mermaid string.
 * @see {@link MermaidCfgGraphPrinterInfo} for additional options.
 */
export function cfgToMermaid(cfg: ControlFlowInformation, normalizedAst: NormalizedAst, { prefix = 'flowchart TD\n', simplify = false, markStyle = MermaidDefaultMarkStyle, entryPointStyle = MermaidEntryPointDefaultMarkStyle, exitPointStyle = MermaidExitPointDefaultMarkStyle, includeOnlyIds, mark, includeBasicBlockLabel = true, basicBlockCharacterLimit = 100 }: MermaidCfgGraphPrinterInfo = {}): string {
	const hasBbandSimplify = simplify && cfg.graph.mayHaveBasicBlocks();
	let output = prefix;
	if(includeOnlyIds) {
		const completed = new Set(includeOnlyIds);
		// foreach nast id we add all children
		for(const id of includeOnlyIds.values()) {
			const nastNode = normalizedAst.idMap.get(id);
			if(!nastNode) {
				continue;
			}
			for(const childId of RNode.collectAllIds(nastNode)) {
				completed.add(childId);
			}
		}
		includeOnlyIds = completed;
	}

	const dirIs: string = getDirRegex.exec(prefix)?.at(1) ?? 'LR';
	const diagramIncludedIds = new Set<NodeId>();
	/* a function body runs when the function is called, so it is drawn as a region of its own instead of floating free */
	const bodies = cfg.graph.mayHaveBasicBlocks() ? new Map<NodeId, NodeId[]>() : collectBodies(cfg.graph);
	const partOfBody = new Set<NodeId>(bodies.values().flatMap(body => body));

	const emitBody = (defId: NodeId): void => {
		const body = bodies.get(defId)?.filter(v => !includeOnlyIds || includeOnlyIds.has(v));
		if(body === undefined || body.length === 0) {
			return;
		}
		const definition = normalizedAst.idMap.get(defId);
		output += `    subgraph n${defId}-body ["body of ${Mermaid.escape(limitTo(getLexeme(definition) ?? String(defId), 40))}"]\n`;
		output += `        direction ${dirIs}\n`;
		for(const vertexId of body) {
			const vertex = cfg.graph.getVertex(vertexId);
			if(vertex === undefined || CfgVertex.isBlock(vertex)) {
				continue;
			}
			const node = normalizedAst.idMap.get(vertexId);
			output = cfgOfNode(vertex, node, vertexId, getLexeme(node), output);
			diagramIncludedIds.add(vertexId);
			emitBody(vertexId);
		}
		output += '    end\n';
	};

	for(const [id, vertex] of cfg.graph.vertices(false)) {
		const normalizedVertex = normalizedAst?.idMap.get(id);
		const content = getLexeme(normalizedVertex);
		if(CfgVertex.isBlock(vertex)) {
			const elems = CfgVertex.getBasicBlockElements(vertex);
			if(simplify) {
				if(includeOnlyIds && !elems.some(elem => includeOnlyIds.has(CfgVertex.getId(elem)))) {
					continue;
				}

				const code = limitTo(blockCode(elems, normalizedAst), basicBlockCharacterLimit);
				const name = `"\`${includeBasicBlockLabel ? `Basic Block (${id})\n` : ''}${Mermaid.escape(code)}\`"`;
				output += `    n${id}[[${name}]]\n`;
				diagramIncludedIds.add(CfgVertex.getId(vertex));
			} else {
				if(includeOnlyIds && !elems.some(elem => includeOnlyIds.has(CfgVertex.getId(elem)))) {
					continue;
				}

				output += `    subgraph n${id} [Block ${normalizedVertex?.info.fullLexeme ?? id}]\n`;
				output += `        direction ${dirIs}\n`;
				diagramIncludedIds.add(id);
				let last: NodeId | undefined = undefined;
				for(const element of elems ?? []) {
					if(includeOnlyIds && !includeOnlyIds.has(CfgVertex.getId(element))) {
						last = undefined;
						continue;
					}

					const eid = CfgVertex.getId(element);
					const childNormalizedVertex = normalizedAst?.idMap.get(eid);
					const childContent = getLexeme(childNormalizedVertex);
					output = cfgOfNode(element, childNormalizedVertex, eid, childContent, output);
					diagramIncludedIds.add(eid);
					/* everything in a block runs one after the other, which is what these arrows show */
					if(last) {
						output += `    ${last} --> n${eid}\n`;
					}
					last = `n${eid}`;
				}
				output += '    end\n';
			}
		} else if((!includeOnlyIds || includeOnlyIds.has(id)) && !partOfBody.has(id)) {
			output = cfgOfNode(vertex, normalizedVertex, id, content, output);
			diagramIncludedIds.add(id);
			emitBody(id);
		}
	}
	for(const [from, targets] of cfg.graph.edges()) {
		if(!diagramIncludedIds.has(from)) {
			continue;
		}
		for(const [to, edge] of targets) {
			if(!diagramIncludedIds.has(to)) {
				continue;
			}

			/* a branch is drawn dashed, so what always runs stands out from what only runs under a condition */
			const isBranch = CfgEdge.isControlDependency(edge);
			const arrow = isBranch ? '-.->' : '-->';
			const label = isBranch ? `branch on ${conditionName(cfg, normalizedAst, from)} if ${CfgEdge.unpackWhen(edge) === RTrue ? 'T' : 'F'}` : CfgEdge.typeToString(edge);
			output += `    n${from} ${arrow}|"${Mermaid.escape(label)}"| n${to}\n`;
		}
	}

	for(const [defId] of bodies) {
		const entry = cfg.graph.childrenOf(defId)?.[0];
		/* no arrow head: the definition does not run its body, it only holds it */
		if(entry !== undefined && diagramIncludedIds.has(defId) && diagramIncludedIds.has(entry)) {
			output += `    n${defId} -. holds .- n${entry}\n`;
		}
	}

	for(const entryPoint of cfg.entryPoints) {
		if(diagramIncludedIds.has(entryPoint)) {
			output += `    style n${entryPoint} ${entryPointStyle}`;
		}
	}
	for(const exitPoint of cfg.exitPoints) {
		if(diagramIncludedIds.has(exitPoint)) {
			output += `    style n${exitPoint} ${exitPointStyle}`;
		}
	}
	if(mark) {
		for(const [id, vertex] of cfg.graph.vertices(true)) {
			if(shouldIncludeNode(hasBbandSimplify, vertex, mark)) {
				output += `    style n${id} ${markStyle.vertex}`;
			}
		}
	}
	return output;
}

/**
 * Use mermaid to visualize the normalized AST.
 */
export function cfgToMermaidUrl(cfg: ControlFlowInformation, normalizedAst: NormalizedAst, info?: MermaidCfgGraphPrinterInfo): string {
	return Mermaid.codeToUrl(cfgToMermaid(cfg, normalizedAst, info ?? {}));
}

/**
 * Limits a string to n chars, after which the remainder will be replaced with ...
 */
function limitTo(str: string, limit: number): string {
	if(str.length <= limit) {
		return str;
	}

	return `${str.slice(0, Math.max(0, limit))}...`;
}