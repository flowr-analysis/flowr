import { NodeId } from '../../../src/r-bridge'
import { IdentifierDefinition } from '../../../src/dataflow/v1'
import { LocalScope } from '../../../src/dataflow/common/environments/scopes'

export function variable(name: string, definedAt: NodeId): IdentifierDefinition {
	return { name, kind: 'variable', scope: LocalScope, used: 'always', nodeId: '_0', definedAt }
}
