import type { DataflowProcessorInformation } from '../../../../../processor';
import type { AstIdMap, ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RFunctionCall } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RNumber } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-number';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { RFunctionDefinition } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RoleInParent } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/role';
import type { LocalFunctionConfiguration } from './built-in-local';
import type { DataflowGraph } from '../../../../../graph/graph';
import { type DataflowGraphVertexFunctionDefinition, type DataflowGraphVertexInfo, type DeferredEnvOp, DfgVertex, EnvOpKind } from '../../../../../graph/vertex';
import { EdgeType } from '../../../../../graph/edge';
import { Dataflow } from '../../../../../graph/df-helper';
import { FunctionSemantics } from '../../../../../fn/function-semantics';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { REnvironment, type REnvironmentInformation } from '../../../../../environments/environment';
import { hasEnvState, Identifier, type IdentifierDefinition, type InGraphIdentifierDefinition, type InGraphReferenceType, type NamedInGraphIdentifierDefinition, ReferenceType } from '../../../../../environments/identifier';
import { Resolve } from '../../../../../environments/resolve-helper';
import { applyGlobalKills, applyKills } from '../../../../../environments/apply-kill';
import type { KillReference } from '../../../../../info';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import type { CallContext } from '../../../../../eval/resolve/alias-tracking';
import { recordFound } from '../../../../linker';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../../../../project/context/flowr-analyzer-context';
import { StackEnvKind } from '../../../../../environments/default-builtin-config/shared-configs';
import { stackEnvKindOf } from './built-in-stack-env';
import { EnvironmentProducers, holdsValueOf, rebindAliases, rebindHolders } from './built-in-envir-utils';
import { RBinaryOp } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RAccess } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-access';

const OpOfProcessor: Partial<Record<BuiltInProcName, EnvOpKind>> = {
	[BuiltInProcName.Assignment]: EnvOpKind.Define,
	[BuiltInProcName.Get]:        EnvOpKind.Read,
	[BuiltInProcName.Rm]:         EnvOpKind.Remove
};

/** The formal of `rm` naming what it removes by value, its `...` names them unevaluated. */
const RemovedByValue = 'list';

/** The calls of a function body `roots` whose environment operation depends on the call of the function: a name not written down, or a read or removal in an environment the body does not bind (what a body defines in such an environment under a name written down already reaches the caller, see {@link InGraphIdentifierDefinition#envWrites}). */
export function deferredEnvOps<OtherInfo>(roots: Iterable<NodeId>, graph: DataflowGraph, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DeferredEnvOp[] | undefined {
	let ops: DeferredEnvOp[] | undefined;
	for(const id of roots) {
		const vertex = graph.getVertex(id);
		const node = data.completeAst.idMap.get(id);
		if(DfgVertex.hasOrigin(vertex, BuiltInProcName.TableAssignment)) {
			/* `t[, a := v]` changes the table the parameter `t` holds, which is the caller's */
			for(const target of Dataflow.sourcesOf(graph, id, EdgeType.DefinedBy).filter(t => heldByParameter(t, graph, data.completeAst.idMap))) {
				(ops ??= []).push({ id: target, kind: EnvOpKind.ChangeInPlace, names: [], literals: [], envir: target, returns: false });
			}
			continue;
		} else if(DfgVertex.hasOrigin(vertex, BuiltInProcName.Replacement)) {
			const op = replacementOf(id, node, graph, data.completeAst.idMap, data.environment);
			if(op !== undefined) {
				(ops ??= []).push(op);
			}
			continue;
		} else if(!DfgVertex.isFunctionCall(vertex) || !RFunctionCall.isNamed(node)) {
			continue;
		}
		const defs = Dataflow.targetsOf(graph, id, EdgeType.Calls).some(t => !NodeId.isBuiltIn(t)) ? undefined : Resolve.byNameAndType(node.functionName.content, data.environment, ReferenceType.Function);
		const builtIn = defs?.length === 1 && defs[0].type === ReferenceType.BuiltInFunction ? defs[0] : undefined;
		if(builtIn?.processorName === BuiltInProcName.Local) {
			const evaluated = evaluatedDefinitions(node, builtIn.config as LocalFunctionConfiguration, graph, data.completeAst.idMap, data.environment);
			if(evaluated.length > 0) {
				(ops ??= []).push(...evaluated);
			}
			continue;
		}
		const kind = builtIn?.processorName === undefined ? undefined : OpOfProcessor[builtIn.processorName];
		const config = builtIn?.config as { sig?: readonly (readonly [string, number])[], targetVariable?: boolean, returnsValue?: boolean } | undefined;
		if(kind === undefined || config?.sig === undefined || (kind === EnvOpKind.Define && config.targetVariable !== true)) {
			continue;
		}
		const formals = config.sig.map(([name]) => name);
		const bound = FunctionSemantics.call.match.toNames(node.arguments, formals);
		const named = RArgument.valueOf(bound.get(kind === EnvOpKind.Remove ? RemovedByValue : formals[0]));
		const envir = RArgument.valueOf(bound.get('envir'));
		/* `rm` takes the names in its `...` as written */
		const literals = kind === EnvOpKind.Remove ? node.arguments.flatMap(a => RArgument.isEmpty(a) || (a.name !== undefined && formals.includes(a.name.content)) ? [] : [literalName(a.value)]) : [];
		const computed = named !== undefined && !RString.is(named);
		/* without an environment, the operation works on the frame of the call, which no caller sees */
		if(envir === undefined || (named === undefined && literals.length === 0) || literals.includes(undefined)
			|| (kind === EnvOpKind.Define && !computed && !heldByParameter(envir.info.id, graph, data.completeAst.idMap) && callerGenerations(envir, data.environment, graph, data.completeAst.idMap) === undefined)) {
			continue;
		}
		(ops ??= []).push({
			id,
			kind,
			names:    named === undefined ? [] : [named.info.id],
			literals: literals as string[],
			envir:    envir.info.id,
			value:    kind === EnvOpKind.Define ? RArgument.valueOf(bound.get(formals[1]))?.info.id : undefined,
			returns:  config.returnsValue !== false
		});
	}
	return ops;
}

/** What `local(expr, envir)` and `evalq(expr, envir)` define in an environment a parameter holds: the body evaluates `expr` in a frame of its own, as it cannot know the environment, its call defines into the one it hands over. */
function evaluatedDefinitions(node: RFunctionCall<ParentInformation>, config: LocalFunctionConfiguration, graph: DataflowGraph, idMap: AstIdMap, environment: REnvironmentInformation): DeferredEnvOp[] {
	const bound = FunctionSemantics.call.match.toNames(node.arguments, [config.args.expr, config.args.env]);
	const envir = RArgument.valueOf(bound.get(config.args.env));
	const expr = RArgument.valueOf(bound.get(config.args.expr));
	if(expr === undefined || envir === undefined || !(heldByParameter(envir.info.id, graph, idMap) || callerGenerations(envir, environment, graph, idMap) !== undefined)) {
		return [];
	}
	const ops: DeferredEnvOp[] = [];
	for(const id of RNode.collectAllIdsWithStop(expr, RFunctionDefinition.is)) {
		const name = literalName(idMap.get(id));
		/* a super assignment defines outside the evaluation */
		if(name !== undefined && DfgVertex.isVariableDefinition(graph.getVertex(id)) && !Dataflow.definedBySuperAssignment(graph, id)) {
			ops.push({ id: node.info.id, kind: EnvOpKind.Define, names: [], literals: [name], envir: envir.info.id, value: id, returns: true });
		}
	}
	return ops;
}

/** `env$x <- value` or `env[["x"]] <- value` in a body where `env` is a parameter: the call decides whether it writes into an environment the caller holds or into a copy of a list, see {@link EnvOpKind.Replace}. */
function replacementOf(id: NodeId, node: RNode<ParentInformation> | undefined, graph: DataflowGraph, idMap: AstIdMap, environment: REnvironmentInformation): DeferredEnvOp | undefined {
	const access: RAccess<ParentInformation> | undefined = RAccess.is(node) ? node : undefined;
	const assignment = access && RNode.directParent(access, idMap);
	const value = RBinaryOp.is(assignment) && assignment.lhs === access && ReplacedBy.has(assignment.operator) ? (assignment as RBinaryOp<ParentInformation>).rhs : undefined;
	const target = value !== undefined && RSymbol.is(access?.accessed) ? access : undefined;
	const field = target !== undefined && target.access.length === 1 && FieldAccess.has(target.operator) ? RArgument.valueOf(target.access[0]) : undefined;
	if(target === undefined || field === undefined || !(heldByParameter(target.accessed.info.id, graph, idMap) || callerGenerations(target.accessed, environment, graph, idMap) !== undefined)) {
		return undefined;
	}
	const literal = target.operator === '$' || RString.is(field) ? literalName(field) : undefined;
	return { id, kind: EnvOpKind.Replace, names: literal === undefined ? [field.info.id] : [], literals: literal === undefined ? [] : [literal], envir: target.accessed.info.id, value: value?.info.id, returns: true };
}

/** the assignments a replacement rebinds its target in the frame of the body with */
const ReplacedBy: ReadonlySet<string> = new Set(['<-', '=']);
/** the accesses naming a single variable of an environment */
const FieldAccess: ReadonlySet<string> = new Set(['$', '[[']);

/** Whether `id` reads a parameter, which holds what the call hands over (the body cannot know the environment it may hold). */
function heldByParameter(id: NodeId, graph: DataflowGraph, idMap: AstIdMap): boolean {
	const closure = frameOf(idMap.get(id));
	const held = readBindings(closure?.info.id ?? id, graph);
	return held.length === 1 && idMap.get(held[0])?.info.role === RoleInParent.ParameterName;
}

/** What `id` reads, the target of a replacement (`env$x <- v`) reads the variable it rebinds besides the replacement itself. */
function readBindings(id: NodeId, graph: DataflowGraph): NodeId[] {
	return Dataflow.targetsOf(graph, id, EdgeType.Reads).filter(t => !DfgVertex.isFunctionCall(graph.getVertex(t)));
}

/** How many calls up the frame `node` names lies: 1 for the caller (`parent.frame()`, directly or by a variable bound to it only), `n` for `parent.frame(n)` with a constant `n`, `undefined` for any other environment. */
function callerGenerations(node: RNode<ParentInformation> | undefined, environment: REnvironmentInformation, graph: DataflowGraph, idMap: AstIdMap): number | undefined {
	if(!RSymbol.is(node)) {
		return frameGenerations(node, environment);
	}
	const held = readBindings(node.info.id, graph).map(d => frameGenerations(idMap.get(Dataflow.assignedValueOf(d, graph) ?? ''), environment));
	return held.length > 0 && held.every(g => g !== undefined && g === held[0]) ? held[0] : undefined;
}

/** {@link callerGenerations} of a `parent.frame` call itself. */
function frameGenerations(node: RNode<ParentInformation> | undefined, environment: REnvironmentInformation): number | undefined {
	if(stackEnvKindOf(node, { environment }) === StackEnvKind.CallerFrame) {
		return 1;
	}
	const call = RFunctionCall.isNamed(node, 'parent.frame') && node.arguments.length === 1 ? node : undefined;
	const count = call === undefined ? undefined : RArgument.valueOf(call.arguments[0]);
	const n = RNumber.is(count) ? count.content.num : undefined;
	return call !== undefined && n !== undefined && Number.isInteger(n) && n > 1 && Resolve.isBuiltIn(call.functionName.content, environment, ReferenceType.Function) ? n : undefined;
}

/** The closure whose frame `environment(fn)` names, see {@link closureFrameResolution}. */
function frameOf(node: RNode<ParentInformation> | undefined): RSymbol<ParentInformation> | undefined {
	const fn = RFunctionCall.isNamed(node, 'environment') && node.arguments.length === 1 ? RArgument.valueOf(node.arguments[0]) : undefined;
	return RSymbol.is(fn) ? fn : undefined;
}

function literalName(node: RNode<ParentInformation> | undefined): string | undefined {
	return RSymbol.is(node) ? Identifier.getName(node.content) : RString.is(node) ? node.content.str : undefined;
}

/** Where an operation of a body works once a call runs it: the variables holding the environment there, or a frame of the caller. */
type EnvAtCall = { readonly holders: readonly (NamedInGraphIdentifierDefinition & { envState: REnvironmentInformation })[] } | StackEnvKind.Global | StackEnvKind.CallerFrame;

/** How the call `via` of the function `fn` runs it, `direct` if `via` is the call being linked rather than one in a function it calls. */
interface Run {
	readonly fn:       DataflowGraphVertexFunctionDefinition
	readonly via:      NodeId
	readonly direct:   boolean
	readonly graph:    DataflowGraph
	readonly idMap:    AstIdMap
	/** each function on the way to `fn` with the call running it */
	readonly context?: CallContext
}

/** The parameter of the function run that `id` reads, if it reads just that. */
function parameterReadBy(id: NodeId, { fn, graph }: Run): NodeId | undefined {
	const vertex = graph.getVertex(id);
	const bindings = DfgVertex.isUse(vertex) || (DfgVertex.isVariableDefinition(vertex) && vertex.par) ? readBindings(id, graph) : [];
	return bindings.length === 1 && Object.hasOwn(fn.params, bindings[0]) ? bindings[0] : undefined;
}

/** What the call hands to `parameter`, matched as R matches arguments. */
function handedTo(parameter: NodeId, { fn, via, graph, idMap }: Run): NodeId[] {
	const call = graph.getVertex(via);
	if(!DfgVertex.isFunctionCall(call)) {
		return [];
	}
	const formals: Record<string, NodeId> = {};
	for(const p of Object.keys(fn.params)) {
		const name = idMap.get(NodeId.normalize(p));
		if(RSymbol.is(name)) {
			formals[Identifier.getName(name.content)] = name.info.id;
		}
	}
	return (FunctionSemantics.call.match.toSpec(call.args, formals).get(parameter) ?? []).map(a => RArgument.valueOf(idMap.get(a))?.info.id ?? a);
}

/** What the call hands over for `id`, if that just reads a parameter, else `id` itself. */
function valueAt(id: NodeId, run: Run): NodeId {
	const parameter = parameterReadBy(id, run);
	const handed = parameter === undefined ? [] : handedTo(parameter, run);
	return handed.length === 1 ? handed[0] : id;
}

function envAtCall(envir: NodeId, environment: REnvironmentInformation, run: Run): EnvAtCall | undefined {
	const node = run.idMap.get(envir);
	const stack = stackEnvKindOf(node, { environment });
	/* run by a call of another function, only the global environment is the same for both */
	if(stack === StackEnvKind.Global) {
		return stack;
	} else if(run.direct && callerGenerations(node, environment, run.graph, run.idMap) === 1) {
		return StackEnvKind.CallerFrame;
	}
	const closure = frameOf(node);
	const symbol = closure ?? node;
	if(!RSymbol.is(symbol)) {
		return undefined;
	}
	/* a parameter holds what the call hands over, any other binding of the body is its own */
	const bound = readBindings(symbol.info.id, run.graph).some(b => run.fn.subflow.graph.has(b));
	/* a free variable of a function defined at the top is a global one, which a call at the top sees as the function does */
	if(!run.direct && (bound || environment.level > 0 || RNode.strictlyEnclosingFunction(run.fn.id, run.idMap) !== undefined)) {
		return undefined;
	}
	const handed = bound ? run.idMap.get(valueAt(symbol.info.id, run)) : symbol;
	/* the call may hand over the frame of a closure itself, `put(environment(g))` */
	const handedFrame = handed === symbol ? undefined : frameOf(handed);
	const held = handedFrame ?? handed;
	if(!RSymbol.is(held) || (held === symbol && bound)) {
		return undefined;
	} else if(closure !== undefined || handedFrame !== undefined) {
		/* the frame of the closure the variable holds, tracked on the variable, see `closureFrameResolution` */
		const defs = Resolve.byName(held.content, environment);
		const def = defs?.length === 1 && !NodeId.isBuiltIn(defs[0].definedAt) ? defs[0] as NamedInGraphIdentifierDefinition : undefined;
		return def === undefined ? undefined : { holders: [{ ...def, envState: def.envState ?? REnvironment.pushLocal(environment), envId: def.envId ?? def.nodeId, closureFrame: true }] };
	}
	const holders = Resolve.byNameAndType(held.content, environment, ReferenceType.Variable);
	if(holders === undefined || holders.length === 0 || !holders.every(h => hasEnvState(h) && h.name !== undefined && (h as InGraphIdentifierDefinition).closureFrame !== true)) {
		return undefined;
	}
	return { holders: holders as (NamedInGraphIdentifierDefinition & { envState: REnvironmentInformation })[] };
}

/** Each function the calls `calls` run on the way to `fn`, the last one calling `fn`, with the call running it. */
function contextOfChain(calls: readonly NodeId[], fn: NodeId, idMap: AstIdMap): CallContext {
	const context = new Map<NodeId, NodeId>([[fn, calls[calls.length - 1]]]);
	for(let i = 0; i < calls.length - 1; i++) {
		const runs = RNode.strictlyEnclosingFunction(calls[i + 1], idMap);
		if(runs !== undefined) {
			context.set(runs, calls[i]);
		}
	}
	return context;
}

/** The names `name` computes in the run: a parameter takes what the call hands over, anything else is resolved for the call it runs in. */
function namesAt(name: NodeId, run: Run, ctx: ReadOnlyFlowrAnalyzerContext): string[] | undefined {
	const node = run.idMap.get(name);
	if(RString.is(node)) {
		return [node.content.str];
	}
	const info = Resolve.info(run.graph, ctx);
	const parameter = parameterReadBy(name, run);
	if(parameter !== undefined) {
		const handed = handedTo(parameter, run);
		const names = handed.map(a => NodeValue.stringsOf(a, { ...info, callContext: run.context }));
		return handed.length === 0 || names.includes(undefined) ? undefined : names.flat() as string[];
	}
	return NodeValue.stringsOf(name, { ...info, callContext: run.context });
}

/** Runs the {@link deferredEnvOps} of the function `fn` for the call `call`, which runs `fn` itself or through the `chain` of calls in the functions it runs, the last one calling `fn`: the names they compute from parameters resolve with the values the call of `fn` hands over, and an environment a free variable or a parameter names is the one it holds at `call`, if `call` runs `fn` itself, else only the global environment is known to be the same. */
export function instantiateEnvOps(call: NodeId, fn: DataflowGraphVertexFunctionDefinition, chain: readonly NodeId[], environment: REnvironmentInformation, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext): REnvironmentInformation {
	const idMap = graph.idMap;
	if(fn.envOps === undefined || idMap === undefined) {
		return environment;
	}
	const calls = [call, ...chain];
	const run: Run = { fn, via: chain.at(-1) ?? call, direct: chain.length === 0, graph, idMap, context: contextOfChain(calls, fn.id, idMap) };
	const callCds = graph.getVertex(call)?.cds;
	for(const op of fn.envOps) {
		if(op.kind === EnvOpKind.ChangeInPlace) {
			environment = changeInPlaceAt(op, run, call, environment);
			continue;
		}
		const names = op.names.map(n => namesAt(n, run, ctx));
		const at = envAtCall(op.envir, environment, run);
		if(at === undefined || names.some(n => n === undefined || n.length === 0) || (op.kind === EnvOpKind.Replace && at !== StackEnvKind.CallerFrame && !writesEnvironment(at, graph))) {
			continue;
		}
		const all = [...op.literals, ...names.flat() as string[]];
		const holders = typeof at === 'object' ? at.holders : [];
		/* with several names or environments, each is only maybe the one */
		const cds = callCds ?? (all.length > 1 || holders.length > 1 ? [] : undefined);
		/* what a call within another function hands over is kept by that call only, which a slice reaches through the value in the body */
		const value = op.value === undefined || !run.direct ? op.value : valueAt(op.value, run);
		/* every call on the way makes the change */
		for(const c of op.kind === EnvOpKind.Read ? [] : calls) {
			graph.addEdge(value ?? op.id, c, EdgeType.SideEffectOnCall);
		}
		environment = applyOp(op, value, all, at, environment, cds, call, graph);
	}
	return environment;
}

/** Binds the variable the call hands to the parameter of the {@link EnvOpKind.ChangeInPlace} `op`, and what else holds its object, to the change. */
function changeInPlaceAt(op: DeferredEnvOp, run: Run, call: NodeId, environment: REnvironmentInformation): REnvironmentInformation {
	const parameter = run.direct ? readBindings(op.envir, run.graph).find(b => Object.hasOwn(run.fn.params, b)) : undefined;
	const args = parameter === undefined ? [] : handedTo(parameter, run);
	const handed = args.length === 1 ? run.idMap.get(args[0]) : undefined;
	if(!RSymbol.is(handed)) {
		return environment;
	}
	run.graph.addEdge(op.id, call, EdgeType.SideEffectOnCall);
	const [rebound] = rebindAliases(environment, handed.content, op.id, call);
	/* the caller's variable may still hold the table as it was, the change joins its binding */
	return REnvironment.define({ name: handed.content, nodeId: op.id, definedAt: call, type: ReferenceType.Variable, cds: [] }, false, rebound);
}

function applyOp(op: DeferredEnvOp, value: NodeId | undefined, names: readonly string[], at: EnvAtCall, environment: REnvironmentInformation, cds: IdentifierDefinition['cds'], call: NodeId, graph: DataflowGraph): REnvironmentInformation {
	const update = (state: REnvironmentInformation, global: boolean, closureFrame = false): REnvironmentInformation => {
		switch(op.kind) {
			case EnvOpKind.Define:
			case EnvOpKind.Replace: {
				let next = state;
				const type = referenceTypeOf(value === undefined ? undefined : graph.getVertex(value), graph);
				for(const name of names) {
					next = REnvironment.define({ name, nodeId: value ?? op.id, definedAt: value === undefined ? op.id : call, type, cds }, global && next.level > 0, next);
				}
				return next;
			}
			case EnvOpKind.Remove: {
				const kills: KillReference[] = names.map(name => ({ kind: 'named', reference: { nodeId: op.id, name, cds, type: ReferenceType.Variable }, killedBy: op.id }));
				/* the frame of a closure records the removal, see `removeFromCustomEnv` */
				return global ? applyGlobalKills(state, kills) : applyKills(state, kills, closureFrame);
			}
			case EnvOpKind.Read: {
				const found: NodeId[] = [];
				for(const def of names.flatMap(name => Resolve.byName(name, state) ?? [])) {
					if(!NodeId.isBuiltIn(def.nodeId)) {
						graph.addEdge(op.id, def.nodeId, op.returns ? EdgeType.Reads | EdgeType.Returns : EdgeType.Reads);
						found.push(def.nodeId);
					}
				}
				recordFound(graph, op.id, found, call);
				return state;
			}
			case EnvOpKind.ChangeInPlace:
				/* replayed by `changeInPlaceAt`, it names no environment */
				return state;
		}
	};
	if(at === StackEnvKind.Global || at === StackEnvKind.CallerFrame) {
		return update(environment, at === StackEnvKind.Global);
	}
	for(const holder of at.holders) {
		environment = rebindHolders(environment, holder, update(holder.envState, false, holder.closureFrame === true), call);
	}
	return environment;
}

/** Whether the call `call` of `fn` replayed the replacement or assignment `write` of its body (see {@link EnvOpKind.Replace} and {@link EnvOpKind.Define}) into the environment it hands over, so what it writes is known there. */
export function replayedAt(write: NodeId, fn: DataflowGraphVertexFunctionDefinition, call: NodeId, graph: DataflowGraph): boolean {
	const op = fn.envOps?.find(o => o.id === write && (o.kind === EnvOpKind.Replace || o.kind === EnvOpKind.Define));
	if(op?.value === undefined || graph.idMap === undefined) {
		return false;
	}
	const value = valueAt(op.value, { fn, via: call, direct: true, graph, idMap: graph.idMap });
	return Dataflow.hasEdge(graph, value, call, EdgeType.SideEffectOnCall);
}

/** Whether a replacement into `at` writes into an environment: the frame of a closure, or what every holder surely holds as one. */
function writesEnvironment(at: EnvAtCall, graph: DataflowGraph): boolean {
	return typeof at === 'object' && at.holders.every(h => h.closureFrame === true || holdsValueOf(h, graph, EnvironmentProducers));
}

/** What a definition of the value `vertex` binds, as an assignment does: a function, a value, or what a read, call, or other definition hands on. */
function referenceTypeOf(vertex: DataflowGraphVertexInfo | undefined, graph: DataflowGraph): InGraphReferenceType {
	if(DfgVertex.isFunctionDefinition(vertex)) {
		return ReferenceType.Function;
	} else if(DfgVertex.isVariableDefinition(vertex)) {
		return Dataflow.targetsOf(graph, vertex.id, EdgeType.DefinedBy).some(t => DfgVertex.isFunctionDefinition(graph.getVertex(t))) ? ReferenceType.Function : ReferenceType.Unknown;
	}
	return DfgVertex.isUse(vertex) || DfgVertex.isFunctionCall(vertex) ? ReferenceType.Unknown : ReferenceType.Variable;
}

/** The definitions the function `fn` makes in the frame of its caller (`assign("x", v, envir = parent.frame())`) for the call `call` within another function: the reads of that frame may see them, which the frame does not know of when it is processed, as it learns of the callee later (the top level runs them in {@link instantiateEnvOps}). */
export function linkCallerFrameWrites(call: NodeId, fn: DataflowGraphVertexFunctionDefinition, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext): void {
	const idMap = graph.idMap;
	const enclosing = idMap === undefined ? undefined : RNode.strictlyEnclosingFunction(call, idMap);
	const frame = enclosing === undefined ? undefined : idMap?.get(enclosing);
	if(fn.envOps === undefined || idMap === undefined || !RFunctionDefinition.is(frame)) {
		return;
	}
	const run: Run = { fn, via: call, direct: true, graph, idMap, context: contextOfChain([call], fn.id, idMap) };
	for(const op of fn.envOps) {
		const generations = op.kind === EnvOpKind.Read || op.kind === EnvOpKind.Remove ? undefined : op.generations ?? callerGenerations(idMap.get(op.envir), fn.subflow.environment, graph, idMap);
		if(generations === undefined) {
			continue;
		} else if(generations > 1) {
			/* `parent.frame(n)` of the callee is `parent.frame(n - 1)` of the function the call is in, which runs it by this call */
			graph.addEdge(op.value ?? op.id, call, EdgeType.SideEffectOnCall);
			handOnToCallers({ ...op, generations: generations - 1 }, frame.info.id, graph, ctx);
			continue;
		}
		const names = op.names.map(n => namesAt(n, run, ctx));
		if(names.includes(undefined)) {
			continue;
		}
		const all = new Set([...op.literals, ...names.flat() as string[]]);
		const value = op.value === undefined ? op.id : valueAt(op.value, run);
		graph.addEdge(value, call, EdgeType.SideEffectOnCall);
		for(const id of RNode.collectAllIdsWithStop(frame.body, RFunctionDefinition.is)) {
			const name = DfgVertex.isUse(graph.getVertex(id)) ? NodeId.recoverBareName(id, idMap) : undefined;
			if(name !== undefined && all.has(name)) {
				graph.addEdge(id, value, EdgeType.Reads);
				graph.addEdge(id, op.id, EdgeType.Reads);
			}
		}
	}
}

/** Registers `op` with the function `fn`, so the calls of it, linked already or later, replay it in their frame in turn. */
function handOnToCallers(op: DeferredEnvOp, fn: NodeId, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext): void {
	const definition = graph.getVertex(fn);
	if(!DfgVertex.isFunctionDefinition(definition) || definition.envOps?.some(o => o.id === op.id && o.generations === op.generations)) {
		return;
	}
	(definition as { envOps?: readonly DeferredEnvOp[] }).envOps = [...definition.envOps ?? [], op];
	for(const caller of Dataflow.sourcesOf(graph, fn, EdgeType.Calls)) {
		linkCallerFrameWrites(caller, definition, graph, ctx);
	}
}
