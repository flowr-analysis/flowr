import type { MergeableRecord } from '../../util/objects';
import type { DataflowFunctionFlowInformation, FunctionArgument } from './graph';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { REnvironmentInformation } from '../environments/environment';
import type { ControlDependency, ExitPoint } from '../info';
import type { BrandedIdentifier, Identifier } from '../environments/identifier';
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

/** Arguments required to construct a vertex in the {@link DataflowGraph|dataflow graph}. */
interface DataflowGraphVertexBase extends MergeableRecord {
	/** Used to identify and separate different types of vertices. */
	readonly tag: VertexType
	/** The id of the node (the id assigned by the {@link ParentInformation} decoration). */
	id:           NodeId
	/** The environment in which the vertex is set. */
	environment?: REnvironmentInformation
	/**
	 * @see {@link ControlDependency} - the collection of control dependencies which have an influence on whether the vertex is executed.
	 */
	cds:          readonly ControlDependency[] | undefined
	/** Describes the collection of AST vertices that contributed to this vertex. */
	link?:        DataflowGraphVertexAstLink
}

export interface DataflowGraphVertexAstLink {
	origin: NodeId[]
}

/** Marker vertex for a value in the dataflow of the program. */
export interface DataflowGraphVertexValue extends DataflowGraphVertexBase {
	readonly tag:          VertexType.Value
	readonly environment?: undefined
	/** Pre-computed abstract value; set for built-in constants (e.g. `T`, `F`) whose id is not in the AST id map */
	readonly value?:       Value
}

/** Arguments required to construct a vertex which represents the usage of a variable in the {@link DataflowGraph|dataflow graph}. */
export interface DataflowGraphVertexUse extends DataflowGraphVertexBase {
	readonly tag:          VertexType.Use
	/** Does not require an environment to be attached. If we promote the use to a function call, we attach the environment later.  */
	readonly environment?: undefined
	constantFallback?:     true
}

/** Arguments required to construct a vertex which represents the call to a function in the {@link DataflowGraph|dataflow graph}. */
export interface DataflowGraphVertexFunctionCall extends DataflowGraphVertexBase {
	readonly tag:  VertexType.FunctionCall
	/** Effective name of the function call, Please be aware that this name can differ from the lexeme. */
	readonly name: Identifier
	/** The arguments of the function call, in order (as they are passed to the respective call if executed in R. */
	args:          FunctionArgument[]
	/** a performance flag to indicate that the respective call is _only_ calling a builtin function without any df graph attached */
	onlyBuiltin:   boolean
	/** The environment attached to the call (if such an attachment is necessary, e.g., because it represents the calling closure */
	environment:   REnvironmentInformation | undefined
	/** More detailed Information on this function call */
	origin:        FunctionOriginInformation[] | 'unnamed'
	/** For `new.env()`-family calls: the resolved parent {@link REnvironmentInformation} that the freshly-created environment should inherit from. */
	newEnvParent?: REnvironmentInformation
	/** For a class-declaring call (`setClass`, `setClassUnion`, `setIs`, `setValidity`, `setRefClass`, `S7::new_class`, `R6::R6Class`): what the declaration states -- its name, superclasses, members, and whether it can be instantiated. */
	classDecl?:    ClassDeclaration
	/** For an S4 instantiation (`new("P")`): the classes it creates an instance of, whose validity functions it runs */
	instantiates?: readonly string[]
	/** For an S4 instantiation: the generic whose methods initialize the new object (`initialize`) */
	initializer?:  string
	/** For a `setMethod`: the generic it adds a method to and the signature the method is registered for */
	s4Method?:     S4MethodRegistration
	/** The method definitions the dispatch of the call rules out for the classes its arguments have, which a lookup by name still finds */
	ruledOut?:     readonly NodeId[]
	/** For a dispatch within a function on what the calls of that function hand it: per such call, the method definitions the dispatch further rules out when that call runs it. */
	ruledOutAt?:   readonly CallRuledOut[]
	/** For a lookup in an environment (`e$x`, `mget`): the definitions the contents tracked where it is written bind it to */
	found?:        readonly NodeId[]
	/** For a lookup of a function body whose name or environment only a call knows (`get(n, envir = e)`, `e$x` with a free `e`): what it finds for each call */
	foundOnCall?:  readonly FoundOnCall[]
}

/** The method definitions a dispatch rules out when the call `call` of the function holding it runs it, and `within`, per call of the function holding `call` in turn, what it further rules out when that call runs that one. */
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
	readonly cls:   BrandedIdentifier
	readonly name?: BrandedIdentifier
}

/** What a `setMethod` registers: the method of `generic` for `signature`, absent when the signature does not resolve. */
export interface S4MethodRegistration {
	readonly generic:    BrandedIdentifier
	readonly signature?: readonly S4SignatureEntry[]
}

/** Describes the processor responsible for a function call */
export type FunctionOriginInformation = BuiltInProcName;

/** Arguments required to construct a vertex which represents the definition of a variable in the {@link DataflowGraph|dataflow graph}. */
export interface DataflowGraphVertexVariableDefinition extends DataflowGraphVertexBase {
	readonly tag:          VertexType.VariableDefinition
	/** Does not require an environment, those are attached to the call */
	readonly environment?: undefined
	/** Indicates whether the variable definition is a *partial* definition (e.g,. in `x[a] <- b`) */
	readonly par?:         true;
	/** Points to the source ids of the "value" if there is one, this is more of a best-effort flag and not guaranteed to be there */
	readonly source?:      readonly NodeId[];
}

/** Arguments required to construct a vertex which represents the definition of a function in the {@link DataflowGraph|dataflow graph}. */
export interface DataflowGraphVertexFunctionDefinition extends DataflowGraphVertexBase {
	readonly tag:    VertexType.FunctionDefinition
	/** The static subflow of the function definition, constructed within {@link processFunctionDefinition}. */
	subflow:         DataflowFunctionFlowInformation
	/** All exit points of the function definitions. In other words: last expressions/return calls */
	exitPoints:      readonly ExitPoint[]
	/** Maps each param to whether it is read, this is an estimate! */
	params:          Record<NodeId, boolean>
	/** The environment in which the function is defined (this is only attached if the DFG deems it necessary). */
	environment?:    REnvironmentInformation
	/** If the function is a (potential) S3/S4/S7 dispatch Please note that flowR may create these flags *on use* (e.g. `s3` as otherwise any func with a `.` would be considered S3). */
	mode?:           ('s3' | 's4' | 's7')[];
	/** If this function statically returns a tracked environment, stores the envState it returns. */
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
	Replace = 'replace',
	/** `x[, a := v]` on a parameter `x`, which changes the table the caller hands over in place */
	ChangeInPlace = 'change-in-place'
}

/** A call in a function body working on a variable in an environment, where the name or the environment is only known once the function is called: given by a parameter, or named by a free variable. */
export interface DeferredEnvOp {
	readonly id:           NodeId
	readonly kind:         EnvOpKind
	/** the expressions giving the names by their value */
	readonly names:        readonly NodeId[]
	/** the names written down as they are, as `rm` takes its `...` */
	readonly literals:     readonly string[]
	readonly envir:        NodeId
	/** the value a definition binds */
	readonly value?:       NodeId
	/** whether a read hands back what it reads, as `get` does and `exists` does not */
	readonly returns:      boolean
	/** for an operation on the frame of a caller handed on to the callers of the caller, how many calls up that frame lies */
	readonly generations?: number
}

/** What is to be passed to construct a vertex in the {@link DataflowGraph|dataflow graph} */
export type DataflowGraphVertexArgument = DataflowGraphVertexUse | DataflowGraphVertexVariableDefinition | DataflowGraphVertexFunctionDefinition | DataflowGraphVertexFunctionCall | DataflowGraphVertexValue;

/** This is the union type of all possible vertices that appear within a {@link DataflowGraph|dataflow graph}, they can be constructed passing a {@link DataflowGraphVertexArgument} to the graph. */
export type DataflowGraphVertexInfo = Required<DataflowGraphVertexArgument>;

/** A mapping of {@link NodeId}s to {@link DataflowGraphVertexInfo|vertices}. */
export type DataflowGraphVertices<Vertex extends DataflowGraphVertexInfo = DataflowGraphVertexInfo> = Map<NodeId, Vertex>;

/** Maps a {@link VertexType} to the vertex it tags, so {@link DfgVertex.is} can narrow from a tag alone. */
export interface VertexByType {
	[VertexType.Value]:              DataflowGraphVertexValue;
	[VertexType.Use]:                DataflowGraphVertexUse;
	[VertexType.FunctionCall]:       DataflowGraphVertexFunctionCall;
	[VertexType.VariableDefinition]: DataflowGraphVertexVariableDefinition;
	[VertexType.FunctionDefinition]: DataflowGraphVertexFunctionDefinition;
}

/**
 * The one helper to ask a {@link DataflowGraphVertexInfo|vertex} what it is.
 * @helper dataflow
 */
export const DfgVertex = {
	name: 'DfgVertex',
	/** Whether the vertex carries the given {@link VertexType|tag}, narrowing it to the vertex that tag names. */
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
	/** Whether the vertex is a function call carrying the given origin. */
	hasOrigin(this: void, vertex: DataflowGraphVertexBase | undefined, origin: BuiltInProcName): boolean {
		return DfgVertex.isFunctionCall(vertex) && vertex.origin?.includes(origin) === true;
	}
} as const;
