import type { NodeId } from '../../../src/r-bridge'
import type { DataflowGraphEdgeAttribute, FunctionArgument, IdentifierDefinition } from '../../../src/dataflow'
import type { DataflowScopeName } from '../../../src/dataflow/environments'
import { LocalScope } from '../../../src/dataflow/environments/scopes'
import { UnnamedArgumentPrefix } from '../../../src/dataflow/internal/process/functions/argument'

export function variable(name: string, definedAt: NodeId, nodeId: NodeId = '_0', scope: DataflowScopeName = LocalScope, used: DataflowGraphEdgeAttribute = 'always'): IdentifierDefinition {
	return { name, kind: 'variable', nodeId, definedAt, scope, used }
}

/**
 * Provides a FunctionReference to use with function call vertices.
 * @param nodeId - AST Node ID
 * @param name - optional; can be removed for unnamed arguments
 * @param scope - optional; default is LocalScope
 * @param used - optional; default is always
 */
export function argument(nodeId: NodeId, name?: string, scope: DataflowScopeName = LocalScope, used: DataflowGraphEdgeAttribute = 'always'): FunctionArgument {
	if(name === undefined) {
		return { nodeId, name: unnamedArgument(nodeId), scope, used }
	} else {
		return [name, { nodeId, name, scope, used }]
	}
}

export function unnamedArgument(id: NodeId) {
	return `${UnnamedArgumentPrefix}${id}`
}