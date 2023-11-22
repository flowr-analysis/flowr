import { NodeId } from '../../../../src/r-bridge'
import { IdentifierDefinition } from '../../../../src/dataflow'
import { LocalScope } from '../../../../src/dataflow/environments/scopes'
import { requireAllTestsInFolder } from '../../_helper/collect-tests'

export function variable(name: string, definedAt: NodeId): IdentifierDefinition {
	return { name, kind: 'variable', scope: LocalScope, used: 'always', nodeId: '_0', definedAt }
}

describe('Environments', () => {
	requireAllTestsInFolder(__dirname)
})
