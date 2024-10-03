import type { MergeableRecord } from '../../util/objects';
import type { DataflowFunctionFlowInformation, FunctionArgument } from './graph';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { REnvironmentInformation } from '../environments/environment';
import type { ControlDependency } from '../info';

export type DataflowGraphVertices<Vertex extends DataflowGraphVertexInfo = DataflowGraphVertexInfo> = Map<NodeId, Vertex>


export enum VertexType {
	Value              = 'value',
	Use                = 'use',
	FunctionCall       = 'function-call',
	VariableDefinition = 'variable-definition',
	FunctionDefinition = 'function-definition'
}

/**
 * Arguments required to construct a vertex in the dataflow graph.
 *
 * @see DataflowGraphVertexUse
 * @see DataflowGraphVertexVariableDefinition
 * @see DataflowGraphVertexFunctionDefinition
 */
interface DataflowGraphVertexBase extends MergeableRecord {
	/**
	 * Used to identify and separate different types of vertices.
	 */
	readonly tag:        VertexType
	/**
	 * The id of the node (the id assigned by the {@link ParentInformation} decoration)
	 */
	id:                  NodeId
	/**
	 * The environment in which the vertex is set.
	 */
	environment?:        REnvironmentInformation | undefined
	/**
	 * See {@link IdentifierReference}
	 */
	controlDependencies: ControlDependency[] | undefined
}

/**
 * Marker vertex for a value in the dataflow of the program.
 */
export interface DataflowGraphVertexValue extends DataflowGraphVertexBase {
	readonly tag:          VertexType.Value
	/* currently without containing the 'real' value as it is part of the normalized AST as well */
	readonly environment?: undefined
}

/**
 * Arguments required to construct a vertex which represents the usage of a variable in the dataflow graph.
 */
export interface DataflowGraphVertexUse extends DataflowGraphVertexBase {
	readonly tag:          VertexType.Use
	/** Does not require an environment to be attached. If we promote the use to a function call, we attach the environment later.  */
	readonly environment?: undefined
}

/**
 * Arguments required to construct a vertex which represents the usage of a variable in the dataflow graph.
 */
export interface DataflowGraphVertexFunctionCall extends DataflowGraphVertexBase {
	readonly tag:  VertexType.FunctionCall
	/**
	 * Effective name of the function call,
	 * Please be aware that this name can differ from the lexeme.
	 * For example, if the function is a replacement function, in this case, the actually called fn will
	 * have the compound name (e.g., `[<-`).
	 */
	readonly name: string
	/** The arguments of the function call, in order (as they are passed to the respective call if executed in R. */
	args:          FunctionArgument[]
	/** a performance flag to indicate that the respective call is _only_ calling a builtin function without any df graph attached */
	onlyBuiltin:   boolean
	/** The environment attached to the call (if such an attachment is necessary, e.g., because it represents the calling closure */
	environment:   REnvironmentInformation | undefined
}

/**
 * Arguments required to construct a vertex which represents the definition of a variable in the dataflow graph.
 */
export interface DataflowGraphVertexVariableDefinition extends DataflowGraphVertexBase {
	readonly tag:          VertexType.VariableDefinition
	/** Does not require an environment, those are attached to the call */
	readonly environment?: undefined
}

export interface DataflowGraphVertexFunctionDefinition extends DataflowGraphVertexBase {
	readonly tag: VertexType.FunctionDefinition
	/**
	 * The static subflow of the function definition, constructed within {@link processFunctionDefinition}.
	 * If the vertex is (for example) a function, it can have a subgraph which is used as a template for each call.
	 * This is the `body` of the function.
	 */
	subflow:      DataflowFunctionFlowInformation
	/**
	 * All exit points of the function definitions.
	 * In other words: last expressions/return calls
	 */
	exitPoints:   readonly NodeId[]
	environment?: REnvironmentInformation
}

export type DataflowGraphVertexArgument = DataflowGraphVertexUse | DataflowGraphVertexVariableDefinition | DataflowGraphVertexFunctionDefinition | DataflowGraphVertexFunctionCall | DataflowGraphVertexValue
export type DataflowGraphVertexInfo = Required<DataflowGraphVertexArgument>


export function isValueVertex(vertex: DataflowGraphVertexBase): vertex is DataflowGraphVertexValue {
	return vertex.tag === VertexType.Value;
}

export function isUseVertex(vertex: DataflowGraphVertexBase): vertex is DataflowGraphVertexUse {
	return vertex.tag === VertexType.Use;
}

export function isFunctionCallVertex(vertex: DataflowGraphVertexBase): vertex is DataflowGraphVertexFunctionCall {
	return vertex.tag === VertexType.FunctionCall;
}

export function isVariableDefinitionVertex(vertex: DataflowGraphVertexBase): vertex is DataflowGraphVertexVariableDefinition {
	return vertex.tag === VertexType.VariableDefinition;
}

export function isFunctionDefinitionVertex(vertex: DataflowGraphVertexBase): vertex is DataflowGraphVertexFunctionDefinition {
	return vertex.tag === VertexType.FunctionDefinition;
}

