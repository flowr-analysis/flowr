import { internalPrinter, StepOutputFormat } from '../../../print/print';
import { parseToQuads } from '../../../print/parse-printer';
import type { IPipelineStep } from '../../pipeline-step';
import { PipelineStepStage } from '../../pipeline-step';
import type { DeepReadonly } from 'ts-essentials';
import type { QuadSerializationConfiguration } from '../../../../util/quads';
import type { ParseRequiredInput } from '../../../../r-bridge/parser';
import { parseRequests } from '../../../../r-bridge/parser';

export const PARSE_WITH_R_SHELL_STEP = {
	name:              'parse',
	humanReadableName: 'parse with R shell',
	description:       'Parse the given R code into an AST',
	processor:         parseRequests<string>,
	executed:          PipelineStepStage.OncePerFile,
	printer:           {
		[StepOutputFormat.Internal]: internalPrinter,
		[StepOutputFormat.Json]:     JSON.stringify,
		[StepOutputFormat.RdfQuads]: ({ parsed }, config: QuadSerializationConfiguration) => parseToQuads(parsed, config)
	},
	dependencies:  [],
	requiredInput: undefined as unknown as ParseRequiredInput<string>
} as const satisfies DeepReadonly<IPipelineStep<'parse', typeof parseRequests<string>>>;
