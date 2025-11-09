import { escapeMarkdown, mermaidCodeToUrl } from './mermaid';
import { RoleInParent } from '../../r-bridge/lang-4.x/ast/model/processing/role';
import type { RNodeWithParent } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { visitAst } from '../../r-bridge/lang-4.x/ast/model/processing/visitor';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';

/**
 * Serialize the normalized AST to mermaid format
 */
export function normalizedAstToMermaid(ast: RNodeWithParent, prefix = 'flowchart TD\n'): string {
	let output = prefix;
	function showNode(n: RNodeWithParent): void {
		const name = `${n.type} (${n.info.id})\\n${n.lexeme ?? ' '}`;
		output += `    n${n.info.id}(["${escapeMarkdown(name)}"])\n`;
		if(n.info.parent !== undefined) {
			const context = n.info;
			const roleSuffix = context.role === RoleInParent.ExpressionListChild || context.role === RoleInParent.FunctionCallArgument || context.role === RoleInParent.FunctionDefinitionParameter ? `-${context.index}` : '';
			output += `    n${n.info.parent} -->|"${context.role}${roleSuffix}"| n${n.info.id}\n`;
		}
		if(n.type === RType.ExpressionList && n.grouping !== undefined) {
			output += `    n${n.info.id} -.-|"group-open"| n${n.grouping[0].info.id}\n`;
			output += `    n${n.info.id} -.-|"group-close"| n${n.grouping[1].info.id}\n`;
		}
	}
	visitAst(ast, n => {
		showNode(n);
		if(n.type === 'RAccess' && (n.operator !== '[' && n.operator !== '[[')) {
			for(const k of n.access) {
				if(k !== EmptyArgument) {
					showNode(k);
				}
			}
		}
		return false;
	});
	return output;
}

/**
 * Use mermaid to visualize the normalized AST.
 */
export function normalizedAstToMermaidUrl(ast: RNodeWithParent, prefix = 'flowchart TD\n'): string {
	return mermaidCodeToUrl(normalizedAstToMermaid(ast, prefix));
}
