import { it } from 'mocha'
import { testRequiresNetworkConnection } from './network'
import { DeepPartial } from 'ts-essentials'
import {
	decorateAst,
	DecoratedAstMap,
	deterministicCountingIdGenerator,
	getStoredTokenMap,
	IdGenerator,
	NodeId,
	NoInfo,
	retrieveAstFromRCode,
	RExpressionList,
	RNode,
	RNodeWithParent, RParseRequest,
	RShell,
	XmlParserHooks
} from '../../src/r-bridge'
import { assert } from 'chai'
import { DataflowGraph, diffGraphsToMermaidUrl, graphToMermaidUrl, produceDataFlowGraph } from '../../src/dataflow'
import { reconstructToCode, SlicingCriteria, slicingCriterionToId, staticSlicing } from '../../src/slicing'
import { LocalScope } from '../../src/dataflow/environments/scopes'
import { testRequiresRVersion } from './version'
import { deepMergeObject, MergeableRecord } from '../../src/util/objects'
import { retrieveResultOfStep, SteppingSlicer } from '../../src/core/slicer'

let defaultTokenMap: Record<string, string>

// we want the token map only once (to speed up tests)!
before(async function() {
	this.timeout('15min')
	const shell = new RShell()
	try {
		shell.tryToInjectHomeLibPath()
		await shell.ensurePackageInstalled('xmlparsedata')
		defaultTokenMap = await getStoredTokenMap(shell)
	} finally {
		shell.close()
	}
})

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
 * @param packages - packages to be ensured when the shell is created
 */
export function withShell(fn: (shell: RShell) => void, packages: string[] = ['xmlparsedata']): () => void {
	return function() {
		const shell = new RShell()
		// this way we probably do not have to reinstall even if we launch from WebStorm
		before(async function() {
			this.timeout('15min')
			shell.tryToInjectHomeLibPath()
			for (const pkg of packages) {
				if (!await shell.isPackageInstalled(pkg)) {
					await testRequiresNetworkConnection(this)
				}
				await shell.ensurePackageInstalled(pkg, true)
			}
		})
		fn(shell)
		after(() => {
			shell.close()
		})
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function removeSourceInformation<T extends Record<string, any>>(obj: T): T {
	return JSON.parse(JSON.stringify(obj, (key, value) => {
		if (key === 'fullRange' || key === 'additionalTokens' || key === 'fullLexeme') {
			return undefined
		}
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return value
	})) as T
}

function assertAstEqualIgnoreSourceInformation<Info>(ast: RNode<Info>, expected: RNode<Info>, message?: string): void {
	const astCopy = removeSourceInformation(ast)
	const expectedCopy = removeSourceInformation(expected)
	assert.deepStrictEqual(astCopy, expectedCopy, message)
}

function requestFromInput(input: `file://${string}` | string): RParseRequest {
	const file = input.startsWith('file://')
	return {
		request:                 file ? 'file' : 'text',
		content:                 file ? input.slice(7) : input,
		attachSourceInformation: true,
		ensurePackageInstalled:  false // should be called within describeSession for that!
	}
}

export const retrieveAst = async(shell: RShell, input: `file://${string}` | string, hooks?: DeepPartial<XmlParserHooks>): Promise<RExpressionList> => {
	const request = requestFromInput(input)
	return (await retrieveResultOfStep('normalize ast', {
		shell,
		request,
		tokenMap: defaultTokenMap,
		hooks
	}))['normalize ast']
}

export interface TestConfiguration extends MergeableRecord {
	/** the (inclusive) minimum version of R required to run this test, e.g., {@link MIN_VERSION_PIPE} */
	minRVersion:            string | undefined,
	needsNetworkConnection: boolean,
}

export const defaultTestConfiguration: TestConfiguration = {
	minRVersion:            undefined,
	needsNetworkConnection: false,
}

async function ensureConfig(shell: RShell, test: Mocha.Context, userConfig?: Partial<TestConfiguration>): Promise<void> {
	const config = deepMergeObject(defaultTestConfiguration, userConfig)
	if(config.needsNetworkConnection) {
		await testRequiresNetworkConnection(test)
	}
	if(config.minRVersion !== undefined) {
		await testRequiresRVersion(shell, `>=${config.minRVersion}`, test)
	}
}

/** call within describeSession */
export function assertAst(name: string, shell: RShell, input: string, expected: RExpressionList, userConfig?: Partial<TestConfiguration>): Mocha.Test {
	// the ternary operator is to support the legacy way I wrote these tests - by mirroring the input within the name
	return it(name === input ? name : `${name} (input: ${input})`, async function() {
		await ensureConfig(shell, this, userConfig)
		const ast = await retrieveAst(shell, input)
		assertAstEqualIgnoreSourceInformation(ast, expected, `got: ${JSON.stringify(ast)}, vs. expected: ${JSON.stringify(expected)}`)
	})
}

/** call within describeSession: TODO: remove the decorator and always use our decoration step */
export function assertDecoratedAst<Decorated>(name: string, shell: RShell, input: string, decorator: (input: RNode) => RNode<Decorated>, expected: RNodeWithParent<Decorated>, userConfig?: Partial<TestConfiguration>): void {
	it(name, async function() {
		await ensureConfig(shell, this, userConfig)
		const baseAst = await retrieveAst(shell, input)
		const ast = decorator(baseAst)
		assertAstEqualIgnoreSourceInformation(ast, expected, `got: ${JSON.stringify(ast)}, vs. expected: ${JSON.stringify(expected)} (baseAst before decoration: ${JSON.stringify(baseAst)})`)
	})
}

// TODO: make generics more readable
export function assertDataflow(name: string, shell: RShell, input: string, expected: DataflowGraph, userConfig?: Partial<TestConfiguration>, startIndexForDeterministicIds = 0): void {
	it(`${name} (input: ${JSON.stringify(input)})`, async function() {
		await ensureConfig(shell, this, userConfig)

		const info = await new SteppingSlicer({
			stepOfInterest: 'dataflow',
			request:        requestFromInput(input),
			shell,
			tokenMap:       defaultTokenMap,
			getId:          deterministicCountingIdGenerator(startIndexForDeterministicIds),
		}).allRemainingSteps()

		// with the try catch the diff graph is not calculated if everything is fine
		try {
			assert.isTrue(expected.equals(info.dataflow.graph))
		} catch (e) {
			const diff = diffGraphsToMermaidUrl(
				{ label: 'expected', graph: expected },
				{ label: 'got', graph: info.dataflow.graph},
				info.decorate.idMap,
				`%% ${input.replace(/\n/g, '\n%% ')}\n`
			)
			console.error('diff:\n', diff)
			throw e
		}
	})
}


/** call within describeSession */
function printIdMapping(ids: NodeId[], map: DecoratedAstMap): string {
	return ids.map(id => `${id}: ${JSON.stringify(map.get(id)?.lexeme)}`).join(', ')
}
export function assertReconstructed(name: string, shell: RShell, input: string, ids: NodeId | NodeId[], expected: string, userConfig?: Partial<TestConfiguration>, getId: IdGenerator<NoInfo> = deterministicCountingIdGenerator(0)): Mocha.Test {
	const selectedIds = Array.isArray(ids) ? ids : [ids]
	return it(name, async function() {
		await ensureConfig(shell, this, userConfig)

		const ast = await retrieveAst(shell, input)
		const decoratedAst = decorateAst(ast, getId)
		const reconstructed = reconstructToCode<NoInfo>(decoratedAst, new Set(selectedIds))
		assert.strictEqual(reconstructed.code, expected, `got: ${reconstructed.code}, vs. expected: ${expected}, for input ${input} (ids: ${printIdMapping(selectedIds, decoratedAst.idMap)})`)
	})
}


export function assertSliced(name: string, shell: RShell, input: string, criteria: SlicingCriteria, expected: string, getId: IdGenerator<NoInfo> = deterministicCountingIdGenerator(0)): Mocha.Test {
	return it(`${JSON.stringify(criteria)} ${name}`, async function() {
		const ast = await retrieveAst(shell, input)
		const decoratedAst = decorateAst(ast, getId)

		const dataflow = produceDataFlowGraph(decoratedAst)

		try {
			const mappedIds = criteria.map(c => slicingCriterionToId(c, decoratedAst))

			const { result: sliced } = staticSlicing(dataflow.graph, decoratedAst.idMap, mappedIds.slice())
			const reconstructed = reconstructToCode<NoInfo>(decoratedAst, sliced)

			assert.strictEqual(reconstructed.code, expected, `got: ${reconstructed.code}, vs. expected: ${expected}, for input ${input} (slice: ${printIdMapping(mappedIds, decoratedAst.idMap)}), url: ${graphToMermaidUrl(dataflow.graph, decoratedAst.idMap, sliced)}`)
		} catch (e) {
			console.error('vis-got:\n', graphToMermaidUrl(dataflow.graph, decoratedAst.idMap))
			throw e
		}
	})
}

