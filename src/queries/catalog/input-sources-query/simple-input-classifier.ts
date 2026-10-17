import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { InputTraceType, InputType } from './input-types';
export { InputTraceType, InputType } from './input-types';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { FunctionArgument, UnknownSideEffect } from '../../../dataflow/graph/graph';
import type { MergeableRecord } from '../../../util/objects';
import { compactRecord } from '../../../util/objects';
import type {
	DataflowGraphVertexInfo,
	DataflowGraphVertexFunctionCall,
	DataflowGraphVertexVariableDefinition, DataflowGraphVertexArgument
} from '../../../dataflow/graph/vertex';
import { DfgVertex, VertexType } from '../../../dataflow/graph/vertex';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { OriginType } from '../../../dataflow/origin/dfg-get-origin';
import { EdgeType } from '../../../dataflow/graph/edge';
import { Identifier } from '../../../dataflow/environments/identifier';
import { RParameter } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import { RComment } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-comment';
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
import { RFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { AstIdMap, ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { SourceRange } from '../../../util/range';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';

/** how far a function handed to an entry point may be passed along before we give up resolving it */
const MaxFunctionResolveDepth = 4;

function isConstantLike(type: InputType): boolean {
	return type === InputType.Constant || type === InputType.DerivedConstant;
}

function sourceOf(id: NodeId, type: InputType): InputSource {
	return { id, types: [type], trace: InputTraceType.Unknown };
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

	merge(c: InputSource | undefined): void {
		if(c === undefined) {
			this.push(InputType.Unknown);
			return;
		}
		this.types.push(...c.types);
		this.values.push(c.value);
		this.cds.push(...c.cds ?? []);
		this.allPure &&= c.trace === InputTraceType.Pure;
	}

	push(type: InputType, value?: ConstantValue): void {
		this.types.push(type);
		this.values.push(value);
	}

	build(id: NodeId): InputSource {
		const types = this.types.length === 0 ? [InputType.Unknown] : uniqueArray(this.types);
		const first = this.values[0];
		const agreed = first !== undefined && this.values.every(v => v === first);
		const value = agreed && types.every(isConstantLike) ? first : undefined;
		return compactRecord({
			id,
			types,
			trace: this.allPure ? InputTraceType.Pure : InputTraceType.Alias,
			cds:   this.cds.length === 0 ? undefined : uniqueArray(this.cds),
			value
		});
	}
}

class InputClassifier {
	private readonly cache = new Map<NodeId, InputSource>();
	private fullClassifier:   InputClassifier | undefined;
	private unsanitized:      InputClassifier | undefined;
	private declarationIndex: Map<string, NodeId[]> | undefined;
	private entryPointIndex:  Map<NodeId, readonly (string | undefined)[]> | undefined;
	private rebinding:        (readonly [NodeId, readonly (ConstantValue | undefined)[] | undefined])[] | undefined;

	/** `packages` are the packages attached in the analyzed program, `undefined` if that is not known (then everything may match) */
	constructor(
		private readonly dfg: DataflowGraph,
		private readonly config: InputClassifierConfig<InputClassifierFunctionIdentifiers>,
		private readonly fullDfg?: DataflowGraph,
		private readonly packages?: ReadonlySet<string>
	) {}

	private get whole(): DataflowGraph {
		return this.fullDfg ?? this.dfg;
	}

	private matches(call: DataflowGraphVertexFunctionCall, list: InputClassifierFunctionIdentifiers | undefined): boolean {
		/* a call of a definition in the code does not mean the built-in of the same name */
		return list?.some(id => call.id === id || (Identifier.is(id) && callMeans(call.name, id, this.packages) && !this.callsDefinition(call))) ?? false;
	}

	/** whether the callee is a definition of the code rather than one handed in as an argument */
	private callsDefinition(call: DataflowGraphVertexFunctionCall): boolean {
		return Dataflow.calleeIdsOf(this.whole, call.id).some(d => !Dataflow.hasEdge(this.whole, call.id, d, EdgeType.Argument));
	}

	/** whether the package the given entry needs is attached (unknown package information lets everything through) */
	private hasPackage(name: string | undefined): boolean {
		return name === undefined || this.packages === undefined || this.packages.has(name);
	}

	public classifyAt(ref: NodeId | undefined, graph = this.dfg): InputSource | undefined {
		const vtx = ref === undefined ? undefined : graph.getVertex(ref);
		/* what the criterion's function reads through a template (`glue("{x}")`) is no node of its code */
		return vtx ? this.classifyEntry(vtx) : ref !== undefined && graph === this.dfg ? this.classifyInFullGraph(ref) : undefined;
	}

	/** classifies an argument as written: the name a `get` looks up, the function `do.call` is handed */
	public classifyArgument(call: DataflowGraphVertexFunctionCall, ref: NodeId | undefined): InputSource | undefined {
		const node = ref === undefined ? undefined : this.dfg.idMap?.get(ref);
		const parent = node?.info.parent === undefined ? undefined : this.dfg.idMap?.get(node.info.parent);
		const vtx = ref === undefined ? undefined : this.dfg.getVertex(ref);
		if(ref === undefined || !RSymbol.is(node)) {
			return this.classifyAt(ref);
		} else if(DfgVertex.hasOrigin(call, BuiltInProcName.Get) && parent !== undefined && !RArgument.is(parent)) {
			const written = RString.is(parent) ? compactRecord({ ...sourceOf(ref, InputType.Constant), value: parent.content.str }) : this.classifyAt(parent.info.id);
			return written && { ...written, id: ref };
		} else if(DfgVertex.hasOrigin(call, BuiltInProcName.Apply) && DfgVertex.isFunctionCall(vtx) && Dataflow.targetsOf(this.dfg, ref, EdgeType.Reads).every(t => NodeId.isBuiltIn(t) || !this.functionDefinitionsAt(t).next().done)) {
			/* a name of a function the code defines or flowR knows */
			return sourceOf(ref, InputType.Constant);
		}
		return this.classifyAt(ref);
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
		/* the framework may bind the object by position, in a function it is handed (`shinyApp(ui, server)`) */
		return this.boundByEntryPoint(node, idMap) ?? this.config.linkedObjects?.find(o =>
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
		for(const [, call] of this.whole.verticesOfType(VertexType.FunctionCall)) {
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
		const vtx = id === undefined || depth > MaxFunctionResolveDepth ? undefined : this.whole.getVertex(id);
		if(DfgVertex.isFunctionDefinition(vtx)) {
			yield vtx.id;
		} else if(DfgVertex.isVariableDefinition(vtx)) {
			for(const source of vtx.source ?? []) {
				yield* this.functionDefinitionsAt(source, depth + 1);
			}
		} else if(vtx !== undefined) {
			for(const origin of Dataflow.origin(this.whole, vtx.id) ?? []) {
				if(origin.type === OriginType.ReadVariableOrigin || origin.type === OriginType.WriteVariableOrigin || origin.type === OriginType.FunctionCallOrigin) {
					yield* this.functionDefinitionsAt(origin.id, depth + 1);
				}
			}
		}
	}

	/** the id of the argument named `argName`, or of the one at `argIdx` if it is passed positionally */
	private argumentReference(call: DataflowGraphVertexFunctionCall, argIdx: number, argName: string): NodeId | undefined {
		const named = call.args.find(a => FunctionArgument.hasName(a, argName));
		const arg = named ?? call.args[argIdx];
		if(arg === undefined || (named === undefined && FunctionArgument.isNamed(arg))) {
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
	 * This is what links a read of `input$n` back to the `textInput("n", ...)` defining it.
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
		for(const [, call] of this.whole.verticesOfType(VertexType.FunctionCall)) {
			for(const obj of specs) {
				const spec = obj.declaredBy as LinkedInputDeclaration;
				if(!this.matches(call, spec.calls)) {
					continue;
				}
				const name = this.classifyAt(this.argumentReference(call, spec.argIdx, spec.argName), this.whole)?.value;
				if(typeof name === 'string') {
					const key = declarationKey(obj.name, name);
					index.set(key, [...(index.get(key) ?? []), call.id]);
				}
			}
		}
		return index;
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
		return this.fullClassifier.classifyAt(id);
	}

	private extractConstantValue(id: NodeId): ConstantValue | undefined {
		const node = this.dfg.idMap?.get(id);
		if(RNumber.is(node)) {
			return node.content.num;
		} else if(RString.is(node)) {
			return node.content.str;
		} else if(RLogical.is(node)) {
			return node.content;
		} else if(RSymbol.is(node) && node.content === RNull) {
			return null;
		}
		return undefined;
	}

	public classifyEntry(vertex: DataflowGraphVertexInfo): InputSource {
		const cached = this.cache.get(vertex.id);
		if(cached) {
			return cached;
		}
		/* a temporary unknown breaks cycles */
		this.cache.set(vertex.id, sourceOf(vertex.id, InputType.Unknown));
		switch(vertex.tag) {
			case VertexType.Value: {
				const value = this.extractConstantValue(vertex.id);
				return this.classifyCdsAndReturn(vertex, compactRecord({ ...sourceOf(vertex.id, InputType.Constant), value }));
			}
			case VertexType.FunctionCall:
				return this.classifyFunctionCall(vertex);
			case VertexType.VariableDefinition:
				return this.classifyVariableDefinition(vertex);
			case VertexType.Use:
				return this.classifyVariable(vertex);
			default:
				return this.classifyCdsAndReturn(vertex, sourceOf(vertex.id, InputType.Unknown));
		}
	}

	/**
	 * Whether `call` quotes only the code written in its arguments: no name in them resolves outside of them
	 * (built-ins aside), as a `bquote(.(y))` splice would, and none names an enclosing parameter `substitute` would replace.
	 */
	private quotesOnlyWrittenCode(call: DataflowGraphVertexFunctionCall): boolean {
		const idMap = this.dfg.idMap;
		if(idMap === undefined) {
			return false;
		}
		const enclosing = enclosingFunctions(idMap.get(call.id), idMap);
		const parameters = new Set(enclosing.flatMap(fn => fn.parameters.map(p => Identifier.getName(p.name.content))));
		for(const arg of call.args) {
			const ref = FunctionArgument.getReference(arg);
			/* an evaluated argument (`parse_expr(text)`) is code only as far as its value is */
			if(ref !== undefined && Dataflow.hasEdge(this.whole, call.id, ref, EdgeType.Reads)) {
				if(!this.classifyAt(ref)?.types.every(isConstantLike)) {
					return false;
				}
				continue;
			}
			const within = RNode.collectAllIds(ref === undefined ? undefined : idMap.get(ref));
			for(const id of within) {
				const node = idMap.get(id);
				if(RSymbol.is(node) && parameters.has(Identifier.getName(node.content))) {
					return false;
				}
				for(const target of Dataflow.targetsOf(this.dfg, id, EdgeType.Reads | EdgeType.DefinedByOnCall)) {
					/* the call evaluating the code is no input to it */
					if(!within.has(target) && !NodeId.isBuiltIn(target) && !Dataflow.hasEdge(this.dfg, target, id, EdgeType.Returns)) {
						return false;
					}
				}
			}
		}
		return true;
	}

	/**
	 * Accesses like `input$n` or `input[["n"]]` are reported as a single source of the accessed object,
	 * carrying the accessed field as its {@link InputSource.name|name}.
	 */
	private classifyLinkedObjectAccess(call: DataflowGraphVertexFunctionCall): InputSource | undefined {
		if(!DfgVertex.hasOrigin(call, BuiltInProcName.Access)) {
			return undefined;
		}
		const accessed = FunctionArgument.getReference(call.args[0]);
		const linked = accessed === undefined ? undefined : this.matchLinkedObject(accessed);
		const field = this.accessedField(call);
		if(linked === undefined || !fieldIsInput(linked, field)) {
			return undefined;
		}
		return compactRecord({
			...sourceOf(call.id, linked.type),
			name:       field,
			declaredAt: field !== undefined && linked.declaredBy ? this.declarations().get(declarationKey(linked.name, field)) : undefined
		});
	}

	private accessedField(call: DataflowGraphVertexFunctionCall): string | undefined {
		const ref = call.args[1] === undefined ? undefined : FunctionArgument.getReference(call.args[1]);
		const node = ref === undefined ? undefined : this.dfg.idMap?.get(ref);
		if(RString.is(node)) {
			return node.content.str;
		} else if(RSymbol.is(node)) {
			return Identifier.getName(node.content);
		}
		return undefined;
	}

	/** the argument a built-in hands on: the value of a block or `get` (then `renamed`), the condition of a loop */
	private passedOn(call: DataflowGraphVertexFunctionCall): { via: FunctionArgument | undefined, renamed: boolean } | undefined {
		if(DfgVertex.hasOrigin(call, BuiltInProcName.ExpressionList)) {
			// `{ a; b }` evaluates to its last expression, just like in R
			return { via: call.args.findLast(a => !FunctionArgument.isEmpty(a)), renamed: true };
		} else if(DfgVertex.hasOrigin(call, BuiltInProcName.WhileLoop)) {
			return { via: call.args[0], renamed: false };
		} else if(DfgVertex.hasOrigin(call, BuiltInProcName.ForLoop)) {
			return { via: call.args[1], renamed: false };
		} else if(DfgVertex.hasOrigin(call, BuiltInProcName.Get) && !this.whole.unknownSideEffects.has(NodeId.normalize(call.id))
			&& Dataflow.targetsOf(this.whole, call.id, EdgeType.Returns).length > 0) {
			// a statically resolved `get("x")` yields the value of the retrieved variable, read via its first argument
			return { via: call.args[0], renamed: true };
		}
		return undefined;
	}

	/** an `if` or `switch` yields one of its branches (`NULL` without a matching one), its condition only picks which */
	private classifyBranches(call: DataflowGraphVertexFunctionCall): InputSource {
		const acc = new ClassificationAccumulator();
		const isSwitch = DfgVertex.hasOrigin(call, BuiltInProcName.Switch);
		const condition = conditionArgument(call);
		const branches = call.args.filter(a => a !== condition);
		for(const ref of branches.map(FunctionArgument.getReference)) {
			/* a branch flowR found dead is in no graph */
			const vtx = ref === undefined ? undefined : this.dfg.getVertex(ref) ?? this.whole.getVertex(ref);
			if(vtx !== undefined) {
				acc.merge(this.classifyEntry(vtx));
			}
		}
		if(isSwitch || branches.length < 2 || branches.some(FunctionArgument.isEmpty)) {
			acc.push(InputType.Constant, null);
		}
		acc.cds.push(...condition === undefined ? [] : this.dependencies(FunctionArgument.getReference(condition), []));
		return acc.build(call.id);
	}

	/** the arguments of a sanitizer it takes as code rather than escaping, see {@link InputClassifierConfig.templates} */
	private templateArguments(call: DataflowGraphVertexFunctionCall): (NodeId | undefined)[] {
		return (this.config.templates ?? []).filter(t => this.matches(call, [t.call])).flatMap(t => t.argName === '...'
			? call.args.filter(a => !FunctionArgument.isNamed(a)).map(FunctionArgument.getReference)
			: [this.argumentReference(call, t.argIdx, t.argName)]);
	}

	/** the types and control dependencies of what `ref` yields, `unknown` when it cannot be classified */
	private dependencies(ref: NodeId | undefined, unknown: readonly InputType[] = [InputType.Unknown]): readonly InputType[] {
		const c = this.classifyAt(ref);
		return c ? [...c.types, ...c.cds ?? []] : unknown;
	}

	/** what a control dependency on the given id depends on: the condition of an `if` or `switch`, else the id itself */
	private conditionOf(id: NodeId): NodeId | undefined {
		const vtx = this.dfg.getVertex(id);
		const condition = DfgVertex.isFunctionCall(vtx) ? conditionArgument(vtx) : undefined;
		return condition === undefined ? id : FunctionArgument.getReference(condition);
	}

	private classifyFunctionCall(call: DataflowGraphVertexFunctionCall): InputSource {
		const linkedAccess = this.classifyLinkedObjectAccess(call);
		if(linkedAccess) {
			return this.classifyCdsAndReturn(call, linkedAccess);
		}
		if(DfgVertex.hasOrigin(call, BuiltInProcName.IfThenElse) || DfgVertex.hasOrigin(call, BuiltInProcName.Switch)) {
			return this.classifyCdsAndReturn(call, this.classifyBranches(call));
		}
		const handed = this.passedOn(call);
		const passed = this.classifyAt(handed?.via === undefined ? undefined : FunctionArgument.getReference(handed.via));
		if(passed) {
			return this.classifyCdsAndReturn(call, handed?.renamed ? { ...passed, id: call.id } : passed);
		}
		if(this.matches(call, this.config.sanitizers)) {
			const acc = new ClassificationAccumulator();
			acc.push(InputType.DerivedConstant);
			this.templateArguments(call).forEach(t => acc.merge(this.classifyAt(t)));
			return this.classifyCdsAndReturn(call, acc.build(call.id));
		}
		// a narrowing function returns one of a specific argument's values (e.g. `match.arg` -> its `choices`)
		for(const narrow of this.config.narrowing ?? []) {
			if(!this.matches(call, [narrow.call])) {
				continue;
			}
			const bound = this.argumentReference(call, narrow.argIdx, narrow.argName);
			const narrowed = this.classifyAt(bound);
			if(narrowed) {
				/* which of the values it is depends on the other arguments */
				const cds = call.args.map(FunctionArgument.getReference).filter(a => a !== bound).flatMap(a => this.dependencies(a));
				return this.classifyCdsAndReturn(call, { ...narrowed, id: call.id, cds: uniqueArray([...narrowed.cds ?? [], ...cds]) });
			}
		}

		const evaluates = this.matches(call, this.config.evaluating);
		if(!evaluates && !this.matches(call, this.config.pure)) {
			const types = Record.values(InputType).filter(type => this.matches(call, this.config[type]));
			// if a File-typed call reads from a temp path, replace File with TempFile
			const readsFile = types.includes(InputType.File) && !types.includes(InputType.TempFile);
			if(readsFile && call.args.some(arg => this.classifyAt(FunctionArgument.getReference(arg))?.types.includes(InputType.TempFile))) {
				types.splice(types.indexOf(InputType.File), 1);
				types.push(InputType.TempFile);
			}
			/* `quote` yields written code, only capturing (`substitute(x)`) or splicing (`bquote(.(y))`) brings in other code */
			if(types.includes(InputType.Lang) && this.quotesOnlyWrittenCode(call)) {
				types.splice(types.indexOf(InputType.Lang), 1, InputType.DerivedConstant);
			}
			if(types.length === 0) {
				/* a call of something the code produced (a shiny `reactive()`) or defines yields what that produced or returns */
				const produced = this.classifyCallee(call) ?? this.classifyDefinitionResult(call);
				if(produced !== undefined && DfgVertex.hasOrigin(call, BuiltInProcName.Try)) {
					/* the handlers only answer for a failing block, which may just as well succeed */
					const acc = new ClassificationAccumulator();
					const block = this.argumentReference(call, 0, 'expr');
					acc.merge(produced);
					acc.merge(this.classifyAt(block));
					/* and whether they answer depends on everything the block does */
					const statements = block === undefined ? undefined : this.whole.getVertex(block);
					for(const arg of DfgVertex.isFunctionCall(statements) && DfgVertex.hasOrigin(statements, BuiltInProcName.ExpressionList) ? statements.args : []) {
						acc.cds.push(...this.dependencies(FunctionArgument.getReference(arg)));
					}
					return this.classifyCdsAndReturn(call, acc.build(call.id));
				} else if(produced !== undefined) {
					return this.classifyCdsAndReturn(call, { ...produced, id: call.id });
				}
				// if it is not pure, we cannot classify based on the inputs, in that case we do not know!
				types.push(InputType.Unknown);
			}
			return this.classifyCdsAndReturn(call, { id: call.id, types, trace: InputTraceType.Unknown });
		}

		const argTypes: InputType[] = evaluates ? [InputType.Unknown] : [];
		const cdTypes: InputType[] = [];
		const interpolated = this.templateReads(call);
		/* cutting into what a sanitizer escaped undoes the escape */
		const edits = this.matches(call, this.config.editing);
		const of = edits && this.config.sanitizers !== undefined ? this.unsanitized ??= new InputClassifier(this.dfg, { ...this.config, sanitizers: undefined }, this.fullDfg, this.packages) : this;
		for(const ref of uniqueArray([...call.args.filter(FunctionArgument.isNotEmpty).map(FunctionArgument.getReference), ...interpolated])) {
			/* a function handed in (`sapply(x, function(i) runif(1))`) contributes what it returns */
			const vtx = ref === undefined ? undefined : this.whole.getVertex(ref);
			const fns = vtx === undefined || DfgVertex.isFunctionCall(vtx) ? [] : [...this.functionDefinitionsAt(ref)];
			const classified = fns.length > 0 ? this.classifyExits(fns, ref as NodeId)
				: DfgVertex.isFunctionCall(vtx) && Identifier.getName(vtx.name) === '~' && Dataflow.hasEdge(this.whole, call.id, vtx.id, EdgeType.Calls) ? this.classifyFormula(vtx) : of.classifyAt(ref);
			argTypes.push(...classified?.types ?? [InputType.Unknown]);
			cdTypes.push(...classified?.cds ?? []);
		}
		// all arguments only contain constant-like types -> derived constant
		const constLike = argTypes.length > 0 && argTypes.every(isConstantLike);
		return this.classifyCdsAndReturn(call, compactRecord({
			id:    call.id,
			types: constLike ? [InputType.DerivedConstant] : uniqueArray([...argTypes, InputType.DerivedConstant]),
			trace: constLike ? InputTraceType.Pure : evaluates || edits || interpolated.length > 0 ? InputTraceType.Unknown : InputTraceType.Known,
			cds:   cdTypes.length > 0 ? uniqueArray(cdTypes) : undefined
		}));
	}

	/**
	 * What a call of a function the analyzed code defines yields: what its exit points do, as a function whose
	 * body is `system(x)` runs a system command whether the call reads `f(cmd)` or `system(cmd)`. `undefined`
	 * when the call names no definition here or when none of them says anything about what it returns.
	 */
	private classifyDefinitionResult(call: DataflowGraphVertexFunctionCall): InputSource | undefined {
		return this.classifyExits(this.functionDefinitionsAt(call.id), call.id);
	}

	/** what a string template like `glue("{x}")` evaluates and reads, which is no argument, but flows in all the same */
	private templateReads(call: DataflowGraphVertexFunctionCall): NodeId[] {
		return DfgVertex.hasOrigin(call, BuiltInProcName.StringTemplate) ? Dataflow.targetsOf(this.whole, call.id, EdgeType.Reads).filter(t => this.whole.hasVertex(t) && !DfgVertex.hasOrigin(this.whole.getVertex(t), BuiltInProcName.Library)) : [];
	}

	/** a formula called as a function (`purrr::map(x, ~ runif(1))`) yields what its body does */
	private classifyFormula(formula: DataflowGraphVertexFunctionCall): InputSource {
		const acc = new ClassificationAccumulator();
		formula.args.forEach(a => acc.merge(this.classifyAt(FunctionArgument.getReference(a))));
		return acc.build(formula.id);
	}

	/** what the exit points of the given function definitions yield, see {@link classifyDefinitionResult} */
	private classifyExits(fns: Iterable<NodeId>, id: NodeId): InputSource | undefined {
		const acc = new ClassificationAccumulator();
		for(const fn of fns) {
			const definition = this.whole.getVertex(fn);
			for(const { nodeId } of DfgVertex.isFunctionDefinition(definition) ? definition.exitPoints : []) {
				for(const value of this.exitValues(nodeId)) {
					const vtx = value === undefined ? undefined : this.dfg.getVertex(value) ?? this.whole.getVertex(value);
					if(vtx === undefined) {
						/* an exit flowR cannot place says nothing about the call, so neither can the others */
						return undefined;
					}
					acc.merge(this.classifyEntry(vtx));
				}
			}
		}
		/* every merge records one value, so none means no exit point was found */
		if(acc.values.length === 0) {
			return undefined;
		}
		const built = acc.build(id);
		return built.types.includes(InputType.Unknown) ? undefined : built;
	}

	/**
	 * What an exit point hands back, descending through the branches of an `if` (which yields one of them, while
	 * {@link classifyFunctionCall} reports the condition it depends on). Yields `undefined` for a construct whose
	 * value flowR cannot name, a loop above all, so the caller stops rather than answers with the branches alone.
	 */
	private *exitValues(id: NodeId, depth = 0): Generator<NodeId | undefined> {
		const vtx = this.dfg.getVertex(id) ?? this.whole.getVertex(id);
		if(!DfgVertex.isFunctionCall(vtx)) {
			yield id;
			return;
		}
		const isLoop = DfgVertex.hasOrigin(vtx, BuiltInProcName.WhileLoop) || DfgVertex.hasOrigin(vtx, BuiltInProcName.ForLoop)
			|| DfgVertex.hasOrigin(vtx, BuiltInProcName.RepeatLoop);
		if(isLoop) {
			yield undefined;
		} else if(DfgVertex.hasOrigin(vtx, BuiltInProcName.IfThenElse) && depth <= MaxFunctionResolveDepth) {
			for(const branch of vtx.args.slice(1)) {
				const ref = FunctionArgument.getReference(branch);
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
			const classified = this.classifyAt(o.id) ?? this.classifyInFullGraph(o.id);
			if(classified?.types.every(isConstantLike)) {
				/* a constant held as a function (`get("readLines")`, a body set to quoted code) says nothing about what calling it yields */
				return sourceOf(call.id, InputType.Unknown);
			} else if(classified !== undefined && !classified.types.includes(InputType.Unknown)) {
				return classified;
			}
		}
		return undefined;
	}

	private classifyVariable(vtx: DataflowGraphVertexInfo): InputSource {
		const linked = this.matchWholeLinkedObject(vtx.id);
		if(linked) {
			return this.classifyCdsAndReturn(vtx, sourceOf(vtx.id, linked.type));
		}
		const origins = Dataflow.origin(this.dfg, vtx.id);
		if(origins === undefined || origins.length === 0) {
			if(Dataflow.targetsOf(this.whole, vtx.id, EdgeType.DefinedByOnCall).length > 0) {
				return this.classifyCdsAndReturn(vtx, sourceOf(vtx.id, InputType.Scope));
			}
			// the definition is not part of the criterion's function, so it has to come from an enclosing scope
			const outer = this.classifyInFullGraph(vtx.id);
			return this.classifyCdsAndReturn(vtx, outer ? { ...outer, id: vtx.id } : sourceOf(vtx.id, InputType.Unknown));
		}
		const acc = new ClassificationAccumulator();
		for(const o of origins) {
			if(o.type === OriginType.ConstantOrigin) {
				acc.push(InputType.DerivedConstant, this.extractConstantValue(o.id));
			} else if(o.type === OriginType.ReadVariableOrigin || o.type === OriginType.WriteVariableOrigin) {
				this.classifyVariableOrigin(o.id, acc);
			} else if(o.type === OriginType.FunctionCallOrigin || o.type === OriginType.BuiltInFunctionOrigin) {
				acc.merge(this.classifyAt(o.id));
			} else {
				acc.merge(undefined);
			}
		}
		if(this.mayBeRebound(vtx.id, origins.map(o => o.id))) {
			acc.merge(undefined);
		}
		return this.classifyCdsAndReturn(vtx, acc.build(vtx.id));
	}

	/** what the default of a parameter yields when a call leaves the parameter out */
	private defaultTypes(id: NodeId): readonly InputType[] {
		const idMap = this.whole.idMap;
		const param = idMap?.get(idMap.get(id)?.info.parent as NodeId);
		return RParameter.is(param) && param.defaultValue !== undefined ? this.classifyInFullGraph(param.defaultValue.info.id)?.types ?? [InputType.Unknown] : [];
	}

	private parameterType(id: NodeId): InputType | undefined {
		if(this.dfg.idMap?.get(id)?.info.role !== RoleInParent.ParameterName) {
			return undefined;
		}
		return this.matchWholeLinkedObject(id)?.type ?? (this.isPlumberEndpointParameter(id) ? InputType.User : InputType.Parameter);
	}

	/** plumber hands each parameter of a function with a `#*` route annotation what a request sends */
	private isPlumberEndpointParameter(id: NodeId): boolean {
		const idMap = this.whole.idMap as AstIdMap;
		for(const node of RNode.iterateParents(idMap.get(id), idMap)) {
			if(node.info.adToks?.some(t => RComment.is(t) && PlumberEndpoint.test(t.lexeme ?? ''))) {
				return true;
			} else if(node.info.parent === undefined || (RFunctionDefinition.is(node) && node.info.adToks?.length)) {
				return false;
			}
		}
		return false;
	}

	/**
	 * Resolves a variable definition or use origin, handling the special cases of
	 * scope-escaped variables (DefinedByOnCall) and parameter definitions.
	 */
	private classifyVariableOrigin(definitionId: NodeId, acc: ClassificationAccumulator): void {
		const v = this.dfg.getVertex(definitionId);
		if(!v) {
			acc.merge(undefined);
			return;
		}
		// if the referenced definition is linked via defined-by-on-call to another id (e.g., a parameter linked to a
		// caller argument), follow it into the caller; only if that leads nowhere is it an opaque Scope origin
		const onCall = Dataflow.targetsOf(this.whole, v.id, EdgeType.DefinedByOnCall);
		if(onCall.length > 0) {
			const callers = onCall.map(t => this.classifyInFullGraph(t)).filter(isNotUndefined);
			const known = callers.filter(c => !c.types.includes(InputType.Unknown));
			known.forEach(c => acc.merge(c));
			if(known.length > 0 && known.length === callers.length && !this.escapes(v.id)) {
				return;
			}
			acc.push(InputType.Scope);
			acc.allPure = false;
		}
		const parameter = DfgVertex.isVariableDefinition(v) ? this.parameterType(v.id) : undefined;
		if(parameter !== undefined) {
			acc.push(parameter);
			acc.types.push(...this.defaultTypes(v.id));
		} else {
			acc.merge(this.classifyEntry(v));
		}
	}

	/** whether the function binding the parameter is used as a value, so it may be called with anything the visible callers do not pass */
	private escapes(parameter: NodeId): boolean {
		const idMap = this.whole.idMap;
		const fn = idMap === undefined ? undefined : RNode.iterateParents(idMap.get(parameter), idMap).find(RFunctionDefinition.is);
		const holders = fn === undefined ? [] : Dataflow.sourcesOf(this.whole, fn.info.id, EdgeType.DefinedBy);
		return holders.length === 0 || holders.some(h => Dataflow.sourcesOf(this.whole, h, EdgeType.Reads)
			.some(r => !RFunctionCall.is(idMap?.get(r)) || !Dataflow.hasEdge(this.whole, r, fn?.info.id as NodeId, EdgeType.Calls)));
	}

	/** whether code flowR cannot follow (`load`, `eval`, `e$x <-`) may rebind the variable before the use */
	private mayBeRebound(use: NodeId, definitions: readonly NodeId[]): boolean {
		const idMap = this.whole.idMap as AstIdMap;
		const node = idMap.get(use);
		const fn = RNode.iterateParents(node, idMap).find(RFunctionDefinition.is);
		const within = (id: NodeId) => fn !== undefined && RNode.iterateParents(idMap.get(id), idMap).some(p => p === fn);
		const local = definitions.length > 0 && definitions.every(within);
		/* an unconditional definition after the effect binds anew */
		const overwritten = (e: NodeId) => definitions.length > 0 && definitions.every(d => !this.whole.getVertex(d)?.cds?.length
			&& runsAfter(idMap.get(idMap.get(d)?.info.parent as NodeId), idMap.get(e), idMap));
		return this.rebinders().some(([e, fields]) => (fields === undefined || fields.some(f => f === undefined || f === RNode.lexeme(node)))
			&& (!local || within(e)) && !overwritten(e) && !((fn === undefined || local) && runsAfter(idMap.get(e), node, idMap)));
	}

	/** the unknown side effects, and the replacements `e$x <- v` with the names they may bind (`undefined` for any) */
	private rebinders(): (readonly [NodeId, readonly (ConstantValue | undefined)[] | undefined])[] {
		const name = (a: FunctionArgument) => {
			const ref = FunctionArgument.getReference(a);
			return ref === undefined ? undefined : this.extractConstantValue(ref) ?? RNode.lexeme(this.whole.idMap?.get(ref));
		};
		return this.rebinding ??= [
			...[...this.whole.unknownSideEffects].filter(e => !UnknownSideEffect.isLinked(e)).map(e => [UnknownSideEffect.id(e), undefined] as const),
			...this.whole.verticesOfType(VertexType.FunctionCall)
				.filter(([, c]) => DfgVertex.hasOrigin(c, BuiltInProcName.Replacement) && FieldReplacements.has(Identifier.getName(c.name)))
				.map(([id, c]) => [id, c.args.slice(1, -1).map(name)] as const)
		];
	}

	private classifyVariableDefinition(vtx: DataflowGraphVertexVariableDefinition): InputSource {
		const parameter = this.parameterType(vtx.id);
		if(parameter !== undefined) {
			return this.classifyCdsAndReturn(vtx, { ...sourceOf(vtx.id, parameter), types: uniqueArray([parameter, ...this.defaultTypes(vtx.id)]) });
		} else if(!vtx.source?.length) {
			// fallback to unknown if we cannot find the value
			return this.classifyCdsAndReturn(vtx, sourceOf(vtx.id, InputType.Unknown));
		}
		const acc = new ClassificationAccumulator();
		vtx.source.forEach(tid => acc.merge(this.classifyAt(tid)));
		return this.classifyCdsAndReturn(vtx, acc.build(vtx.id));
	}

	private classifyCdsAndReturn(vtx: DataflowGraphVertexArgument, src: InputSource): InputSource {
		if(vtx.cds) {
			/* running only once a call forces it is no condition on the data */
			const cds = uniqueArray(vtx.cds.filter(c => c.byPromise !== true).flatMap(c => this.dependencies(this.conditionOf(c.id), [])).concat(src.cds ?? []));
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
	/** how the framework declares the entries of this object, so a read of `input$n` links to the `textInput("n", ...)` defining it */
	readonly declaredBy?: LinkedInputDeclaration
}

/** The calls that declare the entries of a {@link LinkedInputObject}, and where they carry the entry's name. */
export interface LinkedInputDeclaration {
	/** the declaring calls, e.g. shiny's `textInput`, `selectInput`, ... */
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
	readonly call:    Identifier,
	/** the name of the bounding argument */
	readonly argName: string,
	/** the index of the bounding argument when it is passed positionally */
	readonly argIdx:  number
}

/** the condition of an `if` or `switch`; with named arguments to an `if`, we do not know which it is */
function conditionArgument(call: DataflowGraphVertexFunctionCall): FunctionArgument | undefined {
	if(DfgVertex.hasOrigin(call, BuiltInProcName.Switch)) {
		return call.args.find(a => FunctionArgument.hasName(a, 'EXPR')) ?? call.args.find(a => !FunctionArgument.isNamed(a));
	}
	return DfgVertex.hasOrigin(call, BuiltInProcName.IfThenElse) && !call.args.some(FunctionArgument.isNamed) ? call.args[0] : undefined;
}

/** the function definitions the given node is nested in, innermost first */
function* enclosingFunctions(node: RNode<ParentInformation> | undefined, idMap: AstIdMap): Generator<RFunctionDefinition<ParentInformation>> {
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

const PlumberEndpoint = /^#\*\s*@(?:get|post|put|delete|patch|head|options|any|use)\b/i;

/** the replacements that may write a binding of an environment, as `e$x <- v` does */
const FieldReplacements: ReadonlySet<string> = new Set(['$<-', '[[<-']);

const LoopTypes: ReadonlySet<RType> = new Set([RType.ForLoop, RType.WhileLoop, RType.RepeatLoop]);

/** whether `later` surely runs after `node`: later in the same file, in no shared loop, not deferred into a function apart from it */
function runsAfter(later: RNode<ParentInformation> | undefined, node: RNode<ParentInformation> | undefined, idMap: AstIdMap): boolean {
	const [first, second] = [RNode.span(node), RNode.span(later)];
	if(first === undefined || second === undefined || node?.info.file !== later?.info.file || !(SourceRange.startsCompletelyBefore(first, second) || SourceRange.isSubsetOf(first, second))) {
		return false;
	}
	const around = new Set(RNode.iterateParents(later, idMap));
	return RNode.iterateParents(node, idMap).every(p => RFunctionDefinition.is(p) ? around.has(p) : !LoopTypes.has(p.type) || !around.has(p));
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
	/** where the framework entry this source reads is declared, e.g. the `textInput("n", ...)` behind an `input$n` */
	declaredAt?: NodeId[]
}

/**
 * The input sources of a criterion, each classified with an {@link InputSource} object.
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
	/** Functions whose result counts as a {@link InputType.DerivedConstant} whatever flows in, like a linter's escaping functions. */
	sanitizers?:            Functions
	/** The arguments a {@link sanitizers|sanitizer} takes as code rather than escaping, like the template of `sqlInterpolate`, whose data still flows. */
	templates?:             readonly NarrowingFunction[]
	/** Functions that evaluate code or look names up at run time (`eval`, `do.call`, `exists`), so their result is never constant. */
	evaluating?:            Functions
	/** Functions that cut or replace parts of a string (`gsub`), undoing what a {@link sanitizers|sanitizer} escaped. */
	editing?:               Functions
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
	const c = new InputClassifier(dfg, config, fullDfg, packages);
	if(!DfgVertex.isFunctionCall(vtx)) {
		return vtx ? [c.classifyEntry(vtx)] : [];
	}
	const ret: InputSources = [];
	for(const arg of vtx.args) {
		const entry = c.classifyArgument(vtx, FunctionArgument.getReference(arg));
		if(entry === undefined) {
			continue;
		}
		const name = FunctionArgument.getName(arg);
		ret.push(name !== undefined ? { ...entry, name } : entry);
	}
	return ret;
}
