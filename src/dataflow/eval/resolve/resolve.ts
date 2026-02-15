import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { RNumberValue } from '../../../r-bridge/lang-4.x/convert-values';
import { isRNumberValue, unliftRValue } from '../../../util/r-value';
import type { BuiltInEvalHandlerArgs } from '../../environments/built-in';
import { BuiltInEvalHandlerMapper, builtInId, isBuiltIn } from '../../environments/built-in';
import { getOriginInDfg, OriginType } from '../../origin/dfg-get-origin';
import { intervalFrom } from '../values/intervals/interval-constants';
import { ValueLogicalFalse, ValueLogicalTrue } from '../values/logical/logical-constants';
import { type Lift, Top, type Value, type ValueNumber, type ValueVector } from '../values/r-value';
import { stringFrom } from '../values/string/string-constants';
import { flattenVectorElements, vectorFrom } from '../values/vectors/vector-constants';
import type { ResolveInfo } from './alias-tracking';
import { resolveIdToValue } from './alias-tracking';
import { liftScalar } from '../values/scalar/scalar-constants';
import { Identifier } from '../../environments/identifier';

/**
 * Helper function used by {@link resolveIdToValue}, please use that instead, if
 * you want to resolve the value of an identifier / node
 *
 * This function converts an RNode to its Value, but also recursively resolves
 * aliases and vectors (in case of node vector).
 * @returns resolved value or top/bottom
 */
export function resolveNode({ resolve, node, ctx, blocked, environment, graph, idMap }: BuiltInEvalHandlerArgs): Value {
	const nt = node.type;
	if(nt === RType.String) {
		return stringFrom(node.content.str);
	} else if(nt === RType.Number) {
		return intervalFrom(node.content.num, node.content.num);
	} else if(nt === RType.Logical) {
		return node.content.valueOf() ? ValueLogicalTrue : ValueLogicalFalse;
	} else if(nt === RType.FunctionDefinition) {
		return { type: 'function-definition' };
	} else if((nt === RType.FunctionCall || nt === RType.BinaryOp || nt === RType.UnaryOp) && graph) {
		const origin = getOriginInDfg(graph, node.info.id)?.[0];
		if(origin === undefined || origin.type !== OriginType.BuiltInFunctionOrigin) {
			return Top;
		}
		let builtInName;

		if(isBuiltIn(origin.proc)) {
			builtInName = origin.proc;
		} else if(nt === RType.FunctionCall && node.named) {
			builtInName = builtInId(Identifier.getName(node.functionName.content));
		} else if(nt === RType.BinaryOp || nt === RType.UnaryOp) {
			builtInName = builtInId(node.operator);
		} else {
			return Top;
		}
		if(Object.hasOwn(BuiltInEvalHandlerMapper, builtInName)) {
			const handler = BuiltInEvalHandlerMapper[builtInName as keyof typeof BuiltInEvalHandlerMapper];
			return handler({ resolve, node, ctx, blocked, environment, graph, idMap });
		}
	}
	return Top;
}

/**
 * Helper function used by {@link resolveIdToValue}, please use that instead, if
 * you want to resolve the value of an identifier / node
 *
 * This function resolves a vector function call `c` to a {@link ValueVector}
 * by recursively resolving the values of the arguments by calling {@link resolveIdToValue}
 * @returns ValueVector or Top
 */
export function resolveAsVector({ resolve, environment, node, graph, idMap, ctx, blocked }: BuiltInEvalHandlerArgs): ValueVector | typeof Top {
	if(node.type !== RType.FunctionCall) {
		return Top;
	}
	const resolveInfo = { environment, graph, idMap, full: true, resolve, ctx, blocked };
	const values = node.arguments.map(arg => arg !== EmptyArgument ? resolveIdToValue(arg.value, resolveInfo) : Top);

	return vectorFrom(flattenVectorElements(values));
}

/**
 * Helper function used by {@link resolveIdToValue}, please use that instead, if
 * you want to resolve the value of an identifier / node
 *
 * This function resolves a binary sequence operator `:` to a {@link ValueVector} of {@link ValueNumber}s
 * by recursively resolving the values of the arguments by calling {@link resolveIdToValue}
 * @returns ValueVector of ValueNumbers or Top
 */
export function resolveAsSeq({ node: operator, environment, resolve, ctx, graph, idMap, blocked }: BuiltInEvalHandlerArgs): ValueVector<Lift<ValueNumber[]>> | typeof Top {
	if(operator.type !== RType.BinaryOp) {
		return Top;
	}
	const resolveInfo: ResolveInfo = { environment, graph, idMap, full: true, resolve, ctx, blocked };
	const leftArg = resolveIdToValue(operator.lhs, resolveInfo);
	const rightArg = resolveIdToValue(operator.rhs, resolveInfo);
	const leftValue = unliftRValue(leftArg);
	const rightValue = unliftRValue(rightArg);

	if(isRNumberValue(leftValue) && isRNumberValue(rightValue)) {
		return vectorFrom(createNumberSequence(leftValue, rightValue).map(liftScalar));
	}
	return Top;
}

/**
 * Helper function used by {@link resolveIdToValue}, please use that instead, if
 * you want to resolve the value of an identifier / node
 *
 * This function resolves a unary plus operator `+` to a {@link ValueNumber} or {@link ValueVector} of ValueNumbers
 * by recursively resolving the values of the arguments by calling {@link resolveIdToValue}
 * @returns ValueNumber, ValueVector of ValueNumbers, or Top
 */
export function resolveAsPlus({ node: operator, environment, resolve, ctx, graph, idMap, blocked }: BuiltInEvalHandlerArgs): ValueNumber | ValueVector<Lift<ValueNumber[]>> | typeof Top {
	if(operator.type !== RType.UnaryOp) {
		return Top;
	}
	const resolveInfo = { environment, graph, idMap, full: true, resolve, ctx, blocked };
	const arg = resolveIdToValue(operator.operand, resolveInfo);
	const argValue = unliftRValue(arg);

	if(isRNumberValue(argValue)) {
		return liftScalar(argValue);
	} else if(Array.isArray(argValue) && argValue.every(isRNumberValue)) {
		return vectorFrom(argValue.map(liftScalar));
	}
	return Top;
}

/**
 * Helper function used by {@link resolveIdToValue}, please use that instead, if
 * you want to resolve the value of an identifier / node
 *
 * This function resolves a unary minus operator `-` to a {@link ValueNumber} or {@link ValueVector} of ValueNumbers
 * by recursively resolving the values of the arguments by calling {@link resolveIdToValue}
 * @returns ValueNumber, ValueVector of ValueNumbers, or Top
 */
export function resolveAsMinus({ node: operator, environment, resolve, ctx, graph, idMap, blocked }: BuiltInEvalHandlerArgs): ValueNumber | ValueVector<Lift<ValueNumber[]>> | typeof Top {
	if(operator.type !== RType.UnaryOp) {
		return Top;
	}
	const resolveInfo = { environment, graph, idMap, full: true, resolve, ctx, blocked };
	const arg = resolveIdToValue(operator.operand, resolveInfo);
	const argValue = unliftRValue(arg);

	if(isRNumberValue(argValue)) {
		return liftScalar({ ...argValue, num: -argValue.num });
	} else if(Array.isArray(argValue) && argValue.every(isRNumberValue)) {
		return vectorFrom(argValue.map(element => liftScalar({ ...element, num: -element.num })));
	}
	return Top;
}

function createNumberSequence(start: RNumberValue, end: RNumberValue): RNumberValue[] {
	const sequence: RNumberValue[] = [];
	const min = Math.min(start.num, end.num);
	const max = Math.max(start.num, end.num);

	for(let i = min; i <= max; i++) {
		sequence.push({ ...start, num: i });
	}

	if(start > end) {
		sequence.reverse();
	}
	return sequence;
}
