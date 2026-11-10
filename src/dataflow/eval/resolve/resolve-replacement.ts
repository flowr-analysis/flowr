import type { AstIdMap, ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RAccess } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { RBinaryOp } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { type DataflowGraph, FunctionArgument } from '../../graph/graph';
import { DfgVertex } from '../../graph/vertex';
import { EdgeType } from '../../graph/edge';
import { Dataflow } from '../../graph/df-helper';
import { BuiltInProcName } from '../../environments/built-in-proc-name';
import { BuiltInOperators, OperatorUsedAs } from '../../environments/default-builtin-config/base-operators';
import { Resolve } from '../../environments/resolve-helper';
import { isValue, type Value } from '../values/r-value';
import { setOf } from '../values/sets/set-constants';
import { withListElement } from '../values/lists/list-constants';
import type { ResolveInfo } from './alias-tracking';
import { accessKeyOf, asOneValue, listElementOf } from './resolve';

/** The replacement functions whose effect on a list the value solver knows. */
const ElementReplacements: ReadonlySet<string> = new Set(['$<-', '$<<-', '[[<-', '[[<<-']);
/** what a replacement reads its old value by, which a loop links the replacement to as well */
const ElementAccesses: ReadonlySet<string> = new Set(['$', '[[']);

/** The assignment `x$a$b <- v` a replacement definition of `x` stems from: the accesses from `x` outwards and what the outermost one is assigned. */
interface ElementReplacement {
	readonly accesses: readonly RAccess<ParentInformation>[]
	readonly value:    NodeId
}

function elementReplacementOf(target: NodeId, graph: DataflowGraph, idMap: AstIdMap): ElementReplacement | undefined {
	const accesses: RAccess<ParentInformation>[] = [];
	let node = idMap.get(target);
	let parent = node === undefined ? undefined : RNode.directParent(node, idMap);
	while(RAccess.is(parent) && parent.accessed.info.id === node?.info.id) {
		if(parent.access.length !== 1 || parent.access[0] === EmptyArgument || parent.access[0].name !== undefined || !replacesElement(parent.info.id, graph)) {
			return undefined;
		}
		accesses.push(parent);
		node = parent;
		parent = RNode.directParent(parent, idMap);
	}
	const call = accesses.length === 0 ? undefined : graph.getVertex(accesses[0].info.id);
	const valueArg = DfgVertex.isFunctionCall(call) ? call.args.at(-1) : undefined;
	const value = valueArg === undefined ? undefined : FunctionArgument.getReference(valueArg);
	const assigned = RBinaryOp.is(parent) && BuiltInOperators.get(parent.operator)?.usedAs === OperatorUsedAs.Assignment
		&& [parent.lhs.info.id, parent.rhs.info.id].includes(value as NodeId) && [parent.lhs.info.id, parent.rhs.info.id].includes(node?.info.id as NodeId);
	return assigned && value !== undefined ? { accesses, value } : undefined;
}

/** whether the access is a replacement that calls nothing but the built-in `$<-` or `[[<-` */
function replacesElement(access: NodeId, graph: DataflowGraph): boolean {
	if(!DfgVertex.hasOrigin(graph.getVertex(access), BuiltInProcName.Replacement)) {
		return false;
	}
	const called = Dataflow.targetsOf(graph, access, EdgeType.Calls).map(t => NodeId.isBuiltIn(t) ? NodeId.fromBuiltIn(t) : undefined);
	return called.some(c => c !== undefined && ElementReplacements.has(c)) && called.every(c => c !== undefined && (ElementReplacements.has(c) || ElementAccesses.has(c)));
}

/** What the target of a replacement holds once it is done, given what it held before (`old`): `x$a$b <- v` reads `x$a`, sets its `b` to `v`, and sets the `a` of `x` to the result. */
export function replacedValue(target: NodeId, old: readonly Value[], info: ResolveInfo & { readonly graph: DataflowGraph, readonly idMap: AstIdMap }): Value | undefined {
	const replacement = elementReplacementOf(target, info.graph, info.idMap);
	if(replacement === undefined) {
		return undefined;
	}
	const keys = replacement.accesses.map(a => accessKeyOf(a, (a.access[0] as { value: RNode<ParentInformation> }).value, info));
	if(keys.includes(undefined)) {
		return undefined;
	}
	const value = asOneValue(Resolve.toValue(replacement.value, info));
	const update = (container: Value, depth: number): Value | undefined => {
		if(depth === keys.length) {
			return value;
		} else if(isValue(container) && container.type === 'set') {
			const each = isValue(container.elements) ? container.elements.map(c => update(c, depth)) : [undefined];
			return each.includes(undefined) ? undefined : setOf(each as Value[]);
		}
		const key = keys[depth] as string | number;
		const inner = !isValue(container) ? undefined
			: container.type === 'null' ? container
				: container.type === 'list' ? listElementOf(container, key, replacement.accesses[depth].operator) : undefined;
		const updated = inner === undefined ? undefined : update(inner, depth + 1);
		return updated === undefined ? undefined : withListElement(container, key, updated);
	};
	const each = old.map(o => update(o, 0));
	return each.includes(undefined) ? undefined : setOf(each as Value[]);
}
