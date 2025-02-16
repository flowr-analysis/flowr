import type { ReplCommand, ReplOutput } from './repl-main';
import { extractCFG } from '../../../util/cfg/cfg';
import { createDataflowPipeline } from '../../../core/steps/pipeline/default-pipelines';
import { fileProtocol, requestFromInput } from '../../../r-bridge/retriever';
import { cfgToMermaid, cfgToMermaidUrl } from '../../../util/mermaid/cfg';
import type { KnownParser } from '../../../r-bridge/parser';
import { ColorEffect, Colors, FontStyles } from '../../../util/ansi';
const clipboard = import('clipboardy');

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

export const controlflowCommand: ReplCommand = {
	description:  `Get mermaid code for the control-flow graph of R code, start with '${fileProtocol}' to indicate a file`,
	usageExample: ':controlflow',
	aliases:      [ 'cfg', 'cf' ],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		const result = await controlflow(shell, handleString(remainingLine));

		const cfg = extractCFG(result.normalize, result.dataflow.graph);
		const mermaid = cfgToMermaid(cfg, result.normalize);
		output.stdout(mermaid);
		try {
			(await clipboard).default.writeSync(mermaid);
			output.stdout(formatInfo(output, 'mermaid code'));
		} catch{ /* do nothing this is a service thing */ }
	}
};

export const controlflowStarCommand: ReplCommand = {
	description:  'Returns the URL to mermaid.live',
	usageExample: ':controlflow*',
	aliases:      [ 'cfg*', 'cf*' ],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		const result = await controlflow(shell, handleString(remainingLine));

		const cfg = extractCFG(result.normalize, result.dataflow.graph);
		const mermaid = cfgToMermaidUrl(cfg, result.normalize);
		output.stdout(mermaid);
		try {
			(await clipboard).default.writeSync(mermaid);
			output.stdout(formatInfo(output, 'mermaid url'));
		} catch{ /* do nothing this is a service thing */ }
	}
};
