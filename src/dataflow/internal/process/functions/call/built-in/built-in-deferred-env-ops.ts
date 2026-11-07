import type { DataflowProcessorInformation } from '../../../../../processor';
import type { AstIdMap, ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RFunctionCall } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
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
import type { ReadOnlyFlowrAnalyzerContext } from '../../../../../../project/context/flowr-analyzer-context';
import { StackEnvKind } from '../../../../../environments/default-builtin-config/shared';
import { stackEnvKindOf } from './built-in-stack-env';
import { rebindHolders } from './built-in-envir-utils';

const OpOfProcessor: Partial<Record<BuiltInProcName, EnvOpKind>> = {
	[BuiltInProcName.Assignment]: EnvOpKind.Define,
	[BuiltInProcName.Get]:        EnvOpKind.Read,
	[BuiltInProcName.Rm]:         EnvOpKind.Remove
};

/** The formal of `rm` naming what it removes by value, its `...` names them unevaluated. */
const RemovedByValue = 'list';

/**
 * The calls of a function body `roots` whose environment operation depends on the call of the function: a name not
 * written down, or a read or removal in an environment the body does not bind (what a body defines in such an
 * environment under a name written down already reaches the caller, see {@link InGraphIdentifierDefinition#envWrites}).
 */
export function deferredEnvOps<OtherInfo>(roots: Iterable<NodeId>, graph: DataflowGraph, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DeferredEnvOp[] | undefined {
	let ops: DeferredEnvOp[] | undefined;
	for(const id of roots) {
		const vertex = graph.getVertex(id);
		const node = data.completeAst.idMap.get(id);
		if(!DfgVertex.isFunctionCall(vertex) || !RFunctionCall.isNamed(node)) {
			continue;
		}
		const defs = Dataflow.targetsOf(graph, id, EdgeType.Calls).some(t => !NodeId.isBuiltIn(t)) ? undefined : Resolve.byNameAndType(node.functionName.content, data.environment, ReferenceType.Function);
		const builtIn = defs?.length === 1 && defs[0].type === ReferenceType.BuiltInFunction ? defs[0] : undefined;
		if(builtIn?.processorName === BuiltInProcName.Local) {
			const evaluated = evaluatedDefinitions(node, builtIn.config as LocalFunctionConfiguration, graph, data.completeAst.idMap);
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
			|| (kind === EnvOpKind.Define && !computed && !heldByParameter(envir.info.id, graph, data.completeAst.idMap))) {
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

/**
 * What `local(expr, envir)` and `evalq(expr, envir)` define in an environment a parameter holds: the body evaluates
 * `expr` in a frame of its own, as it cannot know the environment, its call defines into the one it hands over.
 */
function evaluatedDefinitions(node: RFunctionCall<ParentInformation>, config: LocalFunctionConfiguration, graph: DataflowGraph, idMap: AstIdMap): DeferredEnvOp[] {
	const bound = FunctionSemantics.call.match.toNames(node.arguments, [config.args.expr, config.args.env]);
	const envir = RArgument.valueOf(bound.get(config.args.env));
	const expr = RArgument.valueOf(bound.get(config.args.expr));
	if(expr === undefined || envir === undefined || !heldByParameter(envir.info.id, graph, idMap)) {
		return [];
	}
	const ops: DeferredEnvOp[] = [];
	for(const id of RNode.collectAllIdsWithStop(expr, RFunctionDefinition.is)) {
		const name = literalName(idMap.get(id));
		/* a super assignment defines outside the evaluation */
		if(name !== undefined && DfgVertex.isVariableDefinition(graph.getVertex(id)) && !Dataflow.targetsOf(graph, id, EdgeType.DefinedBy).some(t => DfgVertex.hasOrigin(graph.getVertex(t), BuiltInProcName.SuperAssignment))) {
			ops.push({ id: node.info.id, kind: EnvOpKind.Define, names: [], literals: [name], envir: envir.info.id, value: id, returns: true });
		}
	}
	return ops;
}

/** Whether `id` reads a parameter, which holds what the call hands over (the body cannot know the environment it may hold). */
function heldByParameter(id: NodeId, graph: DataflowGraph, idMap: AstIdMap): boolean {
	const closure = frameOf(idMap.get(id));
	const held = Dataflow.targetsOf(graph, closure?.info.id ?? id, EdgeType.Reads);
	return held.length === 1 && idMap.get(held[0])?.info.role === RoleInParent.ParameterName;
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
	readonly fn:     DataflowGraphVertexFunctionDefinition
	readonly via:    NodeId
	readonly direct: boolean
	readonly graph:  DataflowGraph
	readonly idMap:  AstIdMap
}

/** The parameter of the function run that `id` reads, if it reads just that. */
function parameterReadBy(id: NodeId, { fn, graph }: Run): NodeId | undefined {
	const bindings = DfgVertex.isUse(graph.getVertex(id)) ? Dataflow.targetsOf(graph, id, EdgeType.Reads) : [];
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
	if(stack === StackEnvKind.Global || (stack === StackEnvKind.CallerFrame && run.direct)) {
		return stack;
	}
	const closure = frameOf(node);
	const symbol = closure ?? node;
	if(!RSymbol.is(symbol) || !run.direct) {
		return undefined;
	}
	/* a parameter holds what the call hands over, any other binding of the body is its own */
	const bound = Dataflow.targetsOf(run.graph, symbol.info.id, EdgeType.Reads).some(b => run.fn.subflow.graph.has(b));
	const held = bound ? run.idMap.get(valueAt(symbol.info.id, run)) : symbol;
	if(!RSymbol.is(held) || (held === symbol && bound)) {
		return undefined;
	} else if(closure !== undefined) {
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
		const names = handed.map(a => NodeValue.stringsOf(a, info));
		return handed.length === 0 || names.includes(undefined) ? undefined : names.flat() as string[];
	}
	return run.direct ? NodeValue.stringsOf(name, { ...info, callContext: new Map([[run.fn.id, run.via]]) }) : undefined;
}

/**
 * Runs the {@link deferredEnvOps} of the function `fn` for the call `call`, which runs `fn` itself or through the
 * `chain` of calls in the functions it runs, the last one calling `fn`: the names they compute from parameters
 * resolve with the values the call of `fn` hands over, and an environment a free variable or a parameter names is
 * the one it holds at `call`, if `call` runs `fn` itself, else only the global environment is known to be the same.
 * An operation that does not resolve keeps what its body states (an unknown side effect).
 */
export function instantiateEnvOps(call: NodeId, fn: DataflowGraphVertexFunctionDefinition, chain: readonly NodeId[], environment: REnvironmentInformation, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext): REnvironmentInformation {
	const idMap = graph.idMap;
	if(fn.envOps === undefined || idMap === undefined) {
		return environment;
	}
	const run: Run = { fn, via: chain.at(-1) ?? call, direct: chain.length === 0, graph, idMap };
	const calls = [call, ...chain];
	const callCds = graph.getVertex(call)?.cds;
	for(const op of fn.envOps) {
		const names = op.names.map(n => namesAt(n, run, ctx));
		const at = envAtCall(op.envir, environment, run);
		if(at === undefined || names.some(n => n === undefined || n.length === 0)) {
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

function applyOp(op: DeferredEnvOp, value: NodeId | undefined, names: readonly string[], at: EnvAtCall, environment: REnvironmentInformation, cds: IdentifierDefinition['cds'], call: NodeId, graph: DataflowGraph): REnvironmentInformation {
	const update = (state: REnvironmentInformation, global: boolean): REnvironmentInformation => {
		switch(op.kind) {
			case EnvOpKind.Define: {
				let next = state;
				const type = referenceTypeOf(value === undefined ? undefined : graph.getVertex(value), graph);
				for(const name of names) {
					next = REnvironment.define({ name, nodeId: value ?? op.id, definedAt: op.id, type, cds }, global && next.level > 0, next);
				}
				return next;
			}
			case EnvOpKind.Remove: {
				const kills: KillReference[] = names.map(name => ({ kind: 'named', reference: { nodeId: op.id, name, cds, type: ReferenceType.Variable }, killedBy: op.id }));
				return global ? applyGlobalKills(state, kills) : applyKills(state, kills);
			}
			case EnvOpKind.Read:
				for(const def of names.flatMap(name => Resolve.byName(name, state) ?? [])) {
					if(!NodeId.isBuiltIn(def.nodeId)) {
						graph.addEdge(op.id, def.nodeId, op.returns ? EdgeType.Reads | EdgeType.Returns : EdgeType.Reads);
					}
				}
				return state;
		}
	};
	if(at === StackEnvKind.Global || at === StackEnvKind.CallerFrame) {
		return update(environment, at === StackEnvKind.Global);
	}
	for(const holder of at.holders) {
		environment = rebindHolders(environment, holder, update(holder.envState, false), call);
	}
	return environment;
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
