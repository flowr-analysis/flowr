import type { NodeId } from '../../../../src'
import { EmptyArgument } from '../../../../src'
import type {
	DataflowFunctionFlowInformation,
	DataflowGraphVertexUse,
	FunctionArgument,
	REnvironmentInformation
} from '../../../../src/dataflow'
import {
	BuiltIn,
	CONSTANT_NAME,
	DataflowGraph,
	EdgeType,
	isPositionalArgument,
	VertexType
} from '../../../../src/dataflow'
import { deepMergeObject } from '../../../../src/util/objects'

export function emptyGraph() {
	return new DataflowGraphBuilder()
}

export type DataflowGraphEdgeTarget = NodeId | (readonly NodeId[]);

/**
 * This DataflowGraphBuilder extends {@link DataflowGraph} with builder methods to
 * easily and compactly add vertices and edges to a dataflow graph. Its usage thus
 * simplifies writing tests for dataflow graphs.
 */
export class DataflowGraphBuilder extends DataflowGraph {
	/**
	 * Adds a **vertex** for a **function definition** (V1).
	 *
	 * @param id - AST node ID
	 * @param name - AST node text
	 * @param subflow - Subflow data graph for the defined function.
	 * @param exitPoints - Node IDs for exit point vertices.
	 * @param info - Additional/optional properties.
	 * @param asRoot - should the vertex be part of the root vertex set of the graph
	 * (i.e., be a valid entry point), or is it nested (e.g., as part of a function definition)
	 */
	public defineFunction(id: NodeId, name: string,
		exitPoints: readonly NodeId[], subflow: DataflowFunctionFlowInformation,
		info?: { environment?: REnvironmentInformation, controlDependency?: NodeId[] },
		asRoot: boolean = true) {
		return this.addVertex({
			tag:               VertexType.FunctionDefinition,
			id,
			name,
			subflow,
			exitPoints,
			controlDependency: info?.controlDependency,
			environment:       info?.environment
		}, asRoot)
	}

	/**
	 * Adds a **vertex** for a **function call** (V2).
	 *
	 * @param id - AST node ID
	 * @param name - Function name
	 * @param args - Function arguments; may be empty
	 * @param info - Additional/optional properties.
	 * @param asRoot - should the vertex be part of the root vertex set of the graph
	 * (i.e., be a valid entry point), or is it nested (e.g., as part of a function definition)
	 */
	public call(id: NodeId, name: string, args: FunctionArgument[],
		info?: {
			returns?:           readonly NodeId[],
			reads?:             readonly NodeId[],
			onlyBuiltIn?:       boolean,
			environment?:       REnvironmentInformation,
			controlDependency?: NodeId[]
		},
		asRoot: boolean = true) {
		const onlyBuiltInAuto = info?.reads?.length === 1 && info?.reads[0] === BuiltIn
		this.addVertex({
			tag:               VertexType.FunctionCall,
			id,
			name,
			args:              args.map(a =>  a === EmptyArgument ? EmptyArgument : { ...a, controlDependency: undefined }),
			environment:       info?.environment,
			controlDependency: info?.controlDependency,
			onlyBuiltin:       info?.onlyBuiltIn ?? onlyBuiltInAuto ?? false
		}, asRoot)
		this.addArgumentLinks(id, args)
		if(info?.returns) {
			for(const ret of info.returns) {
				this.returns(id, ret)
			}
		}
		if(info?.reads) {
			for(const call of info.reads) {
				this.reads(id, call)
			}
		}
		return this
	}

	/** automatically adds argument links if they do not already exist */
	private addArgumentLinks(id: NodeId, args: readonly FunctionArgument[]) {
		for(const arg of args) {
			if(arg === EmptyArgument) {
				continue
			}
			if(isPositionalArgument(arg)) {
				this.argument(id, arg.nodeId)
				if(typeof arg.nodeId === 'string' && arg.nodeId.endsWith('-arg')) {
					const withoutSuffix = arg.nodeId.slice(0, -4)
					this.reads(arg.nodeId, withoutSuffix)
				}
			} else if(!this.hasVertex(arg.nodeId, true)) {
				this.use(arg.nodeId, arg.name, { controlDependency: arg.controlDependency })
				this.argument(id, arg.nodeId)
			}
		}
	}

	/**
	 * Adds a **vertex** for an **exit point** of a function (V3).
	 *
	 * @param id - AST node ID
	 * @param name - AST node text
	 * @param info - Additional/optional properties.
	 * @param asRoot - should the vertex be part of the root vertex set of the graph
	 * (i.e., be a valid entry point), or is it nested (e.g., as part of a function definition)
	 */
	public exit(id: NodeId, name: string,
		info?: { environment?: REnvironmentInformation, controlDependency?: NodeId[] },
		asRoot: boolean = true) {
		return this.addVertex({
			tag:               VertexType.ExitPoint,
			id,
			environment:       info?.environment,
			name,
			controlDependency: info?.controlDependency
		}, asRoot)
	}

	/**
	 * Adds a **vertex** for a **variable definition** (V4).
	 *
	 * @param id - AST node ID
	 * @param name - Variable name
	 * @param info - Additional/optional properties.
	 * @param asRoot - Should the vertex be part of the root vertex set of the graph
	 * (i.e., be a valid entry point), or is it nested (e.g., as part of a function definition)
	 */
	public defineVariable(id: NodeId, name: string,
		info?: { controlDependency?: NodeId[], definedBy?: NodeId[]}, asRoot: boolean = true) {
		this.addVertex({
			tag:               VertexType.VariableDefinition,
			id,
			name,
			controlDependency: info?.controlDependency
		}, asRoot)
		if(info?.definedBy) {
			for(const def of info.definedBy) {
				this.definedBy(id, def)
			}
		}
		return this
	}

	/**
	 * Adds a **vertex** for **variable use** (V5). Intended for creating dataflow graphs as part of function tests.
	 *
	 * @param id - AST node id
	 * @param name - Variable name
	 * @param info - Additional/optional properties; i.e., scope, when, or environment.
	 * @param asRoot - should the vertex be part of the root vertex set of the graph
	 * (i.e., be a valid entry point) or is it nested (e.g., as part of a function definition)
	 */
	public use(id: NodeId, name: string, info?: Partial<DataflowGraphVertexUse>, asRoot: boolean = true) {
		return this.addVertex(deepMergeObject({
			tag:               VertexType.Use,
			id,
			name,
			controlDependency: undefined,
			environment:       undefined
		}, info), asRoot)
	}


	/**
	 * Adds a **vertex** for a **constant value** (V6).
	 *
	 * @param id - AST node ID
	 * @param options - Additional/optional properties;
	 * @param asRoot - should the vertex be part of the root vertex set of the graph
	 * (i.e., be a valid entry point), or is it nested (e.g., as part of a function definition)
	 */
	public constant(id: NodeId, options?: { controlDependency?: NodeId[] }, asRoot: boolean = true) {
		return this.addVertex({
			tag:               VertexType.Value,
			name:              CONSTANT_NAME,
			id,
			controlDependency: options?.controlDependency,
			environment:       undefined
		}, asRoot)
	}

	private edgeHelper(from: NodeId, to: DataflowGraphEdgeTarget, type: EdgeType) {
		if(Array.isArray(to)) {
			for(const t of to) {
				this.edgeHelper(from, t as NodeId, type)
			}
			return this
		}
		return this.addEdge(from, to as NodeId, { type })
	}

	/**
	 * Adds a **read edge** (E1).
	 *
	 * @param from - Vertex/NodeId
	 * @param to   - see from
	 */
	public reads(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.Reads)
	}

	/**
	 * Adds a **defined-by edge** (E2), with from as defined variable, and to
	 * as a variable/function contributing to its definition.
	 *
	 * @see reads for parameters.
	 */
	public definedBy(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.DefinedBy)
	}

	/**
	 * Adds a **same-read-read edge** (E3), with from and to as two variable uses
	 * on the same variable.
	 *
	 * @see reads for parameters.
	 */
	public sameRead(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.SameReadRead)
	}

	/**
	 * Adds a **same-def-def edge** (E4), with from and to as two variables
	 * that share a defining variable.
	 *
	 * @see reads for parameters.
	 */
	public sameDef(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.SameDefDef)
	}

	/**
	 * Adds a **call edge** (E5) with from as caller, and to as callee.
	 *
	 * @see reads for parameters.
	 */
	public calls(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.Calls)
	}

	/**
	 * Adds a **return edge** (E6) with from as function, and to as exit point.
	 *
	 * @see reads for parameters.
	 */
	public returns(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.Returns)
	}

	/**
	 * Adds a **defines-on-call edge** (E7) with from as variable, and to as its definition
	 *
	 * @see reads for parameters.
	 */
	public definesOnCall(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.DefinesOnCall)
	}

	/**
	 * Adds an **argument edge** (E9) with from as function call, and to as argument.
	 *
	 * @see reads for parameters.
	 */
	public argument(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.Argument)
	}

	/**
	 * Adds a **relation edge** (E10) with from as exit point, and to as any other vertex.
	 *
	 * @see reads for parameters.
	 */
	public relates(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.Relates)
	}

	/**
	 * Adds a **non-standard evaluation edge** with from as vertex, and to as vertex.
	 *
	 * @see reads for parameters.
	 */
	public nse(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.NonStandardEvaluation)
	}

	/**
	 * Adds a **side-effect-on-call edge** with from as vertex, and to as vertex.
	 *
	 * @see reads for parameters.
	 */
	public sideEffectOnCall(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.SideEffectOnCall)
	}
}
