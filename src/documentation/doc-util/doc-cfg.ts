import { extractCFG } from '../../control-flow/extract-cfg';
import {
	createDataflowPipeline
} from '../../core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../r-bridge/retriever';
import type { NormalizedAst } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { KnownParser } from '../../r-bridge/parser';
import { printAsMs } from '../../util/text/time';
import { FlowrWikiBaseRef } from './doc-files';
import type { DataflowInformation } from '../../dataflow/info';
import { cfgToMermaid } from '../../util/mermaid/cfg';
import { codeBlock } from './doc-code';
import type { ControlFlowInformation } from '../../control-flow/control-flow-graph';
import type { CfgSimplificationPassName } from '../../control-flow/cfg-simplification';
import { DefaultCfgSimplificationOrder } from '../../control-flow/cfg-simplification';

export async function getCfg(parser: KnownParser, code: string, simplifications: readonly CfgSimplificationPassName[] = []): Promise<{
	info:     ControlFlowInformation,
	ast:      NormalizedAst,
	dataflow: DataflowInformation
}> {
	const result = await createDataflowPipeline(parser, {
		request: requestFromInput(code)
	}).allRemainingSteps();
	const cfg = extractCFG(result.normalize, result.dataflow.graph, [...DefaultCfgSimplificationOrder, ...simplifications]);
	return {
		info:     cfg,
		ast:      result.normalize,
		dataflow: result.dataflow
	};
}

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
}
export async function printCFGCode(parser: KnownParser, code: string, { showCode = true, openCode = false, prefix = 'flowchart BT\n', simplifications = [], simplify = false }: PrintCfgOptions = {}) {
	const now = performance.now();
	const res = await getCfg(parser, code, simplifications);
	const duration = performance.now() - now;

	const metaInfo = `The analysis required _${printAsMs(duration)}_ (including the dataflow analysis, normalization, and parsing with the [${parser.name}](${FlowrWikiBaseRef}/Engines) engine) within the generation environment.
We used the following simplification${(simplifications?.length ?? 0) + DefaultCfgSimplificationOrder.length != 1 ? 's' : ''}: ${[...DefaultCfgSimplificationOrder, ...simplifications].map(s => '`' + s + '`').join(', ')} ${simplify ? ' and render a simplified/compacted version' : ''}.
	`;

	return '\n\n' +  printCfg(res.info, res.ast, prefix, simplify) + (showCode ? `
<details${openCode ? ' open' : ''}>

<summary style="color:gray">R Code of the CFG</summary>

${metaInfo}

${codeBlock('r', code)}

</details>

` : '\n(' + metaInfo + ')\n\n')
	;
}
