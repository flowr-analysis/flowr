import {assertDataflow, withShell} from '../../../_helper/shell'
import {setSourceProvider} from '../../../../../src/dataflow/internal/process/functions/source'
import {BuiltIn, initializeCleanEnvironments, requestProviderFromFile, requestProviderFromText, sourcedDeterministicCountingIdGenerator} from '../../../../../src'
import {LocalScope} from '../../../../../src/dataflow/environments/scopes'
import {UnnamedArgumentPrefix} from '../../../../../src/dataflow/internal/process/functions/argument'
import {define} from '../../../../../src/dataflow/environments'
import { emptyGraph } from '../../../_helper/dataflowgraph-builder'

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
		{nodeId: 'simple-1:1-1:6-0', scope: 'local', name: 'N', used: 'always', kind: 'variable', definedAt: 'simple-1:1-1:6-2' },
		LocalScope,
		initializeCleanEnvironments()
	)
	assertDataflow('simple source', shell, 'source("simple")\ncat(N)', emptyGraph()
		.definesVariable('simple-1:1-1:6-0', 'N')
		.addVertex({
			tag:         'function-call',
			name:        'source',
			id:          '3',
			environment: initializeCleanEnvironments(),
			args:        [{
				nodeId: '2', name: `${UnnamedArgumentPrefix}2`, scope: LocalScope, used: 'always' }
			]
		})
		.addVertex({
			tag:         'function-call',
			name:        'cat',
			id:          '7',
			environment: envWithSimpleN,
			args:        [{
				nodeId: '6', name: `${UnnamedArgumentPrefix}6`, scope: LocalScope, used: 'always'
			}]
		})
		.uses('5', 'N', {environment: envWithSimpleN})
		.uses('2', `${UnnamedArgumentPrefix}2`)
		.uses('6', `${UnnamedArgumentPrefix}6`, {environment: envWithSimpleN})
		.argument('3', '2')
		.reads('3', BuiltIn)
		.reads('5', 'simple-1:1-1:6-0')
		.reads('6', '5')
		.argument('7', '6')
		.reads('7', BuiltIn)
	)

	assertDataflow('multiple source', shell, 'source("simple")\nN <- 0\nsource("simple")\ncat(N)', emptyGraph()
		.addVertex({
			tag:         'function-call',
			name:        'source',
			id:          '3',
			environment: initializeCleanEnvironments(),
			args:        [{
				nodeId: '2', name: `${UnnamedArgumentPrefix}2`, scope: LocalScope, used: 'always' }
			],
			when: 'always'
		})
		.addVertex({
			tag:         'function-call',
			name:        'source',
			id:          '10',
			environment: define({nodeId: '4', scope: 'local', name: 'N', used: 'always', kind: 'variable', definedAt: '6' }, LocalScope, initializeCleanEnvironments()),
			args:        [{
				nodeId: '9', name: `${UnnamedArgumentPrefix}9`, scope: LocalScope, used: 'always' }
			],
			when: 'always'
		})
		.addVertex({
			tag:         'function-call',
			name:        'cat',
			id:          '14',
			environment: define({nodeId: 'simple-3:1-3:6-0', scope: 'local', name: 'N', used: 'always', kind: 'variable', definedAt: 'simple-3:1-3:6-2' }, LocalScope, initializeCleanEnvironments()),
			args:        [{
				nodeId: '13', name: `${UnnamedArgumentPrefix}13`, scope: LocalScope, used: 'always' }
			],
			when: 'always'
		})
		.definesVariable('simple-3:1-3:6-0', 'N', LocalScope,
			{environment: define({nodeId: '4', scope: 'local', name: 'N', used: 'always', kind: 'variable', definedAt: '6'}, LocalScope, initializeCleanEnvironments())}
		)
		.definesVariable('simple-1:1-1:6-0', 'N')
		.definesVariable('4', 'N', LocalScope, {environment: envWithSimpleN})
		.uses('2', `${UnnamedArgumentPrefix}2`)
		.uses('9', `${UnnamedArgumentPrefix}9`, {environment: define({nodeId: '4', scope: 'local', name: 'N', used: 'always', kind: 'variable', definedAt: '6' }, LocalScope, initializeCleanEnvironments())})
		.uses('13', `${UnnamedArgumentPrefix}13`, {environment: define({nodeId: 'simple-3:1-3:6-0', scope: 'local', name: 'N', used: 'always', kind: 'variable', definedAt: 'simple-3:1-3:6-2' }, LocalScope, initializeCleanEnvironments())})
		.uses('12', 'N', {environment: define({nodeId: 'simple-3:1-3:6-0', scope: 'local', name: 'N', used: 'always', kind: 'variable', definedAt: 'simple-3:1-3:6-2' }, LocalScope, initializeCleanEnvironments())})
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
		{nodeId: 'simple-1:10-1:15-0', scope: 'local', name: 'N', used: 'always', kind: 'variable', definedAt: 'simple-1:10-1:15-2' },
		LocalScope,
		initializeCleanEnvironments()
	)
	assertDataflow('conditional', shell, 'if (x) { source("simple") }\ncat(N)', emptyGraph()
		.definesVariable('simple-1:10-1:15-0', 'N')
		.addVertex({
			tag:         'function-call',
			name:        'source',
			id:          '4',
			environment: initializeCleanEnvironments(),
			args:        [{
				nodeId: '3', name: `${UnnamedArgumentPrefix}3`, scope: LocalScope, used: 'always' }
			],
			when: 'maybe'
		})
		.addVertex({
			tag:         'function-call',
			name:        'cat',
			id:          '10',
			environment: envWithConditionalN,
			args:        [{
				nodeId: '9', name: `${UnnamedArgumentPrefix}9`, scope: LocalScope, used: 'always'
			}]
		})
		.uses('0', 'x')
		.uses('8', 'N', {environment: envWithConditionalN})
		.uses('3', `${UnnamedArgumentPrefix}3`)
		.uses('9', `${UnnamedArgumentPrefix}9`, {environment: envWithConditionalN})
		.argument('4', '3')
		.reads('4', BuiltIn, 'maybe')
		.reads('8', 'simple-1:10-1:15-0')
		.reads('9', '8')
		.argument('10', '9')
		.reads('10', BuiltIn)
	)

	// missing sources should just be ignored
	assertDataflow('missing source', shell, 'source("missing")', emptyGraph()
		.addVertex({
			tag:         'function-call',
			name:        'source',
			id:          '3',
			environment: initializeCleanEnvironments(),
			args:        [{
				nodeId: '2', name: `${UnnamedArgumentPrefix}2`, scope: LocalScope, used: 'always'
			}]
		})
		.uses('2', `${UnnamedArgumentPrefix}2`)
		.argument('3', '2')
		.reads('3', BuiltIn)
	)

	const recursive2Id = (id: number) => sourcedDeterministicCountingIdGenerator('recursive2', {start: {line: 2, column: 1}, end: {line: 2, column: 6}}, id)()
	const envWithX = define(
		{nodeId: '0', scope: 'local', name: 'x', used: 'always', kind: 'variable', definedAt: '2' },
		LocalScope,
		initializeCleanEnvironments()
	)
	assertDataflow('recursive source', shell, sources.recursive1, emptyGraph()
		.addVertex({
			tag:         'function-call',
			name:        'source',
			id:          '6',
			environment: envWithX,
			args:        [{
				nodeId: '5', name: `${UnnamedArgumentPrefix}5`, scope: LocalScope, used: 'always' }
			],
			when: 'always'
		})
		.addVertex({
			tag:         'function-call',
			name:        'source',
			id:          recursive2Id(7),
			environment: envWithX,
			args:        [{
				nodeId: recursive2Id(6), name: `${UnnamedArgumentPrefix}${recursive2Id(6)}`, scope: LocalScope, used: 'always' }
			],
			when: 'always'
		})
		.addVertex({
			tag:         'function-call',
			name:        'cat',
			id:          recursive2Id(3),
			environment: envWithX,
			args:        [{
				nodeId: recursive2Id(2), name: `${UnnamedArgumentPrefix}${recursive2Id(2)}`, scope: LocalScope, used: 'always' }
			],
			when: 'always'
		})
		.definesVariable('0', 'x')
		.uses('5', `${UnnamedArgumentPrefix}5`, {environment: envWithX})
		.uses(recursive2Id(6), `${UnnamedArgumentPrefix}${recursive2Id(6)}`, {environment: envWithX})
		.uses(recursive2Id(2), `${UnnamedArgumentPrefix}${recursive2Id(2)}`, {environment: envWithX})
		.uses(recursive2Id(1), 'x', {environment: envWithX})
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
		.addVertex({
			tag:         'function-call',
			name:        'source',
			id:          '6',
			environment: envWithX,
			args:        [{
				nodeId: '5', name: `${UnnamedArgumentPrefix}5`, scope: LocalScope, used: 'always' }
			],
			when: 'always'
		})
		.definesVariable('0', 'x')
		.uses('5', `${UnnamedArgumentPrefix}5`, {environment: envWithX})
		.uses('4', 'x', {environment: envWithX})
		.argument('6', '5')
		.reads('6', BuiltIn)
		.reads('5', '4')
		.reads('4', '0')
	)
}))
