import type { NodeId } from '../../../src'
import type { IdentifierDefinition } from '../../../src/dataflow'
import { UnnamedArgumentPrefix } from '../../../src/dataflow/internal/process/functions/argument'

export function variable(name: string, definedAt: NodeId): IdentifierDefinition {
	return { name, kind: 'variable', used: 'always', nodeId: '_0', definedAt }
}
export function unnamedArgument(id: NodeId) {
	return `${UnnamedArgumentPrefix}${id}`
}
