import type { ReplCodeCommand } from './repl-main';
import { cfgToMermaid, cfgToMermaidUrl } from '../../../util/mermaid/cfg';
import type { ControlFlowInformation } from '../../../control-flow/control-flow-graph';
import type { NormalizedAst } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { type CfgSimplificationPassName, DefaultCfgSimplificationOrder } from '../../../control-flow/cfg-simplification';
import { clipboardCommand } from './repl-code-command';

function cfgCommand(description: string, usageExample: string, aliases: string[], simplifications: readonly CfgSimplificationPassName[], cfgConverter: (cfg: ControlFlowInformation, ast: NormalizedAst) => string): ReplCodeCommand {
	return clipboardCommand(description, usageExample, aliases, async analyzer => {
		const cfg = await analyzer.controlflow([...DefaultCfgSimplificationOrder, ...simplifications]);
		return { text: cfgConverter(cfg, await analyzer.normalize()), type: 'mermaid code' };
	});
}

export const controlflowCommand = cfgCommand('Get mermaid code for the control-flow graph of R code', ':controlflow', ['cfg', 'cf'], [], cfgToMermaid);

export const controlflowStarCommand = cfgCommand('Returns the URL to mermaid.live', ':controlflow*', ['cfg*', 'cf*'], [], cfgToMermaidUrl);

export const controlflowBbCommand = cfgCommand('Get mermaid code for the control-flow graph with basic blocks', ':controlflowbb', ['cfgb', 'cfb'], ['to-basic-blocks'], cfgToMermaid);

export const controlflowBbStarCommand = cfgCommand('Returns the URL to mermaid.live', ':controlflowbb*', ['cfgb*', 'cfb*'], ['to-basic-blocks'], cfgToMermaidUrl);
