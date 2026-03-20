import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { FunctionArgument } from '../../../dataflow/graph/graph';
import type { MergeableRecord } from '../../../util/objects';
import type {
	DataflowGraphVertexInfo,
	DataflowGraphVertexFunctionCall,
	DataflowGraphVertexVariableDefinition, DataflowGraphVertexArgument
} from '../../../dataflow/graph/vertex';
import { VertexType } from '../../../dataflow/graph/vertex';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { OriginType } from '../../../dataflow/origin/dfg-get-origin';
import type { BrandedIdentifier } from '../../../dataflow/environments/identifier';
import { Identifier } from '../../../dataflow/environments/identifier';
import { RoleInParent } from '../../../r-bridge/lang-4.x/ast/model/processing/role';
import { isNotUndefined } from '../../../util/assert';
import { uniqueArray } from '../../../util/collections/arrays';
import { BuiltInProcName } from '../../../dataflow/environments/built-in-proc-name';

class InputClassifier {
	private readonly dfg:    DataflowGraph;
	private readonly config: InputClassifierConfig;
	private readonly cache = new Map<NodeId, InputSource>();

	constructor(dfg: DataflowGraph, config: InputClassifierConfig) {
		this.dfg = dfg;
		this.config = config;
	}

	public classifyEntry(vertex: DataflowGraphVertexInfo): InputSource {
		const cached = this.cache.get(vertex.id);
		if(cached) {
			return cached;
		}

		// insert temporary unknown to break cycles
		this.cache.set(vertex.id, { id: vertex.id, type: InputType.Unknown, trace: InputTraceType.Unknown });

		switch(vertex.tag) {
			case VertexType.Value:
				return this.classifyCdsAndReturn(vertex, { id: vertex.id, type: InputType.Constant, trace: InputTraceType.Unknown });
			case VertexType.FunctionCall:
				return this.classifyFunctionCall(vertex);
			case VertexType.VariableDefinition:
				return this.classifyVariableDefinition(vertex);
			case VertexType.Use:
				return this.classifyVariable(vertex);
			default:
				return this.classifyCdsAndReturn(vertex, { id: vertex.id, type: InputType.Unknown, trace: InputTraceType.Unknown });
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
		if(!matchesList(call, this.config.pureFns)) {
			if(matchesList(call, this.config.readFileFns)) {
				return this.classifyCdsAndReturn(call, { id: call.id, type: InputType.File, trace: InputTraceType.Unknown });
			} else if(matchesList(call, this.config.networkFns)) {
				return this.classifyCdsAndReturn(call, {
					id:    call.id,
					type:  InputType.Network,
					trace: InputTraceType.Unknown
				});
			} else if(matchesList(call, this.config.randomFns)) {
				return this.classifyCdsAndReturn(call, { id: call.id, type: InputType.Random, trace: InputTraceType.Unknown });
			} else {
				// if it is not pure, we cannot classify based on the inputs, in that case we do not know!
				return this.classifyCdsAndReturn(call, {
					id:    call.id,
					type:  InputType.Unknown,
					trace: InputTraceType.Unknown
				});
			}
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
			argTypes.push(classified.type);
			if(classified.cds) {
				cdTypes.push(...classified.cds);
			}
		}

		const allConstLike = argTypes.length > 0 && argTypes.every(t => t === InputType.Constant || t === InputType.DerivedConstant);
		const cds = cdTypes.length > 0 ? undefined : uniqueArray(cdTypes);
		if(allConstLike) {
			return this.classifyCdsAndReturn(call, { id: call.id, type: InputType.DerivedConstant, trace: InputTraceType.Pure, cds });
		}

		return this.classifyCdsAndReturn(call, { id: call.id, type: worstInputType(argTypes), trace: InputTraceType.Known, cds });
	}

	private classifyVariable(vtx: DataflowGraphVertexInfo): InputSource {
		const origins = Dataflow.origin(this.dfg, vtx.id);

		if(origins === undefined) {
			return this.classifyCdsAndReturn(vtx, { id: vtx.id, type: InputType.Unknown, trace: InputTraceType.Unknown });
		}

		const types: InputType[] = [];
		const cds: InputType[] = [];
		let allPure = true;

		for(const o of origins) {
			if(o.type === OriginType.ConstantOrigin) {
				types.push(InputType.Constant);
				continue;
			}

			if(o.type === OriginType.ReadVariableOrigin || o.type === OriginType.WriteVariableOrigin) {
				const v = this.dfg.getVertex(o.id);
				if(v) {
					// if this is a variable definition that is a parameter, classify as Parameter
					if(v.tag === VertexType.VariableDefinition && this.dfg.idMap?.get(v.id)?.info.role === RoleInParent.ParameterName) {
						types.push(InputType.Parameter);
						continue;
					}
					const c = this.classifyEntry(v);
					types.push(c.type);
					if(c.cds) {
						cds.push(...c.cds);
					}
					if(c.trace !== InputTraceType.Pure) {
						allPure = false;
					}
				} else {
					types.push(InputType.Unknown);
				}
				continue;
			}

			if(o.type === OriginType.FunctionCallOrigin || o.type === OriginType.BuiltInFunctionOrigin) {
				const v = this.dfg.getVertex(o.id);
				if(v) {
					const c = this.classifyEntry(v);
					types.push(c.type);
					if(c.cds) {
						cds.push(...c.cds);
					}
					if(c.trace !== InputTraceType.Pure) {
						allPure = false;
					}
				} else {
					types.push(InputType.Unknown);
				}
				continue;
			}

			// unknown origin type
			types.push(InputType.Unknown);
		}

		const t = types.length === 0 ? InputType.Unknown : worstInputType(types);
		const trace = allPure ? InputTraceType.Pure : InputTraceType.Alias;
		return this.classifyCdsAndReturn(vtx, { id: vtx.id, type: t, trace, cds: cds.length === 0 ? undefined : uniqueArray(cds) });
	}

	private classifyVariableDefinition(vtx: DataflowGraphVertexVariableDefinition): InputSource {
		// parameter definitions are classified as Parameter
		if(this.dfg.idMap?.get(vtx.id)?.info.role === RoleInParent.ParameterName) {
			return this.classifyCdsAndReturn(vtx, { id: vtx.id, type: InputType.Parameter, trace: InputTraceType.Unknown });
		}

		const sources = vtx.source;

		if(sources === undefined || sources.length === 0) {
			// fallback to unknown if we cannot find the value
			return this.classifyCdsAndReturn(vtx, { id: vtx.id, type: InputType.Unknown, trace: InputTraceType.Unknown });
		}

		const types: InputType[] = [];
		const cds: InputType[] = [];
		let allPure = true;

		for(const tid of sources) {
			const tv = this.dfg.getVertex(tid);
			if(tv) {
				const c = this.classifyEntry(tv);
				types.push(c.type);
				if(c.cds) {
					cds.push(...c.cds);
				}
				if(c.trace !== InputTraceType.Pure) {
					allPure = false;
				}
			} else {
				types.push(InputType.Unknown);
			}
		}

		const t = types.length === 0 ? InputType.Unknown : worstInputType(types);
		const trace = allPure ? InputTraceType.Pure : InputTraceType.Alias;
		return this.classifyCdsAndReturn(vtx, { id: vtx.id, type: t, trace, cds: cds.length === 0 ? undefined : uniqueArray(cds) });
	}

	private classifyCdsAndReturn(vtx: DataflowGraphVertexArgument, src: InputSource): InputSource {
		if(vtx.cds) {
			const cds = uniqueArray(vtx.cds.flatMap(c => {
				const cv = this.dfg.getVertex(c.id);
				if(!cv) {
					return undefined;
				}
				const e = this.classifyEntry(cv);
				return e.cds ? [e.type, ...e.cds] : [e.type];
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
 *
 *```
 *            [ Unknown ]
 *     /     /     |     \       \
 *[Param] [File] [Net] [Rand] [Scope]
 *     \     \    |      /      /
 *        [ DerivedConstant ]
 *               |
 *          [ Constant ]
 *```
 *
 */
export enum InputType {
	Parameter = 'param',
	File = 'file',
	Network = 'net',
	Random = 'rand',
	Constant = 'const',
	/** Read from environment/call scope */
	Scope = 'scope',
	/** Pure calculations from constants that lead to a constant */
	DerivedConstant = 'dconst',
	Unknown = 'unknown',
}

/**
 * Basically the worst input type that can be classified; the lattice lub
 * @see {@link InputType} for the representation
 */
function worstInputType(types: readonly InputType[]): InputType {
	if(types.length === 0) {
		return InputType.Constant;
	}
	if(types.includes(InputType.Unknown)) {
		return InputType.Unknown;
	}
	// If more than one distinct middle-tier value is present, they are incomparable → lub is Unknown
	const middleTier = [InputType.Parameter, InputType.File, InputType.Network, InputType.Random, InputType.Scope];
	const presentMiddle = middleTier.filter(m => types.includes(m));
	if(presentMiddle.length > 1) {
		return InputType.Unknown;
	}
	if(presentMiddle.length === 1) {
		return presentMiddle[0];
	}
	if(types.includes(InputType.DerivedConstant)) {
		return InputType.DerivedConstant;
	}
	return InputType.Constant;
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
 * Object attached to an input source
 * @see {@link InputSources}
 */
export interface InputSource extends MergeableRecord {
	id:    NodeId,
	type:  InputType,
	trace: InputTraceType,
	/** if the trace is affected by control dependencies, they are classified too, this is a duplicate free array */
	cds?:  InputType[]
	/** cycle free witness trace */
	// witness: NodeId[] (optional)
}


/**
 * Map of input sources, keyed by the node id of the input source. Each input source is classified with an {@link InputSource} object.
 */
export type InputSources = InputSource[];

/**
 * This is either an {@link NodeId|id} of a known functions all of that category (e.g., you can issue a dependencies query before and then pass all
 * identified ids to this query here).
 */
export type InputClassifierFunctionIdentifier = Identifier | NodeId;

function matchesList(fn: DataflowGraphVertexFunctionCall, list: readonly InputClassifierFunctionIdentifier[] | undefined): boolean {
	if(!list || list.length === 0) {
		return false;
	}
	for(const id of list) {
		if(fn.id === id || Identifier.matches(id as BrandedIdentifier, fn.name)) {
			return true;
		}
	}
	return false;
}

/**
 * For the specifications of `pureFns` etc. please have a look at {@link InputClassifierFunctionIdentifier}.
 */
export interface InputClassifierConfig extends MergeableRecord {
	/**
	 * Functions which are considered to be pure (i.e., deterministic, trusted, safe, idempotent on the lub of the input types)
	 */
	pureFns:     readonly InputClassifierFunctionIdentifier[]
	/**
	 * Functions that read from the network
	 */
	networkFns:  readonly InputClassifierFunctionIdentifier[]
	/**
	 * Functions that produce a random value
	 * Note: may need to check with respect to seeded randomness
	 */
	randomFns:   readonly InputClassifierFunctionIdentifier[]
	/**
	 * Functions that read from the file system
	 */
	readFileFns: readonly InputClassifierFunctionIdentifier[]
}

/**
 * Takes the given id which is expected to either be:
 * - a function call - in this case all arguments are considered to be inputs (additionally to all read edges from the function call in the dataflow graph)
 * - anything else - in that case the node itself is considered as an "input" - please note that in these scenarios the *return* value will only contain one mapping - that for the id you pased in.
 *
 * This method traces the dependencies in the dataflow graph using the specification of functions passed in
 */
export function classifyInput(id: NodeId, dfg: DataflowGraph, config: InputClassifierConfig): InputSources {
	const vtx = dfg.getVertex(id);
	if(!vtx) {
		return [];
	}
	const c = new InputClassifier(dfg, config);

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
