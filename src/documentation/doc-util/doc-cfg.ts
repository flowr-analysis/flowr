import { extractCfg } from '../../control-flow/extract-cfg';
import { createDataflowPipeline, createNormalizePipeline } from '../../core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../r-bridge/retriever';
import type { NormalizedAst } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { KnownParser } from '../../r-bridge/parser';
import { printAsMs } from '../../util/text/time';
import { FlowrWikiBaseRef } from './doc-files';
import type { DataflowInformation } from '../../dataflow/info';
import { cfgToMermaid } from '../../util/mermaid/cfg';
import { codeBlock } from './doc-code';
import type { ControlFlowInformation } from '../../control-flow/control-flow-graph';
import { type CfgSimplificationPassName , DefaultCfgSimplificationOrder } from '../../control-flow/cfg-simplification';
import { defaultConfigOptions } from '../../config';

type GetCfgReturn = {
	info:      ControlFlowInformation,
	ast:       NormalizedAst,
	dataflow?: DataflowInformation
}

export function getCfg(parser: KnownParser, code: string, simplifications?: readonly CfgSimplificationPassName[], useDfg?: true): Promise<Required<GetCfgReturn>>
export function getCfg(parser: KnownParser, code: string, simplifications?: readonly CfgSimplificationPassName[], useDfg?: boolean): Promise<GetCfgReturn>
/**
 * Returns the control flow graph for the given code.
 */
export async function getCfg(parser: KnownParser, code: string, simplifications: readonly CfgSimplificationPassName[] = [], useDfg = true): Promise<GetCfgReturn> {
	const result = useDfg ? await createDataflowPipeline(parser, {
		requests: requestFromInput(code)
	}, defaultConfigOptions).allRemainingSteps() : await createNormalizePipeline(parser, {
		requests: requestFromInput(code)
	}, defaultConfigOptions).allRemainingSteps();
	const cfg = extractCfg(result.normalize, defaultConfigOptions, useDfg ? (result as unknown as {dataflow: DataflowInformation}).dataflow.graph : undefined, [...DefaultCfgSimplificationOrder, ...simplifications]);
	return {
		info:     cfg,
		ast:      result.normalize,
		dataflow: 'dataflow' in result ? (result as {dataflow: DataflowInformation}).dataflow : undefined
	};
}

/**
 * Serializes the given control flow graph to a mermaid diagram.
 */
export function printCfg(cfg: ControlFlowInformation, ast: NormalizedAst, prefix = 'flowchart BT\n', simplify = false) {
	return `
${codeBlock('mermaid', cfgToMermaid(cfg, ast, prefix, simplify))}
	`;
}

export interface PrintCfgOptions {
	readonly showCode?:        boolean;
	readonly openCode?:        boolean;
	readonly prefix?:          string;
	readonly simplifications?: readonly CfgSimplificationPassName[];
	readonly simplify?:        boolean;
	readonly useDfg?:          boolean;
}

/**
 * Generates and prints the control flow graph for the given code, along with optional metadata and the original code.
 */
export async function printCfgCode(parser: KnownParser, code: string, { showCode = true, openCode = false, prefix = 'flowchart BT\n', simplifications = [], simplify = false, useDfg = true }: PrintCfgOptions = {}) {
	const now = performance.now();
	const res = await getCfg(parser, code, simplifications, useDfg);
	const duration = performance.now() - now;

	const metaInfo = `The analysis required _${printAsMs(duration)}_ (including the ${useDfg ? 'dataflow analysis, ' : ''} normalization${useDfg ? ', ' : ''} and parsing with the [${parser.name}](${FlowrWikiBaseRef}/Engines) engine) within the generation environment.
We used the following simplification${(simplifications?.length ?? 0) + DefaultCfgSimplificationOrder.length != 1 ? 's' : ''}: ${[...DefaultCfgSimplificationOrder, ...simplifications].map(s => '`' + s + '`').join(', ')} ${simplify ? ' and render a simplified/compacted version' : ''}.
	`;

	return '\n\n' +  printCfg(res.info, res.ast, prefix, simplify) + (showCode ? `
<details${openCode ? ' open' : ''}>

<summary style="color:gray">R Code of the CFG</summary>

${metaInfo}

${codeBlock('r', code)}

</details>

` : '\n_(' + metaInfo + ')_\n\n')
	;
}
