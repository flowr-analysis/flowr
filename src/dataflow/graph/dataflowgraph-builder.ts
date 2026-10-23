import { deepMergeObject } from '../../util/objects';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { AstIdMap } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import {
	type DataflowFunctionFlowInformation,
	DataflowGraph,
	FunctionArgument
} from './graph';
import type { IEnvironment, REnvironmentInformation } from '../environments/environment';
import { type DataflowGraphVertexFunctionDefinition,
	type DataflowGraphVertexArgument,
	type DataflowGraphVertexAstLink,
	type DataflowGraphVertexInfo,
	type DataflowGraphVertexUse,
	type FunctionOriginInformation,
	VertexType
} from './vertex';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { EdgeType } from './edge';
import type { ControlDependency, ExitPoint } from '../info';
import { ExitPointType } from '../info';
import { getDefaultProcessor } from '../environments/default-builtin-config';
import { contextFromInput } from '../../project/context/flowr-analyzer-context';
import type { HookInformation } from '../hooks';
import { BuiltInProcName } from '../environments/built-in-proc-name';

function normalizeCds(cds: readonly ControlDependency[] | undefined): ControlDependency[] | undefined {
	return cds?.map(c => ({ ...c, id: NodeId.normalize(c.id) }));
}

function normalizeReference<T extends { nodeId: NodeId, cds?: readonly ControlDependency[] }>(ref: T): T {
	return { ...ref, nodeId: NodeId.normalize(ref.nodeId), cds: normalizeCds(ref.cds) };
}

/**
 * Creates an empty dataflow graph.
 * Should only be used in tests and documentation.
 */
export function emptyGraph(this: void, cleanEnv?: REnvironmentInformation, idMap?: AstIdMap) {
	return new DataflowGraphBuilder(cleanEnv, idMap);
}

export type DataflowGraphEdgeTarget = NodeId | (readonly NodeId[]);

/**
 * This DataflowGraphBuilder extends {@link DataflowGraph} with builder methods to
 * easily and compactly add vertices and edges to a dataflow graph. Its usage thus
 * simplifies writing tests for dataflow graphs.
 */
export class DataflowGraphBuilder<
	Vertex extends DataflowGraphVertexInfo = DataflowGraphVertexInfo,
> extends DataflowGraph {
	private readonly defaultEnvironment: REnvironmentInformation;

	constructor(cleanEnv?: REnvironmentInformation, idMap?: AstIdMap) {
		super(idMap);
		this.defaultEnvironment = cleanEnv ?? contextFromInput('').env.makeCleanEnv();
	}

	public addVertexWithDefaultEnv(vertex: DataflowGraphVertexArgument & Omit<Vertex, keyof DataflowGraphVertexArgument>, asRoot = true, overwrite = false): this {
		super.addVertex(vertex, this.defaultEnvironment, asRoot, overwrite);
		return this;
	}

	/**
	 * Adds a **vertex** for a **function definition** (V1).
	 * @param id         - AST node ID
	 * @param subflow    - Subflow data graph for the defined function.
	 * @param exitPoints - Node IDs for exit point vertices.
	 * @param info       - Additional/optional properties.
	 * @param asRoot     - should the vertex be part of the root vertex set of the graph
	 * (i.e., be a valid entry point), or is it nested (e.g., as part of a function definition)
	 */
	public defineFunction(id: NodeId,
		exitPoints: readonly ExitPoint[] | readonly NodeId[], subflow: Omit<DataflowFunctionFlowInformation, 'hooks'> & { hooks?: HookInformation[] },
		info?: { environment?: REnvironmentInformation, builtInEnvironment?: IEnvironment, cds?: ControlDependency[], readParams?: [NodeId, boolean][], mode?: DataflowGraphVertexFunctionDefinition['mode'] },
		asRoot: boolean = true) {
		return this.addVertexWithDefaultEnv({
			tag:     VertexType.FunctionDefinition,
			id:      NodeId.normalize(id),
			params:  Object.fromEntries(info?.readParams ?? []),
			subflow: {
				...subflow,
				entryPoint:        NodeId.normalize(subflow.entryPoint),
				graph:             new Set([...subflow.graph].map(NodeId.normalize)),
				out:               subflow.out.map(normalizeReference),
				in:                subflow.in.map(normalizeReference),
				unknownReferences: subflow.unknownReferences.map(normalizeReference),
				hooks:             subflow.hooks ?? [],
			},
			mode:       info?.mode,
			exitPoints: exitPoints.map(e => typeof e === 'object' ? normalizeReference(e) :
				({ nodeId: NodeId.normalize(e), type: ExitPointType.Default, cds: undefined })
			),
			cds:         normalizeCds(info?.cds),
			environment: info?.environment,
		}, asRoot);
	}

	/**
	 * Adds a **vertex** for a **function call** (V2).
	 * @param id     - AST node ID
	 * @param name   - Function name
	 * @param args   - Function arguments; may be empty
	 * @param info   - Additional/optional properties.
	 * @param asRoot - should the vertex be part of the root vertex set of the graph
	 * (i.e., be a valid entry point), or is it nested (e.g., as part of a function definition)
	 */
	public call(id: NodeId, name: string, args: FunctionArgument[],
		info?: {
			returns?:            readonly NodeId[],
			reads?:              readonly NodeId[],
			onlyBuiltIn?:        boolean,
			environment?:        REnvironmentInformation,
			builtInEnvironment?: IEnvironment,
			cds?:                ControlDependency[],
			origin?:             FunctionOriginInformation[]
			link?:               DataflowGraphVertexAstLink,
			omitArgs?:           boolean
		},
		asRoot: boolean = true) {
		const onlyBuiltInAuto = info?.reads?.length === 1 && NodeId.isBuiltIn(info?.reads[0]);
		this.addVertexWithDefaultEnv({
			tag:         VertexType.FunctionCall,
			id:          NodeId.normalize(id),
			name,
			args:        args.map(a => a === EmptyArgument ? EmptyArgument : { ...a, nodeId: NodeId.normalize(a.nodeId), cds: undefined }),
			environment: (info?.onlyBuiltIn || onlyBuiltInAuto) ? undefined : info?.environment ?? this.defaultEnvironment,
			cds:         normalizeCds(info?.cds),
			onlyBuiltin: info?.onlyBuiltIn ?? onlyBuiltInAuto ?? false,
			origin:      info?.origin ?? [getDefaultProcessor(name) ?? BuiltInProcName.Function],
			link:        info?.link
		}, asRoot);
		if(!info?.omitArgs) {
			this.addArgumentLinks(id, args);
		}
		if(info?.returns) {
			for(const ret of info.returns) {
				this.returns(id, ret);
			}
		}
		if(info?.reads) {
			for(const call of info.reads) {
				this.reads(id, call);
			}
		}
		return this;
	}

	/** automatically adds argument links if they do not already exist */
	private addArgumentLinks(id: NodeId, args: readonly FunctionArgument[]) {
		for(const arg of args) {
			if(FunctionArgument.isEmpty(arg)) {
				continue;
			}
			if(FunctionArgument.isPositional(arg)) {
				this.argument(id, arg.nodeId);
				if(typeof arg.nodeId === 'string' && arg.nodeId.endsWith('-arg')) {
					const withoutSuffix = arg.nodeId.slice(0, -4);
					this.reads(arg.nodeId, withoutSuffix);
				}
			} else if(!this.hasVertex(arg.nodeId, true)) {
				this.use(arg.nodeId, arg.name, { cds: arg.cds });
				this.argument(id, arg.nodeId);
			}
		}
	}

	/**
	 * Adds a **vertex** for a **variable definition** (V4).
	 * @param id     - AST node ID
	 * @param name   - Variable name
	 * @param info   - Additional/optional properties.
	 * @param asRoot - Should the vertex be part of the root vertex set of the graph
	 * (i.e., be a valid entry point), or is it nested (e.g., as part of a function definition)
	 */
	public defineVariable(id: NodeId, name?: string,
		info?: { cds?: ControlDependency[], definedBy?: NodeId[] }, asRoot: boolean = true) {
		this.addVertexWithDefaultEnv({
			tag: VertexType.VariableDefinition,
			id:  NodeId.normalize(id),
			name,
			cds: normalizeCds(info?.cds),
		}, asRoot);
		if(info?.definedBy) {
			for(const def of info.definedBy) {
				this.definedBy(id, def);
			}
		}
		return this;
	}

	/**
	 * Adds a **vertex** for **variable use** (V5). Intended for creating dataflow graphs as part of function tests.
	 * @param id     - AST node id
	 * @param name   - Variable name
	 * @param info   - Additional/optional properties; i.e., scope, when, or environment.
	 * @param asRoot - should the vertex be part of the root vertex set of the graph
	 * (i.e., be a valid entry point) or is it nested (e.g., as part of a function definition)
	 */
	public use(id: NodeId, name?: string, info?: Partial<DataflowGraphVertexUse>, asRoot: boolean = true) {
		return this.addVertexWithDefaultEnv(deepMergeObject({
			tag:         VertexType.Use,
			id:          NodeId.normalize(id),
			name,
			cds:         undefined,
			environment: undefined
		}, {
			...info,
			cds: normalizeCds(info?.cds)
		} as Partial<DataflowGraphVertexUse>), asRoot);
	}


	/**
	 * Adds a **vertex** for a **constant value** (V6).
	 * @param id      - AST node ID
	 * @param options - Additional/optional properties;
	 * @param asRoot  - should the vertex be part of the root vertex set of the graph
	 * (i.e., be a valid entry point), or is it nested (e.g., as part of a function definition)
	 */
	public constant(id: NodeId, options?: { cds?: ControlDependency[] }, asRoot: boolean = true) {
		return this.addVertexWithDefaultEnv({
			tag:         VertexType.Value,
			id:          NodeId.normalize(id),
			cds:         normalizeCds(options?.cds),
			environment: undefined
		}, asRoot);
	}

	private edgeHelper(from: NodeId, to: DataflowGraphEdgeTarget, type: EdgeType) {
		if(Array.isArray(to)) {
			for(const t of to) {
				this.edgeHelper(from, t as NodeId, type);
			}
			return this;
		}
		return this.addEdge(NodeId.normalize(from), NodeId.normalize(to as NodeId), type);
	}

	/**
	 * Adds a **read edge**.
	 * @param from - NodeId of the source vertex
	 * @param to   - Either a single or multiple target ids.
	 *               If you pass multiple this will construct a single edge for each of them.
	 */
	public reads(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.Reads);
	}

	/**
	 * Adds a **defined-by edge** with from as defined variable, and to
	 * as a variable/function contributing to its definition.
	 * @see {@link DataflowGraphBuilder#reads|reads} for parameters.
	 */
	public definedBy(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.DefinedBy);
	}

	/**
	 * Adds a **call edge** with from as caller, and to as callee.
	 * @see {@link DataflowGraphBuilder#reads|reads} for parameters.
	 */
	public calls(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.Calls);
	}

	/**
	 * Adds a **return edge** with from as function, and to as exit point.
	 * @see {@link DataflowGraphBuilder#reads|reads} for parameters.
	 */
	public returns(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.Returns);
	}

	/**
	 * Adds a **defines-on-call edge** with from as variable, and to as its definition
	 * @see {@link DataflowGraphBuilder#reads|reads} for parameters.
	 */
	public definesOnCall(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.DefinesOnCall);
	}

	/**
	 * Adds a **defined-by-on-call edge** with from as definition, and to as variable.
	 * @see {@link DataflowGraphBuilder#reads|reads} for parameters.
	 */
	public definedByOnCall(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.DefinedByOnCall);
	}

	/**
	 * Adds an **argument edge** with from as function call, and to as argument.
	 * @see {@link DataflowGraphBuilder#reads|reads} for parameters.
	 */
	public argument(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.Argument);
	}

	/**
	 * Adds a **non-standard evaluation edge** with from as vertex, and to as vertex.
	 * @see {@link DataflowGraphBuilder#reads|reads} for parameters.
	 */
	public nse(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.NonStandardEvaluation);
	}

	/**
	 * Adds a **side-effect-on-call edge** with from as vertex, and to as vertex.
	 * @see {@link DataflowGraphBuilder#reads|reads} for parameters.
	 */
	public sideEffectOnCall(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.SideEffectOnCall);
	}

	/**
	 * explicitly overwrite the root ids of the graph,
	 * this is just an easier variant in case you working with a lot of functions this saves you a lot of `false` flags.
	 */
	public overwriteRootIds(ids: readonly NodeId[]) {
		this.rootVertices = new Set(ids.map(NodeId.normalize));
		return this;
	}
}

