import { namesAnErrorHandler } from '../../../../../fn/condition-handlers';
import { FunctionSemantics } from '../../../../../fn/function-semantics';
import type { DataflowProcessorInformation } from '../../../../../processor';
import type { ControlDependency, DataflowInformation, ExitPoint, KillReference } from '../../../../../info';
import { ExitPointType, happensInEveryBranch, leaveThrough } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import { ControlFlow } from '../../../../control-flow';
import type { AstIdMap, ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { EmptyArgument, RFunctionCall, type PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { ClosureRefs } from '../../../../linker';
import { VertexType, DfgVertex } from '../../../../../graph/vertex';
import { tryUnpackNoNameArg } from '../argument/unpack-argument';
import { type DataflowGraph, FunctionArgument, type NamedFunctionArgument } from '../../../../../graph/graph';
import { isUndefined } from '../../../../../../util/assert';
import { EdgeType } from '../../../../../graph/edge';
import { UnnamedFunctionCallPrefix } from '../unnamed-call-handling';
import { Identifier, type IdentifierDefinition, type IdentifierReference, ReferenceType } from '../../../../../environments/identifier';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { applyKills } from '../../../../../environments/apply-kill';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RFunctionDefinition } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { errorsOfWarnings } from './built-in-ambient-state';
import { builtInLookup } from '../../../../../environments/query-fn-props';
import { CallProp, CallProps } from '../../../../../environments/built-in-props';
import { RLoopConstructs, RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { RExpressionList } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RAccess } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { Resolve } from '../../../../../environments/resolve-helper';
import { appendEnvironment } from '../../../../../environments/append';
import { makeAllMaybe } from '../../../../../environments/reference-to-maybe';
import { type BuiltInLookup, calledDefinitions, hasEdgeOfType } from '../../../../../fn/frame-reflection';
import type { FlowrAnalyzerContext } from '../../../../../../project/context/flowr-analyzer-context';

/**
 * Process a built-in try-catch or similar handler.
 */
export function processTryCatch<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: {
		block:    string,
		handlers: {
			error?:   string,
			finally?: string
		},
		aborts?: boolean
	}
): DataflowInformation {
	const res = processKnownFunctionCall({ name, args: args.map(tryUnpackNoNameArg), rootId, data, origin: BuiltInProcName.Try, sig: FunctionSemantics.call.signature.every });
	if(args.length < 1 || RArgument.isEmpty(args[0])) {
		dataflowLogger.warn(`TryCatch Handler ${Identifier.toString(name.content)} does not have 1 argument, skipping`);
		return res.information;
	}

	const { error, finally: cleanupName } = config.handlers;
	const argMaps = FunctionSemantics.call.match.toSpec(res.callArgs, {
		[config.block]: 'block',
		'...':          '...',
		...error ? { [error]: 'error' } : {},
		...cleanupName ? { [cleanupName]: 'finally' } : {}
	});
	const info = res.information;

	const blockArg = new Set(argMaps.get('block'));
	const errorArg = new Set(argMaps.get('error'));
	const finallyArg = new Set(argMaps.get('finally'));
	const dots = new Set(argMaps.get('...'));
	const otherHandlerArg = res.callArgs
		.filter((a): a is NamedFunctionArgument => FunctionArgument.isNamed(a) && dots.has(a.nodeId))
		.map(a => a.nodeId);
	/* handlers are matched by the class of the condition, so a call naming none for an error lets it out:
	   `tryCatch(stop("x"), warning = ...)` throws, and so does one with nothing but a `finally`.
	   A construct declaring no handler parameter at all, as `try` does, catches whatever arrives. */
	const catchesError = (config.aborts ?? true) && (error === undefined || namesAnErrorHandler(args));
	const raising: NodeId[] = [];
	if(catchesError) {
		const targetsOf = (n: Identifier) => [data.environment, info.environment]
			.flatMap(env => Resolve.byNameAndType(n, env, ReferenceType.Function) ?? []);
		const order = raisingOrder(info.graph, builtInLookup(data.ctx), { rootId, targetsOf });
		for(const arg of res.processedArguments) {
			const block = arg && blockArg.has(arg.entryPoint) ? data.completeAst.idMap.get(arg.entryPoint) : undefined;
			if(arg && block) {
				const raised = errorsOfWarnings(block, info.environment, info.graph, data);
				for(const site of raised) {
					info.graph.addEdge(site.nodeId, rootId, EdgeType.Reads);
				}
				(arg.exitPoints as ExitPoint[]) = arg.exitPoints.concat(raised);
				raising.push(...order(block, []));
			}
		}
	}
	/* if the block raises an error in every case, the error handler is not constrained by it */
	const blockErrorExitPoints: (ControlDependency | undefined)[] = [];
	const errorExitPoints: ExitPoint[] = [];
	(info.exitPoints as ExitPoint[]) = res.processedArguments.flatMap(arg => {
		if(!arg) {
			return [];
		} else if(finallyArg.has(arg.entryPoint)) {
			return exitPointsOfHandler(arg.entryPoint, info.graph) ?? arg.exitPoints;
		} else if(errorArg.has(arg.entryPoint)) {
			/* a `return` within the handler only leaves the handler, its value is the one of the construct */
			const handlerExits = exitPointsOfHandler(arg.entryPoint, info.graph) ?? [];
			errorExitPoints.push(...handlerExits.map(e => e.type === ExitPointType.Return ? { ...e, type: ExitPointType.Default } : e));
		}
		if(!blockArg.has(arg.entryPoint) || !catchesError) {
			return arg.exitPoints;
		}
		blockErrorExitPoints.push(...arg.exitPoints.filter(ep => ep.type === ExitPointType.Error).flatMap(a => a.cds));
		return arg.exitPoints.filter(ep => ep.type !== ExitPointType.Error);
	});
	if(errorExitPoints.length > 0) {
		if(happensInEveryBranch(blockErrorExitPoints.some(isUndefined) ? undefined : blockErrorExitPoints as ControlDependency[])) {
			(info.exitPoints as ExitPoint[]).push(...errorExitPoints);
		} else {
			(info.exitPoints as ExitPoint[]).push(...constrainExitPoints(errorExitPoints, blockArg));
		}
	}
	for(const e of [...errorArg, ...otherHandlerArg]) {
		info.graph.addEdge(rootId, e, EdgeType.Reads | EdgeType.Calls);
		promoteCallToFunction(rootId, e, info, data);
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
	/*
	 * The rewritten exit points describe what the call passes on to its own callers; control flow still leaves
	 * the construct on the call itself, whether the block completed or a handler took over. An error the block
	 * raises is caught here as well, so it reaches the call rather than leaving it.
	 */
	(info as { cfgExit?: NodeId }).cfgExit = rootId;
	const entryOfArg = (of: ReadonlySet<NodeId>) => {
		const arg = res.processedArguments.find(a => a !== undefined && of.has(a.entryPoint));
		return arg && ControlFlow.entryOf(arg);
	};
	/*
	 * An error the block raises lands on the handler when there is one, and the `finally` follows it, which the
	 * arguments being in sequence already says. Without either, the error simply arrives at the call.
	 * R runs `finally` whatever leaves the block, so a jump reaches it on its way out just as an error does.
	 */
	const cleanupEntry = entryOfArg(finallyArg);
	const caughtAt = entryOfArg(errorArg) ?? cleanupEntry ?? rootId;
	if(cleanupEntry !== undefined) {
		/* and it leaves through the call, so whatever claims the jump links to where the cleanup ends, not to the
		   jump itself, which would let control out without running it */
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
	}
	const environment = mayAbort ? appendEnvironment(data.environment, info.environment) : info.environment;
	return {
		...info,
		out:         info.out.concat(mayAbort ? makeAllMaybe(escaping, info.graph, environment, true) : escaping),
		environment: applyKills(environment, escapingKills),
		kill:        escapingKills
	};
}

/** Orders the raising calls in every body a block catching errors may run, once per definition and after linking bound all calls. */
export function orderRaisingBodies(graph: DataflowGraph, idMap: AstIdMap, ctx: FlowrAnalyzerContext): void {
	const ordered = new Set<NodeId>();
	const reach = (node: RNode<ParentInformation>) => {
		for(const id of RFunctionDefinition.is(node) ? [node.info.id] : calledDefinitions(graph, node.info.id)) {
			const definition = idMap.get(id);
			if(!ordered.has(id) && RFunctionDefinition.is(definition)) {
				ordered.add(id);
				order(definition.body, []);
			}
		}
	};
	const order = raisingOrder(graph, builtInLookup(ctx), { reach });
	for(const [id, vertex] of graph.verticesOfType(VertexType.FunctionCall)) {
		const call = DfgVertex.hasOrigin(vertex, BuiltInProcName.Try) ? idMap.get(id) : undefined;
		for(const arg of RFunctionCall.is(call) ? call.arguments : []) {
			if(arg !== EmptyArgument && !hasEdgeOfType(graph, id, arg.info.id, EdgeType.Calls)) {
				RNode.visitAst(arg, n => {
					reach(n);
					return RFunctionDefinition.is(n);
				});
			}
		}
	}
}

/** Makes every later call read the earlier ones that may raise, and those read the construct `rootId`; returns the raising ones. */
function raisingOrder(graph: DataflowGraph, lookup: BuiltInLookup, { rootId, targetsOf, reach }: { rootId?: NodeId, targetsOf?: (name: Identifier) => readonly IdentifierDefinition[], reach?: (node: RNode<ParentInformation>) => void }) {
	type Node = RNode<ParentInformation>;
	const raises = (node: Node): boolean => {
		const vertex = graph.getVertex(node.info.id);
		const name = DfgVertex.isFunctionCall(vertex) ? vertex.name : RFunctionCall.is(node) ? RFunctionCall.calledName(node) : RAccess.is(node) ? node.operator : node.lexeme;
		if(name === undefined || CallProps.hasAny(lookup(name), CallProp.Throws) || (rootId !== undefined && hasEdgeOfType(graph, node.info.id, rootId, EdgeType.Reads))) {
			return true;
		} else if(DfgVertex.isFunctionCall(vertex)) {
			return !vertex.onlyBuiltin;
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
		if(!CallTypes.has(node.type)) {
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

const CallTypes: ReadonlySet<RType> = new Set([RType.FunctionCall, RType.BinaryOp, RType.UnaryOp, RType.Access, RType.Pipe, RType.IfThenElse, RType.ForLoop, RType.WhileLoop, RType.RepeatLoop, RType.Break, RType.Next]);

/** the exits that leave the construct for a destination of their own, which `finally` still runs before */
const JumpExitPoints: readonly ExitPointType[] = [ExitPointType.Break, ExitPointType.Next, ExitPointType.Return];

/** Links the handler `arg` of the construct `call` as called: a symbol becomes a call, an anonymous function gets a synthetic one. */
function promoteCallToFunction<OtherInfo>(call: NodeId, arg: NodeId, info: DataflowInformation, data: DataflowProcessorInformation<ParentInformation & OtherInfo>): void {
	const val = RArgument.valueOf(data.completeAst.idMap.get(arg));
	if(RSymbol.is(val)) {
		info.graph.updateToFunctionCall({
			tag:         VertexType.FunctionCall,
			id:          val.info.id,
			name:        val.content,
			args:        [],
			environment: data.environment,
			onlyBuiltin: false,
			cds:         data.cds,
			origin:      [BuiltInProcName.Function]
		});
		info.graph.addEdge(arg, val.info.id, EdgeType.Calls);
		return;
	}
	if(!RFunctionDefinition.is(val)) {
		return;
	}
	const functionId = val.info.id;
	info.graph.addEdge(arg, functionId, EdgeType.Calls | EdgeType.Reads);
	const syntheticCall = 'anon-' + functionId;
	info.graph.addVertex({
		tag:         VertexType.FunctionCall,
		id:          syntheticCall,
		environment: data.environment,
		name:        `${UnnamedFunctionCallPrefix}${functionId}`,
		onlyBuiltin: false,
		cds:         data.cds,
		args:        [],
		origin:      [BuiltInProcName.Function]
	}, data.ctx.env.cleanEnv);
	info.graph.addEdge(arg, syntheticCall, EdgeType.Calls);
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
	return exitPoints.map(e => {
		if(e.cds) {
			e.cds.push(...cds);
			return e;
		}
		return { ...e, cds };
	});
}