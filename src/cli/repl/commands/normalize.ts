import type { ReplCommand } from './main'
import type { RShell } from '../../../r-bridge'
import { requestFromInput } from '../../../r-bridge'
import { normalizedAstToMermaid, normalizedAstToMermaidUrl } from '../../../util/mermaid'
import { PipelineExecutor } from '../../../core/pipeline-executor'
import { PARSE_WITH_R_SHELL_STEP } from '../../../core/steps/all/core/00-parse'
import { DESUGAR_NORMALIZE, NORMALIZE } from '../../../core/steps/all/core/10-normalize'
import { createPipeline } from '../../../core/steps/pipeline'

const normalizePipeline = createPipeline(PARSE_WITH_R_SHELL_STEP, NORMALIZE)
const desugarPipeline = createPipeline(PARSE_WITH_R_SHELL_STEP, DESUGAR_NORMALIZE)

async function normalize(shell: RShell, remainingLine: string, pipeline: typeof normalizePipeline | typeof desugarPipeline = normalizePipeline) {
	return await new PipelineExecutor(pipeline, {
		shell,
		request: requestFromInput(remainingLine.trim())
	}).allRemainingSteps()
}

export const normalizeCommand: ReplCommand = {
	description:  'Get mermaid code for the normalized AST of R code, start with \'file://\' to indicate a file',
	usageExample: ':normalize',
	aliases:      [ 'n' ],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		const { normalize: { ast } } = await normalize(shell, remainingLine)
		output.stdout(normalizedAstToMermaid(ast))
	}
}

export const normalizeStarCommand: ReplCommand = {
	description:  'Get a mermaid url of the normalized AST of R code, start with \'file://\' to indicate a file',
	usageExample: ':normalize',
	aliases:      [ 'n*' ],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		const { normalize: { ast } }  = await normalize(shell, remainingLine)
		output.stdout(normalizedAstToMermaidUrl(ast))
	}
}


export const normalizeV2Command: ReplCommand = {
	description:  'Get mermaid code for the normalized and desugared (v2) AST of R code, start with \'file://\' to indicate a file',
	usageExample: ':normalize2',
	aliases:      [ 'n2', 'desugar' ],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		const { normalize: { ast } } = await normalize(shell, remainingLine, desugarPipeline)
		output.stdout(normalizedAstToMermaid(ast))
	}
}

export const normalizeV2StarCommand: ReplCommand = {
	description:  'Get a mermaid url of the normalized AST and desugared (v2) of R code, start with \'file://\' to indicate a file',
	usageExample: ':normalize2',
	aliases:      [ 'n2*', 'desugar*' ],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		const { normalize: { ast } }  = await normalize(shell, remainingLine, desugarPipeline)
		output.stdout(normalizedAstToMermaidUrl(ast))
	}
}
