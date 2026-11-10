import type { BuiltInEvalHandlerArgs } from '../../environments/built-in';
import { RAccess } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../../graph/graph';
import { DfgVertex, type FoundOnCall } from '../../graph/vertex';
import { Dataflow } from '../../graph/df-helper';
import { EdgeType } from '../../graph/edge';
import { EnvironmentLookups, EnvironmentProducers, holdsValueOf } from '../../internal/process/functions/call/built-in/built-in-envir-utils';
import { isTop, isValue, Top, type Value } from '../values/r-value';
import { setOf } from '../values/sets/set-constants';
import { valueSetGuard } from '../values/general';
import { trackAliasesInGraph } from './alias-tracking';
import { RBinaryOp } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RoleInParent } from '../../../r-bridge/lang-4.x/ast/model/processing/role';
import type { AstIdMap } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { ControlDependency } from '../../info';
import { ProgramOrder } from '../../internal/program-order';

/** the assignments whose target a definition of a field may be */
const AssignmentOperators: ReadonlySet<string> = new Set(['<-', '=', '<<-', '->', '->>', ':=']);
/** The accesses naming a single variable of an environment, whose value {@link resolveAsField} folds. */
export const FieldOperators = ['$', '[['] as const;
/** the edges a read of a variable holding an environment, a closure reading it, or a replacement rebinding it, point to it with */
const ReadOf = EdgeType.Reads | EdgeType.DefinedByOnCall;
/** the edges a copy or a parameter point to the read they hold the environment of with */
const HandedTo = EdgeType.DefinedBy | EdgeType.DefinedByOnCall;

/** Whether only what flowR tracks may write into the environment the variable definition `holder` holds: every read of it, through copies and parameters it is handed to, is the environment of an access or of a call that looks up or writes bindings in it (see {@link EnvironmentLookups}), or an argument of a function of the program, whose writes are replayed or count as unknown side effects. */
export function writesTracked(holder: NodeId, graph: DataflowGraph): boolean {
	const idMap = graph.idMap;
	if(idMap === undefined) {
		return false;
	}
	const holders = new Set<NodeId>([holder]);
	for(const h of holders) {
		for(const read of Dataflow.sourcesOf(graph, h, ReadOf)) {
			const vertex = graph.getVertex(read);
			if(DfgVertex.isVariableDefinition(vertex)) {
				/* a replacement of a free variable in a function body (`function() e$x <- 9`) writes where no call replays it */
				if(idMap.get(read)?.info.role === RoleInParent.Accessed && Dataflow.hasEdge(graph, read, h, EdgeType.DefinedByOnCall)) {
					return false;
				}
				/* a copy, a parameter, or the variable a replacement (`e$x <- v`) rebinds, all hold the same environment */
				holders.add(read);
				continue;
			} else if(!DfgVertex.isUse(vertex)) {
				continue;
			}
			for(const copy of Dataflow.sourcesOf(graph, read, HandedTo)) {
				if(DfgVertex.isVariableDefinition(graph.getVertex(copy))) {
					holders.add(copy);
				}
			}
			const node = idMap.get(read);
			const parent = node === undefined ? undefined : RNode.directParent(node, idMap);
			const user = RArgument.is(parent) ? RNode.directParent(parent, idMap) : parent;
			const call = user === undefined ? undefined : graph.getVertex(user.info.id);
			if(!DfgVertex.isFunctionCall(call)) {
				return false;
			}
			const defined = Dataflow.targetsOf(graph, call.id, EdgeType.Calls);
			const program = defined.length > 0 && defined.every(d => DfgVertex.isFunctionDefinition(graph.getVertex(d)));
			if(!program && (call.origin === 'unnamed' || !call.origin.some(o => EnvironmentLookups.has(o)))) {
				return false;
			}
		}
	}
	return true;
}

/** Whether a definition of a field is what an assignment writes into part of it only (`e$x[2] <- 5`, `names(e$x) <- n`). */
function partialWrite(def: NodeId, idMap: AstIdMap): boolean {
	const node = idMap.get(def);
	const assignment = node === undefined ? undefined : RNode.directParent(node, idMap);
	if(!RBinaryOp.is(assignment) || !AssignmentOperators.has(assignment.operator)) {
		return false;
	}
	const [target, value] = assignment.operator.startsWith('->') ? [assignment.rhs, assignment.lhs] : [assignment.lhs, assignment.rhs];
	return value === node && !RSymbol.is(target) && !(RAccess.is(target) && RSymbol.is(target.accessed));
}

/** What the lookup finds for the calls the walk is in, or for all calls it records, each made once at the top, so nothing a later run writes is missing; `undefined` if one of them may run more than once. */
function foundAtCalls(records: readonly FoundOnCall[], { frames, callContext }: BuiltInEvalHandlerArgs, graph: DataflowGraph): readonly NodeId[] | undefined {
	const inFrames = records.filter(r => frames?.some(f => f.call === r.call) || callContext?.values().some(c => c === r.call));
	const used = inFrames.length > 0 ? inFrames : records;
	if(used.some(r => ProgramOrder.runsOnceAt(r.call, graph) === undefined)) {
		return undefined;
	}
	return inFrames.length > 0 ? used.map(r => r.found).reduce((a, b) => a.filter(d => b.includes(d))) : used.flatMap(r => r.found);
}

/** The value of `e$f` or `e[["f"]]` when `e` surely holds an environment whose contents flowR tracks, see {@link DataflowGraphVertexFunctionCall#found}: what the definitions of `f` there hold, those a call binds for the calls the walk is in, if `e` is bound by the calls of the function around the access. */
export function resolveAsField(args: BuiltInEvalHandlerArgs): Value | undefined {
	const { node, graph } = args;
	const vertex = graph?.getVertex(node.info.id);
	if(graph === undefined || graph.idMap === undefined || !RAccess.is(node) || !(FieldOperators as readonly string[]).includes(node.operator) || node.access.length !== 1
		|| !DfgVertex.isFunctionCall(vertex) || (vertex.found === undefined && vertex.foundOnCall === undefined)) {
		return undefined;
	}
	const accessed = node.accessed;
	const holders = RSymbol.is(accessed) ? Dataflow.targetsOf(graph, accessed.info.id, EdgeType.Reads | EdgeType.DefinedByOnCall) : [];
	/* something written somewhere flowR does not know may be into any environment */
	if(holders.length === 0 || graph.unknownSideEffects.values().some(e => typeof e !== 'object') || !holders.every(h => holdsValueOf({ nodeId: h }, graph, EnvironmentProducers) && writesTracked(h, graph))) {
		return Top;
	}
	/* the contents are those where the access is written, so a later run of a loop may see later writes */
	const idMap = graph.idMap;
	if(vertex.cds?.some(cd => ControlDependency.isIterated(cd, idMap))) {
		return Top;
	}
	/* a binding of the function around the access is the one it saw where it is written, a free one the one at each call */
	const fn = RNode.strictlyEnclosingFunction(node.info.id, idMap);
	const local = holders.every(h => RNode.strictlyEnclosingFunction(h, idMap) === fn);
	const defs = local ? vertex.found : foundAtCalls(vertex.foundOnCall ?? [], args, graph);
	if(defs === undefined || defs.length === 0 || defs.some(d => partialWrite(d, idMap))) {
		return Top;
	}
	const values: Value[] = [];
	for(const def of new Set(defs)) {
		const value = valueSetGuard(trackAliasesInGraph(def, graph, args.ctx, idMap, new Set(args.blocked), args.callContext));
		if(value === undefined || !isValue(value.elements) || value.elements.some(isTop)) {
			return Top;
		}
		values.push(...value.elements);
	}
	return setOf(values);
}
