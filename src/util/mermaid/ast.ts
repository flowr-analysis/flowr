import { escapeMarkdown, mermaidCodeToUrl } from './mermaid';
import { RoleInParent } from '../../r-bridge/lang-4.x/ast/model/processing/role';
import type { ParentInformation, RNodeWithParent } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RProject } from '../../r-bridge/lang-4.x/ast/model/nodes/r-project';
import { FlowrFile } from '../../project/context/flowr-file';
import type { MermaidGraphPrinterInfo } from './info';
import { MermaidDefaultMarkStyle } from './info';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';

function identifyMermaidDirection(prefix: string): string {
	const directionMatch = prefix.match(/flowchart (TD|LR|RL|BT)/);
	if(directionMatch) {
		return directionMatch[1];
	}
	return 'TD';
}

/**
 * Serialize the normalized AST to mermaid format
 */
export function normalizedAstToMermaid(ast: RProject<ParentInformation> | RNodeWithParent, { prefix = 'flowchart TD\n', markStyle = MermaidDefaultMarkStyle, includeOnlyIds, mark }: MermaidGraphPrinterInfo = {}): string {
	let output = prefix;
	function showNode(n: RNodeWithParent): void {
		if(includeOnlyIds && !includeOnlyIds.has(n.info.id)) {
			return;
		}

		const name = `${n.type} (${n.info.id})\\n${n.lexeme ?? ' '}`;
		output += `    n${n.info.id}(["${escapeMarkdown(name)}"])\n`;
		if(mark?.has(n.info.id)) {
			output += `    style n${n.info.id} ${markStyle.vertex}\n`;
		}
		if(n.info.parent !== undefined && (!includeOnlyIds || includeOnlyIds.has(n.info.parent))) {
			const context = n.info;
			const roleSuffix = context.role === RoleInParent.ExpressionListChild || context.role === RoleInParent.FunctionCallArgument || context.role === RoleInParent.FunctionDefinitionParameter ? `-${context.index}` : '';
			output += `    n${n.info.parent} -->|"${context.role}${roleSuffix}"| n${n.info.id}\n`;
		}
		if(n.type === RType.ExpressionList && n.grouping !== undefined) {
			output += `    n${n.info.id} -.-|"group-open"| n${n.grouping[0].info.id}\n`;
			output += `    n${n.info.id} -.-|"group-close"| n${n.grouping[1].info.id}\n`;
		}
	}
	function showAst(ast: RNodeWithParent): void {
		RNode.visitAst(ast, n => {
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
	}

	if(ast.type === RType.Project) {
		for(const f of ast.files) {
			// add a subgraph for each file
			if(ast.files.length !== 1 || (f.filePath && f.filePath !== FlowrFile.INLINE_PATH)) {
				const direction = identifyMermaidDirection(prefix);
				output += `    subgraph "File: ${escapeMarkdown(f.filePath ?? FlowrFile.INLINE_PATH)}" direction ${direction}\n`;
				showAst(f.root);
				output += '    end\n';
			} else {
				showAst(f.root);
			}
		}
	} else {
		showAst(ast);
	}

	return output;
}

/**
 * Use mermaid to visualize the normalized AST.
 */
export function normalizedAstToMermaidUrl(ast: RProject<ParentInformation> | RNodeWithParent, info?: MermaidGraphPrinterInfo): string {
	return mermaidCodeToUrl(normalizedAstToMermaid(ast, info ?? {}));
}
