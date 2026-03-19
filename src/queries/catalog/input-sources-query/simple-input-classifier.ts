import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { FunctionArgument } from '../../../dataflow/graph/graph';
import type { MergeableRecord } from '../../../util/objects';
import type { Identifier as IdentifierType } from '../../../dataflow/environments/identifier';
import type {
	DataflowGraphVertexInfo,
	DataflowGraphVertexFunctionCall,
	DataflowGraphVertexVariableDefinition
} from '../../../dataflow/graph/vertex';
import { VertexType } from '../../../dataflow/graph/vertex';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { OriginType } from '../../../dataflow/origin/dfg-get-origin';
import { Identifier } from '../../../dataflow/environments/identifier';
import { RoleInParent } from '../../../r-bridge/lang-4.x/ast/model/processing/role';

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
				return this.setAndReturn(vertex.id, { id: vertex.id, type: InputType.Constant, trace: InputTraceType.Unknown });
			case VertexType.FunctionCall:
				return this.classifyFunctionCall(vertex);
			case VertexType.VariableDefinition:
				return this.classifyVariableDefinition(vertex);
			case VertexType.Use:
				return this.classifyVariable(vertex);
			default:
				return this.setAndReturn(vertex.id, { id: vertex.id, type: InputType.Unknown, trace: InputTraceType.Unknown });
		}
	}

	private classifyFunctionCall(call: DataflowGraphVertexFunctionCall): InputSource {
		// If the function itself is known to read from files/network/randomness, classify directly
		const fn = call.name;
		const matchesList = (list: readonly IdentifierType[] | undefined): boolean => {
			if(!list || list.length === 0) {
				return false;
			}
			for(const id of list) {
				if(Identifier.matches(id, fn)) {
					return true;
				}
			}
			return false;
		};

		if(matchesList(this.config.readFileFns)) {
			return this.setAndReturn(call.id, { id: call.id, type: InputType.File, trace: InputTraceType.Unknown });
		} else if(matchesList(this.config.networkFns)) {
			return this.setAndReturn(call.id, { id: call.id, type: InputType.Network, trace: InputTraceType.Unknown });
		} else if(matchesList(this.config.randomFns)) {
			return this.setAndReturn(call.id, { id: call.id, type: InputType.Random, trace: InputTraceType.Unknown });
		} else if(!matchesList(this.config.pureFns)) {
			// if it is not pure, we cannot classify based on the inputs, in that case we do not know!
			return this.setAndReturn(call.id, { id: call.id, type: InputType.Unknown, trace: InputTraceType.Unknown });
		}

		// Otherwise, classify by arguments; pure functions get Known/Pure handling
		const argTypes: InputType[] = [];
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
		}

		const allConstLike = argTypes.length > 0 && argTypes.every(t => t === InputType.Constant || t === InputType.DerivedConstant);
		if(allConstLike) {
			return this.setAndReturn(call.id, { id: call.id, type: InputType.DerivedConstant, trace: InputTraceType.Pure });
		}

		// If function is known pure, mark trace as Known (we know its semantics even if result not constant)
		if(matchesList(this.config.pureFns)) {
			return this.setAndReturn(call.id, { id: call.id, type: worstInputType(argTypes), trace: InputTraceType.Known });
		}

		return this.setAndReturn(call.id, { id: call.id, type: worstInputType(argTypes), trace: InputTraceType.Unknown });
	}

	private classifyVariable(vtx: DataflowGraphVertexInfo): InputSource {
		const origins = Dataflow.origin(this.dfg, vtx.id);

		if(origins === undefined) {
			return this.setAndReturn(vtx.id, { id: vtx.id, type: InputType.Unknown, trace: InputTraceType.Unknown });
		}

		const types: InputType[] = [];
		let anyPure = false;

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
					if(c.trace === InputTraceType.Pure) {
						anyPure = true;
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
					if(c.trace === InputTraceType.Pure) {
						anyPure = true;
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
		const trace = anyPure ? InputTraceType.Pure : InputTraceType.Alias;
		return this.setAndReturn(vtx.id, { id: vtx.id, type: t, trace });
	}

	private classifyVariableDefinition(vtx: DataflowGraphVertexVariableDefinition): InputSource {
		// parameter definitions are classified as Parameter
		if(this.dfg.idMap?.get(vtx.id)?.info.role === RoleInParent.ParameterName) {
			return this.setAndReturn(vtx.id, { id: vtx.id, type: InputType.Parameter, trace: InputTraceType.Unknown });
		}

		const sources = vtx.source;

		if(sources === undefined || sources.length === 0) {
			// fallback to unknown if we cannot find the value
			return this.setAndReturn(vtx.id, { id: vtx.id, type: InputType.Unknown, trace: InputTraceType.Unknown });
		}

		const types: InputType[] = [];
		let anyPure = false;

		for(const tid of sources) {
			const tv = this.dfg.getVertex(tid);
			if(tv) {
				const c = this.classifyEntry(tv);
				types.push(c.type);
				if(c.trace === InputTraceType.Pure) {
					anyPure = true;
				}
			} else {
				types.push(InputType.Unknown);
			}
		}

		const t = types.length === 0 ? InputType.Unknown : worstInputType(types);
		const trace = anyPure ? InputTraceType.Pure : InputTraceType.Alias;
		return this.setAndReturn(vtx.id, { id: vtx.id, type: t, trace });
	}

	private setAndReturn(id: NodeId, src: InputSource): InputSource {
		this.cache.set(id, src);
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
	/** cycle free witness trace */
	// witness: NodeId[] (optional)
}


/**
 * Map of input sources, keyed by the node id of the input source. Each input source is classified with an {@link InputSource} object.
 */
export type InputSources = InputSource[];

export interface InputClassifierConfig extends MergeableRecord {
	/**
	 * Functions which are considered to be pure (i.e., deterministic, trusted, safe, idempotent on the lub of the input types)
	 */
	pureFns:     readonly IdentifierType[]
	/**
	 * Functions that read from the network
	 */
	networkFns:  readonly IdentifierType[]
	/**
	 * Functions that produce a random value
	 * Note: may need to check with respect to seeded randomness
	 */
	randomFns:   readonly IdentifierType[]
	/**
	 * Functions that read from the file system
	 */
	readFileFns: readonly IdentifierType[]
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
