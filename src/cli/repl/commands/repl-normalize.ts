import type { ReplCodeCommand, ReplOutput } from './repl-main';
import { fileProtocol } from '../../../r-bridge/retriever';
import { normalizedAstToMermaid, normalizedAstToMermaidUrl } from '../../../util/mermaid/ast';
import { ColorEffect, Colors, FontStyles } from '../../../util/text/ansi';
import type { PipelinePerStepMetaInformation } from '../../../core/steps/pipeline/pipeline';
import { handleString } from '../core';
import { DefaultMap } from '../../../util/collections/defaultmap';
import type { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { RProject } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-project';

function formatInfo(out: ReplOutput, type: string, meta: PipelinePerStepMetaInformation): string {
	return out.formatter.format(`Copied ${type} to clipboard (normalize: ${meta['.meta'].timing + 'ms'}).`, { color: Colors.White, effect: ColorEffect.Foreground, style: FontStyles.Italic });
}

export const normalizeCommand: ReplCodeCommand = {
	description:   `Get mermaid code for the normalized AST of R code, start with '${fileProtocol}' to indicate a file`,
	isCodeCommand: true,
	usageExample:  ':normalize',
	aliases:       [ 'n' ],
	script:        false,
	argsParser:    (args: string) => handleString(args),
	fn:            async({ output, analyzer }) => {
		const result = await analyzer.normalize();
		const mermaid = normalizedAstToMermaid(result.ast);
		output.stdout(mermaid);
		try {
			const clipboard = await import('clipboardy');
			clipboard.default.writeSync(mermaid);
			output.stdout(formatInfo(output, 'mermaid url', result));
		} catch{ /* do nothing this is a service thing */ }
	}
};

export const normalizeStarCommand: ReplCodeCommand = {
	description:   'Returns the URL to mermaid.live',
	isCodeCommand: true,
	usageExample:  ':normalize*',
	aliases:       [ 'n*' ],
	script:        false,
	argsParser:    (args: string) => handleString(args),
	fn:            async({ output, analyzer }) => {
		const result = await analyzer.normalize();
		const mermaid = normalizedAstToMermaidUrl(result.ast);
		output.stdout(mermaid);
		try {
			const clipboard = await import('clipboardy');
			clipboard.default.writeSync(mermaid);
			output.stdout(formatInfo(output, 'mermaid url', result));
		} catch{ /* do nothing this is a service thing */ }
	}
};

export const normalizeHashCommand: ReplCodeCommand = {
	description:   'Returns summarization stats for the normalized AST',
	isCodeCommand: true,
	usageExample:  ':normalize#',
	aliases:       [ 'n#' ],
	script:        false,
	argsParser:    (args: string) => handleString(args),
	fn:            async({ output, analyzer }) => {
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
		for(const [ type, count ] of counts.entries().toArray().sort((a, b) => b[1] - a[1])) {
			output.stdout(`  ${(type + ':').padEnd(longestType + 1, ' ')} ${num(count, 7)}`);
		}
	}
};
