import {
	type NodeId,
	normalizeIdToNumberIfPossible
} from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { type IdentifierDefinition, ReferenceType } from '../../../../src/dataflow/environments/identifier';
import type { FunctionArgument } from '../../../../src/dataflow/graph/graph';
import {
	type Environment,
	type IEnvironment,
	type REnvironmentInformation
} from '../../../../src/dataflow/environments/environment';
import { define } from '../../../../src/dataflow/environments/define';
import { popLocalEnvironment, pushLocalEnvironment } from '../../../../src/dataflow/environments/scoping';
import type { ControlDependency } from '../../../../src/dataflow/info';
import { defaultConfigOptions } from '../../../../src/config';
import { appendEnvironment } from '../../../../src/dataflow/environments/append';
import { FlowrAnalyzerEnvironmentContext } from '../../../../src/project/context/flowr-analyzer-environment-context';
import type { FlowrAnalyzerContext } from '../../../../src/project/context/flowr-analyzer-context';


/**
 *
 */
export function variable(name: string, definedAt: NodeId): IdentifierDefinition {
	return { name, type: ReferenceType.Variable, nodeId: '_0', definedAt, cds: undefined };
}


/**
 *
 */
export function asFunction(name: string, definedAt: NodeId): IdentifierDefinition {
	return { name, type: ReferenceType.Function, nodeId: '_0', definedAt, cds: undefined };
}

/**
 * Provides a FunctionArgument to use with function call vertices.
 * @param nodeId - AST Node ID
 * @param options - optional allows to give further options
 */
export function argumentInCall(nodeId: NodeId, options?: { name?: string, cds?: ControlDependency[] }): FunctionArgument {
	return { nodeId: normalizeIdToNumberIfPossible(nodeId), type: ReferenceType.Argument, name: options?.name, cds: options?.cds?.map(c => ({ ...c, id: normalizeIdToNumberIfPossible(c.id) })) };
}
/**
 * The constant global environment with all pre-defined functions.
 */
export const defaultEnv = () => {
	const ctx = new FlowrAnalyzerEnvironmentContext({ config: defaultConfigOptions } as FlowrAnalyzerContext);
	const global = ctx.makeCleanEnv();
	return new EnvironmentBuilder(global.current, global.current.parent, 0);
};

/**
 * EnvironmentBuilder extends REnvironmentInformation with builder pattern methods.
 */
export class EnvironmentBuilder implements REnvironmentInformation {
	/**
	 * Use global environment.
	 */
	current: Environment;
	/**
	 * Level is 0.
	 */
	level:   number;

	private readonly builtInEnv: IEnvironment;

	constructor(env: Environment, builtInEnvironment: IEnvironment, level: number) {
		this.current = env;
		this.level = level;
		this.builtInEnv = builtInEnvironment;
	}

	/**
	 * Defines a new argument in the current environment.
	 * @param name - Argument name
	 * @param nodeId - AST Node ID of usage
	 * @param definedAt - AST Node ID of definition
	 * @param cds - Control dependencies
	 */
	defineArgument(name: string, nodeId: NodeId, definedAt: NodeId, cds: ControlDependency[] | undefined = undefined) {
		return this.defineInEnv({
			type: ReferenceType.Argument,
			name,
			definedAt,
			nodeId,
			cds });
	}

	/**
	 * Defines a new function in the current environment.
	 * @param name - Function name
	 * @param nodeId - AST Node ID of usage
	 * @param definedAt - AST Node ID of definition
	 * @param cds - Control dependencies
	 */
	defineFunction(name: string, nodeId: NodeId, definedAt: NodeId, cds: ControlDependency[] | undefined = undefined) {
		return this.defineInEnv({
			type: ReferenceType.Function,
			name,
			definedAt,
			nodeId,
			cds
		});
	}

	/**
	 * Defines a new parameter in the current environment.
	 * @param name - Parameter name
	 * @param nodeId - AST Node ID of usage
	 * @param definedAt - AST Node ID of definition
	 * @param cds - Control dependencies
	 */
	defineParameter(name: string, nodeId: NodeId, definedAt: NodeId, cds: ControlDependency[] | undefined = undefined) {
		return this.defineInEnv({
			type: ReferenceType.Parameter,
			name,
			definedAt,
			nodeId,
			cds
		});
	}

	/**
	 * Defines a new variable in the current environment.
	 * @param name - Variable name
	 * @param nodeId - AST Node ID of usage
	 * @param definedAt - AST Node ID of definition
	 * @param cds - Control dependencies
	 */
	defineVariable(name: string, nodeId: NodeId, definedAt: NodeId = nodeId, cds: ControlDependency[] | undefined = undefined) {
		return this.defineInEnv({
			type: ReferenceType.Variable,
			name,
			definedAt,
			nodeId,
			cds
		});
	}

	/**
	 * Adds definitions to the current environment.
	 * @param def - Definition to add.
	 * @param superAssignment - If true, the definition is treated as if defined by a super assignment.
	 */
	defineInEnv(def: IdentifierDefinition, superAssignment = false) {
		const envWithDefinition = define({
			...def,
			definedAt: normalizeIdToNumberIfPossible(def.definedAt),
			nodeId:    normalizeIdToNumberIfPossible(def.nodeId),
			cds:       def.cds?.map(c => ({ ...c, id: normalizeIdToNumberIfPossible(c.id) }))
		} as IdentifierDefinition & { name: string }, superAssignment, this);
		return new EnvironmentBuilder(envWithDefinition.current, this.builtInEnv, envWithDefinition.level);
	}

	/**
	 * Adds a new, local environment on the environment stack and returns it.
	 */
	pushEnv(): EnvironmentBuilder {
		const newEnvironment = pushLocalEnvironment(this);
		return new EnvironmentBuilder(newEnvironment.current, this.builtInEnv, newEnvironment.level);
	}

	/**
	 * Pops the last environment (must be local) from the environment stack.
	 */
	popEnv(): EnvironmentBuilder {
		const underlyingEnv = popLocalEnvironment(this);
		return new EnvironmentBuilder(underlyingEnv.current, this.builtInEnv, underlyingEnv.level);
	}

	/**
	 * Appends the `writes` in other to the given environment
	 * (i.e., those _may_ happen).
	 * @param other - The next environment.
	 */
	appendWritesOf(other: REnvironmentInformation) {
		const appendedEnv = appendEnvironment(this, other);
		return new EnvironmentBuilder(appendedEnv.current, this.builtInEnv, appendedEnv.level);
	}
}
