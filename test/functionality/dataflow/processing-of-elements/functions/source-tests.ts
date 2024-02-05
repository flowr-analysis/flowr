import {assertDataflow, withShell} from '../../../_helper/shell'
import {setSourceProvider} from '../../../../../src/dataflow/internal/process/functions/source'
import {BuiltIn, DataflowGraph, EdgeType, initializeCleanEnvironments, requestProviderFromText} from '../../../../../src'
import {LocalScope} from '../../../../../src/dataflow/environments/scopes'
import {UnnamedArgumentPrefix} from '../../../../../src/dataflow/internal/process/functions/argument'
import {define} from '../../../../../src/dataflow/environments'

describe('source', withShell(shell => {
	setSourceProvider(requestProviderFromText({
		simple: 'N <- 9'
	}))

	const envWithN = define(
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
			]})
		.addVertex({
			tag:         'function-call',
			name:        'cat',
			id:          '7',
			environment: envWithN,
			args:        [{
				nodeId: '6', name: `${UnnamedArgumentPrefix}6`, scope: LocalScope, used: 'always'
			}]
		})
		.addVertex({tag: 'use', id: '5', name: 'N', environment: envWithN})
		.addVertex({tag: 'use', id: '2', name: `${UnnamedArgumentPrefix}2`})
		.addVertex({tag: 'use', id: '6', name: `${UnnamedArgumentPrefix}6`, environment: envWithN})
		.addEdge('3', '2', EdgeType.Argument, 'always')
		.addEdge('3', BuiltIn, EdgeType.Reads, 'always')
		.addEdge('5', 'simple-0', EdgeType.Reads, 'always')
		.addEdge('6', '5', EdgeType.Reads, 'always')
		.addEdge('7', '6', EdgeType.Argument, 'always')
		.addEdge('7', BuiltIn, EdgeType.Reads, 'always')
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
			environment: envWithN,
			args:        [{
				nodeId: '9', name: `${UnnamedArgumentPrefix}9`, scope: LocalScope, used: 'always'
			}]
		})
		.addVertex({tag: 'use', id: '0', name: 'x', scope: LocalScope})
		.addVertex({tag: 'use', id: '8', name: 'N', environment: envWithN})
		.addVertex({tag: 'use', id: '3', name: `${UnnamedArgumentPrefix}3`})
		.addVertex({tag: 'use', id: '9', name: `${UnnamedArgumentPrefix}9`, environment: envWithN})
		.addEdge('4', '3', EdgeType.Argument, 'always')
		.addEdge('4', BuiltIn, EdgeType.Reads, 'maybe')
		.addEdge('8', 'simple-0', EdgeType.Reads, 'always')
		.addEdge('9', '8', EdgeType.Reads, 'always')
		.addEdge('10', '9', EdgeType.Argument, 'always')
		.addEdge('10', BuiltIn, EdgeType.Reads, 'always'))
}))
