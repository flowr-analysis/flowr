import type { NodeId } from '../../../src/r-bridge'
import type { IdentifierDefinition } from '../../../src/dataflow/v1'
import { LocalScope } from '../../../src/dataflow/common/environments/scopes'
import { UnnamedArgumentPrefix } from '../../../src/dataflow/v1/internal/process/functions/argument'

export function variable(name: string, definedAt: NodeId): IdentifierDefinition {
	return { name, kind: 'variable', scope: LocalScope, used: 'always', nodeId: '_0', definedAt }
}
export function unnamedArgument(id: NodeId) {
	return `${UnnamedArgumentPrefix}${id}`
}