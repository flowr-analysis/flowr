import { inferStringDomains } from '../../../abstract-interpretation/eval/inference';
import type { StringDomainInfo } from '../../../abstract-interpretation/eval/visitor';
import type { FlowrConfigOptions } from '../../../config';
import { extractCfg } from '../../../control-flow/extract-cfg';
import { createDataflowPipeline } from '../../../core/steps/pipeline/default-pipelines';
import type { NormalizedAst, ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { KnownParser } from '../../../r-bridge/parser';
import { requestFromInput } from '../../../r-bridge/retriever';
import { graphToMermaidUrl } from '../../../util/mermaid/dfg';
import { ColorEffect, Colors, FontStyles } from '../../../util/text/ansi';
import type { ReplCommand, ReplOutput } from './repl-main';

/**
 * Obtain the dataflow graph using a known parser (such as the {@link RShell} or {@link TreeSitterExecutor}).
 */
async function replGetDataflow(config: FlowrConfigOptions, parser: KnownParser, code: string) {
	return await createDataflowPipeline(parser, {
		request: requestFromInput(code.trim())
	}, config).allRemainingSteps();
}

function handleString(code: string): string {
	return code.startsWith('"') ? JSON.parse(code) as string : code;
}

function formatInfo(out: ReplOutput, type: string, timing: number): string {
	return out.formatter.format(`Copied ${type} to clipboard (dataflow: ${timing}ms).`, { color: Colors.White, effect: ColorEffect.Foreground, style: FontStyles.Italic });
}

export const stringDomainGraphStarCommand: ReplCommand = {
	description:  'Returns the URL to mermaid.live',
	usageExample: ':sdg* <code>',
	aliases:      [ 'sdg*' ],
	script:       false,
	fn:           async({ output, parser, remainingLine, config }) => {
		const totalStart = Date.now();
		const result = await replGetDataflow(config, parser, handleString(remainingLine));
		const dfg = result.dataflow.graph;
		const normalizedAst: NormalizedAst<ParentInformation & StringDomainInfo> = result.normalize;
		const controlFlow = extractCfg(normalizedAst, config, dfg);
		inferStringDomains(
			controlFlow,
			dfg,
			normalizedAst,
			config,
		);
		const totalEnd = Date.now();
		const totalDuration = totalEnd - totalStart;
		const mermaid = graphToMermaidUrl(dfg, false, undefined, false, ['sdvalue']);
		output.stdout(mermaid);
		try {
			const clipboard = await import('clipboardy');
			clipboard.default.writeSync(mermaid);
			output.stdout(formatInfo(output, 'mermaid url', totalDuration));
		} catch{ /* do nothing this is a service thing */ }
	}
};

