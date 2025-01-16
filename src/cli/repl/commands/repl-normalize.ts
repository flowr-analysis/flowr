import type { ReplCommand } from './repl-main';
import { createNormalizePipeline } from '../../../core/steps/pipeline/default-pipelines';
import { fileProtocol, requestFromInput } from '../../../r-bridge/retriever';
import { normalizedAstToMermaid, normalizedAstToMermaidUrl } from '../../../util/mermaid/ast';
import type { KnownParser } from '../../../r-bridge/parser';

async function normalize(parser: KnownParser, remainingLine: string) {
	return await createNormalizePipeline(parser, {
		request: requestFromInput(remainingLine.trim())
	}).allRemainingSteps();
}

function handleString(code: string): string {
	return code.startsWith('"') ? JSON.parse(code) as string : code;
}

export const normalizeCommand: ReplCommand = {
	description:  `Get mermaid code for the normalized AST of R code, start with '${fileProtocol}' to indicate a file`,
	usageExample: ':normalize',
	aliases:      [ 'n' ],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		const result = await normalize(shell, handleString(remainingLine));
		output.stdout(normalizedAstToMermaid(result.normalize.ast));
	}
};

export const normalizeStarCommand: ReplCommand = {
	description:  'Returns the URL to mermaid.live',
	usageExample: ':normalize*',
	aliases:      [ 'n*' ],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		const result = await normalize(shell, handleString(remainingLine));
		output.stdout(normalizedAstToMermaidUrl(result.normalize.ast));
	}
};
