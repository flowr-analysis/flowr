import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../graph/graph';
import { EdgeType } from '../graph/edge';
import type { DataflowCfgInformation, ExitPoint } from '../info';
import { ControlDependency, ExitPointType, withCds } from '../info';
import { Ternary } from '../../util/logic';
import { RoleInParent } from '../../r-bridge/lang-4.x/ast/model/processing/role';
import { RBinaryOp } from '../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { isNotUndefined } from '../../util/assert';

/** Where `from` completes: its single CFG exit when it has one, else each of its default exit points. */
function completionsOf(from: DataflowCfgInformation): readonly NodeId[] {
	return from.cfgExit !== undefined ? [from.cfgExit]
		: from.exitPoints.filter(e => e.type === ExitPointType.Default).map(e => e.nodeId);
}

/**
 * Records the control flow of a program in the {@link DataflowGraph} while the dataflow analysis walks it.
 * The {@link ControlFlowGraph} is a view on what is recorded here.
 *
 * The control flow is modeled in post-order: everything a construct is made of runs before the construct
 * itself, so its own vertex is where its parts join again and where it is left.
 * @helper control-flow
 */
export const ControlFlow = {
	name: 'ControlFlow',
	/**
	 * The node control flow enters the given subtree at.
	 * @example
	 * ```r
	 * x + 1 # the `+` is entered at `x`
	 * ```
	 */
	entryOf(this: void, info: DataflowCfgInformation): NodeId {
		return info.cfgEntry ?? info.entryPoint;
	},
	/**
	 * Whether the node runs as a statement of the program instead of as part of a larger expression.
	 * Assignments count as statements wherever they stand.
	 * @see {@link ControlFlow#isExpression|isExpression()} - for the other kind
	 * @example
	 * ```r
	 * print(x + 1) # the call is a statement, `x + 1` and `x` are expressions
	 * ```
	 */
	isStatement(this: void, graph: DataflowGraph, id: NodeId): boolean {
		const node = graph.idMap?.get(id);
		if(node === undefined) {
			return false;
		}
		return node.info.role === RoleInParent.ExpressionListChild
			|| (RBinaryOp.is(node) && node.flavor === 'assignment');
	},
	/**
	 * Whether the node runs as part of a larger expression instead of as a statement of its own.
	 * @see {@link ControlFlow#isStatement|isStatement()} - for the other kind
	 * @example
	 * ```r
	 * print(x + 1) # `x + 1` and `x` are expressions, the call is a statement
	 * ```
	 */
	isExpression(this: void, graph: DataflowGraph, id: NodeId): boolean {
		return graph.idMap?.get(id) !== undefined && !ControlFlow.isStatement(graph, id);
	},
	/**
	 * Whether the subtree always jumps away instead of being left normally, i.e. whether a non-default exit
	 * point happens in every branch. The control dependencies in `context` (like a promise's) hold for the whole subtree.
	 * @see {@link ControlFlow#canComplete|canComplete()} - for whether it can be left normally at all
	 * @example
	 * ```r
	 * { break }            # always exits
	 * { if(u) break }      # only maybe
	 * ```
	 */
	alwaysExits(this: void, info: DataflowCfgInformation, context: readonly ControlDependency[] = []): boolean {
		const cds: ControlDependency[] = [];
		for(const exit of info.exitPoints) {
			if(exit.type !== ExitPointType.Default) {
				if(exit.cds === undefined) {
					return true;
				}
				const own = ControlDependency.minus(exit.cds, context);
				if(own.length === 0 && exit.cds.length > 0) {
					return true;
				}
				cds.push(...own);
			}
		}
		return ControlDependency.happensInEveryBranch(cds);
	},
	/**
	 * Whether the subtree can be left normally instead of always jumping away.
	 * @see {@link ControlFlow#alwaysExits|alwaysExits()} - for whether it always jumps away
	 * @example
	 * ```r
	 * { 1 }     # can complete
	 * { break } # cannot
	 * ```
	 */
	canComplete(this: void, info: DataflowCfgInformation): boolean {
		return info.cfgExit !== undefined || info.exitPoints.some(e => e.type === ExitPointType.Default);
	},
	/**
	 * Whatever `from` completes at continues with `next`.
	 * @see {@link ControlFlow#branchesTo|branchesTo()} - if it only continues under a condition
	 * @example
	 * ```r
	 * f(); g() # the call to `g` continues what `f` completes
	 * ```
	 */
	continuesWith(this: void, graph: DataflowGraph, from: DataflowCfgInformation, next: NodeId): void {
		for(const exit of completionsOf(from)) {
			graph.addEdge(exit, next, EdgeType.FlowEdge);
		}
	},
	/**
	 * Whatever `from` completes at continues with `target`, but only under the given control dependency.
	 * Hand over the very dependency the vertices behind the branch carry, so both say the same thing.
	 * @see {@link ControlFlow#continuesWith|continuesWith()} - if it always continues
	 * @example
	 * ```r
	 * if(u) a else b # `a` is reached when `u` holds, `b` when it does not
	 * ```
	 */
	branchesTo(this: void, graph: DataflowGraph, from: DataflowCfgInformation, target: NodeId, cd: ControlDependency): void {
		for(const exit of completionsOf(from)) {
			graph.addEdge(exit, target, EdgeType.ControlEdge, { cd });
		}
	},
	/**
	 * Every jump of the given kind within `from` lands on `target`, which reads a `break` as it decides how often a loop runs.
	 * @example
	 * ```r
	 * while(u) { break } # the `break` lands on the loop it leaves
	 * ```
	 */
	jumpsTo(this: void, graph: DataflowGraph, from: DataflowCfgInformation, kind: ExitPointType, target: NodeId): void {
		for(const exit of from.exitPoints) {
			if(exit.type === kind) {
				graph.addEdge(exit.nodeId, target, EdgeType.FlowEdge);
				if(kind === ExitPointType.Break) {
					graph.addEdge(target, exit.jump ?? exit.nodeId, EdgeType.Reads);
				}
			}
		}
	},
	/**
	 * What is handed to `holder` runs only once `holder` forces it, so it is analyzed under that control
	 * dependency: a definition within a promise may not happen, and what it would overwrite stays visible.
	 * @see {@link ControlFlow#promise|promise()} - for the jumps within a promise
	 * @example
	 * ```r
	 * g(x <- 2) # `x` is 2 afterwards only if `g` forces its argument
	 * ```
	 */
	withinPromise<Data extends { readonly cds?: readonly ControlDependency[] }>(this: void, data: Data, holder: NodeId): Data {
		return { ...data, cds: withCds(data.cds, [{ id: holder, when: true, byPromise: true }]) };
	},
	/**
	 * A function defined within a promise: forcing the promise only creates it, its body runs once it is called,
	 * so neither the definition nor its body depend on the call holding the promise.
	 * @example
	 * ```r
	 * f(function() print(1)) # the print runs when `f` calls its argument, which `f(...)` itself does not decide
	 * ```
	 */
	outsidePromises<Data extends { readonly cds?: readonly ControlDependency[] }>(this: void, data: Data): Data {
		if(!data.cds?.some(cd => cd.byPromise)) {
			return data;
		}
		const kept = data.cds.filter(cd => !cd.byPromise);
		return { ...data, cds: kept.length > 0 ? kept : undefined };
	},
	/**
	 * The jumps within a promise, an argument or default R evaluates only if `holder` forces it. A jump
	 * - never runs if the promise is {@link Ternary#Never|never} forced, so control resumes at `holder`,
	 * - leaves whenever reached if it is {@link Ternary#Always|always} forced,
	 * - otherwise stays an exit under a `byPromise` dependency on `holder`, and control may resume at `holder` as well,
	 *   until {@link FunctionSemantics.settleJumpsInPromises} settles it.
	 * @returns the exit points the holder takes over from the promise
	 * @example
	 * ```r
	 * g(return(1))           # whether this returns is up to `g`
	 * function(x = break) x  # the `break` runs where `x` is first used
	 * ```
	 */
	promise(this: void, graph: DataflowGraph, promise: DataflowCfgInformation | undefined, forcing: Ternary, holder: NodeId): ExitPoint[] {
		const exits = promise?.exitPoints.filter(e => e.type !== ExitPointType.Default) ?? [];
		if(forcing === Ternary.Always) {
			return exits;
		}
		for(const exit of exits) {
			graph.addEdge(exit.nodeId, holder, EdgeType.FlowEdge);
		}
		return forcing === Ternary.Never ? [] : exits.map(e => ControlFlow.withinPromise(e, holder));
	},
	/**
	 * The parts run one after the other and the last one continues with `last`, if it is given.
	 * Parts that are `undefined` are skipped, which keeps optional arguments cheap to handle.
	 * @returns the node control flow enters the sequence at, or `last` if there is nothing to enter
	 * @example
	 * ```r
	 * f(a, b) # `a`, then `b`, then the call
	 * ```
	 */
	inSequence(this: void, graph: DataflowGraph, parts: readonly (DataflowCfgInformation | undefined)[], last?: NodeId): NodeId | undefined {
		let entry: NodeId | undefined = undefined;
		let previous: DataflowCfgInformation | undefined = undefined;
		for(const part of parts) {
			if(part === undefined) {
				continue;
			}
			const next = ControlFlow.entryOf(part);
			if(previous === undefined) {
				entry = next;
			} else {
				ControlFlow.continuesWith(graph, previous, next);
				/*
				 * R promises the parts are evaluated in this order, not that one jumping away keeps the next
				 * from running at all, so a part that cannot complete still leads into the one after it.
				 */
				if(!ControlFlow.canComplete(previous)) {
					for(const exit of previous.exitPoints) {
						graph.addEdge(exit.nodeId, next, EdgeType.FlowEdge);
					}
				}
			}
			previous = part;
		}
		if(previous !== undefined && last !== undefined) {
			ControlFlow.continuesWith(graph, previous, last);
		}
		return entry ?? last;
	},
	/**
	 * The parts before `from` run in sequence, the ones after it are alternatives of which at most one runs.
	 * Whichever one it is, control joins on `joinsAt`.
	 * @param graph      - the graph to record in
	 * @param parts      - the arguments of the call, in the order they run
	 * @param from       - the index the alternatives start at
	 * @param joinsAt    - the call the alternatives belong to
	 * @param hasDefault - whether one alternative runs when none of the others matched
	 * @returns          the node control flow enters the call at
	 * @example
	 * ```r
	 * switch(k, a = 1, b = 2) # `k`, then one arm, then the switch
	 * ```
	 */
	picksOneOf(this: void, graph: DataflowGraph, parts: readonly (DataflowCfgInformation | undefined)[], from: number, joinsAt: NodeId, hasDefault: boolean): NodeId | undefined {
		const selectors = parts.slice(0, from).filter(isNotUndefined);
		const selector = selectors.at(-1);
		const entry = ControlFlow.inSequence(graph, selectors);
		for(const alternative of parts.slice(from)) {
			if(alternative !== undefined) {
				if(selector !== undefined) {
					ControlFlow.branchesTo(graph, selector, ControlFlow.entryOf(alternative), { id: joinsAt, when: true });
				}
				ControlFlow.continuesWith(graph, alternative, joinsAt);
			}
		}
		if(selector !== undefined && !hasDefault) {
			ControlFlow.branchesTo(graph, selector, joinsAt, { id: joinsAt, when: false });
		}
		return entry ?? joinsAt;
	}
} as const;
