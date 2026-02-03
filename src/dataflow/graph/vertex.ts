import type { MergeableRecord } from '../../util/objects';
import type { DataflowFunctionFlowInformation, FunctionArgument } from './graph';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { REnvironmentInformation } from '../environments/environment';
import type { ControlDependency, ExitPoint } from '../info';
import type { BuiltInProcName } from '../environments/built-in';
import type { Identifier } from '../environments/identifier';


export enum VertexType {
	Value              = 'value',
	Use                = 'use',
	FunctionCall       = 'fcall',
	VariableDefinition = 'vdef',
	FunctionDefinition = 'fdef'
}

export const ValidVertexTypes: Set<string> = new Set(Object.values(VertexType));
export const ValidVertexTypeReverse = Object.fromEntries(Object.entries(VertexType).map(([k, v]) => [v, k]));

/**
 * Arguments required to construct a vertex in the {@link DataflowGraph|dataflow graph}.
 * @see DataflowGraphVertexUse
 * @see DataflowGraphVertexVariableDefinition
 * @see DataflowGraphVertexFunctionDefinition
 */
interface DataflowGraphVertexBase extends MergeableRecord {
	/**
	 * Used to identify and separate different types of vertices.
	 */
	readonly tag: VertexType
	/**
	 * The id of the node (the id assigned by the {@link ParentInformation} decoration).
	 * This unanimously identifies the vertex in the {@link DataflowGraph|dataflow graph}
	 * as well as the corresponding {@link NormalizedAst|normalized AST}.
	 */
	id:           NodeId
	/**
	 * The environment in which the vertex is set.
	 */
	environment?: REnvironmentInformation
	/**
	 * @see {@link ControlDependency} - the collection of control dependencies which have an influence on whether the vertex is executed.
	 */
	cds:          ControlDependency[] | undefined
	/**
	 * Describes the collection of AST vertices that contributed to this vertex.
	 * For example, this is useful with replacement operators, telling you which assignment operator caused them
	 */
	link?:        DataflowGraphVertexAstLink
}

export interface DataflowGraphVertexAstLink {
	origin: NodeId[]
}

/**
 * Marker vertex for a value in the dataflow of the program.
 * This does not contain the _value_ of the referenced constant
 * as this is available with the {@link DataflowGraphVertexBase#id|id} in the {@link NormalizedAst|normalized AST}
 * (or more specifically the {@link AstIdMap}).
 *
 * If you have a {@link DataflowGraph|dataflow graph} named `graph`
 * with an {@link AstIdMap} and a value vertex object with name `value` the following Code should work:
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
 * @see {@link isValueVertex} - to check if a vertex is a value vertex
 */
export interface DataflowGraphVertexValue extends DataflowGraphVertexBase {
	readonly tag:          VertexType.Value
	readonly environment?: undefined
}

/**
 * Arguments required to construct a vertex which represents the usage of a variable in the {@link DataflowGraph|dataflow graph}.
 * @see {@link isUseVertex} - to check if a vertex is a use vertex
 */
export interface DataflowGraphVertexUse extends DataflowGraphVertexBase {
	readonly tag:          VertexType.Use
	/** Does not require an environment to be attached. If we promote the use to a function call, we attach the environment later.  */
	readonly environment?: undefined
}

/**
 * Arguments required to construct a vertex which represents the call to a function in the {@link DataflowGraph|dataflow graph}.
 * This describes all kinds of function calls, including calls to built-ins and control-flow structures such as `if` or `for` (they are
 * treated as function calls in R).
 * @see {@link isFunctionCallVertex} - to check if a vertex is a function call vertex
 */
export interface DataflowGraphVertexFunctionCall extends DataflowGraphVertexBase {
	readonly tag:  VertexType.FunctionCall
	/**
	 * Effective name of the function call,
	 * Please be aware that this name can differ from the lexeme.
	 * For example, if the function is a replacement function, in this case, the actually called fn will
	 * have the compound name (e.g., `[<-`).
	 * @see {@link Identifier} - for more information on identifiers
	 */
	readonly name: Identifier
	/**
	 * The arguments of the function call, in order (as they are passed to the respective call if executed in R.
	 * @see {@link FunctionArgument} - for more information on function arguments
	 */
	args:          FunctionArgument[]
	/** a performance flag to indicate that the respective call is _only_ calling a builtin function without any df graph attached */
	onlyBuiltin:   boolean
	/** The environment attached to the call (if such an attachment is necessary, e.g., because it represents the calling closure */
	environment:   REnvironmentInformation | undefined
	/** More detailed Information on this function call */
	origin:        FunctionOriginInformation[] | 'unnamed'
}

/** Describes the processor responsible for a function call */
export type FunctionOriginInformation = BuiltInProcName;

/**
 * Arguments required to construct a vertex which represents the definition of a variable in the {@link DataflowGraph|dataflow graph}.
 * @see {@link isVariableDefinitionVertex} - to check if a vertex is a variable definition vertex
 */
export interface DataflowGraphVertexVariableDefinition extends DataflowGraphVertexBase {
	readonly tag:          VertexType.VariableDefinition
	/** Does not require an environment, those are attached to the call */
	readonly environment?: undefined
	/** Indicates whether the variable definition is a *partial* definition (e.g,. in `x[a] <- b`) */
	readonly par?:         true;
}

/**
 * Arguments required to construct a vertex which represents the definition of a function in the {@link DataflowGraph|dataflow graph}.
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
	exitPoints:   readonly ExitPoint[]
	/** Maps each param to whether it is read, this is an estimate! */
	params:       Record<NodeId, boolean>
	/** The environment in which the function is defined (this is only attached if the DFG deems it necessary). */
	environment?: REnvironmentInformation
}

/**
 * What is to be passed to construct a vertex in the {@link DataflowGraph|dataflow graph}
 */
export type DataflowGraphVertexArgument = DataflowGraphVertexUse | DataflowGraphVertexVariableDefinition | DataflowGraphVertexFunctionDefinition | DataflowGraphVertexFunctionCall | DataflowGraphVertexValue;

/**
 * This is the union type of all possible vertices that appear within a {@link DataflowGraph|dataflow graph},
 * they can be constructed passing a {@link DataflowGraphVertexArgument} to the graph.
 *
 * See {@link DataflowGraphVertices} for an id-based mapping.
 */
export type DataflowGraphVertexInfo = Required<DataflowGraphVertexArgument>;

/**
 * A mapping of {@link NodeId}s to {@link DataflowGraphVertexInfo|vertices}.
 */
export type DataflowGraphVertices<Vertex extends DataflowGraphVertexInfo = DataflowGraphVertexInfo> = Map<NodeId, Vertex>;


/**
 * Check if the given vertex is a {@link DataflowGraphVertexValue|value vertex}.
 */
export function isValueVertex(vertex?: DataflowGraphVertexBase): vertex is DataflowGraphVertexValue {
	return vertex?.tag === VertexType.Value;
}

/**
 * Check if the given vertex is a {@link DataflowGraphVertexUse|use vertex}.
 */
export function isUseVertex(vertex?: DataflowGraphVertexBase): vertex is DataflowGraphVertexUse {
	return vertex?.tag === VertexType.Use;
}

/**
 * Check if the given vertex is a {@link DataflowGraphVertexFunctionCall|function call vertex}.
 */
export function isFunctionCallVertex(vertex?: DataflowGraphVertexBase): vertex is DataflowGraphVertexFunctionCall {
	return vertex?.tag === VertexType.FunctionCall;
}

/**
 * Check if the given vertex is a {@link DataflowGraphVertexVariableDefinition|variable definition vertex}.
 */
export function isVariableDefinitionVertex(vertex?: DataflowGraphVertexBase): vertex is DataflowGraphVertexVariableDefinition {
	return vertex?.tag === VertexType.VariableDefinition;
}

/**
 * Check if the given vertex is a {@link DataflowGraphVertexFunctionDefinition|function definition vertex}.
 */
export function isFunctionDefinitionVertex(vertex?: DataflowGraphVertexBase): vertex is DataflowGraphVertexFunctionDefinition {
	return vertex?.tag === VertexType.FunctionDefinition;
}

