import type { MergeableRecord } from '../../util/objects';
import type { DataflowFunctionFlowInformation, FunctionArgument } from './graph';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { REnvironmentInformation } from '../environments/environment';
import type { ControlDependency } from '../info';


export enum VertexType {
	Value              = 'value',
	Use                = 'use',
	FunctionCall       = 'function-call',
	VariableDefinition = 'variable-definition',
	FunctionDefinition = 'function-definition'
}

export const ValidVertexTypes = new Set(Object.values(VertexType));

/**
 * A single index of a container, which is not a container itself.
 *
 * This can be e.g. a string, number or boolean index.
 */
export interface ContainerLeafIndex {
	/**
	 * Destinctive lexeme of index e.g 'name' for `list(name = 'John')`
	 */
	readonly lexeme: string,

	/**
	 * NodeId of index in graph.
	 */
	readonly nodeId: NodeId,
}

/**
 * A single index of a container, which is a container itself.
 *
 * This can be, e.g., a list, vector, or data frame.
 *
 * @see {@link ContainerLeafIndex} - for a single index of a container which is not a container itself
 * @see {@link isParentContainerIndex} - to check if an index is a parent container index
 */
export interface ContainerParentIndex extends ContainerLeafIndex {
	/**
	 * Sub-indices of index.
	 */
	readonly subIndices: ContainerIndices[],
}

export function isParentContainerIndex(index: ContainerIndex): index is ContainerParentIndex {
	return 'subIndices' in index;
}

/**
 * A single index of a container.
 */
export type ContainerIndex = ContainerLeafIndex | ContainerParentIndex;

/**
 * List of indices of a single statement like `list(a=3, b=2)`
 */
export interface ContainerIndices {
	readonly indices:     ContainerIndex[],
	/**
	 * Differentiate between single and multiple indices.
	 *
	 * For `list(name = 'John')` `isContainer` would be true, because a list may define more than one index.
	 * `isContainer` is true for e.g. single index assignments like `person$name <- 'John'`.
	 */
	readonly isContainer: boolean,
}

/**
 * Collection of Indices of several statements.
 */
export type ContainerIndicesCollection = ContainerIndices[] | undefined

/**
 * Arguments required to construct a vertex in the {@link DataflowGraph|dataflow graph}.
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
	 * The id of the node (the id assigned by the {@link ParentInformation} decoration).
	 * This unanimously identifies the vertex in the {@link DataflowGraph|dataflow graph}
	 * as well as the corresponding {@link NormalizedAst|normalized AST}.
	 */
	id:                  NodeId
	/**
	 * The environment in which the vertex is set.
	 */
	environment?:        REnvironmentInformation
	/**
	 * @see {@link ControlDependency} - the collection of control dependencies which have an influence on whether the vertex is executed.
	 */
	controlDependencies: ControlDependency[] | undefined
	/**
	 * this attribute links a vertex to indices (pointer links) it may be affected by or related to
	 */
	indicesCollection?:  ContainerIndicesCollection
}

/**
 * Marker vertex for a value in the dataflow of the program.
 * This does not contain the _value_ of the referenced constant
 * as this is available with the {@link DataflowGraphVertexBase#id|id} in the {@link NormalizedAst|normalized AST}
 * (or more specifically the {@link AstIdMap}).
 *
 * If you have a {@link DataflowGraph|dataflow graph} named `graph`
 * with an {@link AstIdMap} and a value vertex object with name `value` the following Code should work:
 *
 * @example
 * ```ts
 * const node = graph.idMap.get(value.id)
 * ```
 *
 * This then returns the corresponding node in the {@link NormalizedAst|normalized AST}, for example,
 * an {@link RNumber} or {@link RString}.
 *
 * This works similarly for {@link IdentifierReference|identifier references}
 * for which you can use the {@link IdentifierReference#nodeId|`nodeId`}.
 *
 * @see {@link isValueVertex} - to check if a vertex is a value vertex
 */
export interface DataflowGraphVertexValue extends DataflowGraphVertexBase {
	readonly tag:          VertexType.Value
	readonly environment?: undefined
}

/**
 * Arguments required to construct a vertex which represents the usage of a variable in the {@link DataflowGraph|dataflow graph}.
 *
 * @see {@link isUseVertex} - to check if a vertex is a use vertex
 */
export interface DataflowGraphVertexUse extends DataflowGraphVertexBase {
	readonly tag:          VertexType.Use
	/** Does not require an environment to be attached. If we promote the use to a function call, we attach the environment later.  */
	readonly environment?: undefined
}

/**
 * Arguments required to construct a vertex which represents the usage of a variable in the {@link DataflowGraph|dataflow graph}.
 *
 * @see {@link isFunctionCallVertex} - to check if a vertex is a function call vertex
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
 * Arguments required to construct a vertex which represents the definition of a variable in the {@link DataflowGraph|dataflow graph}.
 *
 * @see {@link isVariableDefinitionVertex} - to check if a vertex is a variable definition vertex
 */
export interface DataflowGraphVertexVariableDefinition extends DataflowGraphVertexBase {
	readonly tag:          VertexType.VariableDefinition
	/** Does not require an environment, those are attached to the call */
	readonly environment?: undefined
}

/**
 * Arguments required to construct a vertex which represents the definition of a function in the {@link DataflowGraph|dataflow graph}.
 *
 * @see {@link isFunctionDefinitionVertex} - to check if a vertex is a function definition vertex
 */
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

/**
 * What is to be passed to construct a vertex in the {@link DataflowGraph|dataflow graph}
 */
export type DataflowGraphVertexArgument = DataflowGraphVertexUse | DataflowGraphVertexVariableDefinition | DataflowGraphVertexFunctionDefinition | DataflowGraphVertexFunctionCall | DataflowGraphVertexValue

/**
 * This is the union type of all possible vertices that appear within a {@link DataflowGraph|dataflow graph},
 * they can be constructed passing a {@link DataflowGraphVertexArgument} to the graph.
 *
 * See {@link DataflowGraphVertices} for an id-based mapping.
 */
export type DataflowGraphVertexInfo = Required<DataflowGraphVertexArgument>

/**
 * A mapping of {@link NodeId}s to {@link DataflowGraphVertexInfo|vertices}.
 */
export type DataflowGraphVertices<Vertex extends DataflowGraphVertexInfo = DataflowGraphVertexInfo> = Map<NodeId, Vertex>


/**
 * Check if the given vertex is a {@link DataflowGraphVertexValue|value vertex}.
 */
export function isValueVertex(vertex: DataflowGraphVertexBase): vertex is DataflowGraphVertexValue {
	return vertex.tag === VertexType.Value;
}

/**
 * Check if the given vertex is a {@link DataflowGraphVertexUse|use vertex}.
 */
export function isUseVertex(vertex: DataflowGraphVertexBase): vertex is DataflowGraphVertexUse {
	return vertex.tag === VertexType.Use;
}

/**
 * Check if the given vertex is a {@link DataflowGraphVertexFunctionCall|function call vertex}.
 */
export function isFunctionCallVertex(vertex: DataflowGraphVertexBase): vertex is DataflowGraphVertexFunctionCall {
	return vertex.tag === VertexType.FunctionCall;
}

/**
 * Check if the given vertex is a {@link DataflowGraphVertexVariableDefinition|variable definition vertex}.
 */
export function isVariableDefinitionVertex(vertex: DataflowGraphVertexBase): vertex is DataflowGraphVertexVariableDefinition {
	return vertex.tag === VertexType.VariableDefinition;
}

/**
 * Check if the given vertex is a {@link DataflowGraphVertexFunctionDefinition|function definition vertex}.
 */
export function isFunctionDefinitionVertex(vertex: DataflowGraphVertexBase): vertex is DataflowGraphVertexFunctionDefinition {
	return vertex.tag === VertexType.FunctionDefinition;
}

