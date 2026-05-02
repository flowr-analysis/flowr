import { FunctionArgument } from '../../dataflow/graph/graph';
import { Identifier } from '../../dataflow/environments/identifier';
import type { NumericPentagonInferenceVisitor } from './numeric-pentagon-inference';
import { ClosedPentagonValueDomain } from './closed-pentagon-value-domain';
import { numericInferenceLogger } from '../interval/numeric-interval-inference';
import { isNotUndefined, isUndefined } from '../../util/assert';
import { getMin } from '../../util/numbers';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ClosedPentagonDomain } from './closed-pentagon-domain';
import {
	IntervalExpressionSemanticsMapper,
	intervalNegativeOp,
	intervalSubtractOp
} from '../interval/expression-semantics';

/**
 * Maps function/operator names to the semantic functions.
 */
const PentagonExpressionSemanticsMapper = [
	[Identifier.make('-'), unaryBinaryExprOpSemantics(pentagonNegativeOp, pentagonSubtractOp)]
] as const satisfies readonly PentagonSemanticsMapperInfo[];

type PentagonSemanticsMapperInfo = [identifier: Identifier, semantics: NaryFnSemantics];

type UnaryOpSemantics = (target: NodeId, arg: [NodeId, ClosedPentagonValueDomain | undefined], currentState: ClosedPentagonDomain, visitor: NumericPentagonInferenceVisitor, significantFigures: number | undefined) => ClosedPentagonValueDomain | undefined;

type BinaryOpSemantics = (target: NodeId, left: [NodeId, ClosedPentagonValueDomain | undefined], right: [NodeId, ClosedPentagonValueDomain | undefined], currentState: ClosedPentagonDomain, visitor: NumericPentagonInferenceVisitor, significantFigures: number | undefined) => ClosedPentagonValueDomain | undefined;

type UnaryFnSemantics = (target: NodeId, arg: FunctionArgument, visitor: NumericPentagonInferenceVisitor, currentState: ClosedPentagonDomain, significantFigures: number | undefined) => ClosedPentagonValueDomain | undefined;

type NaryFnSemantics = (target: NodeId, args: readonly FunctionArgument[], visitor: NumericPentagonInferenceVisitor, currentState: ClosedPentagonDomain, significantFigures: number | undefined) => ClosedPentagonValueDomain | undefined;

/**
 * Applies the abstract expression semantics of the provided function with respect to the closed pentagon domain to the provided args.
 * If the pentagon semantics are not available, the interval semantics are applied as fallback.
 * @param target - Node ID of the result node.
 * @param functionIdentifier - The {@link Identifier} of the function/operator.
 * @param args - The arguments of the function/operator.
 * @param visitor - The pentagon inference visitor performing the analysis used to resolve nodes.
 * @param currentState - The current state in the inference process, to update the upper bounds of other nodes.
 * @param significantFigures - The number of significant figures used to create new intervals.
 * @returns The resulting pentagon after applying the semantics.
 */
export function applyPentagonExpressionSemantics(target: NodeId, functionIdentifier: Identifier, args: readonly FunctionArgument[], visitor: NumericPentagonInferenceVisitor, currentState: ClosedPentagonDomain, significantFigures?: number): ClosedPentagonValueDomain | undefined {
	const match = PentagonExpressionSemanticsMapper.find(([id]) => Identifier.matches(id, functionIdentifier));

	if(isUndefined(match)) {
		// Check if we at least have interval semantics and apply them if available.
		const intervalMatch = IntervalExpressionSemanticsMapper.find(([id]) => Identifier.matches(id, functionIdentifier));

		if(isUndefined(intervalMatch)) {
			numericInferenceLogger.debug(`Function identifier ${functionIdentifier.toString()} is not a valid pentagon operation. Returning undefined semantics.`);
			return undefined;
		} else {
			const [_, semantics] = intervalMatch;

			const interval = semantics(args, (node: NodeId) => visitor.getAbstractValue(node)?.value.interval, significantFigures);

			if(isUndefined(interval)) {
				return undefined;
			} else {
				const pentagon = ClosedPentagonValueDomain.top();
				pentagon.value.interval = interval;
				return pentagon;
			}
		}
	} else {
		const [_, semantics] = match;

		return semantics(target, args, visitor, currentState, significantFigures);
	}
}

function unaryBinaryExprOpSemantics(unaryOperatorSemantics: UnaryOpSemantics, binaryOperatorSemantics: BinaryOpSemantics): NaryFnSemantics {
	return (target: NodeId, args: readonly FunctionArgument[], visitor: NumericPentagonInferenceVisitor, currentState: ClosedPentagonDomain, significantFigures: number | undefined): ClosedPentagonValueDomain | undefined => {
		// Usage as unary operator
		if(args.length === 1) {
			if(FunctionArgument.isEmpty(args[0])) {
				numericInferenceLogger.warn('Called unary operator with an empty argument, which is not supported.');
				return ClosedPentagonValueDomain.bottom(significantFigures);
			}

			const arg = visitor.getAbstractValue(args[0].nodeId);
			return unaryOperatorSemantics(target, [args[0].nodeId, arg], currentState, visitor, significantFigures);
		}

		return binaryExprOpSemantics(binaryOperatorSemantics)(target, args, visitor, currentState, significantFigures);
	};
}

function binaryExprOpSemantics(binaryOperatorSemantics: BinaryOpSemantics): NaryFnSemantics {
	return (target: NodeId, args: readonly FunctionArgument[], visitor: NumericPentagonInferenceVisitor, currentState: ClosedPentagonDomain, significantFigures: number | undefined): ClosedPentagonValueDomain | undefined => {
		if(args.length !== 2) {
			numericInferenceLogger.warn('Called binary operator with more/less than 2 arguments, which is not supported.');
			return ClosedPentagonValueDomain.bottom(significantFigures);
		}

		if(FunctionArgument.isEmpty(args[0]) || FunctionArgument.isEmpty(args[1])) {
			numericInferenceLogger.warn('Called binary operator with at least one empty argument, which is not supported.');
			return ClosedPentagonValueDomain.bottom(significantFigures);
		}

		const left = visitor.getAbstractValue(args[0].nodeId);
		const right = visitor.getAbstractValue(args[1].nodeId);

		return binaryOperatorSemantics(target, [args[0].nodeId, left], [args[1].nodeId, right], currentState, visitor, significantFigures);
	};
}

function _unaryExprFnSemantics(unaryFunctionSemantics: UnaryFnSemantics): NaryFnSemantics {
	return (target: NodeId, args: readonly FunctionArgument[], visitor: NumericPentagonInferenceVisitor, currentState: ClosedPentagonDomain, significantFigures: number | undefined): ClosedPentagonValueDomain | undefined => {
		if(args.length !== 1) {
			numericInferenceLogger.warn('Called unary function with more/less than 1 argument, which is not supported.');
			return ClosedPentagonValueDomain.bottom(significantFigures);
		}

		return unaryFunctionSemantics(target, args[0], visitor, currentState, significantFigures);
	};
}

function pentagonNegativeOp(target: NodeId, arg: [NodeId, ClosedPentagonValueDomain | undefined], currentState: ClosedPentagonDomain, visitor: NumericPentagonInferenceVisitor): ClosedPentagonValueDomain | undefined {
	const [argNodeId, argValue] = arg;
	if(argValue?.isValue() && argValue.value.interval.isValue()) {
		const targetPentagon = ClosedPentagonValueDomain.top();

		const interval = intervalNegativeOp(argValue.value.interval);
		if(isUndefined(interval)) {
			return;
		}
		targetPentagon.value.interval = interval;

		const [a, b] = argValue.value.interval.value;
		const argOrigins = visitor.getVariableOrigins(argNodeId);
		const argOrigin = argOrigins.length === 1 ? argOrigins[0] : argNodeId;
		if(a >= 0) {
			// target will be smaller than arg => arg is an upper bound
			if(argOrigins.length <= 1) {
				targetPentagon.value.upperBounds.add(argOrigin);
			}
		}
		if(b <= 0) {
			// target will be greater than arg => target is upper bound for arg
			if(argOrigins.length <= 1) {
				currentState.get(argOrigin)?.value.upperBounds.add(target);
			}
		}

		return targetPentagon;
	}
}

function pentagonSubtractOp(target: NodeId, left: [NodeId, ClosedPentagonValueDomain | undefined], right: [NodeId, ClosedPentagonValueDomain | undefined], currentState: ClosedPentagonDomain, visitor: NumericPentagonInferenceVisitor): ClosedPentagonValueDomain | undefined {
	const [leftNodeId, leftValue] = left;
	const [rightNodeId, rightValue] = right;

	const smallestSignificantFigures = getMin([leftValue?.value.interval.significantFigures, rightValue?.value.interval.significantFigures].filter(isNotUndefined));

	if(leftValue?.isBottom() || rightValue?.isBottom()) {
		return ClosedPentagonValueDomain.bottom(smallestSignificantFigures);
	}


	if(leftValue?.isValue() && leftValue.value.interval.isValue() && rightValue?.isValue() && rightValue.value.interval.isValue()) {
		const resultPentagon = ClosedPentagonValueDomain.top();

		let interval = intervalSubtractOp(leftValue.value.interval, rightValue.value.interval);
		if(isUndefined(interval)) {
			return;
		}
		if(rightValue.value.upperBounds.has(leftNodeId)) {
			// right <= left: result must be positive
			interval = interval.meet(leftValue.value.interval.create([0, Infinity]));
		}
		if(leftValue.value.upperBounds.has(rightNodeId)) {
			// left <= right: result must be negative
			interval = interval.meet(leftValue.value.interval.create([-Infinity, 0]));
		}
		resultPentagon.value.interval = interval;

		// Upper Bounds Part
		const [c, d] = rightValue.value.interval.value;

		const leftOrigins = visitor.getVariableOrigins(leftNodeId);
		const leftOrigin = leftOrigins.length === 1 ? leftOrigins[0]: leftNodeId;
		if(c >= 0) {
			// Always subtract positive number => result is always smaller than left and therefore inherits its upper bounds
			if(leftOrigins.length <= 1) {
				resultPentagon.value.upperBounds = leftValue.value.upperBounds.create(leftValue.value.upperBounds.value);
				resultPentagon.value.upperBounds.add(leftOrigin);
			}
		}
		if(d <= 0) {
			// Always subtract negative number => result is always bigger than left and therefore left receives target as upper bound
			const leftOrigins = visitor.getVariableOrigins(leftNodeId);
			if(leftOrigins.length <= 1) {
				currentState.get(leftOrigin)?.value.upperBounds.add(target);
			}
		}

		return resultPentagon;
	}
	return undefined;
}