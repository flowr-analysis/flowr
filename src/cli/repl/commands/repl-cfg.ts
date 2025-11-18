import type { ReplCodeCommand, ReplOutput } from './repl-main';
import { fileProtocol } from '../../../r-bridge/retriever';
import { cfgToMermaid, cfgToMermaidUrl } from '../../../util/mermaid/cfg';
import { ColorEffect, Colors, FontStyles } from '../../../util/text/ansi';
import type { ControlFlowInformation } from '../../../control-flow/control-flow-graph';
import type { NormalizedAst } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { CfgSimplificationPassName } from '../../../control-flow/cfg-simplification';
import { DefaultCfgSimplificationOrder } from '../../../control-flow/cfg-simplification';
import type { ReadonlyFlowrAnalysisProvider } from '../../../project/flowr-analyzer';
import { handleString } from '../core';

function formatInfo(out: ReplOutput, type: string): string {
	return out.formatter.format(`Copied ${type} to clipboard.`, { color: Colors.White, effect: ColorEffect.Foreground, style: FontStyles.Italic });
}

async function produceAndPrintCfg(analyzer: ReadonlyFlowrAnalysisProvider, output: ReplOutput, simplifications: readonly CfgSimplificationPassName[], cfgConverter: (cfg: ControlFlowInformation, ast: NormalizedAst) => string) {
	const cfg = await analyzer.controlflow([...DefaultCfgSimplificationOrder, ...simplifications]);
	const normalizedAst = await analyzer.normalize();
	const mermaid = cfgConverter(cfg, normalizedAst);
	output.stdout(mermaid);
	try {
		const clipboard = await import('clipboardy');
		clipboard.default.writeSync(mermaid);
		output.stdout(formatInfo(output, 'mermaid code'));
	} catch{ /* do nothing this is a service thing */
	}
}

export const controlflowCommand: ReplCodeCommand = {
	description:   `Get mermaid code for the control-flow graph of R code, start with '${fileProtocol}' to indicate a file`,
	isCodeCommand: true,
	usageExample:  ':controlflow',
	aliases:       [ 'cfg', 'cf' ],
	script:        false,
	argsParser:    (args: string) => handleString(args),
	fn:            async({ output, analyzer }) => {
		await produceAndPrintCfg(analyzer, output, [], cfgToMermaid);
	}
};


export const controlflowStarCommand: ReplCodeCommand = {
	description:   'Returns the URL to mermaid.live',
	isCodeCommand: true,
	usageExample:  ':controlflow*',
	aliases:       [ 'cfg*', 'cf*' ],
	script:        false,
	argsParser:    (args: string) => handleString(args),
	fn:            async({ output, analyzer }) => {
		await produceAndPrintCfg(analyzer, output, [], cfgToMermaidUrl);
	}
};


export const controlflowBbCommand: ReplCodeCommand = {
	description:   `Get mermaid code for the control-flow graph with basic blocks, start with '${fileProtocol}' to indicate a file`,
	isCodeCommand: true,
	usageExample:  ':controlflowbb',
	aliases:       [ 'cfgb', 'cfb' ],
	script:        false,
	argsParser:    (args: string) => handleString(args),
	fn:            async({ output, analyzer }) => {
		await produceAndPrintCfg(analyzer, output, ['to-basic-blocks'], cfgToMermaid);
	}
};


export const controlflowBbStarCommand: ReplCodeCommand = {
	description:   'Returns the URL to mermaid.live',
	isCodeCommand: true,
	usageExample:  ':controlflowbb*',
	aliases:       [ 'cfgb*', 'cfb*' ],
	script:        false,
	argsParser:    (args: string) => handleString(args),
	fn:            async({ output, analyzer }) => {
		await produceAndPrintCfg(analyzer, output, ['to-basic-blocks' ], cfgToMermaidUrl);
	}
};
