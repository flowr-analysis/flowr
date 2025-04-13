import { escapeMarkdown, mermaidCodeToUrl } from './mermaid';
import type { NormalizedAst, RNodeWithParent } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import type {
	ControlFlowInformation } from '../../control-flow/control-flow-graph';
import {
	CfgEdgeType,
	CfgVertexType,
	edgeTypeToString
} from '../../control-flow/control-flow-graph';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';

function getLexeme(n?: RNodeWithParent) {
	return n ? n.info.fullLexeme ?? n.lexeme ?? '' : undefined;
}


function cfgOfNode(normalizedVertex: RNodeWithParent | undefined, id: NodeId, content: string | undefined, output: string): string {
	if(normalizedVertex && content !== undefined) {
		const name = `"\`${escapeMarkdown(normalizedVertex.type)} (${id})${content ? '\n' + escapeMarkdown(JSON.stringify(content)) : ''}\`"`;
		output += `    n${id}[${name}]\n`;
	} else {
		output += String(id).endsWith('-exit') ? `    n${id}((${id}))\n` : `    n${id}[[${id}]]\n`;
	}
	return output;
}

export function cfgToMermaid(cfg: ControlFlowInformation, normalizedAst: NormalizedAst, prefix = 'flowchart BT\n'): string {
	let output = prefix;

	const dirIsBT = prefix.includes(' BT\n');

	for(const [id, vertex] of cfg.graph.vertices(false)) {
		const normalizedVertex = normalizedAst.idMap.get(id);
		const content = getLexeme(normalizedVertex);
		if(vertex.name === RType.ExpressionList && vertex.type === CfgVertexType.Expression && cfg.graph.hasVertex(id + '-exit')) {
			output += `    subgraph ${RType.ExpressionList} ${normalizedVertex?.info.fullLexeme ?? id}\n`;
			output += `        direction ${dirIsBT ? 'BT' : 'LR'}\n`;
		}
		if(vertex.type === CfgVertexType.Block) {
			output += `    subgraph Block ${normalizedVertex?.info.fullLexeme ?? id}\n`;
			output += `        direction ${dirIsBT ? 'BT' : 'LR'}\n`;
			for(const child of vertex.children ?? []) {
				const childNormalizedVertex = normalizedAst.idMap.get(child);
				const childContent = getLexeme(childNormalizedVertex);
				output += cfgOfNode(childNormalizedVertex, child, childContent, output);
			}
			output += '    end\n';
		}
		output += cfgOfNode(normalizedVertex, id, content, output);
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
