import type { ReplCodeCommand } from './repl-main';
import { normalizedAstToMermaid, normalizedAstToMermaidUrl } from '../../../util/mermaid/ast';
import { ColorEffect, Colors, FontStyles } from '../../../util/text/ansi';
import { clipboardCommand, codeCommand } from './repl-code-command';
import { DefaultMap } from '../../../util/collections/defaultmap';
import type { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { RProject } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-project';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';

function normalizeMermaidCommand(description: string, usageExample: string, aliases: string[], convert: (ast: RProject<ParentInformation>) => string): ReplCodeCommand {
	return clipboardCommand(description, usageExample, aliases, async analyzer => {
		const result = await analyzer.normalize();
		return { text: convert(result.ast), type: 'mermaid url', step: 'normalize', timing: result['.meta'].timing };
	});
}

export const normalizeCommand = normalizeMermaidCommand('Get mermaid code for the normalized AST of R code', ':normalize', ['n'], normalizedAstToMermaid);
export const normalizeStarCommand = normalizeMermaidCommand('Returns the URL to mermaid.live', ':normalize*', ['n*'], normalizedAstToMermaidUrl);

export const normalizeHashCommand = codeCommand('Returns summarization stats for the normalized AST', ':normalize#', ['n#'], async({ output, analyzer }) => {
	const result = await analyzer.normalize();
	const counts = new DefaultMap<RType, number>(() => 0);
	let total = 0;
	const files = result.ast.files.length;
	RProject.visitAst(result.ast, n => {
		counts.set(n.type, counts.get(n.type) + 1);
		total++;
	});
	const num = (s: number, pad = 0) => output.formatter.format(s.toString().padStart(pad, ' '), { color: Colors.Cyan, effect: ColorEffect.Foreground });
	output.stdout(output.formatter.format('Calculated in ' + result['.meta'].timing + 'ms', { color: Colors.White, effect: ColorEffect.Foreground, style: FontStyles.Italic }));
	output.stdout(`${num(total)} nodes total over ${num(files)} file(s)`);
	const longestType = counts.keys().map(p => p.toString().length).reduce((a, b) => Math.max(a, b), 0);
	for(const [type, count] of counts.entries().toArray().sort((a, b) => b[1] - a[1])) {
		output.stdout(`  ${(type + ':').padEnd(longestType + 1, ' ')} ${num(count, 7)}`);
	}
	if(result.hasError) {
		output.stderr(output.formatter.format('There were errors during normalization, enable lax mode to parse (see :parse)!', { color: Colors.Red, effect: ColorEffect.Foreground, style: FontStyles.Bold }));
	}
});
