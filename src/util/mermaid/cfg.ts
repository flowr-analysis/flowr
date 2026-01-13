import { escapeMarkdown, mermaidCodeToUrl } from './mermaid';
import type { NormalizedAst, RNodeWithParent } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import {
	CfgEdgeType,
	type CfgSimpleVertex,
	CfgVertexType,
	type ControlFlowInformation,
	edgeTypeToString
} from '../../control-flow/control-flow-graph';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { reconstructToCode } from '../../reconstruct/reconstruct';
import { doNotAutoSelect } from '../../reconstruct/auto-select/auto-select-defaults';
import type { MermaidMarkStyle , MermaidGraphPrinterInfo, MermaidMarkdownMark } from './info';
import { MermaidDefaultMarkStyle } from './info';
import { collectAllIds } from '../../r-bridge/lang-4.x/ast/model/collect';


export interface MermaidCfgGraphPrinterInfo extends MermaidGraphPrinterInfo {
	entryPointStyle?: MermaidMarkStyle['vertex'];
	exitPointStyle?:  MermaidMarkStyle['vertex'];
}

export const MermaidEntryPointDefaultMarkStyle: MermaidMarkStyle['vertex'] = 'stroke:cyan,stroke-width:6.5px;';
export const MermaidExitPointDefaultMarkStyle: MermaidMarkStyle['vertex'] = 'stroke:green,stroke-width:6.5px;';

function getLexeme(n?: RNodeWithParent) {
	return n ? n.info.fullLexeme ?? n.lexeme ?? '' : undefined;
}


function cfgOfNode(vert: CfgSimpleVertex, normalizedVertex: RNodeWithParent | undefined, id: NodeId, content: string | undefined, output: string): string {
	if(normalizedVertex && content !== undefined) {
		const start = vert.type === CfgVertexType.Expression ? '([' : '[';
		const end = vert.type === CfgVertexType.Expression ? '])' : ']';
		const name = `"\`${escapeMarkdown(normalizedVertex.type)} (${id})${content ? '\n' + escapeMarkdown(JSON.stringify(content)) : ''}${vert.callTargets ? '\n calls:' + escapeMarkdown(JSON.stringify([...vert.callTargets])) : ''}\`"`;
		output += `    n${id}${start}${name}${end}\n`;
	} else {
		output += String(id).endsWith('-exit') ? `    n${id}((${id}))\n` : `    n${id}[[${id}]]\n`;
	}
	return output;
}

const getDirRegex = /flowchart\s+([A-Za-z]+)/;


function shouldHighlight(simplify: boolean, element: CfgSimpleVertex, include: ReadonlySet<MermaidMarkdownMark>): boolean {
	if(simplify) {
		// Only basic blocks are shown, so include the BB, if at least one child is selected
		return element.type == CfgVertexType.Block && element.elems.filter(elem => elem.type !== CfgVertexType.EndMarker).some(elem => include.has(elem.id));

	} else {
		// Basic blocks and vertices are shown, include the BB, if all children are highlighted
		return element.type == CfgVertexType.Block
			? element.elems.filter(elem => elem.type !== CfgVertexType.EndMarker).every(elem => include.has(elem.id))
			: include.has(element.id);
	}
}

/**
 * Convert the control flow graph to a mermaid string.
 * @param cfg              - The control flow graph to convert.
 * @param normalizedAst    - The normalized AST to use for the vertex content.
 * @param prefix           - The prefix to use for the mermaid string.
 * @param simplify         - Whether to simplify the control flow graph (especially in the context of basic blocks).
 * @param markStyle        - The style to use for marked vertices and edges.
 * @param includeOnlyIds   - If provided, only include the vertices with the given IDs.
 * @param mark             - If provided, mark the given vertices and edges.
 */
export function cfgToMermaid(cfg: ControlFlowInformation, normalizedAst: NormalizedAst, { prefix = 'flowchart BT\n', simplify = false, markStyle = MermaidDefaultMarkStyle, entryPointStyle = MermaidEntryPointDefaultMarkStyle, exitPointStyle = MermaidExitPointDefaultMarkStyle, includeOnlyIds, mark }: MermaidCfgGraphPrinterInfo = {}): string {
	let output = prefix;
	if(includeOnlyIds) {
		const completed = new Set(includeOnlyIds);
		// foreach nast id we add all children
		for(const id of includeOnlyIds.values()) {
			const nastNode = normalizedAst.idMap.get(id);
			if(!nastNode) {
				continue;
			}
			const ids = collectAllIds(nastNode);
			for(const childId of ids) {
				completed.add(childId);
			}
		}
		// if we have a filter, we automatically add all vertices in the cfg that are *markers* for these ids and
		for(const [id,v] of cfg.graph.vertices()) {
			if(v.type === CfgVertexType.EndMarker && completed.has(v.root)) {
				completed.add(id);
			}
		}
		includeOnlyIds = completed;
	}

	const dirIs: string = getDirRegex.exec(prefix)?.at(1) ?? 'LR';

	for(const [id, vertex] of cfg.graph.vertices(false)) {
		const normalizedVertex = normalizedAst?.idMap.get(id);
		const content = getLexeme(normalizedVertex);
		if(vertex.name === RType.ExpressionList && vertex.type === CfgVertexType.Expression && cfg.graph.hasVertex(id + '-exit')) {
			output += `    subgraph ${RType.ExpressionList} ${normalizedVertex?.info.fullLexeme ?? id}\n`;
			output += `        direction ${dirIs}\n`;
		}
		if(vertex.type === CfgVertexType.Block) {
			if(simplify) {
				const ids = vertex.elems?.map(e => e.id) ?? [];
				const reconstruct = reconstructToCode(normalizedAst, { nodes: new Set(ids) }, doNotAutoSelect).code;
				const name = `"\`(${id})\n${escapeMarkdown(reconstruct)}\`"`;
				output += `    n${id}[[${name}]]\n`;
			} else {
				output += `    subgraph n${vertex.id} [Block ${normalizedVertex?.info.fullLexeme ?? id}]\n`;
				output += `        direction ${dirIs}\n`;
				let last: NodeId | undefined = undefined;
				for(const element of vertex.elems ?? []) {
					if(includeOnlyIds && !includeOnlyIds.has(element.id)) {
						last = undefined;
						continue;
					}

					const childNormalizedVertex = normalizedAst?.idMap.get(element.id);
					const childContent = getLexeme(childNormalizedVertex);
					output = cfgOfNode(vertex, childNormalizedVertex, element.id, childContent, output);
					// just to keep the order
					if(last) {
						output += `    ${last} -.-> n${element.id}\n`;
					}
					last = `n${element.id}`;
				}
				output += '    end\n';
			}
		} else if(!includeOnlyIds || includeOnlyIds.has(id)) {
			output = cfgOfNode(vertex, normalizedVertex, id, content, output);
		}
		if(vertex.name === RType.ExpressionList && vertex.type === CfgVertexType.EndMarker) {
			output += '    end\n';
		}
	}
	for(const [from, targets] of cfg.graph.edges()) {
		if(includeOnlyIds && !includeOnlyIds.has(from)) {
			continue;
		}
		for(const [to, edge] of targets) {
			if(includeOnlyIds && !includeOnlyIds.has(to)) {
				continue;
			}

			const edgeType = edge.label === CfgEdgeType.Cd ? '-->' : '-.->';
			const edgeSuffix = edge.label === CfgEdgeType.Cd ? ` (${edge.when})` : '';
			output += `    n${from} ${edgeType}|"${escapeMarkdown(edgeTypeToString(edge.label))}${edgeSuffix}"| n${to}\n`;
		}
	}

	for(const entryPoint of cfg.entryPoints) {
		if(!includeOnlyIds || includeOnlyIds.has(entryPoint)) {
			output += `    style n${entryPoint} ${entryPointStyle}`;
		}
	}
	for(const exitPoint of cfg.exitPoints) {
		if(!includeOnlyIds || includeOnlyIds.has(exitPoint)) {
			output += `    style n${exitPoint} ${exitPointStyle}`;
		}
	}
	if(mark) {
		for(const [_, vertex] of cfg.graph.vertices(true)) {
			if(shouldHighlight(simplify && cfg.graph.mayHaveBasicBlocks(), vertex, mark)) {
				output += `    style n${vertex.id} ${markStyle.vertex}`;
			}
		}
	}
	return output;
}

/**
 * Use mermaid to visualize the normalized AST.
 */
export function cfgToMermaidUrl(cfg: ControlFlowInformation, normalizedAst: NormalizedAst, info?: MermaidGraphPrinterInfo): string {
	return mermaidCodeToUrl(cfgToMermaid(cfg, normalizedAst, info ?? {}));
}
