import type { ReplCodeCommand, ReplOutput } from './repl-main';
import { fileProtocol } from '../../../r-bridge/retriever';
import { normalizedAstToMermaid, normalizedAstToMermaidUrl } from '../../../util/mermaid/ast';
import { ColorEffect, Colors, FontStyles } from '../../../util/text/ansi';
import type { PipelinePerStepMetaInformation } from '../../../core/steps/pipeline/pipeline';
import { handleString } from '../core';

function formatInfo(out: ReplOutput, type: string, meta: PipelinePerStepMetaInformation): string {
	return out.formatter.format(`Copied ${type} to clipboard (normalize: ${meta['.meta'].cached ? 'cached' : meta['.meta'].timing + 'ms'}).`, { color: Colors.White, effect: ColorEffect.Foreground, style: FontStyles.Italic });
}

export const normalizeCommand: ReplCodeCommand = {
	description:  `Get mermaid code for the normalized AST of R code, start with '${fileProtocol}' to indicate a file`,
	usesAnalyzer: true,
	usageExample: ':normalize',
	aliases:      [ 'n' ],
	script:       false,
	argsParser:   (args: string) => handleString(args),
	fn:           async({ output, analyzer }) => {
		const result = await analyzer.normalizedAst();
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
	description:  'Returns the URL to mermaid.live',
	usesAnalyzer: true,
	usageExample: ':normalize*',
	aliases:      [ 'n*' ],
	script:       false,
	argsParser:   (args: string) => handleString(args),
	fn:           async({ output, analyzer }) => {
		const result = await analyzer.normalizedAst();
		const mermaid = normalizedAstToMermaidUrl(result.ast);
		output.stdout(mermaid);
		try {
			const clipboard = await import('clipboardy');
			clipboard.default.writeSync(mermaid);
			output.stdout(formatInfo(output, 'mermaid url', result));
		} catch{ /* do nothing this is a service thing */ }
	}
};
