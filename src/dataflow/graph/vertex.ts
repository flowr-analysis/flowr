import type { MergeableRecord } from '../../util/objects';
import type { DataflowFunctionFlowInformation, FunctionArgument } from './graph';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { REnvironmentInformation } from '../environments/environment';
import type { ControlDependency, ExitPoint } from '../info';
import type { Identifier } from '../environments/identifier';
import type { BuiltInProcName } from '../environments/built-in-proc-name';
import type { Value } from '../eval/values/r-value';
import type { ClassDeclaration } from '../fn/class-declaration';

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
	cds:          readonly ControlDependency[] | undefined
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
 * For user-code constants (numbers, strings, logicals) the value is recovered by looking up the
 * {@link DataflowGraphVertexBase#id|id} in the {@link NormalizedAst|normalized AST}:
 * @see {@link ValueVertex.is} - to check if a vertex is a value vertex
 * @example
 * ```ts
 * const node = graph.idMap.get(value.id)
 * ```
 *
 * For built-in constants whose id is not in the {@link AstIdMap} (e.g. `T` resolving to `built-in:T`),
 * the abstract {@link Value} is stored directly in the {@link DataflowGraphVertexValue#value|value} field.
 */
export interface DataflowGraphVertexValue extends DataflowGraphVertexBase {
	readonly tag:          VertexType.Value
	readonly environment?: undefined
	/** Pre-computed abstract value; set for built-in constants (e.g. `T`, `F`) whose id is not in the AST id map */
	readonly value?:       Value
}

/**
 * Arguments required to construct a vertex which represents the usage of a variable in the {@link DataflowGraph|dataflow graph}.
 * @see {@link UseVertex.is} - to check if a vertex is a use vertex
 */
export interface DataflowGraphVertexUse extends DataflowGraphVertexBase {
	readonly tag:          VertexType.Use
	/** Does not require an environment to be attached. If we promote the use to a function call, we attach the environment later.  */
	readonly environment?: undefined
	constantFallback?:     true
}

/**
 * Arguments required to construct a vertex which represents the call to a function in the {@link DataflowGraph|dataflow graph}.
 * This describes all kinds of function calls, including calls to built-ins and control-flow structures such as `if` or `for` (they are
 * treated as function calls in R).
 * @see {@link FunctionCallVertex.is} - to check if a vertex is a function call vertex
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
	/**
	 * For `new.env()`-family calls: the resolved parent {@link REnvironmentInformation} that the
	 * freshly-created environment should inherit from. Set by `processNewEnv` when the `parent`
	 * argument can be statically resolved (tracked env variable or `emptyenv()`-family call).
	 */
	newEnvParent?: REnvironmentInformation
	/**
	 * For a class-declaring call (`setClass`, `setClassUnion`, `setIs`, `setValidity`, `setRefClass`,
	 * `S7::new_class`, `R6::R6Class`): what the declaration states -- its name, superclasses, members, and
	 * whether it can be instantiated. Filled from the {@link ClassDeclarationConfig} the built-in declares,
	 * so no argument's meaning is guessed. See {@link declaredClassesImpl} to collect these across a graph.
	 */
	classDecl?:    ClassDeclaration
	/** For an S4 instantiation (`new("P")`): the classes it creates an instance of, whose validity functions it runs */
	instantiates?: readonly string[]
	/** For an S4 instantiation: the generic whose methods initialize the new object (`initialize`) */
	initializer?:  string
	/** For a `setMethod`: the generic it adds a method to and the signature the method is registered for */
	s4Method?:     S4MethodRegistration
	/** The method definitions the dispatch of the call rules out for the classes its arguments have, which a lookup by name still finds */
	ruledOut?:     readonly NodeId[]
	/**
	 * For a dispatch within a function on what the calls of that function hand it: per such call, the method
	 * definitions the dispatch further rules out when that call runs it. The edges of the call still reach every
	 * method any call may run, as it is the one vertex for all of them.
	 */
	ruledOutAt?:   readonly CallRuledOut[]
	/** For a lookup in an environment (`e$x`, `mget`): the definitions the contents tracked where it is written bind it to */
	found?:        readonly NodeId[]
	/** For a lookup of a function body whose name or environment only a call knows (`get(n, envir = e)`, `e$x` with a free `e`): what it finds for each call */
	foundOnCall?:  readonly FoundOnCall[]
}

/**
 * The method definitions a dispatch rules out when the call `call` of the function holding it runs it, and `within`,
 * per call of the function holding `call` in turn, what it further rules out when that call runs that one.
 */
export interface CallRuledOut {
	readonly call:    NodeId
	readonly methods: readonly NodeId[]
	readonly within?: readonly CallRuledOut[]
}

/** The definitions a lookup in a function body (`get(n, envir = e)`) finds when `call` runs the body, see {@link DataflowGraphVertexFunctionCall#foundOnCall}. */
export interface FoundOnCall {
	readonly call:  NodeId
	readonly found: readonly NodeId[]
}

/** One entry of an S4 method signature: the class, and the formal it is for when the signature names it. */
export interface S4SignatureEntry {
	readonly cls:   string
	readonly name?: string
}

/** What a `setMethod` registers: the method of `generic` for `signature`, absent when the signature does not resolve. */
export interface S4MethodRegistration {
	readonly generic:    string
	readonly signature?: readonly S4SignatureEntry[]
}

/** Describes the processor responsible for a function call */
export type FunctionOriginInformation = BuiltInProcName;

/**
 * Arguments required to construct a vertex which represents the definition of a variable in the {@link DataflowGraph|dataflow graph}.
 * @see {@link VariableDefinitionVertex.is} - to check if a vertex is a variable definition vertex
 */
export interface DataflowGraphVertexVariableDefinition extends DataflowGraphVertexBase {
	readonly tag:          VertexType.VariableDefinition
	/** Does not require an environment, those are attached to the call */
	readonly environment?: undefined
	/** Indicates whether the variable definition is a *partial* definition (e.g,. in `x[a] <- b`) */
	readonly par?:         true;
	/** Points to the source ids of the "value" if there is one, this is more of a best-effort flag and not guaranteed to be there */
	readonly source?:      readonly NodeId[];
}

/**
 * Arguments required to construct a vertex which represents the definition of a function in the {@link DataflowGraph|dataflow graph}.
 * @see {@link FunctionDefinitionVertex.is} - to check if a vertex is a function definition vertex
 */
export interface DataflowGraphVertexFunctionDefinition extends DataflowGraphVertexBase {
	readonly tag:    VertexType.FunctionDefinition
	/**
	 * The static subflow of the function definition, constructed within {@link processFunctionDefinition}.
	 * If the vertex is (for example) a function, it can have a subgraph which is used as a template for each call.
	 * This is the `body` of the function.
	 */
	subflow:         DataflowFunctionFlowInformation
	/**
	 * All exit points of the function definitions.
	 * In other words: last expressions/return calls
	 */
	exitPoints:      readonly ExitPoint[]
	/** Maps each param to whether it is read, this is an estimate! */
	params:          Record<NodeId, boolean>
	/** The environment in which the function is defined (this is only attached if the DFG deems it necessary). */
	environment?:    REnvironmentInformation
	/**
	 * If the function is a (potential) S3/S4/S7 dispatch
	 * Please note that flowR may create these flags *on use* (e.g. `s3` as otherwise any func with a `.` would be considered S3).
	 * This is more of a convenience flag for later processing.
	 */
	mode?:           ('s3' | 's4' | 's7')[];
	/**
	 * If this function statically returns a tracked environment, stores the envState it returns.
	 * Set by `processFunctionDefinition` when exit points include NewEnv calls or symbols resolving to tracked envs.
	 */
	returnEnvState?: REnvironmentInformation
	/** The calls of the body whose environment operation depends on the call of the function, see {@link DeferredEnvOp}. */
	envOps?:         readonly DeferredEnvOp[]
	/** Whether a call of the closure reads writes into the frame it holds, see {@link InGraphIdentifierDefinition#closureFrame}. */
	framed?:         true
}

/** What a call does to the variable it names in an environment. */
export enum EnvOpKind {
	/** `assign(x, value, envir)` */
	Define = 'define',
	/** `get(x, envir)` and `exists(x, envir)` */
	Read   = 'read',
	/** `rm(list = x, envir)` */
	Remove = 'remove',
	/** `env$x <- value` and `env[["x"]] <- value`, which define in what `env` holds only if that is an environment, a list they copy */
	Replace = 'replace'
}

/**
 * A call in a function body working on a variable in an environment, where the name or the environment is only
 * known once the function is called: given by a parameter, or named by a free variable.
 */
export interface DeferredEnvOp {
	readonly id:       NodeId
	readonly kind:     EnvOpKind
	/** the expressions giving the names by their value */
	readonly names:    readonly NodeId[]
	/** the names written down as they are, as `rm` takes its `...` */
	readonly literals: readonly string[]
	readonly envir:    NodeId
	/** the value a definition binds */
	readonly value?:   NodeId
	/** whether a read hands back what it reads, as `get` does and `exists` does not */
	readonly returns:  boolean
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
 * Maps a {@link VertexType} to the vertex it tags, so {@link DfgVertex.is} can narrow from a tag alone.
 */
export interface VertexByType {
	[VertexType.Value]:              DataflowGraphVertexValue;
	[VertexType.Use]:                DataflowGraphVertexUse;
	[VertexType.FunctionCall]:       DataflowGraphVertexFunctionCall;
	[VertexType.VariableDefinition]: DataflowGraphVertexVariableDefinition;
	[VertexType.FunctionDefinition]: DataflowGraphVertexFunctionDefinition;
}

/**
 * The one helper to ask a {@link DataflowGraphVertexInfo|vertex} what it is.
 *
 * Every check tolerates an absent vertex, which is what {@link DataflowGraph#getVertex|getVertex()} hands back
 * for an id the graph does not know.
 * @helper dataflow
 * @example
 * ```ts
 * const vertex = graph.getVertex(id);
 * DfgVertex.isFunctionCall(vertex) && vertex.name;     // narrows, so `name` is there
 * DfgVertex.is(vertex, VertexType.Use);                // the same check from a tag
 * DfgVertex.hasOrigin(vertex, 'builtin:eval');         // the call is an eval
 * ```
 */
export const DfgVertex = {
	name: 'DfgVertex',
	/**
	 * Whether the vertex carries the given {@link VertexType|tag}, narrowing it to the vertex that tag names.
	 * @see {@link DfgVertex.isValue}, {@link DfgVertex.isUse}, {@link DfgVertex.isFunctionCall},
	 * {@link DfgVertex.isVariableDefinition}, {@link DfgVertex.isFunctionDefinition} - if the kind is known upfront
	 */
	is<T extends VertexType>(this: void, vertex: DataflowGraphVertexBase | undefined, tag: T): vertex is VertexByType[T] {
		return vertex?.tag === tag;
	},
	/** Whether the vertex holds a constant like `42`. */
	isValue(this: void, vertex?: DataflowGraphVertexBase): vertex is DataflowGraphVertexValue {
		return vertex?.tag === VertexType.Value;
	},
	/** Whether the vertex is a read of a variable, the `x` of `print(x)`. */
	isUse(this: void, vertex?: DataflowGraphVertexBase): vertex is DataflowGraphVertexUse {
		return vertex?.tag === VertexType.Use;
	},
	/** Whether the vertex is a call like `f()`. */
	isFunctionCall(this: void, vertex?: DataflowGraphVertexBase): vertex is DataflowGraphVertexFunctionCall {
		return vertex?.tag === VertexType.FunctionCall;
	},
	/** Whether the vertex defines a variable, the `x` of `x <- 1`. */
	isVariableDefinition(this: void, vertex?: DataflowGraphVertexBase): vertex is DataflowGraphVertexVariableDefinition {
		return vertex?.tag === VertexType.VariableDefinition;
	},
	/** Whether the vertex is a `function(...) ...`. */
	isFunctionDefinition(this: void, vertex?: DataflowGraphVertexBase): vertex is DataflowGraphVertexFunctionDefinition {
		return vertex?.tag === VertexType.FunctionDefinition;
	},
	/**
	 * Whether the vertex is a function call carrying the given origin.
	 * Deliberately not a type predicate: a `false` says nothing about the tag, the call may simply carry another origin.
	 */
	hasOrigin(this: void, vertex: DataflowGraphVertexBase | undefined, origin: BuiltInProcName): boolean {
		return DfgVertex.isFunctionCall(vertex) && vertex.origin?.includes(origin) === true;
	}
} as const;
