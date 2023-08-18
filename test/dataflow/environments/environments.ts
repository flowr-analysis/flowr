import { NodeId } from '../../../src/r-bridge'
import { IdentifierDefinition, LocalScope } from '../../../src/dataflow'

export function variable(name: string, definedAt: NodeId): IdentifierDefinition {
	return { name, kind: 'variable', scope: LocalScope, used: 'always', nodeId: '_0', definedAt }
}

describe('Environments', () => {
	require('./initialization')

	require('./modification')
	require('./resolve')
})
