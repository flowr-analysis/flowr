import { escapeMarkdown, mermaidCodeToUrl } from './mermaid';
import type { NormalizedAst, RNodeWithParent } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import type {
	CfgSimpleVertex,
	ControlFlowInformation
} from '../../control-flow/control-flow-graph';
import {
	CfgEdgeType,
	CfgVertexType,
	edgeTypeToString
} from '../../control-flow/control-flow-graph';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { reconstructToCode } from '../../reconstruct/reconstruct';
import { doNotAutoSelect } from '../../reconstruct/auto-select/auto-select-defaults';

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


/**
 * Convert the control flow graph to a mermaid string.
 * @param cfg              - The control flow graph to convert.
 * @param normalizedAst    - The normalized AST to use for the vertex content.
 * @param prefix           - The prefix to use for the mermaid string.
 * @param simplify         - Whether to simplify the control flow graph (especially in the context of basic blocks).
 */
export function cfgToMermaid(cfg: ControlFlowInformation, normalizedAst: NormalizedAst, prefix = 'flowchart BT\n', simplify: boolean = false): string {
	let output = prefix;

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
				const reconstruct = reconstructToCode(normalizedAst, new Set(ids), doNotAutoSelect).code;
				const name = `"\`Basic Block (${id})\n${escapeMarkdown(reconstruct)}\`"`;
				output += `    n${id}[[${name}]]\n`;
			} else {
				output += `    subgraph n${vertex.id} [Block ${normalizedVertex?.info.fullLexeme ?? id}]\n`;
				output += `        direction ${dirIs}\n`;
				let last: NodeId | undefined = undefined;
				for(const element of vertex.elems ?? []) {
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
		} else {
			output = cfgOfNode(vertex, normalizedVertex, id, content, output);
		}
		if(vertex.name === RType.ExpressionList && vertex.type === CfgVertexType.EndMarker) {
			output += '    end\n';
		}
	}
	for(const [from, targets] of cfg.graph.edges()) {
		for(const [to, edge] of targets) {
			const edgeType = edge.label === CfgEdgeType.Cd ? '-->' : '-.->';
			const edgeSuffix = edge.label === CfgEdgeType.Cd ? ` (${edge.when})` : '';
			output += `    n${from} ${edgeType}|"${escapeMarkdown(edgeTypeToString(edge.label))}${edgeSuffix}"| n${to}\n`;
		}
	}

	for(const entryPoint of cfg.entryPoints) {
		output += `    style n${entryPoint} stroke:cyan,stroke-width:6.5px;`;
	}
	for(const exitPoint of cfg.exitPoints) {
		output += `    style n${exitPoint} stroke:green,stroke-width:6.5px;`;
	}
	return output;
}

/**
 * Use mermaid to visualize the normalized AST.
 */
export function cfgToMermaidUrl(cfg: ControlFlowInformation, normalizedAst: NormalizedAst, prefix = 'flowchart BT\n'): string {
	return mermaidCodeToUrl(cfgToMermaid(cfg, normalizedAst, prefix));
}
