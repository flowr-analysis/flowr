import type { Writable } from 'ts-essentials';
import { namesAnErrorHandler, SessionConditionClasses } from '../../../../../fn/condition-handlers';
import { FunctionSemantics } from '../../../../../fn/function-semantics';
import type { DataflowProcessorInformation } from '../../../../../processor';
import type { ControlDependency, DataflowInformation, ExitPoint, KillReference } from '../../../../../info';
import { ExitPointType, happensInEveryBranch, leaveThrough, withCds } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import { ControlFlow } from '../../../../control-flow';
import type { AstIdMap, ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { EmptyArgument, RFunctionCall, type PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { ClosureRefs } from '../../../../linker';
import { VertexType, DfgVertex, type DataflowGraphVertexFunctionCall } from '../../../../../graph/vertex';
import { type DataflowGraph, FunctionArgument, type NamedFunctionArgument } from '../../../../../graph/graph';
import { isNotUndefined, isUndefined } from '../../../../../../util/assert';
import { EdgeType } from '../../../../../graph/edge';
import { UnnamedFunctionCallPrefix } from '../unnamed-call-handling';
import { type BrandedIdentifier, Identifier, type IdentifierDefinition, type IdentifierReference, type InGraphIdentifierDefinition, ReferenceType } from '../../../../../environments/identifier';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { applyKills } from '../../../../../environments/apply-kill';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RFunctionDefinition } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { errorsOfWarnings, mayLock, maySignal, signalSites, testsValue } from './built-in-ambient-state';
import { builtInLookup } from '../../../../../environments/query-fn-props';
import { ArgProp, CallProp, CallProps, type FnSig } from '../../../../../environments/built-in-props';
import { RLoopConstructs, RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { RExpressionList } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RAccess } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { Resolve } from '../../../../../environments/resolve-helper';
import { makeAllMaybe } from '../../../../../environments/reference-to-maybe';
import type { BuiltInLookup } from '../../../../../fn/frame-reflection';
import type { FlowrAnalyzerContext } from '../../../../../../project/context/flowr-analyzer-context';
import { Dataflow } from '../../../../../graph/df-helper';
import { REnvironment, type REnvironmentInformation } from '../../../../../environments/environment';
import { AmbientStateName } from '../../../../../environments/ambient-state-name';
import { SourceRange } from '../../../../../../util/range';
import { RBinaryOp } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { OperatorUsedAs } from '../../../../../environments/default-builtin-config/base-operators';

/** the calls that only jump, group, or bind, which signal nothing of their own (what they evaluate is a site of its own) */
const Silent: readonly BuiltInProcName[] = [BuiltInProcName.Return, BuiltInProcName.Break, BuiltInProcName.ExpressionList, BuiltInProcName.Assignment];

/** Whether the block may signal anything at all: it calls something that is not just a jump, or reads a name nothing binds. */
function hasSignalSite(block: RNode<ParentInformation>, graph: DataflowGraph): boolean {
	for(const id of RNode.collectAllIds(block)) {
		const vertex = graph.getVertex(id);
		if(DfgVertex.isFunctionCall(vertex) ? !Silent.some(s => DfgVertex.hasOrigin(vertex, s)) && Identifier.getName(vertex.name) !== 'next'
			: DfgVertex.isUse(vertex) && Dataflow.targetsOf(graph, id, EdgeType.Reads).length === 0) {
			return true;
		}
	}
	return false;
}

/** Process a built-in try-catch or similar handler. */
export function processTryCatch<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: TryConfig
): DataflowInformation {
	const res = processKnownFunctionCall({ name, args: args.map(RArgument.unnamedValueOrArg), rootId, data, origin: BuiltInProcName.Try, sig: FunctionSemantics.call.signature.every });
	if(config.block !== undefined && (args.length < 1 || RArgument.isEmpty(args[0]))) {
		dataflowLogger.warn(`TryCatch Handler ${Identifier.toString(name.content)} does not have 1 argument, skipping`);
		return res.information;
	}

	const { error } = config.handlers;
	const { blockArg, errorArg, finallyArg, otherHandlers } = matchHandlers(res.callArgs, config, res.information.graph);
	const info = res.information;

	/* handlers are matched by the class of the condition, so a call naming none for an error lets it out: `tryCatch(stop("x"), warning = ...)` throws, and so does one with nothing but a `finally`. */
	const aborts = config.aborts ?? true;
	const blockInfo = res.processedArguments.find(a => a !== undefined && blockArg.has(a.entryPoint));
	const blockAst = blockInfo && data.completeAst.idMap.get(blockInfo.entryPoint);
	/* a handler runs only if something the block runs may signal what it handles, one for the session may run anywhere after */
	const runs = (condition: BrandedIdentifier) => blockAst === undefined || maySignal(blockAst, condition, info.graph, data, info.environment);
	/* an error may carry any class (`errorCondition(class = "my")`), so a handler of a class the block may signal catches it */
	const catchesError = aborts && (error === undefined || namesAnErrorHandler(args) || otherHandlers.some(h => !SessionConditionClasses.has(Identifier.getName(h.name)) && runs(Identifier.getName(h.name))));
	/* a handler of another class runs once something in the block signals such a condition, an exiting one leaves the block there */
	const sitesOf = (condition: Identifier, link: boolean) => blockAst === undefined ? [] : signalSites(blockAst, Identifier.getName(condition), info.graph, data, link);
	const signaled = new Set(aborts ? otherHandlers.flatMap(({ name: condition }) => sitesOf(condition, true)) : []);
	/* a calling handler decides what a signal does as well (`invokeRestart("muffleWarning")`), so what signals stays with the construct */
	for(const site of aborts ? [] : otherHandlers.flatMap(({ name: condition }) => sitesOf(condition, false))) {
		info.graph.addEdge(site, rootId, EdgeType.Reads);
	}
	const raising: NodeId[] = [];
	if(blockInfo !== undefined && blockAst !== undefined && (catchesError || signaled.size > 0)) {
		const targetsOf = (n: Identifier) => [data.environment, info.environment]
			.flatMap(env => Resolve.byNameAndType(n, env, ReferenceType.Function) ?? []);
		const order = raisingOrder(info.graph, builtInLookup(data.ctx), { rootId, targetsOf, locked: mayLock(data.environment) });
		const raised = catchesError ? errorsOfWarnings(blockAst, info.environment, info.graph, data) : [];
		for(const site of [...raised.map(r => r.nodeId), ...signaled]) {
			info.graph.addEdge(site, rootId, EdgeType.Reads);
			info.graph.addEdge(rootId, site, EdgeType.Reads);
		}
		(blockInfo.exitPoints as ExitPoint[]) = blockInfo.exitPoints.concat(raised);
		raising.push(...order(blockAst, []));
	}
	const errorRuns = error !== undefined && errorArg.size > 0 && runs(error);
	/*
	 * an exiting handler that may run leaves the block where the block signals, so a `return` (or `break`, or a raise the
	 * construct lets out) later in the block only happens if nothing was signaled before: `tryCatch({ log(-1); return(1) }, warning = ...)`
	 */
	const preempted = aborts && (errorRuns || otherHandlers.some(h => runs(Identifier.getName(h.name)))) && blockAst !== undefined && hasSignalSite(blockAst, info.graph);
	const unlessSignaled = (exits: readonly ExitPoint[]): readonly ExitPoint[] => preempted
		? exits.map(e => e.type === ExitPointType.Default ? e : { ...e, cds: withCds(e.cds ?? data.cds, [{ id: rootId, when: false }]) })
		: exits;
	/* if the block raises an error in every case, the error handler is not constrained by it */
	const blockErrorExitPoints: (ControlDependency | undefined)[] = [];
	const errorExitPoints: ExitPoint[] = [];
	(info.exitPoints as ExitPoint[]) = res.processedArguments.flatMap(arg => {
		if(!arg) {
			return [];
		} else if(finallyArg.has(arg.entryPoint)) {
			return exitPointsOfHandler(arg.entryPoint, info.graph) ?? arg.exitPoints;
		} else if(errorArg.has(arg.entryPoint) && errorRuns) {
			/* a `return` within the handler only leaves the handler, its value is the one of the construct */
			const handlerExits = exitPointsOfHandler(arg.entryPoint, info.graph) ?? [];
			errorExitPoints.push(...handlerExits.map(e => e.type === ExitPointType.Return ? { ...e, type: ExitPointType.Default } : e));
		}
		if(!blockArg.has(arg.entryPoint)) {
			return arg.exitPoints;
		} else if(!catchesError) {
			return unlessSignaled(arg.exitPoints);
		}
		blockErrorExitPoints.push(...arg.exitPoints.filter(ep => ep.type === ExitPointType.Error).flatMap(a => a.cds));
		return unlessSignaled(arg.exitPoints.filter(ep => ep.type !== ExitPointType.Error));
	});
	if(errorExitPoints.length > 0) {
		if(happensInEveryBranch(blockErrorExitPoints.some(isUndefined) ? undefined : blockErrorExitPoints as ControlDependency[])) {
			(info.exitPoints as ExitPoint[]).push(...errorExitPoints);
		} else {
			(info.exitPoints as ExitPoint[]).push(...constrainExitPoints(errorExitPoints, blockArg));
		}
	}
	/* a handler runs only once a condition is signaled, an error handler surely if the block raises in every case */
	const whenSignaled: ControlDependency[] = [...data.cds ?? [], { id: rootId, when: true }];
	const blockSurelyRaises = blockErrorExitPoints.length > 0 && happensInEveryBranch(blockErrorExitPoints.some(isUndefined) ? undefined : blockErrorExitPoints as ControlDependency[]);
	/* the construct evaluates every handler it is handed, but calls only those that may run */
	for(const e of errorArg) {
		info.graph.addEdge(rootId, e, errorRuns ? EdgeType.Reads | EdgeType.Calls : EdgeType.Reads);
		if(errorRuns) {
			promoteCallToFunction(rootId, e, info, data, blockSurelyRaises ? data.cds : whenSignaled);
		}
	}
	/* what such a handler changes outside its frame is linked to the sites signaling it once linking knows what it calls, see linkHandlersToSignalSites */
	for(const { nodeId: arg, name: condition } of otherHandlers) {
		const called = runs(Identifier.getName(condition));
		info.graph.addEdge(rootId, arg, called ? EdgeType.Reads | EdgeType.Calls : EdgeType.Reads);
		if(called) {
			promoteCallToFunction(rootId, arg, info, data, whenSignaled);
		}
	}
	for(const f of finallyArg) {
		info.graph.addEdge(rootId, f, EdgeType.Calls);
	}
	for(const e of info.exitPoints) {
		if(e.type !== ExitPointType.Error) {
			info.graph.addEdge(rootId, e.nodeId, EdgeType.Returns);
		}
	}
	/* block and finally are evaluated in the enclosing environment, so their definitions and removals have to bubble up */
	const escaping: IdentifierReference[] = [];
	let escapingKills: KillReference[] | undefined;
	for(const arg of res.processedArguments) {
		if(arg && (blockArg.has(arg.entryPoint) || finallyArg.has(arg.entryPoint))) {
			escaping.push(...arg.out);
			if(arg.kill?.length) {
				(escapingKills ??= []).push(...arg.kill);
			}
		}
	}
	/* The rewritten exit points describe what the call passes on to its own callers; control flow still leaves the construct on the call itself, whether the block completed or a handler took over. */
	(info as Writable<typeof info>).cfgExit = rootId;
	const entryOfArg = (of: ReadonlySet<NodeId>) => {
		const arg = res.processedArguments.find(a => a !== undefined && of.has(a.entryPoint));
		return arg && ControlFlow.entryOf(arg);
	};
	/* An error the block raises lands on the handler when there is one, and the `finally` follows it, which the arguments being in sequence already says. */
	const cleanupEntry = entryOfArg(finallyArg);
	const caughtAt = entryOfArg(errorArg) ?? cleanupEntry ?? rootId;
	if(cleanupEntry !== undefined) {
		/* and it leaves through the call, so whatever claims the jump links to where the cleanup ends, not to the jump itself, which would let control out without running it */
		(info.exitPoints as ExitPoint[]) = info.exitPoints.map(e => JumpExitPoints.includes(e.type) ? leaveThrough(e, rootId) : e);
	}
	for(const arg of res.processedArguments) {
		if(arg === undefined || errorArg.has(arg.entryPoint) || finallyArg.has(arg.entryPoint)) {
			continue;
		}
		for(const exit of arg.exitPoints) {
			if(exit.type === ExitPointType.Error) {
				info.graph.addEdge(exit.nodeId, caughtAt, EdgeType.FlowEdge);
			} else if(cleanupEntry !== undefined && JumpExitPoints.includes(exit.type)) {
				info.graph.addEdge(exit.nodeId, cleanupEntry, EdgeType.FlowEdge);
			}
		}
	}
	const mayAbort = raising.length > 0;
	if(!mayAbort && escaping.length === 0 && escapingKills === undefined) {
		return info;
	}
	for(const id of raising) {
		const call = info.graph.getVertex(id);
		if(call !== undefined) {
			call.cds = [...call.cds ?? [], { id: rootId, when: true }];
		}
		/* whether the block raises decides what the construct yields, its value or that of a handler */
		info.graph.addEdge(rootId, id, EdgeType.Reads);
	}
	let environment = mayAbort ? REnvironment.append(data.environment, info.environment) : info.environment;
	if(mayAbort) {
		environment = keepOverwrittenBeforeRaise(escaping, raising, environment, data.completeAst.idMap, rootId);
	}
	return {
		...info,
		out:         info.out.concat(mayAbort ? makeAllMaybe(escaping, info.graph, environment, true) : escaping),
		environment: applyKills(environment, escapingKills),
		kill:        escapingKills
	};
}

/** A write of the block that a later one of it overwrites survives if a raising site in between leaves the block: `{ x <- 1; warning("m"); x <- 2 }`. */
function keepOverwrittenBeforeRaise(writes: readonly IdentifierReference[], raising: readonly NodeId[], environment: REnvironmentInformation, idMap: AstIdMap, rootId: NodeId): REnvironmentInformation {
	const lastRaise = raising.map(id => idMap.get(id)?.location).filter(isNotUndefined).sort(SourceRange.compare).at(-1);
	if(lastRaise === undefined) {
		return environment;
	}
	for(const write of writes) {
		const at = idMap.get(write.nodeId)?.location;
		const { name } = write;
		if(name === undefined || !('definedAt' in write) || at === undefined || SourceRange.compare(at, lastRaise) >= 0
			|| Resolve.byName(name, environment)?.some(d => d.nodeId === write.nodeId)) {
			continue;
		}
		environment = REnvironment.define({ ...write as InGraphIdentifierDefinition, name, cds: [...write.cds ?? [], { id: rootId, when: true }] }, false, environment);
	}
	return environment;
}

/** Links what a block catching errors may raise because a warning turns into one, where the `warn` option that does so is only known after linking: `g(options, warn = 2)` sets it through the function `g` is handed. */
export function linkLateWarningsAsErrors(graph: DataflowGraph, environment: REnvironmentInformation, idMap: AstIdMap): void {
	const writes = (Resolve.byName(AmbientStateName.warnsAsErrors, environment) ?? []).filter(d => DfgVertex.isFunctionCall(graph.getVertex(d.nodeId)));
	if(writes.length === 0) {
		return;
	}
	const startOf = (id: NodeId) => idMap.get(id)?.location;
	for(const [id, vertex] of graph.verticesOfType(VertexType.FunctionCall)) {
		const call = DfgVertex.hasOrigin(vertex, BuiltInProcName.Try) ? idMap.get(id) : undefined;
		const [block] = RFunctionCall.is(call) ? call.arguments : [];
		const at = startOf(id);
		const before = at === undefined ? [] : writes.filter(w => {
			const written = startOf(w.nodeId);
			return written !== undefined && SourceRange.compare(written, at) < 0 && !Dataflow.hasEdge(graph, id, w.nodeId, EdgeType.Reads);
		});
		if(block === undefined || block === EmptyArgument || before.length === 0) {
			continue;
		}
		RNode.visitAst(block, n => {
			if(RFunctionDefinition.is(n)) {
				return true;
			} else if(DfgVertex.isFunctionCall(graph.getVertex(n.info.id))) {
				graph.addEdge(id, n.info.id, EdgeType.Reads);
				for(const write of before) {
					graph.addEdge(n.info.id, write.nodeId, EdgeType.Reads);
				}
			}
			return false;
		});
	}
}

/** Links what a handler of a condition class other than an error changes outside its frame, which is a side effect on the call running it, to every site of the block that may signal that class, as the handler runs only then. */
export function linkHandlersToSignalSites<OtherInfo>(graph: DataflowGraph, environment: REnvironmentInformation, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): void {
	const idMap = data.completeAst.idMap;
	for(const [, vertex] of graph.verticesOfType(VertexType.FunctionCall)) {
		const config = DfgVertex.hasOrigin(vertex, BuiltInProcName.Try) ? tryConfigOf(vertex, environment) : undefined;
		if(config === undefined) {
			continue;
		}
		const { blockArg, otherHandlers } = matchHandlers(vertex.args, config, graph);
		const block = blockArg.values().next().value;
		/* a handler registered for the session sees what the program runs after it registered */
		const blocks = config.block === undefined ? statementsAfter(vertex.id, idMap) : block === undefined ? [] : [idMap.get(block)].filter(isNotUndefined);
		for(const { nodeId: arg, name: condition } of blocks.length === 0 ? [] : otherHandlers) {
			for(const handler of Dataflow.targetsOf(graph, arg, EdgeType.Calls)) {
				const writes = Dataflow.sourcesOf(graph, handler, EdgeType.SideEffectOnCall);
				/* no construct encloses what signals to a handler of the session, so each site that may runs it */
				const runs = config.block === undefined ? Dataflow.callTargetsOf(handler, graph).filter(t => DfgVertex.isFunctionDefinition(graph.getVertex(t))) : [];
				const at = graph.getVertex(handler)?.environment;
				const sites = (writes.length === 0 && runs.length === 0) || at === undefined ? [] : blocks.flatMap(b => signalSites(b as RNode<OtherInfo & ParentInformation>, Identifier.getName(condition), graph, { ...data, environment: at }, false));
				for(const site of sites) {
					for(const write of writes) {
						graph.addEdge(write, site, EdgeType.Reads);
					}
					for(const definition of runs) {
						graph.addEdge(site, definition, EdgeType.Calls);
					}
				}
			}
		}
	}
}

/** The top-level statements after the one holding `id`, which a call within a function body may run in any of once the function is defined. */
function statementsAfter(id: NodeId, idMap: AstIdMap): RNode<ParentInformation>[] {
	let node = idMap.get(id);
	for(let parent = node && RNode.directParent(node, idMap); parent !== undefined && node !== undefined; parent = RNode.directParent(parent, idMap)) {
		if(RExpressionList.is(parent) && RNode.directParent(parent, idMap) === undefined) {
			return parent.children.slice(parent.children.indexOf(node) + 1);
		}
		node = parent;
	}
	return [];
}

/** What a construct of {@link processTryCatch} is configured with. */
interface TryConfig {
	/** the argument the handlers are established for, none if they stay for the rest of the session (`globalCallingHandlers`) */
	readonly block?:   string
	readonly handlers: {
		readonly error?:   string
		readonly finally?: string
	}
	readonly aborts?: boolean
	readonly sig?:    FnSig
}

/** The configuration of the built-in construct `call` runs, if it resolves to one of {@link processTryCatch}. */
function tryConfigOf(call: DataflowGraphVertexFunctionCall, environment: REnvironmentInformation): TryConfig | undefined {
	const target = (Resolve.byNameAndType(call.name, call.environment ?? environment, ReferenceType.Function) ?? [])
		.find(d => d.type === ReferenceType.BuiltInFunction && d.processorName === BuiltInProcName.Try);
	return target?.type === ReferenceType.BuiltInFunction && target.processorName === BuiltInProcName.Try ? target.config : undefined;
}

/** Which of the arguments `args` of a construct configured by `config` are its block and its handlers. */
function matchHandlers(given: readonly FunctionArgument[], config: TryConfig, graph: DataflowGraph) {
	/* handlers for the session may come as one list of them */
	const only = config.block === undefined && given.length === 1 && given[0] !== EmptyArgument && !FunctionArgument.isNamed(given[0]) ? graph.getVertex(given[0].nodeId) : undefined;
	const args = DfgVertex.isFunctionCall(only) && DfgVertex.hasOrigin(only, BuiltInProcName.List) ? only.args : given;
	const { error, finally: cleanupName } = config.handlers;
	const argMaps = FunctionSemantics.call.match.toSpec<'block' | '...' | 'error' | 'finally'>(args, {
		...config.block === undefined ? {} : { [config.block]: 'block' },
		'...': '...',
		...error ? { [error]: 'error' } : {},
		...cleanupName ? { [cleanupName]: 'finally' } : {}
	});
	const dots = new Set(argMaps.get('...'));
	/* the arguments a `...` of callees takes are the handlers of the other condition classes */
	const handlesByDots = config.sig?.some(([formal, props]) => formal === '...' && (props & ArgProp.Callee) !== 0) ?? false;
	return {
		blockArg:      new Set(argMaps.get('block')),
		errorArg:      new Set(argMaps.get('error')),
		finallyArg:    new Set(argMaps.get('finally')),
		otherHandlers: handlesByDots ? args.filter((a): a is NamedFunctionArgument => FunctionArgument.isNamed(a) && dots.has(a.nodeId)) : []
	};
}

/** Orders the raising calls in every body a block catching errors may run, once per definition and after linking bound all calls. */
export function orderRaisingBodies(graph: DataflowGraph, idMap: AstIdMap, ctx: FlowrAnalyzerContext, environment: REnvironmentInformation): void {
	const ordered = new Map<NodeId, readonly NodeId[]>();
	/* a warning raises where `warn` may be 2, which a body may set itself: `f <- function() { options(warn = 2); as.integer("a") }` */
	const warn = AmbientStateName.option('warn');
	/* through the earlier settings a later one of `warn` (an `on.exit` restoring it) still reads */
	const warnsAsErrors = (site: NodeId) => {
		const seen = new Set<NodeId>();
		const todo = [site];
		for(let current = todo.pop(); current !== undefined; current = todo.pop()) {
			for(const t of Dataflow.targetsOf(graph, current, EdgeType.Reads)) {
				const writes = graph.ambientAccessOf(t)?.writes;
				if(writes?.has(AmbientStateName.warnsAsErrors)) {
					return true;
				} else if(writes?.has(warn) && !seen.has(t)) {
					seen.add(t);
					todo.push(t);
				}
			}
		}
		return false;
	};
	const reach = (node: RNode<ParentInformation>) => {
		const isDefinition = RFunctionDefinition.is(node);
		for(const id of isDefinition ? [node.info.id] : Dataflow.calleeIdsOf(graph, node.info.id)) {
			const definition = idMap.get(id);
			if(!ordered.has(id) && RFunctionDefinition.is(definition)) {
				ordered.set(id, []);
				const raising = order(definition.body, []);
				ordered.set(id, raising.filter(warnsAsErrors));
				keepEscapingWritesBeforeRaise(id, raising, graph, idMap);
			}
			/* whether such a warning raises decides what the call yields, its value or that of a handler */
			for(const site of isDefinition ? [] : ordered.get(id) ?? []) {
				graph.addEdge(node.info.id, site, EdgeType.Reads);
			}
		}
	};
	const order = raisingOrder(graph, builtInLookup(ctx), { reach, locked: mayLock(environment) });
	for(const [id, vertex] of graph.verticesOfType(VertexType.FunctionCall)) {
		const call = DfgVertex.hasOrigin(vertex, BuiltInProcName.Try) ? idMap.get(id) : undefined;
		for(const arg of RFunctionCall.is(call) ? call.arguments : []) {
			if(arg !== EmptyArgument && !Dataflow.hasEdge(graph, id, arg.info.id, EdgeType.Calls)) {
				RNode.visitAst(arg, n => {
					reach(n);
					return RFunctionDefinition.is(n);
				});
			}
		}
	}
}

/** What the body of `fn` writes outside its frame stays visible past a later write of the same name if a raising site in between may leave the body: `x <<- 1; log(-1); x <<- 2`. */
function keepEscapingWritesBeforeRaise(fn: NodeId, raising: readonly NodeId[], graph: DataflowGraph, idMap: AstIdMap): void {
	const at = (id: NodeId) => idMap.get(id)?.location;
	const raises = raising.map(at).filter(isNotUndefined);
	const subflow = raising.length === 0 ? undefined : graph.getVertex(fn);
	if(!DfgVertex.isFunctionDefinition(subflow)) {
		return;
	}
	const superAssigns = (id: NodeId) => {
		const node = idMap.get(id);
		const parent = node && RNode.directParent(node, idMap);
		return RBinaryOp.is(parent) && (parent.operator === '<<-' || parent.operator === '->>');
	};
	const escaping = [...subflow.subflow.graph].filter(id => DfgVertex.isVariableDefinition(graph.getVertex(id)) && RNode.findEnclosing(id, idMap, RFunctionDefinition.is) === fn
		&& (superAssigns(id) || Dataflow.targetsOf(graph, id, EdgeType.SideEffectOnCall).length > 0));
	for(const later of escaping) {
		const end = at(later);
		if(end === undefined) {
			continue;
		}
		const name = NodeId.recoverBareName(later, idMap);
		for(const earlier of escaping) {
			const start = at(earlier);
			if(start !== undefined && NodeId.recoverBareName(earlier, idMap) === name && SourceRange.compare(start, end) < 0
				&& raises.some(r => SourceRange.compare(start, r) < 0 && SourceRange.compare(r, end) < 0)) {
				graph.addEdge(later, earlier, EdgeType.Reads);
			}
		}
	}
}

/** Makes every later call read the earlier ones that may raise, and those read the construct `rootId`; returns the raising ones. */
function raisingOrder(graph: DataflowGraph, lookup: BuiltInLookup, { rootId, targetsOf, reach, locked }: { rootId?: NodeId, targetsOf?: (name: Identifier) => readonly IdentifierDefinition[], reach?: (node: RNode<ParentInformation>) => void, locked: boolean }) {
	type Node = RNode<ParentInformation>;
	const raises = (node: Node): boolean => {
		const vertex = graph.getVertex(node.info.id);
		const name = DfgVertex.isFunctionCall(vertex) ? vertex.name : RFunctionCall.is(node) ? RFunctionCall.calledName(node) : RAccess.is(node) ? node.operator : node.lexeme;
		if(name === undefined || CallProps.hasAny(lookup(name), CallProp.Throws) || testsValue(node) || (rootId !== undefined && Dataflow.hasEdge(graph, node.info.id, rootId, EdgeType.Reads))) {
			return true;
		} else if(DfgVertex.isFunctionCall(vertex)) {
			/* a built-in may raise on its own for what it is handed (`log("a")`, a locked binding), binding a name raises only for what its value does, unless it may be locked */
			return !vertex.onlyBuiltin || vertex.origin === 'unnamed' || !(vertex.origin.every(o => NeverRaises.has(o)) || (!locked && bindsName(node)));
		}
		const targets = targetsOf?.(name) ?? [];
		return targets.length === 0 || targets.some(t => !NodeId.isBuiltIn(t.nodeId));
	};
	const order = (node: Node, before: readonly NodeId[]): NodeId[] => {
		reach?.(node);
		if(RFunctionDefinition.is(node)) {
			return [];
		} else if(RExpressionList.is(node)) {
			const sites: NodeId[] = [];
			let current = before;
			for(const child of node.children) {
				const raised = order(child, current);
				current = raised.length > 0 ? raised : current;
				sites.push(...raised);
			}
			return sites;
		}
		/* what a later iteration runs follows what an earlier one may raise, which the loop carries */
		const loop = RLoopConstructs.is(node);
		const sites = RNode.directChildren(node).flatMap(child => child === EmptyArgument ? [] : order(child, loop ? [...before, node.info.id] : before));
		/* code after an unconditional exit is never analyzed, so it has no vertex and neither runs nor raises */
		if(!CallTypes.has(node.type) || !graph.hasVertex(node.info.id)) {
			return sites;
		}
		const raising = raises(node);
		for(const site of [...before, ...rootId !== undefined && raising ? [rootId] : [], ...loop ? sites : []]) {
			graph.addEdge(node.info.id, site, EdgeType.Reads);
		}
		return raising ? [...sites, node.info.id] : sites;
	};
	return order;
}

/** the built-in constructs that raise nothing beyond what their parts do */
const NeverRaises: ReadonlySet<BuiltInProcName> = new Set([BuiltInProcName.ExpressionList, BuiltInProcName.IfThenElse, BuiltInProcName.ForLoop, BuiltInProcName.WhileLoop, BuiltInProcName.RepeatLoop,
	BuiltInProcName.Break, BuiltInProcName.Return, BuiltInProcName.Function, BuiltInProcName.FunctionDefinition, BuiltInProcName.Quote]);

function bindsName(node: RNode<ParentInformation>): boolean {
	if(!RBinaryOp.is(node) || RBinaryOp.getOperatorInfo(node)?.usedAs !== OperatorUsedAs.Assignment) {
		return false;
	}
	const target = node.operator.startsWith('->') ? node.rhs : node.lhs;
	return RSymbol.is(target) || RString.is(target);
}

const CallTypes: ReadonlySet<RType> = new Set([RType.FunctionCall, RType.BinaryOp, RType.UnaryOp, RType.Access, RType.Pipe, RType.IfThenElse, RType.ForLoop, RType.WhileLoop, RType.RepeatLoop, RType.Break, RType.Next]);

/** the exits that leave the construct for a destination of their own, which `finally` still runs before */
const JumpExitPoints: readonly ExitPointType[] = [ExitPointType.Break, ExitPointType.Next, ExitPointType.Return];

/** Links the handler `arg` of the construct `call` as called: a symbol becomes a call, an anonymous function gets a synthetic one, and any other expression a synthetic call of whatever it evaluates to (`hs$w`, `mk()`), which the linker resolves. */
function promoteCallToFunction<OtherInfo>(call: NodeId, arg: NodeId, info: DataflowInformation, data: DataflowProcessorInformation<ParentInformation & OtherInfo>, cds: readonly ControlDependency[] | undefined): void {
	const val = RArgument.valueOf(data.completeAst.idMap.get(arg));
	if(val === undefined) {
		return;
	} else if(RSymbol.is(val)) {
		info.graph.updateToFunctionCall({
			tag:         VertexType.FunctionCall,
			id:          val.info.id,
			name:        val.content,
			args:        [],
			environment: data.environment,
			onlyBuiltin: false,
			cds:         cds?.slice(),
			origin:      [BuiltInProcName.Function]
		});
		info.graph.addEdge(arg, val.info.id, EdgeType.Calls);
		return;
	}
	const functionId = val.info.id;
	const anonymous = RFunctionDefinition.is(val);
	const syntheticCall = NodeId.anonymousCall(functionId);
	info.graph.addVertex({
		tag:         VertexType.FunctionCall,
		id:          syntheticCall,
		environment: data.environment,
		name:        `${UnnamedFunctionCallPrefix}${functionId}`,
		onlyBuiltin: false,
		cds:         cds?.slice(),
		args:        [],
		origin:      [anonymous ? BuiltInProcName.Function : BuiltInProcName.Unnamed]
	}, data.ctx.env.cleanEnv);
	info.graph.addEdge(arg, syntheticCall, EdgeType.Calls);
	if(!anonymous) {
		info.graph.addEdge(syntheticCall, functionId, EdgeType.Reads);
		return;
	}
	info.graph.addEdge(arg, functionId, EdgeType.Calls | EdgeType.Reads);
	info.graph.addEdge(syntheticCall, functionId, EdgeType.Calls | EdgeType.Reads);
	info.graph.addEdge(call, functionId, EdgeType.Calls | EdgeType.Reads);
	const handler = info.graph.getVertex(functionId);
	if(DfgVertex.isFunctionDefinition(handler)) {
		ClosureRefs.resolveOpenIngoing(info.graph, syntheticCall, handler, data.environment);
	}
}

function exitPointsOfHandler(id: NodeId, graph: DataflowGraph): readonly ExitPoint[] | undefined {
	const vertex = graph.getVertex(id);
	if(DfgVertex.isFunctionDefinition(vertex)) {
		return vertex.exitPoints;
	}
	// we assumed named argument
	const node = vertex === undefined ? undefined : graph.idMap?.get(id);
	const definition = RArgument.is(node) && RFunctionDefinition.is(node.value) ? graph.getVertex(node.value.info.id) : undefined;
	return DfgVertex.isFunctionDefinition(definition) ? definition.exitPoints : undefined;
}

/** Constrains the given exit points to happen only when every node in `constrain` is reached (`when: true`). */
function constrainExitPoints(exitPoints: readonly ExitPoint[], constrain: ReadonlySet<NodeId>): readonly ExitPoint[] {
	if(constrain.size === 0) {
		return exitPoints;
	}
	const cds = Array.from(constrain, id => ({ id, when: true }));
	return exitPoints.map(e => ({ ...e, cds: e.cds ? [...e.cds, ...cds] : cds }));
}