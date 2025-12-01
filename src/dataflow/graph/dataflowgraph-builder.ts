import { deepMergeObject } from '../../util/objects';
import { type NodeId, normalizeIdToNumberIfPossible } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { AstIdMap } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import {
	type DataflowFunctionFlowInformation,
	DataflowGraph,
	type FunctionArgument,
	isPositionalArgument
} from './graph';
import { type IEnvironment, type REnvironmentInformation } from '../environments/environment';
import {
	type DataflowGraphVertexArgument,
	type DataflowGraphVertexAstLink, type DataflowGraphVertexInfo,
	type DataflowGraphVertexUse,
	type FunctionOriginInformation,
	VertexType
} from './vertex';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { isBuiltIn } from '../environments/built-in';
import { EdgeType } from './edge';
import type { ControlDependency } from '../info';
import type { LinkTo } from '../../queries/catalog/call-context-query/call-context-query-format';
import { DefaultBuiltinConfig, getDefaultProcessor } from '../environments/default-builtin-config';
import type { FlowrSearchLike } from '../../search/flowr-search-builder';
import { runSearch } from '../../search/flowr-search-executor';
import { guard } from '../../util/assert';
import type { ReadonlyFlowrAnalysisProvider } from '../../project/flowr-analyzer';
import { contextFromInput } from '../../project/context/flowr-analyzer-context';

/**
 * Creates an empty dataflow graph.
 * Should only be used in tests and documentation.
 */
export function emptyGraph(cleanEnv?: REnvironmentInformation, idMap?: AstIdMap) {
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
	 * @param id - AST node ID
	 * @param subflow - Subflow data graph for the defined function.
	 * @param exitPoints - Node IDs for exit point vertices.
	 * @param info - Additional/optional properties.
	 * @param asRoot - should the vertex be part of the root vertex set of the graph
	 * (i.e., be a valid entry point), or is it nested (e.g., as part of a function definition)
	 */
	public defineFunction(id: NodeId,
		exitPoints: readonly NodeId[], subflow: DataflowFunctionFlowInformation,
		info?: { environment?: REnvironmentInformation, builtInEnvironment?: IEnvironment, controlDependencies?: ControlDependency[] },
		asRoot: boolean = true) {
		return this.addVertexWithDefaultEnv({
			tag:     VertexType.FunctionDefinition,
			id:      normalizeIdToNumberIfPossible(id),
			subflow: {
				...subflow,
				entryPoint:        normalizeIdToNumberIfPossible(subflow.entryPoint),
				graph:             new Set([...subflow.graph].map(normalizeIdToNumberIfPossible)),
				out:               subflow.out.map(o => ({ ...o, nodeId: normalizeIdToNumberIfPossible(o.nodeId), controlDependencies: o.controlDependencies?.map(c => ({ ...c, id: normalizeIdToNumberIfPossible(c.id) })) })),
				in:                subflow.in.map(o => ({ ...o, nodeId: normalizeIdToNumberIfPossible(o.nodeId), controlDependencies: o.controlDependencies?.map(c => ({ ...c, id: normalizeIdToNumberIfPossible(c.id) })) })),
				unknownReferences: subflow.unknownReferences.map(o => ({ ...o, nodeId: normalizeIdToNumberIfPossible(o.nodeId), controlDependencies: o.controlDependencies?.map(c => ({ ...c, id: normalizeIdToNumberIfPossible(c.id) })) }))
			} as DataflowFunctionFlowInformation,
			exitPoints:  exitPoints.map(normalizeIdToNumberIfPossible),
			cds:         info?.controlDependencies?.map(c => ({ ...c, id: normalizeIdToNumberIfPossible(c.id) })),
			environment: info?.environment,
		}, asRoot);
	}

	/**
	 * Adds a **vertex** for a **function call** (V2).
	 * @param id - AST node ID
	 * @param name - Function name
	 * @param args - Function arguments; may be empty
	 * @param info - Additional/optional properties.
	 * @param asRoot - should the vertex be part of the root vertex set of the graph
	 * (i.e., be a valid entry point), or is it nested (e.g., as part of a function definition)
	 */
	public call(id: NodeId, name: string, args: FunctionArgument[],
		info?: {
			returns?:             readonly NodeId[],
			reads?:               readonly NodeId[],
			onlyBuiltIn?:         boolean,
			environment?:         REnvironmentInformation,
			builtInEnvironment?:  IEnvironment,
			controlDependencies?: ControlDependency[],
			origin?:              FunctionOriginInformation[]
			link?:                DataflowGraphVertexAstLink
		},
		asRoot: boolean = true) {
		const onlyBuiltInAuto = info?.reads?.length === 1 && isBuiltIn(info?.reads[0]);
		this.addVertexWithDefaultEnv({
			tag:         VertexType.FunctionCall,
			id:          normalizeIdToNumberIfPossible(id),
			name,
			args:        args.map(a => a === EmptyArgument ? EmptyArgument : { ...a, nodeId: normalizeIdToNumberIfPossible(a.nodeId), controlDependencies: undefined }),
			environment: (info?.onlyBuiltIn || onlyBuiltInAuto) ? undefined : info?.environment ?? this.defaultEnvironment,
			cds:         info?.controlDependencies?.map(c => ({ ...c, id: normalizeIdToNumberIfPossible(c.id) })),
			onlyBuiltin: info?.onlyBuiltIn ?? onlyBuiltInAuto ?? false,
			origin:      info?.origin ?? [ getDefaultProcessor(name) ?? 'function' ],
			link:        info?.link
		}, asRoot);
		this.addArgumentLinks(id, args);
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
			if(arg === EmptyArgument) {
				continue;
			}
			if(isPositionalArgument(arg)) {
				this.argument(id, arg.nodeId);
				if(typeof arg.nodeId === 'string' && arg.nodeId.endsWith('-arg')) {
					const withoutSuffix = arg.nodeId.slice(0, -4);
					this.reads(arg.nodeId, withoutSuffix);
				}
			} else if(!this.hasVertex(arg.nodeId, true)) {
				this.use(arg.nodeId, arg.name, { cds: arg.controlDependencies });
				this.argument(id, arg.nodeId);
			}
		}
	}

	/**
	 * Adds a **vertex** for a **variable definition** (V4).
	 * @param id - AST node ID
	 * @param name - Variable name
	 * @param info - Additional/optional properties.
	 * @param asRoot - Should the vertex be part of the root vertex set of the graph
	 * (i.e., be a valid entry point), or is it nested (e.g., as part of a function definition)
	 */
	public defineVariable(id: NodeId, name?: string,
		info?: { controlDependencies?: ControlDependency[], definedBy?: NodeId[]}, asRoot: boolean = true) {
		this.addVertexWithDefaultEnv({
			tag: VertexType.VariableDefinition,
			id:  normalizeIdToNumberIfPossible(id),
			name,
			cds: info?.controlDependencies?.map(c => ({ ...c, id: normalizeIdToNumberIfPossible(c.id) })),
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
	 * @param id - AST node id
	 * @param name - Variable name
	 * @param info - Additional/optional properties; i.e., scope, when, or environment.
	 * @param asRoot - should the vertex be part of the root vertex set of the graph
	 * (i.e., be a valid entry point) or is it nested (e.g., as part of a function definition)
	 */
	public use(id: NodeId, name?: string, info?: Partial<DataflowGraphVertexUse>, asRoot: boolean = true) {
		return this.addVertexWithDefaultEnv(deepMergeObject({
			tag:         VertexType.Use,
			id:          normalizeIdToNumberIfPossible(id),
			name,
			cds:         undefined,
			environment: undefined
		}, {
			...info,
			cds: info?.cds?.map(c => ({ ...c, id: normalizeIdToNumberIfPossible(c.id) }))
		} as Partial<DataflowGraphVertexUse>), asRoot);
	}


	/**
	 * Adds a **vertex** for a **constant value** (V6).
	 * @param id - AST node ID
	 * @param options - Additional/optional properties;
	 * @param asRoot - should the vertex be part of the root vertex set of the graph
	 * (i.e., be a valid entry point), or is it nested (e.g., as part of a function definition)
	 */
	public constant(id: NodeId, options?: { controlDependencies?: ControlDependency[] }, asRoot: boolean = true) {
		return this.addVertexWithDefaultEnv({
			tag:         VertexType.Value,
			id:          normalizeIdToNumberIfPossible(id),
			cds:         options?.controlDependencies?.map(c => ({ ...c, id: normalizeIdToNumberIfPossible(c.id) })),
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
		return this.addEdge(normalizeIdToNumberIfPossible(from), normalizeIdToNumberIfPossible(to as NodeId), type);
	}

	private async queryHelper(from: FromQueryParam, to: ToQueryParam, data: ReadonlyFlowrAnalysisProvider, type: EdgeType) {
		let fromId: NodeId;
		if('nodeId' in from) {
			fromId = from.nodeId;
		} else {
			const result = (await runSearch(from.query, data)).getElements();
			guard(result.length === 1, `from query result should yield exactly one node, but yielded ${result.length}`);
			fromId = result[0].node.info.id;
		}

		let toIds: DataflowGraphEdgeTarget;
		if('target' in to) {
			toIds = to.target;
		} else {
			const result = (await runSearch(to.query, data)).getElements();
			toIds = result.map(r => r.node.info.id);
		}

		return this.edgeHelper(fromId, toIds, type);
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
	 * Adds a **read edge** with a query for the from and/or to vertices.
	 * @param from - Either a node id or a query to find the node id.
	 * @param to - Either a node id or a query to find the node id.
	 * @param input - The input to search in i.e. the dataflow graph.
	 */
	public readsQuery(from: FromQueryParam, to: ToQueryParam, input: ReadonlyFlowrAnalysisProvider) {
		return this.queryHelper(from, to, input, EdgeType.Reads);
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
	 * Adds a **defined-by edge** with a query for the from and/or to vertices.
	 * @see {@link DataflowGraphBuilder#readsQuery|readsQuery} for parameters.
	 */
	public definedByQuery(from: FromQueryParam, to: ToQueryParam, data: ReadonlyFlowrAnalysisProvider) {
		return this.queryHelper(from, to, data, EdgeType.DefinedBy);
	}

	/**
	 * Adds a **call edge** with from as caller, and to as callee.
	 * @see {@link DataflowGraphBuilder#reads|reads} for parameters.
	 */
	public calls(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.Calls);
	}

	/**
	 * Adds a **call edge** with a query for the from and/or to vertices.
	 * @see {@link DataflowGraphBuilder#readsQuery|readsQuery} for parameters.
	 */
	public callsQuery(from: FromQueryParam, to: ToQueryParam, data: ReadonlyFlowrAnalysisProvider) {
		return this.queryHelper(from, to, data, EdgeType.Calls);
	}

	/**
	 * Adds a **return edge** with from as function, and to as exit point.
	 * @see {@link DataflowGraphBuilder#reads|reads} for parameters.
	 */
	public returns(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.Returns);
	}

	/**
	 * Adds a **return edge** with a query for the from and/or to vertices.
	 * @see {@link DataflowGraphBuilder#readsQuery|readsQuery} for parameters.
	 */
	public returnsQuery(from: FromQueryParam, to: ToQueryParam, data: ReadonlyFlowrAnalysisProvider) {
		return this.queryHelper(from, to, data, EdgeType.Returns);
	}

	/**
	 * Adds a **defines-on-call edge** with from as variable, and to as its definition
	 * @see {@link DataflowGraphBuilder#reads|reads} for parameters.
	 */
	public definesOnCall(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.DefinesOnCall);
	}

	/**
	 * Adds a **defines-on-call edge** with a query for the from and/or to vertices.
	 * @see {@link DataflowGraphBuilder#readsQuery|readsQuery} for parameters.
	 */
	public definesOnCallQuery(from: FromQueryParam, to: ToQueryParam, data: ReadonlyFlowrAnalysisProvider) {
		return this.queryHelper(from, to, data, EdgeType.DefinesOnCall);
	}

	/**
	 * Adds a **defined-by-on-call edge** with from as definition, and to as variable.
	 * @see {@link DataflowGraphBuilder#reads|reads} for parameters.
	 */
	public definedByOnCall(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.DefinedByOnCall);
	}

	/**
	 * Adds a **defined-by-on-call edge** with a query for the from and/or to vertices.
	 * @see {@link DataflowGraphBuilder#readsQuery|readsQuery} for parameters.
	 */
	public definedByOnCallQuery(from: FromQueryParam, to: ToQueryParam, data: ReadonlyFlowrAnalysisProvider) {
		return this.queryHelper(from, to, data, EdgeType.DefinedByOnCall);
	}

	/**
	 * Adds an **argument edge** with from as function call, and to as argument.
	 * @see {@link DataflowGraphBuilder#reads|reads} for parameters.
	 */
	public argument(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.Argument);
	}

	/**
	 * Adds a **argument edge** with a query for the from and/or to vertices.
	 * @see {@link DataflowGraphBuilder#readsQuery|readsQuery} for parameters.
	 */
	public argumentQuery(from: FromQueryParam, to: ToQueryParam, data: ReadonlyFlowrAnalysisProvider) {
		return this.queryHelper(from, to, data, EdgeType.Argument);
	}

	/**
	 * Adds a **non-standard evaluation edge** with from as vertex, and to as vertex.
	 * @see {@link DataflowGraphBuilder#reads|reads} for parameters.
	 */
	public nse(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.NonStandardEvaluation);
	}

	/**
	 * Adds a **non-standard evaluation edge** with a query for the from and/or to vertices.
	 * @see {@link DataflowGraphBuilder#readsQuery|readsQuery} for parameters.
	 */
	public nseQuery(from: FromQueryParam, to: ToQueryParam, data: ReadonlyFlowrAnalysisProvider) {
		return this.queryHelper(from, to, data, EdgeType.NonStandardEvaluation);
	}

	/**
	 * Adds a **side-effect-on-call edge** with from as vertex, and to as vertex.
	 * @see {@link DataflowGraphBuilder#reads|reads} for parameters.
	 */
	public sideEffectOnCall(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.SideEffectOnCall);
	}

	/**
	 * Adds a **side-effect-on-call edge** with a query for the from and/or to vertices.
	 * @see {@link DataflowGraphBuilder#readsQuery|readsQuery} for parameters.
	 */
	public sideEffectOnCallQuery(from: FromQueryParam, to: ToQueryParam, data: ReadonlyFlowrAnalysisProvider) {
		return this.queryHelper(from, to, data, EdgeType.SideEffectOnCall);
	}

	/**
	 * explicitly overwrite the root ids of the graph,
	 * this is just an easier variant in case you working with a lot of functions this saves you a lot of `false` flags.
	 */
	public overwriteRootIds(ids: readonly NodeId[]) {
		this.rootVertices = new Set(ids.map(normalizeIdToNumberIfPossible));
		return this;
	}
}


/**
 *
 */
export function getBuiltInSideEffect(name: string): LinkTo<RegExp> | undefined {
	const got = DefaultBuiltinConfig.find(e => e.names.includes(name));
	if(got?.type !== 'function') {
		return undefined;
	}
	return (got?.config as { hasUnknownSideEffects: LinkTo<RegExp> | undefined }).hasUnknownSideEffects;
}

interface Query {
	query: FlowrSearchLike;
}

type FromQueryParam =
  | {
      nodeId: NodeId;
    }
  | Query;

type ToQueryParam =
  | {
      target: DataflowGraphEdgeTarget;
    }
  | Query;
