import { RFunctionCall, EmptyArgument  } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RAccess } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-access';
import { setOf } from '../values/sets/set-constants';
import { valueSetGuard, valueFromRNumber  } from '../values/general';
import { NodeValue } from './node-value';
import { RValue } from '../values/r-value';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import { RNumber } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-number';
import { RString } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RLogical } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-logical';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RNumberValue } from '../../../r-bridge/lang-4.x/convert-values';
import { isRNumberValue, unliftRValue } from '../../../util/r-value';
import type { BuiltInEvalHandler, BuiltInEvalHandlerArgs } from '../../environments/built-in';
import { OriginType } from '../../origin/dfg-get-origin';
import { ValueLogicalFalse, ValueLogicalTrue } from '../values/logical/logical-constants';
import { isValue, type Lift, Top, type Value, type ValueList, type ValueListElement, type ValueNumber, type ValueVector } from '../values/r-value';
import { listElementAt, listField, listFrom } from '../values/lists/list-constants';
import type { ResolveInfo, ResolveResult } from './alias-tracking';
import { RSymbol } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { flattenVectorElements, vectorFrom } from '../values/vectors/vector-constants';
import { liftScalar } from '../values/scalar/scalar-constants';
import { Identifier, ReferenceType } from '../../environments/identifier';
import { EdgeType } from '../../graph/edge';
import { DfgVertex } from '../../graph/vertex';
import type { REnvironmentInformation } from '../../environments/environment';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';
import { Dataflow } from '../../graph/df-helper';
import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Resolve } from '../../environments/resolve-helper';
import { RBinaryOp } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RUnaryOp } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-unary-op';
import { RExpressionList } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { resolveAsField } from './resolve-field';

/** The {@link BuiltInEvalHandler} the given name resolves to in the current environment, just like the {@link BuiltInIdentifierDefinition#processor} a call resolves to; `undefined` if the name is shadowed by a user definition or its built-in declares no handler. */
function evalHandlerOf(name: Identifier, environment: REnvironmentInformation | undefined, ctx: ReadOnlyFlowrAnalyzerContext): BuiltInEvalHandler | undefined {
	/* without an environment the search path is unknown, so what a package states about the name has its say */
	const defs = environment ? Resolve.byNameAndType(name, environment, ReferenceType.BuiltInFunction) : ctx.env.builtInDefinitionsOf(name);
	const def = defs?.length === 1 ? defs[0] : undefined;
	return def?.type === ReferenceType.BuiltInFunction ? def.evalHandler : undefined;
}

function foldsThroughBuiltIn(name: Identifier, ctx: ReadOnlyFlowrAnalyzerContext): boolean {
	return ctx.env.builtInDefinitionsOf(name).some(d => d.type === ReferenceType.BuiltInFunction && d.evalHandler !== undefined);
}

/** the node types that may fold through a built-in: calls, operators, and the `(`/`{` groupings */
const EvalNodeTypes: readonly RType[] = [RType.FunctionCall, RType.BinaryOp, RType.UnaryOp, RType.ExpressionList, RType.Access];

/** Whether the operator only combines literals (`1 + 2`), which alone fold while the analysis runs, as a name may still change its value. */
export function onlyLiterals(node: RNode<ParentInformation>): boolean {
	return RBinaryOp.is(node) ? onlyLiterals(node.lhs) && onlyLiterals(node.rhs)
		: RUnaryOp.is(node) ? onlyLiterals(node.operand)
			: RExpressionList.is(node) && node.grouping !== undefined && node.children.length === 1 ? onlyLiterals(node.children[0])
				: RNumber.is(node) || RString.is(node) || RLogical.is(node);
}

/** The name of the built-in the given node folds through, `undefined` if it is no call to one or if it may just as well resolve to something else (a user redefinition, a conditional one, ...), which must not be folded. */
function evalNameOf({ node, graph, environment, ctx }: BuiltInEvalHandlerArgs): Identifier | undefined {
	if(!EvalNodeTypes.includes(node.type)) {
		return undefined;
	} else if(graph === undefined) {
		const named = RExpressionList.is(node) ? RExpressionList.groupStart(node)?.content
			: RAccess.is(node) ? Identifier.make(node.operator)
				: RFunctionCall.calledName(node) ?? ((RBinaryOp.is(node) || RUnaryOp.is(node)) && onlyLiterals(node) ? Identifier.make(node.operator) : undefined);
		return named !== undefined && environment !== undefined && foldsThroughBuiltIn(named, ctx)
			&& Resolve.isBuiltIn(named, environment, ReferenceType.Function) ? named : undefined;
	}
	const vertex = graph.getVertex(node.info.id);
	if(DfgVertex.isFunctionCall(vertex) && vertex.onlyBuiltin && !foldsThroughBuiltIn(vertex.name, ctx)) {
		/* a call resolved to built-ins only folds through the one it names, if any, see the origins below */
		return undefined;
	}
	let name: Identifier | undefined;
	if(graph.isQuoted(node.info.id)) {
		/* a quoted call reached here is evaluated where the expression is (`eval`, a delayed binding), so what it calls is what it is linked to */
		const [target, ...others] = Dataflow.targetsOf(graph, node.info.id, EdgeType.Calls);
		return target !== undefined && others.length === 0 && NodeId.isBuiltIn(target) ? NodeId.fromBuiltIn(target) : undefined;
	}
	for(const origin of Dataflow.origin(graph, node.info.id) ?? []) {
		if(origin.type === OriginType.FunctionCallOrigin || origin.type === OriginType.WriteVariableOrigin) {
			/* the call may go to a definition of the program instead, so we know too little to fold it */
			return undefined;
		} else if(origin.type !== OriginType.BuiltInFunctionOrigin) {
			continue;
		}
		/* an alias like `f <- c` keeps the built-in it stands for in `proc`, a direct call names itself */
		const pkgFn = NodeId.toPkgFn(origin.proc);
		const named = pkgFn !== undefined ? Identifier.make(pkgFn[1], pkgFn[0])
			: NodeId.isBuiltIn(origin.proc) ? NodeId.fromBuiltIn(origin.proc) : origin.fn.name;
		if(name !== undefined && Identifier.getName(name) !== Identifier.getName(named)) {
			return undefined;
		}
		/* the same call is named bare by one origin and qualified by another; the qualified one says whose it is */
		name = name !== undefined && Identifier.getNamespace(named) === undefined ? name : named;
	}
	return name;
}

/** Converts an RNode to its Value, either directly for a constant or by handing the node to the {@link BuiltInEvalHandler} its built-in declares, which may resolve further nodes recursively. */
export function resolveNode(args: BuiltInEvalHandlerArgs): Value {
	const { node, environment, ctx } = args;
	const nt = node.type;
	if(nt === RType.String) {
		return RValue.ofStringLiteral(node.content) ?? Top;
	} else if(nt === RType.Number) {
		return valueFromRNumber(node.content);
	} else if(nt === RType.Logical) {
		return node.content.valueOf() ? ValueLogicalTrue : ValueLogicalFalse;
	} else if(nt === RType.FunctionDefinition) {
		return { type: 'function-definition' };
	}
	const name = evalNameOf(args);
	const handler = name === undefined ? undefined : evalHandlerOf(name, environment, ctx);
	return handler?.(args) ?? Top;
}

/** Resolves a vector call `c` to a {@link ValueVector}; helper of {@link resolveNode|resolveNode}. */
export function resolveAsVector(args: BuiltInEvalHandlerArgs): ValueVector | typeof Top {
	const node = args.node;
	if(!RFunctionCall.is(node)) {
		return Top;
	}
	const elements = flattenVectorElements(node.arguments.map(arg => arg !== EmptyArgument ? Resolve.toValue(arg.value, args) : Top));
	/* combined with a list, `c` makes a list */
	return isValue(elements) && elements.some(e => e.type === 'list' || (e.type === 'set' && isValue(e.elements) && e.elements.some(s => s.type === 'list'))) ? Top : vectorFrom(elements);
}

/** The one value a resolution stands for, a set if it may be several. */
export function asOneValue(result: ResolveResult): Value {
	return isValue(result) && result.elements.length === 1 ? result.elements[0] : result;
}

/** Resolves `list(...)` to a {@link ValueList} of what each argument holds, an argument flowR does not know keeps its place and name; helper of {@link resolveNode}. */
export function resolveAsList(args: BuiltInEvalHandlerArgs): ValueList | typeof Top {
	const node = args.node;
	if(!RFunctionCall.is(node)) {
		return Top;
	}
	const elements: ValueListElement[] = [];
	for(const arg of node.arguments) {
		/* `...` stands for any number of elements */
		if(arg === EmptyArgument || arg.value === undefined || arg.value.lexeme === '...') {
			return Top;
		}
		elements.push({ name: arg.name === undefined ? undefined : Identifier.getName(arg.name.content), value: asOneValue(Resolve.toValue(arg.value, args)) });
	}
	return listFrom(elements);
}

/** The name or position `key` names an element of a list by, `undefined` if it may be several or none of them; `$` takes its field as a name. */
export function accessKeyOf(access: RAccess<ParentInformation>, key: RNode<ParentInformation>, info: ResolveInfo): string | number | undefined {
	if(access.operator === '$') {
		return RString.is(key) ? key.content.str : RSymbol.is(key) ? Identifier.getName(key.content) : undefined;
	}
	const value = NodeValue.sole(valueSetGuard(Resolve.toValue(key, info)));
	const str = value === undefined ? undefined : RValue.stringOf(value);
	const num = value === undefined ? undefined : RValue.numberOf(value);
	return str ?? (num !== undefined && num >= 1 ? num : undefined);
}

/** The element `l$name` or `l[[key]]` reads from a list, `undefined` where flowR cannot tell it. */
export function listElementOf(list: ValueList, key: string | number, operator: string): Value | undefined {
	return typeof key === 'number' ? listElementAt(list, key) : listField(list, key, operator !== '$');
}

/** Resolves `x[[i]]` to the element of `x` at position `i`, so `c("a", "b")[[2]]` is `"b"`. */
export function resolveAsElement(args: BuiltInEvalHandlerArgs): Value {
	const field = resolveAsField(args);
	if(field !== undefined) {
		return field;
	}
	const node = args.node;
	const index = RAccess.is(node) && (node.operator === '[[' || node.operator === '$') && node.access.length === 1
		&& node.access[0] !== EmptyArgument && node.access[0].name === undefined ? node.access[0].value : undefined;
	if(!RAccess.is(node) || index === undefined) {
		return Top;
	}
	/* what else reads the same container (`l$a + l$b`) has to see it as well, only what is walked to get here stays blocked */
	const containers = valueSetGuard(Resolve.toValue(node.accessed, { ...args, blocked: new Set(args.blocked) }))?.elements;
	if(containers === undefined || containers.length === 0) {
		return Top;
	} else if(containers.every(c => c.type === 'list' || c.type === 'null')) {
		const key = accessKeyOf(node, index, args);
		const elements = key === undefined ? undefined : containers.map(c => c.type === 'null' ? c : listElementOf(c, key, node.operator));
		return elements === undefined || elements.includes(undefined) ? Top : setOf(elements as Value[]);
	}
	const vectors = node.operator === '[[' ? containers : [];
	if(vectors.length === 0 || !vectors.every(v => v.type === 'vector' && isValue(v.elements) && v.elements.length > 0)) {
		return Top;
	}
	const positions = valueSetGuard(Resolve.toValue(index, args))?.elements.map(p => RValue.numberOf(p)) ?? [];
	const known = positions.length > 0 && positions.every(p => p !== undefined && Number.isInteger(p)) ? positions as number[] : undefined;
	return setOf((vectors as ValueVector<Value[]>[]).flatMap(v => known === undefined ? v.elements : known.flatMap(p => v.elements[p - 1] ?? [])));
}

/** Resolves the sequence operator `:` to a {@link ValueVector} of {@link ValueNumber}s; helper of {@link resolveNode}. */
export function resolveAsSeq(args: BuiltInEvalHandlerArgs): ValueVector<Lift<ValueNumber[]>> | typeof Top {
	const operator = args.node;
	if(!RBinaryOp.is(operator)) {
		return Top;
	}
	const leftValue = unliftRValue(Resolve.toValue(operator.lhs, args));
	const rightValue = unliftRValue(Resolve.toValue(operator.rhs, args));
	const sequence = isRNumberValue(leftValue) && isRNumberValue(rightValue) ? createNumberSequence(leftValue, rightValue) : undefined;
	return sequence === undefined ? Top : vectorFrom(sequence.map(liftScalar));
}

/** How many elements of a sequence are worth naming one by one. */
const MaxSequenceLength = 4096;

/** The elements `from:to` runs over, counting down whenever `to` is the smaller one, and stopping before it would pass `to` (`1:3.5` ends at `3`). */
function createNumberSequence(start: RNumberValue, end: RNumberValue): RNumberValue[] | undefined {
	if(!Number.isFinite(start.num) || !Number.isFinite(end.num)) {
		return undefined;
	} else if(Math.floor(Math.abs(end.num - start.num)) + 1 > MaxSequenceLength) {
		return undefined;
	}
	const step = start.num <= end.num ? 1 : -1;
	const sequence: RNumberValue[] = [];
	for(let i = start.num; step > 0 ? i <= end.num : i >= end.num; i += step) {
		sequence.push({ ...start, num: i });
	}
	return sequence;
}
