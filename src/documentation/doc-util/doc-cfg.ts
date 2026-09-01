import { extractCfg } from '../../control-flow/control-flow-graph';
import { createDataflowPipeline } from '../../core/steps/pipeline/default-pipelines';
import type { NormalizedAst } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { KnownParser } from '../../r-bridge/parser';
import { printAsMs } from '../../util/text/time';
import { FlowrWikiBaseRef } from './doc-files';
import type { GeneralDocContext } from '../wiki-mk/doc-context';
import type { DataflowInformation } from '../../dataflow/info';
import { cfgToMermaid } from '../../util/mermaid/cfg';
import { codeBlock } from './doc-code';
import type { ControlFlowInformation } from '../../control-flow/control-flow-graph';
import { type CfgSimplificationPassName, DefaultCfgSimplificationOrder, simplifyControlFlowInformation } from '../../control-flow/cfg-simplification';
import { contextFromInput } from '../../project/context/flowr-analyzer-context';

interface GetCfgReturn {
	info:     ControlFlowInformation,
	ast:      NormalizedAst,
	dataflow: DataflowInformation
}

/**
 * Returns the control flow graph for the given code.
 */
export async function getCfg(parser: KnownParser, code: string, simplifications: readonly CfgSimplificationPassName[] = []): Promise<GetCfgReturn> {
	const context = contextFromInput(code);
	const result = await createDataflowPipeline(parser, { context }).allRemainingSteps();
	const dataflow = result.dataflow;
	const cfg = simplifyControlFlowInformation(extractCfg(dataflow), { ast: result.normalize, dfg: dataflow.graph, ctx: context }, [...DefaultCfgSimplificationOrder, ...simplifications]);
	return {
		info: cfg,
		ast:  result.normalize,
		dataflow
	};
}

/**
 * Serializes the given control flow graph to a mermaid diagram.
 */
export function printCfg(cfg: ControlFlowInformation, ast: NormalizedAst, prefix = 'flowchart TD\n', simplify = false) {
	return `
${codeBlock('mermaid', cfgToMermaid(cfg, ast, { prefix, simplify }))}
	`;
}

export interface PrintCfgOptions {
	readonly showCode?:        boolean;
	readonly openCode?:        boolean;
	readonly prefix?:          string;
	readonly simplifications?: readonly CfgSimplificationPassName[];
	readonly simplify?:        boolean;
	readonly ctx?:             GeneralDocContext;
}

/**
 * Generates and prints the control flow graph for the given code, along with optional metadata and the original code.
 */
export async function printCfgCode(parser: KnownParser, code: string, { showCode = true, openCode = false, prefix = 'flowchart TD\n', simplifications = [], simplify = false, ctx }: PrintCfgOptions = {}) {
	const now = performance.now();
	const res = await getCfg(parser, code, simplifications);
	const duration = performance.now() - now;

	const metaInfo = `The analysis required _${printAsMs(duration)}_ (including the dataflow analysis, normalization, and parsing with the ${ctx ? ctx.linkPage('wiki/Engines', parser.name) : `[${parser.name}](${FlowrWikiBaseRef}/Engines)`} engine) within the generation environment.
We used the following simplification${(simplifications?.length ?? 0) + DefaultCfgSimplificationOrder.length !== 1 ? 's' : ''}: ${[...DefaultCfgSimplificationOrder, ...simplifications].map(s => '`' + s + '`').join(', ')} ${simplify ? ' and render a simplified/compacted version' : ''}.
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
