import type { NodeId } from '../../../src'
import type {
	DataflowGraphEdgeAttribute,
	FunctionArgument,
	IdentifierDefinition, REnvironmentInformation
	, Environment
} from '../../../src/dataflow'
import {
	initializeCleanEnvironments
} from '../../../src/dataflow'
import { UnnamedArgumentPrefix } from '../../../src/dataflow/internal/process/functions/argument'
import {
	appendEnvironment,
	define,
	popLocalEnvironment,
	pushLocalEnvironment
} from '../../../src/dataflow/environments'

export function variable(name: string, definedAt: NodeId): IdentifierDefinition {
	return { name, kind: 'variable', used: 'always', nodeId: '_0', definedAt }
}

/**
 * Provides a FunctionArgument to use with function call vertices.
 * @param nodeId - AST Node ID
 * @param name - optional; can be removed for unnamed arguments
 * @param options - optional allows to give further options
 */
export function argumentInCall(nodeId: NodeId, name?: string, options?: { used?: DataflowGraphEdgeAttribute }): FunctionArgument {
	const used = options?.used ?? 'always'
	if(name === undefined) {
		return { nodeId, name: unnamedArgument(nodeId), used }
	} else {
		return [name, { nodeId, name, used }]
	}
}

export function unnamedArgument(id: NodeId) {
	return `${UnnamedArgumentPrefix}${id}`
}

/**
 * The constant global environment with all pre-defined functions.
 */
export const defaultEnvironment = () => {
	const global = initializeCleanEnvironments()
	return new EnvironmentBuilder(global.current, 0)
}

/**
 * EnvironmentBuilder extends REnvironmentInformation with builder pattern methods.
 */
export class EnvironmentBuilder implements REnvironmentInformation {
	/**
	 * Use global environment.
	 */
	current: Environment
	/**
	 * Level is 0.
	 */
	level:   number

	constructor(env: Environment, level: number) {
		this.current = env
		this.level = level
	}

	/**
	 * Defines a new argument in the top environment.
	 * @param name - Argument name
	 * @param nodeId - AST Node ID of usage
	 * @param definedAt - AST Node Id of definition
	 * @param used - always (default) or optional
	 */
	defineArgument(name: string, nodeId: NodeId, definedAt: NodeId, used: DataflowGraphEdgeAttribute = 'always') {
		return this.defineEnv({ name, kind: 'argument', definedAt, nodeId, used })
	}

	/**
	 * Defines a new function in the top environment.
	 * @param name - Function name
	 * @param nodeId - AST Node ID of usage
	 * @param definedAt - AST Node Id of definition
	 * @param used - always (default) or optional
	 */
	defineFunction(name: string, nodeId: NodeId, definedAt: NodeId, used: DataflowGraphEdgeAttribute = 'always') {
		return this.defineEnv({ name, kind: 'function', definedAt, nodeId,  used })
	}

	/**
	 * Defines a new parameter in the top environment.
	 * @param name - Parameter name
	 * @param nodeId - AST Node ID of usage
	 * @param definedAt - AST Node Id of definition
	 * @param used - always (default) or optional
	 */
	defineParameter(name: string, nodeId: NodeId, definedAt: NodeId, used: DataflowGraphEdgeAttribute = 'always') {
		return this.defineEnv({ name, kind: 'parameter', definedAt, nodeId, used })
	}

	/**
	 * Defines a new parameter in the top environment.
	 * @param name - Variable name
	 * @param nodeId - AST Node Id of usage
	 * @param definedAt - AST Node ID of definition
	 * @param used - always (default) or optional
	 */
	defineVariable(name: string, nodeId: NodeId, definedAt: NodeId = nodeId, used: DataflowGraphEdgeAttribute = 'always') {
		return this.defineEnv({ name, kind: 'variable', definedAt, nodeId, used })
	}

	/**
	 * Adds definitions to the current environment.
	 * @param def - Definition to add.
	 * @param superAssignment - If true, the definition is treated as if defined by a super assignment.
	 */
	defineEnv(def: IdentifierDefinition, superAssignment = false) {
		const envWithDefinition = define(def, superAssignment, this)
		return new EnvironmentBuilder(envWithDefinition.current, envWithDefinition.level)
	}

	/**
	 * Adds a new, local environment on the environment stack and returns it.
	 * @param definitions - Definitions to add to the local environment.
	 */
	pushEnv(): EnvironmentBuilder {
		const newEnvironment = pushLocalEnvironment(this)
		return new EnvironmentBuilder(newEnvironment.current, newEnvironment.level)
	}

	/**
	 * Pops the last environment (must be local) from the environment stack.
	 */
	popEnv(): EnvironmentBuilder {
		const underlyingEnv = popLocalEnvironment(this)
		return new EnvironmentBuilder(underlyingEnv.current, underlyingEnv.level)
	}

	/**
	 * Appends the writes in other to the given environment
	 * (i.e. those _may_ happen).
	 * @param other - The next environment.
	 */
	appendWritesOf(other: REnvironmentInformation) {
		const appendedEnv = appendEnvironment(this, other)
		return new EnvironmentBuilder(appendedEnv.current, appendedEnv.level)
	}
}
