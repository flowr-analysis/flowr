import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { InputTraceType, InputType } from './input-types';
export { InputTraceType, InputType } from './input-types';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { FunctionArgument } from '../../../dataflow/graph/graph';
import type { MergeableRecord } from '../../../util/objects';
import { compactRecord } from '../../../util/objects';
import type {
	DataflowGraphVertexInfo,
	DataflowGraphVertexFunctionCall,
	DataflowGraphVertexVariableDefinition, DataflowGraphVertexArgument
} from '../../../dataflow/graph/vertex';
import { FunctionDefinitionVertex, VariableDefinitionVertex, FunctionCallVertex, VertexType } from '../../../dataflow/graph/vertex';
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
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { RFunctionDefinition } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import type { AstIdMap, ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';


/** how far a function handed to an entry point may be passed along before we give up resolving it */
const MaxFunctionResolveDepth = 4;

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
	private readonly dfg:      DataflowGraph;
	private readonly config:   InputClassifierConfig<InputClassifierFunctionIdentifiers>;
	private readonly cache = new Map<NodeId, InputSource>();
	private readonly fullDfg:  DataflowGraph | undefined;
	/** the packages attached in the analyzed program, `undefined` if that is not known (then everything may match) */
	private readonly packages: ReadonlySet<string> | undefined;
	private fullClassifier:    InputClassifier | undefined;
	private declarationIndex:  Map<string, NodeId[]> | undefined;
	private entryPointIndex:   Map<NodeId, readonly (string | undefined)[]> | undefined;

	constructor(dfg: DataflowGraph, config: InputClassifierConfig<InputClassifierFunctionIdentifiers>, fullDfg?: DataflowGraph, packages?: ReadonlySet<string>) {
		this.dfg = dfg;
		this.config = config;
		this.fullDfg = fullDfg;
		this.packages = packages;
	}

	private matches(call: DataflowGraphVertexFunctionCall, list: InputClassifierFunctionIdentifiers | undefined): boolean {
		return matchesList(call, list, this.packages);
	}

	/** whether the package the given entry needs is attached (unknown package information lets everything through) */
	private hasPackage(name: string | undefined): boolean {
		return name === undefined || this.packages === undefined || this.packages.has(name);
	}

	/**
	 * Returns the specification of the {@link LinkedInputObject|linked input object} the given id refers to
	 * (e.g., shiny's `input`), or `undefined` if it refers to something else.
	 */
	private matchLinkedObject(id: NodeId): LinkedInputObject | undefined {
		const idMap = this.dfg.idMap;
		const node = idMap?.get(id);
		if(idMap === undefined || !RSymbol.is(node)) {
			return undefined;
		}
		// the framework may bind the object by position, in a function it is handed (`shinyApp(ui, server)`)
		const positional = this.boundByEntryPoint(node, idMap);
		if(positional !== undefined) {
			return positional;
		}
		return this.config.linkedObjects?.find(o =>
			o.name === node.content && this.hasPackage(o.requires) && isBoundAsLinkedObject(node, o, idMap));
	}

	/**
	 * The object a framework binds at this symbol's position, when the function binding it is handed to one of the
	 * {@link LinkedInputEntryPoint|entry points} - this is how R passes them, so the parameter names do not matter.
	 */
	private boundByEntryPoint(node: RSymbol<ParentInformation>, idMap: AstIdMap): LinkedInputObject | undefined {
		if(!this.config.linkedEntryPoints?.length) {
			return undefined;
		}
		for(const fn of enclosingFunctions(node, idMap)) {
			const index = fn.parameters.findIndex(p => p.name.content === node.content);
			if(index < 0) {
				continue;   // not bound by this function, so keep looking outwards
			}
			const bound = this.entryPoints().get(fn.info.id)?.[index];
			// the entry point names the object, so it keeps its fields and declarations no matter what the parameter is called
			return bound === undefined ? undefined : this.config.linkedObjects?.find(o => o.name === bound);
		}
		return undefined;
	}

	/** The function definitions handed to an {@link LinkedInputEntryPoint|entry point}, with how it binds their parameters. */
	private entryPoints(): Map<NodeId, readonly (string | undefined)[]> {
		if(this.entryPointIndex !== undefined) {
			return this.entryPointIndex;
		}
		const index = new Map<NodeId, readonly (string | undefined)[]>();
		this.entryPointIndex = index;
		for(const [, call] of (this.fullDfg ?? this.dfg).verticesOfType(VertexType.FunctionCall)) {
			for(const entry of this.config.linkedEntryPoints ?? []) {
				if(!this.matches(call, [entry.call])) {
					continue;
				}
				const handed = this.argumentReference(call, entry.argIdx, entry.argName);
				for(const fn of this.functionDefinitionsAt(handed)) {
					index.set(fn, entry.params);
				}
			}
		}
		return index;
	}

	/** the function definitions the given id may hold, be it one directly or a variable a definition was assigned to */
	private *functionDefinitionsAt(id: NodeId | undefined, depth = 0): Generator<NodeId> {
		const graph = this.fullDfg ?? this.dfg;
		const vtx = id === undefined || depth > MaxFunctionResolveDepth ? undefined : graph.getVertex(id);
		if(vtx === undefined) {
			return;
		} else if(FunctionDefinitionVertex.is(vtx)) {
			yield vtx.id;
		} else if(VariableDefinitionVertex.is(vtx)) {
			for(const source of vtx.source ?? []) {
				yield* this.functionDefinitionsAt(source, depth + 1);
			}
		} else {
			for(const origin of Dataflow.origin(graph, vtx.id) ?? []) {
				if(origin.type === OriginType.ReadVariableOrigin || origin.type === OriginType.WriteVariableOrigin || origin.type === OriginType.FunctionCallOrigin) {
					yield* this.functionDefinitionsAt(origin.id, depth + 1);
				}
			}
		}
	}

	/** the id of the argument named `argName`, or of the one at `argIdx` if it is passed positionally */
	private argumentReference(call: DataflowGraphVertexFunctionCall, argIdx: number, argName: string): NodeId | undefined {
		const named = call.args.find(a => FunctionArgument.isNamed(a) && FunctionArgument.getName(a) === argName);
		const arg = named ?? call.args[argIdx];
		if(arg === undefined || FunctionArgument.isEmpty(arg) || (named === undefined && FunctionArgument.isNamed(arg))) {
			return undefined;
		}
		return FunctionArgument.getReference(arg);
	}

	/** the linked object the id refers to, but only where reading the object as a whole already is an input */
	private matchWholeLinkedObject(id: NodeId): LinkedInputObject | undefined {
		const obj = this.matchLinkedObject(id);
		return obj !== undefined && fieldIsInput(obj, undefined) ? obj : undefined;
	}

	/**
	 * All declarations of framework entries in the program, keyed by object and entry name, built once on first use.
	 * This is what links a read of `input$n` back to the `textInput("n", …)` defining it.
	 */
	private declarations(): Map<string, NodeId[]> {
		if(this.declarationIndex !== undefined) {
			return this.declarationIndex;
		}
		const index = new Map<string, NodeId[]>();
		this.declarationIndex = index;
		const specs = this.config.linkedObjects?.filter(o => o.declaredBy !== undefined) ?? [];
		if(specs.length === 0) {
			return index;
		}
		for(const [, call] of (this.fullDfg ?? this.dfg).verticesOfType(VertexType.FunctionCall)) {
			for(const obj of specs) {
				const spec = obj.declaredBy as LinkedInputDeclaration;
				if(!this.matches(call, spec.calls)) {
					continue;
				}
				const name = this.argumentValue(call, spec.argIdx, spec.argName);
				if(typeof name === 'string') {
					const key = declarationKey(obj.name, name);
					index.set(key, [...(index.get(key) ?? []), call.id]);
				}
			}
		}
		return index;
	}

	/** the value of the argument named `argName`, or of the one at `argIdx` if it is passed positionally */
	private argumentValue(call: DataflowGraphVertexFunctionCall, argIdx: number, argName: string): ConstantValue | undefined {
		const ref = this.argumentReference(call, argIdx, argName);
		const vtx = ref === undefined ? undefined : (this.fullDfg ?? this.dfg).getVertex(ref);
		return vtx === undefined ? undefined : this.classifyEntry(vtx).value;
	}

	private isDefinedByOnCall(id: NodeId): boolean {
		return this.definedByOnCallTargets(id).length > 0;
	}

	/** the ids the given one is linked to by {@link EdgeType.DefinedByOnCall}, e.g. a parameter to the arguments it is bound to */
	private definedByOnCallTargets(id: NodeId): NodeId[] {
		const out = (this.fullDfg ?? this.dfg).outgoingEdges(id) ?? new Map<NodeId, DfEdge>();
		return out.entries().filter(([, e]) => DfEdge.includesType(e, EdgeType.DefinedByOnCall)).map(([to]) => to).toArray();
	}

	/**
	 * Classifies the given id against the full graph, for everything the reduced graph of the criterion cannot see
	 * (the enclosing scopes and the callers of the function the criterion is in).
	 */
	private classifyInFullGraph(id: NodeId): InputSource | undefined {
		if(this.fullDfg === undefined || this.fullDfg === this.dfg) {
			return undefined;
		}
		this.fullClassifier ??= new InputClassifier(this.fullDfg, this.config, undefined, this.packages);
		const vtx = this.fullDfg.getVertex(id);
		return vtx ? this.fullClassifier.classifyEntry(vtx) : undefined;
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

	/**
	 * Accesses like `input$n` or `input[["n"]]` are reported as a single source of the accessed object,
	 * carrying the accessed field as its {@link InputSource.name|name}.
	 */
	private classifyLinkedObjectAccess(call: DataflowGraphVertexFunctionCall): InputSource | undefined {
		if(!call.origin.includes(BuiltInProcName.Access)) {
			return undefined;
		}
		const accessed = FunctionArgument.isEmpty(call.args[0]) ? undefined : FunctionArgument.getReference(call.args[0]);
		const linked = accessed === undefined ? undefined : this.matchLinkedObject(accessed);
		const field = this.accessedField(call);
		if(linked === undefined || !fieldIsInput(linked, field)) {
			return undefined;
		}
		const src: InputSource = { id: call.id, types: [linked.type], trace: InputTraceType.Unknown };
		if(field !== undefined) {
			src.name = field;
			const declaredAt = linked.declaredBy && this.declarations().get(declarationKey(linked.name, field));
			if(declaredAt) {
				src.declaredAt = declaredAt;
			}
		}
		return src;
	}

	private accessedField(call: DataflowGraphVertexFunctionCall): string | undefined {
		const arg = call.args[1];
		if(arg === undefined || FunctionArgument.isEmpty(arg)) {
			return undefined;
		}
		const ref = FunctionArgument.getReference(arg);
		const node = ref === undefined ? undefined : this.dfg.idMap?.get(ref);
		if(RString.is(node)) {
			return node.content.str;
		} else if(RSymbol.is(node)) {
			return Identifier.getName(node.content);
		}
		return undefined;
	}

	private classifyFunctionCall(call: DataflowGraphVertexFunctionCall): InputSource {
		const linkedAccess = this.classifyLinkedObjectAccess(call);
		if(linkedAccess) {
			return this.classifyCdsAndReturn(call, linkedAccess);
		}
		if(call.origin.includes(BuiltInProcName.ExpressionList)) {
			// `{ a; b }` evaluates to its last expression, just like in R
			const last = call.args.findLast(a => !FunctionArgument.isEmpty(a));
			const value = last === undefined ? undefined : FunctionArgument.getReference(last);
			const vtx = value === undefined ? undefined : this.dfg.getVertex(value);
			if(vtx) {
				return this.classifyCdsAndReturn(call, { ...this.classifyEntry(vtx), id: call.id });
			}
		} else if(call.origin.includes(BuiltInProcName.IfThenElse) || call.origin.includes(BuiltInProcName.WhileLoop)) {
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
		} else if(call.origin.includes(BuiltInProcName.Get) && !(this.fullDfg ?? this.dfg).unknownSideEffects.has(NodeId.normalize(call.id))) {
			// a statically resolved `get("x")` yields the value of the retrieved variable, read via its first argument
			const ref = FunctionArgument.getReference(call.args[0]);
			const vtx = ref === undefined ? undefined : this.dfg.getVertex(ref);
			if(vtx) {
				return this.classifyCdsAndReturn(call, { ...this.classifyEntry(vtx), id: call.id });
			}
		}
		// a narrowing function returns a bounded value: either one of a specific argument's values (e.g. `match.arg`
		// -> its `choices`), or - with no bounding argument - a content-independent value like a count/index/logical
		for(const narrow of this.config.narrowing ?? []) {
			if(!this.matches(call, [narrow.call])) {
				continue;
			}
			if(narrow.argIdx === undefined) {
				return this.classifyCdsAndReturn(call, compactRecord({ id: call.id, types: [InputType.DerivedConstant], trace: InputTraceType.Pure }));
			}
			const ref = this.argumentReference(call, narrow.argIdx, narrow.argName ?? '');
			const vtx = ref === undefined ? undefined : this.dfg.getVertex(ref);
			if(vtx) {
				return this.classifyCdsAndReturn(call, { ...this.classifyEntry(vtx), id: call.id });
			}
		}

		if(!this.matches(call, this.config.pure)) {
			const types: InputType[] = [];

			for(const type of Record.values(InputType)) {
				if(this.matches(call, this.config[type])) {
					types.push(type);
				}
			}
			// if a File-typed call reads from a temp path, replace File with TempFile
			if(types.includes(InputType.File) && !types.includes(InputType.TempFile)) {
				for(const arg of call.args) {
					if(FunctionArgument.isEmpty(arg)) {
						continue;
					}
					const ref = FunctionArgument.getReference(arg);
					if(ref === undefined) {
						continue;
					}
					const argVtx = this.dfg.getVertex(ref);
					if(argVtx && this.classifyEntry(argVtx).types.includes(InputType.TempFile)) {
						types.splice(types.indexOf(InputType.File), 1);
						types.push(InputType.TempFile);
						break;
					}
				}
			}
			if(types.length === 0) {
				// a call of something the code produced itself, like a shiny `reactive()`, yields what that produced
				const callee = this.classifyCallee(call);
				if(callee !== undefined) {
					return this.classifyCdsAndReturn(call, { ...callee, id: call.id });
				}
				// a call of a function the code defines yields whatever that function returns
				const returned = this.classifyDefinitionResult(call);
				if(returned !== undefined) {
					return this.classifyCdsAndReturn(call, returned);
				}
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

	/**
	 * What a call of a function the analyzed code defines yields: what its exit points do, as a function whose
	 * body is `system(x)` runs a system command whether the call reads `f(cmd)` or `system(cmd)`. `undefined`
	 * when the call names no definition here or when none of them says anything about what it returns.
	 */
	private classifyDefinitionResult(call: DataflowGraphVertexFunctionCall): InputSource | undefined {
		const graph = this.fullDfg ?? this.dfg;
		const acc = new ClassificationAccumulator();
		let known = false;
		for(const fn of this.functionDefinitionsAt(call.id)) {
			const definition = graph.getVertex(fn);
			if(!FunctionDefinitionVertex.is(definition)) {
				continue;
			}
			for(const { nodeId } of definition.exitPoints) {
				for(const value of this.exitValues(nodeId)) {
					const vtx = value === undefined ? undefined : this.dfg.getVertex(value) ?? graph.getVertex(value);
					const classified = vtx ? this.classifyEntry(vtx) : undefined;
					if(classified === undefined) {
						/* an exit flowR cannot place says nothing about the call, so neither can the others */
						return undefined;
					}
					known = true;
					acc.merge(classified);
				}
			}
		}
		if(!known) {
			return undefined;
		}
		const built = acc.build(call.id);
		return built.types.includes(InputType.Unknown) ? undefined : built;
	}

	/**
	 * What an exit point hands back, descending through the branches of an `if` (which yields one of them, while
	 * {@link classifyFunctionCall} reports the condition it depends on). Yields `undefined` for a construct whose
	 * value flowR cannot name, a loop above all, so the caller stops rather than answers with the branches alone.
	 */
	private *exitValues(id: NodeId, depth = 0): Generator<NodeId | undefined> {
		const vtx = (this.dfg.getVertex(id) ?? (this.fullDfg ?? this.dfg).getVertex(id));
		if(vtx === undefined || !FunctionCallVertex.is(vtx)) {
			yield id;
			return;
		}
		if(vtx.origin.includes(BuiltInProcName.WhileLoop) || vtx.origin.includes(BuiltInProcName.ForLoop) || vtx.origin.includes(BuiltInProcName.RepeatLoop)) {
			yield undefined;
		} else if(vtx.origin.includes(BuiltInProcName.IfThenElse) && depth <= MaxFunctionResolveDepth) {
			for(const branch of vtx.args.slice(1)) {
				const ref = FunctionArgument.isEmpty(branch) ? undefined : FunctionArgument.getReference(branch);
				if(ref === undefined) {
					yield undefined;
				} else {
					yield* this.exitValues(ref, depth + 1);
				}
			}
		} else {
			yield id;
		}
	}

	/** classifies what a call of a variable (e.g. a shiny reactive `n()`) yields, by what that variable holds */
	private classifyCallee(call: DataflowGraphVertexFunctionCall): InputSource | undefined {
		for(const o of Dataflow.origin(this.dfg, call.id) ?? []) {
			if(o.type !== OriginType.ReadVariableOrigin && o.type !== OriginType.WriteVariableOrigin) {
				continue;
			}
			const vtx = this.dfg.getVertex(o.id);
			const classified = vtx ? this.classifyEntry(vtx) : this.classifyInFullGraph(o.id);
			if(classified !== undefined && !classified.types.includes(InputType.Unknown)) {
				return classified;
			}
		}
		return undefined;
	}

	private classifyVariable(vtx: DataflowGraphVertexInfo): InputSource {
		const linked = this.matchWholeLinkedObject(vtx.id);
		if(linked) {
			return this.classifyCdsAndReturn(vtx, { id: vtx.id, types: [linked.type], trace: InputTraceType.Unknown });
		}
		const origins = Dataflow.origin(this.dfg, vtx.id);

		if(origins === undefined || origins.length === 0) {
			if(this.isDefinedByOnCall(vtx.id)) {
				return this.classifyCdsAndReturn(vtx, { id: vtx.id, types: [InputType.Scope], trace: InputTraceType.Unknown });
			}
			// the definition is not part of the criterion's function, so it has to come from an enclosing scope
			const outer = this.classifyInFullGraph(vtx.id);
			return this.classifyCdsAndReturn(vtx, outer ? { ...outer, id: vtx.id } : { id: vtx.id, types: [InputType.Unknown], trace: InputTraceType.Unknown });
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
		// if the referenced definition is linked via defined-by-on-call to another id (e.g., a parameter linked to a
		// caller argument), follow it into the caller; only if that leads nowhere is it an opaque Scope origin
		const onCall = this.definedByOnCallTargets(v.id);
		if(onCall.length > 0) {
			const callers = onCall.map(t => this.classifyInFullGraph(t))
				.filter(isNotUndefined)
				.filter(c => !c.types.includes(InputType.Unknown));
			if(callers.length > 0) {
				callers.forEach(c => acc.merge(c));
				return;
			}
			acc.types.push(InputType.Scope);
			acc.values.push(undefined);
			acc.allPure = false;
		}
		// if this is a variable definition that is a parameter, classify as Parameter
		if(VariableDefinitionVertex.is(v) && this.dfg.idMap?.get(v.id)?.info.role === RoleInParent.ParameterName) {
			acc.types.push(this.matchWholeLinkedObject(v.id)?.type ?? InputType.Parameter);
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
			const types = [this.matchWholeLinkedObject(vtx.id)?.type ?? InputType.Parameter];
			return this.classifyCdsAndReturn(vtx, { id: vtx.id, types, trace: InputTraceType.Unknown });
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
 * An object that a framework hands to its users without any visible definition, like the `input` of a
 * shiny server function. Reads of such an object (and of its fields) are classified as its given type,
 * so traces link up to the framework instead of stopping at an opaque parameter.
 */
export interface LinkedInputObject {
	/** the name of the object, e.g. `input` */
	readonly name:        string,
	/** how reads of the object (or of its fields) are to be classified */
	readonly type:        InputType,
	/**
	 * If given, the object only counts as linked if the function binding it declares all of these parameters as well
	 * (e.g., shiny's `function(input, output, session)`). Without this, every `input` would be treated as the framework's.
	 */
	readonly withParams?: readonly string[],
	/** the package that has to be attached for this object to exist, e.g. `shiny` */
	readonly requires?:   string,
	/** if given, only these fields are inputs (`session$clientData` is, `session$userData` is not) and the object itself is none */
	readonly fields?:     readonly string[],
	/** how the framework declares the entries of this object, so a read of `input$n` links to the `textInput("n", …)` defining it */
	readonly declaredBy?: LinkedInputDeclaration
}

/** The calls that declare the entries of a {@link LinkedInputObject}, and where they carry the entry's name. */
export interface LinkedInputDeclaration {
	/** the declaring calls, e.g. shiny's `textInput`, `selectInput`, … */
	readonly calls:   readonly Identifier[],
	/** the name of the argument holding the entry's name */
	readonly argName: string,
	/** the index of that argument when it is passed positionally */
	readonly argIdx:  number
}

/**
 * A call a framework is given a function through, binding its parameters *by position* - which is how R passes
 * them, so this catches a `shinyApp(ui, function(i, o, s))` that no name-based rule can.
 */
export interface LinkedInputEntryPoint {
	/** the call taking the function, e.g. `shiny::shinyApp` */
	readonly call:    Identifier,
	/** the name of the argument holding the function */
	readonly argName: string,
	/** the index of that argument when it is passed positionally */
	readonly argIdx:  number,
	/** which {@link LinkedInputObject} the framework binds to each parameter, by position; `undefined` leaves one alone */
	readonly params:  readonly (string | undefined)[]
}

/** A function whose result is bounded by one argument (e.g. `match.arg` by its `choices`), classified by that argument alone. */
export interface NarrowingFunction {
	readonly call:     Identifier,
	/** the name of the bounding argument; omit (with `argIdx`) for a result that is always a bounded, content-independent value */
	readonly argName?: string,
	/** the index of the bounding argument; omit (with `argName`) for an always-`DerivedConstant` result */
	readonly argIdx?:  number
}

/** the function definitions the given node is nested in, innermost first */
function* enclosingFunctions(node: RNode<ParentInformation>, idMap: AstIdMap): Generator<RFunctionDefinition<ParentInformation>> {
	for(const parent of RNode.iterateParents(node, idMap)) {
		if(RFunctionDefinition.is(parent)) {
			yield parent;
		}
	}
}

/** whether the given occurrence of `obj` is bound by a function matching {@link LinkedInputObject.withParams} */
function isBoundAsLinkedObject(node: RNode<ParentInformation>, obj: LinkedInputObject, idMap: AstIdMap): boolean {
	if(!obj.withParams?.length) {
		return true;
	}
	for(const fn of enclosingFunctions(node, idMap)) {
		const params = new Set(fn.parameters.map(p => p.name.content as string));
		if(params.has(obj.name)) {
			return obj.withParams.every(p => params.has(p));
		}
	}
	return false;
}

function declarationKey(object: string, field: string): string {
	return `${object}\u0000${field}`;
}

/** whether reading `field` of the given object is an input; an object restricted to {@link LinkedInputObject.fields} is none as a whole */
function fieldIsInput(obj: LinkedInputObject, field: string | undefined): boolean {
	return obj.fields === undefined || (field !== undefined && obj.fields.includes(field));
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
	id:          NodeId,
	types:       InputType[],
	trace:       InputTraceType,
	/** if the trace is affected by control dependencies, they are classified too, this is a duplicate free array */
	cds?:        InputType[],
	/**
	 * Argument name when this source originates from a named argument of the criterion function call,
	 * or the accessed field when it originates from a {@link LinkedInputObject} (e.g. `n` for `input$n`).
	 */
	name?:       string,
	/** the concrete scalar value when the source is a constant or a pure alias of one */
	value?:      ConstantValue,
	/** where the framework entry this source reads is declared, e.g. the `textInput("n", …)` behind an `input$n` */
	declaredAt?: NodeId[]
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

/**
 * Whether a call by the name `called` means `id`. A `pkg::fn` call has to match exactly, while a bare call only
 * means a namespaced entry if that package is attached - just like in R, where the search path decides.
 * With `packages` left out (no package information at all) any bare call may mean it.
 */
function callMeans(called: Identifier, id: Identifier, packages?: ReadonlySet<string>): boolean {
	if(Identifier.matches(id, called)) {
		return true;
	}
	const namespace = Identifier.getNamespace(id);
	return Identifier.getNamespace(called) === undefined && Identifier.matches(called, id)
		&& (namespace === undefined || packages === undefined || packages.has(namespace));
}

function matchesList(fn: DataflowGraphVertexFunctionCall, list: InputClassifierFunctionIdentifiers | undefined, packages?: ReadonlySet<string>): boolean {
	return list?.some(id => fn.id === id || (Identifier.is(id) && callMeans(fn.name, id, packages))) ?? false;
}

/**
 * For the specifications of `pure` etc. please have a look at {@link InputClassifierFunctionIdentifiers}.
 */
export interface InputClassifierConfig<Functions extends InputClassifierFunctionIdentifiers | FlowrSearchLike = readonly Identifier[] | FlowrSearchLike> extends Partial<Record<InputType, Functions>> {
	/**
	 * Functions which are considered to be pure (i.e., deterministic, trusted, safe, idempotent on the lub of the input types)
	 */
	[InputTraceType.Pure]?: Functions
	/**
	 * Objects provided by a framework rather than by the code itself, like shiny's `input`.
	 * @see {@link LinkedInputObject}
	 */
	linkedObjects?:         readonly LinkedInputObject[]
	/**
	 * Calls that hand a function to a framework, which then binds {@link linkedObjects} to its parameters by position.
	 * @see {@link LinkedInputEntryPoint}
	 */
	linkedEntryPoints?:     readonly LinkedInputEntryPoint[]
	/**
	 * Functions whose result is bounded by one of their arguments (classified by that argument alone).
	 * @see {@link NarrowingFunction}
	 */
	narrowing?:             readonly NarrowingFunction[]
}

/**
 * Takes the given id which is expected to either be:
 * - a function call - in this case all arguments are considered to be inputs (additionally to all read edges from the function call in the dataflow graph)
 * - anything else - in that case the node itself is considered as an "input" - please note that in these scenarios the *return* value will only contain one mapping - that for the id you passed in.
 *
 * This method traces the dependencies in the dataflow graph using the specification of functions passed in.
 * For the scope escape analysis, pass on the full, non-reduced DFG as `fullDfg`, and the packages attached in the
 * program as `packages` so that bare calls only match the entries of packages that are actually in scope.
 */
export function classifyInput(id: NodeId, dfg: DataflowGraph, config: InputClassifierConfig<InputClassifierFunctionIdentifiers>, fullDfg?: DataflowGraph, packages?: ReadonlySet<string>): InputSources {
	const vtx = dfg.getVertex(id);
	if(!vtx) {
		return [];
	}
	const c = new InputClassifier(dfg, config, fullDfg, packages);

	if(FunctionCallVertex.is(vtx)) {
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
			const entry = c.classifyEntry(argVtx);
			const argName = FunctionArgument.getName(arg);
			ret.push(argName !== undefined ? { ...entry, name: argName } : entry);
		}
		return ret;
	} else {
		return [
			c.classifyEntry(vtx)
		];
	}
}
