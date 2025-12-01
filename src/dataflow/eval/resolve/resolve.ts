import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { AstIdMap, RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { RNumberValue } from '../../../r-bridge/lang-4.x/convert-values';
import { isRNumberValue, unliftRValue } from '../../../util/r-value';
import { BuiltInEvalHandlerMapper, builtInId, isBuiltIn } from '../../environments/built-in';
import type { REnvironmentInformation } from '../../environments/environment';
import type { DataflowGraph } from '../../graph/graph';
import { getOriginInDfg, OriginType } from '../../origin/dfg-get-origin';
import { intervalFrom } from '../values/intervals/interval-constants';
import { ValueLogicalFalse, ValueLogicalTrue } from '../values/logical/logical-constants';
import { type Lift, Top, type Value, type ValueNumber, type ValueVector } from '../values/r-value';
import { stringFrom } from '../values/string/string-constants';
import { flattenVectorElements, vectorFrom } from '../values/vectors/vector-constants';
import { resolveIdToValue } from './alias-tracking';
import type { VariableResolve } from '../../../config';
import { liftScalar } from '../values/scalar/scalar-consatnts';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';

/**
 * Helper function used by {@link resolveIdToValue}, please use that instead, if
 * you want to resolve the value of an identifier / node
 *
 * This function converts an RNode to its Value, but also recursively resolves
 * aliases and vectors (in case of a vector).
 * @param a       - Ast node to resolve
 * @param resolve - Variable resolve mode
 * @param env     - Environment to use
 * @param graph   - Dataflow Graph to use
 * @param map     - Idmap of Dataflow Graph
 * @returns resolved value or top/bottom
 */
export function resolveNode(resolve: VariableResolve, a: RNodeWithParent, ctx: ReadOnlyFlowrAnalyzerContext, env?: REnvironmentInformation, graph?: DataflowGraph, map?: AstIdMap): Value {
	if(a.type === RType.String) {
		return stringFrom(a.content.str);
	} else if(a.type === RType.Number) {
		return intervalFrom(a.content.num, a.content.num);
	} else if(a.type === RType.Logical) {
		return a.content.valueOf() ? ValueLogicalTrue : ValueLogicalFalse;
	} else if(a.type === RType.FunctionDefinition) {
		return { type: 'function-definition' };
	} else if((a.type === RType.FunctionCall || a.type === RType.BinaryOp || a.type === RType.UnaryOp) && graph) {
		const origin = getOriginInDfg(graph, a.info.id)?.[0];
		if(origin === undefined || origin.type !== OriginType.BuiltInFunctionOrigin) {
			return Top;
		}
		let builtInName;

		if(isBuiltIn(origin.proc)) {
			builtInName = origin.proc;
		} else if(a.type === RType.FunctionCall && a.named) {
			builtInName = builtInId(a.functionName.content);
		} else if(a.type === RType.BinaryOp || a.type === RType.UnaryOp) {
			builtInName = builtInId(a.operator);
		} else {
			return Top;
		}
		if(Object.hasOwn(BuiltInEvalHandlerMapper, builtInName)) {
			const handler = BuiltInEvalHandlerMapper[builtInName as keyof typeof BuiltInEvalHandlerMapper];
			return handler(resolve, a, ctx, env, graph, map);
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
 * @param resolve     - Variable resolve mode
 * @param node        - Node of the vector function to resolve
 * @param environment - Environment to use
 * @param ctx         - Analyzer context
 * @param graph       - Dataflow graph
 * @param idMap       - ID map of the dataflow graph
 * @returns ValueVector or Top
 */
export function resolveAsVector(resolve: VariableResolve, node: RNodeWithParent, ctx: ReadOnlyFlowrAnalyzerContext, environment?: REnvironmentInformation, graph?: DataflowGraph, idMap?: AstIdMap): ValueVector<Lift<Value[]>> | typeof Top {
	if(node.type !== RType.FunctionCall) {
		return Top;
	}
	const resolveInfo = { environment, graph, idMap, full: true, resolve, ctx };
	const values = node.arguments.map(arg => arg !== EmptyArgument ? resolveIdToValue(arg.value, resolveInfo) : Top);

	return vectorFrom(flattenVectorElements(values));
}

/**
 * Helper function used by {@link resolveIdToValue}, please use that instead, if
 * you want to resolve the value of an identifier / node
 *
 * This function resolves a binary sequence operator `:` to a {@link ValueVector} of {@link ValueNumber}s
 * by recursively resolving the values of the arguments by calling {@link resolveIdToValue}
 * @param resolve  - Variable resolve mode
 * @param operator - Node of the sequence operator to resolve
 * @param env      - Environment to use
 * @param graph    - Dataflow graph
 * @param map      - Id map of the dataflow graph
 * @returns ValueVector of ValueNumbers or Top
 */
export function resolveAsSeq(resolve: VariableResolve, operator: RNodeWithParent, ctx: ReadOnlyFlowrAnalyzerContext, environment?: REnvironmentInformation, graph?: DataflowGraph, idMap?: AstIdMap): ValueVector<Lift<ValueNumber[]>> | typeof Top {
	if(operator.type !== RType.BinaryOp) {
		return Top;
	}
	const resolveInfo = { environment, graph, idMap, full: true, resolve, ctx };
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
 * @param resolve  - Variable resolve mode
 * @param operator - Node of the plus operator to resolve
 * @param env      - Environment to use
 * @param graph    - Dataflow graph
 * @param map      - Id map of the dataflow graph
 * @returns ValueNumber, ValueVector of ValueNumbers, or Top
 */
export function resolveAsPlus(resolve: VariableResolve, operator: RNodeWithParent, ctx: ReadOnlyFlowrAnalyzerContext, environment?: REnvironmentInformation, graph?: DataflowGraph, idMap?: AstIdMap): ValueNumber | ValueVector<Lift<ValueNumber[]>> | typeof Top {
	if(operator.type !== RType.UnaryOp) {
		return Top;
	}
	const resolveInfo = { environment, graph, idMap, full: true, resolve, ctx };
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
 * @param resolve  - Variable resolve mode
 * @param operator - Node of the minus operator to resolve
 * @param env      - Environment to use
 * @param graph    - Dataflow graph
 * @param map      - Id map of the dataflow graph
 * @returns ValueNumber, ValueVector of ValueNumbers, or Top
 */
export function resolveAsMinus(resolve: VariableResolve, operator: RNodeWithParent, ctx: ReadOnlyFlowrAnalyzerContext, environment?: REnvironmentInformation, graph?: DataflowGraph, idMap?: AstIdMap): ValueNumber | ValueVector<Lift<ValueNumber[]>> | typeof Top {
	if(operator.type !== RType.UnaryOp) {
		return Top;
	}
	const resolveInfo = { environment, graph, idMap, full: true, resolve, ctx };
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
