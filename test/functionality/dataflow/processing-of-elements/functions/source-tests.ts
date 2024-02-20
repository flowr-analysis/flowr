import {assertDataflow, withShell} from '../../../_helper/shell'
import {setSourceProvider} from '../../../../../src/dataflow/internal/process/functions/source'
import {BuiltIn, DataflowGraph, EdgeType, initializeCleanEnvironments, requestProviderFromFile, requestProviderFromText, sourcedDeterministicCountingIdGenerator} from '../../../../../src'
import {LocalScope} from '../../../../../src/dataflow/environments/scopes'
import {UnnamedArgumentPrefix} from '../../../../../src/dataflow/internal/process/functions/argument'
import {define} from '../../../../../src/dataflow/environments'

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
	assertDataflow('simple source', shell, 'source("simple")\ncat(N)', new DataflowGraph()
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
		.uses('5', 'N', 'always', envWithSimpleN)
		.uses('2', `${UnnamedArgumentPrefix}2`)
		.uses('6', `${UnnamedArgumentPrefix}6`, 'always', envWithSimpleN)
		.addEdge('3', '2', EdgeType.Argument, 'always')
		.reads('3', BuiltIn)
		.reads('5', 'simple-1:1-1:6-0')
		.reads('6', '5')
		.addEdge('7', '6', EdgeType.Argument, 'always')
		.reads('7', BuiltIn)
	)

	assertDataflow('multiple source', shell, 'source("simple")\nN <- 0\nsource("simple")\ncat(N)', new DataflowGraph()
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
		.addVertex({
			tag:         'variable-definition',
			id:          'simple-3:1-3:6-0',
			name:        'N',
			scope:       LocalScope,
			environment: define({nodeId: '4', scope: 'local', name: 'N', used: 'always', kind: 'variable', definedAt: '6' }, LocalScope, initializeCleanEnvironments())
		})
		.definesVariable('simple-1:1-1:6-0', 'N')
		.definesVariable('4', 'N', LocalScope, 'always', envWithSimpleN )
		.uses('2', `${UnnamedArgumentPrefix}2` )
		.addVertex({
			tag:         'use',
			id:          '9',
			name:        `${UnnamedArgumentPrefix}9`,
			environment: define({nodeId: '4', scope: 'local', name: 'N', used: 'always', kind: 'variable', definedAt: '6' }, LocalScope, initializeCleanEnvironments())
		})
		.addVertex({
			tag:         'use',
			id:          '13',
			name:        `${UnnamedArgumentPrefix}13`,
			environment: define({nodeId: 'simple-3:1-3:6-0', scope: 'local', name: 'N', used: 'always', kind: 'variable', definedAt: 'simple-3:1-3:6-2' }, LocalScope, initializeCleanEnvironments())
		})
		.uses(
			'12', 'N', 'always',
			 define({nodeId: 'simple-3:1-3:6-0', scope: 'local', name: 'N', used: 'always', kind: 'variable', definedAt: 'simple-3:1-3:6-2' }, LocalScope, initializeCleanEnvironments())
		)
		.addEdge('3', '10', EdgeType.SameReadRead, 'always')
		.addEdge('3', '2', EdgeType.Argument, 'always')
		.addEdge('14', '13', EdgeType.Argument, 'always')
		.addEdge('10', '9', EdgeType.Argument, 'always')
		.reads('3', BuiltIn)
		.reads('10', BuiltIn)
		.reads('14', BuiltIn)
		.reads('13', '12')
		.reads('12', 'simple-3:1-3:6-0')
		.addEdge('simple-3:1-3:6-0', '4', EdgeType.SameDefDef, 'always')
		.addEdge('4', 'simple-1:1-1:6-0', EdgeType.SameDefDef, 'always')
	)

	const envWithConditionalN = define(
		{nodeId: 'simple-1:10-1:15-0', scope: 'local', name: 'N', used: 'always', kind: 'variable', definedAt: 'simple-1:10-1:15-2' },
		LocalScope,
		initializeCleanEnvironments()
	)
	assertDataflow('conditional', shell, 'if (x) { source("simple") }\ncat(N)', new DataflowGraph()
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
		.uses('8', 'N', 'always', envWithConditionalN)
		.uses('3', `${UnnamedArgumentPrefix}3`)
		.uses('9', `${UnnamedArgumentPrefix}9`, 'always', envWithConditionalN)
		.addEdge('4', '3', EdgeType.Argument, 'always')
		.reads('4', BuiltIn, 'maybe')
		.reads('8', 'simple-1:10-1:15-0')
		.reads('9', '8')
		.addEdge('10', '9', EdgeType.Argument, 'always')
		.reads('10', BuiltIn)
	)

	// missing sources should just be ignored
	assertDataflow('missing source', shell, 'source("missing")', new DataflowGraph()
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
		.addEdge('3', '2', EdgeType.Argument, 'always')
		.reads('3', BuiltIn)
	)

	const recursive2Id = (id: number) => sourcedDeterministicCountingIdGenerator('recursive2', {start: {line: 2, column: 1}, end: {line: 2, column: 6}}, id)()
	const envWithX = define(
		{nodeId: '0', scope: 'local', name: 'x', used: 'always', kind: 'variable', definedAt: '2' },
		LocalScope,
		initializeCleanEnvironments()
	)
	assertDataflow('recursive source', shell, sources.recursive1, new DataflowGraph()
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
		.uses('5', `${UnnamedArgumentPrefix}5`, 'always', envWithX )
		.uses(recursive2Id(6), `${UnnamedArgumentPrefix}${recursive2Id(6)}`, 'always', envWithX )
		.uses(recursive2Id(2), `${UnnamedArgumentPrefix}${recursive2Id(2)}`, 'always', envWithX )
		.uses(recursive2Id(1), 'x', 'always', envWithX )
		.addEdge('6', '5', EdgeType.Argument, 'always')
		.reads('6', BuiltIn)
		.reads(recursive2Id(3), BuiltIn)
		.addEdge(recursive2Id(3), recursive2Id(2), EdgeType.Argument, 'always')
		.reads(recursive2Id(2), recursive2Id(1))
		.reads(recursive2Id(1), '0')
		.addEdge(recursive2Id(7), recursive2Id(6), EdgeType.Argument, 'always')
		.reads(recursive2Id(7), BuiltIn)
	)

	// we currently don't support (and ignore) source calls with non-constant arguments!
	assertDataflow('non-constant source', shell, 'x <- "recursive1"\nsource(x)', new DataflowGraph()
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
		.uses('5', `${UnnamedArgumentPrefix}5`, 'always', envWithX )
		.uses('4', 'x', 'always', envWithX )
		.addEdge('6', '5', EdgeType.Argument, 'always')
		.reads('6', BuiltIn)
		.reads('5', '4')
		.reads('4', '0')
	)
}))
