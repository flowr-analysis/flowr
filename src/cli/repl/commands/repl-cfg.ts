import type { ReplCommand, ReplOutput } from './repl-main';
import { extractCfg } from '../../../control-flow/extract-cfg';
import { createDataflowPipeline } from '../../../core/steps/pipeline/default-pipelines';
import { fileProtocol, requestFromInput } from '../../../r-bridge/retriever';
import { cfgToMermaid, cfgToMermaidUrl } from '../../../util/mermaid/cfg';
import type { KnownParser } from '../../../r-bridge/parser';
import { ColorEffect, Colors, FontStyles } from '../../../util/text/ansi';
import type { ControlFlowInformation } from '../../../control-flow/control-flow-graph';
import type { NormalizedAst } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { CfgSimplificationPassName } from '../../../control-flow/cfg-simplification';
import { DefaultCfgSimplificationOrder } from '../../../control-flow/cfg-simplification';

async function controlflow(parser: KnownParser, remainingLine: string) {
	return await createDataflowPipeline(parser, {
		request: requestFromInput(remainingLine.trim())
	}).allRemainingSteps();
}

function handleString(code: string): string {
	return code.startsWith('"') ? JSON.parse(code) as string : code;
}

function formatInfo(out: ReplOutput, type: string): string {
	return out.formatter.format(`Copied ${type} to clipboard.`, { color: Colors.White, effect: ColorEffect.Foreground, style: FontStyles.Italic });
}


async function produceAndPrintCfg(shell: KnownParser, remainingLine: string, output: ReplOutput, simplifications: readonly CfgSimplificationPassName[], cfgConverter: (cfg: ControlFlowInformation, ast: NormalizedAst) => string) {
	const result = await controlflow(shell, handleString(remainingLine));

	const cfg = extractCfg(result.normalize, result.dataflow.graph, [...DefaultCfgSimplificationOrder, ...simplifications]);
	const mermaid = cfgConverter(cfg, result.normalize);
	output.stdout(mermaid);
	try {
		const clipboard = await import('clipboardy');
		clipboard.default.writeSync(mermaid);
		output.stdout(formatInfo(output, 'mermaid code'));
	} catch{ /* do nothing this is a service thing */
	}
}

export const controlflowCommand: ReplCommand = {
	description:  `Get mermaid code for the control-flow graph of R code, start with '${fileProtocol}' to indicate a file`,
	usageExample: ':controlflow',
	aliases:      [ 'cfg', 'cf' ],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		await produceAndPrintCfg(shell, remainingLine, output, [], cfgToMermaid);
	}
};


export const controlflowStarCommand: ReplCommand = {
	description:  'Returns the URL to mermaid.live',
	usageExample: ':controlflow*',
	aliases:      [ 'cfg*', 'cf*' ],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		await produceAndPrintCfg(shell, remainingLine, output, [], cfgToMermaidUrl);
	}
};


export const controlflowBbCommand: ReplCommand = {
	description:  `Get mermaid code for the control-flow graph with basic blocks, start with '${fileProtocol}' to indicate a file`,
	usageExample: ':controlflowbb',
	aliases:      [ 'cfgb', 'cfb' ],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		await produceAndPrintCfg(shell, remainingLine, output, ['to-basic-blocks'], cfgToMermaid);
	}
};


export const controlflowBbStarCommand: ReplCommand = {
	description:  'Returns the URL to mermaid.live',
	usageExample: ':controlflowbb*',
	aliases:      [ 'cfgb*', 'cfb*' ],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		await produceAndPrintCfg(shell, remainingLine, output, ['to-basic-blocks' ], cfgToMermaidUrl);
	}
};
