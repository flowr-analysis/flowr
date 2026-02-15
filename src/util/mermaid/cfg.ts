import { escapeMarkdown, mermaidCodeToUrl } from './mermaid';
import type { NormalizedAst, RNodeWithParent } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import {
	CfgEdge,
	CfgVertex,
	type ControlFlowInformation
} from '../../control-flow/control-flow-graph';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { reconstructToCode } from '../../reconstruct/reconstruct';
import { doNotAutoSelect } from '../../reconstruct/auto-select/auto-select-defaults';
import type { MermaidMarkStyle, MermaidGraphPrinterInfo, MermaidMarkdownMark } from './info';
import { MermaidDefaultMarkStyle } from './info';
import { collectAllIds } from '../../r-bridge/lang-4.x/ast/model/collect';


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
	return n ? n.info.fullLexeme ?? n.lexeme ?? '' : undefined;
}


function cfgOfNode(vert: CfgVertex, normalizedVertex: RNodeWithParent | undefined, id: NodeId, content: string | undefined, output: string): string {
	if(normalizedVertex && content !== undefined) {
		const start = CfgVertex.isExpression(vert) ? '([' : '[';
		const end = CfgVertex.isExpression(vert) ? '])' : ']';
		const name = `"\`${escapeMarkdown(normalizedVertex.type)} (${id})${content ? '\n' + escapeMarkdown(JSON.stringify(content)) : ''}${CfgVertex.getCallTargets(vert) ? '\n calls:' + escapeMarkdown(JSON.stringify([...CfgVertex.getCallTargets(vert) as Set<NodeId>])) : ''}\`"`;
		output += `    n${id}${start}${name}${end}\n`;
	} else {
		output += String(id).endsWith('-exit') ? `    n${id}((${id}))\n` : `    n${id}[[${id}]]\n`;
	}
	return output;
}

const getDirRegex = /flowchart\s+([A-Za-z]+)/;


function shouldIncludeNode(simplify: boolean, v: CfgVertex, include: ReadonlySet<MermaidMarkdownMark>): boolean {
	if(simplify) {
		// Only basic blocks are shown, so include the BB, if at least one child is selected
		return CfgVertex.isBlock(v) && CfgVertex.getBasicBlockElements(v)
			.filter(elem => !CfgVertex.isMarker(elem))
			.some(elem => include.has(CfgVertex.getId(elem)));

	} else {
		// Basic blocks and vertices are shown, include the BB, if all children are highlighted
		return CfgVertex.isBlock(v)
			? CfgVertex.getBasicBlockElements(v)
				.filter(elem => !CfgVertex.isMarker(elem))
				.every(elem => include.has(CfgVertex.getId(elem)))
			: include.has(CfgVertex.getId(v));
	}
}

/**
 * Convert the control flow graph to a mermaid string.
 * @see {@link MermaidCfgGraphPrinterInfo} for additional options.
 */
export function cfgToMermaid(cfg: ControlFlowInformation, normalizedAst: NormalizedAst, { prefix = 'flowchart BT\n', simplify = false, markStyle = MermaidDefaultMarkStyle, entryPointStyle = MermaidEntryPointDefaultMarkStyle, exitPointStyle = MermaidExitPointDefaultMarkStyle, includeOnlyIds, mark, includeBasicBlockLabel = true, basicBlockCharacterLimit = 100 }: MermaidCfgGraphPrinterInfo = {}): string {
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
			const ids = collectAllIds(nastNode);
			for(const childId of ids) {
				completed.add(childId);
			}
		}
		// if we have a filter, we automatically add all vertices in the cfg that are *markers* for these ids and
		for(const [id, v] of cfg.graph.vertices()) {
			if(CfgVertex.isMarker(v) && completed.has(CfgVertex.unpackRootId(v))) {
				completed.add(id);
			}
		}
		includeOnlyIds = completed;
	}

	const dirIs: string = getDirRegex.exec(prefix)?.at(1) ?? 'LR';
	const diagramIncludedIds = new Set<NodeId>();

	for(const [id, vertex] of cfg.graph.vertices(false)) {
		const normalizedVertex = normalizedAst?.idMap.get(id);
		const content = getLexeme(normalizedVertex);
		if(CfgVertex.isBlock(vertex)) {
			const elems = CfgVertex.getBasicBlockElements(vertex);
			if(simplify) {
				if(includeOnlyIds && !elems.some(elem => includeOnlyIds.has(CfgVertex.getId(elem)))) {
					continue;
				}

				const ids = elems?.map(CfgVertex.getId) ?? [];
				const reconstruct = limitTo(reconstructToCode(normalizedAst, { nodes: new Set(ids) }, doNotAutoSelect).code, basicBlockCharacterLimit);
				const name = `"\`${includeBasicBlockLabel ? `Basic Block (${id})\n` : ''}${escapeMarkdown(reconstruct)}\`"`;
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
					output = cfgOfNode(vertex, childNormalizedVertex, eid, childContent, output);
					diagramIncludedIds.add(eid);
					// just to keep the order
					if(last) {
						output += `    ${last} -.-> n${eid}\n`;
					}
					last = `n${eid}`;
				}
				output += '    end\n';
			}
		} else if(!includeOnlyIds || includeOnlyIds.has(id)) {
			output = cfgOfNode(vertex, normalizedVertex, id, content, output);
			diagramIncludedIds.add(id);
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

			const isCd = CfgEdge.isControlDependency(edge);
			const edgeType = isCd ? '-->' : '-.->';
			const edgeSuffix = isCd ? ` (${CfgEdge.unpackWhen(edge)})` : '';
			output += `    n${from} ${edgeType}|"${escapeMarkdown(CfgEdge.typeToString(edge))}${edgeSuffix}"| n${to}\n`;
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
	return mermaidCodeToUrl(cfgToMermaid(cfg, normalizedAst, info ?? {}));
}

/**
 * Limits a string to n chars, after which the remainder will be replaced with ...
 */
function limitTo(str: string, limit: number): string {
	if(str.length <= limit) {
		return str;
	}

	return `${str.substring(0, limit)}...`;
}