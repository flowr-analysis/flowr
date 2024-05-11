import { it } from 'mocha'
import { testRequiresNetworkConnection } from './network'
import { assert } from 'chai'
import { testRequiresRVersion } from './version'
import type { MergeableRecord } from '../../../src/util/objects'
import { deepMergeObject } from '../../../src/util/objects'
import { NAIVE_RECONSTRUCT } from '../../../src/core/steps/all/static-slicing/10-reconstruct'
import { guard } from '../../../src/util/assert'
import { PipelineExecutor } from '../../../src/core/pipeline-executor'
import type { TestLabel } from './label'
import { decorateLabelContext } from './label'
import { printAsBuilder } from './dataflow/dataflow-builder-printer'
import { RShell } from '../../../src/r-bridge/shell'
import type { NoInfo, RNode } from '../../../src/r-bridge/lang-4.x/ast/model/model'
import type { fileProtocol } from '../../../src/r-bridge/retriever'
import { requestFromInput } from '../../../src/r-bridge/retriever'
import type {
	AstIdMap, IdGenerator,
	RNodeWithParent
} from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate'
import {
	deterministicCountingIdGenerator
} from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate'
import {
	DEFAULT_DATAFLOW_PIPELINE,
	DEFAULT_NORMALIZE_PIPELINE, DEFAULT_RECONSTRUCT_PIPELINE
} from '../../../src/core/steps/pipeline/default-pipelines'
import type { RExpressionList } from '../../../src/r-bridge/lang-4.x/ast/model/nodes/r-expression-list'
import type { DataflowDifferenceReport, ProblematicDiffInfo } from '../../../src/dataflow/graph/diff'
import type { NodeId } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id'
import type { DataflowGraph } from '../../../src/dataflow/graph/graph'
import { diffGraphsToMermaidUrl, graphToMermaidUrl } from '../../../src/util/mermaid/dfg'
import type { SlicingCriteria } from '../../../src/slicing/criterion/parse'
import { normalizedAstToMermaidUrl } from '../../../src/util/mermaid/ast'

export const testWithShell = (msg: string, fn: (shell: RShell, test: Mocha.Context) => void | Promise<void>): Mocha.Test => {
	return it(msg, async function(): Promise<void> {
		let shell: RShell | null = null
		try {
			shell = new RShell()
			await fn(shell, this)
		} finally {
			// ensure we close the shell in error cases too
			shell?.close()
		}
	})
}

/**
 * produces a shell session for you, can be used within a `describe` block
 * @param fn       - function to use the shell
 */
export function withShell(fn: (shell: RShell) => void): () => void {
	return function() {
		const shell = new RShell()
		after(() => shell.close())
		fn(shell)
	}
}

function removeInformation<T extends Record<string, unknown>>(obj: T, includeTokens: boolean): T {
	return JSON.parse(JSON.stringify(obj, (key, value) => {
		if(key === 'fullRange' || key === 'fullLexeme' || key === 'id' || key === 'parent' || key === 'index' || key === 'role' || key === 'depth') {
			return undefined
		} else if(key === 'additionalTokens' && (!includeTokens || (Array.isArray(value) && value.length === 0))) {
			return undefined
		}
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return value
	})) as T
}


function assertAstEqualIgnoreSourceInformation<Info>(ast: RNode<Info>, expected: RNode<Info>, includeTokens: boolean, message?: () => string): void {
	const astCopy = removeInformation(ast, includeTokens)
	const expectedCopy = removeInformation(expected, includeTokens)
	try {
		assert.deepStrictEqual(astCopy, expectedCopy)
	} catch(e) {
		if(message) {
			console.error(message())
		}
		throw e
	}
}

export const retrieveNormalizedAst = async(shell: RShell, input: `${typeof fileProtocol}${string}` | string): Promise<RNodeWithParent> => {
	const request = requestFromInput(input)
	return (await new PipelineExecutor(DEFAULT_NORMALIZE_PIPELINE, {
		shell, request
	}).allRemainingSteps()).normalize.ast
}

export interface TestConfiguration extends MergeableRecord {
	/** the (inclusive) minimum version of R required to run this test, e.g., {@link MIN_VERSION_PIPE} */
	minRVersion:            string | undefined
	needsPackages:          string[]
	needsNetworkConnection: boolean
}

export const defaultTestConfiguration: TestConfiguration = {
	minRVersion:            undefined,
	needsPackages:          [],
	needsNetworkConnection: false
}

async function testRequiresPackages(shell: RShell, requiredPackages: string[], test: Mocha.Context) {
	shell.tryToInjectHomeLibPath()
	for(const pkg of requiredPackages) {
		if(!await shell.isPackageInstalled(pkg)) {
			console.warn(`Skipping test because package "${pkg}" is not installed (install it locally to get the tests to run).`)
			test.skip()
		}
	}
}

export async function ensureConfig(shell: RShell, test: Mocha.Context, userConfig?: Partial<TestConfiguration>): Promise<void> {
	const config = deepMergeObject(defaultTestConfiguration, userConfig)
	if(config.needsNetworkConnection) {
		await testRequiresNetworkConnection(test)
	}
	if(config.minRVersion !== undefined) {
		await testRequiresRVersion(shell, `>=${config.minRVersion}`, test)
	}
	if(config.needsPackages && config.needsPackages.length  > 0) {
		await testRequiresPackages(shell, config.needsPackages, test)
	}
}

/**
 * Comfort for {@link assertAst} to run the same test for multiple steps
 */
export function sameForSteps<T, S>(steps: S[], wanted: T): { step: S, wanted: T }[] {
	return steps.map(step => ({ step, wanted }))
}

/**
 * For a given input code this takes multiple ASTs depending on the respective normalizer step to run!
 *
 * @see sameForSteps
 */
export function assertAst(name: TestLabel | string, shell: RShell, input: string, expected: RExpressionList, userConfig?: Partial<TestConfiguration & {
	ignoreAdditionalTokens: boolean
}>): Mocha.Suite | Mocha.Test {
	const fullname = decorateLabelContext(name, ['desugar'])
	// the ternary operator is to support the legacy way I wrote these tests - by mirroring the input within the name
	return it(`${fullname} (input: ${input})`, async function() {
		await ensureConfig(shell, this, userConfig)

		const pipeline = new PipelineExecutor(DEFAULT_NORMALIZE_PIPELINE, {
			shell,
			request: requestFromInput(input)
		})
		const result = await pipeline.allRemainingSteps()
		const ast = result.normalize.ast

		assertAstEqualIgnoreSourceInformation(ast, expected, !userConfig?.ignoreAdditionalTokens,
			() => `got: ${JSON.stringify(ast)}, vs. expected: ${JSON.stringify(expected)}`)
	})
}

/** call within describeSession */
export function assertDecoratedAst<Decorated>(name: string, shell: RShell, input: string, expected: RNodeWithParent<Decorated>, userConfig?: Partial<TestConfiguration>, startIndexForDeterministicIds = 0): void {
	it(name, async function() {
		await ensureConfig(shell, this, userConfig)
		const result = await new PipelineExecutor(DEFAULT_NORMALIZE_PIPELINE, {
			getId:   deterministicCountingIdGenerator(startIndexForDeterministicIds),
			shell,
			request: requestFromInput(input),
		}).allRemainingSteps()

		const ast = result.normalize.ast

		assertAstEqualIgnoreSourceInformation(ast, expected, false, () => `got: ${JSON.stringify(ast)}, vs. expected: ${JSON.stringify(expected)}`)
	})
}

function mapProblematicNodesToIds(problematic: readonly ProblematicDiffInfo[] | undefined): Set<NodeId> | undefined {
	return problematic === undefined ? undefined : new Set(problematic.map(p => p.tag === 'vertex' ? p.id : `${p.from}->${p.to}`))
}

export function assertDataflow(
	name: string | TestLabel,
	shell: RShell,
	input: string,
	expected: DataflowGraph,
	userConfig?: Partial<TestConfiguration>,
	startIndexForDeterministicIds = 0
): void {
	const effectiveName = decorateLabelContext(name, ['dataflow'])
	it(`${effectiveName} (input: ${JSON.stringify(input)})`, async function() {
		await ensureConfig(shell, this, userConfig)

		const info = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
			shell,
			request: requestFromInput(input),
			getId:   deterministicCountingIdGenerator(startIndexForDeterministicIds)
		}).allRemainingSteps()

		const report: DataflowDifferenceReport = expected.equals(info.dataflow.graph, true, { left: 'expected', right: 'got' })
		// with the try catch the diff graph is not calculated if everything is fine
		try {
			guard(report.isEqual(), () => `report:\n * ${report.comments()?.join('\n * ') ?? ''}`)
		} catch(e) {
			const diff = diffGraphsToMermaidUrl(
				{ label: 'expected', graph: expected, mark: mapProblematicNodesToIds(report.problematic()) },
				{ label: 'got', graph: info.dataflow.graph, mark: mapProblematicNodesToIds(report.problematic()) },
				`%% ${input.replace(/\n/g, '\n%% ')}\n` + report.comments()?.map(n => `%% ${n}\n`).join('') ?? '' + '\n'
			)
			console.error('best-effort reconstruction:\n', printAsBuilder(info.dataflow.graph))

			console.error('diff:\n', diff)
			throw e
		}
	}).timeout('3min')
}


/** call within describeSession */
function printIdMapping(ids: NodeId[], map: AstIdMap): string {
	return ids.map(id => `${id}: ${JSON.stringify(map.get(id)?.lexeme)}`).join(', ')
}

/**
 * Please note, that this executes the reconstruction step separately, as it predefines the result of the slice with the given ids.
 */
export function assertReconstructed(name: string | TestLabel, shell: RShell, input: string, ids: NodeId | NodeId[], expected: string, userConfig?: Partial<TestConfiguration>, getId: IdGenerator<NoInfo> = deterministicCountingIdGenerator(0)): Mocha.Test {
	const selectedIds = Array.isArray(ids) ? ids : [ids]
	return it(decorateLabelContext(name, ['slice']), async function() {
		await ensureConfig(shell, this, userConfig)

		const result = await new PipelineExecutor(DEFAULT_NORMALIZE_PIPELINE, {
			getId:   getId,
			request: requestFromInput(input),
			shell
		}).allRemainingSteps()
		const reconstructed = NAIVE_RECONSTRUCT.processor({
			normalize: result.normalize,
			slice:     {
				decodedCriteria:   [],
				timesHitThreshold: 0,
				result:            new Set(selectedIds)
			}
		}, {})
		assert.strictEqual(reconstructed.code, expected,
			`got: ${reconstructed.code}, vs. expected: ${expected}, for input ${input} (ids ${JSON.stringify(ids)}:\n${[...result.normalize.idMap].map(i => `${i[0]}: '${i[1].lexeme}'`).join('\n')})`)
	})
}


export function assertSliced(name: string | TestLabel, shell: RShell, input: string, criteria: SlicingCriteria, expected: string, getId: IdGenerator<NoInfo> = deterministicCountingIdGenerator(0)): Mocha.Test {
	const fullname = decorateLabelContext(name, ['slice'])

	return it(`${JSON.stringify(criteria)} ${fullname}`, async function() {
		const result = await new PipelineExecutor(DEFAULT_RECONSTRUCT_PIPELINE,{
			getId,
			request:   requestFromInput(input),
			shell,
			criterion: criteria,
		}).allRemainingSteps()

		try {
			assert.strictEqual(
				result.reconstruct.code, expected,
				`got: ${result.reconstruct.code}, vs. expected: ${expected}, for input ${input} (slice for ${JSON.stringify(criteria)}: ${printIdMapping(result.slice.decodedCriteria.map(({ id }) => id), result.normalize.idMap)}), url: ${graphToMermaidUrl(result.dataflow.graph, true, result.slice.result)}`
			)
		} catch(e) {
			console.error(normalizedAstToMermaidUrl(result.normalize.ast))
			console.error(`got:\n${result.reconstruct.code}\nvs. expected:\n${expected}`)
			throw e
		}
	})
}
