import type { ControlFlowInformation } from '../../control-flow/cfg';
import { escapeMarkdown, mermaidCodeToUrl } from './mermaid';
import type { NormalizedAst, RNodeWithParent } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';

function getLexeme(n?: RNodeWithParent) {
	return n ? n.info.fullLexeme ?? n.lexeme ?? '<unknown>' : '';
}


export function cfgToMermaid(cfg: ControlFlowInformation, normalizedAst: NormalizedAst, prefix = 'flowchart BT\n'): string {
	let output = prefix;

	for(const [id, vertex] of cfg.graph.vertices()) {
		const normalizedVertex = normalizedAst.idMap.get(id);
		const content = getLexeme(normalizedVertex);
		if(content.length > 0) {
			const name = `"\`${escapeMarkdown(vertex.name)} (${id})\n${escapeMarkdown(JSON.stringify(content))}\`"`;
			output += `    n${id}[${name}]\n`;
		} else {
			output += String(id).endsWith('-exit') ? `    n${id}((${id}))\n` : `    n${id}[[${id}]]\n`;
		}
	}
	for(const [from, targets] of cfg.graph.edges()) {
		for(const [to, edge] of targets) {
			const edgeType = edge.label === 'CD' ? '-->' : '-.->';
			const edgeSuffix = edge.label === 'CD' ? ` (${edge.when})` : '';
			output += `    n${from} ${edgeType}|"${escapeMarkdown(edge.label)}${edgeSuffix}"| n${to}\n`;
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
