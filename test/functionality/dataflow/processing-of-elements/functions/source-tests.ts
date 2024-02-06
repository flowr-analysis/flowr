import {assertDataflow, withShell} from '../../../_helper/shell'
import {setSourceProvider} from '../../../../../src/dataflow/internal/process/functions/source'
import {BuiltIn, DataflowGraph, EdgeType, initializeCleanEnvironments, requestProviderFromText} from '../../../../../src'
import {LocalScope} from '../../../../../src/dataflow/environments/scopes'
import {UnnamedArgumentPrefix} from '../../../../../src/dataflow/internal/process/functions/argument'
import {define} from '../../../../../src/dataflow/environments'

describe('source', withShell(shell => {
	const sources = {
		simple:     'N <- 9',
		recursive1: 'x <- 1\nsource("recursive2")',
		recursive2: 'cat(x)\nsource("recursive1")'
	}
	setSourceProvider(requestProviderFromText(sources))

	const envWithSimpleN = define(
		{nodeId: 'simple-0', scope: 'local', name: 'N', used: 'always', kind: 'variable', definedAt: 'simple-2' },
		LocalScope,
		initializeCleanEnvironments()
	)
	assertDataflow('simple source', shell, 'source("simple")\ncat(N)', new DataflowGraph()
		.addVertex({ tag: 'variable-definition', id: 'simple-0', name: 'N', scope: LocalScope })
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
		.addVertex({tag: 'use', id: '5', name: 'N', environment: envWithSimpleN})
		.addVertex({tag: 'use', id: '2', name: `${UnnamedArgumentPrefix}2`})
		.addVertex({tag: 'use', id: '6', name: `${UnnamedArgumentPrefix}6`, environment: envWithSimpleN})
		.addEdge('3', '2', EdgeType.Argument, 'always')
		.addEdge('3', BuiltIn, EdgeType.Reads, 'always')
		.addEdge('5', 'simple-0', EdgeType.Reads, 'always')
		.addEdge('6', '5', EdgeType.Reads, 'always')
		.addEdge('7', '6', EdgeType.Argument, 'always')
		.addEdge('7', BuiltIn, EdgeType.Reads, 'always')
	)

	const envWithLocalN = define(
		{nodeId: '4', scope: 'local', name: 'N', used: 'always', kind: 'variable', definedAt: '6' },
		LocalScope,
		initializeCleanEnvironments()
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
			environment: envWithLocalN,
			args:        [{
				nodeId: '9', name: `${UnnamedArgumentPrefix}9`, scope: LocalScope, used: 'always' }
			],
			when: 'always'
		})
		.addVertex({
			tag:         'function-call',
			name:        'cat',
			id:          '14',
			environment: envWithLocalN,
			args:        [{
				nodeId: '13', name: `${UnnamedArgumentPrefix}13`, scope: LocalScope, used: 'always' }
			],
			when: 'always'
		})
		.addVertex({ tag: 'variable-definition', id: 'simple-0', name: 'N', scope: LocalScope })
		.addVertex({ tag: 'variable-definition', id: '4', name: 'N', scope: LocalScope, environment: envWithSimpleN })
		.addVertex({tag: 'use', id: '2', name: `${UnnamedArgumentPrefix}2` })
		.addVertex({tag: 'use', id: '9', name: `${UnnamedArgumentPrefix}9`, environment: envWithLocalN })
		.addVertex({tag: 'use', id: '13', name: `${UnnamedArgumentPrefix}13`, environment: envWithLocalN })
		.addVertex({tag: 'use', id: '12', name: 'N', environment: envWithLocalN })
		.addEdge('3', '10', EdgeType.SameReadRead, 'always')
		.addEdge('3', '2', EdgeType.Argument, 'always')
		.addEdge('14', '13', EdgeType.Argument, 'always')
		.addEdge('10', '9', EdgeType.Argument, 'always')
		.addEdge('3', BuiltIn, EdgeType.Reads, 'always')
		.addEdge('10', BuiltIn, EdgeType.Reads, 'always')
		.addEdge('14', BuiltIn, EdgeType.Reads, 'always')
		.addEdge('13', '12', EdgeType.Reads, 'always')
		.addEdge('12', '4', EdgeType.Reads, 'always')
		.addEdge('4', 'simple-0', EdgeType.SameDefDef, 'always')
	)

	assertDataflow('conditional', shell, 'if (x) { source("simple") }\ncat(N)', new DataflowGraph()
		.addVertex({ tag: 'variable-definition', id: 'simple-0', name: 'N', scope: LocalScope })
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
			environment: envWithSimpleN,
			args:        [{
				nodeId: '9', name: `${UnnamedArgumentPrefix}9`, scope: LocalScope, used: 'always'
			}]
		})
		.addVertex({tag: 'use', id: '0', name: 'x', scope: LocalScope})
		.addVertex({tag: 'use', id: '8', name: 'N', environment: envWithSimpleN})
		.addVertex({tag: 'use', id: '3', name: `${UnnamedArgumentPrefix}3`})
		.addVertex({tag: 'use', id: '9', name: `${UnnamedArgumentPrefix}9`, environment: envWithSimpleN})
		.addEdge('4', '3', EdgeType.Argument, 'always')
		.addEdge('4', BuiltIn, EdgeType.Reads, 'maybe')
		.addEdge('8', 'simple-0', EdgeType.Reads, 'always')
		.addEdge('9', '8', EdgeType.Reads, 'always')
		.addEdge('10', '9', EdgeType.Argument, 'always')
		.addEdge('10', BuiltIn, EdgeType.Reads, 'always')
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
		.addVertex({tag: 'use', id: '2', name: `${UnnamedArgumentPrefix}2`})
		.addEdge('3', '2', EdgeType.Argument, 'always')
		.addEdge('3', BuiltIn, EdgeType.Reads, 'always')
	)

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
			id:          'recursive2-7',
			environment: envWithX,
			args:        [{
				nodeId: 'recursive2-6', name: `${UnnamedArgumentPrefix}recursive2-6`, scope: LocalScope, used: 'always' }
			],
			when: 'always'
		})
		.addVertex({
			tag:         'function-call',
			name:        'cat',
			id:          'recursive2-3',
			environment: envWithX,
			args:        [{
				nodeId: 'recursive2-2', name: `${UnnamedArgumentPrefix}recursive2-2`, scope: LocalScope, used: 'always' }
			],
			when: 'always'
		})
		.addVertex({ tag: 'variable-definition', id: '0', name: 'x', scope: LocalScope })
		.addVertex({tag: 'use', id: '5', name: `${UnnamedArgumentPrefix}5`, environment: envWithX })
		.addVertex({tag: 'use', id: 'recursive2-6', name: `${UnnamedArgumentPrefix}recursive2-6`, environment: envWithX })
		.addVertex({tag: 'use', id: 'recursive2-2', name: `${UnnamedArgumentPrefix}recursive2-2`, environment: envWithX })
		.addVertex({tag: 'use', id: 'recursive2-1', name: 'x', environment: envWithX })
		.addEdge('6', '5', EdgeType.Argument, 'always')
		.addEdge('6', BuiltIn, EdgeType.Reads, 'always')
		.addEdge('recursive2-3', BuiltIn, EdgeType.Reads, 'always')
		.addEdge('recursive2-3', 'recursive2-2', EdgeType.Argument, 'always')
		.addEdge('recursive2-2', 'recursive2-1', EdgeType.Reads, 'always')
		.addEdge('recursive2-1', '0', EdgeType.Reads, 'always')
		.addEdge('recursive2-7', 'recursive2-6', EdgeType.Argument, 'always')
		.addEdge('recursive2-7', BuiltIn, EdgeType.Reads, 'always')
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
		.addVertex({ tag: 'variable-definition', id: '0', name: 'x', scope: LocalScope })
		.addVertex({tag: 'use', id: '5', name: `${UnnamedArgumentPrefix}5`, environment: envWithX })
		.addVertex({tag: 'use', id: '4', name: 'x', environment: envWithX })
		.addEdge('6', '5', EdgeType.Argument, 'always')
		.addEdge('6', BuiltIn, EdgeType.Reads, 'always')
		.addEdge('5', '4', EdgeType.Reads, 'always')
		.addEdge('4', '0', EdgeType.Reads, 'always')
	)
}))
