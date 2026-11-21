import type { BrandedIdentifier } from '../environments/identifier';
import { deepMergeObject } from '../../util/objects';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { AstIdMap } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { type DataflowFunctionFlowInformation, DataflowGraph, FunctionArgument } from './graph';
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
import { type ControlDependency, type ExitPoint, ExitPointType } from '../info';
import { getDefaultProcessor } from '../environments/default-builtin-config';
import { contextFromInput } from '../../project/context/flowr-analyzer-context';
import type { HookInformation } from '../hooks';
import { BuiltInProcName } from '../environments/built-in-proc-name';
import { autoPrintReads, PrintWrites } from '../internal/process/functions/call/built-in/built-in-ambient-state';

/** Creates an empty dataflow graph. Should only be used in tests and documentation. */
export function emptyGraph(this: void, cleanEnv?: REnvironmentInformation, idMap?: AstIdMap) {
	return new DataflowGraphBuilder(cleanEnv, idMap);
}

export type DataflowGraphEdgeTarget = NodeId | (readonly NodeId[]);

/** This DataflowGraphBuilder extends {@link DataflowGraph} with builder methods to easily and compactly add vertices and edges to a dataflow graph. */
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

	/** Adds a **vertex** for a **function definition** (V1). */
	public defineFunction(id: NodeId,
		exitPoints: readonly ExitPoint[] | readonly NodeId[], subflow: Omit<DataflowFunctionFlowInformation, 'hooks' | 'in' | 'out' | 'unknownReferences'> & Partial<Pick<DataflowFunctionFlowInformation, 'in' | 'out' | 'unknownReferences'>> & { hooks?: HookInformation[] },
		info?: { environment?: REnvironmentInformation, builtInEnvironment?: IEnvironment, cds?: readonly ControlDependency[], readParams?: [NodeId, boolean][], mode?: DataflowGraphVertexFunctionDefinition['mode'] },
		asRoot: boolean = true) {
		return this.addVertexWithDefaultEnv({
			tag:     VertexType.FunctionDefinition,
			id,
			params:  Object.fromEntries(info?.readParams ?? []),
			subflow: {
				...subflow,
				in:                subflow.in ?? [],
				out:               subflow.out ?? [],
				unknownReferences: subflow.unknownReferences ?? [],
				graph:             new Set(subflow.graph),
				hooks:             subflow.hooks ?? [],
			},
			mode:       info?.mode,
			exitPoints: exitPoints.map(e => typeof e === 'object' ? e :
				({ nodeId: e, type: ExitPointType.Default, cds: undefined })
			),
			cds:         info?.cds,
			environment: info?.environment,
		}, asRoot);
	}

	/** Adds a **vertex** for a **function call** (V2). */
	public call(id: NodeId, name: BrandedIdentifier, args: FunctionArgument[],
		info?: {
			returns?:            readonly NodeId[],
			/** what the call reads, it also calls each built-in among them */
			reads?:              readonly NodeId[],
			onlyBuiltIn?:        boolean,
			/** whether a call of only built-ins keeps its environment, as one looking names up in it does (`get`) */
			keepsEnvironment?:   boolean,
			environment?:        REnvironmentInformation,
			builtInEnvironment?: IEnvironment,
			cds?:                readonly ControlDependency[],
			origin?:             FunctionOriginInformation[]
			link?:               DataflowGraphVertexAstLink,
			omitArgs?:           boolean
		},
		asRoot: boolean = true) {
		const onlyBuiltInAuto = info?.reads?.length === 1 && NodeId.isBuiltIn(info?.reads[0]);
		this.addVertexWithDefaultEnv({
			tag:         VertexType.FunctionCall,
			id,
			name,
			args:        args.map(a => a === EmptyArgument ? EmptyArgument : { ...a, cds: undefined }),
			environment: (info?.onlyBuiltIn || onlyBuiltInAuto) && !info?.keepsEnvironment ? undefined : info?.environment ?? this.defaultEnvironment,
			cds:         info?.cds,
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
				if(NodeId.isBuiltIn(call)) {
					this.calls(id, call);
				}
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
				const wrapped = NodeId.wrappedByArgument(arg.nodeId);
				if(wrapped !== undefined) {
					this.reads(arg.nodeId, wrapped);
				}
			} else if(!this.hasVertex(arg.nodeId, true)) {
				this.use(arg.nodeId, arg.name, { cds: arg.cds });
				this.argument(id, arg.nodeId);
			}
		}
	}

	/** States that R prints the top-level values `ids` by an implicit `print`, which reads the printing options, or every option for a value a method may print (`dispatched`), and prints into the diversion of the output, see {@link autoPrintReads}. */
	public autoPrints(ids: readonly NodeId[], dispatched = false): this {
		for(const id of ids) {
			this.recordAmbientAccess(id, { reads: autoPrintReads(dispatched), writes: PrintWrites });
		}
		return this;
	}

	/** Adds a **vertex** for a **variable definition** (V4). */
	public defineVariable(id: NodeId, name?: BrandedIdentifier,
		info?: { cds?: readonly ControlDependency[], definedBy?: NodeId[] }, asRoot: boolean = true) {
		this.addVertexWithDefaultEnv({
			tag: VertexType.VariableDefinition,
			id,
			name,
			cds: info?.cds,
		}, asRoot);
		if(info?.definedBy) {
			for(const def of info.definedBy) {
				this.definedBy(id, def);
			}
		}
		return this;
	}

	/** Adds a **vertex** for **variable use** (V5). Intended for creating dataflow graphs as part of function tests. */
	public use(id: NodeId, name?: BrandedIdentifier, info?: Partial<DataflowGraphVertexUse>, asRoot: boolean = true) {
		return this.addVertexWithDefaultEnv(deepMergeObject({
			tag:         VertexType.Use,
			id,
			name,
			cds:         undefined,
			environment: undefined
		}, info as Partial<DataflowGraphVertexUse>), asRoot);
	}

	/** Adds a **vertex** for a **constant value** (V6). */
	public constant(id: NodeId, options?: { cds?: readonly ControlDependency[] }, asRoot: boolean = true) {
		return this.addVertexWithDefaultEnv({
			tag:         VertexType.Value,
			id,
			cds:         options?.cds,
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
		return this.addEdge(from, to as NodeId, type);
	}

	/** Adds a **read edge**. */
	public reads(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.Reads);
	}

	/** Adds a **defined-by edge** with from as defined variable, and to as a variable/function contributing to its definition. */
	public definedBy(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.DefinedBy);
	}

	/** Adds a **call edge** with from as caller, and to as callee. */
	public calls(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.Calls);
	}

	/** Adds a **return edge** with from as function, and to as exit point. */
	public returns(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.Returns);
	}

	/** Adds a **defines-on-call edge** with from as variable, and to as its definition */
	public definesOnCall(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.DefinesOnCall);
	}

	/** Adds a **defined-by-on-call edge** with from as definition, and to as variable. */
	public definedByOnCall(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.DefinedByOnCall);
	}

	/** Adds an **argument edge** with from as function call, and to as argument. */
	public argument(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.Argument);
	}

	/** Adds a **non-standard evaluation edge** with from as vertex, and to as vertex. */
	public nse(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.NonStandardEvaluation);
	}

	/** Adds a **side-effect-on-call edge** with from as vertex, and to as vertex. */
	public sideEffectOnCall(from: NodeId, to: DataflowGraphEdgeTarget) {
		return this.edgeHelper(from, to, EdgeType.SideEffectOnCall);
	}

	/** explicitly overwrite the root ids of the graph, this is just an easier variant in case you working with a lot of functions this saves you a lot of `false` flags. */
	public overwriteRootIds(ids: readonly NodeId[]) {
		this.rootVertices = new Set(ids);
		return this;
	}
}

