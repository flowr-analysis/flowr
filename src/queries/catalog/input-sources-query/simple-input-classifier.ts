import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { FunctionArgument } from '../../../dataflow/graph/graph';
import type { MergeableRecord } from '../../../util/objects';
import { compactRecord } from '../../../util/objects';
import type {
	DataflowGraphVertexInfo,
	DataflowGraphVertexFunctionCall,
	DataflowGraphVertexVariableDefinition, DataflowGraphVertexArgument
} from '../../../dataflow/graph/vertex';
import { VertexType } from '../../../dataflow/graph/vertex';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { OriginType } from '../../../dataflow/origin/dfg-get-origin';
import { DfEdge, EdgeType } from '../../../dataflow/graph/edge';
import { Identifier } from '../../../dataflow/environments/identifier';
import { RoleInParent } from '../../../r-bridge/lang-4.x/ast/model/processing/role';
import { isNotUndefined } from '../../../util/assert';
import { uniqueArray } from '../../../util/collections/arrays';
import { BuiltInProcName } from '../../../dataflow/environments/built-in-proc-name';
import type { FlowrSearchLike } from '../../../search/flowr-search-builder';
import { Record } from '../../../util/record';
import { RNumber } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-number';
import { RString } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RLogical } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RNull } from '../../../r-bridge/lang-4.x/convert-values';


function isConstantLike(type: InputType): boolean {
	return type === InputType.Constant || type === InputType.DerivedConstant;
}

/** Returns the common value shared by all defined entries, or `undefined` if they disagree or all are `undefined`. */
function singleValue(values: (ConstantValue | undefined)[]): ConstantValue | undefined {
	let result: ConstantValue | undefined;
	let seen = false;
	for(const v of values) {
		if(v === undefined) {
			return undefined;
		}
		if(!seen) {
			result = v;
			seen = true;
		} else if(v !== result) {
			return undefined;
		}
	}
	return result;
}

/**
 * Accumulates types, control-dependency types, values, and purity while traversing origin
 * chains. Call {@link build} to produce the resulting {@link InputSource}.
 */
class ClassificationAccumulator {
	readonly types:  InputType[]                   = [];
	readonly cds:    InputType[]                   = [];
	readonly values: (ConstantValue | undefined)[] = [];
	allPure = true;

	merge(c: InputSource): void {
		this.types.push(...c.types);
		this.values.push(c.value);
		if(c.cds) {
			this.cds.push(...c.cds);
		}
		if(c.trace !== InputTraceType.Pure) {
			this.allPure = false;
		}
	}

	pushUnknown(): void {
		this.types.push(InputType.Unknown);
		this.values.push(undefined);
	}

	build(id: NodeId): InputSource {
		const types = this.types.length === 0 ? [InputType.Unknown] : uniqueArray(this.types);
		const trace = this.allPure ? InputTraceType.Pure : InputTraceType.Alias;
		const src: InputSource = { id, types, trace };
		const cds = this.cds.length === 0 ? undefined : uniqueArray(this.cds);
		if(cds) {
			src.cds = cds;
		}
		if(types.every(isConstantLike)) {
			const v = singleValue(this.values);
			if(v !== undefined) {
				src.value = v;
			}
		}
		return src;
	}
}

class InputClassifier {
	private readonly dfg:     DataflowGraph;
	private readonly config:  InputClassifierConfig<InputClassifierFunctionIdentifiers>;
	private readonly cache = new Map<NodeId, InputSource>();
	private readonly fullDfg: DataflowGraph | undefined;

	constructor(dfg: DataflowGraph, config: InputClassifierConfig<InputClassifierFunctionIdentifiers>, fullDfg?: DataflowGraph) {
		this.dfg = dfg;
		this.config = config;
		this.fullDfg = fullDfg;
	}

	private isDefinedByOnCall(id: NodeId): boolean {
		const out = (this.fullDfg ?? this.dfg).outgoingEdges(id) ?? new Map<NodeId, DfEdge>();
		return out.values().some(e => DfEdge.includesType(e, EdgeType.DefinedByOnCall));
	}

	private extractConstantValue(id: NodeId): ConstantValue | undefined {
		const node = this.dfg.idMap?.get(id);
		if(node === undefined) {
			return undefined;
		}
		if(RNumber.is(node))  {
			return node.content.num;
		}
		if(RString.is(node))  {
			return node.content.str;
		}
		if(RLogical.is(node)) {
			return node.content;
		}
		if(RSymbol.is(node) && node.content === RNull) {
			return null;
		}
		return undefined;
	}

	public classifyEntry(vertex: DataflowGraphVertexInfo): InputSource {
		const cached = this.cache.get(vertex.id);
		if(cached) {
			return cached;
		}

		// insert temporary unknown to break cycles
		this.cache.set(vertex.id, { id: vertex.id, types: [InputType.Unknown], trace: InputTraceType.Unknown });

		switch(vertex.tag) {
			case VertexType.Value: {
				const src: InputSource = { id: vertex.id, types: [InputType.Constant], trace: InputTraceType.Unknown };
				const v = this.extractConstantValue(vertex.id);
				if(v !== undefined) {
					src.value = v;
				}
				return this.classifyCdsAndReturn(vertex, src);
			}
			case VertexType.FunctionCall:
				return this.classifyFunctionCall(vertex);
			case VertexType.VariableDefinition:
				return this.classifyVariableDefinition(vertex);
			case VertexType.Use:
				return this.classifyVariable(vertex);
			default:
				return this.classifyCdsAndReturn(vertex, { id: vertex.id, types: [InputType.Unknown], trace: InputTraceType.Unknown });
		}
	}

	private classifyFunctionCall(call: DataflowGraphVertexFunctionCall): InputSource {
		if(call.origin.includes(BuiltInProcName.IfThenElse) || call.origin.includes(BuiltInProcName.WhileLoop)) {
			const condition = FunctionArgument.getReference(call.args[0]);
			if(condition) {
				const vtx = this.dfg.getVertex(condition);
				if(vtx) {
					return this.classifyCdsAndReturn(call, this.classifyEntry(vtx));
				}
			}
		} else if(call.origin.includes(BuiltInProcName.ForLoop)) {
			const condition = FunctionArgument.getReference(call.args[1]);
			if(condition) {
				const vtx = this.dfg.getVertex(condition);
				if(vtx) {
					return this.classifyCdsAndReturn(call, this.classifyEntry(vtx));
				}
			}
		}
		if(!matchesList(call, this.config.pure)) {
			const types: InputType[] = [];

			for(const [type, entry] of Record.entries(this.config)) {
				if(Record.values<string>(InputType).includes(type) && matchesList(call, entry)) {
					types.push(type as InputType);
				}
			}
			if(types.length === 0) {
				// if it is not pure, we cannot classify based on the inputs, in that case we do not know!
				types.push(InputType.Unknown);
			}
			return this.classifyCdsAndReturn(call, { id: call.id, types, trace: InputTraceType.Unknown });
		}


		// Otherwise, classify by arguments; pure functions get Known/Pure handling
		const argTypes: InputType[] = [];
		const cdTypes: InputType[] = [];
		for(const arg of call.args) {
			if(FunctionArgument.isEmpty(arg)) {
				continue;
			}
			const ref = FunctionArgument.getReference(arg);
			if(ref === undefined) {
				argTypes.push(InputType.Unknown);
				continue;
			}
			const argVtx = this.dfg.getVertex(ref);
			if(!argVtx) {
				argTypes.push(InputType.Unknown);
				continue;
			}
			const classified = this.classifyEntry(argVtx);
			// collect all observed types from this argument
			argTypes.push(...classified.types);
			if(classified.cds) {
				cdTypes.push(...classified.cds);
			}
		}
		const cds = cdTypes.length > 0 ? uniqueArray(cdTypes) : undefined;

		// all arguments only contain constant-like types -> derived constant
		const allConstLike = argTypes.length > 0 && argTypes.every(isConstantLike);
		if(allConstLike) {
			return this.classifyCdsAndReturn(call, compactRecord({ id: call.id, types: [InputType.DerivedConstant], trace: InputTraceType.Pure, cds }));
		}

		argTypes.push(InputType.DerivedConstant);
		return this.classifyCdsAndReturn(call, compactRecord({ id: call.id, types: uniqueArray(argTypes), trace: InputTraceType.Known, cds }));
	}

	private classifyVariable(vtx: DataflowGraphVertexInfo): InputSource {
		const origins = Dataflow.origin(this.dfg, vtx.id);

		if(origins === undefined) {
			return this.classifyCdsAndReturn(vtx, { id: vtx.id, types: this.isDefinedByOnCall(vtx.id) ? [InputType.Scope] : [InputType.Unknown], trace: InputTraceType.Unknown });
		}

		const acc = new ClassificationAccumulator();
		for(const o of origins) {
			if(o.type === OriginType.ConstantOrigin) {
				acc.types.push(InputType.DerivedConstant);
				acc.values.push(this.extractConstantValue(o.id));
			} else if(o.type === OriginType.ReadVariableOrigin || o.type === OriginType.WriteVariableOrigin) {
				this.classifyVariableOrigin(o.id, acc);
			} else if(o.type === OriginType.FunctionCallOrigin || o.type === OriginType.BuiltInFunctionOrigin) {
				this.classifyByVertex(o.id, acc);
			} else {
				acc.pushUnknown();
			}
		}
		return this.classifyCdsAndReturn(vtx, acc.build(vtx.id));
	}

	/**
	 * Resolves a variable definition or use origin, handling the special cases of
	 * scope-escaped variables (DefinedByOnCall) and parameter definitions.
	 */
	private classifyVariableOrigin(definitionId: NodeId, acc: ClassificationAccumulator): void {
		const v = this.dfg.getVertex(definitionId);
		if(!v) {
			acc.pushUnknown();
			return;
		}
		// if the referenced definition is linked via defined-by-on-call to another
		// id (e.g., a parameter linked to a caller argument), mark it as a Scope origin
		if(this.isDefinedByOnCall(v.id)) {
			acc.types.push(InputType.Scope);
			acc.values.push(undefined);
			acc.allPure = false;
		}
		// if this is a variable definition that is a parameter, classify as Parameter
		if(v.tag === VertexType.VariableDefinition && this.dfg.idMap?.get(v.id)?.info.role === RoleInParent.ParameterName) {
			acc.types.push(InputType.Parameter);
			acc.values.push(undefined);
			return;
		}
		acc.merge(this.classifyEntry(v));
	}

	private classifyByVertex(id: NodeId, acc: ClassificationAccumulator): void {
		const v = this.dfg.getVertex(id);
		if(v) {
			acc.merge(this.classifyEntry(v));
		} else  {
			acc.pushUnknown();
		}
	}

	private classifyVariableDefinition(vtx: DataflowGraphVertexVariableDefinition): InputSource {
		// parameter definitions are classified as Parameter
		if(this.dfg.idMap?.get(vtx.id)?.info.role === RoleInParent.ParameterName) {
			return this.classifyCdsAndReturn(vtx, { id: vtx.id, types: [InputType.Parameter], trace: InputTraceType.Unknown });
		}

		const sources = vtx.source;
		if(sources === undefined || sources.length === 0) {
			// fallback to unknown if we cannot find the value
			return this.classifyCdsAndReturn(vtx, { id: vtx.id, types: [InputType.Unknown], trace: InputTraceType.Unknown });
		}

		const acc = new ClassificationAccumulator();
		for(const tid of sources) {
			const tv = this.dfg.getVertex(tid);
			if(tv) {
				acc.merge(this.classifyEntry(tv));
			} else   {
				acc.pushUnknown();
			}
		}
		return this.classifyCdsAndReturn(vtx, acc.build(vtx.id));
	}

	private classifyCdsAndReturn(vtx: DataflowGraphVertexArgument, src: InputSource): InputSource {
		if(vtx.cds) {
			const cds = uniqueArray(vtx.cds.flatMap(c => {
				const cv = this.dfg.getVertex(c.id);
				if(!cv) {
					return undefined;
				}
				const e = this.classifyEntry(cv);
				return e.cds ? [...e.types, ...e.cds] : [...e.types];
			}).filter(isNotUndefined).concat(src.cds ?? []));
			if(cds.length > 0) {
				src.cds = cds;
			}
		}
		if(src.cds?.length === 0) {
			delete src.cds;
		}
		this.cache.set(vtx.id, src);
		return src;
	}
}

/**
 * Lattice flattening until we have a taint engine :)
 * Please note that the classifier considers this basis with a set-lift,
 * joining differing lattice elements.
 *
 *```
 *              [ Unknown ]
 *                   |
 * [Param] [File] [Net] [User], ...
 *                   |
 *            [ DerivedConstant ]
 *                   |
 *              [ Constant ]
 *```
 *
 */
export enum InputType {
	Parameter = 'param',
	File = 'file',
	Network = 'net',
	Random = 'rand',
	/** Calls to system/system2 and similar */
	System = 'system',
	/** Calls to .C / Fortran interfaces (foreign function interfaces) */
	Ffi = 'ffi',
	/** Language objects (quote/substitute/etc.) */
	Lang = 'lang',
	/** Global options / option accessors (options, getOption) */
	Options = 'options',
	/** Interactive user input (file choosers, prompts, dialogs, menu selections) */
	User = 'user',
	Constant = 'const',
	/** Read from environment/call scope */
	Scope = 'scope',
	/** Pure calculations from constants that lead to a constant */
	DerivedConstant = 'dconst',
	Unknown = 'unknown',
}

export enum InputTraceType {
	/** Derived only from aliasing */
	Alias = 'alias',
	/** Derived from pure function chains */
	Pure = 'pure',
	/** Derived from known but not necessarily all pure function chains */
	Known = 'known',
	/** Not fully known origin */
	Unknown = 'unknown'
}

/**
 * Scalar R constant values representable in TypeScript.
 * `null` corresponds to R's `NULL`.
 * NA values are not included (they have no direct TS equivalent).
 */
export type ConstantValue = string | number | boolean | null;

/**
 * Object attached to an input source
 * @see {@link InputSources}
 */
export interface InputSource extends MergeableRecord {
	id:     NodeId,
	types:  InputType[],
	trace:  InputTraceType,
	/** if the trace is affected by control dependencies, they are classified too, this is a duplicate free array */
	cds?:   InputType[],
	/** the concrete scalar value when the source is a constant or a pure alias of one */
	value?: ConstantValue
}


/**
 * Map of input sources, keyed by the node id of the input source. Each input source is classified with an {@link InputSource} object.
 */
export type InputSources = InputSource[];

/**
 * This is either an {@link NodeId|id} of a known functions all of that category (e.g., you can issue a dependencies query before and then pass all
 * identified ids to this query here).
 */
export type InputClassifierFunctionIdentifiers = readonly (Identifier | NodeId)[];

function matchesList(fn: DataflowGraphVertexFunctionCall, list: InputClassifierFunctionIdentifiers | undefined): boolean {
	if(list === undefined || list.length === 0) {
		return false;
	}
	for(const id of list) {
		if(fn.id === id || (Identifier.is(id) && Identifier.matches(id, fn.name))) {
			return true;
		}
	}
	return false;
}

/**
 * For the specifications of `pure` etc. please have a look at {@link InputClassifierFunctionIdentifiers}.
 */
export interface InputClassifierConfig<Functions extends InputClassifierFunctionIdentifiers | FlowrSearchLike = readonly Identifier[] | FlowrSearchLike> extends Partial<Record<InputType, Functions>> {
	/**
	 * Functions which are considered to be pure (i.e., deterministic, trusted, safe, idempotent on the lub of the input types)
	 */
	[InputTraceType.Pure]?: Functions
}

/**
 * Takes the given id which is expected to either be:
 * - a function call - in this case all arguments are considered to be inputs (additionally to all read edges from the function call in the dataflow graph)
 * - anything else - in that case the node itself is considered as an "input" - please note that in these scenarios the *return* value will only contain one mapping - that for the id you passed in.
 *
 * This method traces the dependencies in the dataflow graph using the specification of functions passed in.
 * For the scope escape analysis, pass on the full, non-reduced DFG as `fullDfg`.
 */
export function classifyInput(id: NodeId, dfg: DataflowGraph, config: InputClassifierConfig<InputClassifierFunctionIdentifiers>, fullDfg?: DataflowGraph): InputSources {
	const vtx = dfg.getVertex(id);
	if(!vtx) {
		return [];
	}
	const c = new InputClassifier(dfg, config, fullDfg);

	if(vtx.tag === VertexType.FunctionCall) {
		const ret: InputSources = [];
		const args = vtx.args;
		for(const arg of args) {
			if(FunctionArgument.isEmpty(arg)) {
				continue;
			}
			const ref = FunctionArgument.getReference(arg);
			if(ref === undefined) {
				continue;
			}
			const argVtx = dfg.getVertex(ref);
			if(argVtx === undefined) {
				continue;
			}
			ret.push(c.classifyEntry(argVtx));
		}
		return ret;
	} else {
		return [
			c.classifyEntry(vtx)
		];
	}
}
