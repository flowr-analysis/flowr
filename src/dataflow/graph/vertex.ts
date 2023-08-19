import { MergeableRecord } from '../../util/objects'
import { NodeId } from '../../r-bridge'
import { REnvironmentInformation } from '../environments'
import { DataflowGraphEdgeAttribute } from './edge'
import { DataflowFunctionFlowInformation, DataflowScopeName, FunctionArgument } from './graph'

/**
 * Arguments required to construct a node in the dataflow graph.
 *
 * @see DataflowGraphNodeUse
 * @see DataflowGraphNodeVariableDefinition
 * @see DataflowGraphNodeFunctionDefinition
 */
interface DataflowGraphNodeBase extends MergeableRecord {
	/**
	 * Used to identify and separate different types of nodes.
	 */
	readonly tag: string
	/**
	 * The id of the node (the id assigned by the {@link ParentInformation} decoration)
	 */
	id:           NodeId
	/**
	 * The name of the node, usually the variable name
	 */
	name:         string
	/**
	 * The environment in which the node is defined.
	 * If you do not provide an explicit environment, this will use the same clean one (with {@link initializeCleanEnvironments}).
	 */
	environment?: REnvironmentInformation
	/**
	 * Is this node part of every local execution trace or only in some.
	 * If you do not provide an explicit value, this will default to `always`.
	 */
	when?:        DataflowGraphEdgeAttribute
}

/**
 * Arguments required to construct a node which represents the usage of a variable in the dataflow graph.
 */
export interface DataflowGraphExitPoint extends DataflowGraphNodeBase {
	readonly tag: 'exit-point'
}

/**
 * Arguments required to construct a node which represents the usage of a variable in the dataflow graph.
 */
export interface DataflowGraphNodeUse extends DataflowGraphNodeBase {
	readonly tag: 'use'
}

/**
 * Arguments required to construct a node which represents the usage of a variable in the dataflow graph.
 */
export interface DataflowGraphNodeFunctionCall extends DataflowGraphNodeBase {
	readonly tag: 'function-call'
	args:         FunctionArgument[]
}

/**
 * Arguments required to construct a node which represents the definition of a variable in the dataflow graph.
 */
export interface DataflowGraphNodeVariableDefinition extends DataflowGraphNodeBase {
	readonly tag: 'variable-definition'
	/**
	 * The scope in which the node is defined  (can be global or local to the current environment).
	 */
	scope:        DataflowScopeName
}

export interface DataflowGraphNodeFunctionDefinition extends DataflowGraphNodeBase {
	readonly tag: 'function-definition'
	/**
	 * The scope in which the node is defined  (can be global or local to the current environment).
	 */
	scope:        DataflowScopeName
	/**
	 * The static subflow of the function definition, constructed within {@link processFunctionDefinition}.
	 * If the node is (for example) a function, it can have a subgraph which is used as a template for each call.
	 */
	subflow:      DataflowFunctionFlowInformation
	/**
	 * All exist points of the function definitions.
	 * In other words: last expressions/return calls
	 */
	exitPoints:   NodeId[]
}

export type DataflowGraphNodeArgument = DataflowGraphNodeUse | DataflowGraphExitPoint | DataflowGraphNodeVariableDefinition | DataflowGraphNodeFunctionDefinition | DataflowGraphNodeFunctionCall
export type DataflowGraphNodeInfo = Required<DataflowGraphNodeArgument>
