import type { NodeId } from '../../../src/r-bridge'
import type { DataflowGraphEdgeAttribute as WhenUsed, FunctionArgument, IdentifierDefinition, REnvironmentInformation } from '../../../src/dataflow'
import { define, Environment, pushLocalEnvironment, type DataflowScopeName as RScope } from '../../../src/dataflow/environments'
import { GlobalScope, LocalScope } from '../../../src/dataflow/environments/scopes'
import { UnnamedArgumentPrefix } from '../../../src/dataflow/internal/process/functions/argument'

export function variable(name: string, definedAt: NodeId, nodeId: NodeId = '_0', scope: RScope = LocalScope, used: WhenUsed = 'always'): IdentifierDefinition {
	return { name, kind: 'variable', nodeId, definedAt, scope, used }
}

export function rFunction(name: string, definedAt: NodeId, nodeId: NodeId, scope: RScope = LocalScope, used: WhenUsed = 'always'): IdentifierDefinition {
	return { name, kind: 'function', definedAt, nodeId, scope, used }
}

export function parameter(name: string, definedAt: NodeId, nodeId: NodeId, scope: RScope = LocalScope, used: WhenUsed = 'always'): IdentifierDefinition {
	return { name, kind: 'parameter', definedAt, nodeId, scope, used }
}

export function argument(name: string, definedAt: NodeId, nodeId: NodeId, scope: RScope = LocalScope, used: WhenUsed = 'always'): IdentifierDefinition {
	return { name, kind: 'argument', definedAt, nodeId, scope, used }
}

/**
 * Provides a FunctionArgument to use with function call vertices.
 * @param nodeId - AST Node ID
 * @param name - optional; can be removed for unnamed arguments
 * @param scope - optional; default is LocalScope
 * @param used - optional; default is always
 */
export function argumentInCall(nodeId: NodeId, name?: string, scope: RScope = LocalScope, used: WhenUsed = 'always'): FunctionArgument {
	if(name === undefined) {
		return { nodeId, name: unnamedArgument(nodeId), scope, used }
	} else {
		return [name, { nodeId, name, scope, used }]
	}
}

export function unnamedArgument(id: NodeId) {
	return `${UnnamedArgumentPrefix}${id}`
}

/**
 * The constant global environment.
 */
export const globalEnvironment = () => new EnvironmentBuilder()

/**
 * EnvironmentBuilder extends REnvironmentInformation with builder pattern methods.
 */
export class EnvironmentBuilder implements REnvironmentInformation {
	/**
	 * Use global environment.
	 */
	current: Environment = new Environment(GlobalScope)
	/**
	 * Level is 0.
	 */
	level:   number = 0

	/**
	 * Adds definitions to the current environment.
	 * @param def - Definition to add.
	 */
	addDefinition(def: IdentifierDefinition) {
		return define(def, def.scope, this) as EnvironmentBuilder
	}

	/**
	 * Adds a new, local environment on the environment stack and returns it.
	 * @param definitions - Definitions to add to the local environment.
	 */
	addEnvironment(definitions: IdentifierDefinition[] = []): EnvironmentBuilder {
		let newEnvironment = pushLocalEnvironment(this) as EnvironmentBuilder
		for(const def of definitions) {
			newEnvironment = newEnvironment.addDefinition(def)
		}
		return newEnvironment
	}
}