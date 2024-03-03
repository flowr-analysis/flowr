import { requestProviderFromFile, requestProviderFromText, sourcedDeterministicCountingIdGenerator } from '../../../../../src'
import { BuiltIn, define, initializeCleanEnvironments } from '../../../../../src/dataflow/environments'
import { setSourceProvider } from '../../../../../src/dataflow/internal/process/functions/call/built-in/source'
import { emptyGraph } from '../../../_helper/dataflowgraph-builder'
import { unnamedArgument } from '../../../_helper/environment-builder'
import { assertDataflow, withShell } from '../../../_helper/shell'

describe('source', withShell(shell => {
	// reset the source provider back to the default value after our tests
	after(() => setSourceProvider(requestProviderFromFile()))

	const sources = {
		simple:     'N <- 9',
		recursive1: 'x <- 1\nsource("recursive2")',
		recursive2: 'cat(x)\nsource("recursive1")'
	}
	setSourceProvider(requestProviderFromText(sources))

	const envWithSimpleN = define(
		{ nodeId: 'simple-1:1-1:6-0', name: 'N', used: 'always', kind: 'variable', definedAt: 'simple-1:1-1:6-2' },
		false,
		initializeCleanEnvironments()
	)
	assertDataflow('simple source', shell, 'source("simple")\ncat(N)', emptyGraph()
		.defineVariable('simple-1:1-1:6-0', 'N')
		.call('3', 'source', [{
			nodeId: '2', name: unnamedArgument('2'), used: 'always' }
		],
		{ environment: initializeCleanEnvironments() })
		.call('7', 'cat', [{
			nodeId: '6', name: unnamedArgument('6'), used: 'always'
		}],
		{ environment: envWithSimpleN })
		.use('5', 'N', { environment: envWithSimpleN })
		.use('2', unnamedArgument('2'))
		.use('6', unnamedArgument('6'), { environment: envWithSimpleN })
		.argument('3', '2')
		.reads('3', BuiltIn)
		.reads('5', 'simple-1:1-1:6-0')
		.reads('6', '5')
		.argument('7', '6')
		.reads('7', BuiltIn)
	)

	assertDataflow('multiple source', shell, 'source("simple")\nN <- 0\nsource("simple")\ncat(N)', emptyGraph()
		.call('3', 'source', [{
			nodeId: '2', name: unnamedArgument('2'), used: 'always' }
		],
		{ environment: initializeCleanEnvironments() })
		.call('10', 'source', [{
			nodeId: '9', name: unnamedArgument('9'), used: 'always' }
		],
		{ environment: define({ nodeId: '4', name: 'N', used: 'always', kind: 'variable', definedAt: '6' }, false, initializeCleanEnvironments()) })
		.call('14', 'cat', [{
			nodeId: '13', name: unnamedArgument('13'), used: 'always' }
		],
		{ environment: define({ nodeId: 'simple-3:1-3:6-0', name: 'N', used: 'always', kind: 'variable', definedAt: 'simple-3:1-3:6-2' }, false, initializeCleanEnvironments()) })
		.defineVariable('simple-3:1-3:6-0', 'N', { environment: define({ nodeId: '4', name: 'N', used: 'always', kind: 'variable', definedAt: '6' }, false, initializeCleanEnvironments()) }
		)
		.defineVariable('simple-1:1-1:6-0', 'N')
		.defineVariable('4', 'N', { environment: envWithSimpleN })
		.use('2', unnamedArgument('2'))
		.use('9', unnamedArgument('9'), { environment: define({ nodeId: '4', name: 'N', used: 'always', kind: 'variable', definedAt: '6' }, false, initializeCleanEnvironments()) })
		.use('13', unnamedArgument('13'), { environment: define({ nodeId: 'simple-3:1-3:6-0', name: 'N', used: 'always', kind: 'variable', definedAt: 'simple-3:1-3:6-2' }, false, initializeCleanEnvironments()) })
		.use('12', 'N', { environment: define({ nodeId: 'simple-3:1-3:6-0', name: 'N', used: 'always', kind: 'variable', definedAt: 'simple-3:1-3:6-2' }, false, initializeCleanEnvironments()) })
		.sameRead('3', '10')
		.argument('3', '2')
		.argument('14', '13')
		.argument('10', '9')
		.reads('3', BuiltIn)
		.reads('10', BuiltIn)
		.reads('14', BuiltIn)
		.reads('13', '12')
		.reads('12', 'simple-3:1-3:6-0')
		.sameDef('simple-3:1-3:6-0', '4')
		.sameDef('4', 'simple-1:1-1:6-0')
	)

	const envWithConditionalN = define(
		{ nodeId: 'simple-1:10-1:15-0', name: 'N', used: 'always', kind: 'variable', definedAt: 'simple-1:10-1:15-2' },
		false,
		initializeCleanEnvironments()
	)
	assertDataflow('conditional', shell, 'if (x) { source("simple") }\ncat(N)', emptyGraph()
		.defineVariable('simple-1:10-1:15-0', 'N')
		.call('4', 'source', [{
			nodeId: '3', name: unnamedArgument('3'), used: 'always' }
		],
		{ environment: initializeCleanEnvironments(), when: 'maybe' })
		.call('10', 'cat',[{
			nodeId: '9', name: unnamedArgument('9'), used: 'always'
		}],
		{ environment: envWithConditionalN })
		.use('0', 'x')
		.use('8', 'N', { environment: envWithConditionalN })
		.use('3', unnamedArgument('3'))
		.use('9', unnamedArgument('9'), { environment: envWithConditionalN })
		.argument('4', '3')
		.reads('4', BuiltIn, 'maybe')
		.reads('8', 'simple-1:10-1:15-0')
		.reads('9', '8')
		.argument('10', '9')
		.reads('10', BuiltIn)
	)

	// missing sources should just be ignored
	assertDataflow('missing source', shell, 'source("missing")', emptyGraph()
		.call('3', 'source',[{
			nodeId: '2', name: unnamedArgument('2'), used: 'always'
		}],
		{ environment: initializeCleanEnvironments() })
		.use('2', unnamedArgument('2'))
		.argument('3', '2')
		.reads('3', BuiltIn)
	)

	const recursive2Id = (id: number) => sourcedDeterministicCountingIdGenerator('recursive2', { start: { line: 2, column: 1 }, end: { line: 2, column: 6 } }, id)()
	const envWithX = define(
		{ nodeId: '0', name: 'x', used: 'always', kind: 'variable', definedAt: '2' },
		false,
		initializeCleanEnvironments()
	)
	assertDataflow('recursive source', shell, sources.recursive1, emptyGraph()
		.call('6', 'source', [{
			nodeId: '5', name: unnamedArgument('5'), used: 'always' }
		],
		{ environment: envWithX })
		.call(recursive2Id(7), 'source', [{
			nodeId: recursive2Id(6), name: unnamedArgument(recursive2Id(6)), used: 'always' }
		],
		{ environment: envWithX })
		.call(recursive2Id(3), 'cat', [{
			nodeId: recursive2Id(2), name: unnamedArgument(recursive2Id(2)), used: 'always' }
		],
		{ environment: envWithX })
		.defineVariable('0', 'x')
		.use('5', unnamedArgument('5'), { environment: envWithX })
		.use(recursive2Id(6), unnamedArgument(recursive2Id(6)), { environment: envWithX })
		.use(recursive2Id(2), unnamedArgument(recursive2Id(2)), { environment: envWithX })
		.use(recursive2Id(1), 'x', { environment: envWithX })
		.argument('6', '5')
		.reads('6', BuiltIn)
		.reads(recursive2Id(3), BuiltIn)
		.argument(recursive2Id(3), recursive2Id(2))
		.reads(recursive2Id(2), recursive2Id(1))
		.reads(recursive2Id(1), '0')
		.argument(recursive2Id(7), recursive2Id(6))
		.reads(recursive2Id(7), BuiltIn)
	)

	// we currently don't support (and ignore) source calls with non-constant arguments!
	assertDataflow('non-constant source', shell, 'x <- "recursive1"\nsource(x)', emptyGraph()
		.call('6', 'source',[{
			nodeId: '5', name: unnamedArgument('5'), used: 'always' }
		],
		{ environment: envWithX })
		.defineVariable('0', 'x')
		.use('5', unnamedArgument('5'), { environment: envWithX })
		.use('4', 'x', { environment: envWithX })
		.argument('6', '5')
		.reads('6', BuiltIn)
		.reads('5', '4')
		.reads('4', '0')
	)
}))
