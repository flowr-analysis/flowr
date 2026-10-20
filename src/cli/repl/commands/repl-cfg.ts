import type { ReplCodeCommand, ReplOutput } from './repl-main';
import { cfgToMermaid, cfgToMermaidUrl } from '../../../util/mermaid/cfg';
import type { ControlFlowInformation } from '../../../control-flow/control-flow-graph';
import type { NormalizedAst } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { type CfgSimplificationPassName, DefaultCfgSimplificationOrder } from '../../../control-flow/cfg-simplification';
import type { ReadonlyFlowrAnalysisProvider } from '../../../project/flowr-analyzer';
import { handleString } from '../core';
import { ReplClipboard } from './repl-clipboard';

async function produceAndPrintCfg(analyzer: ReadonlyFlowrAnalysisProvider, output: ReplOutput, simplifications: readonly CfgSimplificationPassName[], cfgConverter: (cfg: ControlFlowInformation, ast: NormalizedAst) => string) {
	const cfg = await analyzer.controlflow([...DefaultCfgSimplificationOrder, ...simplifications]);
	const normalizedAst = await analyzer.normalize();
	const mermaid = cfgConverter(cfg, normalizedAst);
	await ReplClipboard.print(output, mermaid, ReplClipboard.note(output, 'mermaid code'));
}

function cfgCommand(description: string, usageExample: string, aliases: string[], simplifications: readonly CfgSimplificationPassName[], cfgConverter: (cfg: ControlFlowInformation, ast: NormalizedAst) => string): ReplCodeCommand {
	return {
		description,
		isCodeCommand: true,
		usageExample,
		aliases,
		script:        false,
		argsParser:    (args: string) => handleString(args),
		fn:            async({ output, analyzer }) => {
			await produceAndPrintCfg(analyzer, output, simplifications, cfgConverter);
		}
	};
}

export const controlflowCommand = cfgCommand('Get mermaid code for the control-flow graph of R code', ':controlflow', ['cfg', 'cf'], [], cfgToMermaid);

export const controlflowStarCommand = cfgCommand('Returns the URL to mermaid.live', ':controlflow*', ['cfg*', 'cf*'], [], cfgToMermaidUrl);

export const controlflowBbCommand = cfgCommand('Get mermaid code for the control-flow graph with basic blocks', ':controlflowbb', ['cfgb', 'cfb'], ['to-basic-blocks'], cfgToMermaid);

export const controlflowBbStarCommand = cfgCommand('Returns the URL to mermaid.live', ':controlflowbb*', ['cfgb*', 'cfb*'], ['to-basic-blocks'], cfgToMermaidUrl);
