import type { ReplCodeCommand, ReplOutput } from './repl-main';
import { fileProtocol } from '../../../r-bridge/retriever';
import { normalizedAstToMermaid, normalizedAstToMermaidUrl } from '../../../util/mermaid/ast';
import { ColorEffect, Colors, FontStyles } from '../../../util/text/ansi';

function formatInfo(out: ReplOutput, type: string, timing: number): string {
	return out.formatter.format(`Copied ${type} to clipboard (normalize: ${timing}ms).`, { color: Colors.White, effect: ColorEffect.Foreground, style: FontStyles.Italic });
}

export const normalizeCommand: ReplCodeCommand = {
	description:  `Get mermaid code for the normalized AST of R code, start with '${fileProtocol}' to indicate a file`,
	usesAnalyzer: true,
	usageExample: ':normalize',
	aliases:      [ 'n' ],
	script:       false,
	fn:           async({ output, analyzer }) => {
		const result = await analyzer.normalizedAst();
		const mermaid = normalizedAstToMermaid(result.ast);
		output.stdout(mermaid);
		try {
			const clipboard = await import('clipboardy');
			clipboard.default.writeSync(mermaid);
			output.stdout(formatInfo(output, 'mermaid url', 0)); // TODO
		} catch{ /* do nothing this is a service thing */ }
	}
};

export const normalizeStarCommand: ReplCodeCommand = {
	description:  'Returns the URL to mermaid.live',
	usesAnalyzer: true,
	usageExample: ':normalize*',
	aliases:      [ 'n*' ],
	script:       false,
	fn:           async({ output, analyzer }) => {
		const result = await analyzer.normalizedAst();
		const mermaid = normalizedAstToMermaidUrl(result.ast);
		output.stdout(mermaid);
		try {
			const clipboard = await import('clipboardy');
			clipboard.default.writeSync(mermaid);
			output.stdout(formatInfo(output, 'mermaid url', 0)); // TODO
		} catch{ /* do nothing this is a service thing */ }
	}
};
