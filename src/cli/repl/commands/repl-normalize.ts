import type { ReplCommand, ReplOutput } from './repl-main';
import { createNormalizePipeline } from '../../../core/steps/pipeline/default-pipelines';
import { fileProtocol, requestFromInput } from '../../../r-bridge/retriever';
import { normalizedAstToMermaid, normalizedAstToMermaidUrl } from '../../../util/mermaid/ast';
import type { KnownParser } from '../../../r-bridge/parser';
const clipboard = import('clipboardy');
import { ColorEffect, Colors, FontStyles } from '../../../util/ansi';

async function normalize(parser: KnownParser, remainingLine: string) {
	return await createNormalizePipeline(parser, {
		request: requestFromInput(remainingLine.trim())
	}).allRemainingSteps();
}

function handleString(code: string): string {
	return code.startsWith('"') ? JSON.parse(code) as string : code;
}

function formatInfo(out: ReplOutput, type: string, timing: number): string {
	return out.formatter.format(`Copied ${type} to clipboard (normalize: ${timing}ms).`, { color: Colors.White, effect: ColorEffect.Foreground, style: FontStyles.Italic });
}

export const normalizeCommand: ReplCommand = {
	description:  `Get mermaid code for the normalized AST of R code, start with '${fileProtocol}' to indicate a file`,
	usageExample: ':normalize',
	aliases:      [ 'n' ],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		const result = await normalize(shell, handleString(remainingLine));
		const mermaid = normalizedAstToMermaid(result.normalize.ast);
		output.stdout(mermaid);
		try {
			(await clipboard).default.writeSync(mermaid);
			output.stdout(formatInfo(output, 'mermaid url', result.normalize['.meta'].timing));
		} catch{ /* do nothing this is a service thing */ }
	}
};

export const normalizeStarCommand: ReplCommand = {
	description:  'Returns the URL to mermaid.live',
	usageExample: ':normalize*',
	aliases:      [ 'n*' ],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		const result = await normalize(shell, handleString(remainingLine));
		const mermaid = normalizedAstToMermaidUrl(result.normalize.ast);
		output.stdout(mermaid);
		try {
			(await clipboard).default.writeSync(mermaid);
			output.stdout(formatInfo(output, 'mermaid url', result.normalize['.meta'].timing));
		} catch{ /* do nothing this is a service thing */ }
	}
};
